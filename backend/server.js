import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { GoogleGenAI } from '@google/genai';
import { 
    initializeDb, 
    getConfig, 
    saveConfig, 
    getPlayer, 
    savePlayer, 
    getUser, 
    createUser, 
    applyReferralBonus, 
    updateUserLanguage,
    unlockSpecialTask,
    completeAndRewardSpecialTask,
    getAllPlayersForAdmin,
    deletePlayer,
    getDailyEvent,
    saveDailyEvent,
    getDashboardStats,
    claimComboReward,
    claimCipherReward,
    resetPlayerDailyProgress,
    claimDailyTaskReward
} from './db.js';
import { ADMIN_TELEGRAM_ID, MODERATOR_TELEGRAM_IDS, MAX_ENERGY, ENERGY_REGEN_RATE } from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Simple Logger ---
const log = (level, message, data = '') => {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    if (level === 'error') {
        if (data) console.error(formattedMessage, data);
        else console.error(formattedMessage);
    } else {
        if (data) console.log(formattedMessage, data);
        else console.log(formattedMessage);
    }
};


const app = express();
const PORT = process.env.PORT || 3001;
const BOT_TOKEN = process.env.BOT_TOKEN;

const geminiApiKey = process.env.GEMINI_API_KEY;
let ai;
if (geminiApiKey) {
    ai = new GoogleGenAI({ apiKey: geminiApiKey });
} else {
    log("warn", "GEMINI_API_KEY not found. Translation will be disabled.");
}

// Middlewares
app.use(cors({
    origin: '*', // Adjust for production
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Set up session middleware
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'default_secret_for_dev',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
    }
});

app.use(sessionMiddleware);
app.set('trust proxy', 1); // Crucial for Render proxy

// Serve static files for the admin panel
app.use('/admin', express.static(path.join(__dirname, 'public')));


