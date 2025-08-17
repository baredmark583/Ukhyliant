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
        // console.log('[DB_QUERY]', { 
        //     query: query.replace(/\s\s+/g, ' ').trim(), 
        //     params: params, 
        //     duration: `${duration}ms`, 
        //     rows: result.rowCount 
        // });
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

const applyReward = (player, reward) => {
    if (reward.type === 'coins') {
        player.balance = Number(player.balance || 0) + reward.amount;
    } else if (reward.type === 'profit') {
        player.profitPerHour = (player.profitPerHour || 0) + reward.amount;
        player.tasksProfitPerHour = (player.tasksProfitPerHour || 0) + reward.amount;
    }
    return player;
};

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
            language VARCHAR(10) DEFAULT 'en',
            referrer_id VARCHAR(255)
        );

        CREATE TABLE IF NOT EXISTS daily_events (
            event_date DATE PRIMARY KEY,
            combo_ids JSONB,
            cipher_word VARCHAR(255),
            combo_reward BIGINT DEFAULT 5000000,
            cipher_reward BIGINT DEFAULT 1000000
        );

        CREATE TABLE IF NOT EXISTS cells (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            owner_id VARCHAR(255) NOT NULL,
            invite_code VARCHAR(8) UNIQUE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            balance NUMERIC(20, 4) DEFAULT 0,
            ticket_count INTEGER DEFAULT 0,
            last_profit_update TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS informants (
            id SERIAL PRIMARY KEY,
            cell_id INTEGER NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            dossier TEXT NOT NULL,
            specialization VARCHAR(50) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS cell_battles (
            id SERIAL PRIMARY KEY,
            start_time TIMESTAMPTZ NOT NULL,
            end_time TIMESTAMPTZ NOT NULL,
            winner_details JSONB,
            rewards_distributed BOOLEAN DEFAULT FALSE
        );

        CREATE TABLE IF NOT EXISTS cell_battle_participants (
            id SERIAL PRIMARY KEY,
            battle_id INTEGER NOT NULL REFERENCES cell_battles(id) ON DELETE CASCADE,
            cell_id INTEGER NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
            score NUMERIC(30, 4) DEFAULT 0,
            UNIQUE(battle_id, cell_id)
        );
    `);
    console.log("Database tables checked/created successfully.");

    await executeQuery(`
        CREATE TABLE IF NOT EXISTS market_listings (
            id SERIAL PRIMARY KEY,
            skin_id VARCHAR(255) NOT NULL,
            owner_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            price_stars INTEGER NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            is_active BOOLEAN DEFAULT TRUE
        );

        CREATE TABLE IF NOT EXISTS withdrawal_requests (
            id SERIAL PRIMARY KEY,
            player_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            amount_credits NUMERIC(20, 4) NOT NULL,
            ton_wallet VARCHAR(255) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            processed_at TIMESTAMPTZ
        );
    `);
    console.log("Marketplace tables checked/created successfully.");


    // Safely add columns to daily_events table if they don't exist
    try {
        await executeQuery(`ALTER TABLE daily_events ADD COLUMN IF NOT EXISTS combo_reward BIGINT DEFAULT 5000000;`);
        await executeQuery(`ALTER TABLE daily_events ADD COLUMN IF NOT EXISTS cipher_reward BIGINT DEFAULT 1000000;`);
        await executeQuery(`ALTER TABLE cell_battles ADD COLUMN IF NOT EXISTS winner_details JSONB;`);
        await executeQuery(`ALTER TABLE cell_battles ADD COLUMN IF NOT EXISTS rewards_distributed BOOLEAN DEFAULT FALSE;`);
        console.log("Columns checked/added to tables.");
    } catch (e) {
         console.error("Could not add new columns.", e.message);
    }
    
    // Safely add analytics columns to users table
    try {
        await executeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`);
        await executeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(2);`);
        await executeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;`);
        console.log("'created_at', 'country', 'last_seen' columns checked/added to 'users' table.");
    } catch (e) {
        console.error("Could not add analytics columns to 'users' table.", e.message);
    }
    
    try {
        await executeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referrer_id VARCHAR(255);`);
        await executeQuery(`ALTER TABLE cells ADD COLUMN IF NOT EXISTS balance NUMERIC(20, 4) DEFAULT 0;`);
        await executeQuery(`ALTER TABLE cells ADD COLUMN IF NOT EXISTS ticket_count INTEGER DEFAULT 0;`);
        await executeQuery(`ALTER TABLE cells ADD COLUMN IF NOT EXISTS last_profit_update TIMESTAMPTZ DEFAULT NOW();`);
    } catch (e) {
        console.error("Could not add new columns.", e.message);
    }
    
    // Player data migration for market features
    try {
        await executeQuery(`
            UPDATE players
            SET data = jsonb_set(
                jsonb_set(data, '{marketCredits}', '0', true),
                '{tonWalletAddress}', '""', true
            )
            WHERE data->>'marketCredits' IS NULL OR data->>'tonWalletAddress' IS NULL;
        `);
        console.log("Player data migrated for market features.");
    } catch (e) {
        console.error("Could not migrate player data for market features.", e.message);
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
            glitchEvents: INITIAL_GLITCH_EVENTS,
            loadingScreenImageUrl: '',
            backgroundAudioUrl: '',
            finalVideoUrl: '',
            uiIcons: INITIAL_UI_ICONS,
            socials: initialSocials,
            cellCreationCost: CELL_CREATION_COST,
            cellMaxMembers: CELL_MAX_MEMBERS,
            informantRecruitCost: INFORMANT_RECRUIT_COST,
            lootboxCostCoins: LOOTBOX_COST_COINS,
            lootboxCostStars: LOOTBOX_COST_STARS,
            cellBattleTicketCost: CELL_BATTLE_TICKET_COST,
            battleSchedule: BATTLE_SCHEDULE_DEFAULT,
            battleRewards: BATTLE_REWARDS_DEFAULT,
            informantProfitBonus: CELL_ECONOMY_DEFAULTS.informantProfitBonus,
            cellBankProfitShare: CELL_ECONOMY_DEFAULTS.cellBankProfitShare,
        };
        await saveConfig(initialConfig);
        console.log("Initial game config seeded to the database.");
    } else {
        // --- CONFIG MIGRATION ---
        // Ensure new config fields exist on old installations with a robust method
        const config = res.rows[0].value;
        let needsUpdate = false;
        
        // Helper to migrate array-based configurations. Ensures property is an array
        // and adds any new items from constants that are missing in the DB.
        const migrateArrayConfig = (configKey, initialArray) => {
            if (!Array.isArray(config[configKey])) {
                console.warn(`Config property '${configKey}' was not an array. Resetting.`);
                config[configKey] = [];
                needsUpdate = true;
            }

            const existingIds = new Set(config[configKey].map(item => item.id));
            for (const initialItem of initialArray) {
                if (!existingIds.has(initialItem.id)) {
                    config[configKey].push(initialItem);
                    console.log(`Migrating: Added missing item '${initialItem.id}' to '${configKey}'.`);
                    needsUpdate = true;
                }
            }
        };

        // Migrate all array configs
        migrateArrayConfig('upgrades', INITIAL_UPGRADES);
        migrateArrayConfig('tasks', INITIAL_TASKS);
        migrateArrayConfig('specialTasks', INITIAL_SPECIAL_TASKS);
        migrateArrayConfig('boosts', INITIAL_BOOSTS);
        migrateArrayConfig('blackMarketCards', INITIAL_BLACK_MARKET_CARDS);
        migrateArrayConfig('coinSkins', INITIAL_COIN_SKINS);
        migrateArrayConfig('leagues', INITIAL_LEAGUES);

        // --- NEW MIGRATION for league overlay icon ---
        if (config.leagues && Array.isArray(config.leagues)) {
            let leaguesMigrated = false;
            config.leagues.forEach(league => {
                if (league.overlayIconUrl === undefined) {
                    league.overlayIconUrl = ''; // Add the new property with a default value
                    leaguesMigrated = true;
                }
            });
            if (leaguesMigrated) {
                console.log("Migrated: Added 'overlayIconUrl' property to existing leagues.");
                needsUpdate = true;
            }
        }

        // --- NEW MIGRATION for CoinSkins maxSupply ---
        if (config.coinSkins && Array.isArray(config.coinSkins)) {
            let skinsMigrated = false;
            config.coinSkins.forEach(skin => {
                if (skin.maxSupply === undefined) {
                    skin.maxSupply = null; // Use null to indicate infinite supply by default
                    skinsMigrated = true;
                }
            });
            if (skinsMigrated) {
                console.log("Migrated: Added 'maxSupply' property to existing coinSkins.");
                needsUpdate = true;
            }
        }
        
        // Special migration for glitchEvents to add triggers
        if (!config.glitchEvents) {
            config.glitchEvents = INITIAL_GLITCH_EVENTS;
            needsUpdate = true;
        } else {
            let migrated = false;
            (config.glitchEvents || []).forEach(event => {
                if (!event.trigger) {
                    migrated = true;
                    const initialEvent = INITIAL_GLITCH_EVENTS.find(e => e.id === event.id);
                    if (initialEvent) {
                        event.trigger = initialEvent.trigger;
                    } else {
                        // Assign a harmless default trigger if it's a custom event from the past
                        event.trigger = { type: 'meta_tap', params: { targetId: `disabled_${event.id}`, taps: 9999 } };
                    }
                }
                 const initialEvent = INITIAL_GLITCH_EVENTS.find(e => e.id === event.id);
                 if (initialEvent && initialEvent.isFinal && !event.hasOwnProperty('isFinal')) {
                     event.isFinal = true;
                     migrated = true;
                 }
            });
            if (migrated) {
                 console.log("Migrated glitchEvents to include new trigger/final structure.");
                 needsUpdate = true;
            }
             migrateArrayConfig('glitchEvents', INITIAL_GLITCH_EVENTS);
        }

        // Migrate all non-array (single value) properties
        const checkSingleProp = (key, initialValue) => {
            if (config[key] === undefined) {
                config[key] = initialValue;
                needsUpdate = true;
            }
        };
        
        checkSingleProp('loadingScreenImageUrl', '');
        checkSingleProp('backgroundAudioUrl', '');
        checkSingleProp('finalVideoUrl', '');
        checkSingleProp('cellCreationCost', CELL_CREATION_COST);
        checkSingleProp('cellMaxMembers', CELL_MAX_MEMBERS);
        checkSingleProp('informantRecruitCost', INFORMANT_RECRUIT_COST);
        checkSingleProp('lootboxCostCoins', LOOTBOX_COST_COINS);
        checkSingleProp('lootboxCostStars', LOOTBOX_COST_STARS);
        checkSingleProp('cellBattleTicketCost', CELL_BATTLE_TICKET_COST);
        checkSingleProp('battleSchedule', BATTLE_SCHEDULE_DEFAULT);
        checkSingleProp('battleRewards', BATTLE_REWARDS_DEFAULT);
        checkSingleProp('informantProfitBonus', CELL_ECONOMY_DEFAULTS.informantProfitBonus);
        checkSingleProp('cellBankProfitShare', CELL_ECONOMY_DEFAULTS.cellBankProfitShare);
        
        // Special object properties
        if (!config.socials) { config.socials = initialSocials; needsUpdate = true; }
        if (!config.uiIcons) { config.uiIcons = INITIAL_UI_ICONS; needsUpdate = true; }

        if (needsUpdate) {
            await saveConfig(config);
            console.log("Successfully migrated and updated game config with new fields/items.");
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

export const recalculateReferralProfit = async (referrerId) => {
    if (!referrerId) return;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Lock the referrer's player row
        const referrerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [referrerId]);
        if (referrerRes.rows.length === 0) {
            console.warn(`Referrer ${referrerId} not found, cannot update profit.`);
            await client.query('ROLLBACK');
            return;
        }
        let referrerPlayer = referrerRes.rows[0].data;

        // Get all referrals of the referrer
        const referralsRes = await client.query(`SELECT id FROM users WHERE referrer_id = $1`, [referrerId]);
        const referralIds = referralsRes.rows.map(r => r.id);

        let totalReferralBaseProfit = 0;
        if (referralIds.length > 0) {
            // Get the base profit of all referrals
            const referralPlayersRes = await client.query(`SELECT data FROM players WHERE id = ANY($1::text[])`, [referralIds]);
            for (const referralPlayerRow of referralPlayersRes.rows) {
                const referralPlayer = referralPlayerRow.data;
                // Base profit is total profit minus profit from their *own* referrals and cell bonuses
                const baseProfit = (referralPlayer.profitPerHour || 0) - (referralPlayer.referralProfitPerHour || 0) - (referralPlayer.cellProfitBonus || 0);
                totalReferralBaseProfit += baseProfit;
            }
        }
        
        const newReferralProfit = Math.floor(totalReferralBaseProfit * REFERRAL_PROFIT_SHARE);
        const oldReferralProfit = referrerPlayer.referralProfitPerHour || 0;
        
        // Update the referrer's profit
        referrerPlayer.referralProfitPerHour = newReferralProfit;
        // Total profit is base profit + new referral profit
        referrerPlayer.profitPerHour = (referrerPlayer.profitPerHour || 0) - oldReferralProfit + newReferralProfit;

        await client.query('UPDATE players SET data = $1 WHERE id = $2', [referrerPlayer, referrerId]);

        await client.query('COMMIT');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Transaction failed for recalculateReferralProfit for referrer ${referrerId}:`, error);
        throw error;
    } finally {
        client.release();
    }
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
        playerData.balance = Number(playerData.balance || 0) + REFERRAL_BONUS;
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
export const unlockSpecialTask = async (userId, taskId, config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;

        if (player.purchasedSpecialTaskIds?.includes(taskId)) {
            await client.query('ROLLBACK');
            return player; // Already purchased, do nothing
        }
        
        player.purchasedSpecialTaskIds = [...(player.purchasedSpecialTaskIds || []), taskId];

        const task = config.specialTasks.find(t => t.id === taskId);
        if (task) {
            player.lastPurchaseResult = { type: 'task', item: task };
        }
        
        const updatedRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return updatedRes.rows[0].data;

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Transaction failed in unlockSpecialTask', error);
        throw error;
    } finally {
        client.release();
    }
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
        
        // This check is now only for free tasks, star-paid tasks are pre-unlocked
        if (task.priceStars > 0 && !player.purchasedSpecialTaskIds?.includes(taskId)) {
            throw new Error('Task not purchased');
        }

        if (player.completedSpecialTaskIds?.includes(taskId)) return player;
        
        if (task.type === 'video_code' && task.secretCode && task.secretCode.toLowerCase() !== code?.toLowerCase()) {
            throw new Error("Incorrect secret code.");
        }
        
        const user = await getUser(userId);
        player = applyReward(player, task.reward);
        player = applySuspicion(player, task.suspicionModifier, user.language);
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

        // Differentiated completion check
        if (task.type === 'taps') {
            if (player.completedDailyTaskIds?.includes(taskId)) {
                throw new Error('Task already completed today.');
            }
        } else {
            if (player.completedSpecialTaskIds?.includes(taskId)) {
                throw new Error('Task already completed.');
            }
        }

        if (task.type === 'taps' && player.dailyTaps < (task.requiredTaps || 0)) {
            throw new Error('Not enough taps to claim this task.');
        }
        if (task.type === 'video_code' && task.secretCode && task.secretCode.toLowerCase() !== code?.toLowerCase()) {
            throw new Error("Incorrect secret code.");
        }

        const user = await getUser(userId);
        player = applyReward(player, task.reward);
        player = applySuspicion(player, task.suspicionModifier, user.language);

        // Differentiated completion recording
        if (task.type === 'taps') {
            player.completedDailyTaskIds = [...(player.completedDailyTaskIds || []), taskId];
        } else {
            // Treat as a one-time task, add to the permanent list
            player.completedSpecialTaskIds = [...(player.completedSpecialTaskIds || []), taskId];
        }

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
        
        const claimedCodesStr = (player.claimedGlitchCodes || []).map(c => String(c).toUpperCase());
        if (claimedCodesStr.includes(upperCaseCode)) {
            throw new Error('Code already claimed.');
        }

        const discoveredCodesStr = (player.discoveredGlitchCodes || []).map(c => String(c).toUpperCase());
        if (!discoveredCodesStr.includes(upperCaseCode)) {
             player.discoveredGlitchCodes = [...(player.discoveredGlitchCodes || []), event.code];
        }

        player = applyReward(player, event.reward);
        player.claimedGlitchCodes = [...(player.claimedGlitchCodes || []), event.code];

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

        if (!player.shownGlitchCodes) {
            player.shownGlitchCodes = [];
        }

        const codeStr = String(code);
        const alreadyShown = (player.shownGlitchCodes || []).map(String).includes(codeStr);

        if (!alreadyShown) {
            player.shownGlitchCodes.push(code);
        }

        const updatedPlayerRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return updatedPlayerRes.rows[0].data;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Transaction failed in markGlitchAsShownInDb for user ${userId}, code ${code}`, error);
        throw error;
    } finally {
        client.release();
    }
};


// --- Daily Event Functions ---
export const getDailyEvent = async (date) => {
    const res = await executeQuery('SELECT * FROM daily_events WHERE event_date = $1', [date]);
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
        
        if (player.claimedComboToday === true) {
            console.warn(`User ${userId} attempted to re-claim an already claimed combo. This might indicate a client-side state sync issue. Sending current state back to client to sync.`);
            await client.query('COMMIT'); // It was a read-only transaction up to this point, so commit is safe.
            return { player: player, reward: 0 };
        }
        
        const rewardAmount = Number(dailyEvent.combo_reward) || 0;
        player.balance = Number(player.balance || 0) + rewardAmount;
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
        player.balance = Number(player.balance || 0) + rewardAmount;
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

// --- Cell & Informant Functions ---

const generateInviteCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const updateCellBankInDb = async (cellId, client, config) => {
    const cellRes = await client.query('SELECT * FROM cells WHERE id = $1 FOR UPDATE', [cellId]);
    if (cellRes.rows.length === 0) return null;
    let cell = cellRes.rows[0];

    const membersRes = await client.query(`SELECT data->>'profitPerHour' as "profitPerHour" FROM players WHERE (data->>'cellId')::int = $1`, [cellId]);
    const totalProfitPerHour = membersRes.rows.reduce((sum, r) => sum + parseFloat(r.profitPerHour || '0'), 0);

    const now = Date.now();
    const lastUpdate = new Date(cell.last_profit_update).getTime();
    const timeDeltaSeconds = Math.max(0, Math.floor((now - lastUpdate) / 1000));
    
    if (timeDeltaSeconds > 0) {
        const bankShare = config.cellBankProfitShare ?? CELL_ECONOMY_DEFAULTS.cellBankProfitShare;
        const earnedProfit = (totalProfitPerHour * bankShare / 3600) * timeDeltaSeconds;
        const updatedCellRes = await client.query(
            'UPDATE cells SET balance = balance + $1, last_profit_update = NOW() WHERE id = $2 RETURNING *',
            [earnedProfit, cellId]
        );
        return updatedCellRes.rows[0];
    }
    return cell;
};

const recalculateCellBonusForPlayer = async (player, client, config) => {
    const oldBonus = player.cellProfitBonus || 0;
    let newBonus = 0;
    
    if (player.cellId) {
        const informantsRes = await client.query('SELECT COUNT(*) FROM informants WHERE cell_id = $1', [player.cellId]);
        const informantCount = parseInt(informantsRes.rows[0].count, 10);
        
        if (informantCount > 0) {
            const bonusPercent = config.informantProfitBonus ?? CELL_ECONOMY_DEFAULTS.informantProfitBonus;
            const baseProfit = (player.profitPerHour || 0) - (player.referralProfitPerHour || 0) - oldBonus;
            newBonus = baseProfit * informantCount * bonusPercent;
        }
    }
    
    player.profitPerHour = (player.profitPerHour || 0) - oldBonus + newBonus;
    player.cellProfitBonus = newBonus;
    
    return player;
};

export const createCellInDb = async (userId, name, cost) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let player = (await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId])).rows[0].data;
        if (!player) throw new Error("Player not found.");
        if (player.cellId) throw new Error("Player is already in a a cell.");
        
        const currentBalance = Number(player.balance || 0);
        if (currentBalance < cost) throw new Error("Not enough coins to create a cell.");
        player.balance = currentBalance - cost;

        const inviteCode = generateInviteCode();
        const cellRes = await client.query('INSERT INTO cells (name, owner_id, invite_code) VALUES ($1, $2, $3) RETURNING *', [name, userId, inviteCode]);
        const newCell = cellRes.rows[0];

        player.cellId = newCell.id;
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [player, userId]);

        await client.query('COMMIT');
        return { player, cell: await getCellFromDb(newCell.id, await getGameConfig()) };

    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const joinCellInDb = async (userId, inviteCode, config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        let player = (await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId])).rows[0].data;
        if (!player) throw new Error("Player not found.");
        if (player.cellId) throw new Error("Player is already in a cell.");

        const cellRes = await client.query('SELECT id FROM cells WHERE invite_code = $1 FOR UPDATE', [inviteCode]);
        if (cellRes.rows.length === 0) throw new Error("Invalid invite code.");
        const cellId = cellRes.rows[0].id;
        
        const memberCountRes = await client.query("SELECT COUNT(*) FROM players WHERE data->>'cellId' = $1", [String(cellId)]);
        if (parseInt(memberCountRes.rows[0].count, 10) >= config.cellMaxMembers) throw new Error("Cell is full.");

        player.cellId = cellId;
        player = await recalculateCellBonusForPlayer(player, client, config);
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [player, userId]);
        
        await client.query('COMMIT');
        return { player, cell: await getCellFromDb(cellId, config) };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const leaveCellFromDb = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let player = (await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId])).rows[0].data;
        if (!player || !player.cellId) throw new Error("Player not in a cell.");
        const config = await getGameConfig();

        player.cellId = null;
        player = await recalculateCellBonusForPlayer(player, client, config);
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [player, userId]);

        await client.query('COMMIT');
        return { player };
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const getCellFromDb = async (cellId, config) => {
    if (!cellId) return null;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let cell = await updateCellBankInDb(cellId, client, config);
        if (!cell) {
            await client.query('ROLLBACK');
            return null;
        }

        const membersRes = await client.query(`
            SELECT u.id, u.name, p.data->>'profitPerHour' as "profitPerHour"
            FROM users u JOIN players p ON u.id = p.id
            WHERE (p.data->>'cellId')::int = $1
        `, [cellId]);
        
        cell.members = membersRes.rows.map(r => ({ ...r, profitPerHour: parseFloat(r.profitPerHour || '0') }));
        cell.totalProfitPerHour = cell.members.reduce((sum, member) => sum + member.profitPerHour, 0);

        const informantsRes = await client.query('SELECT * FROM informants WHERE cell_id = $1', [cellId]);
        cell.informants = informantsRes.rows;

        await client.query('COMMIT');
        return {
            ...cell,
            balance: parseFloat(cell.balance),
            ticketCount: parseInt(cell.ticket_count, 10),
        };
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const recruitInformantInDb = async (userId, informantData, config) => {
     const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let player = (await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId])).rows[0].data;
        if (!player || !player.cellId) throw new Error("You must be in a cell to recruit informants.");
        
        const cost = config.informantRecruitCost || INFORMANT_RECRUIT_COST; 
        if (Number(player.balance || 0) < cost) throw new Error("Not enough coins to recruit an informant.");
        player.balance = Number(player.balance || 0) - cost;
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [player, userId]);
        
        const { name, dossier, specialization } = informantData;
        const informantRes = await client.query('INSERT INTO informants (cell_id, name, dossier, specialization) VALUES ($1, $2, $3, $4) RETURNING *', [player.cellId, name, dossier, specialization]);
        
        const membersRes = await client.query(`SELECT id FROM players WHERE (data->>'cellId')::int = $1`, [player.cellId]);
        for (const memberRow of membersRes.rows) {
            let memberPlayer = (await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [memberRow.id])).rows[0].data;
            memberPlayer = await recalculateCellBonusForPlayer(memberPlayer, client, config);
            await client.query('UPDATE players SET data = $1 WHERE id = $2', [memberPlayer, memberRow.id]);
        }
        
        await client.query('COMMIT');
        return { player, informant: informantRes.rows[0] };

    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const buyTicketInDb = async (userId, config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const player = await getPlayer(userId);
        if (!player || !player.cellId) throw new Error("Must be in a cell to buy a ticket.");

        let cell = await updateCellBankInDb(player.cellId, client, config);
        const cost = config.cellBattleTicketCost || CELL_BATTLE_TICKET_COST;
        if (parseFloat(cell.balance) < cost) throw new Error("Insufficient funds in cell bank.");
        
        const updatedCellRes = await client.query(
            'UPDATE cells SET balance = balance - $1, ticket_count = ticket_count + 1 WHERE id = $2 RETURNING *',
            [cost, player.cellId]
        );
        
        await client.query('COMMIT');
        return await getCellFromDb(player.cellId, config);

    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

export const openLootboxInDb = async (userId, boxType, config) => {
    if (boxType !== 'coin') throw new Error("This function only supports coin lootboxes.");
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error("Player not found.");
        let player = playerRes.rows[0].data;

        const cost = config.lootboxCostCoins || LOOTBOX_COST_COINS;
        
        const currentBalance = Number(player.balance || 0);
        if (currentBalance < cost) throw new Error("Not enough coins.");
        player.balance = currentBalance - cost;

        const allPossibleItems = [
            ...config.blackMarketCards.filter(c => c.boxType === boxType),
            ...config.coinSkins.filter(s => s.boxType === boxType && !(player.unlockedSkins || []).includes(s.id))
        ];

        // Filter out limited skins that have reached their supply cap
        const possibleItems = [];
        for (const item of allPossibleItems) {
            // Check if the item is a skin and has a limited supply
            if ('profitBoostPercent' in item && item.maxSupply && item.maxSupply > 0) {
                const supplyCheckRes = await client.query(
                    `SELECT count(*) FROM players WHERE data->'unlockedSkins' @> $1::jsonb`,
                    [JSON.stringify(item.id)]
                );
                const circulatingSupply = parseInt(supplyCheckRes.rows[0].count, 10);
                
                if (circulatingSupply < item.maxSupply) {
                    possibleItems.push(item);
                }
            } else {
                // It's a card or an unlimited skin, add it to the pool
                possibleItems.push(item);
            }
        }
        
        if (possibleItems.length === 0) {
            await client.query('COMMIT'); // Commit the cost deduction even if no items are available
            throw new Error("No new items available in this lootbox type for you.");
        }

        const totalChance = possibleItems.reduce((sum, item) => sum + item.chance, 0);
        let random = Math.random() * totalChance;
        
        let wonItem = null;
        for (const item of possibleItems) {
            random -= item.chance;
            if (random <= 0) {
                wonItem = item;
                break;
            }
        }
        
        if (!wonItem) wonItem = possibleItems[possibleItems.length - 1]; // Fallback

        if ('profitPerHour' in wonItem) { // It's a BlackMarketCard
            const cardId = wonItem.id;
            const currentLevel = player.upgrades[cardId] || 0;
            player.upgrades[cardId] = currentLevel + 1;
            const profitGained = Math.floor(wonItem.profitPerHour * Math.pow(1.07, currentLevel));
            player.profitPerHour = (player.profitPerHour || 0) + profitGained;
            
            const userRes = await client.query('SELECT referrer_id FROM users WHERE id = $1', [userId]);
            const referrerId = userRes.rows[0]?.referrer_id;
            if (referrerId) {
                // This is a quick update. A full recalculation should happen on the referrer's next action.
                await recalculateReferralProfit(referrerId);
            }

        } else if ('profitBoostPercent' in wonItem) { // It's a CoinSkin
            player.unlockedSkins = [...new Set([...(player.unlockedSkins || []), wonItem.id])];
        }

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

const grantStarLootboxItem = async (userId, config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error("Player not found.");
        let player = playerRes.rows[0].data;

        // No cost deduction, as payment is handled by Telegram Stars

        const allPossibleItems = [
            ...config.blackMarketCards.filter(c => c.boxType === 'star'),
            ...config.coinSkins.filter(s => s.boxType === 'star' && !(player.unlockedSkins || []).includes(s.id))
        ];

        // Filter out limited skins that have reached their supply cap
        const possibleItems = [];
        for (const item of allPossibleItems) {
            if ('profitBoostPercent' in item && item.maxSupply && item.maxSupply > 0) {
                const supplyCheckRes = await client.query(
                    `SELECT count(*) FROM players WHERE data->'unlockedSkins' @> $1::jsonb`,
                    [JSON.stringify(item.id)]
                );
                const circulatingSupply = parseInt(supplyCheckRes.rows[0].count, 10);
                if (circulatingSupply < item.maxSupply) {
                    possibleItems.push(item);
                }
            } else {
                possibleItems.push(item);
            }
        }
        
        if (possibleItems.length === 0) {
            // This is an issue, we should probably refund or notify. For now, just log it.
            console.error(`User ${userId} paid for a star lootbox, but no items were available.`);
            await client.query('COMMIT'); 
            return;
        }

        const totalChance = possibleItems.reduce((sum, item) => sum + item.chance, 0);
        let random = Math.random() * totalChance;
        
        let wonItem = null;
        for (const item of possibleItems) {
            random -= item.chance;
            if (random <= 0) {
                wonItem = item;
                break;
            }
        }
        
        if (!wonItem) wonItem = possibleItems[possibleItems.length - 1]; // Fallback

        if ('profitPerHour' in wonItem) { // It's a BlackMarketCard
            const cardId = wonItem.id;
            const currentLevel = player.upgrades[cardId] || 0;
            player.upgrades[cardId] = currentLevel + 1;
            const profitGained = Math.floor(wonItem.profitPerHour * Math.pow(1.07, currentLevel));
            player.profitPerHour = (player.profitPerHour || 0) + profitGained;
            
            const userRes = await client.query('SELECT referrer_id FROM users WHERE id = $1', [userId]);
            const referrerId = userRes.rows[0]?.referrer_id;
            if (referrerId) {
                await recalculateReferralProfit(referrerId);
            }

        } else if ('profitBoostPercent' in wonItem) { // It's a CoinSkin
            player.unlockedSkins = [...new Set([...(player.unlockedSkins || []), wonItem.id])];
        }

        const user = await getUser(userId);
        player = applySuspicion(player, wonItem.suspicionModifier, user.language);
        
        player.purchasedStarLootboxesCount = (player.purchasedStarLootboxesCount || 0) + 1;
        player.lastPurchaseResult = { type: 'lootbox', item: wonItem };

        await client.query('UPDATE players SET data = $1 WHERE id = $2', [player, userId]);
        
        await client.query('COMMIT');
        console.log(`Granted star lootbox item ${wonItem.id} to user ${userId}`);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(`Failed to grant star lootbox item to user ${userId}`, e);
        throw e;
    } finally {
        client.release();
    }
};

export const processSuccessfulPayment = async (payload, log) => {
    // Payloads:
    // Task: task-USERID-TASKID
    // Lootbox: lootbox-USERID-BOXTYPE (star)
    // Market: market_purchase-BUYERID-LISTINGID
    const [type, userId, itemId] = payload.split('-');

    if (!type || !userId || !itemId) {
        throw new Error(`Invalid payload structure: ${payload}`);
    }

    const config = await getGameConfig();

    if (type === 'task') {
        const taskId = itemId;
        log('info', `Processing task unlock for user ${userId}, task ${taskId}`);
        await unlockSpecialTask(userId, taskId, config);
    } else if (type === 'lootbox') {
        const boxType = itemId;
        if (boxType === 'star') {
            log('info', `Processing star lootbox grant for user ${userId}`);
            await grantStarLootboxItem(userId, config);
        } else {
             throw new Error(`Unsupported lootbox type in payload: ${boxType}`);
        }
    } else if (type === 'market_purchase') {
        const buyerId = userId;
        const listingId = itemId;
        log('info', `Processing market purchase for buyer ${buyerId}, listing ${listingId}`);
        await processMarketPurchaseInDb(listingId, buyerId, config);
    } else {
        throw new Error(`Unknown payload type: ${type}`);
    }
};

// --- Marketplace DB Functions ---
export const getMarketListingById = async (listingId) => {
    const res = await executeQuery('SELECT * FROM market_listings WHERE id = $1', [listingId]);
    return res.rows[0] || null;
};

export const listSkinForSaleInDb = async (ownerId, skinId, priceStars) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [ownerId]);
        if (playerRes.rows.length === 0) throw new Error("Player not found.");
        const player = playerRes.rows[0].data;

        if (!player.unlockedSkins?.includes(skinId)) throw new Error("You do not own this skin.");
        if (skinId === DEFAULT_COIN_SKIN_ID) throw new Error("Cannot sell the default skin.");

        const existingListingRes = await client.query('SELECT id FROM market_listings WHERE owner_id = $1 AND skin_id = $2 AND is_active = TRUE', [ownerId, skinId]);
        if (existingListingRes.rows.length > 0) throw new Error("You have already listed this skin for sale.");
        
        const price = parseInt(priceStars, 10);
        if (isNaN(price) || price <= 0) throw new Error("Invalid price.");

        const newListingRes = await client.query('INSERT INTO market_listings (owner_id, skin_id, price_stars) VALUES ($1, $2, $3) RETURNING *', [ownerId, skinId, price]);
        
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
        SELECT ml.id, ml.skin_id, ml.owner_id, ml.price_stars, u.name as owner_name
        FROM market_listings ml
        JOIN users u ON ml.owner_id = u.id
        WHERE ml.is_active = TRUE
        ORDER BY ml.created_at DESC
    `);
    return res.rows;
};

