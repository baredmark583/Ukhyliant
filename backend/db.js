
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
    // 1. Calculate base profit from upgrades and permanent tasks
    let baseProfit = 0;
    
    // Profit from upgrades (regular and black market)
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

    // Profit from one-time tasks that grant permanent profit
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

    // 2. Calculate bonus from the CURRENTLY EQUIPPED skin
    let skinBonusPercent = 0;
    if (player.currentSkinId && config.coinSkins) {
        const currentSkin = config.coinSkins.find(s => s.id === player.currentSkinId);
        if (currentSkin) {
            skinBonusPercent = currentSkin.profitBoostPercent || 0;
        }
    }
    
    // 3. Apply skin bonus to base profit
    const profitWithSkinBonus = baseProfit * (1 + skinBonusPercent / 100);

    // 4. Add referral and cell bonuses (which are calculated separately and stored on the player object)
    const finalProfit = profitWithSkinBonus + (player.referralProfitPerHour || 0) + (player.cellProfitBonus || 0);
    
    player.profitPerHour = finalProfit;

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
            active_boosts JSONB DEFAULT '{}'::jsonb,
            UNIQUE(battle_id, cell_id)
        );
    `);
    console.log("Database tables checked/created successfully.");

    await executeQuery(`
        CREATE TABLE IF NOT EXISTS market_listings (
            id SERIAL PRIMARY KEY,
            skin_id VARCHAR(255) NOT NULL,
            owner_id VARCHAR(255) NOT NULL,
            price_coins NUMERIC(20, 4) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            is_active BOOLEAN DEFAULT TRUE
        );

        CREATE TABLE IF NOT EXISTS withdrawal_requests (
            id SERIAL PRIMARY KEY,
            player_id VARCHAR(255) NOT NULL,
            amount_credits NUMERIC(20, 4) NOT NULL,
            ton_wallet VARCHAR(255) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            processed_at TIMESTAMPTZ
        );
    `);
    console.log("Marketplace tables checked/created successfully.");

    // Marketplace table migration from price_stars (INTEGER) to price_coins (NUMERIC)
    try {
        await executeQuery(`ALTER TABLE market_listings RENAME COLUMN price_stars TO price_coins;`);
        await executeQuery(`ALTER TABLE market_listings ALTER COLUMN price_coins TYPE NUMERIC(20, 4);`);
        console.log("Successfully migrated market_listings from price_stars to price_coins.");
    } catch(e) {
        // Ignore errors which indicate migration is not needed (column doesn't exist or already exists)
        if (!e.message.includes('column "price_stars" does not exist') && !e.message.includes('column "price_coins" already exists')) {
            console.warn("Could not migrate market_listings table, might be already migrated or a new setup.", e.message);
        }
    }


    // Safely add columns to daily_events table if they don't exist
    try {
        await executeQuery(`ALTER TABLE daily_events ADD COLUMN IF NOT EXISTS combo_reward BIGINT DEFAULT 5000000;`);
        await executeQuery(`ALTER TABLE daily_events ADD COLUMN IF NOT EXISTS cipher_reward BIGINT DEFAULT 1000000;`);
        await executeQuery(`ALTER TABLE cell_battles ADD COLUMN IF NOT EXISTS winner_details JSONB;`);
        await executeQuery(`ALTER TABLE cell_battles ADD COLUMN IF NOT EXISTS rewards_distributed BOOLEAN DEFAULT FALSE;`);
        await executeQuery(`ALTER TABLE cell_battle_participants ADD COLUMN IF NOT EXISTS active_boosts JSONB DEFAULT '{}'::jsonb;`);
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

    // --- NEW MIGRATION: Convert unlockedSkins from array to object ---
    try {
        const playersToMigrateRes = await executeQuery(`SELECT id, data FROM players WHERE jsonb_typeof(data->'unlockedSkins') = 'array'`);
        if (playersToMigrateRes.rows.length > 0) {
            console.log(`Migrating ${playersToMigrateRes.rows.length} players' unlockedSkins from array to object...`);
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                for (const row of playersToMigrateRes.rows) {
                    const player = row.data;
                    const skinsArray = player.unlockedSkins || [];
                    const skinsObject = {};
                    skinsArray.forEach(skinId => {
                        skinsObject[skinId] = (skinsObject[skinId] || 0) + 1;
                    });
                    // Ensure default skin exists if it was somehow missing
                    if (!skinsObject[DEFAULT_COIN_SKIN_ID]) {
                        skinsObject[DEFAULT_COIN_SKIN_ID] = 1;
                    }
                    player.unlockedSkins = skinsObject;
                    await client.query('UPDATE players SET data = $1 WHERE id = $2', [player, row.id]);
                }
                await client.query('COMMIT');
                console.log("Migration of unlockedSkins completed.");
            } catch (e) {
                await client.query('ROLLBACK');
                console.error("Error during unlockedSkins migration transaction:", e);
            } finally {
                client.release();
            }
        }
    } catch(e) {
        console.error("Could not migrate unlockedSkins from array to object.", e.message);
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
            battleBoosts: BATTLE_BOOSTS,
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
            boostLimitResetCostStars: BOOST_LIMIT_RESET_COST_STARS,
        };
        await saveConfig(initialConfig);
        console.log("Initial game config seeded to the database.");
    } else {
        // --- CONFIG MIGRATION ---
        const config = res.rows[0].value;
        let needsUpdate = false;
        
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

        migrateArrayConfig('upgrades', INITIAL_UPGRADES);
        migrateArrayConfig('tasks', INITIAL_TASKS);
        migrateArrayConfig('specialTasks', INITIAL_SPECIAL_TASKS);
        migrateArrayConfig('boosts', INITIAL_BOOSTS);
        migrateArrayConfig('blackMarketCards', INITIAL_BLACK_MARKET_CARDS);
        migrateArrayConfig('coinSkins', INITIAL_COIN_SKINS);
        migrateArrayConfig('leagues', INITIAL_LEAGUES);
        migrateArrayConfig('battleBoosts', BATTLE_BOOSTS);
        
        if (config.leagues && Array.isArray(config.leagues)) {
            let leaguesMigrated = false;
            config.leagues.forEach(league => {
                if (league.overlayIconUrl === undefined) {
                    league.overlayIconUrl = '';
                    leaguesMigrated = true;
                }
            });
            if (leaguesMigrated) {
                console.log("Migrated: Added 'overlayIconUrl' property to existing leagues.");
                needsUpdate = true;
            }
        }

        if (config.coinSkins && Array.isArray(config.coinSkins)) {
            let skinsMigrated = false;
            config.coinSkins.forEach(skin => {
                if (skin.maxSupply === undefined) {
                    skin.maxSupply = null;
                    skinsMigrated = true;
                }
            });
            if (skinsMigrated) {
                console.log("Migrated: Added 'maxSupply' property to existing coinSkins.");
                needsUpdate = true;
            }
        }
        
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
        checkSingleProp('boostLimitResetCostStars', BOOST_LIMIT_RESET_COST_STARS);
        
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

        const referrerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [referrerId]);
        if (referrerRes.rows.length === 0) {
            console.warn(`Referrer ${referrerId} not found, cannot update profit.`);
            await client.query('ROLLBACK');
            return;
        }
        let referrerPlayer = referrerRes.rows[0].data;
        const config = await getGameConfig();

        const referralsRes = await client.query(`SELECT id FROM users WHERE referrer_id = $1`, [referrerId]);
        const referralIds = referralsRes.rows.map(r => r.id);

        let totalReferralBaseProfit = 0;
        if (referralIds.length > 0) {
            const referralPlayersRes = await client.query(`SELECT data FROM players WHERE id = ANY($1::text[])`, [referralIds]);
            for (const referralPlayerRow of referralPlayersRes.rows) {
                const referralPlayer = referralPlayerRow.data;
                const baseProfit = (referralPlayer.profitPerHour || 0) - (referralPlayer.referralProfitPerHour || 0) - (referralPlayer.cellProfitBonus || 0);
                totalReferralBaseProfit += baseProfit;
            }
        }
        
        referrerPlayer.referralProfitPerHour = Math.floor(totalReferralBaseProfit * REFERRAL_PROFIT_SHARE);
        
        referrerPlayer = await recalculatePlayerProfitInDb(referrerPlayer, config);

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

