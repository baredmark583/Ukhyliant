


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
    connectWalletInDb,
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
import { sha256 } from "@ton/crypto";
import nacl from "tweetnacl";
import { Address } from "@ton/ton";
import BigNumber from "bignumber.js";

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

// Correct CORS setup for separate frontend/backend servers
app.use(cors({
    origin: (origin, callback) => {
        // In a real production environment, you would whitelist your frontend domain
        // For development or a flexible setup, reflecting the origin is a safe approach.
        callback(null, origin);
    },
    credentials: true
}));

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
                connectedWallet: user?.walletAddress || null,
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
            
            // Sync wallet address from user table to player state
            player.connectedWallet = user?.walletAddress || null;


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
        if (timeDiff > 0.5 && clientTaps > 0) {
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

const verifySignature = (walletData) => {
    try {
        const { address, proof: { timestamp, domain, signature, payload } } = walletData;

        const walletAddress = Address.parse(address);

        const message = {
            workchain: walletAddress.workChain,
            address: walletAddress.hash,
            domain: {
                lengthBytes: domain.length,
                value: domain,
            },
            timestamp: timestamp,
            payload: payload,
        };

        const wc = Buffer.alloc(4);
        wc.writeUInt32BE(message.workchain, 0);

        const ts = Buffer.alloc(8);
        ts.writeBigUInt64LE(BigInt(message.timestamp), 0);

        const dl = Buffer.alloc(4);
        dl.writeUInt32LE(message.domain.lengthBytes, 0);

        const m = Buffer.concat([
            Buffer.from('ton-proof-item-v2/'),
            wc,
            message.address,
            dl,
            Buffer.from(message.domain.value),
            ts,
            Buffer.from(message.payload)
        ]);
        
        const signingMessage = Buffer.concat([
            Buffer.from([0xff, 0xff]),
            Buffer.from('ton-connect'),
            sha256(m)
        ]);

        return nacl.sign.detached.verify(sha256(signingMessage), Buffer.from(signature, 'base64'), Buffer.from(walletData.account.publicKey, 'hex'));
    } catch (e) {
        console.error("Signature verification error:", e);
        return false;
    }
};


app.post('/api/user/connect-wallet', async (req, res) => {
    try {
        const { userId, walletData } = req.body;

        if (!walletData || !walletData.address || !walletData.proof || !walletData.account?.publicKey) {
            return res.status(400).json({ error: "Invalid wallet data provided" });
        }
        
        const isValid = verifySignature(walletData);
        if (!isValid) {
             return res.status(403).json({ error: "Signature verification failed" });
        }
        
        const walletAddress = Address.parse(walletData.address).toString({ bounceable: false });
        const { player } = await connectWalletInDb(userId, walletAddress);

        res.json({ player });

    } catch (error) {
        log('error', `Wallet connection for user ${req.body.userId} failed`, error);
        if (error.code === '23505') { // unique_violation
            res.status(409).json({ error: "This wallet is already connected to another account." });
        } else {
            res.status(500).json({ error: 'Internal Server Error' });
        }
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
    
    'unlock-free-task': async (body, player, config) => {
        const { userId, taskId } = body;
        const task = config.specialTasks.find(t => t.id === taskId);
        if (!task) throw new Error('Task not found');
        if (task.priceStars > 0) throw new Error('This task is not free');

        const updatedPlayer = await unlockSpecialTask(userId, taskId, config);
        const wonItem = updatedPlayer.lastPurchaseResult.item;
        return { player: updatedPlayer, wonItem: {type: 'task', item: wonItem} };
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
        const purchaseResult = player.lastPurchaseResult || null;
        
        if (purchaseResult) {
            delete player.lastPurchaseResult;
            await dbClient.query('UPDATE players SET data = $1 WHERE id = $2', [player, userId]);
        }
        
        await dbClient.query('COMMIT');
        res.json({ player, wonItem: purchaseResult });

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
        return res.status(503).json({ error: 'Gemini API not configured' });
    }
    const { text, targetLangs } = req.body;
    if (!text || !targetLangs || !Array.isArray(targetLangs)) {
        return res.status(400).json({ error: 'Invalid request body' });
    }
    try {
        const prompt = `Translate the following English text into a JSON object with keys for each target language (${targetLangs.join(', ')}). Text: "${text}"`;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: targetLangs.reduce((acc, lang) => ({...acc, [lang]: { type: Type.STRING } }), {}),
                }
            }
        });
        
        const jsonResponse = JSON.parse(response.text.trim());
        res.json({ translations: jsonResponse });
    } catch (error) {
        log('error', 'Translation API error', error);
        res.status(500).json({ error: 'Failed to translate text' });
    }
});

app.get('/admin/api/config', checkAdminAuth, async (req, res) => {
    try {
        const config = await getGameConfig();
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load config' });
    }
});

app.post('/admin/api/config', checkAdminAuth, async (req, res) => {
    try {
        await saveConfig(req.body.config);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save config' });
    }
});

