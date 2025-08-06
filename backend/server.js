

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { GoogleGenAI } from '@google/genai';
import connectPgSimple from 'connect-pg-simple';
import geoip from 'geoip-lite';
import { 
    pool,
    initializeDb, 
    getGameConfig, 
    saveConfig, 
    getPlayer, 
    savePlayer, 
    getUser, 
    createUser, 
    applyReferralBonus, 
    updateUserLanguage,
    updateUserAccessInfo,
    unlockSpecialTask,
    completeAndRewardSpecialTask,
    getAllPlayersForAdmin,
    deletePlayer,
    getDailyEvent,
    saveDailyEvent,
    getDashboardStats,
    getOnlinePlayerCount,
    getPlayerLocations,
    claimComboReward,
    claimCipherReward,
    resetPlayerDailyProgress,
    claimDailyTaskReward,
    getLeaderboardData,
    getTotalPlayerCount,
    getPlayerDetails,
    updatePlayerBalance,
    getReferredUsersProfit
} from './db.js';
import { 
    ADMIN_TELEGRAM_ID, MODERATOR_TELEGRAM_IDS, INITIAL_MAX_ENERGY, ENERGY_REGEN_RATE, LEAGUES, INITIAL_BOOSTS,
    REFERRAL_PROFIT_SHARE, LOOTBOX_COST_COINS, LOOTBOX_COST_STARS, DEFAULT_COIN_SKIN_ID, INITIAL_UPGRADES, INITIAL_BLACK_MARKET_CARDS, INITIAL_COIN_SKINS
} from './constants.js';

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
const TELEGRAM_PROVIDER_TOKEN = process.env.TELEGRAM_PROVIDER_TOKEN;

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

// Set up session middleware with persistent storage
const PgStore = connectPgSimple(session);
const sessionStore = new PgStore({
    pool: pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
});

const sessionMiddleware = session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'default_secret_for_dev',
    resave: false,
    saveUninitialized: false, // Don't create session until something stored
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
});

app.use(sessionMiddleware);
app.set('trust proxy', 1); // Crucial for Render proxy

// Serve static files for the admin panel and game assets
app.use('/admin', express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));


