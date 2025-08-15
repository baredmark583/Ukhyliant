

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { GoogleGenAI, Type } from '@google/genai';
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
    claimGlitchCodeInDb,
    resetPlayerDailyProgress,
    claimDailyTaskReward,
    getLeaderboardData,
    getTotalPlayerCount,
    getPlayerDetails,
    updatePlayerBalance,
    getCheaters,
    resetPlayerProgress,
    createCellInDb,
    joinCellInDb,
    getCellFromDb,
    leaveCellFromDb,
    recruitInformantInDb,
    openLootboxInDb,
    recalculateReferralProfit,
    buyUpgradeInDb,
    buyBoostInDb,
    processSuccessfulPayment,
    buyTicketInDb,
    checkAndManageBattles,
    getBattleStatusForCell,
    joinActiveBattle,
    addTapsToBattle,
    getBattleLeaderboard,
    forceStartBattle,
    forceEndBattle,
    getCellAnalytics,
    getAllUserIds
} from './db.js';
import { 
    ADMIN_TELEGRAM_ID, MODERATOR_TELEGRAM_IDS, INITIAL_MAX_ENERGY,
    LOOTBOX_COST_STARS, DEFAULT_COIN_SKIN_ID,
    CHEAT_DETECTION_THRESHOLD_TPS, CHEAT_DETECTION_STRIKES_TO_FLAG
} from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
if (!ai) {
    console.warn("GEMINI_API_KEY for Gemini is not set. AI features will be disabled.");
}

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
const port = process.env.PORT || 3000;

app.use(cors({ origin: '*', credentials: true }));
// Use express.json() for all routes EXCEPT the webhook
app.use((req, res, next) => {
    if (req.path === '/api/telegram-webhook') {
        next();
    } else {
        express.json()(req, res, next);
    }
});
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session middleware
const PgStore = connectPgSimple(session);
app.use(session({
    store: new PgStore({
        pool: pool,
        tableName : 'user_sessions',
        createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));

// --- Social Stats Cache ---
const socialStatsCache = {
    youtubeSubscribers: 0,
    youtubeViews: 0,
    telegramSubscribers: 0,
    lastUpdated: 0
};

// --- Helper Functions ---
const fetchWithTimeout = (url, options = {}, timeout = 5000) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), timeout))
    ]);
};

const answerPreCheckoutQuery = async (queryId, ok, errorMessage = '') => {
    const { BOT_TOKEN } = process.env;
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            pre_checkout_query_id: queryId,
            ok,
            ...(errorMessage && { error_message: errorMessage })
        })
    });
};


const fetchYoutubeStats = async (channelId, apiKey) => {
    if (!channelId || !apiKey) return { subscribers: 0, views: 0 };
    try {
        const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`;
        const response = await fetchWithTimeout(url);
        if (!response.ok) {
            log('error', `YouTube API error: ${response.statusText}`);
            return { subscribers: 0, views: 0 };
        }
        const data = await response.json();
        const stats = data?.items?.[0]?.statistics;
        return {
            subscribers: parseInt(stats?.subscriberCount || 0),
            views: parseInt(stats?.viewCount || 0)
        };
    } catch (error) {
        log('error', 'Failed to fetch YouTube stats', error);
        return { subscribers: 0, views: 0 };
    }
};

const fetchTelegramStats = async (channelUsername, botToken) => {
    if (!channelUsername || !botToken) return 0;
    // Ensure channel username starts with @
    const formattedUsername = channelUsername.startsWith('@') ? channelUsername : `@${channelUsername.split('/').pop()}`;
    try {
        const url = `https://api.telegram.org/bot${botToken}/getChatMembersCount?chat_id=${formattedUsername}`;
        const response = await fetchWithTimeout(url);
        if (!response.ok) {
            log('error', `Telegram API error: ${response.statusText}`);
            return 0;
        }
        const data = await response.json();
        return data.result || 0;
    } catch (error) {
        log('error', 'Failed to fetch Telegram stats', error);
        return 0;
    }
};


const updateSocialStatsCache = async () => {
    log('info', 'Updating social stats cache...');
    const config = await getGameConfig();
    if (!config || !config.socials) {
        log('warn', 'Socials not configured, skipping cache update.');
        return;
    }

    const { youtubeChannelId, telegramChannelId } = config.socials;
    const { YOUTUBE_API_KEY, BOT_TOKEN } = process.env;

    const youtubeData = await fetchYoutubeStats(youtubeChannelId, YOUTUBE_API_KEY);
    const telegramSubs = await fetchTelegramStats(telegramChannelId, BOT_TOKEN);

    socialStatsCache.youtubeSubscribers = youtubeData.subscribers;
    socialStatsCache.youtubeViews = youtubeData.views;
    socialStatsCache.telegramSubscribers = telegramSubs;
    socialStatsCache.lastUpdated = Date.now();
    log('info', 'Social stats cache updated.', socialStatsCache);
};

