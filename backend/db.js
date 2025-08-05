
import pg from 'pg';
import { INITIAL_BOOSTS, INITIAL_SPECIAL_TASKS, INITIAL_TASKS, INITIAL_UPGRADES, REFERRAL_BONUS } from './constants.js';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});

const executeQuery = async (query, params) => {
    const client = await pool.connect();
    try {
        return await client.query(query, params);
    } catch (error) {
        console.error('Database query error', error);
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
    
    // Safely add 'created_at' column to users table if it doesn't exist for stats tracking
    try {
        await executeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`);
        console.log("'created_at' column checked/added to 'users' table.");
    } catch (e) {
        console.error("Could not add 'created_at' column, this may fail on very old PostgreSQL versions but should be fine.", e.message);
    }


    // Seed initial config if it doesn't exist
    const res = await executeQuery('SELECT * FROM game_config WHERE key = $1', ['default']);
    if (res.rows.length === 0) {
        const initialConfig = {
            upgrades: INITIAL_UPGRADES,
            tasks: INITIAL_TASKS,
            boosts: INITIAL_BOOSTS,
            specialTasks: INITIAL_SPECIAL_TASKS
        };
        await saveConfig(initialConfig);
        console.log("Initial game config seeded to the database.");
    }
};

// --- Config Functions ---
export const getConfig = async () => {
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
export const createUser = async (id, name, language) => {
    const res = await executeQuery('INSERT INTO users (id, name, language) VALUES ($1, $2, $3) RETURNING *', [id, name, language]);
    return res.rows[0];
}
export const updateUserLanguage = async (id, language) => {
    await executeQuery('UPDATE users SET language = $1 WHERE id = $2', [language, id]);
}
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
export const completeAndRewardSpecialTask = async (userId, taskId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        const player = playerRes.rows[0].data;
        const configRes = await client.query('SELECT value FROM game_config WHERE key = $1', ['default']);
        const config = configRes.rows[0].value;
        const task = config.specialTasks.find(t => t.id === taskId);
        if (!task) throw new Error('Task not found');
        if (!player.purchasedSpecialTaskIds?.includes(taskId)) throw new Error('Task not purchased');
        if (player.completedSpecialTaskIds?.includes(taskId)) return player;
        player.balance = (player.balance || 0) + task.rewardCoins;
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
        
        // Fetch daily event WITHIN the transaction
        const eventRes = await client.query('SELECT * FROM daily_events WHERE event_date = $1', [today]);
        const dailyEvent = eventRes.rows[0];

        if (!dailyEvent) {
            throw new Error("Daily combo is not active for today.");
        }

        // Lock player row for update
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) {
            throw new Error("Player not found.");
        }
        const player = playerRes.rows[0].data;

        if (player.claimedComboToday) {
            throw new Error("Combo reward already claimed today.");
        }
        
        const comboIds = parseDbComboIds(dailyEvent);
        if (!comboIds || comboIds.length !== 3) {
            throw new Error('Daily combo is not configured correctly.');
        }

        // THE CRITICAL CHECK: happens inside the transaction on locked data
        const hasAllCards = comboIds.every(id => (player.upgrades?.[id] || 0) > 0);

        if (!hasAllCards) {
            throw new Error("You haven't purchased all the required combo cards yet.");
        }

        // All checks passed, apply the reward
        player.balance += Number(dailyEvent.combo_reward) || 0;
        player.claimedComboToday = true;
        
        const updatedRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        
        await client.query('COMMIT');
        return updatedRes.rows[0].data;
    } catch(e) {
        await client.query('ROLLBACK');
        console.error(`Claim combo reward failed for user ${userId}:`, e.message);
        // Re-throw the original error to be caught by the server route
        throw e; 
    } finally {
        client.release();
    }
}
export const claimCipherReward = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const today = new Date().toISOString().split('T')[0];
        const dailyEvent = await getDailyEvent(today);
        if (!dailyEvent) throw new Error("Daily event not found.");

        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        const player = playerRes.rows[0].data;

        if (player.claimedCipherToday) throw new Error("Cipher already claimed today.");
        
        player.balance += Number(dailyEvent.cipher_reward) || 0;
        player.claimedCipherToday = true;

        const updatedRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return updatedRes.rows[0].data;
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
        const playerData = playersMap.get(user.id);
        return {
            id: user.id,
            name: user.name || 'N/A',
            language: user.language || 'en',
            balance: playerData?.balance ?? 0,
            referrals: playerData?.referrals ?? 0
        };
    });
    allPlayers.sort((a, b) => (b.balance || 0) - (a.balance || 0));
    return allPlayers;
};
export const getDashboardStats = async () => {
    const totalPlayersRes = await executeQuery('SELECT COUNT(*) FROM users');
    // **FIXED**: Use the reliable `created_at` column instead of casting ID to a number.
    const newPlayersTodayRes = await executeQuery("SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '24 hours'");
    const totalCoinsRes = await executeQuery("SELECT SUM((data->>'balance')::numeric) as total_coins FROM players");
    
    // This is a simplified query for popular upgrades. A real implementation might need more complex tracking.
    const popularUpgradesRes = await executeQuery(`
        SELECT key as upgrade_id, COUNT(*) as purchase_count
        FROM players, jsonb_object_keys(data->'upgrades') key
        GROUP BY key
        ORDER BY purchase_count DESC
        LIMIT 5;
    `);

    return {
        totalPlayers: totalPlayersRes.rows[0].count,
        newPlayersToday: newPlayersTodayRes.rows[0].count,
        totalCoins: totalCoinsRes.rows[0].total_coins,
        popularUpgrades: popularUpgradesRes.rows
    };
};