// --- AUTH MIDDLEWARE FOR ADMIN PANEL ---
const isAdminAuthenticated = (req, res, next) => {
    log('info', `Admin auth check for: ${req.originalUrl}`, { sessionId: req.sessionID, isAdmin: req.session.isAdmin });
    if (req.session.isAdmin) {
        return next();
    }
    
    log('warn', `Unauthorized attempt to access admin area from IP: ${req.ip}`);
    
    // For API requests, send a 401 Unauthorized status. This allows the client-side JS to handle it.
    if (req.originalUrl.startsWith('/admin/api')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    // For page requests, redirect to the login page.
    return res.redirect('/admin/login.html');
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
        
        const forwardedIps = req.headers['x-forwarded-for'];
        const clientIp = forwardedIps ? forwardedIps.split(',')[0].trim() : req.ip;

        log('info', `Attempting GeoIP lookup for user ${userId}. Header 'x-forwarded-for': '${forwardedIps}', req.ip: '${req.ip}'. Using IP: '${clientIp}'`);

        const geo = geoip.lookup(clientIp);
        let countryCode = geo ? geo.country : null;

        log('info', `GeoIP lookup for IP '${clientIp}' for user ${userId} resolved to country: ${countryCode}`);

        if (!countryCode) {
            const lang = tgUser.language_code?.toLowerCase();
            log('info', `GeoIP failed or returned null for IP '${clientIp}'. Falling back to language code '${lang}' for user ${userId}.`);
            if (lang === 'ua' || lang === 'uk') {
                countryCode = 'UA';
            } else if (lang === 'ru') {
                countryCode = 'RU';
            }
        }
        
        const baseConfig = await getGameConfig();
        let dailyEvent = await getDailyEvent(getTodayDate());
        let user = await getUser(userId);
        let player = await getPlayer(userId);

        const now = Date.now();
        const today = new Date(now).setHours(0, 0, 0, 0);

        if (!user) { // New user
            log('info', `New user detected: ${userId}. Creating profile.`);
            const referrerId = (startParam && startParam !== userId) ? startParam : null;
            let userLang = 'en';
            if (tgUser.language_code === 'ua' || tgUser.language_code === 'uk') userLang = 'ua';
            if (tgUser.language_code === 'ru') userLang = 'ru';

            user = await createUser(userId, tgUser.first_name, userLang, referrerId);
            log('info', `User profile created for ${userId}. Language: ${userLang}`);
            
            player = {
                balance: 500, energy: INITIAL_MAX_ENERGY, profitPerHour: 0, tasksProfitPerHour: 0, referralProfitPerHour: 0, coinsPerTap: 1, lastLoginTimestamp: now,
                upgrades: {}, referrals: 0, completedDailyTaskIds: [],
                purchasedSpecialTaskIds: [], completedSpecialTaskIds: [],
                dailyTaps: 0, lastDailyReset: today,
                claimedComboToday: false, claimedCipherToday: false,
                dailyUpgrades: [],
                tapGuruLevel: 0,
                energyLimitLevel: 0,
                unlockedSkins: [DEFAULT_COIN_SKIN_ID],
                currentSkinId: DEFAULT_COIN_SKIN_ID,
            };
            await savePlayer(userId, player);
            log('info', `Initial player state created for ${userId}.`);
            
            if (referrerId) {
                log('info', `Applying referral bonus. Referrer: ${referrerId}, New User: ${userId}`);
                await applyReferralBonus(referrerId);
            }
        } else { // Existing user
            log('info', `Existing user login: ${userId}. Calculating offline progress.`);

            // Gracefully handle data structure updates for existing players
            if (player.unlockedSkins === undefined) player.unlockedSkins = [DEFAULT_COIN_SKIN_ID];
            if (player.currentSkinId === undefined) player.currentSkinId = DEFAULT_COIN_SKIN_ID;
            if (player.referralProfitPerHour === undefined) player.referralProfitPerHour = 0;
            if (player.tapGuruLevel === undefined) player.tapGuruLevel = 0;
            if (player.energyLimitLevel === undefined) player.energyLimitLevel = 0;


            // Recalculate profitPerHour with referral and skin bonuses before calculating offline earnings
            const [referralProfit, skinProfitBoost] = await Promise.all([
                 getReferredUsersProfit(userId).then(p => p * REFERRAL_PROFIT_SHARE),
                 Promise.resolve().then(() => {
                    const currentSkin = baseConfig.coinSkins.find(s => s.id === player.currentSkinId);
                    return currentSkin ? currentSkin.profitBoostPercent : 0;
                 })
            ]);
            
            const baseProfitFromUpgrades = Object.entries(player.upgrades).reduce((total, [upgradeId, level]) => {
                 const allUpgrades = [...(baseConfig.upgrades || []), ...(baseConfig.blackMarketCards || [])];
                 const upgradeTemplate = allUpgrades.find(u => u.id === upgradeId);
                 if (level > 0 && upgradeTemplate) {
                     const profitForThisUpgrade = upgradeTemplate.profitPerHour * Math.pow(1.07, level - 1); // Corrected to level - 1 for proper compounding
                     return total + profitForThisUpgrade;
                }
                return total;
            }, 0);

            const baseTotalProfit = baseProfitFromUpgrades + (player.tasksProfitPerHour || 0);
            const finalProfitWithSkinBoost = baseTotalProfit * (1 + skinProfitBoost / 100);
            
            player.referralProfitPerHour = referralProfit;
            player.profitPerHour = finalProfitWithSkinBoost + referralProfit;

            const offlineSeconds = Math.floor((now - player.lastLoginTimestamp) / 1000);
            const offlineEarnings = (player.profitPerHour / 3600) * offlineSeconds;
            
            player.balance += offlineEarnings;
            const effectiveMaxEnergy = INITIAL_MAX_ENERGY + (player.energyLimitLevel || 0) * 500;
            player.energy = Math.min(effectiveMaxEnergy, player.energy + (ENERGY_REGEN_RATE * offlineSeconds));
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
        
        await updateUserAccessInfo(userId, { country: countryCode });

        let role = 'user';
        if (userId === ADMIN_TELEGRAM_ID) role = 'admin';
        else if (MODERATOR_TELEGRAM_IDS.includes(userId)) role = 'moderator';
        
        const userWithRole = { ...user, role, referrerId: user.referrer_id };
        
        let clientDailyEvent = null;
        if (dailyEvent) {
            clientDailyEvent = {
                comboIds: parseComboIds(dailyEvent),
                cipherWord: dailyEvent.cipher_word || ''
            };
        }

        const finalConfig = { ...baseConfig, dailyEvent: clientDailyEvent };

        finalConfig.upgrades = finalConfig.upgrades || [];
        finalConfig.tasks = finalConfig.tasks || [];
        finalConfig.boosts = finalConfig.boosts || [];
        finalConfig.specialTasks = finalConfig.specialTasks || [];
        finalConfig.blackMarketCards = finalConfig.blackMarketCards || [];
        finalConfig.coinSkins = finalConfig.coinSkins || [];

        log('info', `Login successful for ${userId}. Sending sanitized config.`);
        res.json({ user: userWithRole, player, config: finalConfig });

    } catch (error) {
        log('error', "Login error:", error);
        res.status(500).json({ error: "Internal server error during login." });
    }
});


