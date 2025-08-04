
import express from 'express';
import cors from 'cors';
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
    updateUserLanguage
} from './db.js';
import { ADMIN_TELEGRAM_ID, MODERATOR_TELEGRAM_IDS, MAX_ENERGY, ENERGY_REGEN_RATE } from './constants.js';

const app = express();
const PORT = process.env.PORT || 3001;

const geminiApiKey = process.env.GEMINI_API_KEY;
let ai;
if (geminiApiKey) {
    ai = new GoogleGenAI({ apiKey: geminiApiKey });
} else {
    console.warn("GEMINI_API_KEY not found. Translation will be disabled.");
}

app.use(cors());
app.use(express.json());

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

app.post('/api/config', async (req, res) => {
    const { userId, config } = req.body;
    const userRole = (userId === ADMIN_TELEGRAM_ID) ? 'admin' : (MODERATOR_TELEGRAM_IDS.includes(userId) ? 'moderator' : 'user');
    
    if (userRole === 'admin' || userRole === 'moderator') {
        await saveConfig(config);
        res.status(200).send();
    } else {
        res.status(403).json({ error: 'Permission denied.' });
    }
});

app.post('/api/translate', async (req, res) => {
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


const startServer = async () => {
    await initializeDb();
    app.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`);
    });
};

startServer();