export const resetBoostLimitInDb = async (userId, boostId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;

        if (player.dailyBoostPurchases && player.dailyBoostPurchases[boostId]) {
            player.dailyBoostPurchases[boostId] = 0;
        }

        player.lastPurchaseResult = { type: 'task', item: { name: { en: 'Boost Limit Reset', ua: 'Скидання ліміту буста', ru: 'Сброс лимита буста' }, iconUrl: 'https://api.iconify.design/ph/arrows-clockwise-bold.svg?color=white' } };

        const updatedRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return updatedRes.rows[0].data;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Transaction failed in resetBoostLimitInDb', error);
        throw error;
    } finally {
        client.release();
    }
};

export const processSuccessfulPayment = async (payloadString, log) => {
    const [type, userId, itemId] = payloadString.split('-');

    if (!type || !userId || !itemId) {
        log('error', `Invalid payment payload received: ${payloadString}`);
        return;
    }
    
    log('info', `Processing payment of type '${type}' for user ${userId}, item ${itemId}`);
    const config = await getGameConfig();

    if (type === 'task') {
        await unlockSpecialTask(userId, itemId, config);
        log('info', `Successfully unlocked task ${itemId} for user ${userId}`);
    } else if (type === 'lootbox') {
        await openLootboxInDb(userId, itemId, config);
        log('info', `Successfully processed lootbox purchase for user ${userId}.`);
    } else if (type === 'boost_reset') {
        await resetBoostLimitInDb(userId, itemId);
        log('info', `Successfully reset boost limit for user ${userId}, boost ${itemId}`);
    } else {
        log('warn', `Unknown payment payload type: ${type}`);
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
            return player;
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
        const config = await getGameConfig();
        const task = config.specialTasks.find(t => t.id === taskId);
        if (!task) throw new Error('Task not found');
        
        if (task.priceStars > 0 && !player.purchasedSpecialTaskIds?.includes(taskId)) {
            throw new Error('Task not purchased');
        }

        if (player.completedSpecialTaskIds?.includes(taskId)) return player;
        
        if (task.type === 'video_code' && task.secretCode && task.secretCode.toLowerCase() !== code?.toLowerCase()) {
            throw new Error("Incorrect secret code.");
        }
        
        if (task.reward.type === 'coins') {
            player.balance = Number(player.balance || 0) + task.reward.amount;
        }

        player.completedSpecialTaskIds = [...(player.completedSpecialTaskIds || []), taskId];
        player = await recalculatePlayerProfitInDb(player, config);
        
        const user = await getUser(userId);
        player = applySuspicion(player, task.suspicionModifier, user.language);

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
        const config = await getGameConfig();
        const task = config.tasks.find(t => t.id === taskId);
        if (!task) throw new Error('Task not found');

        const isCompleted = player.completedDailyTaskIds?.includes(taskId);
        if (isCompleted) {
            await client.query('ROLLBACK');
            return player;
        }
        
        if (task.type === 'taps' && (player.dailyTaps || 0) < (task.requiredTaps || 0)) {
            throw new Error('Not enough taps');
        }
        
        if (task.type === 'video_code' && task.secretCode && task.secretCode.toLowerCase() !== code?.toLowerCase()) {
            throw new Error("Incorrect secret code.");
        }

        if (task.reward.type === 'coins') {
            player.balance = Number(player.balance || 0) + task.reward.amount;
        }

        player.completedDailyTaskIds = [...(player.completedDailyTaskIds || []), taskId];
        player = await recalculatePlayerProfitInDb(player, config);
        
        const user = await getUser(userId);
        player = applySuspicion(player, task.suspicionModifier, user.language);

        const updatedPlayerRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return updatedPlayerRes.rows[0].data;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Transaction failed in claimDailyTaskReward', error);
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

        const currentLevel = player.upgrades?.[upgradeId] || 0;
        const price = Math.floor((upgrade.price || 0) * Math.pow(1.15, currentLevel));

        if (player.balance < price) throw new Error('Not enough balance');

        player.balance -= price;
        player.upgrades[upgradeId] = (player.upgrades[upgradeId] || 0) + 1;

        if (config.glitchEvents) {
            for (const event of config.glitchEvents) {
                if (event.trigger?.type === 'upgrade_purchased' && event.trigger.params?.upgradeId === upgradeId) {
                     if (!(player.discoveredGlitchCodes || []).includes(event.code)) {
                        player.discoveredGlitchCodes = [...(player.discoveredGlitchCodes || []), event.code];
                     }
                }
            }
        }
        
        const user = await getUser(userId);
        player = applySuspicion(player, upgrade.suspicionModifier, user.language);

        player = await recalculatePlayerProfitInDb(player, config);
        
        const updatedPlayerRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        
        const userRes = await client.query('SELECT referrer_id FROM users WHERE id = $1', [userId]);
        const referrerId = userRes.rows[0]?.referrer_id;

        await client.query('COMMIT'); 

        if (referrerId) {
            await recalculateReferralProfit(referrerId);
        }

        return updatedPlayerRes.rows[0].data;

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Transaction failed in buyUpgradeInDb for user ${userId}`, error);
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
        const user = await getUser(userId);

        const boost = config.boosts.find(b => b.id === boostId);
        if (!boost) throw new Error('Boost not found');

        const limit = BOOST_PURCHASE_LIMITS[boost.id];
        const purchasesToday = player.dailyBoostPurchases?.[boost.id] || 0;
        if (limit !== undefined && purchasesToday >= limit) {
            throw new Error('Daily purchase limit reached for this boost.');
        }

        let cost = boost.costCoins;
        if (boost.id === 'boost_tap_guru') {
            cost = Math.floor(boost.costCoins * Math.pow(1.5, player.tapGuruLevel || 0));
        } else if (boost.id === 'boost_energy_limit') {
            cost = Math.floor(boost.costCoins * Math.pow(1.8, player.energyLimitLevel || 0));
        } else if (boost.id === 'boost_suspicion_limit') {
            cost = Math.floor(boost.costCoins * Math.pow(2.0, player.suspicionLimitLevel || 0));
        }

        if (player.balance < cost) throw new Error('Not enough balance');

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
            player.dailyBoostPurchases = {
                ...(player.dailyBoostPurchases || {}),
                [boost.id]: purchasesToday + 1,
            };
        }
        
        player = applySuspicion(player, boost.suspicionModifier, user.language);

        const updatedPlayerRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return updatedPlayerRes.rows[0].data;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Transaction failed in buyBoostInDb for user ${userId}`, error);
        throw error;
    } finally {
        client.release();
    }
};

