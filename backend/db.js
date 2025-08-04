import pg from 'pg';
import { INITIAL_BOOSTS, INITIAL_SPECIAL_TASKS, INITIAL_TASKS, INITIAL_UPGRADES, REFERRAL_BONUS } from './constants.js';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
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
    const referrer = await getPlayer(referrerId);
    if (referrer) {
        referrer.balance += REFERRAL_BONUS;
        referrer.referrals = (referrer.referrals || 0) + 1;
        await savePlayer(referrerId, referrer);
        console.log(`Applied referral bonus to user ${referrerId}`);
    }
}