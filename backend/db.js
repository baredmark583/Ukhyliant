

import pg from 'pg';
import { 
    INITIAL_BOOSTS, 
    INITIAL_SPECIAL_TASKS, 
    INITIAL_TASKS, 
    INITIAL_UPGRADES, 
    REFERRAL_BONUS, 
    INITIAL_BLACK_MARKET_CARDS, 
    INITIAL_COIN_SKINS,
    DEFAULT_COIN_SKIN_ID,
    INITIAL_LEAGUES,
    INITIAL_UI_ICONS,
    INITIAL_GLITCH_EVENTS,
    CELL_CREATION_COST,
    CELL_MAX_MEMBERS,
    INFORMANT_RECRUIT_COST,
    REFERRAL_PROFIT_SHARE,
    INITIAL_MAX_ENERGY,
    MAX_ENERGY_CAP,
    LOOTBOX_COST_COINS,
    LOOTBOX_COST_STARS,
    CELL_BATTLE_TICKET_COST,
    BATTLE_SCHEDULE_DEFAULT,
    BATTLE_REWARDS_DEFAULT,
    CELL_ECONOMY_DEFAULTS,
    PENALTY_MESSAGES,
    BOOST_PURCHASE_LIMITS,
    BATTLE_BOOSTS,
    BOOST_LIMIT_RESET_COST_STARS,
} from './constants.js';

const { Pool } = pg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const executeQuery = async (query, params) => {
    const start = Date.now();
    const client = await pool.connect();
    try {
        const result = await client.query(query, params);
        const duration = Date.now() - start;
        return result;
    } catch (error) {
        const duration = Date.now() - start;
        console.error('[DB_ERROR]', { 
            query: query.replace(/\s\s+/g, ' ').trim(), 
            params: params,
            duration: `${duration}ms`,
            error: error.message
        });
        throw error;
    } finally {
        client.release();
    }
}

const applySuspicion = (player, modifier, lang = 'en') => {
    if (modifier === null || modifier === undefined || modifier === 0) return player;
    
    let currentSuspicion = Number(player.suspicion || 0);
    currentSuspicion += Number(modifier || 0);

    const maxSuspicion = 100 + (player.suspicionLimitLevel || 0) * 10;

    if (currentSuspicion >= maxSuspicion) {
        player.balance = Number(player.balance || 0) * 0.75;
        currentSuspicion = maxSuspicion / 2;
        
        const messages = PENALTY_MESSAGES[lang] || PENALTY_MESSAGES.en;
        const message = messages[Math.floor(Math.random() * messages.length)];
        
        player.penaltyLog = [...(player.penaltyLog || []), { 
            type: 'confiscation_25_percent', 
            timestamp: new Date().toISOString(),
            message: message
        }];
    }
    
    player.suspicion = Math.max(0, Math.min(maxSuspicion, currentSuspicion));
    return player;
};

const recalculatePlayerProfitInDb = async (player, config) => {
    let baseProfit = 0;
    
    const allUpgrades = [...(config.upgrades || []), ...(config.blackMarketCards || [])];
    const upgradesMap = new Map(allUpgrades.map(u => [u.id, u]));

    if (player.upgrades) {
        for (const upgradeId in player.upgrades) {
            const level = player.upgrades[upgradeId];
            const upgrade = upgradesMap.get(upgradeId);
            if (upgrade) {
                for (let i = 0; i < level; i++) {
                    baseProfit += Math.floor(upgrade.profitPerHour * Math.pow(1.07, i));
                }
            }
        }
    }

    let tasksProfit = 0;
    const allTasks = [...(config.tasks || []), ...(config.specialTasks || [])];
    const tasksMap = new Map(allTasks.map(t => [t.id, t]));
    
    const completedTaskIds = new Set([...(player.completedDailyTaskIds || []), ...(player.completedSpecialTaskIds || [])]);

    for (const taskId of completedTaskIds) {
        const task = tasksMap.get(taskId);
        if (task && task.reward && task.reward.type === 'profit') {
            tasksProfit += task.reward.amount;
        }
    }
    
    player.tasksProfitPerHour = tasksProfit;
    baseProfit += tasksProfit;

    let skinBonusPercent = 0;
    if (player.currentSkinId && config.coinSkins) {
        const currentSkin = config.coinSkins.find(s => s.id === player.currentSkinId);
        if (currentSkin) {
            skinBonusPercent = currentSkin.profitBoostPercent || 0;
        }
    }
    
    const profitWithSkinBonus = baseProfit * (1 + skinBonusPercent / 100);

    const finalProfit = profitWithSkinBonus + (player.referralProfitPerHour || 0) + (player.cellProfitBonus || 0);
    
    player.profitPerHour = finalProfit;

    return player;
};


