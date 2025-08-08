
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
    resetPlayerProgress,
    createCellInDb,
    joinCellInDb,
    getCellFromDb,
    leaveCellFromDb,
    recruitInformantInDb
} from './db.js';
import { 
    ADMIN_TELEGRAM_ID, MODERATOR_TELEGRAM_IDS, INITIAL_MAX_ENERGY,
    REFERRAL_PROFIT_SHARE, LOOTBOX_COST_COINS, LOOTBOX_COST_STARS, DEFAULT_COIN_SKIN_ID,
    CHEAT_DETECTION_THRESHOLD_TPS, CHEAT_DETECTION_STRIKES_TO_FLAG
} from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
if (!ai) {
    console.warn("GEMINI_API_KEY for Gemini is not set. Informant recruitment will be disabled.");
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
app.use(express.json());
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
        
        if (!user) {
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
                suspicion: 0,
                cellId: null,
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

const gameActions = {
    'buy-upgrade': async (body, player, config) => {
        const { upgradeId } = body;
        const allUpgrades = [...config.upgrades, ...config.blackMarketCards];
        const upgrade = allUpgrades.find(u => u.id === upgradeId);
        if (!upgrade) throw new Error("Upgrade not found");
        
        const currentLevel = player.upgrades[upgradeId] || 0;
        const price = calculateUpgradePrice(upgrade.price || upgrade.profitPerHour * 10, currentLevel);

        if (player.balance < price) throw new Error("Not enough coins");

        player.balance -= price;
        player.profitPerHour += upgrade.profitPerHour;
        player.upgrades[upgradeId] = currentLevel + 1;
        player.dailyUpgrades = [...new Set([...(player.dailyUpgrades || []), upgradeId])];
        player.suspicion = (player.suspicion || 0) + (upgrade.suspicionModifier || 0);

        await savePlayer(body.userId, player);
        return { player };
    },

    'buy-boost': async (body, player, config) => {
        const { boostId } = body;
        const boost = config.boosts.find(b => b.id === boostId);
        if (!boost) throw new Error("Boost not found");

        let cost = boost.costCoins;
        if (boostId === 'boost_tap_guru') {
            cost = Math.floor(boost.costCoins * Math.pow(1.5, player.tapGuruLevel || 0));
        } else if (boostId === 'boost_energy_limit') {
            cost = Math.floor(boost.costCoins * Math.pow(1.8, player.energyLimitLevel || 0));
        }

        if (player.balance < cost) throw new Error("Not enough coins");
        player.balance -= cost;

        switch(boostId) {
            case 'boost_full_energy':
                player.energy = INITIAL_MAX_ENERGY + (player.energyLimitLevel || 0) * 500;
                break;
            case 'boost_tap_guru':
                player.tapGuruLevel = (player.tapGuruLevel || 0) + 1;
                break;
            case 'boost_energy_limit':
                player.energyLimitLevel = (player.energyLimitLevel || 0) + 1;
                break;
        }
        
        player.suspicion = (player.suspicion || 0) + (boost.suspicionModifier || 0);
        await savePlayer(body.userId, player);
        return { player };
    },
    
    'claim-task': async (body) => { // Handles ONLY daily tasks
        const { userId, taskId, code } = body;
        const player = await claimDailyTaskReward(userId, taskId, code);
        return { player };
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

        const updatedPlayer = await unlockSpecialTask(userId, taskId);
        return { player: updatedPlayer };
    },

    'complete-task': async (body) => { // Handles ONLY special tasks
        const { userId, taskId, code } = body;
        const player = await completeAndRewardSpecialTask(userId, taskId, code);
        return { player };
    },

    'set-skin': async (body, player) => {
        const { skinId } = body;
        player.currentSkinId = skinId;
        await savePlayer(body.userId, player);
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
        
        // --- Daily Reset Logic ---
        const now = Date.now();
        const lastResetDate = new Date(player.lastDailyReset || 0).toDateString();
        const todayDate = new Date(now).toDateString();

        if (lastResetDate !== todayDate) {
            log('info', `Performing daily reset for user ${userId}`);
            player = await resetPlayerDailyProgress(userId);
        }
        // --- End Daily Reset Logic ---

        const result = await gameActions[action](req.body, player, config);
        res.json(result.player ? result.player : result);

    } catch (error) {
        log('error', `Action ${action} for user ${userId} failed`, error);
        res.status(400).json({ error: error.message });
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
        const result = await joinCellInDb(userId, inviteCode, config.cellMaxMembers);
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

app.get('/api/cell/my-cell', async (req, res) => {
    try {
        const { userId } = req.query;
        const player = await getPlayer(userId);
        if (!player || !player.cellId) return res.json({ cell: null });
        
        const cell = await getCellFromDb(player.cellId);
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
        
        const result = await recruitInformantInDb(userId, informantData);
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
    const stats = await getDashboardStats();
    stats.onlineNow = await getOnlinePlayerCount();
    res.json(stats);
});
app.get('/admin/api/player-locations', checkAdminAuth, async (req, res) => res.json(await getPlayerLocations()));
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
    if (Date.now() - socialStatsCache.lastUpdated > 5 * 60 * 1000) { // 5 min cache
        await updateSocialStatsCache();
    }
    res.json(socialStatsCache);
});
app.get('/admin/api/leaderboard', async (req, res) => {
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
});

// --- Server Initialization ---
const startServer = async () => {
    await initializeDb();
    await updateSocialStatsCache();
    // Update social stats every 15 minutes
    setInterval(updateSocialStatsCache, 15 * 60 * 1000);
    app.listen(port, '0.0.0.0', () => {
        log('info', `Server is running on http://0.0.0.0:${port}`);
    });
};

startServer();