// --- AUTH MIDDLEWARE ---
const checkAdminAuth = (req, res, next) => {
    if (req.session.isAdmin) {
        next();
    } else {
        res.status(401).redirect('/admin/login.html');
    }
};

// Protected routes for the admin panel must come BEFORE the static middleware
app.get('/admin/', checkAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/admin/admin.html', checkAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve admin static files (JS, CSS, login.html etc).
// This comes AFTER the protected routes so they can be handled first.
app.use('/admin', express.static(path.join(__dirname, 'public')));


// --- API ROUTES ---

// Telegram Webhook - MUST use raw body parser
app.post('/api/telegram-webhook', express.json(), async (req, res) => {
    const update = req.body;

    // Handle pre-checkout query
    if (update.pre_checkout_query) {
        const query = update.pre_checkout_query;
        log('info', `Received pre-checkout query for payload: ${query.invoice_payload}`);
        // Basic validation: check if payload exists
        if (query.invoice_payload) {
            await answerPreCheckoutQuery(query.id, true);
        } else {
            await answerPreCheckoutQuery(query.id, false, "Invalid payload.");
        }
    }

    // Handle successful payment
    else if (update.message && update.message.successful_payment) {
        const payment = update.message.successful_payment;
        log('info', `Received successful payment for payload: ${payment.invoice_payload}`);
        try {
            await processSuccessfulPayment(payment.invoice_payload);
        } catch (error) {
            log('error', `Failed to process successful payment for payload ${payment.invoice_payload}`, error);
        }
    }
    
    // Always respond to Telegram to acknowledge receipt of the webhook
    res.sendStatus(200);
});


app.post('/api/login', async (req, res) => {
    try {
        const { tgUser, startParam } = req.body;
        if (!tgUser || !tgUser.id) {
            return res.status(400).json({ error: 'Invalid Telegram user data.' });
        }
        
        let config = await getGameConfig();
        // Ensure battle state is current for every login.
        await checkAndManageBattles(config);
        
        const userId = String(tgUser.id);
        const userName = `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim();
        const lang = tgUser.language_code || 'en';
        
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const geo = geoip.lookup(ip);

        let user = await getUser(userId);
        let player = await getPlayer(userId);
        
        if (!user) {
            // New user registration
            const referrerId = startParam || null;
            user = await createUser(userId, userName, lang, referrerId);
            if (referrerId) {
                // Apply one-time bonus and immediately update referrer's passive income
                await applyReferralBonus(referrerId);
                await recalculateReferralProfit(referrerId); 
            }
        }
        
        // Transform user object for the client
        if (user) {
            user.referrerId = user.referrer_id;
            delete user.referrer_id;
        }
        
        if (!player) {
            player = {
                balance: 0,
                energy: INITIAL_MAX_ENERGY,
                profitPerHour: 0, // Base profit is 0, referral profit will be added by recalculate
                tasksProfitPerHour: 0,
                referralProfitPerHour: 0,
                cellProfitBonus: 0,
                coinsPerTap: 1,
                lastLoginTimestamp: Date.now(),
                upgrades: {},
                referrals: 0,
                completedDailyTaskIds: [],
                purchasedSpecialTaskIds: [],
                completedSpecialTaskIds: [],
                dailyTaps: 0,
                lastDailyReset: Date.now(),
                claimedComboToday: false,
                claimedCipherToday: false,
                dailyUpgrades: [],
                tapGuruLevel: 0,
                energyLimitLevel: 0,
                suspicionLimitLevel: 0,
                unlockedSkins: [DEFAULT_COIN_SKIN_ID],
                currentSkinId: DEFAULT_COIN_SKIN_ID,
                suspicion: 0,
                cellId: null,
                dailyBoostPurchases: {},
                discoveredGlitchCodes: [],
                claimedGlitchCodes: [],
            };
            await savePlayer(userId, player);
        } else {
            const now = Date.now();
            let wasReset = false;
            
            // Check for daily reset
            const lastResetDate = new Date(player.lastDailyReset || 0).toDateString();
            const todayDate = new Date(now).toDateString();

            if (lastResetDate !== todayDate) {
                player = await resetPlayerDailyProgress(userId); // This saves the state
                wasReset = true;
            }

            // Calculate offline profit based on the potentially reset player state
            const timeOfflineInSeconds = Math.floor((now - (player.lastLoginTimestamp || now)) / 1000);
            if (timeOfflineInSeconds > 1) {
                const offlineProfit = ((player.profitPerHour || 0) / 3600) * timeOfflineInSeconds;
                player.balance = Number(player.balance || 0) + offlineProfit;
                log('info', `User ${userId} was offline for ${timeOfflineInSeconds}s, earned ${offlineProfit} offline profit.`);
            }
            
            // Always update timestamp for the next login/save calculation
            player.lastLoginTimestamp = now;

            // Save the player state with new balance and timestamp if it wasn't already saved by the reset function
            if (!wasReset) {
                await savePlayer(userId, player);
            }
        }
        
        await updateUserAccessInfo(userId, { country: geo?.country });
        
        // Fetch daily event for today
        const today = new Date().toISOString().split('T')[0];
        let dailyEventData = await getDailyEvent(today);

        // Manually map snake_case from DB to camelCase for the client
        if (dailyEventData) {
            dailyEventData = {
                combo_ids: dailyEventData.combo_ids, 
                cipherWord: dailyEventData.cipher_word,
                comboReward: dailyEventData.combo_reward,
                cipherReward: dailyEventData.cipher_reward,
            }
        }

        res.json({ user, player, config: { ...config, dailyEvent: dailyEventData } });

    } catch (error) {
        log('error', '/api/login failed', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/player/:id', async (req, res) => {
    const { id } = req.params;
    const { state: clientState, taps: clientTaps } = req.body;
    const dbClient = await pool.connect();

    try {
        await dbClient.query('BEGIN');

        const dbRes = await dbClient.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [id]);
        if (dbRes.rows.length === 0) {
            // This case should be rare, but handle it gracefully
            await dbClient.query('INSERT INTO players (id, data) VALUES ($1, $2)', [id, clientState]);
            await dbClient.query('COMMIT');
            return res.status(201).json(clientState);
        }
        
        let serverState = dbRes.rows[0].data;
        
        // Add taps to battle score if applicable
        if (serverState.cellId && clientTaps > 0) {
            await addTapsToBattle(serverState.cellId, clientTaps);
        }
        
        let finalState = { ...serverState };
        let stateUpdatedForClient = false;

        // --- Core Sync and Update Logic ---
        if (serverState.forceSync) {
            // Admin reset has occurred. Server state is the source of truth.
            // Ignore client's balance and energy, just apply new taps.
            finalState.balance = (Number(serverState.balance) || 0) + Number(clientTaps || 0);
            finalState.energy = clientState.energy;
            finalState.dailyTaps = clientState.dailyTaps;
            
            delete finalState.forceSync; // Sync is done, remove the flag.
            stateUpdatedForClient = true;
            log('info', `Forcing sync for user ${id} after admin reset.`);
        } else {
            // Standard update logic
            // 1. Apply any pending admin bonus.
            const adminBonus = Number(serverState.adminBonus) || 0;
            if (adminBonus !== 0) {
                finalState.balance = (Number(clientState.balance) || 0) + adminBonus;
                finalState.adminBonus = 0;
                stateUpdatedForClient = true;
                log('info', `Applied admin bonus of ${adminBonus} to user ${id}.`);
            } else {
                finalState.balance = clientState.balance;
            }
             // 2. Update high-frequency fields from the client.
            finalState.energy = clientState.energy;
            finalState.dailyTaps = clientState.dailyTaps;
        }

        // --- Anti-Cheat Check (applied on both paths) ---
        const timeDiff = (Date.now() - (serverState.lastLoginTimestamp || Date.now())) / 1000;
        if (timeDiff > 0.1 && clientTaps > 0) {
            const tps = clientTaps / timeDiff;
            if (tps > CHEAT_DETECTION_THRESHOLD_TPS) {
                finalState.cheatStrikes = (serverState.cheatStrikes || 0) + 1;
                finalState.cheatLog = [...(serverState.cheatLog || []), { tps, taps: clientTaps, timeDiff, timestamp: new Date().toISOString() }];
                if (finalState.cheatStrikes >= CHEAT_DETECTION_STRIKES_TO_FLAG) {
                    finalState.isCheater = true;
                }
                log('warn', `High TPS detected for user ${id}: ${tps.toFixed(2)}`);
                 stateUpdatedForClient = true; // Make sure client knows about cheat status
            }
        }
        
        // Always update the timestamp
        finalState.lastLoginTimestamp = Date.now();
        
        // --- Save and Respond ---
        await dbClient.query('UPDATE players SET data = $1 WHERE id = $2', [finalState, id]);
        await dbClient.query('COMMIT');
        
        if (stateUpdatedForClient) {
            res.json(finalState);
        } else {
            res.sendStatus(200);
        }
    } catch (error) {
        await dbClient.query('ROLLBACK');
        log('error', `Saving player ${id} failed in transaction`, error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        dbClient.release();
    }
});


app.post('/api/user/:id/language', async (req, res) => {
    try {
        const { id } = req.params;
        const { language } = req.body;
        await updateUserLanguage(id, language);
        res.sendStatus(200);
    } catch (error) {
        log('error', `Updating language for ${req.params.id} failed`, error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- Game Action Endpoints ---

const gameActions = {
    'buy-upgrade': async (body, player, config) => {
        const { userId, upgradeId } = body;
        const updatedPlayer = await buyUpgradeInDb(userId, upgradeId, config);
        return { player: updatedPlayer };
    },

    'buy-boost': async (body, player, config) => {
        const { userId, boostId } = body;
        const updatedPlayer = await buyBoostInDb(userId, boostId, config);
        return { player: updatedPlayer };
    },
    
    'claim-task': async (body, player, config) => { // Handles ONLY daily tasks
        const { userId, taskId, code } = body;
        const result = await claimDailyTaskReward(userId, taskId, code);
        const task = config.tasks.find(t => t.id === taskId);
        if (!task) throw new Error('Task not found');
        return { player: result, reward: task.reward };
    },
    
    'claim-combo': async (body) => {
        return await claimComboReward(body.userId);
    },
    
    'claim-cipher': async (body) => {
        return await claimCipherReward(body.userId, body.cipher);
    },
    
    'claim-glitch-code': async (body) => {
        return await claimGlitchCodeInDb(body.userId, body.code);
    },

    'unlock-free-task': async (body, player, config) => {
        const { userId, taskId } = body;
        const task = config.specialTasks.find(t => t.id === taskId);
        if (!task) throw new Error('Task not found');
        if (task.priceStars > 0) throw new Error('This task is not free');

        const updatedPlayer = await unlockSpecialTask(userId, taskId, config);
        const wonItem = updatedPlayer.lastPurchaseResult;
        // The wonItem is already in the player data, but we extract it for the client response
        return { player: updatedPlayer, wonItem };
    },

    'complete-task': async (body, player, config) => { // Handles ONLY special tasks
        const { userId, taskId, code } = body;
        const result = await completeAndRewardSpecialTask(userId, taskId, code);
        const task = config.specialTasks.find(t => t.id === taskId);
        if (!task) throw new Error('Task not found');
        return { player: result, reward: task.reward };
    },

    'open-lootbox': async(body, player, config) => {
        const { userId, boxType } = body;
        if (boxType !== 'coin') {
            throw new Error("This action is only for coin lootboxes.");
        }
        const { updatedPlayer, wonItem } = await openLootboxInDb(userId, boxType, config);
        return { player: updatedPlayer, wonItem };
    },

    'set-skin': async (body, player) => {
        const { skinId, userId } = body;
        if (!player.unlockedSkins.includes(skinId)) {
            throw new Error("Skin not unlocked");
        }
        player.currentSkinId = skinId;
        await savePlayer(userId, player);
        return { player };
    },
};

app.post('/api/action/:action', async (req, res) => {
    const { action } = req.params;
    const { userId } = req.body;
    
    try {
        if (!gameActions[action]) {
            return res.status(404).json({ error: "Action not found" });
        }
        
        let player = await getPlayer(userId);
        const config = await getGameConfig();
        if (!player || !config) return res.status(404).json({ error: "Player or config not found" });
        
        const now = Date.now();
        const lastResetDate = new Date(player.lastDailyReset || 0).toDateString();
        const todayDate = new Date(now).toDateString();

        if (lastResetDate !== todayDate) {
            log('info', `Performing daily reset for user ${userId}`);
            player = await resetPlayerDailyProgress(userId);
        }

        const result = await gameActions[action](req.body, player, config);
        
        res.json(result);

    } catch (error) {
        log('error', `Action ${action} for user ${userId} failed`, error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/create-star-invoice', async (req, res) => {
    const { userId, payloadType, itemId } = req.body;
    const { BOT_TOKEN } = process.env;

    if (!BOT_TOKEN) {
        return res.status(500).json({ ok: false, error: "Bot Token is not configured." });
    }
    try {
        const player = await getPlayer(userId);
        const config = await getGameConfig();
        if (!player) return res.status(404).json({ ok: false, error: "Player not found." });

        let title, description, payload, price;
        
        if (payloadType === 'task') {
            const task = config.specialTasks.find(t => t.id === itemId);
            if (!task) return res.status(404).json({ ok: false, error: "Task not found." });
            if (player.purchasedSpecialTaskIds?.includes(itemId)) return res.status(400).json({ ok: false, error: "Task already purchased." });
            if (task.priceStars <= 0) return res.status(400).json({ ok: false, error: "This task is not for sale." });

            title = task.name['en'] || 'Special Task';
            description = task.description['en'] || 'Unlock this special task.';
            payload = `task-${userId}-${itemId}`;
            price = task.priceStars;
        } else if (payloadType === 'lootbox') {
            if (itemId !== 'star') return res.status(400).json({ ok: false, error: "Invalid lootbox type" });
            title = 'Star Container';
            description = 'A container with rare items.';
            payload = `lootbox-${userId}-${itemId}`;
            price = config.lootboxCostStars || 0;
            if (price <= 0) return res.status(400).json({ ok: false, error: "Lootbox not for sale." });
        } else {
            return res.status(400).json({ ok: false, error: "Invalid payload type." });
        }

        const invoicePayload = {
            title,
            description,
            payload,
            provider_token: "", // EMPTY for Telegram Stars
            currency: 'XTR',
            prices: [{ label: title, amount: price }]
        };

        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(invoicePayload)
        });
        const data = await response.json();

        if (data.ok) {
            res.json({ ok: true, invoiceLink: data.result });
        } else {
            throw new Error(data.description || 'Failed to create invoice link.');
        }

    } catch (error) {
        log('error', 'Failed to create star invoice', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});


app.post('/api/sync-after-payment', async (req, res) => {
    const { userId } = req.body;
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const playerRes = await dbClient.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error("Player not found");
        
        let player = playerRes.rows[0].data;
        const wonItem = player.lastPurchaseResult || null;
        
        if (wonItem) {
            delete player.lastPurchaseResult;
            await dbClient.query('UPDATE players SET data = $1 WHERE id = $2', [player, userId]);
        }
        
        await dbClient.query('COMMIT');
        res.json({ player, wonItem });

    } catch(e) {
        await dbClient.query('ROLLBACK');
        log('error', `Sync after payment for user ${userId} failed`, e);
        res.status(500).json({ error: e.message });
    } finally {
        dbClient.release();
    }
});


// --- Cell & Informant API ---

app.post('/api/cell/create', async (req, res) => {
    try {
        const { userId, name } = req.body;
        const config = await getGameConfig();
        const result = await createCellInDb(userId, name, config.cellCreationCost);
        res.json(result);
    } catch(e) {
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/cell/join', async (req, res) => {
    try {
        const { userId, inviteCode } = req.body;
        const config = await getGameConfig();
        const result = await joinCellInDb(userId, inviteCode, config);
        res.json(result);
    } catch(e) {
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/cell/leave', async (req, res) => {
     try {
        const { userId } = req.body;
        const result = await leaveCellFromDb(userId);
        res.json(result);
    } catch(e) {
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/cell/buy-ticket', async (req, res) => {
    try {
        const { userId } = req.body;
        const config = await getGameConfig();
        const result = await buyTicketInDb(userId, config);
        res.json({ cell: result });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.get('/api/cell/my-cell', async (req, res) => {
    try {
        const { userId } = req.query;
        const player = await getPlayer(userId);
        if (!player || !player.cellId) return res.json({ cell: null });
        
        const config = await getGameConfig();
        const cell = await getCellFromDb(player.cellId, config);
        res.json({ cell });
    } catch(e) {
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/informant/recruit', async (req, res) => {
    if (!ai) {
        return res.status(503).json({ error: "Recruitment service is currently unavailable." });
    }
    
    try {
        const { userId } = req.body;
        const config = await getGameConfig();
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "You are a curator of an agent network in a grim dystopian world in the spirit of '1984'. Create a short, encrypted dossier for a new informant. Include a codename, a detail from the past, and a potential weakness.",
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: {
                            type: Type.STRING,
                            description: "A codename for the informant."
                        },
                        dossier: {
                            type: Type.STRING,
                            description: "A short, bureaucratic dossier text including a detail from the past and a potential weakness."
                        },
                        specialization: {
                            type: Type.STRING,
                            enum: ['finance', 'counter-intel', 'logistics'],
                            description: "The informant's area of specialization."
                        }
                    },
                    required: ["name", "dossier", "specialization"]
                }
            }
        });
        
        const jsonText = response.text.trim();
        const informantData = JSON.parse(jsonText);
        
        const result = await recruitInformantInDb(userId, informantData, config);
        res.json(result);

    } catch(e) {
        console.error("Informant recruitment error:", e);
        if (e.message.includes('API key')) {
            res.status(500).json({ error: "Gemini API key is invalid or missing. Please check your GEMINI_API_KEY environment variable." });
        } else {
            res.status(500).json({ error: "Failed to process recruitment request." });
        }
    }
});

// --- Battle API ---
app.get('/api/battle/status', async (req, res) => {
    try {
        const { userId } = req.query;
        const player = await getPlayer(userId);
        const status = await getBattleStatusForCell(player?.cellId);
        res.json({ status });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/battle/join', async (req, res) => {
    try {
        const { userId } = req.body;
        const status = await joinActiveBattle(userId);
        const config = await getGameConfig();
        const cell = await getCellFromDb((await getPlayer(userId)).cellId, config);
        res.json({ status, cell });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.get('/api/battle/leaderboard', async (req, res) => {
    try {
        const leaderboard = await getBattleLeaderboard();
        res.json({ leaderboard });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- Public API Routes ---
app.get('/api/leaderboard', async (req, res) => {
    try {
        const [topPlayers, totalPlayers, config] = await Promise.all([
            getLeaderboardData(),
            getTotalPlayerCount(),
            getGameConfig()
        ]);
        const sortedLeagues = [...(config.leagues || [])].sort((a,b) => b.minProfitPerHour - a.minProfitPerHour);
        
        const playersWithLeagues = topPlayers.map(p => {
            const league = sortedLeagues.find(l => p.profitPerHour >= l.minProfitPerHour) || sortedLeagues[sortedLeagues.length - 1];
            return {
                id: p.id,
                name: p.name,
                profitPerHour: p.profitPerHour,
                leagueName: league?.name,
                leagueIconUrl: league?.iconUrl,
            };
        });

        res.json({ topPlayers: playersWithLeagues, totalPlayers });
    } catch (error) {
        log('error', '/api/leaderboard failed', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- Admin Panel API (protected by middleware) ---
app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.redirect('/admin/');
    } else {
        res.status(401).send('Incorrect password');
    }
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/admin/login.html');
    });
});

app.post('/admin/api/translate-text', checkAdminAuth, async (req, res) => {
    if (!ai) {
        return res.status(503).json({ error: "Translation service is not available." });
    }
    try {
        const { text, targetLangs } = req.body;
        if (!text || !targetLangs || !Array.isArray(targetLangs)) {
            return res.status(400).json({ error: "Invalid request body" });
        }
        
        const properties = {};
        targetLangs.forEach(lang => {
          properties[lang] = { type: Type.STRING, description: `The translation of the text in the language with this ISO 639-1 code: ${lang}` };
        });

        const responseSchema = {
          type: Type.OBJECT,
          properties,
        };

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Translate the following text into these languages: ${targetLangs.join(", ")}. The text is: "${text}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema,
            },
        });

        const jsonText = response.text.trim();
        const translations = JSON.parse(jsonText);
        res.json({ translations });
    } catch (e) {
        log('error', "AI translation failed", e);
        res.status(500).json({ error: "Failed to communicate with translation service." });
    }
});

app.post('/admin/api/generate-ai-content', checkAdminAuth, async (req, res) => {
    if (!ai) {
        return res.status(503).json({ error: "AI service is not available. Check GEMINI_API_KEY." });
    }

    try {
        const localizedStringSchema = {
            type: Type.OBJECT,
            properties: {
                en: { type: Type.STRING },
                ua: { type: Type.STRING },
                ru: { type: Type.STRING }
            },
            required: ["en", "ua", "ru"]
        };

        const rewardSchema = {
            type: Type.OBJECT,
            properties: {
                type: { type: Type.STRING, enum: ['coins', 'profit'] },
                amount: { type: Type.INTEGER }
            },
            required: ["type", "amount"]
        };

        const upgradeSchema = {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "Unique ID, e.g., 'ai_upg_1'" },
                name: localizedStringSchema,
                price: { type: Type.INTEGER },
                profitPerHour: { type: Type.INTEGER },
                category: { type: Type.STRING, enum: ["Documents", "Legal", "Lifestyle", "Special"] },
                iconUrl: { type: Type.STRING, description: "A valid URL from api.iconify.design" },
                suspicionModifier: { type: Type.INTEGER }
            },
            required: ["id", "name", "price", "profitPerHour", "category", "iconUrl", "suspicionModifier"]
        };

        const specialTaskSchema = {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "Unique ID, e.g., 'ai_tsk_1'" },
                name: localizedStringSchema,
                description: localizedStringSchema,
                type: { type: Type.STRING, enum: ['telegram_join', 'youtube_subscribe', 'video_watch'] },
                url: { type: Type.STRING, description: "A relevant URL for the task." },
                reward: rewardSchema,
                priceStars: { type: Type.INTEGER },
                isOneTime: { type: Type.BOOLEAN, description: "Should always be true" },
                imageUrl: { type: Type.STRING, description: "A valid URL from api.iconify.design" },
                suspicionModifier: { type: Type.INTEGER }
            },
             required: ["id", "name", "description", "type", "url", "reward", "priceStars", "isOneTime", "imageUrl", "suspicionModifier"]
        };

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                upgrades: { type: Type.ARRAY, items: upgradeSchema },
                specialTasks: { type: Type.ARRAY, items: specialTaskSchema }
            },
            required: ["upgrades", "specialTasks"]
        };

        const prompt = `You are a game designer for a satirical clicker game called 'Ukhyliant Clicker'. The game is set in a dystopian society, heavily inspired by Orwell's '1984', but with a modern Ukrainian context of war and mobilization. The player is a 'draft dodger' (ухилянт) trying to survive and profit. Your task is to generate new in-game content that is dark, humorous, and satirical.

Generate exactly 5 new 'Upgrade' cards and 5 new 'Airdrop' (SpecialTask) tasks.
- The content should reflect the absurd and grim reality of dodging the draft, dealing with bureaucracy, finding loopholes, and navigating a surveillance state.
- Balance the game by making prices and profits reasonable but escalating.
- For 'iconUrl' and 'imageUrl', provide a valid URL from api.iconify.design that thematically fits the item.
- For 'id', create a short, unique string like 'ai_upg_x' or 'ai_tsk_x'.
- Provide all localizable strings ('name', 'description') in English (en), Ukrainian (ua), and Russian (ru).
- 'isOneTime' for tasks must always be true.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
        });
        
        const jsonText = response.text.trim();
        const generatedContent = JSON.parse(jsonText);
        res.json(generatedContent);

    } catch (e) {
        log('error', "AI content generation failed", e);
        res.status(500).json({ error: "Failed to generate content with AI. " + e.message });
    }
});