export const initializeDb = async () => {
    await executeQuery(`
        CREATE TABLE IF NOT EXISTS game_config ( key VARCHAR(255) PRIMARY KEY, value JSONB NOT NULL );
        CREATE TABLE IF NOT EXISTS players ( id VARCHAR(255) PRIMARY KEY, data JSONB NOT NULL );
        CREATE TABLE IF NOT EXISTS users ( id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), language VARCHAR(10) DEFAULT 'en', referrer_id VARCHAR(255) );
        CREATE TABLE IF NOT EXISTS daily_events ( event_date DATE PRIMARY KEY, combo_ids JSONB, cipher_word VARCHAR(255), combo_reward BIGINT DEFAULT 5000000, cipher_reward BIGINT DEFAULT 1000000 );
        CREATE TABLE IF NOT EXISTS cells ( id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, owner_id VARCHAR(255) NOT NULL, invite_code VARCHAR(8) UNIQUE NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), balance NUMERIC(20, 4) DEFAULT 0, ticket_count INTEGER DEFAULT 0, last_profit_update TIMESTAMPTZ DEFAULT NOW() );
        CREATE TABLE IF NOT EXISTS informants ( id SERIAL PRIMARY KEY, cell_id INTEGER NOT NULL REFERENCES cells(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL, dossier TEXT NOT NULL, specialization VARCHAR(50) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() );
        CREATE TABLE IF NOT EXISTS cell_battles ( id SERIAL PRIMARY KEY, start_time TIMESTAMPTZ NOT NULL, end_time TIMESTAMPTZ NOT NULL, winner_details JSONB, rewards_distributed BOOLEAN DEFAULT FALSE );
        CREATE TABLE IF NOT EXISTS cell_battle_participants ( id SERIAL PRIMARY KEY, battle_id INTEGER NOT NULL REFERENCES cell_battles(id) ON DELETE CASCADE, cell_id INTEGER NOT NULL REFERENCES cells(id) ON DELETE CASCADE, score NUMERIC(30, 4) DEFAULT 0, active_boosts JSONB DEFAULT '{}'::jsonb, UNIQUE(battle_id, cell_id) );
        CREATE TABLE IF NOT EXISTS market_listings ( id SERIAL PRIMARY KEY, skin_id VARCHAR(255) NOT NULL, owner_id VARCHAR(255) NOT NULL, price_coins NUMERIC(20, 4) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), is_active BOOLEAN DEFAULT TRUE );
        CREATE TABLE IF NOT EXISTS withdrawal_requests ( id SERIAL PRIMARY KEY, player_id VARCHAR(255) NOT NULL, amount_credits NUMERIC(20, 4) NOT NULL, ton_wallet VARCHAR(255) NOT NULL, status VARCHAR(50) DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW(), processed_at TIMESTAMPTZ );
    `);
    console.log("Database tables checked/created successfully.");

    try {
        await executeQuery(`ALTER TABLE daily_events ADD COLUMN IF NOT EXISTS combo_reward BIGINT DEFAULT 5000000;`);
        await executeQuery(`ALTER TABLE daily_events ADD COLUMN IF NOT EXISTS cipher_reward BIGINT DEFAULT 1000000;`);
        await executeQuery(`ALTER TABLE cell_battles ADD COLUMN IF NOT EXISTS winner_details JSONB;`);
        await executeQuery(`ALTER TABLE cell_battles ADD COLUMN IF NOT EXISTS rewards_distributed BOOLEAN DEFAULT FALSE;`);
        await executeQuery(`ALTER TABLE cell_battle_participants ADD COLUMN IF NOT EXISTS active_boosts JSONB DEFAULT '{}'::jsonb;`);
        await executeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`);
        await executeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(2);`);
        await executeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;`);
        await executeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referrer_id VARCHAR(255);`);
        await executeQuery(`ALTER TABLE cells ADD COLUMN IF NOT EXISTS balance NUMERIC(20, 4) DEFAULT 0;`);
        await executeQuery(`ALTER TABLE cells ADD COLUMN IF NOT EXISTS ticket_count INTEGER DEFAULT 0;`);
        await executeQuery(`ALTER TABLE cells ADD COLUMN IF NOT EXISTS last_profit_update TIMESTAMPTZ DEFAULT NOW();`);
        console.log("Columns checked/added to tables.");
    } catch (e) {
         console.error("Could not add new columns.", e.message);
    }
    
    const initialSocials = { youtubeUrl: '', youtubeChannelId: '', telegramUrl: '', telegramChannelId: '' };

    const res = await executeQuery('SELECT * FROM game_config WHERE key = $1', ['default']);
    if (res.rows.length === 0) {
        const initialConfig = {
            upgrades: INITIAL_UPGRADES, tasks: INITIAL_TASKS, boosts: INITIAL_BOOSTS, specialTasks: INITIAL_SPECIAL_TASKS, blackMarketCards: INITIAL_BLACK_MARKET_CARDS,
            coinSkins: INITIAL_COIN_SKINS, leagues: INITIAL_LEAGUES, glitchEvents: INITIAL_GLITCH_EVENTS, loadingScreenImageUrl: '', backgroundAudioUrl: '', finalVideoUrl: '',
            uiIcons: INITIAL_UI_ICONS, socials: initialSocials, battleBoosts: BATTLE_BOOSTS, cellCreationCost: CELL_CREATION_COST, cellMaxMembers: CELL_MAX_MEMBERS,
            informantRecruitCost: INFORMANT_RECRUIT_COST, lootboxCostCoins: LOOTBOX_COST_COINS, lootboxCostStars: LOOTBOX_COST_STARS, cellBattleTicketCost: CELL_BATTLE_TICKET_COST,
            battleSchedule: BATTLE_SCHEDULE_DEFAULT, battleRewards: BATTLE_REWARDS_DEFAULT, informantProfitBonus: CELL_ECONOMY_DEFAULTS.informantProfitBonus,
            cellBankProfitShare: CELL_ECONOMY_DEFAULTS.cellBankProfitShare, boostLimitResetCostStars: BOOST_LIMIT_RESET_COST_STARS,
        };
        await saveConfig(initialConfig);
        console.log("Initial game config seeded to the database.");
    } else {
        const config = res.rows[0].value;
        let needsUpdate = false;
        
        const migrateArrayConfig = (configKey, initialArray) => {
            if (!Array.isArray(config[configKey])) { config[configKey] = []; needsUpdate = true; }
            const existingIds = new Set(config[configKey].map(item => item.id));
            initialArray.forEach(initialItem => {
                if (!existingIds.has(initialItem.id)) {
                    config[configKey].push(initialItem);
                    needsUpdate = true;
                }
            });
        };
        ['upgrades', 'tasks', 'specialTasks', 'boosts', 'blackMarketCards', 'coinSkins', 'leagues', 'battleBoosts', 'glitchEvents'].forEach(key => migrateArrayConfig(key, {upgrades: INITIAL_UPGRADES, tasks: INITIAL_TASKS, specialTasks: INITIAL_SPECIAL_TASKS, boosts: INITIAL_BOOSTS, blackMarketCards: INITIAL_BLACK_MARKET_CARDS, coinSkins: INITIAL_COIN_SKINS, leagues: INITIAL_LEAGUES, battleBoosts: BATTLE_BOOSTS, glitchEvents: INITIAL_GLITCH_EVENTS}[key]));

        const checkSingleProp = (key, initialValue) => {
            if (config[key] === undefined) { config[key] = initialValue; needsUpdate = true; }
        };
        
        checkSingleProp('loadingScreenImageUrl', ''); checkSingleProp('backgroundAudioUrl', ''); checkSingleProp('finalVideoUrl', ''); checkSingleProp('cellCreationCost', CELL_CREATION_COST);
        checkSingleProp('cellMaxMembers', CELL_MAX_MEMBERS); checkSingleProp('informantRecruitCost', INFORMANT_RECRUIT_COST); checkSingleProp('lootboxCostCoins', LOOTBOX_COST_COINS);
        checkSingleProp('lootboxCostStars', LOOTBOX_COST_STARS); checkSingleProp('cellBattleTicketCost', CELL_BATTLE_TICKET_COST); checkSingleProp('battleSchedule', BATTLE_SCHEDULE_DEFAULT);
        checkSingleProp('battleRewards', BATTLE_REWARDS_DEFAULT); checkSingleProp('informantProfitBonus', CELL_ECONOMY_DEFAULTS.informantProfitBonus);
        checkSingleProp('cellBankProfitShare', CELL_ECONOMY_DEFAULTS.cellBankProfitShare); checkSingleProp('boostLimitResetCostStars', BOOST_LIMIT_RESET_COST_STARS);
        if (!config.socials) { config.socials = initialSocials; needsUpdate = true; } if (!config.uiIcons) { config.uiIcons = INITIAL_UI_ICONS; needsUpdate = true; }

        if (needsUpdate) {
            await saveConfig(config);
            console.log("Successfully migrated and updated game config.");
        }
    }
};

