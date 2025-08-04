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

// --- INITIALIZATION ---
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Gemini AI
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai;
if (geminiApiKey) {
    ai = new GoogleGenAI({ apiKey: geminiApiKey });
} else {
    console.warn("GEMINI_API_KEY not found in environment. Translation will be disabled.");
}

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());


// --- API ROUTES ---

// Health check
app.get('/', (req, res) => {
    res.send('Ukhyliant Clicker Backend is running!');
});

// Get User
app.get('/api/user/:id', async (req, res) => {
    const user = await getUser(req.params.id);
    if (user) {
        res.json(user);
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// Update User Language
app.post('/api/user/:id/language', async (req, res) => {
    await updateUserLanguage(req.params.id, req.body.language);
    res.status(200).send();
});

// Get Player State
app.get('/api/player/:id', async (req, res) => {
    const { id } = req.params;
    const { isNew, ref } = req.query;

    if (isNew === 'true') {
        await createUser(id, 'New Player', 'en'); // Create user entry
        if (ref && ref !== 'null' && ref !== 'undefined') {
            await applyReferralBonus(ref);
        }
    }

    let player = await getPlayer(id);
    if (!player) {
        // Create initial state if doesn't exist
        const now = Date.now();
        player = {
            balance: 500, energy: 1000, profitPerHour: 0, coinsPerTap: 1, lastLoginTimestamp: now,
            upgrades: {}, stars: 100, referrals: 0, completedDailyTaskIds: [],
            purchasedSpecialTaskIds: [], completedSpecialTaskIds: [],
            dailyTaps: 0, lastDailyReset: now
        };
        await savePlayer(id, player);
    }
    res.json(player);
});

// Save Player State
app.post('/api/player/:id', async (req, res) => {
    await savePlayer(req.params.id, req.body);
    res.status(200).send();
});

// Get Game Config
app.get('/api/config', async (req, res) => {
    const config = await getConfig();
    res.json(config);
});

// Save Game Config
app.post('/api/config', async (req, res) => {
    // Note: Add admin role check here in a real scenario
    await saveConfig(req.body);
    res.status(200).send();
});

// AI Translation
app.post('/api/translate', async (req, res) => {
    if (!ai) {
        return res.status(503).json({ error: "Translation service is not configured." });
    }
    const { text, from, to } = req.body;
    const fromLang = from === 'ua' ? 'Ukrainian' : 'English';
    const toLang = to === 'ua' ? 'Ukrainian' : 'English';
    const prompt = `Translate the following text from ${fromLang} to ${toLang}. Return ONLY the translated text, without any additional comments, formatting or quotation marks:\n\n"${text}"`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        res.json({ translatedText: response.text.trim() });
    } catch (error) {
        console.error("Translation API error:", error);
        res.status(500).json({ error: "Failed to translate text" });
    }
});


// --- SERVER START ---
const startServer = async () => {
    await initializeDb();
    app.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`);
    });
};

startServer();
