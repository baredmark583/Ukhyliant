
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
    deletePlayer
} from './db.js';
import { ADMIN_TELEGRAM_ID, MODERATOR_TELEGRAM_IDS, MAX_ENERGY, ENERGY_REGEN_RATE } from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const BOT_TOKEN = process.env.BOT_TOKEN;

const geminiApiKey = process.env.GEMINI_API_KEY;
let ai;
if (geminiApiKey) {
    ai = new GoogleGenAI({ apiKey: geminiApiKey });
} else {
    console.warn("GEMINI_API_KEY not found. Translation will be disabled.");
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
        res.redirect('/admin/login.html');
    }
};


// --- PUBLIC GAME API ROUTES ---
app.get('/', (req, res) => res.send('Ukhyliant Clicker Backend is running!'));

app.post('/api/login', async (req, res) => {
    try {
        const { tgUser, startParam } = req.body;
        if (!tgUser || !tgUser.id) {
            return res.status(400).json({ error: "Invalid Telegram user data." });
        }
        
        const userId = tgUser.id.toString();
        const config = await getConfig();
        let user = await getUser(userId);
        let player = await getPlayer(userId);

        if (!user) { // New user
            const referrerId = (startParam && startParam !== userId) ? startParam : null;
            let lang = 'en';
            if (tgUser.language_code === 'ua' || tgUser.language_code === 'uk') lang = 'ua';
            if (tgUser.language_code === 'ru') lang = 'ru';

            user = await createUser(userId, tgUser.first_name, lang);
            
            const now = Date.now();
            player = {
                balance: 500, energy: MAX_ENERGY, profitPerHour: 0, coinsPerTap: 1, lastLoginTimestamp: now,
                upgrades: {}, stars: 100, referrals: 0, completedDailyTaskIds: [],
                purchasedSpecialTaskIds: [], completedSpecialTaskIds: [],
                dailyTaps: 0, lastDailyReset: now
            };
            await savePlayer(userId, player);
            
            if (referrerId) {
                await applyReferralBonus(referrerId);
            }
        } else { // Existing user
            const now = Date.now();
            const offlineSeconds = Math.floor((now - player.lastLoginTimestamp) / 1000);
            const offlineEarnings = (player.profitPerHour / 3600) * offlineSeconds;
            
            player.balance += offlineEarnings;
            player.energy = Math.min(MAX_ENERGY, player.energy + (ENERGY_REGEN_RATE * offlineSeconds));
            player.lastLoginTimestamp = now;

            await savePlayer(userId, player);
        }

        let role = 'user';
        if (userId === ADMIN_TELEGRAM_ID) role = 'admin';
        else if (MODERATOR_TELEGRAM_IDS.includes(userId)) role = 'moderator';
        
        const userWithRole = { ...user, role };
        
        res.json({ user: userWithRole, player, config });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal server error during login." });
    }
});


app.post('/api/player/:id', async (req, res) => {
    await savePlayer(req.params.id, req.body);
    res.status(200).send();
});

app.post('/api/user/:id/language', async (req, res) => {
    await updateUserLanguage(req.params.id, req.body.language);
    res.status(200).send();
});

// --- GAME ACTIONS API ---
app.post('/api/create-invoice', async (req, res) => {
    try {
        if (!BOT_TOKEN) {
            return res.status(500).json({ ok: false, error: 'Bot token not configured.' });
        }
        const { userId, taskId } = req.body;
        const config = await getConfig();
        const task = config.specialTasks.find(t => t.id === taskId);
        if (!task || task.priceStars <= 0) {
            return res.status(400).json({ ok: false, error: 'Task not found or is free.' });
        }

        const payload = `special_task:${userId}:${taskId}`;
        const invoice = {
            title: task.name.en,
            description: task.description.en,
            payload: payload,
            currency: 'XTR',
            prices: [{ label: 'Unlock Task', amount: task.priceStars }]
        };

        const tgResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(invoice),
        });
        const data = await tgResponse.json();
        
        if (data.ok) {
            res.json({ ok: true, invoiceLink: data.result });
        } else {
            res.status(500).json({ ok: false, error: data.description });
        }
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({ ok: false, error: 'Internal server error.' });
    }
});