app.get('/admin/api/players', checkAdminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '50', 10);
        const searchTerm = req.query.search || null;
        const data = await getAllPlayersForAdmin(page, limit, searchTerm);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch players' });
    }
});

app.delete('/admin/api/player/:id', checkAdminAuth, async (req, res) => {
    try {
        await deletePlayer(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete player' });
    }
});

app.get('/admin/api/player/:id/details', checkAdminAuth, async (req, res) => {
    try {
        const details = await getPlayerDetails(req.params.id);
        res.json(details);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get player details' });
    }
});

app.post('/admin/api/player/:id/update-balance', checkAdminAuth, async (req, res) => {
    try {
        await updatePlayerBalance(req.params.id, req.body.amount);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update balance' });
    }
});

app.post('/admin/api/player/:id/reset-daily', checkAdminAuth, async (req, res) => {
    try {
        await resetPlayerDailyProgress(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reset daily progress' });
    }
});

app.get('/admin/api/daily-events', checkAdminAuth, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const event = await getDailyEvent(today);
        res.json(event);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch daily event' });
    }
});

app.post('/admin/api/daily-events', checkAdminAuth, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { combo_ids, cipher_word, combo_reward, cipher_reward } = req.body;
        await saveDailyEvent(today, combo_ids, cipher_word, combo_reward, cipher_reward);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save daily event' });
    }
});

app.get('/admin/api/dashboard-stats', checkAdminAuth, async (req, res) => {
    try {
        const [stats, onlineCount] = await Promise.all([
            getDashboardStats(),
            getOnlinePlayerCount()
        ]);
        res.json({ ...stats, onlineNow: onlineCount });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get dashboard stats' });
    }
});

app.get('/admin/api/social-stats', checkAdminAuth, (req, res) => {
    res.json(socialStatsCache);
});

app.get('/admin/api/player-locations', checkAdminAuth, async (req, res) => {
    try {
        const locations = await getPlayerLocations();
        res.json(locations);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get player locations' });
    }
});

app.post('/admin/api/broadcast-message', checkAdminAuth, async (req, res) => {
    const { text, imageUrl, buttonUrl, buttonText } = req.body;
    const { BOT_TOKEN } = process.env;

    if (!BOT_TOKEN) {
        return res.status(500).json({ message: "Bot token not configured." });
    }

    try {
        const userIds = await getAllUserIds();
        let successCount = 0;
        let failCount = 0;
        
        const reply_markup = buttonUrl && buttonText ? {
            inline_keyboard: [[{ text: buttonText, url: buttonUrl }]]
        } : undefined;

        for (const userId of userIds) {
            let response;
            try {
                if (imageUrl) {
                    response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: userId, photo: imageUrl, caption: text, reply_markup }),
                    });
                } else {
                     response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: userId, text, reply_markup }),
                    });
                }
                const data = await response.json();
                if (data.ok) successCount++;
                else failCount++;
            } catch (e) {
                failCount++;
            }
            await new Promise(resolve => setTimeout(resolve, 50)); // Avoid hitting rate limits
        }
        res.json({ message: `Broadcast sent: ${successCount} successful, ${failCount} failed.` });

    } catch (error) {
        res.status(500).json({ message: 'Broadcast failed.', error: error.message });
    }
});

app.get('/admin/api/cheaters', checkAdminAuth, async (req, res) => {
    try {
        const cheaters = await getCheaters();
        res.json(cheaters);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get cheaters' });
    }
});

app.post('/admin/api/player/:id/reset-progress', checkAdminAuth, async (req, res) => {
    try {
        await resetPlayerProgress(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reset progress' });
    }
});

app.get('/admin/api/cell-analytics', checkAdminAuth, async (req, res) => {
    try {
        const analytics = await getCellAnalytics();
        res.json(analytics);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get cell analytics' });
    }
});

app.post('/admin/api/battle/force-start', checkAdminAuth, async (req, res) => {
    try {
        const config = await getGameConfig();
        await forceStartBattle(config);
        res.json({ ok: true });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
});

app.post('/admin/api/battle/force-end', checkAdminAuth, async (req, res) => {
    try {
        const config = await getGameConfig();
        await forceEndBattle(config);
        res.json({ ok: true });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
});

app.get('/admin/api/battle/status', checkAdminAuth, async (req, res) => {
    try {
        const status = await getBattleStatusForCell(null);
        res.json({ status });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Server Startup ---
const startServer = async () => {
    try {
        await initializeDb();
        log('info', 'Database initialized successfully.');

        await updateSocialStatsCache(); // Initial cache fill
        setInterval(updateSocialStatsCache, 60 * 60 * 1000); // Update every hour

        const config = await getGameConfig();
        await checkAndManageBattles(config);
        setInterval(async () => await checkAndManageBattles(await getGameConfig()), 5 * 60 * 1000); // Check every 5 minutes

        app.listen(port, () => {
            log('info', `Server running on http://localhost:${port}`);
        });
    } catch (error) {
        log('error', 'Failed to start server', error);
        process.exit(1);
    }
};

startServer();