app.post('/api/player/:id', async (req, res) => {
    const userId = req.params.id;
    const clientState = req.body;
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
                id: p.id,
                name: p.name,
                profitPerHour: p.profitPerHour,
                leagueName: league.name,
                leagueIconUrl: league.iconUrl
            };
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
        const config = await getGameConfig();
        if (!player || !config) {
            return res.status(404).json({ error: 'Player or game config not found.' });
        }
        
        let allUpgrades = [...(config.upgrades || []), ...(config.blackMarketCards || [])];
        const upgradeTemplate = allUpgrades.find(u => u.id === upgradeId);

        if (!upgradeTemplate) {
            return res.status(404).json({ error: 'Upgrade not found.' });
        }
        const currentLevel = player.upgrades[upgradeId] || 0;
        const price = upgradeTemplate.price || upgradeTemplate.profitPerHour * 10;
        const currentPrice = Math.floor(price * Math.pow(1.15, currentLevel));
        if (player.balance < currentPrice) {
            return res.status(400).json({ error: 'Insufficient funds.' });
        }
        
        player.balance -= currentPrice;
        player.upgrades[upgradeId] = currentLevel + 1;
        if (!player.dailyUpgrades) player.dailyUpgrades = [];
        if (!player.dailyUpgrades.includes(upgradeId)) player.dailyUpgrades.push(upgradeId);

        // Recalculate total profit
        const baseProfitFromUpgrades = [...config.upgrades, ...config.blackMarketCards].reduce((total, u) => {
            const level = player.upgrades[u.id] || 0;
            if (level > 0) {
                 const profitForThisUpgrade = u.profitPerHour * Math.pow(1.07, level-1);
                 return total + profitForThisUpgrade;
            }
            return total;
        }, 0);
        
        const baseTotalProfit = baseProfitFromUpgrades + (player.tasksProfitPerHour || 0);
        const skin = config.coinSkins.find(s => s.id === player.currentSkinId);
        const skinBoost = skin ? skin.profitBoostPercent / 100 : 0;
        
        player.profitPerHour = (baseTotalProfit * (1 + skinBoost)) + (player.referralProfitPerHour || 0);

        await savePlayer(userId, player);
        log('info', `Upgrade ${upgradeId} purchased successfully for user ${userId}. New level: ${currentLevel + 1}`);
        res.json(player);

    } catch (error) {
        log('error', `Buy upgrade error for User ${userId}, Upgrade ${upgradeId}:`, error);
        res.status(500).json({ error: "Internal server error during purchase." });
    }
});

