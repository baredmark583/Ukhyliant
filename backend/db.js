


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
    INITIAL_UI_ICONS
} from './constants.js';

const { Pool } = pg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});

const executeQuery = async (query, params) => {
    const start = Date.now();
    const client = await pool.connect();
    try {
        const result = await client.query(query, params);
        const duration = Date.now() - start;
        console.log('[DB_QUERY]', { 
            query: query.replace(/\s\s+/g, ' ').trim(), 
            params: params, 
            duration: `${duration}ms`, 
            rows: result.rowCount 
        });
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

export const initializeDb = async () => {
    // Create tables if they don't exist
    await executeQuery(`
        CREATE TABLE IF NOT EXISTS game_config (
            key VARCHAR(255) PRIMARY KEY,
            value JSONB NOT NULL
        );

        CREATE TABLE IF NOT EXISTS players (
            id VARCHAR(255) PRIMARY KEY,
            data JSONB NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255),
            language VARCHAR(10) DEFAULT 'en'
        );

        CREATE TABLE IF NOT EXISTS daily_events (
            event_date DATE PRIMARY KEY,
            combo_ids JSONB,
            cipher_word VARCHAR(255),
            combo_reward BIGINT DEFAULT 5000000,
            cipher_reward BIGINT DEFAULT 1000000
        );
    `);
    console.log("Database tables checked/created successfully.");

    // Safely add columns to daily_events table if they don't exist
    try {
        await executeQuery(`ALTER TABLE daily_events ADD COLUMN IF NOT EXISTS combo_reward BIGINT DEFAULT 5000000;`);
        await executeQuery(`ALTER TABLE daily_events ADD COLUMN IF NOT EXISTS cipher_reward BIGINT DEFAULT 1000000;`);
        console.log("Reward columns checked/added to 'daily_events' table.");
    } catch (e) {
         console.error("Could not add reward columns.", e.message);
    }
    
    // Safely add analytics columns to users table
    try {
        await executeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`);
        await executeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(2);`);
        await executeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;`);
        await executeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referrer_id VARCHAR(255);`);
        console.log("'created_at', 'country', 'last_seen', 'referrer_id' columns checked/added to 'users' table.");
    } catch (e) {
        console.error("Could not add analytics columns to 'users' table.", e.message);
    }

    const initialSocials = {
        youtubeUrl: '',
        youtubeChannelId: '',
        telegramUrl: '',
        telegramChannelId: '',
    };

    // Seed initial config if it doesn't exist
    const res = await executeQuery('SELECT * FROM game_config WHERE key = $1', ['default']);
    if (res.rows.length === 0) {
        const initialConfig = {
            upgrades: INITIAL_UPGRADES,
            tasks: INITIAL_TASKS,
            boosts: INITIAL_BOOSTS,
            specialTasks: INITIAL_SPECIAL_TASKS,
            blackMarketCards: INITIAL_BLACK_MARKET_CARDS,
            coinSkins: INITIAL_COIN_SKINS,
            leagues: INITIAL_LEAGUES,
            loadingScreenImageUrl: '',
            uiIcons: INITIAL_UI_ICONS,
            socials: initialSocials,
        };
        await saveConfig(initialConfig);
        console.log("Initial game config seeded to the database.");
    } else {
        // Ensure new config fields exist on old installations
        const config = res.rows[0].value;
        let needsUpdate = false;
        if (!config.blackMarketCards) { config.blackMarketCards = INITIAL_BLACK_MARKET_CARDS; needsUpdate = true; }
        if (!config.coinSkins) { config.coinSkins = INITIAL_COIN_SKINS; needsUpdate = true; }
        if (config.loadingScreenImageUrl === undefined) { config.loadingScreenImageUrl = ''; needsUpdate = true; }
        if (!config.leagues) { config.leagues = INITIAL_LEAGUES; needsUpdate = true; }
        if (!config.socials || config.socials.twitter !== undefined) { // Check for old structure to migrate
             config.socials = initialSocials; 
             needsUpdate = true; 
        }
        if (!config.uiIcons) { 
            config.uiIcons = INITIAL_UI_ICONS; 
            needsUpdate = true; 
        } else {
            // Check for newly added icons specifically
            if (config.uiIcons.marketCoinBox === undefined) {
                config.uiIcons.marketCoinBox = INITIAL_UI_ICONS.marketCoinBox;
                needsUpdate = true;
            }
            if (config.uiIcons.marketStarBox === undefined) {
                config.uiIcons.marketStarBox = INITIAL_UI_ICONS.marketStarBox;
                needsUpdate = true;
            }
        }
        
        if (needsUpdate) {
            await saveConfig(config);
            console.log("Updated existing game config with new fields (skins, market, loading image, leagues, icons, socials).");
        }
    }
};