// --- Config Functions ---
export const getGameConfig = async () => (await executeQuery('SELECT value FROM game_config WHERE key = $1', ['default'])).rows[0]?.value || null;
export const saveConfig = async (config) => await executeQuery('INSERT INTO game_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['default', config]);

// --- Player & User Functions ---
export const getPlayer = async (id) => (await executeQuery('SELECT data FROM players WHERE id = $1', [id])).rows[0]?.data || null;
export const savePlayer = async (id, playerData) => await executeQuery('INSERT INTO players (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2', [id, playerData]);
export const getUser = async (id) => (await executeQuery('SELECT * FROM users WHERE id = $1', [id])).rows[0] || null;
export const createUser = async (id, name, language, referrerId) => (await executeQuery('INSERT INTO users (id, name, language, referrer_id) VALUES ($1, $2, $3, $4) RETURNING *', [id, name, language, referrerId])).rows[0];
export const updateUserLanguage = async (id, language) => await executeQuery('UPDATE users SET language = $1 WHERE id = $2', [language, id]);
export const updateUserAccessInfo = async (id, { country }) => await executeQuery('UPDATE users SET country = COALESCE($1, country), last_seen = NOW() WHERE id = $2', [country, id]);

export const recalculateReferralProfit = async (referrerId) => {
    if (!referrerId) return;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const referrerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [referrerId]);
        if (referrerRes.rows.length === 0) { await client.query('ROLLBACK'); return; }
        let referrerPlayer = referrerRes.rows[0].data;
        const config = await getGameConfig();
        const referralsRes = await client.query(`SELECT id FROM users WHERE referrer_id = $1`, [referrerId]);
        const referralIds = referralsRes.rows.map(r => r.id);
        let totalReferralBaseProfit = 0;
        if (referralIds.length > 0) {
            const referralPlayersRes = await client.query(`SELECT data FROM players WHERE id = ANY($1::text[])`, [referralIds]);
            for (const row of referralPlayersRes.rows) {
                const p = row.data;
                totalReferralBaseProfit += (p.profitPerHour || 0) - (p.referralProfitPerHour || 0) - (p.cellProfitBonus || 0);
            }
        }
        referrerPlayer.referralProfitPerHour = Math.floor(totalReferralBaseProfit * REFERRAL_PROFIT_SHARE);
        referrerPlayer = await recalculatePlayerProfitInDb(referrerPlayer, config);
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [referrerPlayer, referrerId]);
        await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
};