export const connectTonWalletInDb = async (userId, walletAddress) => {
    const player = await getPlayer(userId);
    if (!player) throw new Error("Player not found.");
    player.tonWalletAddress = walletAddress;
    await savePlayer(userId, player);
    return player;
};

export const requestWithdrawalInDb = async (userId, amountCredits) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error("Player not found.");
        let player = playerRes.rows[0].data;

        const amount = Number(amountCredits);
        if (isNaN(amount) || amount <= 0) throw new Error("Invalid withdrawal amount.");
        if (!player.tonWalletAddress) throw new Error("TON wallet is not connected.");
        if ((player.marketCredits || 0) < amount) throw new Error("Insufficient market credits.");
        
        player.marketCredits -= amount;
        
        await client.query('INSERT INTO withdrawal_requests (player_id, amount_credits, ton_wallet) VALUES ($1, $2, $3)', [userId, amount, player.tonWalletAddress]);
        
        const updatedPlayerRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return updatedPlayerRes.rows[0].data;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const getPlayerWithdrawalRequests = async (userId) => {
    const res = await executeQuery('SELECT * FROM withdrawal_requests WHERE player_id = $1 ORDER BY created_at DESC', [userId]);
    return res.rows;
};

export const processMarketPurchaseInDb = async (listingId, buyerId, config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const listingRes = await client.query('SELECT * FROM market_listings WHERE id = $1 AND is_active = TRUE FOR UPDATE', [listingId]);
        if (listingRes.rows.length === 0) throw new Error("Listing not found or already sold.");
        const listing = listingRes.rows[0];
        const { owner_id: sellerId, skin_id: skinId, price_stars: price } = listing;

        if (buyerId === sellerId) throw new Error("Cannot buy your own item.");

        const sellerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [sellerId]);
        const buyerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [buyerId]);

        if (sellerRes.rows.length === 0 || buyerRes.rows.length === 0) throw new Error("Buyer or seller not found.");
        let seller = sellerRes.rows[0].data;
        let buyer = buyerRes.rows[0].data;

        // 1. Transfer skin
        if (!seller.unlockedSkins?.includes(skinId)) throw new Error("Seller does not own the skin to sell.");
        seller.unlockedSkins = seller.unlockedSkins.filter(id => id !== skinId);
        buyer.unlockedSkins = [...new Set([...(buyer.unlockedSkins || []), skinId])];

        // 2. Add market credits to seller
        seller.marketCredits = (seller.marketCredits || 0) + price;
        
        // 3. Set last purchase result for buyer
        const skin = config.coinSkins.find(s => s.id === skinId);
        buyer.lastPurchaseResult = { type: 'lootbox', item: skin }; // Re-use lootbox type for UI modal

        // 4. Deactivate listing
        await client.query('UPDATE market_listings SET is_active = FALSE WHERE id = $1', [listingId]);
        
        // 5. Save players
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [seller, sellerId]);
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [buyer, buyerId]);

        await client.query('COMMIT');
        console.log(`Market purchase complete: Buyer ${buyerId} bought skin ${skinId} from seller ${sellerId} for ${price} stars.`);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Market purchase transaction failed', e);
        throw e;
    } finally {
        client.release();
    }
};

