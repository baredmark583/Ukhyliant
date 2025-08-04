
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
    purchaseSpecialTaskForPlayer
} from './db.js';
import { ADMIN_TELEGRAM_ID, MODERATOR_TELEGRAM_IDS, MAX_ENERGY, ENERGY_REGEN_RATE } from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

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
app.post('/api/action/purchase-special-task', async (req, res) => {
    try {
        const { userId, taskId } = req.body;
        if (!userId || !taskId) {
            return res.status(400).json({ error: 'User ID and Task ID are required.' });
        }

        const updatedPlayerState = await purchaseSpecialTaskForPlayer(userId, taskId);

        if (!updatedPlayerState) {
            return res.status(403).json({ error: 'Purchase failed. Insufficient funds or task already purchased.' });
        }

        res.json(updatedPlayerState);
    } catch (error) {
        console.error('Error purchasing special task:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});


// --- ADMIN WEB PANEL ROUTES ---

// Login page is public, but redirects if already logged in
app.get('/admin/login.html', (req, res) => {
    if (req.session.isAdmin) {
        return res.redirect('/admin');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Handle login POST
app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.redirect('/admin');
    } else {
        res.status(401).send('Incorrect password. <a href="/admin/login.html">Try again</a>');
    }
});

// Handle logout
app.get('/admin/logout', (req, res) => {
    req.session.destroy(err => {
        if(err) {
            return res.redirect('/admin');
        }
        res.clearCookie('connect.sid');
        res.redirect('/admin/login.html');
    });
});

// Serve the main admin panel, protected by auth
app.get('/admin', isAdminAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});


// --- ADMIN API (PROTECTED) ---
app.get('/admin/api/config', isAdminAuthenticated, async (req, res) => {
    const config = await getConfig();
    res.json(config);
});

app.post('/admin/api/config', isAdminAuthenticated, async (req, res) => {
    const { config } = req.body;
    await saveConfig(config);
    res.status(200).json({ message: 'Configuration saved successfully.' });
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
    await initializeDb();
    app.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`);
        console.log(`Admin panel should be available at http://localhost:${PORT}/admin`);
    });
};

startServer();
