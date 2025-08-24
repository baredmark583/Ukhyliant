import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { GoogleGenAI, Type } from '@google/genai';
import connectPgSimple from 'connect-pg-simple';
import geoip from 'geoip-lite';
import { exec } from 'child_process';
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
    markGlitchAsShownInDb,
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
    getAllUserIds,
    getMarketListingById,
    listSkinForSaleInDb,
    getMarketListingsFromDb,
    connectTonWalletInDb,
    requestWithdrawalInDb,
    getWithdrawalRequestsForAdmin,
    updateWithdrawalRequestStatusInDb,
    getPlayerWithdrawalRequests,
    activateBattleBoostInDb,
    purchaseMarketItemWithCoinsInDb,
    submitVideoForReviewDb,
    getPlayerSubmissionsDb,
    getAdminSubmissionsDb,
    approveSubmissionDb,
    rejectSubmissionDb
} from './db.js';
import { 
    ADMIN_TELEGRAM_ID, MODERATOR_TELEGRAM_IDS, INITIAL_MAX_ENERGY,
    LOOTBOX_COST_STARS, DEFAULT_COIN_SKIN_ID,
    CHEAT_DETECTION_THRESHOLD_TPS, CHEAT_DETECTION_STRIKES_TO_FLAG
} from './constants.js';

// --- Corrected Path Configuration ---
const __filename = fileURLToPath(import.meta.url);
const executionDir = path.dirname(__filename); // e.g., /path/to/project/backend

// Path to the 'public' directory inside 'backend' for the admin panel.
const adminPublicPath = path.join(executionDir, 'public');

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
if (!ai) {
    console.warn("GEMINI_API_KEY for Gemini is not set. AI features will be disabled.");
}

// --- Enhanced Logger ---
const log = (level, message, data) => {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    // Deep copy and sanitize data to avoid logging sensitive info like Telegram hash
    let logData;
    if (data !== undefined) {
        try {
            logData = JSON.parse(JSON.stringify(data));
            if (logData?.tgUser?.hash) logData.tgUser.hash = '[REDACTED]';
            if (logData?.body?.tgUser?.hash) logData.body.tgUser.hash = '[REDACTED]';
        } catch (e) {
            logData = '[[Circular Reference or Unserializable]]';
        }
    }

    const logFn = level === 'error' ? console.error : console.log;

    if (logData !== undefined) {
        logFn(formattedMessage, logData);
    } else {
        logFn(formattedMessage);
    }
};

// --- GeoIP Database Update ---
const updateGeoIpData = () => {
    log('info', 'Starting GeoIP database update...');
    // Use npx to run the update script from geoip-lite package
    const command = 'npx geoip-lite-update-db';
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            log('error', `GeoIP update failed: ${error.message}`);
            return;
        }
        if (stderr) {
            log('warn', `GeoIP update stderr: ${stderr}`);
        }
        log('info', `GeoIP database updated successfully: ${stdout}`);
        // Reload data after update
        geoip.reloadDataSync();
    });
};


const app = express();
const port = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(cors({ origin: '*', credentials: true }));
// Use express.json() for all routes EXCEPT the webhook
app.use((req, res, next) => {
    if (req.path === '/api/telegram-webhook') {
        express.json()(req, res, next);
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
    res.sendFile(path.join(adminPublicPath, 'admin.html'));
});
app.get('/admin/admin.html', checkAdminAuth, (req, res) => {
    res.sendFile(path.join(adminPublicPath, 'admin.html'));
});

// Serve admin static files (JS, CSS, login.html etc).
app.use('/admin', express.static(adminPublicPath));


// --- API ROUTES ---

app.get('/api/image-proxy', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send('URL parameter is required.');
    }

    try {
        const decodedUrl = decodeURIComponent(url);
        log('info', `[PROXY] Attempting to fetch: ${decodedUrl}`);

        const response = await fetch(decodedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            log('warn', `[PROXY] Fetch failed for ${decodedUrl}`, { status: response.status, statusText: response.statusText });
            return res.status(response.status).send(response.statusText);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || (!contentType.startsWith('image/') && !contentType.startsWith('audio/'))) {
            log('warn', `[PROXY] Attempt to proxy non-image/audio content`, { url: decodedUrl, contentType });
            return res.status(400).send('URL does not point to an image or audio file.');
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
        
        if (!response.body) {
             log('warn', `[PROXY] Response for ${decodedUrl} has no body.`);
             return res.end();
        }
        
        // Correctly pipe the Web Stream to Node.js Response Stream
        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            res.write(value);
        }
        res.end();
        log('info', `[PROXY] Successfully streamed ${decodedUrl}`);

    } catch (error) {
        log('error', `[PROXY] CRASHED for url: ${req.query.url}`, error);
        res.status(500).send('Error fetching via proxy.');
    }
});