export const applyReferralBonus = async (referrerId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [referrerId]);
        if (playerRes.rows.length === 0) { await client.query('ROLLBACK'); return; }
        const playerData = playerRes.rows[0].data;
        playerData.balance = Number(playerData.balance || 0) + REFERRAL_BONUS;
        playerData.referrals = (playerData.referrals || 0) + 1;
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [playerData, referrerId]);
        await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
};

export const deletePlayer = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM players WHERE id = $1', [userId]);
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
};

// --- Task & Event Functions ---
export const unlockSpecialTask = async (userId, taskId, config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;
        if (player.purchasedSpecialTaskIds?.includes(taskId)) { await client.query('ROLLBACK'); return player; }
        player.purchasedSpecialTaskIds = [...(player.purchasedSpecialTaskIds || []), taskId];
        const task = config.specialTasks.find(t => t.id === taskId);
        if (task) player.lastPurchaseResult = { type: 'task', item: task };
        const updatedRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return updatedRes.rows[0].data;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
};

export const completeAndRewardSpecialTask = async (userId, taskId, code) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;
        const config = await getGameConfig();
        const task = config.specialTasks.find(t => t.id === taskId);
        if (!task) throw new Error('Task not found');
        if (task.priceStars > 0 && !player.purchasedSpecialTaskIds?.includes(taskId)) throw new Error('Task not purchased');
        if (player.completedSpecialTaskIds?.includes(taskId)) { await client.query('COMMIT'); return player; }
        if (task.type === 'video_code' && task.secretCode && task.secretCode.toLowerCase() !== code?.toLowerCase()) throw new Error("Incorrect secret code.");
        if (task.reward.type === 'coins') player.balance = Number(player.balance || 0) + task.reward.amount;
        player.completedSpecialTaskIds = [...(player.completedSpecialTaskIds || []), taskId];
        player = await recalculatePlayerProfitInDb(player, config);
        const user = await getUser(userId);
        player = applySuspicion(player, task.suspicionModifier, user.language);
        const updatedPlayerRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return updatedPlayerRes.rows[0].data;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
};

export const claimDailyTaskReward = async (userId, taskId, code) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;
        const config = await getGameConfig();
        const task = config.tasks.find(t => t.id === taskId);
        if (!task) throw new Error('Task not found in config');
        if (task.type === 'taps' ? player.completedDailyTaskIds?.includes(taskId) : player.completedSpecialTaskIds?.includes(taskId)) throw new Error('Task already completed.');
        if (task.type === 'taps' && player.dailyTaps < (task.requiredTaps || 0)) throw new Error('Not enough taps to claim this task.');
        if (task.type === 'video_code' && task.secretCode && task.secretCode.toLowerCase() !== code?.toLowerCase()) throw new Error("Incorrect secret code.");
        if (task.reward.type === 'coins') player.balance = Number(player.balance || 0) + task.reward.amount;
        if (task.type === 'taps') player.completedDailyTaskIds = [...(player.completedDailyTaskIds || []), taskId]; else player.completedSpecialTaskIds = [...(player.completedSpecialTaskIds || []), taskId];
        player = await recalculatePlayerProfitInDb(player, config);
        const user = await getUser(userId);
        player = applySuspicion(player, task.suspicionModifier, user.language);
        const updatedPlayerRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return updatedPlayerRes.rows[0].data;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
};