app.post('/admin/api/broadcast-message', checkAdminAuth, async (req, res) => {
    const { text, imageUrl, buttonUrl, buttonText } = req.body;
    const { BOT_TOKEN } = process.env;

    if (!text || !BOT_TOKEN) {
        return res.status(400).json({ error: 'Text and Bot Token are required.' });
    }

    try {
        const userIds = await getAllUserIds();
        
        // Respond to admin immediately
        res.json({ message: `Broadcast started for ${userIds.length} users.` });

        // Perform the broadcast in the background
        (async () => {
            let reply_markup = undefined;
            if (buttonUrl && buttonText) {
                reply_markup = {
                    inline_keyboard: [[{ text: buttonText, url: buttonUrl }]]
                };
            }

            let successCount = 0;
            let failureCount = 0;

            for (const userId of userIds) {
                try {
                    const payload = {
                        chat_id: userId,
                        ...(reply_markup && { reply_markup })
                    };

                    let url;
                    if (imageUrl) {
                        url = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
                        payload.photo = imageUrl;
                        payload.caption = text;
                    } else {
                        url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
                        payload.text = text;
                    }

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    
                    const data = await response.json();
                    if (data.ok) {
                        successCount++;
                    } else {
                        failureCount++;
                        log('warn', `Failed to send broadcast to ${userId}: ${data.description}`);
                    }

                } catch (e) {
                    failureCount++;
                    log('error', `Broadcast error for user ${userId}`, e);
                }
                
                // Rate limit: 20 messages per second is safe
                await new Promise(resolve => setTimeout(resolve, 50)); 
            }
            log('info', `Broadcast finished. Success: ${successCount}, Failures: ${failureCount}`);
        })();

    } catch (error) {
        log('error', 'Broadcast initiation failed', error);
        res.status(500).json({ error: 'Failed to start broadcast.' });
    }
});