const answerPreCheckoutQuery = async (pre_checkout_query_id, ok, error_message = '') => {
    const { BOT_TOKEN } = process.env;
    if (!BOT_TOKEN) {
        log('error', 'BOT_TOKEN not set, cannot answer pre-checkout query.');
        return;
    }

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`;
    const body = {
        pre_checkout_query_id,
        ok,
    };
    if (!ok && error_message) {
        body.error_message = error_message;
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await response.json();
        if (!data.ok) {
            log('error', `Failed to answer pre-checkout query: ${data.description}`);
        } else {
            log('info', `Successfully answered pre-checkout query ${pre_checkout_query_id}`);
        }
    } catch (error) {
        log('error', 'Error calling answerPreCheckoutQuery API', error);
    }
};

// Telegram Webhook - MUST use raw body parser
app.post('/api/telegram-webhook', async (req, res) => {
    const update = req.body;
    log('info', '[WEBHOOK_RECEIVED]', { update });

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
            await processSuccessfulPayment(payment.invoice_payload, log);
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
        log('info', '[ACTION:LOGIN]', { tgUser, startParam });
        if (!tgUser || !tgUser.id) {
            return res.status(400).json({ error: 'Invalid Telegram user data.' });
        }
        
        let config = await getGameConfig();
        // Ensure battle state is current for every login.
        await checkAndManageBattles(config);
        
        const userId = String(tgUser.id);
        const userName = `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim();
        const lang = tgUser.language_code || 'en';
        
        const ip = req.headers['x-forwarded-for']?.split(',').shift() || req.socket.remoteAddress;
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
                unlockedSkins: { [DEFAULT_COIN_SKIN_ID]: 1 },
                currentSkinId: DEFAULT_COIN_SKIN_ID,
                suspicion: 0,
                cellId: null,
                dailyBoostPurchases: {},
                discoveredGlitchCodes: [],
                claimedGlitchCodes: [],
                shownGlitchCodes: [],
                marketCredits: 0,
                tonWalletAddress: ""
            };
            await savePlayer(userId, player);
        } else {
            const now = Date.now();
            let wasReset = false;
            
            // Check for daily reset
            const lastResetDate = new Date(player.lastDailyReset || 0).toDateString();
            const todayDate = new Date(now).toDateString();

            if (lastResetDate !== todayDate) {
                player = await resetPlayerDailyProgress(userId, player);
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
    log('info', `[ACTION:SAVE_STATE] User: ${id}`, { taps: clientTaps, state: clientState });
    const dbClient = await pool.connect();

    try {
        await dbClient.query('BEGIN');

        const dbRes = await dbClient.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [id]);
        if (dbRes.rows.length === 0) {
            await dbClient.query('INSERT INTO players (id, data) VALUES ($1, $2)', [id, clientState]);
            await dbClient.query('COMMIT');
            return res.status(201).json(clientState);
        }
        
        let serverState = dbRes.rows[0].data;
        
        if (serverState.cellId && clientTaps > 0) {
            await addTapsToBattle(serverState.cellId, clientTaps);
        }
        
        // Use the client's state as the primary source of truth, as it's the most recent.
        // Then, merge/recalculate critical server-side values to prevent exploits or data loss from race conditions.
        let finalState = { ...clientState };
        let stateUpdatedForClient = false;

        // --- Authoritative Server Recalculations & Merges ---

        // BALANCE: Is recalculated based on server's last known balance + new taps.
        const serverBalance = Number(serverState.balance) || 0;
        const baseTap = serverState.coinsPerTap || 1;
        const level = serverState.tapGuruLevel || 0;
        const effectiveCoinsPerTap = Math.ceil(baseTap * Math.pow(1.5, level));
        const tapEarnings = (clientTaps || 0) * effectiveCoinsPerTap;
        finalState.balance = serverBalance + tapEarnings;
        
        // MERGE ARRAYS: Use a Set union to combine server and client arrays.
        // This prevents a stale client from erasing recently added items (like a discovered glitch code).
        const mergeArrays = (key) => {
            const serverArr = Array.isArray(serverState[key]) ? serverState[key] : [];
            const clientArr = Array.isArray(clientState[key]) ? clientState[key] : [];
            const mergedSet = new Set([...serverArr, ...clientArr].map(c => String(c)));
            const mergedArr = Array.from(mergedSet);
            
            if (mergedArr.length > clientArr.length) {
                stateUpdatedForClient = true;
            }
            finalState[key] = mergedArr;
        };

        mergeArrays('discoveredGlitchCodes');
        mergeArrays('claimedGlitchCodes');
        mergeArrays('shownGlitchCodes');

        // ANTI-CHEAT & GLITCH TRIGGERS
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
                stateUpdatedForClient = true;
            }
        }
        
        const config = await getGameConfig();
        if (config.glitchEvents) {
            for (const event of config.glitchEvents) {
                if (event.trigger?.type === 'balance_equals' && (Number(finalState.balance) || 0) >= event.trigger.params.amount) {
                    const alreadyDiscovered = finalState.discoveredGlitchCodes?.includes(event.code);
                    if (!alreadyDiscovered) {
                         finalState.discoveredGlitchCodes.push(event.code);
                         stateUpdatedForClient = true;
                         log('info', `Triggered balance glitch '${event.code}' for user ${id}`);
                    }
                }
            }
        }
        
        finalState.lastLoginTimestamp = Date.now();
        
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
        log('info', `[ACTION:SET_LANG] User: ${id}`, { language });
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

    'mark-glitch-shown': async (body) => {
        const { userId, code } = body;
        const updatedPlayer = await markGlitchAsShownInDb(userId, code);
        return { player: updatedPlayer };
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
        if (!player.unlockedSkins[skinId] > 0) {
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
    log('info', `[GAME_ACTION] ${action}`, { userId, body: req.body });
    
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
            log('info', `Performing daily reset for user ${userId} during action.`);
            player = await resetPlayerDailyProgress(userId, player);
        }

        const result = await gameActions[action](req.body, player, config);
        log('info', `[GAME_ACTION_SUCCESS] ${action}`, { userId, result });
        
        res.json(result);

    } catch (error) {
        log('error', `Action ${action} for user ${userId} failed`, { message: error.message, stack: error.stack });
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/create-star-invoice', async (req, res) => {
    const { userId, payloadType, itemId } = req.body;
    log('info', '[ACTION:CREATE_INVOICE]', { userId, payloadType, itemId });
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
    log('info', '[ACTION:SYNC_PAYMENT]', { userId });
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
        log('info', `[SYNC_PAYMENT_SUCCESS] User: ${userId}`, { player, wonItem });
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
        log('info', `[CELL_ACTION] Create`, { userId, name });
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
        log('info', `[CELL_ACTION] Join`, { userId, inviteCode });
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
        log('info', `[CELL_ACTION] Leave`, { userId });
        const result = await leaveCellFromDb(userId);
        res.json(result);
    } catch(e) {
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/cell/buy-ticket', async (req, res) => {
    try {
        const { userId } = req.body;
        log('info', `[CELL_ACTION] Buy Ticket`, { userId });
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
        log('info', `[CELL_ACTION] Recruit Informant`, { userId });
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
        log('info', `[BATTLE_ACTION] Join`, { userId });
        const status = await joinActiveBattle(userId);
        const config = await getGameConfig();
        const cell = await getCellFromDb((await getPlayer(userId)).cellId, config);
        res.json({ status, cell });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/cell/activate-boost', async (req, res) => {
    try {
        const { userId, boostId } = req.body;
        log('info', `[BATTLE_ACTION] Activate Boost`, { userId, boostId });
        const config = await getGameConfig();
        const result = await activateBattleBoostInDb(userId, boostId, config);
        res.json(result);
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

// --- Marketplace API ---
app.post('/api/market/list', async (req, res) => {
    try {
        const { userId, skinId, priceStars } = req.body;
        log('info', `[MARKET_ACTION] List Skin`, { userId, skinId, price: priceStars });
        const listing = await listSkinForSaleInDb(userId, skinId, priceStars);
        res.status(201).json({ listing });
    } catch (e) {
        log('error', 'Failed to list skin for sale', e);
        res.status(400).json({ error: e.message });
    }
});

app.get('/api/market/listings', async (req, res) => {
    try {
        const listings = await getMarketListingsFromDb();
        res.json({ listings });
    } catch (e) {
        log('error', 'Failed to fetch market listings', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/market/purchase-coin', async (req, res) => {
    try {
        const { userId, listingId } = req.body;
        log('info', `[MARKET_ACTION] Purchase Skin`, { userId, listingId });
        if (!userId || !listingId) {
            return res.status(400).json({ error: "User ID and Listing ID are required." });
        }
        const config = await getGameConfig();
        const player = await purchaseMarketItemWithCoinsInDb(listingId, userId, config);
        res.json({ player });
    } catch(e) {
        log('error', `Failed to purchase market item with coins`, e);
        res.status(400).json({ error: e.message });
    }
});


// --- Wallet API ---
app.post('/api/wallet/connect', async (req, res) => {
    try {
        const { userId, walletAddress } = req.body;
        log('info', `[WALLET_ACTION] Connect`, { userId, walletAddress });
        const player = await connectTonWalletInDb(userId, walletAddress);
        res.json({ player });
    } catch (e) {
        log('error', 'Failed to connect TON wallet', e);
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/wallet/request-withdrawal', async (req, res) => {
    try {
        const { userId, amountCredits } = req.body;
        log('info', `[WALLET_ACTION] Request Withdrawal`, { userId, amountCredits });
        const player = await requestWithdrawalInDb(userId, amountCredits);
        res.json({ player });
    } catch (e) {
        log('error', 'Failed to request withdrawal', e);
        res.status(400).json({ error: e.message });
    }
});

app.get('/api/wallet/my-requests', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: "User ID is required." });
        }
        const requests = await getPlayerWithdrawalRequests(userId);
        res.json({ requests });
    } catch (e) {
        log('error', 'Failed to fetch player withdrawal requests', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- Video Submission API ---
app.post('/api/video/submit', async (req, res) => {
    try {
        const { userId, url } = req.body;
        log('info', `[VIDEO_ACTION] Submit`, { userId, url });
        if (!userId || !url) {
            return res.status(400).json({ error: 'User ID and URL are required.' });
        }
        const submission = await submitVideoForReviewDb(userId, url);
        res.status(201).json({ submission });
    } catch (e) {
        log('error', 'Failed to submit video', e);
        res.status(400).json({ error: e.message });
    }
});

app.get('/api/video/my-submissions', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required.' });
        }
        const submissions = await getPlayerSubmissionsDb(userId);
        res.json({ submissions });
    } catch (e) {
        log('error', 'Failed to fetch player submissions', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// --- Admin Panel API (protected by middleware) ---
app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    log('info', `[ADMIN_ACTION] Login attempt`);
    if (password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.redirect('/admin/');
    } else {
        res.status(401).send('Incorrect password');
    }
});

app.get('/admin/logout', (req, res) => {
    log('info', `[ADMIN_ACTION] Logout`);
    req.session.destroy(() => {
        res.redirect('/admin/login.html');
    });
});

let socialStatsCache = {
    youtubeSubscribers: 0,
    youtubeViews: 0,
    telegramSubscribers: 0,
    lastUpdated: 0,
};

const updateSocialStatsCache = async () => {
    log('info', 'Updating social stats cache...');
    try {
        const config = await getGameConfig();
        const { socials } = config;
        const { YOUTUBE_API_KEY, BOT_TOKEN } = process.env;

        // Fetch YouTube Stats
        if (YOUTUBE_API_KEY && socials?.youtubeChannelId) {
            try {
                const ytResponse = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${socials.youtubeChannelId}&key=${YOUTUBE_API_KEY}`);
                const ytData = await ytResponse.json();
                if (ytData.items && ytData.items.length > 0) {
                    socialStatsCache.youtubeSubscribers = parseInt(ytData.items[0].statistics.subscriberCount, 10);
                    socialStatsCache.youtubeViews = parseInt(ytData.items[0].statistics.viewCount, 10);
                } else {
                     log('warn', 'Could not fetch YouTube stats. Check channel ID.');
                }
            } catch (ytError) {
                log('error', 'Failed to fetch YouTube stats', ytError);
            }
        } else {
             log('info', 'Skipping YouTube stats fetch (no API key or channel ID).');
        }

        // Fetch Telegram Stats
        if (BOT_TOKEN && socials?.telegramChannelId) {
            try {
                // Ensure chat_id starts with '@' if it's a username
                const chatId = socials.telegramChannelId.startsWith('@') ? socials.telegramChannelId : `@${socials.telegramChannelId}`;
                const tgResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMembersCount?chat_id=${chatId}`);
                const tgData = await tgResponse.json();
                if (tgData.ok) {
                    socialStatsCache.telegramSubscribers = tgData.result;
                } else {
                    log('warn', `Could not fetch Telegram stats: ${tgData.description}`);
                }
            } catch (tgError) {
                log('error', 'Failed to fetch Telegram stats', tgError);
            }
        } else {
             log('info', 'Skipping Telegram stats fetch (no Bot Token or channel ID).');
        }

        socialStatsCache.lastUpdated = Date.now();
        log('info', 'Social stats cache updated successfully.', socialStatsCache);
    } catch (error) {
        log('error', 'Failed to update social stats cache', error);
    }
};

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

app.post('/admin/api/translate-text', checkAdminAuth, async (req, res) => {
    if (!ai) {
        return res.status(503).json({ error: "Translation service is not available." });
    }
    try {
        const { text, targetLangs } = req.body;
        log('info', `[ADMIN_ACTION] Translate Text`, { text, targetLangs });
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
        const { customPrompt } = req.body;
        log('info', `[ADMIN_ACTION] Generate AI Content`, { customPrompt });
            
        // --- Define Schemas ---
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
        
        const taskSchema = {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "Unique ID, e.g., 'ai_task_1'" },
                name: localizedStringSchema,
                type: { type: Type.STRING, enum: ['taps', 'telegram_join', 'video_watch', 'video_code', 'youtube_subscribe', 'twitter_follow', 'instagram_follow'] },
                reward: rewardSchema,
                requiredTaps: { type: Type.INTEGER, nullable: true },
                suspicionModifier: { type: Type.INTEGER },
                url: { type: Type.STRING, nullable: true },
                secretCode: { type: Type.STRING, nullable: true },
                imageUrl: { type: Type.STRING, description: "A valid URL from api.iconify.design", nullable: true },
            },
            required: ["id", "name", "type", "reward", "suspicionModifier"]
        };

        const boostSchema = {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "Unique ID, e.g., 'ai_bst_1'" },
                name: localizedStringSchema,
                description: localizedStringSchema,
                costCoins: { type: Type.INTEGER },
                suspicionModifier: { type: Type.INTEGER },
                iconUrl: { type: Type.STRING, description: "A valid URL from api.iconify.design" },
            },
            required: ["id", "name", "description", "costCoins", "suspicionModifier", "iconUrl"]
        };

        const blackMarketCardSchema = {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "Unique ID, e.g., 'ai_bmc_1'" },
                name: localizedStringSchema,
                profitPerHour: { type: Type.INTEGER },
                chance: { type: Type.INTEGER },
                boxType: { type: Type.STRING, enum: ['coin', 'star'] },
                suspicionModifier: { type: Type.INTEGER },
                iconUrl: { type: Type.STRING, description: "A valid URL from api.iconify.design" },
            },
            required: ["id", "name", "profitPerHour", "chance", "boxType", "suspicionModifier", "iconUrl"]
        };

        const coinSkinSchema = {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "Unique ID, e.g., 'ai_skn_1'" },
                name: localizedStringSchema,
                profitBoostPercent: { type: Type.INTEGER },
                chance: { type: Type.INTEGER },
                boxType: { type: Type.STRING, enum: ['coin', 'star', 'direct'] },
                suspicionModifier: { type: Type.INTEGER },
                maxSupply: { type: Type.INTEGER, nullable: true, description: "Maximum number of this skin available. Use null for infinite." },
                iconUrl: { type: Type.STRING, description: "A valid URL for the skin image" },
            },
            required: ["id", "name", "profitBoostPercent", "chance", "boxType", "suspicionModifier", "iconUrl"]
        };

        const triggerSchema = {
            type: Type.OBJECT,
            description: "Describes what triggers the event. Use one of the allowed types and its corresponding parameters.",
            properties: {
                type: { type: Type.STRING, enum: ['meta_tap', 'login_at_time', 'balance_equals', 'upgrade_purchased'] },
                params: {
                    type: Type.OBJECT,
                    description: "Parameters for the trigger. Only populate the parameters relevant to the chosen 'type'.",
                    properties: {
                        targetId: { type: Type.STRING, nullable: true, description: "For 'meta_tap' trigger." },
                        taps: { type: Type.INTEGER, nullable: true, description: "For 'meta_tap' trigger." },
                        hour: { type: Type.INTEGER, nullable: true, description: "For 'login_at_time' trigger (UTC hour 0-23)." },
                        minute: { type: Type.INTEGER, nullable: true, description: "For 'login_at_time' trigger (minute 0-59)." },
                        amount: { type: Type.INTEGER, nullable: true, description: "For 'balance_equals' trigger." },
                        upgradeId: { type: Type.STRING, nullable: true, description: "For 'upgrade_purchased' trigger." },
                    }
                }
            },
            required: ["type", "params"]
        };

        const glitchEventSchema = {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "Unique ID, e.g., 'ai_glt_1'" },
                message: localizedStringSchema,
                code: { type: Type.STRING, description: "A 4-character uppercase code." },
                reward: rewardSchema,
                trigger: triggerSchema,
                isFinal: { type: Type.BOOLEAN, nullable: true },
            },
             required: ["id", "message", "code", "reward", "trigger"]
        };

        const finalResponseSchema = {
            type: Type.OBJECT,
            properties: {
                upgrades: { type: Type.ARRAY, items: upgradeSchema },
                tasks: { type: Type.ARRAY, items: taskSchema },
                specialTasks: { type: Type.ARRAY, items: specialTaskSchema },
                boosts: { type: Type.ARRAY, items: boostSchema },
                blackMarketCards: { type: Type.ARRAY, items: blackMarketCardSchema },
                coinSkins: { type: Type.ARRAY, items: coinSkinSchema },
                glitchEvents: { type: Type.ARRAY, items: glitchEventSchema },
            }
        };

        const fullPrompt = `You are a game designer for a Telegram clicker game called "Ukhyliant" about a draft dodger in a dystopian state. The tone is dark humor. Generate new game content based on this user prompt: "${customPrompt}". Only generate content for the categories mentioned or implied in the prompt. Ensure all generated items have unique IDs, are balanced, and fit the theme. All icon/image URLs must come from api.iconify.design. Translate all user-facing strings (name, description, message) into English (en), Ukrainian (ua), and Russian (ru).`;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: fullPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: finalResponseSchema,
            },
        });

        const jsonText = response.text.trim();
        const generatedContent = JSON.parse(jsonText);
        res.json(generatedContent);
        
    } catch (e) {
        log('error', "AI content generation failed", e);
        res.status(500).json({ error: "Failed to generate content. Check the server console." });
    }
});