export const claimGlitchCodeInDb = async (userId, code) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;
        const config = await getGameConfig();
        const upperCaseCode = String(code).toUpperCase();
        const event = (config.glitchEvents || []).find(e => String(e.code).toUpperCase() === upperCaseCode);
        if (!event) throw new Error('Invalid code.');
        if ((player.claimedGlitchCodes || []).map(c => String(c).toUpperCase()).includes(upperCaseCode)) throw new Error('Code already claimed.');
        if (!(player.discoveredGlitchCodes || []).map(c => String(c).toUpperCase()).includes(upperCaseCode)) throw new Error('Code has not been discovered yet.');

        if (event.reward.type === 'coins') {
            player.balance = Number(player.balance || 0) + event.reward.amount;
        }
        player.claimedGlitchCodes = [...(player.claimedGlitchCodes || []), event.code];
        player = await recalculatePlayerProfitInDb(player, config);
        
        const updatedPlayerRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return { player: updatedPlayerRes.rows[0].data, reward: event.reward };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const markGlitchAsShownInDb = async (userId, code) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;
        
        const shownCodes = new Set(player.shownGlitchCodes || []);
        if (shownCodes.has(code)) {
            await client.query('COMMIT'); // Nothing to do
            return player;
        }
        shownCodes.add(code);
        player.shownGlitchCodes = Array.from(shownCodes);
        
        const updatedPlayerRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return updatedPlayerRes.rows[0].data;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const resetPlayerDailyProgress = async (userId, player) => {
    player.lastDailyReset = Date.now();
    player.dailyTaps = 0;
    player.completedDailyTaskIds = [];
    player.claimedComboToday = false;
    player.claimedCipherToday = false;
    player.dailyBoostPurchases = {};
    await savePlayer(userId, player);
    return player;
};

export const getLeaderboardData = async () => {
    const res = await executeQuery(`
        SELECT id, data->>'name' as name, (data->>'profitPerHour')::numeric as "profitPerHour"
        FROM players
        ORDER BY "profitPerHour" DESC
        LIMIT 100
    `);
    return res.rows;
};

export const getTotalPlayerCount = async () => {
    const res = await executeQuery('SELECT COUNT(*) FROM users');
    return parseInt(res.rows[0].count, 10);
};

// --- Admin functions ---

export const getAllPlayersForAdmin = async () => {
    const res = await executeQuery(`
        SELECT 
            p.id, 
            u.name, 
            p.data->'balance' as balance, 
            p.data->'profitPerHour' as "profitPerHour", 
            p.data->'referrals' as referrals, 
            u.language, 
            p.data->'tonWalletAddress' as "tonWalletAddress"
        FROM players p 
        JOIN users u ON p.id = u.id
        ORDER BY (p.data->'balance')::numeric DESC
    `);
    return res.rows;
};

export const getPlayerDetails = async (userId) => {
    const player = await getPlayer(userId);
    const user = await getUser(userId);
    if (!player || !user) return null;
    return { ...player, ...user };
};

export const updatePlayerBalance = async (userId, amount) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;
        player.balance = (Number(player.balance) || 0) + Number(amount);
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [player, userId]);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const getCheaters = async () => {
    const res = await executeQuery(`
        SELECT u.id, u.name 
        FROM users u JOIN players p ON u.id = p.id
        WHERE p.data->>'isCheater' = 'true'
    `);
    return res.rows;
};

export const resetPlayerProgress = async (userId) => {
    const initialPlayerState = {
        balance: 0, energy: INITIAL_MAX_ENERGY, profitPerHour: 0, tasksProfitPerHour: 0,
        referralProfitPerHour: 0, cellProfitBonus: 0, coinsPerTap: 1, lastLoginTimestamp: Date.now(),
        upgrades: {}, referrals: 0, completedDailyTaskIds: [], purchasedSpecialTaskIds: [],
        completedSpecialTaskIds: [], dailyTaps: 0, lastDailyReset: Date.now(),
        claimedComboToday: false, claimedCipherToday: false, dailyUpgrades: [],
        tapGuruLevel: 0, energyLimitLevel: 0, suspicionLimitLevel: 0,
        unlockedSkins: { [DEFAULT_COIN_SKIN_ID]: 1 }, currentSkinId: DEFAULT_COIN_SKIN_ID,
        suspicion: 0, cellId: null, dailyBoostPurchases: {}, discoveredGlitchCodes: [],
        claimedGlitchCodes: [], shownGlitchCodes: [], marketCredits: 0, tonWalletAddress: "",
        forceSync: true, // Flag for client
    };
    await savePlayer(userId, initialPlayerState);
};

// ... more admin functions (daily events etc.)

export const getDailyEvent = async (date) => (await executeQuery('SELECT * FROM daily_events WHERE event_date = $1', [date])).rows[0] || null;

export const saveDailyEvent = async (date, combo_ids, cipher_word, combo_reward, cipher_reward) => {
    await executeQuery(`
        INSERT INTO daily_events (event_date, combo_ids, cipher_word, combo_reward, cipher_reward)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (event_date)
        DO UPDATE SET combo_ids = $2, cipher_word = $3, combo_reward = $4, cipher_reward = $5
    `, [date, JSON.stringify(combo_ids), cipher_word, combo_reward, cipher_reward]);
};