export const openLootboxInDb = async (userId, boxType, config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;

        const cost = boxType === 'coin' ? config.lootboxCostCoins : config.lootboxCostStars;
        if (boxType === 'coin') {
            if (player.balance < cost) throw new Error('Not enough coins');
            player.balance -= cost;
        }

        const possibleItems = [
            ...(config.blackMarketCards || []),
            ...(config.coinSkins || [])
        ].filter(item => item.boxType === boxType);
        
        if (possibleItems.length === 0) throw new Error('No items available in this lootbox');

        const totalChance = possibleItems.reduce((sum, item) => sum + item.chance, 0);
        let random = Math.random() * totalChance;
        let wonItem = possibleItems[possibleItems.length - 1];
        for (const item of possibleItems) {
            if (random < item.chance) {
                wonItem = item;
                break;
            }
            random -= item.chance;
        }
        
        if ('profitPerHour' in wonItem) {
            player.upgrades[wonItem.id] = (player.upgrades[wonItem.id] || 0) + 1;
        } else if ('profitBoostPercent' in wonItem) {
            player.unlockedSkins[wonItem.id] = (player.unlockedSkins[wonItem.id] || 0) + 1;
        }

        player = await recalculatePlayerProfitInDb(player, config);
        
        player.lastPurchaseResult = { type: 'lootbox', item: wonItem };

        const updatedPlayerRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        
        return { updatedPlayer: updatedPlayerRes.rows[0].data, wonItem };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Transaction failed in openLootboxInDb for user ${userId}`, error);
        throw error;
    } finally {
        client.release();
    }
};

export const resetPlayerDailyProgress = async (userId, player) => {
    player.lastDailyReset = Date.now();
    player.completedDailyTaskIds = [];
    player.dailyTaps = 0;
    player.claimedComboToday = false;
    player.claimedCipherToday = false;
    player.dailyBoostPurchases = {};
    
    await savePlayer(userId, player);
    return player;
};

export const getAllPlayersForAdmin = async () => {
    const res = await executeQuery(`
        SELECT u.id, u.name, u.language, u.referrer_id, p.data->>'balance' as balance, p.data->>'profitPerHour' as "profitPerHour", p.data->>'referrals' as referrals, p.data->>'tonWalletAddress' as "tonWalletAddress"
        FROM users u
        LEFT JOIN players p ON u.id = p.id
        ORDER BY (p.data->>'balance')::numeric DESC
    `);
    return res.rows.map(r => ({
        id: r.id,
        name: r.name,
        language: r.language,
        referrerId: r.referrer_id,
        balance: parseFloat(r.balance) || 0,
        profitPerHour: parseFloat(r.profitPerHour) || 0,
        referrals: parseInt(r.referrals, 10) || 0,
        tonWalletAddress: r.tonWalletAddress,
    }));
};

export const getDailyEvent = async (date) => {
    const res = await executeQuery('SELECT * FROM daily_events WHERE event_date = $1', [date]);
    return res.rows[0] || null;
};

export const saveDailyEvent = async (date, combo_ids, cipher_word, combo_reward, cipher_reward) => {
    await executeQuery(`
        INSERT INTO daily_events (event_date, combo_ids, cipher_word, combo_reward, cipher_reward)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (event_date)
        DO UPDATE SET combo_ids = $2, cipher_word = $3, combo_reward = $4, cipher_reward = $5
    `, [date, JSON.stringify(combo_ids), cipher_word, combo_reward, cipher_reward]);
};

export const claimComboReward = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;

        if (player.claimedComboToday) throw new Error('Combo already claimed today');

        const today = new Date().toISOString().split('T')[0];
        const eventRes = await client.query('SELECT * FROM daily_events WHERE event_date = $1', [today]);
        if (eventRes.rows.length === 0) throw new Error('No active combo today');
        const event = eventRes.rows[0];

        for (const upgradeId of event.combo_ids) {
            if (!player.upgrades || !player.upgrades[upgradeId]) {
                throw new Error('You have not purchased all combo cards');
            }
        }

        player.balance = Number(player.balance || 0) + Number(event.combo_reward);
        player.claimedComboToday = true;
        
        const updatedRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return { player: updatedRes.rows[0].data, reward: Number(event.combo_reward) };
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

        if (player.claimedCipherToday) throw new Error('Cipher already claimed today');

        const today = new Date().toISOString().split('T')[0];
        const eventRes = await client.query('SELECT * FROM daily_events WHERE event_date = $1', [today]);
        if (eventRes.rows.length === 0 || !eventRes.rows[0].cipher_word) throw new Error('No active cipher today');
        
        const event = eventRes.rows[0];
        if (event.cipher_word.toUpperCase() !== cipher.toUpperCase()) {
            throw new Error('Incorrect cipher word');
        }

        player.balance = Number(player.balance || 0) + Number(event.cipher_reward);
        player.claimedCipherToday = true;
        
        const updatedRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return { player: updatedRes.rows[0].data, reward: Number(event.cipher_reward) };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const getLeaderboardData = async () => {
    const res = await executeQuery(`
        SELECT p.id, u.name, (p.data->>'profitPerHour')::numeric as "profitPerHour"
        FROM players p
        JOIN users u ON p.id = u.id
        ORDER BY "profitPerHour" DESC
        LIMIT 100
    `);
    return res.rows;
};

export const getTotalPlayerCount = async () => {
    const res = await executeQuery('SELECT COUNT(*) FROM users');
    return parseInt(res.rows[0].count, 10);
};

export const getDashboardStats = async () => {
    const queries = [
        executeQuery('SELECT COUNT(*) FROM users'),
        executeQuery("SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '24 hours'"),
        executeQuery("SELECT COALESCE(SUM((data->>'profitPerHour')::numeric), 0) as total_profit FROM players"),
        executeQuery(`
            SELECT key as upgrade_id, COUNT(*) as purchase_count
            FROM players, jsonb_object_keys(data->'upgrades') as key
            GROUP BY key ORDER BY purchase_count DESC LIMIT 5
        `),
        executeQuery(`
            SELECT date_trunc('day', created_at)::date as date, COUNT(*) as count
            FROM users
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY date
            ORDER BY date
        `)
    ];

    const [totalPlayersRes, newPlayersRes, totalProfitRes, popularUpgradesRes, registrationsRes] = await Promise.all(queries);
    
    return {
        totalPlayers: parseInt(totalPlayersRes.rows[0].count, 10),
        newPlayersToday: parseInt(newPlayersRes.rows[0].count, 10),
        totalProfitPerHour: parseFloat(totalProfitRes.rows[0].total_profit),
        popularUpgrades: popularUpgradesRes.rows,
        registrations: registrationsRes.rows,
    };
};

export const getOnlinePlayerCount = async () => {
    const res = await executeQuery("SELECT COUNT(*) FROM users WHERE last_seen >= NOW() - INTERVAL '5 minutes'");
    return parseInt(res.rows[0].count, 10);
};

export const getPlayerLocations = async () => {
    const res = await executeQuery(`
        SELECT country, COUNT(*) as player_count 
        FROM users 
        WHERE country IS NOT NULL 
        GROUP BY country 
        ORDER BY player_count DESC
    `);
    return res.rows;
};


export const getPlayerDetails = async (userId) => {
    const userRes = await executeQuery('SELECT * FROM users WHERE id = $1', [userId]);
    const playerRes = await executeQuery('SELECT * FROM players WHERE id = $1', [userId]);
    if (!userRes.rows.length || !playerRes.rows.length) return null;
    return { ...userRes.rows[0], ...playerRes.rows[0].data };
};

export const updatePlayerBalance = async (userId, amount) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;
        player.balance = (Number(player.balance) || 0) + Number(amount);
        player.adminBonus = (player.adminBonus || 0) + Number(amount);
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
        FROM users u
        JOIN players p ON u.id = p.id
        WHERE (p.data->>'isCheater')::boolean = true
    `);
    return res.rows;
};