app.post('/api/action/unlock-free-task', async (req, res) => {
    try {
        const { userId, taskId } = req.body;
        const config = await getConfig();
        const task = config.specialTasks.find(t => t.id === taskId);
        if (!task || task.priceStars > 0) {
            return res.status(400).json({ error: 'Task is not free.' });
        }
        const updatedPlayerState = await unlockSpecialTask(userId, taskId);
        res.json(updatedPlayerState);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});


app.post('/api/action/complete-task', async (req, res) => {
    try {
        const { userId, taskId } = req.body;
        const updatedPlayerState = await completeAndRewardSpecialTask(userId, taskId);
        res.json(updatedPlayerState);
    } catch (error) {
         res.status(500).json({ error: 'Internal server error.' });
    }
});


// --- TELEGRAM WEBHOOK ---
app.post('/api/telegram-webhook', async (req, res) => {
    try {
        const update = req.body;
        if (update.pre_checkout_query) {
            // Confirm the checkout
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pre_checkout_query_id: update.pre_checkout_query.id,
                    ok: true
                })
            });
        } else if (update.message?.successful_payment) {
            const payload = update.message.successful_payment.invoice_payload;
            if (payload.startsWith('special_task:')) {
                const [, userId, taskId] = payload.split(':');
                await unlockSpecialTask(userId, taskId);
                console.log(`Unlocked task ${taskId} for user ${userId} after payment.`);
            }
        }
    } catch (error) {
        console.error('Webhook processing error:', error);
    }
    res.sendStatus(200); // Always respond 200 to Telegram
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
        res.redirect('/admin');
    } else {
        res.status(401).send('Incorrect password. <a href="/admin/login.html">Try again</a>');
    }
});
app.get('/admin/logout', (req, res) => {
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
app.get('/admin/api/players', isAdminAuthenticated, async (req, res) => {
    try {
        const players = await getAllPlayersForAdmin();
        res.json(players);
    } catch (error) {
        console.error("Failed to get players:", error);
        res.status(500).json({ error: "Internal server error while fetching players." });
    }
});

app.delete('/admin/api/player/:id', isAdminAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        await deletePlayer(id);
        res.status(200).json({ message: 'Player deleted successfully.' });
    } catch (error) {
        console.error("Failed to delete player:", error);
        res.status(500).json({ error: "Internal server error while deleting player." });
    }
});

app.get('/admin/api/config', isAdminAuthenticated, async (req, res) => {
    const config = await getConfig();
    res.json(config);
});

app.post('/admin/api/config', isAdminAuthenticated, async (req, res) => {
    try {
        const newConfig = req.body.config;
        if (!newConfig) {
            return res.status(400).json({ error: 'Config data is missing in the request body.' });
        }
        await saveConfig(newConfig);
        res.status(200).json({ message: 'Configuration saved successfully.' });
    } catch (error) {
        console.error("Failed to save config:", error);
        res.status(500).json({ error: "Internal server error while saving configuration." });
    }
});

app.post('/admin/api/translate', isAdminAuthenticated, async (req, res) => {
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
        console.error("Translation API error:", error);
        res.status(500).json({ error: "Failed to translate text" });
    }
});


// --- SERVER INITIALIZATION ---
const startServer = async () => {
    if (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD || !process.env.DATABASE_URL) {
        console.error("FATAL ERROR: Missing required environment variables (SESSION_SECRET, ADMIN_PASSWORD, DATABASE_URL).");
        process.exit(1);
    }
    await initializeDb();
    app.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`);
        console.log(`Admin panel should be available at http://localhost:${PORT}/admin`);
    });
};

startServer();