app.post('/api/action/buy-boost', async (req, res) => {
    const { userId, boostId } = req.body;
    log('info', `Buy boost attempt: User ${userId}, Boost ${boostId}`);
    try {
        if (!userId || !boostId) {
            return res.status(400).json({ error: 'User ID and Boost ID are required.' });
        }
        const player = await getPlayer(userId);
        const config = await getGameConfig();
        if (!player || !config) {
            return res.status(404).json({ error: 'Player or game config not found.' });
        }
        const boostTemplate = config.boosts.find(b => b.id === boostId);
        if (!boostTemplate) {
            return res.status(404).json({ error: 'Boost not found.' });
        }

        let cost = boostTemplate.costCoins;
        const effectiveMaxEnergy = INITIAL_MAX_ENERGY + (player.energyLimitLevel || 0) * 500;

        switch(boostId) {
            case 'boost_full_energy':
                if (player.balance < cost) return res.status(400).json({ error: 'Insufficient funds.' });
                player.balance -= cost;
                player.energy = effectiveMaxEnergy;
                break;
            case 'boost_turbo_mode':
                if (player.balance < cost) return res.status(400).json({ error: 'Insufficient funds.' });
                player.balance -= cost;
                break;
            case 'boost_tap_guru':
                const currentTapLevel = player.tapGuruLevel || 0;
                cost = Math.floor(boostTemplate.costCoins * Math.pow(1.5, currentTapLevel));
                if (player.balance < cost) return res.status(400).json({ error: 'Insufficient funds.' });
                player.balance -= cost;
                player.tapGuruLevel = currentTapLevel + 1;
                break;
            case 'boost_energy_limit':
                const currentEnergyLevel = player.energyLimitLevel || 0;
                cost = Math.floor(boostTemplate.costCoins * Math.pow(1.8, currentEnergyLevel));
                if (player.balance < cost) return res.status(400).json({ error: 'Insufficient funds.' });
                player.balance -= cost;
                player.energyLimitLevel = currentEnergyLevel + 1;
                break;
            default:
                return res.status(400).json({ error: 'Unknown boost ID.' });
        }
        
        await savePlayer(userId, player);
        log('info', `Boost ${boostId} purchased successfully for user ${userId}.`);
        res.json(player);

    } catch (error) {
        log('error', `Buy boost error for User ${userId}, Boost ${boostId}:`, error);
        res.status(500).json({ error: "Internal server error during boost purchase." });
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
     // Not implemented for this example
});
app.post('/api/action/unlock-free-task', async (req, res) => {
    const { userId, taskId } = req.body;
    log('info', `Unlocking free special task ${taskId} for user ${userId}`);
    try {
         const updatedPlayerState = await unlockSpecialTask(userId, taskId);
         res.json(updatedPlayerState);
    } catch (error) {
        log('error', `Failed to unlock free task ${taskId} for user ${userId}`, error);
        res.status(500).json({ error: 'Internal server error.' });
    }
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
     const { userId } = req.body;
    try {
        const result = await claimComboReward(userId);
        res.json(result);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});
app.post('/api/action/claim-cipher', async (req, res) => {
    const { userId, cipher } = req.body;
    try {
        const result = await claimCipherReward(userId, cipher);
        res.json(result);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

const grantLootboxReward = async (userId, boxType, config, player) => {
    const rewardPool = [
        ...(config.blackMarketCards || []).filter(c => c.boxType === boxType).map(c => ({ ...c, itemType: 'card' })),
        ...(config.coinSkins || []).filter(s => s.boxType === boxType && !player.unlockedSkins.includes(s.id)).map(s => ({ ...s, itemType: 'skin' })),
        { id: 'coins_small', name: {en: 'Small Coin Pouch', ru: 'Малый мешок монет', ua: 'Малий мішок монет'}, itemType: 'coins', amount: LOOTBOX_COST_COINS * 0.5, chance: 40, iconUrl: 'https://api.iconify.design/twemoji/pouch.svg' },
        { id: 'coins_medium', name: {en: 'Medium Coin Pouch', ru: 'Средний мешок монет', ua: 'Середній мішок монет'}, itemType: 'coins', amount: LOOTBOX_COST_COINS * 1.2, chance: 20, iconUrl: 'https://api.iconify.design/twemoji/pouch.svg' },
        { id: 'coins_large', name: {en: 'Large Coin Pouch', ru: 'Большой мешок монет', ua: 'Великий мішок монет'}, itemType: 'coins', amount: LOOTBOX_COST_COINS * 2, chance: 5, iconUrl: 'https://api.iconify.design/twemoji/pouch.svg' },
    ];
    
    const totalChance = rewardPool.reduce((sum, item) => sum + (item.chance || 1), 0);
    let random = Math.random() * totalChance;
    
    let wonItem = null;
    for (const item of rewardPool) {
        random -= (item.chance || 1);
        if (random <= 0) {
            wonItem = item;
            break;
        }
    }
    
    if (!wonItem) wonItem = rewardPool.find(i => i.id === 'coins_small');

    switch(wonItem.itemType) {
        case 'card':
            player.upgrades[wonItem.id] = (player.upgrades[wonItem.id] || 0) + 1;
            break;
        case 'skin':
            player.unlockedSkins.push(wonItem.id);
            break;
        case 'coins':
            player.balance += wonItem.amount;
            break;
    }

    if(wonItem.itemType === 'card' || wonItem.itemType === 'skin') {
        const baseProfitFromUpgrades = [...config.upgrades, ...config.blackMarketCards].reduce((total, u) => {
            const level = player.upgrades[u.id] || 0;
            if (level > 0) return total + (u.profitPerHour * Math.pow(1.07, level-1));
            return total;
        }, 0);
        const baseTotalProfit = baseProfitFromUpgrades + (player.tasksProfitPerHour || 0);
        const skin = config.coinSkins.find(s => s.id === player.currentSkinId);
        const skinBoost = skin ? skin.profitBoostPercent / 100 : 0;
        player.profitPerHour = (baseTotalProfit * (1 + skinBoost)) + (player.referralProfitPerHour || 0);
    }

    return { player, wonItem };
};

app.post('/api/action/open-lootbox', async (req, res) => {
    const { userId, boxType } = req.body;
    log('info', `Coin Lootbox open attempt: User ${userId}`);
    try {
        if (boxType !== 'coin') return res.status(400).json({ error: 'This endpoint is for coin purchases only.' });

        const player = await getPlayer(userId);
        const config = await getGameConfig();
        if (!player || !config) return res.status(404).json({ error: 'Player or config not found' });
        
        if (player.balance < LOOTBOX_COST_COINS) return res.status(400).json({ error: 'Insufficient coins' });
        player.balance -= LOOTBOX_COST_COINS;

        const { player: updatedPlayer, wonItem } = await grantLootboxReward(userId, boxType, config, player);

        await savePlayer(userId, updatedPlayer);
        log('info', `User ${userId} opened COIN lootbox and won: ${wonItem.id}`);
        res.json({ player: updatedPlayer, wonItem });
    } catch (error) {
        log('error', `Lootbox error for User ${userId}, Type ${boxType}:`, error);
        res.status(500).json({ error: "Internal server error during lootbox opening." });
    }
});

app.post('/api/action/set-skin', async (req, res) => {
    const { userId, skinId } = req.body;
    log('info', `Set skin attempt: User ${userId}, Skin ${skinId}`);
    try {
        const player = await getPlayer(userId);
        const config = await getGameConfig();
        if (!player || !config) return res.status(404).json({ error: 'Player or config not found' });
        
        if (!player.unlockedSkins.includes(skinId)) {
            return res.status(403).json({ error: 'Skin not unlocked' });
        }
        
        player.currentSkinId = skinId;
        
        // Recalculate profit with new skin boost
        const baseProfitFromUpgrades = [...config.upgrades, ...config.blackMarketCards].reduce((total, u) => {
            const level = player.upgrades[u.id] || 0;
            if (level > 0) {
                 const profitForThisUpgrade = u.profitPerHour * Math.pow(1.07, level-1);
                 return total + profitForThisUpgrade;
            }
            return total;
        }, 0);
        
        const baseTotalProfit = baseProfitFromUpgrades + (player.tasksProfitPerHour || 0);
        const skin = config.coinSkins.find(s => s.id === player.currentSkinId);
        const skinBoost = skin ? skin.profitBoostPercent / 100 : 0;
        
        player.profitPerHour = (baseTotalProfit * (1 + skinBoost)) + (player.referralProfitPerHour || 0);

        await savePlayer(userId, player);
        log('info', `User ${userId} set skin to ${skinId}`);
        res.json(player);

    } catch (error) {
        log('error', `Set skin error for User ${userId}, Skin ${skinId}:`, error);
        res.status(500).json({ error: "Internal server error during skin selection." });
    }
});

// --- TELEGRAM PAYMENTS ---
app.post('/api/create-star-invoice', async (req, res) => {
    const { userId, boxType } = req.body;
    if (!BOT_TOKEN || !TELEGRAM_PROVIDER_TOKEN) {
        log('error', 'Missing BOT_TOKEN or TELEGRAM_PROVIDER_TOKEN for star payment.');
        return res.status(500).json({ error: 'Payment system is not configured.' });
    }
    
    const payload = JSON.stringify({ userId, boxType, ts: Date.now() });
    
    try {
        const tgResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Star Container',
                description: 'A container with exclusive rewards!',
                payload: payload,
                provider_token: TELEGRAM_PROVIDER_TOKEN,
                currency: 'XTR',
                prices: [{ label: 'Star Container', amount: LOOTBOX_COST_STARS }]
            })
        });
        const tgData = await tgResponse.json();
        if (!tgData.ok) {
            log('error', 'Telegram API error creating invoice link:', tgData);
            return res.status(500).json({ error: 'Failed to create payment invoice.' });
        }
        res.json({ invoiceLink: tgData.result });
    } catch (e) {
        log('error', 'Network error creating invoice link', e);
        res.status(500).json({ error: 'Server could not contact Telegram.' });
    }
});

app.post('/api/telegram-webhook', async (req, res) => {
    const update = req.body;

    if (update.pre_checkout_query) {
        log('info', 'Received pre_checkout_query', update.pre_checkout_query.id);
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true })
        });
        return res.sendStatus(200);
    }

    if (update.message && update.message.successful_payment) {
        log('info', 'Received successful_payment', update.message.successful_payment.invoice_payload);
        try {
            const payload = JSON.parse(update.message.successful_payment.invoice_payload);
            const { userId, boxType } = payload;
            
            const player = await getPlayer(userId);
            const config = await getGameConfig();
            if (!player || !config) throw new Error(`Player ${userId} or config not found for webhook payment.`);
            
            const { player: updatedPlayer, wonItem } = await grantLootboxReward(userId, boxType, config, player);
            
            await savePlayer(userId, updatedPlayer);
            log('info', `User ${userId} STAR lootbox reward granted: ${wonItem.id}`);
        } catch(e) {
            log('error', 'Failed to process successful_payment webhook', e);
        }
        return res.sendStatus(200);
    }

    res.sendStatus(200);
});