app.get('/admin/api/config', checkAdminAuth, async (req, res) => res.json(await getGameConfig()));
app.post('/admin/api/config', checkAdminAuth, async (req, res) => {
    await saveConfig(req.body.config);
    res.sendStatus(200);
});
app.get('/admin/api/players', checkAdminAuth, async (req, res) => res.json(await getAllPlayersForAdmin()));
app.delete('/admin/api/player/:id', checkAdminAuth, async (req, res) => {
    await deletePlayer(req.params.id);
    res.sendStatus(200);
});
app.get('/admin/api/player/:id/details', checkAdminAuth, async (req, res) => res.json(await getPlayerDetails(req.params.id)));
app.post('/admin/api/player/:id/update-balance', checkAdminAuth, async (req, res) => {
    await updatePlayerBalance(req.params.id, req.body.amount);
    res.sendStatus(200);
});
app.post('/admin/api/player/:id/reset-daily', checkAdminAuth, async(req, res) => {
    await resetPlayerDailyProgress(req.params.id);
    res.sendStatus(200);
});
app.post('/admin/api/player/:id/reset-progress', checkAdminAuth, async(req, res) => {
    await resetPlayerProgress(req.params.id);
    res.sendStatus(200);
});
app.get('/admin/api/cheaters', checkAdminAuth, async(req, res) => res.json(await getCheaters()));
app.get('/admin/api/dashboard-stats', checkAdminAuth, async (req, res) => {
    try {
        const stats = await getDashboardStats();
        stats.onlineNow = await getOnlinePlayerCount();
        res.json(stats);
    } catch(e) {
        log('error', 'Fetching dashboard stats failed', e);
        res.status(500).json({ error: e.message });
    }
});
app.get('/admin/api/player-locations', checkAdminAuth, async (req, res) => {
    try {
        res.json(await getPlayerLocations());
    } catch (e) {
        log('error', 'Fetching player locations failed', e);
        res.status(500).json({ error: e.message });
    }
});
app.get('/admin/api/daily-events', checkAdminAuth, async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    res.json(await getDailyEvent(today));
});
app.post('/admin/api/daily-events', checkAdminAuth, async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const { combo_ids, cipher_word, combo_reward, cipher_reward } = req.body;
    await saveDailyEvent(today, combo_ids, cipher_word, combo_reward, cipher_reward);
    res.sendStatus(200);
});
app.get('/admin/api/social-stats', checkAdminAuth, async (req, res) => {
    try {
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
        if (Date.now() - socialStatsCache.lastUpdated > CACHE_DURATION) {
            await updateSocialStatsCache();
        }
        res.json(socialStatsCache);
    } catch (error) {
        log('error', 'Fetching social stats failed', error);
        res.status(500).json({ error: 'Failed to fetch social stats' });
    }
});