export const getDashboardStats = async () => {
    const statsRes = await executeQuery(`
        SELECT
            (SELECT COUNT(*) FROM users) as "totalPlayers",
            (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '24 hours') as "newPlayersToday",
            (SELECT SUM((data->>'profitPerHour')::numeric) FROM players) as "totalProfitPerHour",
            (SELECT jsonb_object_agg(upgrade_id, purchase_count) FROM (
                SELECT 
                    jsonb_object_keys(data->'upgrades') as upgrade_id,
                    SUM((data->'upgrades'->>jsonb_object_keys(data->'upgrades'))::integer) as purchase_count
                FROM players
                GROUP BY upgrade_id
                ORDER BY purchase_count DESC
                LIMIT 5
            ) as top_upgrades) as "popularUpgrades",
            (SELECT array_agg(row_to_json(t)) FROM (
                SELECT DATE(created_at) as date, COUNT(*) as count 
                FROM users 
                WHERE created_at >= NOW() - INTERVAL '7 days' 
                GROUP BY date 
                ORDER BY date
            ) t) as registrations
        FROM users
        LIMIT 1;
    `);
    // Placeholder for star stats as it's more complex (depends on payment provider integration)
    statsRes.rows[0].totalStarsEarned = 0;
    return statsRes.rows[0];
};

export const getOnlinePlayerCount = async () => {
    const res = await executeQuery("SELECT COUNT(*) FROM users WHERE last_seen >= NOW() - INTERVAL '5 minutes'");
    return res.rows[0].count;
};

export const getPlayerLocations = async () => {
    const res = await executeQuery(`
        SELECT country, COUNT(*) as player_count 
        FROM users 
        WHERE country IS NOT NULL 
        GROUP BY country
    `);
    return res.rows;
};