// --- ADMIN WEB PANEL ROUTES ---
app.get('/admin/', isAdminAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.post('/admin/login', async (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        log('info', `Admin login successful from IP: ${req.ip}`);
        log('info', 'Session data after login:', req.session);
        res.redirect('/admin/');
    } else {
        log('warn', `Failed admin login attempt from IP: ${req.ip}`);
        res.status(401).send('Authentication failed. <a href="/admin/login.html">Try again</a>');
    }
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            log('error', 'Failed to destroy session during logout', err);
            return res.status(500).send('Could not log out.');
        }
        res.redirect('/admin/login.html');
    });
});


// --- ADMIN API (PROTECTED) ---
const adminApiRouter = express.Router();
adminApiRouter.use(isAdminAuthenticated); // Protect all routes in this router

adminApiRouter.get('/dashboard-stats', async (req, res) => {
    log('info', 'Admin request: /api/dashboard-stats');
    try {
        const [stats, onlineNow] = await Promise.all([
            getDashboardStats(),
            getOnlinePlayerCount()
        ]);
        const fullStats = { ...stats, onlineNow };
        log('info', 'Raw dashboard stats from DB:', fullStats);
        res.json(fullStats);
    } catch(e) {
        log('error', 'Failed to get dashboard stats', e);
        res.status(500).json({ error: 'Server error' });
    }
});