app.get('/admin/api/cell-analytics', checkAdminAuth, async (req, res) => {
    try {
        const analytics = await getCellAnalytics();
        res.json(analytics);
    } catch(e) {
        log('error', 'Failed to get cell analytics', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/admin/api/battle/force-start', checkAdminAuth, async (req, res) => {
    try {
        const config = await getGameConfig();
        await forceStartBattle(config);
        res.json({ ok: true, message: 'Battle started successfully.'});
    } catch(e) {
        log('error', 'Failed to force start battle', e);
        res.status(400).json({ ok: false, error: e.message });
    }
});

app.post('/admin/api/battle/force-end', checkAdminAuth, async (req, res) => {
    try {
        const config = await getGameConfig();
        await forceEndBattle(config);
        res.json({ ok: true, message: 'Battle ended successfully.'});
    } catch(e) {
        log('error', 'Failed to force end battle', e);
        res.status(400).json({ ok: false, error: e.message });
    }
});

app.get('/admin/api/battle/status', checkAdminAuth, async(req, res) => {
    try {
        const status = await getBattleStatusForCell(null); // Get global status
        res.json({ status });
    } catch(e) {
        log('error', 'Failed to get global battle status', e);
        res.status(500).json({ error: e.message });
    }
});


// --- Server Initialization ---
initializeDb().then(() => {
    app.listen(port, () => {
        log('info', `Server is running on http://localhost:${port}`);
    });
    // Initial cache update, then update every 15 minutes
    updateSocialStatsCache();
    setInterval(updateSocialStatsCache, 15 * 60 * 1000);
}).catch(error => {
    log('error', 'Failed to initialize database', error);
    process.exit(1);
});