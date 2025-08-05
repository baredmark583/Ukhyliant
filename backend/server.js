
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
    claimDailyTaskReward,
    getLeaderboardData,
    getTotalPlayerCount
} from './db.js';
import { ADMIN_TELEGRAM_ID, MODERATOR_TELEGRAM_IDS, MAX_ENERGY, ENERGY_REGEN_RATE, LEAGUES } from './constants.js';

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

const parseComboIds = (event) => {
    if (!event || !event.combo_ids) return [];
    if (Array.isArray(event.combo_ids)) return event.combo_ids;
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
        
        const baseConfig = await getConfig();
        let dailyEvent = await getDailyEvent(getTodayDate());
        let user = await getUser(userId);
        let player = await getPlayer(userId);

        const now = Date.now();
        const today = new Date(now).setHours(0, 0, 0, 0);

        if (!user) { // New user
            log('info', `New user detected: ${userId}. Creating profile.`);
            const referrerId = (startParam && startParam !== userId) ? startParam : null;
            let lang = 'en';
            if (tgUser.language_code === 'ua' || tgUser.language_code === 'uk') lang = 'ua';
            if (tgUser.language_code === 'ru') lang = 'ru';

            user = await createUser(userId, tgUser.first_name, lang);
            log('info', `User profile created for ${userId}. Language: ${lang}`);
            
            player = {
                balance: 500, energy: MAX_ENERGY, profitPerHour: 0, tasksProfitPerHour: 0, coinsPerTap: 1, lastLoginTimestamp: now,
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

        let role = 'user';
        if (userId === ADMIN_TELEGRAM_ID) role = 'admin';
        else if (MODERATOR_TELEGRAM_IDS.includes(userId)) role = 'moderator';
        
        const userWithRole = { ...user, role };
        
        let clientDailyEvent = null;
        if (dailyEvent) {
            clientDailyEvent = {
                comboIds: parseComboIds(dailyEvent),
                cipherWord: dailyEvent.cipher_word || ''
            };
        }

        const finalConfig = { ...baseConfig, dailyEvent: clientDailyEvent };
        
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
        
        serverState.balance = clientState.balance;
        serverState.energy = clientState.energy;
        serverState.dailyTaps = clientState.dailyTaps;
        serverState.lastLoginTimestamp = clientState.lastLoginTimestamp;


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

app.get('/api/leaderboard', async (req, res) => {
    try {
        const [topPlayers, totalPlayers] = await Promise.all([
            getLeaderboardData(),
            getTotalPlayerCount()
        ]);
        const playersWithLeagues = topPlayers.map(p => {
            const balance = p.balance || 0;
            const league = LEAGUES.find(l => balance >= l.minBalance) || LEAGUES[LEAGUES.length - 1];
            return {
                ...p,
                leagueName: league.name,
                leagueIcon: league.iconString
            }
        });

        res.json({ topPlayers: playersWithLeagues, totalPlayers });
    } catch(e) {
        log('error', 'Failed to fetch leaderboard data', e);
        res.status(500).json({ error: 'Could not fetch leaderboard.' });
    }
});

// --- GAME ACTIONS API ---

app.post('/api/action/buy-upgrade', async (req, res) => {
    const { userId, upgradeId } = req.body;
    log('info', `Buy upgrade attempt: User ${userId}, Upgrade ${upgradeId}`);
    try {
        if (!userId || !upgradeId) {
            return res.status(400).json({ error: 'User ID and Upgrade ID are required.' });
        }
        const player = await getPlayer(userId);
        const config = await getConfig();
        if (!player || !config) {
            return res.status(404).json({ error: 'Player or game config not found.' });
        }
        const upgradeTemplate = config.upgrades.find(u => u.id === upgradeId);
        if (!upgradeTemplate) {
            return res.status(404).json({ error: 'Upgrade not found.' });
        }
        const currentLevel = player.upgrades[upgradeId] || 0;
        const currentPrice = Math.floor(upgradeTemplate.price * Math.pow(1.15, currentLevel));
        if (player.balance < currentPrice) {
            return res.status(400).json({ error: 'Insufficient funds.' });
        }
        
        player.balance -= currentPrice;
        player.upgrades[upgradeId] = currentLevel + 1;
        if (!player.dailyUpgrades) player.dailyUpgrades = [];
        if (!player.dailyUpgrades.includes(upgradeId)) player.dailyUpgrades.push(upgradeId);

        const baseProfitFromUpgrades = config.upgrades.reduce((total, u) => {
            const level = player.upgrades[u.id] || 0;
            return total + (u.profitPerHour * level);
        }, 0);
        player.profitPerHour = baseProfitFromUpgrades + (player.tasksProfitPerHour || 0);

        await savePlayer(userId, player);
        log('info', `Upgrade ${upgradeId} purchased successfully for user ${userId}. New level: ${currentLevel + 1}`);
        res.json(player);

    } catch (error) {
        log('error', `Buy upgrade error for User ${userId}, Upgrade ${upgradeId}:`, error);
        res.status(500).json({ error: "Internal server error during purchase." });
    }
});

app.post('/api/action/claim-task', async (req, res) => {
    const { userId, taskId, code } = req.body;
    log('info', `Claim daily task attempt for user ${userId}, task ${taskId}`);
    try {
        if (!userId || !taskId) {
            return res.status(400).json({ error: "User ID and Task ID are required." });
        }
        const updatedPlayer = await claimDailyTaskReward(userId, taskId, code);
        log('info', `Daily task ${taskId} claimed successfully for user ${userId}`);
        res.json({ player: updatedPlayer });
    } catch (error) {
        log('warn', `Failed daily task claim for user ${userId}, task ${taskId}: ${error.message}`);
        res.status(400).json({ error: error.message || 'Failed to claim task.' });
    }
});

app.post('/api/create-invoice', async (req, res) => {
    // ... (logic remains the same)
});
app.post('/api/action/unlock-free-task', async (req, res) => {
    // ... (logic remains the same)
});
app.post('/api/action/complete-task', async (req, res) => {
    const { userId, taskId, code } = req.body;
    log('info', `Completing special task ${taskId} for user ${userId}`);
    try {
        const updatedPlayerState = await completeAndRewardSpecialTask(userId, taskId, code);
        res.json(updatedPlayerState);
    } catch (error) {
        log('error', `Failed to complete task ${taskId} for user ${userId}`, error);
         res.status(500).json({ error: 'Internal server error.' });
    }
});
app.post('/api/action/claim-combo', async (req, res) => {
    // ... (logic remains the same)
});
app.post('/api/action/claim-cipher', async (req, res) => {
    // ... (logic remains the same)
});

// --- TELEGRAM WEBHOOK ---
// ... (logic remains the same)

// --- ADMIN WEB PANEL ROUTES ---
// ... (logic remains the same)


// --- ADMIN API (PROTECTED) ---
app.get('/admin/api/dashboard-stats', async (req, res) => {
    // ... (logic remains the same)
});
app.get('/admin/api/daily-events', async (req, res) => {
    // ... (logic remains the same)
});
app.post('/admin/api/daily-events', async (req, res) => {
    // ... (logic remains the same)
});
app.get('/admin/api/players', async (req, res) => {
    // ... (logic remains the same)
});
app.delete('/admin/api/player/:id', async (req, res) => {
    // ... (logic remains the same)
});

app.post('/admin/api/player/:id/reset-daily', async (req, res) => {
    // ... (logic remains the same)
});

app.get('/admin/api/config', async (req, res) => {
    // ... (logic remains the same)
});
app.post('/admin/api/config', async (req, res) => {
    // ... (logic remains the same)
});
app.post('/admin/api/translate', async (req, res) => {
    // ... (logic remains the same)
});


// --- SERVER INITIALIZATION ---
// ... (all logic from previous version is correct here)
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