adminApiRouter.get('/player-locations', async (req, res) => {
    log('info', 'Admin request: /api/player-locations');
    try {
        const locations = await getPlayerLocations();
        res.json(locations);
    } catch(e) {
        log('error', 'Failed to get player locations', e);
        res.status(500).json({ error: 'Server error'});
    }
});

adminApiRouter.get('/daily-events', async (req, res) => {
    log('info', 'Admin request: /api/daily-events');
    try {
        const event = await getDailyEvent(getTodayDate());
        log('info', 'Raw daily event data from DB:', event);
        res.json(event);
    } catch(e) {
        log('error', 'Failed to get daily events', e);
        res.status(500).json({ error: 'Server error' });
    }
});
adminApiRouter.post('/daily-events', async (req, res) => {
    const { comboIds, cipherWord, comboReward, cipherReward } = req.body;
    try {
        await saveDailyEvent(getTodayDate(), comboIds, cipherWord, comboReward, cipherReward);
        res.json({ message: 'События дня сохранены!' });
    } catch(e) {
        log('error', 'Failed to save daily events', e);
        res.status(500).json({ error: 'Server error' });
    }
});
adminApiRouter.get('/players', async (req, res) => {
    log('info', 'Admin request: /api/players');
    try {
        const [players, config] = await Promise.all([
            getAllPlayersForAdmin(),
            getGameConfig()
        ]);
        
        const augmentedPlayers = players.map(player => {
            const playerConfigData = config.specialTasks || [];
            
            const starsSpent = (player.purchasedSpecialTaskIds || []).reduce((total, taskId) => {
                const task = playerConfigData.find(t => t.id === taskId);
                return total + (task?.priceStars || 0);
            }, 0);
            
            return {
                ...player,
                starsSpent: starsSpent
            };
        });

        log('info', `Raw players data from DB. Count: ${augmentedPlayers.length}`);
        res.json(augmentedPlayers);
    } catch(e) {
        log('error', 'Failed to get players list', e);
        res.status(500).json({ error: 'Server error' });
    }
});
adminApiRouter.delete('/player/:id', async (req, res) => {
    const userId = req.params.id;
    log('info', `Attempting to delete player ${userId} from admin panel.`);
    try {
        await deletePlayer(userId);
        res.json({ message: `Player ${userId} deleted.` });
    } catch (e) {
        log('error', `Failed to delete player ${userId} from admin panel.`, e);
        res.status(500).json({ error: 'Server error' });
    }
});