// --- AUTH MIDDLEWARE FOR ADMIN PANEL ---
const isAdminAuthenticated = (req, res, next) => {
    if (req.session.isAdmin) {
        next();
    } else {
        log('warn', `Unauthorized attempt to access admin area from IP: ${req.ip}`);
        res.redirect('/admin/login.html');
    }
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

/**
 * Safely parses combo_ids from a daily event object.
 * Handles cases where the data might be a JSON string or not an array.
 * @param {object | null} event The daily event object from the database.
 * @returns {string[]} A valid array of combo IDs, or an empty array.
 */
const parseComboIds = (event) => {
    if (!event || !event.combo_ids) {
        return [];
    }
    if (Array.isArray(event.combo_ids)) {
        return event.combo_ids;
    }
    if (typeof event.combo_ids === 'string') {
        try {
            const parsed = JSON.parse(event.combo_ids);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            log('warn', 'Could not parse combo_ids string from DB:', event.combo_ids);
            return [];
        }
    }
    return [];
};


// --- PUBLIC GAME API ROUTES ---
app.get('/', (req, res) => res.send('Ukhyliant Clicker Backend is running!'));

app.post('/api/login', async (req, res) => {
    log('info', 'Received /api/login request');
    try {
        const { tgUser, startParam } = req.body;
        if (!tgUser || !tgUser.id) {
            log('warn', 'Login attempt with invalid Telegram user data.', req.body);
            return res.status(400).json({ error: "Invalid Telegram user data." });
        }
        
        const userId = tgUser.id.toString();
        log('info', `Processing login for user ID: ${userId}`);
        
        // --- DATA FETCHING ---
        const baseConfig = await getConfig();
        let dailyEvent = await getDailyEvent(getTodayDate());
        let user = await getUser(userId);
        let player = await getPlayer(userId);

        const now = Date.now();
        const today = new Date(now).setHours(0, 0, 0, 0);

        // --- PLAYER & USER LOGIC ---
        if (!user) { // New user
            log('info', `New user detected: ${userId}. Creating profile.`);
            const referrerId = (startParam && startParam !== userId) ? startParam : null;
            let lang = 'en';
            if (tgUser.language_code === 'ua' || tgUser.language_code === 'uk') lang = 'ua';
            if (tgUser.language_code === 'ru') lang = 'ru';

            user = await createUser(userId, tgUser.first_name, lang);
            log('info', `User profile created for ${userId}. Language: ${lang}`);
            
            player = {
                balance: 500, energy: MAX_ENERGY, profitPerHour: 0, coinsPerTap: 1, lastLoginTimestamp: now,
                upgrades: {}, referrals: 0, completedDailyTaskIds: [],
                purchasedSpecialTaskIds: [], completedSpecialTaskIds: [],
                dailyTaps: 0, lastDailyReset: today,
                claimedComboToday: false, claimedCipherToday: false,
                dailyUpgrades: []
            };
            await savePlayer(userId, player);
            log('info', `Initial player state created for ${userId}.`);
            
            if (referrerId) {
                log('info', `Applying referral bonus. Referrer: ${referrerId}, New User: ${userId}`);
                await applyReferralBonus(referrerId);
            }
        } else { // Existing user
            log('info', `Existing user login: ${userId}. Calculating offline progress.`);
            const offlineSeconds = Math.floor((now - player.lastLoginTimestamp) / 1000);
            const offlineEarnings = (player.profitPerHour / 3600) * offlineSeconds;
            
            player.balance += offlineEarnings;
            player.energy = Math.min(MAX_ENERGY, player.energy + (ENERGY_REGEN_RATE * offlineSeconds));
            player.lastLoginTimestamp = now;

            // Reset daily progress if it's a new day
            if(player.lastDailyReset < today) {
                log('info', `New day detected for user ${userId}. Resetting daily progress.`);
                player.dailyTaps = 0;
                player.completedDailyTaskIds = [];
                player.lastDailyReset = today;
                player.claimedComboToday = false;
                player.claimedCipherToday = false;
                player.dailyUpgrades = [];
            }

            await savePlayer(userId, player);
            log('info', `User ${userId} state updated. Offline earnings: ${offlineEarnings.toFixed(2)}`);
        }

        // --- RESPONSE ASSEMBLY ---
        let role = 'user';
        if (userId === ADMIN_TELEGRAM_ID) role = 'admin';
        else if (MODERATOR_TELEGRAM_IDS.includes(userId)) role = 'moderator';
        
        const userWithRole = { ...user, role };
        
        // Create a client-facing daily event object with the correct camelCase keys
        let clientDailyEvent = null;
        if (dailyEvent) {
            clientDailyEvent = {
                comboIds: parseComboIds(dailyEvent),       // Map snake_case to camelCase
                cipherWord: dailyEvent.cipher_word || ''   // Map snake_case to camelCase
            };
        }

        // Create the final config object to be sent to the client
        const finalConfig = {
            ...baseConfig,
            dailyEvent: clientDailyEvent // Use the correctly formatted object
        };
        
        log('info', `Login successful for ${userId}. Sending config.`);
        res.json({ user: userWithRole, player, config: finalConfig });

    } catch (error) {
        log('error', "Login error:", error);
        res.status(500).json({ error: "Internal server error during login." });
    }
});


app.post('/api/player/:id', async (req, res) => {
    const userId = req.params.id;
    const clientState = req.body;
    log('info', `Saving passive player state for ID: ${userId}`);

    try {
        const serverState = await getPlayer(userId);
        if (!serverState) {
            log('warn', `Player not found during save attempt for ID: ${userId}, performing full save.`);
            await savePlayer(userId, clientState);
            return res.status(200).send();
        }
        
        // Smart merge to prevent race conditions from client overwriting server-authoritative actions.
        // We only accept passive, frequently-changing values from the client's heartbeat save.
        serverState.balance = clientState.balance;
        serverState.energy = clientState.energy;
        serverState.dailyTaps = clientState.dailyTaps;

        await savePlayer(userId, serverState);
        res.status(200).send();
    } catch (error) {
        log('error', `Error during smart save for player ${userId}:`, error);
        res.status(500).json({ error: 'Failed to save player state.' });
    }
});

app.post('/api/user/:id/language', async (req, res) => {
    log('info', `Updating language for user ${req.params.id} to ${req.body.language}`);
    await updateUserLanguage(req.params.id, req.body.language);
    res.status(200).send();
});

// --- GAME ACTIONS API ---

app.post('/api/action/buy-upgrade', async (req, res) => {
    const { userId, upgradeId } = req.body;
    log('info', `Buy upgrade attempt: User ${userId}, Upgrade ${upgradeId}`);
    try {
        if (!userId || !upgradeId) {
            log('warn', 'Missing userId or upgradeId in buy-upgrade request.', req.body);
            return res.status(400).json({ error: 'User ID and Upgrade ID are required.' });
        }

        const player = await getPlayer(userId);
        const config = await getConfig();

        if (!player || !config) {
            log('error', `Player or config not found for user ${userId}.`);
            return res.status(404).json({ error: 'Player or game config not found.' });
        }

        const upgradeTemplate = config.upgrades.find(u => u.id === upgradeId);
        if (!upgradeTemplate) {
             log('warn', `Upgrade template ${upgradeId} not found.`);
            return res.status(404).json({ error: 'Upgrade not found.' });
        }

        const currentLevel = player.upgrades[upgradeId] || 0;
        const currentPrice = Math.floor(upgradeTemplate.price * Math.pow(1.15, currentLevel));

        if (player.balance < currentPrice) {
            log('info', `User ${userId} has insufficient funds for upgrade ${upgradeId}. Balance: ${player.balance}, Cost: ${currentPrice}`);
            return res.status(400).json({ error: 'Insufficient funds.' });
        }
        
        // Apply changes
        player.balance -= currentPrice;
        player.upgrades[upgradeId] = currentLevel + 1;

        // Add to daily upgrades list for combo tracking
        if (!player.dailyUpgrades) {
            player.dailyUpgrades = [];
        }
        if (!player.dailyUpgrades.includes(upgradeId)) {
            player.dailyUpgrades.push(upgradeId);
        }

        // Recalculate total profit with consistent logic
        player.profitPerHour = config.upgrades.reduce((total, u) => {
            const level = player.upgrades[u.id] || 0;
            return total + (u.profitPerHour * level);
        }, 0);

        await savePlayer(userId, player);
        log('info', `Upgrade ${upgradeId} purchased successfully for user ${userId}. New level: ${currentLevel + 1}`);
        res.json(player);

    } catch (error) {
        log('error', `Buy upgrade error for User ${userId}, Upgrade ${upgradeId}:`, error);
        res.status(500).json({ error: "Internal server error during purchase." });
    }
});

app.post('/api/action/claim-task', async (req, res) => {
    const { userId, taskId } = req.body;
    log('info', `Claim daily task attempt for user ${userId}, task ${taskId}`);
    try {
        if (!userId || !taskId) {
            return res.status(400).json({ error: "User ID and Task ID are required." });
        }
        const updatedPlayer = await claimDailyTaskReward(userId, taskId);
        log('info', `Daily task ${taskId} claimed successfully for user ${userId}`);
        res.json({ player: updatedPlayer });
    } catch (error) {
        log('warn', `Failed daily task claim for user ${userId}, task ${taskId}: ${error.message}`);
        res.status(400).json({ error: error.message || 'Failed to claim task.' });
    }
});

app.post('/api/create-invoice', async (req, res) => {
    log('info', 'Received request to create invoice.', req.body);
    try {
        if (!BOT_TOKEN) {
            log('error', 'SERVER ERROR: BOT_TOKEN is not configured.');
            return res.status(500).json({ ok: false, error: 'Bot token not configured on server.' });
        }
        const { userId, taskId } = req.body;
        
        const config = await getConfig();
        const user = await getUser(userId);
        
        if(!user) {
            return res.status(404).json({ ok: false, error: 'User not found.' });
        }

        const task = config.specialTasks.find(t => t.id === taskId);
        if (!task || task.priceStars <= 0) {
            return res.status(400).json({ ok: false, error: 'Task not found or is free.' });
        }

        const payload = `special_task:${userId}:${taskId}`;
        const userLang = user.language || 'en';

        const invoice = {
            title: task.name[userLang],
            description: task.description[userLang],
            payload: payload,
            provider_token: process.env.TELEGRAM_PAYMENT_PROVIDER_TOKEN,
            currency: 'XTR',
            prices: [{ label: task.name[userLang], amount: task.priceStars }]
        };

        log('info', `Creating invoice for user ${userId}, task ${taskId}. Payload:`, JSON.stringify(invoice));

        const tgResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(invoice),
        });
        
        const responseText = await tgResponse.text();
        log("info", "Response from Telegram API (createInvoiceLink):", responseText);

        const data = JSON.parse(responseText);
        
        if (data.ok) {
            res.json({ ok: true, invoiceLink: data.result });
        } else {
            res.status(500).json({ ok: false, error: data.description });
        }
    } catch (error) {
        log('error', 'Error creating invoice:', error);
        res.status(500).json({ ok: false, error: 'Internal server error.' });
    }
});
app.post('/api/action/unlock-free-task', async (req, res) => {
    const { userId, taskId } = req.body;
    log('info', `Unlocking free task ${taskId} for user ${userId}`);
    try {
        const config = await getConfig();
        const task = config.specialTasks.find(t => t.id === taskId);
        if (!task || task.priceStars > 0) {
            return res.status(400).json({ error: 'Task is not free.' });
        }
        const updatedPlayerState = await unlockSpecialTask(userId, taskId);
        res.json(updatedPlayerState);
    } catch (error) {
        log('error', `Failed to unlock free task ${taskId} for user ${userId}`, error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});
app.post('/api/action/complete-task', async (req, res) => {
    const { userId, taskId } = req.body;
    log('info', `Completing special task ${taskId} for user ${userId}`);
    try {
        const updatedPlayerState = await completeAndRewardSpecialTask(userId, taskId);
        res.json(updatedPlayerState);
    } catch (error) {
        log('error', `Failed to complete task ${taskId} for user ${userId}`, error);
         res.status(500).json({ error: 'Internal server error.' });
    }
});
app.post('/api/action/claim-combo', async (req, res) => {
    const { userId } = req.body;
    log('info', `Claim combo attempt for user ${userId}`);
    try {
        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }
        const { player, reward } = await claimComboReward(userId);
        log('info', `Combo reward of ${reward} claimed successfully for user ${userId}`);
        res.json({ player, reward });
    } catch (error) {
         log('warn', `Failed combo claim for user ${userId}: ${error.message}`);
         res.status(400).json({ error: error.message || 'Failed to claim combo.' });
    }
});
app.post('/api/action/claim-cipher', async (req, res) => {
    const { userId, cipher } = req.body;
    log('info', `Claim cipher attempt for user ${userId} with cipher "${cipher}"`);
    try {
        if (!userId || !cipher) {
            return res.status(400).json({ error: "User ID and cipher are required." });
        }
        const { player, reward } = await claimCipherReward(userId, cipher);
        log('info', `Cipher reward of ${reward} claimed successfully for user ${userId}`);
        res.json({ player, reward });
    } catch (error) {
        log('warn', `Failed cipher claim for user ${userId}: ${error.message}`);
        res.status(400).json({ error: error.message || 'Failed to claim cipher.' });
    }
});

// --- TELEGRAM WEBHOOK ---
app.post('/api/telegram-webhook', async (req, res) => {
    log('info', 'Received update from Telegram webhook.', req.body);
    try {
        const update = req.body;
        if (update.pre_checkout_query) {
            log('info', 'Answering pre_checkout_query', update.pre_checkout_query);
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pre_checkout_query_id: update.pre_checkout_query.id,
                    ok: true
                })
            });
        } else if (update.message?.successful_payment) {
            log('info', 'Processing successful payment.', update.message.successful_payment);
            const payload = update.message.successful_payment.invoice_payload;
            if (payload.startsWith('special_task:')) {
                const [, userId, taskId] = payload.split(':');
                await unlockSpecialTask(userId, taskId);
                log('info', `Unlocked task ${taskId} for user ${userId} after payment.`);
            }
        }
    } catch (error) {
        log('error', 'Webhook processing error:', error);
    }
    res.sendStatus(200);
});