// --- Config Functions ---
export const getGameConfig = async () => {
    const res = await executeQuery('SELECT value FROM game_config WHERE key = $1', ['default']);
    return res.rows[0]?.value || null;
}
export const saveConfig = async (config) => {
    await executeQuery('INSERT INTO game_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['default', config]);
}

// --- Player & User Functions ---
export const getPlayer = async (id) => {
    const res = await executeQuery('SELECT data FROM players WHERE id = $1', [id]);
    return res.rows[0]?.data || null;
}
export const savePlayer = async (id, playerData) => {
    await executeQuery('INSERT INTO players (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2', [id, playerData]);
}
export const getUser = async (id) => {
    const res = await executeQuery('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] || null;
}
export const createUser = async (id, name, language, referrerId) => {
    const res = await executeQuery('INSERT INTO users (id, name, language, referrer_id) VALUES ($1, $2, $3, $4) RETURNING *', [id, name, language, referrerId]);
    return res.rows[0];
}
export const updateUserLanguage = async (id, language) => {
    await executeQuery('UPDATE users SET language = $1 WHERE id = $2', [language, id]);
}
export const updateUserAccessInfo = async (id, { country }) => {
    await executeQuery(
        'UPDATE users SET country = COALESCE($1, country), last_seen = NOW() WHERE id = $2', 
        [country, id]
    );
};
export const getReferredUsersProfit = async (referrerId) => {
    const query = `
        SELECT SUM((p.data->>'profitPerHour')::numeric) as total_profit
        FROM players p
        JOIN users u ON p.id = u.id
        WHERE u.referrer_id = $1;
    `;
    const res = await executeQuery(query, [referrerId]);
    return res.rows[0]?.total_profit || 0;
};
export const applyReferralBonus = async (referrerId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [referrerId]);
        if (playerRes.rows.length === 0) {
            console.warn(`Referrer with ID ${referrerId} not found. Cannot apply bonus.`);
            await client.query('ROLLBACK');
            return;
        }
        const playerData = playerRes.rows[0].data;
        playerData.balance = (playerData.balance || 0) + REFERRAL_BONUS;
        playerData.referrals = (playerData.referrals || 0) + 1;
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [playerData, referrerId]);
        await client.query('COMMIT');
        console.log(`Applied referral bonus to user ${referrerId}`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Transaction failed for applyReferralBonus for referrer ${referrerId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};
export const deletePlayer = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM players WHERE id = $1', [userId]);
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        await client.query('COMMIT');
        console.log(`Deleted user and player with ID: ${userId}`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Failed to delete player ${userId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};

// --- Task Functions ---
export const unlockSpecialTask = async (userId, taskId) => {
     const query = `
        UPDATE players
        SET data = jsonb_set(
            data,
            '{purchasedSpecialTaskIds}',
            (COALESCE(data->'purchasedSpecialTaskIds', '[]'::jsonb) || $1::jsonb)
        )
        WHERE id = $2 AND NOT (data->'purchasedSpecialTaskIds' @> $1::jsonb)
        RETURNING data;
    `;
    const res = await executeQuery(query, [JSON.stringify(taskId), userId]);
    return res.rows[0]?.data;
};

const applyReward = (player, reward) => {
    if (reward.type === 'coins') {
        player.balance = (player.balance || 0) + reward.amount;
    } else if (reward.type === 'profit') {
        const baseProfit = player.profitPerHour - (player.tasksProfitPerHour || 0) - (player.referralProfitPerHour || 0);
        player.tasksProfitPerHour = (player.tasksProfitPerHour || 0) + reward.amount;
        player.profitPerHour = baseProfit + player.tasksProfitPerHour + (player.referralProfitPerHour || 0);
    }
    return player;
};

export const completeAndRewardSpecialTask = async (userId, taskId, code) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;
        const configRes = await client.query('SELECT value FROM game_config WHERE key = $1', ['default']);
        const config = configRes.rows[0].value;
        const task = config.specialTasks.find(t => t.id === taskId);
        if (!task) throw new Error('Task not found');
        if (!player.purchasedSpecialTaskIds?.includes(taskId)) throw new Error('Task not purchased');
        if (player.completedSpecialTaskIds?.includes(taskId)) return player;
        
        if (task.type === 'video_code' && task.secretCode && task.secretCode.toLowerCase() !== code?.toLowerCase()) {
            throw new Error("Incorrect secret code.");
        }

        player = applyReward(player, task.reward);
        player.completedSpecialTaskIds = [...(player.completedSpecialTaskIds || []), taskId];
        const updatedPlayerRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return updatedPlayerRes.rows[0].data;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Transaction failed in completeAndRewardSpecialTask', error);
        throw error;
    } finally {
        client.release();
    }
};

export const claimDailyTaskReward = async (userId, taskId, code) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;
        const configRes = await client.query('SELECT value FROM game_config WHERE key = $1', ['default']);
        if (configRes.rows.length === 0) throw new Error('Game config not found');
        const config = configRes.rows[0].value;
        const task = config.tasks.find(t => t.id === taskId);
        if (!task) throw new Error('Task not found in config');
        if (player.completedDailyTaskIds?.includes(taskId)) throw new Error('Task already completed today.');

        if (task.type === 'taps' && player.dailyTaps < (task.requiredTaps || 0)) {
            throw new Error('Not enough taps to claim this task.');
        }
        if (task.type === 'video_code' && task.secretCode && task.secretCode.toLowerCase() !== code?.toLowerCase()) {
            throw new Error("Incorrect secret code.");
        }

        player = applyReward(player, task.reward);
        player.completedDailyTaskIds = [...(player.completedDailyTaskIds || []), taskId];
        const updatedPlayerRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return updatedPlayerRes.rows[0].data;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Transaction failed in claimDailyTaskReward for user ${userId}, task ${taskId}`, error);
        throw error;
    } finally {
        client.release();
    }
};

// --- Daily Event Functions ---
export const getDailyEvent = async (date) => {
    const res = await executeQuery('SELECT * FROM daily_events WHERE event_date = $1', [date]);
    // The `pg` driver automatically parses the JSONB column into a JS object/array.
    return res.rows[0] || null;
}
export const saveDailyEvent = async (date, comboIds, cipherWord, comboReward, cipherReward) => {
    const comboIdsJson = JSON.stringify(comboIds || []);
    await executeQuery(
        'INSERT INTO daily_events (event_date, combo_ids, cipher_word, combo_reward, cipher_reward) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (event_date) DO UPDATE SET combo_ids = $2, cipher_word = $3, combo_reward = $4, cipher_reward = $5', 
        [date, comboIdsJson, cipherWord, comboReward, cipherReward]
    );
}

const parseDbComboIds = (event) => {
    if (!event || !event.combo_ids) return [];
    if (Array.isArray(event.combo_ids)) return event.combo_ids;
    if (typeof event.combo_ids === 'string') {
        try {
            const parsed = JSON.parse(event.combo_ids);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error('Could not parse combo_ids from DB string:', event.combo_ids);
            return [];
        }
    }
    return [];
};

export const claimComboReward = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const today = new Date().toISOString().split('T')[0];
        
        const eventRes = await client.query('SELECT * FROM daily_events WHERE event_date = $1', [today]);
        const dailyEvent = eventRes.rows[0];

        if (!dailyEvent) {
            throw new Error("Daily combo is not active for today.");
        }

        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) {
            throw new Error("Player not found.");
        }
        const player = playerRes.rows[0].data;

        if (player.claimedComboToday) {
            throw new Error("Combo reward already claimed today.");
        }
        
        const comboIds = parseDbComboIds(dailyEvent);
        if (!comboIds || !Array.isArray(comboIds) || comboIds.length !== 3) {
            throw new Error('Daily combo is not configured correctly for today.');
        }

        const hasUpgradedAllCardsToday = comboIds.every(id => {
            return player.dailyUpgrades?.includes(id);
        });

        if (!hasUpgradedAllCardsToday) {
            throw new Error("Найди и прокачай эти карты сегодня, чтобы забрать награду.");
        }
        
        const rewardAmount = Number(dailyEvent.combo_reward) || 0;
        player.balance += rewardAmount;
        player.claimedComboToday = true;
        
        const updatedRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        
        await client.query('COMMIT');
        return { player: updatedRes.rows[0].data, reward: rewardAmount };
    } catch(e) {
        await client.query('ROLLBACK');
        console.error(`Claim combo reward failed for user ${userId}:`, e.message);
        throw e; 
    } finally {
        client.release();
    }
}
export const claimCipherReward = async (userId, cipher) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const today = new Date().toISOString().split('T')[0];
        
        const eventRes = await client.query('SELECT * FROM daily_events WHERE event_date = $1', [today]);
        const dailyEvent = eventRes.rows[0];
        
        if (!dailyEvent || !dailyEvent.cipher_word) {
            throw new Error("Daily cipher is not active for today.");
        }

        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) {
            throw new Error("Player not found.");
        }
        const player = playerRes.rows[0].data;

        if (player.claimedCipherToday) {
            throw new Error("Cipher reward already claimed today.");
        }
        
        if (dailyEvent.cipher_word !== cipher) {
            throw new Error("Incorrect cipher.");
        }
        
        const rewardAmount = Number(dailyEvent.cipher_reward) || 0;
        player.balance += rewardAmount;
        player.claimedCipherToday = true;

        const updatedRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return { player: updatedRes.rows[0].data, reward: rewardAmount };
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

// --- Admin Panel Functions ---
export const getAllPlayersForAdmin = async () => {
    const usersRes = await executeQuery('SELECT id, name, language FROM users');
    const playersRes = await executeQuery('SELECT id, data FROM players');
    const playersMap = new Map(playersRes.rows.map(p => [p.id, p.data]));
    const allPlayers = usersRes.rows.map(user => {
        const playerData = playersMap.get(user.id) || {};
        return {
            id: user.id,
            name: user.name || 'N/A',
            language: user.language || 'en',
            balance: playerData.balance ?? 0,
            referrals: playerData.referrals ?? 0,
            profitPerHour: playerData.profitPerHour ?? 0,
            purchasedSpecialTaskIds: playerData.purchasedSpecialTaskIds || []
        };
    });
    allPlayers.sort((a, b) => (b.balance || 0) - (a.balance || 0));
    return allPlayers;
};
export const getDashboardStats = async () => {
    const totalPlayersRes = await executeQuery('SELECT COUNT(*) FROM users');
    const newPlayersTodayRes = await executeQuery("SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '24 hours'");
    const totalProfitRes = await executeQuery("SELECT SUM((data->>'profitPerHour')::numeric) as total_profit FROM players");
    
    const popularUpgradesRes = await executeQuery(`
        SELECT key as upgrade_id, COUNT(*) as purchase_count
        FROM players, jsonb_object_keys(data->'upgrades') key
        WHERE jsonb_typeof(data->'upgrades') = 'object'
        GROUP BY key
        ORDER BY purchase_count DESC
        LIMIT 5;
    `);

    const registrationsRes = await getDashboardRegistrations();

    const config = await getGameConfig();
    const players = await executeQuery("SELECT data FROM players");
    
    let totalStarsEarned = 0;
    if (config && config.specialTasks && players.rows.length > 0) {
        const specialTasksMap = new Map(config.specialTasks.map(t => [t.id, t.priceStars || 0]));
        for (const playerRow of players.rows) {
            const purchasedIds = playerRow.data?.purchasedSpecialTaskIds || [];
            for (const taskId of purchasedIds) {
                totalStarsEarned += specialTasksMap.get(taskId) || 0;
            }
        }
    }

    return {
        totalPlayers: totalPlayersRes.rows[0].count,
        newPlayersToday: newPlayersTodayRes.rows[0].count,
        totalProfitPerHour: totalProfitRes.rows[0].total_profit,
        popularUpgrades: popularUpgradesRes.rows,
        registrations: registrationsRes,
        totalStarsEarned,
    };
};

export const getDashboardRegistrations = async () => {
    const res = await executeQuery(`
        SELECT 
            date_trunc('day', created_at)::date as date, 
            COUNT(*) as count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY 1
        ORDER BY 1;
    `);
    return res.rows.map(r => ({ ...r, count: parseInt(r.count) }));
};

export const getOnlinePlayerCount = async () => {
    const res = await executeQuery("SELECT COUNT(*) FROM users WHERE last_seen >= NOW() - INTERVAL '5 minutes'");
    return parseInt(res.rows[0]?.count, 10) || 0;
};

export const getPlayerLocations = async () => {
    const res = await executeQuery(`
        SELECT country, COUNT(*) as player_count
        FROM users
        WHERE country IS NOT NULL AND country != ''
        GROUP BY country
    `);
    return res.rows.map(row => ({
        ...row,
        player_count: parseInt(row.player_count, 10)
    }));
};

export const getPlayerDetails = async (id) => {
    const userRes = await executeQuery('SELECT * FROM users WHERE id = $1', [id]);
    const playerRes = await executeQuery('SELECT data FROM players WHERE id = $1', [id]);
    if (!userRes.rows[0] || !playerRes.rows[0]) return null;
    return { ...userRes.rows[0], ...playerRes.rows[0].data };
};

export const updatePlayerBalance = async (id, amount) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [id]);
        if (playerRes.rows.length === 0) {
            throw new Error('Player not found');
        }
        const player = playerRes.rows[0].data;
        player.balance = (player.balance || 0) + amount;
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [player, id]);
        await client.query('COMMIT');
        return player;
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const resetPlayerDailyProgress = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) {
            throw new Error("Player not found.");
        }
        const player = playerRes.rows[0].data;

        player.claimedComboToday = false;
        player.claimedCipherToday = false;
        player.dailyUpgrades = [];
        player.completedDailyTaskIds = [];
        player.dailyTaps = 0;

        const updatedRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return updatedRes.rows[0].data;
    } catch(e) {
        await client.query('ROLLBACK');
        console.error(`Reset daily progress failed for user ${userId}:`, e.message);
        throw e;
    } finally {
        client.release();
    }
};

export const getLeaderboardData = async () => {
    const res = await executeQuery(`
        SELECT u.id, u.name, p.data->>'profitPerHour' as "profitPerHour"
        FROM users u
        JOIN players p ON u.id = p.id
        ORDER BY (p.data->>'profitPerHour')::numeric DESC
        LIMIT 10;
    `);
    return res.rows.map(row => ({
        ...row,
        profitPerHour: parseFloat(row.profitPerHour || 0),
    }));
};

export const getTotalPlayerCount = async () => {
    const res = await executeQuery('SELECT COUNT(*) FROM users');
    return parseInt(res.rows[0].count, 10);
};

export const getCheaters = async () => {
    const res = await executeQuery("SELECT u.id, u.name, p.data->'cheatLog' as cheat_log FROM users u JOIN players p ON u.id = p.id WHERE p.data->>'isCheater' = 'true'");
    return res.rows;
};

export const resetPlayerProgress = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) {
            throw new Error('Player not found');
        }
        let player = playerRes.rows[0].data;

        // Reset progress but keep identity and referrals
        player.balance = 0;
        player.profitPerHour = 0;
        player.tasksProfitPerHour = 0;
        player.upgrades = {};
        player.completedDailyTaskIds = [];
        player.purchasedSpecialTaskIds = [];
        player.completedSpecialTaskIds = [];
        player.dailyTaps = 0;
        player.tapGuruLevel = 0;
        player.energyLimitLevel = 0;
        player.unlockedSkins = [DEFAULT_COIN_SKIN_ID];
        player.currentSkinId = DEFAULT_COIN_SKIN_ID;
        
        // Reset cheat flags
        delete player.isCheater;
        delete player.cheatStrikes;
        delete player.cheatLog;
        
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [player, userId]);
        await client.query('COMMIT');
        return player;
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};