adminApiRouter.get('/player/:id/details', async (req, res) => {
    const { id } = req.params;
    log('info', `Admin requesting details for player ${id}`);
    try {
        const details = await getPlayerDetails(id);
        if (details) {
            res.json(details);
        } else {
            res.status(404).json({ error: 'Player not found' });
        }
    } catch (e) {
        log('error', `Failed to get details for player ${id}`, e);
        res.status(500).json({ error: 'Server error' });
    }
});

adminApiRouter.post('/player/:id/update-balance', async (req, res) => {
    const { id } = req.params;
    const { amount } = req.body;
    log('info', `Admin updating balance for player ${id} by ${amount}`);
    try {
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount)) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        const updatedPlayer = await updatePlayerBalance(id, numericAmount);
        res.json(updatedPlayer);
    } catch (e) {
        log('error', `Failed to update balance for player ${id}`, e);
        res.status(500).json({ error: 'Server error' });
    }
});

adminApiRouter.post('/player/:id/reset-daily', async (req, res) => {
    const userId = req.params.id;
    log('info', `Attempting to reset daily progress for ${userId}`);
    try {
        await resetPlayerDailyProgress(userId);
        res.json({ message: 'Daily progress reset successfully.' });
    } catch (e) {
        log('error', `Failed to reset daily progress for ${userId}`, e);
        res.status(500).json({ error: 'Server error' });
    }
});