// All other admin API routes need to be protected
app.use('/admin/api', checkAdminAuth);

app.get('/admin/api/config', (req, res) => {
    getGameConfig().then(config => res.json(config));
});

app.post('/admin/api/config', async (req, res) => {
    try {
        log('info', `[ADMIN_ACTION] Save Config`, { config: req.body.config });
        await saveConfig(req.body.config);
        res.sendStatus(200);
    } catch (error) {
        log('error', 'Saving config failed', error);
        res.status(500).json({ error: 'Failed to save config' });
    }
});

app.get('/admin/api/players', async (req, res) => {
    try {
        const players = await getAllPlayersForAdmin();
        res.json(players);
    } catch (error) {
        log('error', 'Fetching players failed', error);
        res.status(500).json({ error: 'Failed to fetch players' });
    }
});

app.delete('/admin/api/player/:id', async (req, res) => {
    try {
        log('info', `[ADMIN_ACTION] Delete Player`, { userId: req.params.id });
        await deletePlayer(req.params.id);
        res.sendStatus(200);
    } catch (error) {
        log('error', `Deleting player ${req.params.id} failed`, error);
        res.status(500).json({ error: 'Failed to delete player' });
    }
});

app.get('/admin/api/daily-events', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const event = await getDailyEvent(today);
    res.json(event);
});