export const getWithdrawalRequestsForAdmin = async () => {
    const res = await executeQuery(`
        SELECT wr.id, wr.player_id, u.name as player_name, wr.amount_credits, wr.ton_wallet, wr.status, wr.created_at
        FROM withdrawal_requests wr
        JOIN users u ON wr.player_id = u.id
        ORDER BY wr.created_at DESC
    `);
    return res.rows;
};

export const updateWithdrawalRequestStatusInDb = async (requestId, status) => {
    if (!['approved', 'rejected'].includes(status)) throw new Error("Invalid status.");
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const reqRes = await client.query('SELECT * FROM withdrawal_requests WHERE id = $1 AND status = \'pending\' FOR UPDATE', [requestId]);
        if (reqRes.rows.length === 0) throw new Error("Request not found or already processed.");
        const request = reqRes.rows[0];

        if (status === 'rejected') {
            // Refund credits
            await client.query(`
                UPDATE players SET data = jsonb_set(data, '{marketCredits}', ((data->>'marketCredits')::numeric + $1)::text::jsonb)
                WHERE id = $2
            `, [request.amount_credits, request.player_id]);
        }

        await client.query('UPDATE withdrawal_requests SET status = $1, processed_at = NOW() WHERE id = $2', [status, requestId]);
        await client.query('COMMIT');
        return { success: true };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

// --- Admin Panel Functions ---
export const getAllPlayersForAdmin = async () => {
    const usersRes = await executeQuery('SELECT id, name, language FROM users');
    const playersRes = await executeQuery('SELECT id, data FROM players');
    const playersMap = new Map(playersRes.rows.map(p => [p.id, p.data]));
    const allPlayers = usersRes.rows.map(user => {
        const playerData = playersMap.get(user.id) || {};
        const effectiveBalance = (Number(playerData.balance) || 0) + (Number(playerData.adminBonus) || 0);
        return {
            id: user.id,
            name: user.name || 'N/A',
            language: user.language || 'en',
            balance: effectiveBalance,
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
    
    let totalStarsSpent = 0;
    if (config && players.rows.length > 0) {
        const specialTasksMap = new Map(config.specialTasks?.map(t => [t.id, t.priceStars || 0]) || []);
        
        for (const playerRow of players.rows) {
            const player = playerRow.data;
            if (!player) continue;

            // Add stars from special tasks
            const purchasedTaskIds = player.purchasedSpecialTaskIds || [];
            for (const taskId of purchasedTaskIds) {
                totalStarsSpent += specialTasksMap.get(taskId) || 0;
            }

            // Add stars from star lootboxes
            totalStarsSpent += (player.purchasedStarLootboxesCount || 0) * (config.lootboxCostStars || 0);
        }
    }

    return {
        totalPlayers: totalPlayersRes.rows[0].count,
        newPlayersToday: newPlayersTodayRes.rows[0].count,
        totalProfitPerHour: totalProfitRes.rows[0].total_profit,
        popularUpgrades: popularUpgradesRes.rows,
        registrations: registrationsRes,
        totalStarsEarned: totalStarsSpent, // The key 'totalStarsEarned' is kept for frontend compatibility
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
        ORDER BY player_count DESC;
    `);
    return res.rows.map(r => ({...r, player_count: parseInt(r.player_count)}));
};

export const getTotalPlayerCount = async () => {
    const res = await executeQuery('SELECT COUNT(*) FROM users');
    return res.rows[0].count;
};

export const getLeaderboardData = async (limit = 100) => {
    const res = await executeQuery(`
        SELECT p.id, u.name, (p.data->>'profitPerHour')::numeric as "profitPerHour"
        FROM players p
        JOIN users u ON p.id = u.id
        ORDER BY "profitPerHour" DESC
        LIMIT $1
    `, [limit]);
    return res.rows.map(r => ({...r, profitPerHour: parseFloat(r.profitPerHour)}));
};

export const resetPlayerDailyProgress = async (userId) => {
    const player = await getPlayer(userId);
    if (!player) return null;
    player.completedDailyTaskIds = [];
    player.dailyTaps = 0;
    player.claimedComboToday = false;
    player.claimedCipherToday = false;
    player.dailyUpgrades = [];
    player.dailyBoostPurchases = {};
    player.lastDailyReset = Date.now();
    await savePlayer(userId, player);
    return player;
};

export const getPlayerDetails = async (userId) => {
    const user = await getUser(userId);
    const player = await getPlayer(userId);
    return {
        id: user.id,
        name: user.name,
        balance: player.balance,
        upgrades: player.upgrades,
        cheatLog: player.cheatLog,
        suspicion: player.suspicion,
    };
};

export const updatePlayerBalance = async (userId, amount) => {
    const player = await getPlayer(userId);
    if (!player) return;
    player.adminBonus = (player.adminBonus || 0) + Number(amount);
    await savePlayer(userId, player);
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
    const player = await getPlayer(userId);
    if (!player) return;
    player.balance = 0;
    player.profitPerHour = 0;
    player.tasksProfitPerHour = 0;
    player.upgrades = {};
    player.tapGuruLevel = 0;
    player.energyLimitLevel = 0;
    player.suspicionLimitLevel = 0;
    player.coinsPerTap = 1;
    player.unlockedSkins = [DEFAULT_COIN_SKIN_ID];
    player.currentSkinId = DEFAULT_COIN_SKIN_ID;
    player.suspicion = 0;
    player.isCheater = false;
    player.cheatStrikes = 0;
    player.cheatLog = [];
    player.forceSync = true; // Flag for client to resync
    await savePlayer(userId, player);
};

export const getAllUserIds = async () => {
    const res = await executeQuery('SELECT id FROM users');
    return res.rows.map(r => r.id);
};

export const buyUpgradeInDb = async (userId, upgradeId, config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (!playerRes.rows.length) throw new Error('Player not found');
        let player = playerRes.rows[0].data;

        const allUpgrades = [...(config.upgrades || []), ...(config.blackMarketCards || [])];
        const upgrade = allUpgrades.find(u => u.id === upgradeId);
        if (!upgrade) throw new Error('Upgrade not found');

        const currentLevel = player.upgrades[upgradeId] || 0;
        const price = Math.floor(upgrade.price * Math.pow(1.15, currentLevel));

        if (player.balance < price) throw new Error('Not enough coins');

        player.balance -= price;
        player.upgrades[upgradeId] = currentLevel + 1;
        
        const profitGained = Math.floor(upgrade.profitPerHour * Math.pow(1.07, currentLevel));
        player.profitPerHour = (player.profitPerHour || 0) + profitGained;
        
        player.dailyUpgrades = [...new Set([...(player.dailyUpgrades || []), upgradeId])];

        const user = await getUser(userId);
        player = applySuspicion(player, upgrade.suspicionModifier, user.language);
        
        // --- Server-side Glitch Trigger on Purchase ---
        const glitchEvent = (config.glitchEvents || []).find(e => 
            e.trigger?.type === 'upgrade_purchased' && e.trigger?.params?.upgradeId === upgradeId
        );

        if (glitchEvent) {
            const codeStr = String(glitchEvent.code).toUpperCase();
            const alreadyDiscovered = (player.discoveredGlitchCodes || []).map(c => String(c).toUpperCase()).includes(codeStr);
            const alreadyClaimed = (player.claimedGlitchCodes || []).map(c => String(c).toUpperCase()).includes(codeStr);
            
            if (!alreadyDiscovered && !alreadyClaimed) {
                player.discoveredGlitchCodes = [...(player.discoveredGlitchCodes || []), glitchEvent.code];
                console.log(`[INFO] Triggered upgrade glitch '${glitchEvent.code}' for user ${userId}`);
            }
        }
        
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [player, userId]);
        
        const referrerId = (await client.query('SELECT referrer_id FROM users WHERE id = $1', [userId])).rows[0]?.referrer_id;
        if (referrerId) {
            await recalculateReferralProfit(referrerId);
        }

        await client.query('COMMIT');
        return player;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const buyBoostInDb = async (userId, boostId, config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (!playerRes.rows.length) throw new Error('Player not found');
        let player = playerRes.rows[0].data;
        
        const boost = config.boosts.find(b => b.id === boostId);
        if (!boost) throw new Error('Boost not found');

        const limit = BOOST_PURCHASE_LIMITS[boostId];
        const purchasesToday = player.dailyBoostPurchases?.[boostId] || 0;

        if (limit !== undefined && purchasesToday >= limit) {
            throw new Error('Daily purchase limit reached.');
        }

        let cost = boost.costCoins;
        if (boost.id === 'boost_tap_guru') {
            cost = Math.floor(boost.costCoins * Math.pow(1.5, player.tapGuruLevel || 0));
        } else if (boost.id === 'boost_energy_limit') {
            cost = Math.floor(boost.costCoins * Math.pow(1.8, player.energyLimitLevel || 0));
        } else if (boost.id === 'boost_suspicion_limit') {
             cost = Math.floor(boost.costCoins * Math.pow(2.0, player.suspicionLimitLevel || 0));
        }
        
        if (player.balance < cost) throw new Error('Not enough coins');
        player.balance -= cost;

        if (limit !== undefined) {
            if (!player.dailyBoostPurchases) player.dailyBoostPurchases = {};
            player.dailyBoostPurchases[boostId] = purchasesToday + 1;
        }

        switch(boost.id) {
            case 'boost_full_energy':
                const maxEnergy = INITIAL_MAX_ENERGY * Math.pow(2, player.energyLimitLevel || 0);
                player.energy = Math.min(maxEnergy, MAX_ENERGY_CAP);
                break;
            case 'boost_tap_guru':
                player.tapGuruLevel = (player.tapGuruLevel || 0) + 1;
                break;
            case 'boost_energy_limit':
                player.energyLimitLevel = (player.energyLimitLevel || 0) + 1;
                break;
             case 'boost_suspicion_limit':
                player.suspicionLimitLevel = (player.suspicionLimitLevel || 0) + 1;
                break;
        }

        const user = await getUser(userId);
        player = applySuspicion(player, boost.suspicionModifier, user.language);

        await client.query('UPDATE players SET data = $1 WHERE id = $2', [player, userId]);
        
        await client.query('COMMIT');
        return player;

    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

// --- BATTLE LOGIC ---
const endBattle = async (battleId, config) => {
    console.log(`Ending battle ${battleId}...`);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const leaderboardRes = await client.query(
            `SELECT cell_id, score FROM cell_battle_participants WHERE battle_id = $1 ORDER BY score DESC`,
            [battleId]
        );
        const leaderboard = leaderboardRes.rows;
        
        if (leaderboard.length === 0) {
            await client.query(`UPDATE cell_battles SET winner_details = '{"message": "No participants"}' WHERE id = $1`, [battleId]);
            await client.query('COMMIT');
            return;
        }

        const rewards = config.battleRewards;
        const winnerDetails = {
            firstPlace: leaderboard[0] ? { cell_id: leaderboard[0].cell_id, score: leaderboard[0].score } : null,
            secondPlace: leaderboard[1] ? { cell_id: leaderboard[1].cell_id, score: leaderboard[1].score } : null,
            thirdPlace: leaderboard[2] ? { cell_id: leaderboard[2].cell_id, score: leaderboard[2].score } : null,
        };
        
        for (const [index, entry] of leaderboard.entries()) {
            let rewardAmount = 0;
            if (index === 0) rewardAmount = rewards.firstPlace;
            else if (index === 1) rewardAmount = rewards.secondPlace;
            else if (index === 2) rewardAmount = rewards.thirdPlace;
            else rewardAmount = rewards.participant;

            const membersRes = await client.query(`SELECT id FROM players WHERE (data->>'cellId')::int = $1`, [entry.cell_id]);
            if (membersRes.rows.length > 0) {
                const rewardPerMember = Math.floor(rewardAmount / membersRes.rows.length);
                const memberIds = membersRes.rows.map(r => r.id);
                await client.query(
                    `UPDATE players SET data = data || jsonb_build_object('balance', (data->>'balance')::numeric + $1) WHERE id = ANY($2::text[])`,
                    [rewardPerMember, memberIds]
                );
            }
        }

        await client.query('UPDATE cell_battles SET winner_details = $1, rewards_distributed = TRUE WHERE id = $2', [winnerDetails, battleId]);
        
        await client.query('COMMIT');
        console.log(`Battle ${battleId} ended successfully. Rewards distributed.`);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(`Failed to end battle ${battleId}`, e);
    } finally {
        client.release();
    }
};

const startNewBattle = async (config) => {
    const { startHourUTC, durationHours } = config.battleSchedule;
    const now = new Date();
    const startTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), startHourUTC, 0, 0));
    const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
    
    await executeQuery(
        'INSERT INTO cell_battles (start_time, end_time) VALUES ($1, $2)',
        [startTime, endTime]
    );
    console.log(`New battle started. Ends at ${endTime.toISOString()}`);
};

export const checkAndManageBattles = async (config) => {
    const activeBattleRes = await executeQuery(`SELECT * FROM cell_battles WHERE end_time > NOW() AND start_time <= NOW()`);
    const activeBattle = activeBattleRes.rows[0];
    
    const endedBattleRes = await executeQuery(`SELECT * FROM cell_battles WHERE end_time <= NOW() AND rewards_distributed = FALSE`);
    for (const battle of endedBattleRes.rows) {
        await endBattle(battle.id, config);
    }
    
    if (!activeBattle) {
        const schedule = config.battleSchedule;
        const now = new Date();
        const currentDayUTC = now.getUTCDay();
        const currentHourUTC = now.getUTCHours();
        
        const lastBattleRes = await executeQuery('SELECT end_time FROM cell_battles ORDER BY end_time DESC LIMIT 1');
        const lastBattleEnd = lastBattleRes.rows[0] ? new Date(lastBattleRes.rows[0].end_time) : new Date(0);
        
        if (currentDayUTC === schedule.dayOfWeek && currentHourUTC >= schedule.startHourUTC) {
            if (now.getTime() - lastBattleEnd.getTime() > 24 * 60 * 60 * 1000) { // Ensure at least 24h passed
                 await startNewBattle(config);
            }
        }
    }
};

export const forceStartBattle = async (config) => {
    const activeBattleRes = await executeQuery(`SELECT id FROM cell_battles WHERE end_time > NOW()`);
    if (activeBattleRes.rows.length > 0) throw new Error("A battle is already active.");
    await startNewBattle(config);
};

export const forceEndBattle = async (config) => {
    const activeBattleRes = await executeQuery(`SELECT id FROM cell_battles WHERE end_time > NOW()`);
    if (activeBattleRes.rows.length === 0) throw new Error("No active battle to end.");
    const battleId = activeBattleRes.rows[0].id;
    await endBattle(battleId, config);
};

export const getBattleStatusForCell = async (cellId) => {
    const battleRes = await executeQuery('SELECT * FROM cell_battles WHERE end_time