export const claimComboReward = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;
        if (player.claimedComboToday) throw new Error('Combo already claimed for today.');
        
        const today = new Date().toISOString().split('T')[0];
        const event = await getDailyEvent(today);
        if (!event || !event.combo_ids || event.combo_ids.length !== 3) throw new Error('No active combo today.');

        const allUpgrades = new Set(Object.keys(player.upgrades || {}));
        const hasAllCards = event.combo_ids.every(id => allUpgrades.has(id));
        if (!hasAllCards) throw new Error("You haven't purchased all the combo cards yet.");

        const reward = event.combo_reward || 5000000;
        player.balance = (Number(player.balance) || 0) + reward;
        player.claimedComboToday = true;
        
        const updatedRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return { player: updatedRes.rows[0].data, reward };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const claimCipherReward = async (userId, cipher) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;
        if (player.claimedCipherToday) throw new Error('Cipher already claimed for today.');
        
        const today = new Date().toISOString().split('T')[0];
        const event = await getDailyEvent(today);
        if (!event || !event.cipher_word) throw new Error('No active cipher today.');

        if (event.cipher_word.toUpperCase() !== cipher.toUpperCase()) {
            throw new Error('Incorrect cipher word.');
        }

        const reward = event.cipher_reward || 1000000;
        player.balance = (Number(player.balance) || 0) + reward;
        player.claimedCipherToday = true;
        
        const updatedRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return { player: updatedRes.rows[0].data, reward };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const buyUpgradeInDb = async (userId, upgradeId, config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;

        const allUpgrades = [...(config.upgrades || []), ...(config.blackMarketCards || [])];
        const upgrade = allUpgrades.find(u => u.id === upgradeId);
        if (!upgrade) throw new Error('Upgrade not found');

        const currentLevel = player.upgrades[upgradeId] || 0;
        const price = Math.floor((upgrade.price || upgrade.profitPerHour*10) * Math.pow(1.15, currentLevel));

        if (player.balance < price) throw new Error('Not enough coins');

        player.balance -= price;
        player.upgrades[upgradeId] = currentLevel + 1;
        
        const finalEvent = (config.glitchEvents || []).find(e => e.isFinal);
        if(finalEvent && finalEvent.trigger?.type === 'upgrade_purchased' && finalEvent.trigger.params.upgradeId === upgradeId) {
             if (!player.discoveredGlitchCodes?.includes(finalEvent.code)) {
                player.discoveredGlitchCodes = [...(player.discoveredGlitchCodes || []), finalEvent.code];
             }
        }

        player = await recalculatePlayerProfitInDb(player, config);
        const user = await getUser(userId);
        player = applySuspicion(player, upgrade.suspicionModifier, user.language);
        
        const updatedPlayerRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');

        const referrerId = user?.referrer_id;
        if (referrerId) {
            await recalculateReferralProfit(referrerId);
        }

        return updatedPlayerRes.rows[0].data;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const buyBoostInDb = async (userId, boostId, config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;

        const boost = config.boosts.find(b => b.id === boostId);
        if (!boost) throw new Error('Boost not found');

        const limit = BOOST_PURCHASE_LIMITS[boostId];
        const purchasesToday = player.dailyBoostPurchases?.[boostId] || 0;
        if (limit !== undefined && purchasesToday >= limit) {
            throw new Error("Daily limit for this boost has been reached.");
        }
        
        let cost = boost.costCoins;
        if (boost.id === 'boost_tap_guru') cost = Math.floor(boost.costCoins * Math.pow(1.5, player.tapGuruLevel || 0));
        else if (boost.id === 'boost_energy_limit') cost = Math.floor(boost.costCoins * Math.pow(1.8, player.energyLimitLevel || 0));
        else if (boost.id === 'boost_suspicion_limit') cost = Math.floor(boost.costCoins * Math.pow(2.0, player.suspicionLimitLevel || 0));

        if (player.balance < cost) throw new Error('Not enough coins');

        player.balance -= cost;

        if (boost.id === 'boost_full_energy') {
            const maxEnergy = INITIAL_MAX_ENERGY * Math.pow(2, player.energyLimitLevel || 0);
            player.energy = Math.min(maxEnergy, MAX_ENERGY_CAP);
        } else if (boost.id === 'boost_tap_guru') {
            player.tapGuruLevel = (player.tapGuruLevel || 0) + 1;
        } else if (boost.id === 'boost_energy_limit') {
            player.energyLimitLevel = (player.energyLimitLevel || 0) + 1;
        } else if (boost.id === 'boost_suspicion_limit') {
             player.suspicionLimitLevel = (player.suspicionLimitLevel || 0) + 1;
        }

        if (limit !== undefined) {
             if (!player.dailyBoostPurchases) player.dailyBoostPurchases = {};
             player.dailyBoostPurchases[boostId] = purchasesToday + 1;
        }
        
        const user = await getUser(userId);
        player = applySuspicion(player, boost.suspicionModifier, user.language);
        
        const updatedPlayerRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return updatedPlayerRes.rows[0].data;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const processSuccessfulPayment = async (payload, log) => {
    const client = await pool.connect();
    try {
        const [type, userId, itemId] = payload.split('-');
        if (!type || !userId || !itemId) {
            throw new Error(`Invalid payload structure: ${payload}`);
        }
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error(`Player ${userId} not found`);
        let player = playerRes.rows[0].data;
        const config = await getGameConfig();

        if (type === 'task') {
            const task = config.specialTasks.find(t => t.id === itemId);
            if (!task) throw new Error(`Task ${itemId} not found in config`);
            if (player.purchasedSpecialTaskIds?.includes(itemId)) {
                log('warn', `Player ${userId} tried to re-purchase task ${itemId}.`);
                await client.query('COMMIT');
                return;
            }
            player.purchasedSpecialTaskIds = [...(player.purchasedSpecialTaskIds || []), itemId];
            player.lastPurchaseResult = { type: 'task', item: task };
        } else if (type === 'lootbox') {
             const { updatedPlayer, wonItem } = await openLootboxInDb(userId, itemId, config, player, true);
             player = updatedPlayer;
             player.lastPurchaseResult = { type: 'lootbox', item: wonItem };
        } else if (type === 'boost_reset') {
            if (!player.dailyBoostPurchases) player.dailyBoostPurchases = {};
            player.dailyBoostPurchases[itemId] = 0;
        } else {
            throw new Error(`Unknown payload type: ${type}`);
        }

        await client.query('UPDATE players SET data = $1 WHERE id = $2', [player, userId]);
        await client.query('COMMIT');
        log('info', `Successfully processed payment for payload: ${payload}`);
    } catch(error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const listSkinForSaleInDb = async (userId, skinId, priceCoins) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error("Player not found.");
        const player = playerRes.rows[0].data;
        if (!player.unlockedSkins?.[skinId] || player.unlockedSkins[skinId] < 1) throw new Error("You do not own this skin.");
        if (skinId === DEFAULT_COIN_SKIN_ID) throw new Error("Cannot sell the default skin.");
        const price = Number(priceCoins);
        if (isNaN(price) || price <= 0) throw new Error("Invalid price.");

        player.unlockedSkins[skinId]--;
        if(player.unlockedSkins[skinId] === 0) delete player.unlockedSkins[skinId];
        
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [player, userId]);
        const newListingRes = await client.query('INSERT INTO market_listings (owner_id, skin_id, price_coins) VALUES ($1, $2, $3) RETURNING *', [userId, skinId, price]);
        
        await client.query('COMMIT');
        return newListingRes.rows[0];
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};
export const getMarketListingsFromDb = async () => {
    const res = await executeQuery(`
        SELECT ml.*, u.name as owner_name FROM market_listings ml
        JOIN users u ON ml.owner_id = u.id
        WHERE ml.is_active = TRUE ORDER BY ml.created_at DESC`);
    return res.rows;
};

export const purchaseMarketItemWithCoinsInDb = async (listingId, buyerId, config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const listingRes = await client.query('SELECT * FROM market_listings WHERE id = $1 AND is_active = TRUE FOR UPDATE', [listingId]);
        if (listingRes.rows.length === 0) throw new Error("Listing not found or already sold.");
        const listing = listingRes.rows[0];
        const { owner_id: sellerId, skin_id: skinId, price_coins: price } = listing;

        if (String(buyerId) === String(sellerId)) throw new Error("Cannot buy your own item.");

        const [buyerRes, sellerRes] = await Promise.all([
            client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [buyerId]),
            client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [sellerId])
        ]);

        if (buyerRes.rows.length === 0 || sellerRes.rows.length === 0) throw new Error("Buyer or seller not found.");
        let buyer = buyerRes.rows[0].data;
        let seller = sellerRes.rows[0].data;

        if ((Number(buyer.balance) || 0) < Number(price)) throw new Error("Insufficient coins.");

        buyer.balance = (Number(buyer.balance) || 0) - Number(price);
        seller.balance = (Number(seller.balance) || 0) + Number(price);
        
        if (!buyer.unlockedSkins) buyer.unlockedSkins = {};
        buyer.unlockedSkins[skinId] = (buyer.unlockedSkins[skinId] || 0) + 1;
        
        buyer = await recalculatePlayerProfitInDb(buyer, config);
        seller = await recalculatePlayerProfitInDb(seller, config);
        
        const skin = config.coinSkins.find(s => s.id === skinId);
        if (skin) buyer.lastPurchaseResult = { type: 'lootbox', item: skin };

        await client.query('UPDATE market_listings SET is_active = FALSE WHERE id = $1', [listingId]);
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [seller, sellerId]);
        const updatedBuyerRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [buyer, buyerId]);
        
        await client.query('COMMIT');
        return updatedBuyerRes.rows[0].data;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const connectTonWalletInDb = async (userId, walletAddress) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;
        player.tonWalletAddress = walletAddress;
        const updatedRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return updatedRes.rows[0].data;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const requestWithdrawalInDb = async (userId, amount) => {
    return { error: 'Withdrawals are not enabled yet.' };
};
export const getPlayerWithdrawalRequests = async (userId) => [];
export const getWithdrawalRequestsForAdmin = async () => [];
export const updateWithdrawalRequestStatusInDb = async (reqId, status) => ({});
export const getMarketListingById = async (id) => null;
export const getAllUserIds = async () => (await executeQuery('SELECT id FROM users')).rows.map(r => r.id);
export const getCellAnalytics = async () => ({ kpi: {}, leaderboard: [], battleHistory: [] });
export const forceStartBattle = async () => ({});
export const forceEndBattle = async () => ({});
export const checkAndManageBattles = async () => ({});
export const getBattleStatusForCell = async (cellId) => ({ isActive: false });
export const joinActiveBattle = async (userId) => ({});
export const addTapsToBattle = async (cellId, taps) => ({});
export const activateBattleBoostInDb = async (userId, boostId, config) => ({});
export const getBattleLeaderboard = async () => [];