adminApiRouter.get('/config', async (req, res) => {
    log('info', 'Admin request: /api/config');
    try {
        const dbConfig = await getGameConfig();
        if (!dbConfig) {
             return res.status(404).json({ error: 'Config not found' });
        }

        // --- Reconcile all lists that have hardcoded templates ---
        const reconcile = (templates, savedItems) => {
            return templates.map(template => {
                const saved = (savedItems || []).find(s => s.id === template.id);
                return saved ? { ...template, ...saved } : template;
            });
        };

        const cleanConfig = { ...dbConfig };
        cleanConfig.boosts = reconcile(INITIAL_BOOSTS, dbConfig.boosts);
        cleanConfig.blackMarketCards = reconcile(INITIAL_BLACK_MARKET_CARDS, dbConfig.blackMarketCards);
        cleanConfig.coinSkins = reconcile(INITIAL_COIN_SKINS, dbConfig.coinSkins);

        log('info', 'Cleaned config data sent to admin.');
        res.json(cleanConfig);
    } catch(e) {
        log('error', 'Failed to get config', e);
        res.status(500).json({ error: 'Server error' });
    }
});

adminApiRouter.post('/config', async (req, res) => {
    const { config: clientConfig } = req.body;
    try {
        const reconcile = (templates, clientItems) => {
            return templates.map(template => {
                const clientItem = (clientItems || []).find(b => b.id === template.id);
                return clientItem ? { ...template, ...clientItem } : template;
            });
        };
        
        const finalConfig = { ...clientConfig };
        finalConfig.boosts = reconcile(INITIAL_BOOSTS, clientConfig.boosts);
        finalConfig.blackMarketCards = reconcile(INITIAL_BLACK_MARKET_CARDS, clientConfig.blackMarketCards);
        finalConfig.coinSkins = reconcile(INITIAL_COIN_SKINS, clientConfig.coinSkins);

        await saveConfig(finalConfig);
        res.json({ message: 'Config saved' });
    } catch(e) {
        log('error', 'Failed to save config', e);
        res.status(500).json({ error: 'Server error' });
    }
});
adminApiRouter.post('/translate', async (req, res) => {
    if (!ai) return res.status(503).json({ error: "Translation service is not configured." });
    const { text, from, to } = req.body;
    try {
        const prompt = `Translate the following text from ${from} to ${to}: "${text}"`;
        const result = await ai.models.generateContent({model: 'gemini-2.5-flash', contents: prompt});
        const translatedText = result.text;
        res.json({ translatedText });
    } catch (e) {
        log('error', 'Translation API call failed', e);
        res.status(500).json({ error: 'Failed to translate text.' });
    }
});

app.use('/admin/api', adminApiRouter);


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