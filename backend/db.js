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
    `);
    console.log("Database tables checked/created successfully.");

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

export const getConfig = async () => {
    const res = await executeQuery('SELECT value FROM game_config WHERE key = $1', ['default']);
    return res.rows[0]?.value || null;
}

export const saveConfig = async (config) => {
    await executeQuery('INSERT INTO game_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['default', config]);
}

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
        const newBalance = (playerData.balance || 0) + REFERRAL_BONUS;
        const newReferrals = (playerData.referrals || 0) + 1;
        
        playerData.balance = newBalance;
        playerData.referrals = newReferrals;

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
        if (player.completedSpecialTaskIds?.includes(taskId)) return player; // Already completed

        const newBalance = (player.balance || 0) + task.rewardCoins;
        const newStars = (player.stars || 0) + task.rewardStars;
        const newCompletedIds = [...(player.completedSpecialTaskIds || []), taskId];
        
        const updateQuery = `
            UPDATE players
            SET data = jsonb_set(
                        jsonb_set(
                            jsonb_set(data, '{balance}', to_jsonb($1)),
                            '{stars}', to_jsonb($2)
                        ),
                        '{completedSpecialTaskIds}', $3::jsonb
                    )
            WHERE id = $4
            RETURNING data;
        `;
        const updatedPlayerRes = await client.query(updateQuery, [newBalance, newStars, JSON.stringify(newCompletedIds), userId]);
        
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
            stars: playerData?.stars ?? 0,
            referrals: playerData?.referrals ?? 0
        };
    });

    allPlayers.sort((a, b) => b.balance - a.balance);

    return allPlayers;
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
    }
};