export const resetPlayerProgress = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error('Player not found');
        let player = playerRes.rows[0].data;
        
        player.balance = 0;
        player.profitPerHour = 0;
        player.upgrades = {};
        player.isCheater = false;
        player.cheatStrikes = 0;
        player.cheatLog = [];
        player.forceSync = true;
        
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [player, userId]);
        await client.query('COMMIT');
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};
export const getCellAnalytics = async () => {
    const kpiQueries = [
        executeQuery('SELECT COUNT(*) as "totalCells" FROM cells'),
        executeQuery('SELECT COUNT(DISTINCT cell_id) as "battleParticipants" FROM cell_battle_participants'),
        executeQuery('SELECT SUM(balance) as "totalBank" FROM cells'),
        executeQuery('SELECT SUM(ticket_count) as "ticketsSpent" FROM cells'),
    ];

    const leaderboardQuery = executeQuery(`
        SELECT c.id, c.name, c.balance,
            (SELECT COUNT(*) FROM players p WHERE (p.data->>'cellId')::int = c.id) as members,
            (SELECT COALESCE(SUM((p.data->>'profitPerHour')::numeric), 0) FROM players p WHERE (p.data->>'cellId')::int = c.id) as total_profit
        FROM cells c ORDER BY total_profit DESC LIMIT 20
    `);

    const battleHistoryQuery = executeQuery(`
        SELECT id, end_time, winner_details
        FROM cell_battles
        WHERE rewards_distributed = TRUE
        ORDER BY end_time DESC LIMIT 10
    `);
    
    const [kpiResults, leaderboardRes, battleHistoryRes] = await Promise.all([Promise.all(kpiQueries), leaderboardQuery, battleHistoryQuery]);
    
    return {
        kpi: kpiResults.reduce((acc, res) => ({...acc, ...res.rows[0]}), {}),
        leaderboard: leaderboardRes.rows,
        battleHistory: battleHistoryRes.rows
    };
};
export const getAllUserIds = async () => { 
    const res = await executeQuery('SELECT id FROM users');
    return res.rows.map(r => r.id);
};