export const createCellInDb = async (userId, name, cost) => { return {error: "Not implemented"}};
export const joinCellInDb = async (userId, inviteCode, config) => { return {error: "Not implemented"}};
export const getCellFromDb = async (cellId, config) => { return null };
export const leaveCellFromDb = async (userId) => { return {error: "Not implemented"}};
export const recruitInformantInDb = async (userId, informantData, config) => { return {error: "Not implemented"}};
export const openLootboxInDb = async (userId, boxType, config, preloadedPlayer, isStarPayment = false) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let player;
        if (preloadedPlayer) {
            player = preloadedPlayer;
        } else {
            const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
            if (playerRes.rows.length === 0) throw new Error("Player not found.");
            player = playerRes.rows[0].data;
        }

        if (!isStarPayment) {
            const cost = config.lootboxCostCoins || LOOTBOX_COST_COINS;
            const currentBalance = Number(player.balance || 0);
            if (currentBalance < cost) throw new Error("Not enough coins.");
            player.balance = currentBalance - cost;
        }

        const possibleItems = [
            ...config.blackMarketCards.filter(c => c.boxType === boxType),
            ...config.coinSkins.filter(s => s.boxType === boxType)
        ];

        if (possibleItems.length === 0) throw new Error("No items available in this lootbox.");

        const totalChance = possibleItems.reduce((sum, item) => sum + item.chance, 0);
        let random = Math.random() * totalChance;
        let wonItem = possibleItems[possibleItems.length - 1];
        for (const item of possibleItems) {
            random -= item.chance;
            if (random <= 0) {
                wonItem = item;
                break;
            }
        }
        
        if ('profitPerHour' in wonItem) {
            player.upgrades[wonItem.id] = (player.upgrades[wonItem.id] || 0) + 1;
        } else if ('profitBoostPercent' in wonItem) {
            if (!player.unlockedSkins) player.unlockedSkins = {};
            player.unlockedSkins[wonItem.id] = (player.unlockedSkins[wonItem.id] || 0) + 1;
        }

        player = await recalculatePlayerProfitInDb(player, config);
        const user = await getUser(userId);
        player = applySuspicion(player, wonItem.suspicionModifier, user.language);
        player.lastPurchaseResult = { type: 'lootbox', item: wonItem };
        
        const updatedRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return { updatedPlayer: updatedRes.rows[0].data, wonItem };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};
export const buyTicketInDb = async(userId, config) => {return {error: "Not implemented"}};