app.post('/admin/api/daily-events', async (req, res) => {
    const { combo_ids, cipher_word, combo_reward, cipher_reward } = req.body;
    log('info', `[ADMIN_ACTION] Save Daily Events`, { combo_ids, cipher_word });
    const today = new Date().toISOString().split('T')[0];
    await saveDailyEvent(today, combo_ids, cipher_word, combo_reward, cipher_reward);
    res.sendStatus(200);
});

app.get('/admin/api/dashboard-stats', async (req, res) => {
    try {
        const stats = await getDashboardStats();
        const onlineCount = await getOnlinePlayerCount();
        res.json({ ...stats, onlineNow: onlineCount });
    } catch (error) {
        log('error', 'Fetching dashboard stats failed', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.get('/admin/api/player-locations', async (req, res) => {
    try {
        const locations = await getPlayerLocations();
        res.json(locations);
    } catch (error) {
        log('error', 'Fetching player locations failed', error);
        res.status(500).json({ error: 'Failed to fetch locations' });
    }
});

app.get('/admin/api/player/:id/details', async (req, res) => {
    const details = await getPlayerDetails(req.params.id);
    if(details) res.json(details);
    else res.sendStatus(404);
});

app.post('/admin/api/player/:id/update-balance', async (req, res) => {
    log('info', `[ADMIN_ACTION] Update Balance`, { userId: req.params.id, amount: req.body.amount });
    await updatePlayerBalance(req.params.id, req.body.amount);
    res.sendStatus(200);
});

app.post('/admin/api/player/:id/reset-daily', async(req, res) => {
    const player = await getPlayer(req.params.id);
    log('info', `[ADMIN_ACTION] Reset Daily Progress`, { userId: req.params.id });
    if(player) {
        await resetPlayerDailyProgress(req.params.id, player);
    }
    res.sendStatus(200);
});

app.get('/admin/api/cheaters', async (req, res) => {
    const cheaters = await getCheaters();
    res.json(cheaters);
});

app.post('/admin/api/player/:id/reset-progress', async (req, res) => {
    log('info', `[ADMIN_ACTION] Reset Progress`, { userId: req.params.id });
    await resetPlayerProgress(req.params.id);
    res.sendStatus(200);
});

app.post('/admin/api/socials', async (req, res) => {
    try {
        log('info', `[ADMIN_ACTION] Save Socials`, { socials: req.body });
        const config = await getGameConfig();
        config.socials = { ...config.socials, ...req.body };
        await saveConfig(config);
        // Force update cache after saving
        await updateSocialStatsCache();
        res.json(config.socials);
    } catch (error) {
        log('error', 'Saving socials failed', error);
        res.status(500).json({ error: 'Failed to save socials' });
    }
});

app.post('/admin/api/broadcast', async (req, res) => {
    const { BOT_TOKEN } = process.env;
    if (!BOT_TOKEN) {
        return res.status(500).json({ error: "Bot token not configured." });
    }

    const { text, imageUrl, buttonUrl, buttonText } = req.body;
    log('info', `[ADMIN_ACTION] Broadcast Message`, { text, imageUrl, buttonUrl, buttonText });
    const userIds = await getAllUserIds();
    let successCount = 0;
    let failCount = 0;

    log('info', `Starting broadcast to ${userIds.length} users.`);

    const sendPromises = userIds.map(userId => {
        const messagePayload = {
            chat_id: userId,
            text: text,
            parse_mode: 'HTML',
        };

        if (imageUrl) {
            messagePayload.photo = imageUrl;
            messagePayload.caption = text;
            delete messagePayload.text;
        }

        if (buttonUrl && buttonText) {
            messagePayload.reply_markup = {
                inline_keyboard: [[{ text: buttonText, url: buttonUrl }]]
            };
        }
        
        return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messagePayload)
        })
        .then(response => response.json())
        .then(data => {
            if (data.ok) {
                successCount++;
            } else {
                failCount++;
                log('warn', `Broadcast failed for user ${userId}: ${data.description}`);
            }
        })
        .catch(error => {
            failCount++;
            log('error', `Broadcast network error for user ${userId}`, error);
        });
    });
    
    // We don't wait for all promises to resolve to give a quick response to the admin
    res.status(202).json({ message: `Broadcast started for ${userIds.length} users.` });

    // Wait for all messages to be sent in the background
    Promise.all(sendPromises).then(() => {
        log('info', `Broadcast finished. Success: ${successCount}, Failed: ${failCount}`);
    });
});

app.get('/admin/api/battle/status', async (req, res) => {
    try {
        const status = await getBattleStatusForCell(null); // Get global status
        res.json({ status });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/admin/api/battle/force-start', async (req, res) => {
    try {
        log('info', `[ADMIN_ACTION] Force Start Battle`);
        const config = await getGameConfig();
        await forceStartBattle(config);
        res.sendStatus(200);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});
app.post('/admin/api/battle/force-end', async (req, res) => {
    try {
        log('info', `[ADMIN_ACTION] Force End Battle`);
        const config = await getGameConfig();
        await forceEndBattle(config);
        res.sendStatus(200);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});
app.get('/admin/api/cell-analytics', async (req, res) => {
    try {
        const analytics = await getCellAnalytics();
        res.json(analytics);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/admin/api/withdrawal-requests', async (req, res) => {
    try {
        const requests = await getWithdrawalRequestsForAdmin();
        res.json(requests);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/admin/api/withdrawal-requests/:id/approve', async (req, res) => {
    try {
        log('info', `[ADMIN_ACTION] Approve Withdrawal`, { id: req.params.id });
        await updateWithdrawalRequestStatusInDb(req.params.id, 'approved');
        res.sendStatus(200);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.post('/admin/api/withdrawal-requests/:id/reject', async (req, res) => {
     try {
        log('info', `[ADMIN_ACTION] Reject Withdrawal`, { id: req.params.id });
        await updateWithdrawalRequestStatusInDb(req.params.id, 'rejected');
        res.sendStatus(200);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.get('/admin/api/video-submissions', async (req, res) => {
    try {
        const submissions = await getAdminSubmissionsDb();
        res.json(submissions);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/admin/api/video-submissions/:id/approve', async (req, res) => {
    try {
        const { rewardAmount } = req.body;
        log('info', `[ADMIN_ACTION] Approve Video`, { id: req.params.id, rewardAmount });
        if (!rewardAmount || rewardAmount <= 0) {
            return res.status(400).json({ error: 'Invalid reward amount.' });
        }
        await approveSubmissionDb(req.params.id, rewardAmount);
        res.sendStatus(200);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.post('/admin/api/video-submissions/:id/reject', async (req, res) => {
    try {
        log('info', `[ADMIN_ACTION] Reject Video`, { id: req.params.id });
        await rejectSubmissionDb(req.params.id);
        res.sendStatus(200);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// --- Server Initialization ---
const startServer = async () => {
    await initializeDb();
    
    // Initial social stats fetch on startup
    updateSocialStatsCache();
    // Then update every 5 minutes
    setInterval(updateSocialStatsCache, 5 * 60 * 1000);

    // Initial GeoIP update on startup
    updateGeoIpData();
    // Schedule daily updates (24 hours * 60 minutes * 60 seconds * 1000 milliseconds)
    setInterval(updateGeoIpData, 24 * 60 * 60 * 1000);

    // Battle management cron job (runs every minute)
    setInterval(async () => {
        const config = await getGameConfig();
        await checkAndManageBattles(config);
    }, 60 * 1000);

    app.listen(port, () => {
        log('info', `Ukhyliant backend listening on port ${port}`);
    });
};

startServer();