// --- ADMIN WEB PANEL ROUTES ---
app.get('/admin/login.html', (req, res) => {
    if (req.session.isAdmin) {
        return res.redirect('/admin');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        log('info', `Admin login successful from IP: ${req.ip}`);
        res.redirect('/admin');
    } else {
        log('warn', `Failed admin login attempt from IP: ${req.ip}`);
        res.status(401).send('Incorrect password. <a href="/admin/login.html">Try again</a>');
    }
});
app.get('/admin/logout', (req, res) => {
    log('info', 'Admin logged out.');
    req.session.destroy(err => {
        if(err) {
            return res.redirect('/admin');
        }
        res.clearCookie('connect.sid');
        res.redirect('/admin/login.html');
    });
});
app.get('/admin', isAdminAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});


// --- ADMIN API (PROTECTED) ---
app.get('/admin/api/dashboard-stats', isAdminAuthenticated, async (req, res) => {
    log('info', 'Admin requested dashboard stats.');
    try {
        const stats = await getDashboardStats();
        res.json(stats);
    } catch (error) {
        log('error', "Failed to get dashboard stats:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});
app.get('/admin/api/daily-events', isAdminAuthenticated, async (req, res) => {
    log('info', 'Admin requested daily events config.');
    try {
        const event = await getDailyEvent(getTodayDate());
        if (event) {
            event.combo_ids = parseComboIds(event);
        }
        res.json(event || { combo_ids: [], cipher_word: '', combo_reward: 5000000, cipher_reward: 1000000 });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch daily events' });
    }
});
app.post('/admin/api/daily-events', isAdminAuthenticated, async (req, res) => {
    log('info', 'Admin saving daily events.', req.body);
    try {
        const { comboIds, cipherWord, comboReward, cipherReward } = req.body;
        // Ensure rewards are numbers before saving
        const comboRewardNum = parseInt(comboReward, 10) || 5000000;
        const cipherRewardNum = parseInt(cipherReward, 10) || 1000000;
        await saveDailyEvent(getTodayDate(), comboIds, cipherWord, comboRewardNum, cipherRewardNum);
        res.status(200).json({ message: 'Daily event saved' });
    } catch (error) {
        log('error', 'Failed to save daily event.', error);
        res.status(500).json({ error: 'Failed to save daily event' });
    }
});
app.get('/admin/api/players', isAdminAuthenticated, async (req, res) => {
    log('info', 'Admin requested player list.');
    try {
        const players = await getAllPlayersForAdmin();
        res.json(players);
    } catch (error) {
        log('error', "Failed to get players:", error);
        res.status(500).json({ error: "Internal server error while fetching players." });
    }
});
app.delete('/admin/api/player/:id', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;
    log('info', `Admin initiated deletion of player ${id}`);
    try {
        await deletePlayer(id);
        log('info', `Player ${id} deleted successfully.`);
        res.status(200).json({ message: 'Player deleted successfully.' });
    } catch (error) {
        log('error', `Failed to delete player ${id}:`, error);
        res.status(500).json({ error: "Internal server error while deleting player." });
    }
});

app.post('/admin/api/player/:id/reset-daily', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;
    log('info', `Admin initiated daily progress reset for player ${id}`);
    try {
        await resetPlayerDailyProgress(id);
        log('info', `Daily progress for player ${id} reset successfully.`);
        res.status(200).json({ message: 'Player daily progress reset successfully.' });
    } catch (error) {
        log('error', `Failed to reset daily progress for player ${id}:`, error);
        res.status(500).json({ error: "Internal server error while resetting daily progress." });
    }
});

app.get('/admin/api/config', isAdminAuthenticated, async (req, res) => {
    log('info', 'Admin requested game config.');
    const config = await getConfig();
    res.json(config);
});
app.post('/admin/api/config', isAdminAuthenticated, async (req, res) => {
    log('info', 'Admin saving main game config.');
    try {
        const newConfig = req.body.config;
        if (!newConfig) {
            return res.status(400).json({ error: 'Config data is missing in the request body.' });
        }
        await saveConfig(newConfig);
        log('info', 'Game config saved successfully.');
        res.status(200).json({ message: 'Configuration saved successfully.' });
    } catch (error) {
        log('error', "Failed to save config:", error);
        res.status(500).json({ error: "Internal server error while saving configuration." });
    }
});
app.post('/admin/api/translate', isAdminAuthenticated, async (req, res) => {
    log('info', 'Admin requesting AI translation.', req.body);
    if (!ai) {
        return res.status(503).json({ error: "Translation service is not configured." });
    }
    const { text, from, to } = req.body;
    
    const getLangName = (code) => {
        if (code === 'ua') return 'Ukrainian';
        if (code === 'ru') return 'Russian';
        return 'English';
    }

    const fromLang = getLangName(from);
    const toLang = getLangName(to);
    
    const prompt = `Translate the following text from ${fromLang} to ${toLang}. Return ONLY the translated text, without any additional comments, formatting or quotation marks:\n\n"${text}"`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        res.json({ translatedText: response.text });
    } catch (error) {
        log('error', "Translation API error:", error);
        res.status(500).json({ error: "Failed to translate text" });
    }
});


// --- SERVER INITIALIZATION ---
const startServer = async () => {
    try {
        if (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD || !process.env.DATABASE_URL) {
            log("error", "FATAL ERROR: Missing required environment variables (SESSION_SECRET, ADMIN_PASSWORD, DATABASE_URL).");
            process.exit(1);
        }
        await initializeDb();
        log("info", "Database initialized successfully.");
        app.listen(PORT, () => {
            log('info', `Server is listening on port ${PORT}`);
            log('info', `Admin panel should be available at http://localhost:${PORT}/admin`);
        });
    } catch (e) {
        log("error", "FATAL ERROR: Could not start server.", e);
        process.exit(1);
    }
};

startServer();