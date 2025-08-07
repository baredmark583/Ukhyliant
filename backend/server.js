

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
    resetPlayerDailyProgress,
    claimDailyTaskReward,
    getLeaderboardData,
    getTotalPlayerCount,
    getPlayerDetails,
    updatePlayerBalance,
    getReferredUsersProfit,
    getCheaters,
    resetPlayerProgress
} from './db.js';
import { 
    ADMIN_TELEGRAM_ID, MODERATOR_TELEGRAM_IDS, INITIAL_MAX_ENERGY, ENERGY_REGEN_RATE, INITIAL_BOOSTS,
    REFERRAL_PROFIT_SHARE, LOOTBOX_COST_COINS, LOOTBOX_COST_STARS, DEFAULT_COIN_SKIN_ID, INITIAL_UPGRADES, INITIAL_BLACK_MARKET_CARDS, INITIAL_COIN_SKINS,
    CHEAT_DETECTION_THRESHOLD_TPS, CHEAT_DETECTION_STRIKES_TO_FLAG
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
const port = process.env.PORT || 3000;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve admin files under the /admin route. These files are inside the backend directory.
app.use('/admin', express.static(path.join(__dirname, 'public')));

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

// --- API ROUTES ---
app.post('/api/login', async (req, res) => {
    try {
        const { tgUser, startParam } = req.body;
        if (!tgUser || !tgUser.id) {
            return res.status(400).json({ error: 'Invalid Telegram user data.' });
        }
        
        const userId = String(tgUser.id);
        const userName = `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim();
        const lang = tgUser.language_code || 'en';
        
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const geo = geoip.lookup(ip);

        let user = await getUser(userId);
        let player = await getPlayer(userId);
        const config = await getGameConfig();
        
        let isNewPlayer = false;

        if (!user) {
            isNewPlayer = true;
            user = await createUser(userId, userName, lang, startParam || null);
            if (startParam) {
                await applyReferralBonus(startParam);
            }
        }
        
        // Transform user object for the client
        if (user) {
            user.referrerId = user.referrer_id;
            delete user.referrer_id;
        }
        
        if (!player) {
             const baseProfitFromReferrals = await getReferredUsersProfit(userId);
             const referralProfitPerHour = Math.floor(baseProfitFromReferrals * REFERRAL_PROFIT_SHARE);
            
            player = {
                balance: 0,
                energy: INITIAL_MAX_ENERGY,
                profitPerHour: referralProfitPerHour, // Start with referral profit
                tasksProfitPerHour: 0,
                referralProfitPerHour,
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
                unlockedSkins: [DEFAULT_COIN_SKIN_ID],
                currentSkinId: DEFAULT_COIN_SKIN_ID,
            };
            await savePlayer(userId, player);
        } else {
            // Check for daily reset
            const now = Date.now();
            const lastResetDate = new Date(player.lastDailyReset || 0).toDateString();
            const todayDate = new Date(now).toDateString();

            if (lastResetDate !== todayDate) {
                player.completedDailyTaskIds = [];
                player.dailyTaps = 0;
                player.lastDailyReset = now;
                player.claimedComboToday = false;
                player.claimedCipherToday = false;
                player.dailyUpgrades = [];
            }
        }
        
        await updateUserAccessInfo(userId, { country: geo?.country });
        
        // Fetch daily event for today
        const today = new Date().toISOString().split('T')[0];
        let dailyEventData = await getDailyEvent(today);

        // Manually map snake_case from DB to camelCase for the client
        if (dailyEventData) {
            dailyEventData = {
                // combo_ids is already expected as snake_case by the frontend
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
    try {
        const { id } = req.params;
        const playerState = req.body;
        
        // Anti-cheat check
        const oldPlayerState = await getPlayer(id);
        if (oldPlayerState) {
            const timeDiff = (Date.now() - oldPlayerState.lastLoginTimestamp) / 1000;
            const taps = playerState.dailyTaps - oldPlayerState.dailyTaps;
            if (timeDiff > 0 && taps > 0) {
                const tps = taps / timeDiff;
                if (tps > CHEAT_DETECTION_THRESHOLD_TPS) {
                    playerState.cheatStrikes = (playerState.cheatStrikes || 0) + 1;
                    playerState.cheatLog = [...(playerState.cheatLog || []), { tps, taps, timeDiff, timestamp: new Date().toISOString() }];
                    if (playerState.cheatStrikes >= CHEAT_DETECTION_STRIKES_TO_FLAG) {
                        playerState.isCheater = true;
                    }
                }
            }
        }

        await savePlayer(id, playerState);
        res.sendStatus(200);
    } catch (error) {
        log('error', `Saving player ${req.params.id} failed`, error);
        res.status(500).json({ error: 'Internal Server Error' });
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

const calculateUpgradePrice = (basePrice, level) => Math.floor(basePrice * Math.pow(1.15, level));

app.post('/api/action/:action', async (req, res) => {
    const { action } = req.params;
    const { userId, upgradeId, boostId, taskId, code, boxType, skinId, cipher } = req.body;
    
    try {
        const player = await getPlayer(userId);
        const config = await getGameConfig();
        if (!player || !config) return res.status(404).json({ error: "Player or config not found" });

        switch(action) {
            case 'buy-upgrade': {
                const allUpgrades = [...config.upgrades, ...config.blackMarketCards];
                const upgrade = allUpgrades.find(u => u.id === upgradeId);
                if (!upgrade) return res.status(404).json({ error: "Upgrade not found" });
                
                const currentLevel = player.upgrades[upgradeId] || 0;
                const price = calculateUpgradePrice(upgrade.price || upgrade.profitPerHour * 10, currentLevel);

                if (player.balance < price) return res.status(400).json({ error: "Not enough coins" });

                player.balance -= price;
                player.profitPerHour += upgrade.profitPerHour;
                player.upgrades[upgradeId] = currentLevel + 1;
                player.dailyUpgrades.push(upgradeId);

                await savePlayer(userId, player);
                return res.json(player);
            }

            case 'buy-boost': {
                const boost = config.boosts.find(b => b.id === boostId);
                if(!boost) return res.status(404).json({error: 'Boost not found'});
                
                let currentLevel = 0;
                let cost = boost.costCoins;
                
                if (boostId === 'boost_tap_guru') {
                    currentLevel = player.tapGuruLevel || 0;
                    cost = Math.floor(boost.costCoins * Math.pow(1.5, currentLevel));
                } else if (boostId === 'boost_energy_limit') {
                    currentLevel = player.energyLimitLevel || 0;
                    cost = Math.floor(boost.costCoins * Math.pow(1.8, currentLevel));
                }

                if (player.balance < cost) return res.status(400).json({ error: 'Not enough coins' });
                
                player.balance -= cost;

                if (boostId === 'boost_tap_guru') {
                    player.tapGuruLevel = (player.tapGuruLevel || 0) + 1;
                } else if (boostId === 'boost_energy_limit') {
                    player.energyLimitLevel = (player.energyLimitLevel || 0) + 1;
                } else if (boostId === 'boost_full_energy') {
                    const maxEnergy = INITIAL_MAX_ENERGY + (player.energyLimitLevel || 0) * 500;
                    player.energy = maxEnergy;
                }
                // Turbo mode is handled on the client
                
                await savePlayer(userId, player);
                return res.json(player);
            }
            
            case 'claim-task': {
                const updatedPlayer = await claimDailyTaskReward(userId, taskId, code);
                return res.json({ player: updatedPlayer });
            }
            
            case 'unlock-free-task': {
                 const updatedPlayer = await unlockSpecialTask(userId, taskId);
                 return res.json(updatedPlayer);
            }
            
            case 'complete-task': {
                const updatedPlayer = await completeAndRewardSpecialTask(userId, taskId, code);
                return res.json(updatedPlayer);
            }
            
            case 'claim-combo': {
                const result = await claimComboReward(userId);
                return res.json(result);
            }
            
            case 'claim-cipher': {
                const result = await claimCipherReward(userId, cipher);
                return res.json(result);
            }

            case 'open-lootbox': {
                 if (boxType !== 'coin') return res.status(400).json({ error: "Invalid box type." });
                 if (player.balance < LOOTBOX_COST_COINS) return res.status(400).json({ error: "Not enough coins." });
                 
                 player.balance -= LOOTBOX_COST_COINS;
                 
                 const possibleRewards = [
                     ...config.blackMarketCards.filter(c => c.boxType === 'coin'),
                     ...config.coinSkins.filter(s => s.boxType === 'coin'),
                     { itemType: 'coins', amount: Math.floor(LOOTBOX_COST_COINS * (Math.random() * 1.5 + 0.5)), chance: 30 }
                 ];
                 
                 const totalChance = possibleRewards.reduce((sum, item) => sum + item.chance, 0);
                 let random = Math.random() * totalChance;
                 let wonItem = null;
                 
                 for(const item of possibleRewards) {
                     if(random < item.chance) {
                         wonItem = item;
                         break;
                     }
                     random -= item.chance;
                 }
                 
                 if (!wonItem) wonItem = possibleRewards[0]; // Fallback
                 
                 let finalWonItem;
                 if ('profitPerHour' in wonItem) { // It's a BlackMarketCard
                    const level = (player.upgrades[wonItem.id] || 0) + 1;
                    player.upgrades[wonItem.id] = level;
                    player.profitPerHour += wonItem.profitPerHour;
                    finalWonItem = {...wonItem, itemType: 'card'};
                 } else if ('profitBoostPercent' in wonItem) { // It's a CoinSkin
                    if (!player.unlockedSkins.includes(wonItem.id)) {
                        player.unlockedSkins.push(wonItem.id);
                    }
                    finalWonItem = {...wonItem, itemType: 'skin'};
                 } else { // It's coins
                     player.balance += wonItem.amount;
                     finalWonItem = {...wonItem, itemType: 'coins', name: {en: `${wonItem.amount} Coins`, ru: `${wonItem.amount} Монет`}, iconUrl: config.uiIcons.coin};
                 }
                 
                 await savePlayer(userId, player);
                 res.json({ player, wonItem: finalWonItem });
                 break;
            }
            
            case 'set-skin': {
                if (player.unlockedSkins.includes(skinId)) {
                    player.currentSkinId = skinId;
                    await savePlayer(userId, player);
                    return res.json(player);
                }
                return res.status(400).json({ error: "Skin not unlocked" });
            }
            
            default:
                return res.status(404).json({ error: "Unknown action" });
        }
    } catch (error) {
        log('error', `Action '${action}' for user ${req.body.userId} failed`, error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});


app.post('/api/create-invoice', async (req, res) => {
    try {
        const { userId, taskId } = req.body;
        const config = await getGameConfig();
        const task = config.specialTasks.find(t => t.id === taskId);

        if (!task || task.priceStars <= 0) {
            return res.status(400).json({ ok: false, error: 'Task not found or is free.' });
        }

        const payload = JSON.stringify({ userId, taskId, type: 'specialTask' });
        const invoice = {
            title: task.name.en,
            description: task.description.en,
            payload: payload,
            provider_token: process.env.PROVIDER_TOKEN,
            currency: 'XTR',
            prices: [{ label: 'Unlock Task', amount: task.priceStars }]
        };

        const response = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/createInvoiceLink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(invoice)
        });

        const data = await response.json();
        if (data.ok) {
            res.json({ ok: true, invoiceLink: data.result });
        } else {
            log('error', 'Telegram invoice creation failed', data);
            res.status(500).json({ ok: false, error: data.description });
        }
    } catch (error) {
        log('error', 'Invoice creation failed', error);
        res.status(500).json({ ok: false, error: 'Server error creating invoice.' });
    }
});

app.post('/api/create-star-invoice', async (req, res) => {
     try {
        const { userId, boxType } = req.body;
        if (boxType !== 'star') return res.status(400).json({ok: false, error: 'Invalid box type for star payment.'});

        const payload = JSON.stringify({ userId, boxType, type: 'lootbox' });
        const invoice = {
            title: 'Star Container',
            description: 'A container with rare rewards!',
            payload: payload,
            provider_token: process.env.PROVIDER_TOKEN,
            currency: 'XTR',
            prices: [{ label: 'Container', amount: LOOTBOX_COST_STARS }]
        };

        const response = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/createInvoiceLink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(invoice)
        });

        const data = await response.json();
        if (data.ok) {
            res.json({ ok: true, invoiceLink: data.result });
        } else {
             log('error', 'Telegram star invoice creation failed', data);
            res.status(500).json({ ok: false, error: data.description });
        }
    } catch (error) {
        log('error', 'Star invoice creation failed', error);
        res.status(500).json({ ok: false, error: 'Server error creating invoice.' });
    }
});


app.post('/webhook', async (req, res) => {
    try {
        const update = req.body;
        if (update.pre_checkout_query) {
             await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/answerPreCheckoutQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true })
            });
        } else if (update.message?.successful_payment) {
            const payload = JSON.parse(update.message.successful_payment.invoice_payload);
            const { userId, taskId, boxType } = payload;
            
            if (payload.type === 'specialTask') {
                await unlockSpecialTask(userId, taskId);
            } else if (payload.type === 'lootbox' && boxType === 'star') {
                // Logic is now on client after reload, just acknowledge
                 log('info', `Star lootbox purchase successful for user ${userId}`);
            }
        }
    } catch (error) {
        log('error', 'Webhook processing error', error);
    }
    res.sendStatus(200);
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const [topPlayers, totalPlayers, config] = await Promise.all([
            getLeaderboardData(),
            getTotalPlayerCount(),
            getGameConfig(),
        ]);
        
        const sortedLeagues = [...(config?.leagues || [])].sort((a, b) => b.minProfitPerHour - a.minProfitPerHour);

        const playersWithLeagues = topPlayers.map(player => {
            const league = sortedLeagues.find(l => player.profitPerHour >= l.minProfitPerHour) || sortedLeagues[sortedLeagues.length - 1];
            return {
                ...player,
                leagueName: league?.name || {en: 'N/A', ru: 'N/A'},
                leagueIconUrl: league?.iconUrl || ''
            };
        });
        
        res.json({ topPlayers: playersWithLeagues, totalPlayers });
    } catch (error) {
        log('error', 'Failed to get leaderboard data', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// --- ADMIN ROUTES ---

app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.redirect('/admin/admin.html');
    } else {
        res.status(401).send('Incorrect password');
    }
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Could not log out.');
        }
        res.redirect('/admin/login.html');
    });
});

app.get('/admin/api/config', checkAdminAuth, async (req, res) => {
    const config = await getGameConfig();
    res.json(config);
});

app.post('/admin/api/config', checkAdminAuth, async (req, res) => {
    await saveConfig(req.body.config);
    res.sendStatus(200);
});

app.get('/admin/api/players', checkAdminAuth, async (req, res) => {
    const players = await getAllPlayersForAdmin();
     const config = await getGameConfig();
     
     const playersWithStarsSpent = players.map(player => {
         let starsSpent = 0;
         if (config.specialTasks && player.purchasedSpecialTaskIds) {
             player.purchasedSpecialTaskIds.forEach(taskId => {
                 const task = config.specialTasks.find(t => t.id === taskId);
                 if (task) starsSpent += task.priceStars;
             });
         }
         return {...player, starsSpent};
     });
    res.json(playersWithStarsSpent);
});

app.delete('/admin/api/player/:id', checkAdminAuth, async (req, res) => {
    await deletePlayer(req.params.id);
    res.sendStatus(200);
});

app.get('/admin/api/player/:id/details', checkAdminAuth, async (req, res) => {
    const details = await getPlayerDetails(req.params.id);
    res.json(details);
});

app.post('/admin/api/player/:id/update-balance', checkAdminAuth, async (req, res) => {
    await updatePlayerBalance(req.params.id, req.body.amount);
    res.sendStatus(200);
});

app.post('/admin/api/player/:id/reset-daily', checkAdminAuth, async(req, res) => {
    await resetPlayerDailyProgress(req.params.id);
    res.sendStatus(200);
});

app.get('/admin/api/daily-events', checkAdminAuth, async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const event = await getDailyEvent(today);
    res.json(event);
});

app.post('/admin/api/daily-events', checkAdminAuth, async (req, res) => {
    const { combo_ids, cipher_word, combo_reward, cipher_reward } = req.body;
    const today = new Date().toISOString().split('T')[0];
    // Backend validation to ensure combo_ids is an array.
    const comboIdsArray = Array.isArray(combo_ids) ? combo_ids : [];
    await saveDailyEvent(today, comboIdsArray, cipher_word, combo_reward, cipher_reward);
    res.sendStatus(200);
});

app.get('/admin/api/dashboard-stats', checkAdminAuth, async (req, res) => {
    const [stats, onlineCount] = await Promise.all([
        getDashboardStats(),
        getOnlinePlayerCount(),
    ]);
    res.json({ ...stats, onlineNow: onlineCount, ...socialStatsCache });
});

app.get('/admin/api/player-locations', checkAdminAuth, async (req, res) => {
    const locations = await getPlayerLocations();
    res.json(locations);
});

app.get('/admin/api/cheaters', checkAdminAuth, async(req, res) => {
    const cheaters = await getCheaters();
    res.json(cheaters);
});

app.post('/admin/api/player/:id/reset-progress', checkAdminAuth, async (req, res) => {
    await resetPlayerProgress(req.params.id);
    res.sendStatus(200);
});


// --- SERVER START ---
(async () => {
    try {
        await initializeDb();
        await updateSocialStatsCache();
        setInterval(updateSocialStatsCache, 60 * 60 * 1000); // Update every hour

        app.listen(port, () => {
            log('info', `Server is running on port ${port}`);
        });
    } catch (error) {
        log('error', "Failed to start server", error);
        process.exit(1);
    }
})();