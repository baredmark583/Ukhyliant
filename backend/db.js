
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
    INITIAL_VIDEO_REWARD_TIERS,
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

        CREATE TABLE IF NOT EXISTS video_reward_tiers (
            id SERIAL PRIMARY KEY,
            views_required INTEGER NOT NULL,
            reward_coins BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS video_submissions (
            id SERIAL PRIMARY KEY,
            player_id VARCHAR(255) NOT NULL,
            video_url TEXT NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            submitted_at TIMESTAMPTZ DEFAULT NOW(),
            reviewed_at TIMESTAMPTZ,
            reward_amount BIGINT
        );
    `);
    console.log("Marketplace and Video tables checked/created successfully.");

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
            loadingScreenImageUrl: 'https://i.imgur.com/GkG1YhP.jpeg',
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
            videoRewardTiers: INITIAL_VIDEO_REWARD_TIERS,
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
        migrateArrayConfig('battleBoosts', BATTLE_BOOSTS);
        migrateArrayConfig('videoRewardTiers', INITIAL_VIDEO_REWARD_TIERS);

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
        
        // --- NEW MIGRATION for uiIcons object ---
        if (config.uiIcons) {
            let iconsUpdated = false;
            // Iterate over top-level groups in INITIAL_UI_ICONS (e.g., 'nav', 'profile_tabs')
            for (const groupKey in INITIAL_UI_ICONS) {
                // If the group is an object (like 'nav' or 'profile_tabs')
                if (typeof INITIAL_UI_ICONS[groupKey] === 'object' && INITIAL_UI_ICONS[groupKey] !== null) {
                    // If the group doesn't exist in the DB config, add the whole group
                    if (!config.uiIcons[groupKey]) {
                        config.uiIcons[groupKey] = INITIAL_UI_ICONS[groupKey];
                        iconsUpdated = true;
                    } else {
                        // If the group exists, iterate over its keys (e.g., 'exchange', 'mine')
                        for (const iconKey in INITIAL_UI_ICONS[groupKey]) {
                            // If a specific icon key is missing in the DB config, add it
                            if (config.uiIcons[groupKey][iconKey] === undefined) {
                                config.uiIcons[groupKey][iconKey] = INITIAL_UI_ICONS[groupKey][iconKey];
                                iconsUpdated = true;
                            }
                        }
                    }
                } else {
                    // For root-level properties in uiIcons (if any)
                    if (config.uiIcons[groupKey] === undefined) {
                        config.uiIcons[groupKey] = INITIAL_UI_ICONS[groupKey];
                        iconsUpdated = true;
                    }
                }
            }
            if (iconsUpdated) {
                console.log("Migrated: Added missing keys to uiIcons config.");
                needsUpdate = true;
            }
        } else {
             config.uiIcons = INITIAL_UI_ICONS; 
             needsUpdate = true;
        }


        // Migrate all non-array (single value) properties
        const checkSingleProp = (key, initialValue) => {
            if (config[key] === undefined) {
                config[key] = initialValue;
                needsUpdate = true;
            }
        };
        
        checkSingleProp('loadingScreenImageUrl', 'https://i.imgur.com/GkG1YhP.jpeg');
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
        
        // Special object properties
        if (!config.socials) { config.socials = initialSocials; needsUpdate = true; }

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
        const config = await getGameConfig();

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
        
        referrerPlayer.referralProfitPerHour = Math.floor(totalReferralBaseProfit * REFERRAL_PROFIT_SHARE);
        
        // Update the referrer's total profit using the master recalculation function
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
        if (!task) throw new Error('Task not found in config');

        if (task.type === 'taps') {
            if (player.completedDailyTaskIds?.includes(taskId)) throw new Error('Task already completed today.');
        } else {
            if (player.completedSpecialTaskIds?.includes(taskId)) throw new Error('Task already completed.');
        }

        if (task.type === 'taps' && player.dailyTaps < (task.requiredTaps || 0)) {
            throw new Error('Not enough taps to claim this task.');
        }
        if (task.type === 'video_code' && task.secretCode && task.secretCode.toLowerCase() !== code?.toLowerCase()) {
            throw new Error("Incorrect secret code.");
        }

        if (task.reward.type === 'coins') {
            player.balance = Number(player.balance || 0) + task.reward.amount;
        }

        if (task.type === 'taps') {
            player.completedDailyTaskIds = [...(player.completedDailyTaskIds || []), taskId];
        } else {
            player.completedSpecialTaskIds = [...(player.completedSpecialTaskIds || []), taskId];
        }

        player = await recalculatePlayerProfitInDb(player, config);

        const user = await getUser(userId);
        player = applySuspicion(player, task.suspicionModifier, user.language);

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
        
        const comboTokens = player.comboTokens || {};
        const hasAllTokens = comboIds.every(id => comboTokens[id] && comboTokens[id] > 0);

        if (!hasAllTokens) {
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
        
        comboIds.forEach(id => {
            if (player.comboTokens[id]) {
                player.comboTokens[id] -= 1;
            }
        });
        
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
    const informantsRes = await client.query('SELECT COUNT(*) FROM informants WHERE cell_id = $1', [player.cellId]);
    const informantCount = parseInt(informantsRes.rows[0].count, 10);
    
    const bonusPercent = config.informantProfitBonus ?? CELL_ECONOMY_DEFAULTS.informantProfitBonus;
    const baseProfit = (player.profitPerHour || 0) - (player.referralProfitPerHour || 0) - (player.cellProfitBonus || 0);
    const newBonus = baseProfit * informantCount * bonusPercent;
    
    player.cellProfitBonus = newBonus;
    player = await recalculatePlayerProfitInDb(player, config);
    
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
        player.cellProfitBonus = 0;
        player = await recalculatePlayerProfitInDb(player, config);
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
            maxMembers: config.cellMaxMembers,
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
    }
}

export const addTapsToBattle = async (cellId, taps) => {
    if (!cellId || taps <= 0) return;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const battleRes = await client.query('SELECT id FROM cell_battles WHERE end_time > NOW() AND start_time <= NOW() LIMIT 1');
        const activeBattleId = battleRes.rows[0]?.id;

        if (activeBattleId) {
            const participantRes = await client.query(
                'SELECT active_boosts FROM cell_battle_participants WHERE battle_id = $1 AND cell_id = $2 FOR UPDATE',
                [activeBattleId, cellId]
            );
            
            if (participantRes.rows.length > 0) {
                const boosts = participantRes.rows[0].active_boosts || {};
                const scoreBoost = boosts['x2_score'];
                let scoreToAdd = taps;

                if (scoreBoost && scoreBoost.expiresAt && Number(scoreBoost.expiresAt) > Date.now()) {
                    scoreToAdd *= 2;
                }
                
                await client.query(
                    'UPDATE cell_battle_participants SET score = score + $1 WHERE battle_id = $2 AND cell_id = $3',
                    [scoreToAdd, activeBattleId, cellId]
                );
            }
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(`[BATTLE_TAP_ERROR] Failed to add taps for cell ${cellId}:`, e.message);
    } finally {
        client.release();
    }
};

export const joinActiveBattle = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        const player = playerRes.rows[0]?.data;
        if (!player || !player.cellId) {
            throw new Error("You must be in a cell to join a battle.");
        }
        const { cellId } = player;

        const battleRes = await client.query('SELECT id FROM cell_battles WHERE end_time > NOW() AND start_time <= NOW() LIMIT 1');
        const activeBattleId = battleRes.rows[0]?.id;
        if (!activeBattleId) {
            throw new Error("There is no active battle to join.");
        }

        const participantRes = await client.query('SELECT id FROM cell_battle_participants WHERE battle_id = $1 AND cell_id = $2', [activeBattleId, cellId]);
        if (participantRes.rows.length > 0) {
            throw new Error("Your cell has already joined this battle.");
        }

        const cellRes = await client.query('SELECT ticket_count FROM cells WHERE id = $1 FOR UPDATE', [cellId]);
        const ticketCount = cellRes.rows[0]?.ticket_count || 0;
        if (ticketCount < 1) {
            throw new Error("Your cell does not have enough tickets to join the battle.");
        }

        await client.query('UPDATE cells SET ticket_count = ticket_count - 1 WHERE id = $1', [cellId]);
        await client.query('INSERT INTO cell_battle_participants (battle_id, cell_id) VALUES ($1, $2)', [activeBattleId, cellId]);

        await client.query('COMMIT');
        
        // Return the fresh status after joining
        return getBattleStatusForCell(cellId);

    } catch (e) {
        await client.query('ROLLBACK');
        console.error(`[JOIN_BATTLE_ERROR] User ${userId} failed to join battle:`, e.message);
        throw e; // Re-throw to be caught by the API route handler
    } finally {
        client.release();
    }
};

export const getBattleLeaderboard = async () => {
    // Find the currently active battle
    const battleRes = await executeQuery('SELECT id FROM cell_battles WHERE start_time <= NOW() AND end_time > NOW() ORDER BY start_time DESC LIMIT 1');
    const activeBattle = battleRes.rows[0];

    if (!activeBattle) {
        return []; // No active battle, return empty leaderboard
    }

    const leaderboardRes = await executeQuery(`
        SELECT
            cbp.cell_id as "cellId",
            c.name as "cellName",
            cbp.score
        FROM cell_battle_participants cbp
        JOIN cells c ON cbp.cell_id = c.id
        WHERE cbp.battle_id = $1
        ORDER BY cbp.score DESC
    `, [activeBattle.id]);

    return leaderboardRes.rows.map(row => ({
        ...row,
        score: parseFloat(row.score)
    }));
};

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

        const possibleItems = [
            ...config.blackMarketCards.filter(c => c.boxType === boxType),
            ...config.coinSkins.filter(s => s.boxType === boxType)
        ];

        if (possibleItems.length === 0) {
            await client.query('COMMIT');
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
        
        if (!wonItem) wonItem = possibleItems[possibleItems.length - 1];

        if ('profitPerHour' in wonItem) { // It's a BlackMarketCard
            const cardId = wonItem.id;
            const currentLevel = player.upgrades[cardId] || 0;
            player.upgrades[cardId] = currentLevel + 1;
        } else if ('profitBoostPercent' in wonItem) { // It's a CoinSkin
            if (!player.unlockedSkins || typeof player.unlockedSkins !== 'object' || Array.isArray(player.unlockedSkins)) {
                player.unlockedSkins = {}; // Sanitize if it's not a valid object
            }
            const currentQty = player.unlockedSkins[wonItem.id] || 0;
            player.unlockedSkins[wonItem.id] = currentQty + 1;
        }

        player = await recalculatePlayerProfitInDb(player, config);
        
        const userRes = await client.query('SELECT referrer_id FROM users WHERE id = $1', [userId]);
        const referrerId = userRes.rows[0]?.referrer_id;
        if (referrerId) {
            await recalculateReferralProfit(referrerId);
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

        const possibleItems = [
            ...config.blackMarketCards.filter(c => c.boxType === 'star'),
            ...config.coinSkins.filter(s => s.boxType === 'star')
        ];
        
        if (possibleItems.length === 0) {
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
        
        if (!wonItem) wonItem = possibleItems[possibleItems.length - 1];

        if ('profitPerHour' in wonItem) {
            const cardId = wonItem.id;
            const currentLevel = player.upgrades[cardId] || 0;
            player.upgrades[cardId] = currentLevel + 1;
        } else if ('profitBoostPercent' in wonItem) {
             if (!player.unlockedSkins || typeof player.unlockedSkins !== 'object' || Array.isArray(player.unlockedSkins)) {
                player.unlockedSkins = {}; // Sanitize
            }
            const currentQty = player.unlockedSkins[wonItem.id] || 0;
            player.unlockedSkins[wonItem.id] = currentQty + 1;
        }
        
        player = await recalculatePlayerProfitInDb(player, config);

        const userRes = await client.query('SELECT referrer_id FROM users WHERE id = $1', [userId]);
        const referrerId = userRes.rows[0]?.referrer_id;
        if (referrerId) {
            await recalculateReferralProfit(referrerId);
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
    } else if (type === 'boost_reset') {
        const boostId = itemId;
        log('info', `Processing boost limit reset for user ${userId}, boost ${boostId}`);
        const player = await getPlayer(userId);
        if (player?.dailyBoostPurchases?.[boostId]) {
            player.dailyBoostPurchases[boostId] = 0;
            await savePlayer(userId, player);
        }
    } else {
        throw new Error(`Unknown payload type: ${type}`);
    }
};

// --- Marketplace DB Functions ---
export const getMarketListingById = async (listingId) => {
    const res = await executeQuery('SELECT * FROM market_listings WHERE id = $1', [listingId]);
    return res.rows[0] || null;
};

export const listSkinForSaleInDb = async (ownerId, skinId, priceCoins) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [ownerId]);
        if (playerRes.rows.length === 0) throw new Error("Player not found.");
        let player = playerRes.rows[0].data;

        if (skinId === DEFAULT_COIN_SKIN_ID) throw new Error("Cannot sell the default skin.");
        
        const currentQty = player.unlockedSkins[skinId] || 0;
        if (currentQty <= 0) throw new Error("You do not own this skin.");

        player.unlockedSkins[skinId] = currentQty - 1;

        const listingRes = await client.query('INSERT INTO market_listings (owner_id, skin_id, price_coins) VALUES ($1, $2, $3) RETURNING *', [ownerId, skinId, priceCoins]);
        
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [player, ownerId]);
        
        await client.query('COMMIT');
        return listingRes.rows[0];
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const getMarketListingsFromDb = async () => {
    const res = await executeQuery(`
        SELECT ml.*, u.name as owner_name 
        FROM market_listings ml
        JOIN users u ON ml.owner_id = u.id
        WHERE ml.is_active = TRUE
        ORDER BY ml.created_at DESC
    `);
    return res.rows;
};

export const purchaseMarketItemWithCoinsInDb = async (listingId, buyerId, config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const listingRes = await client.query('SELECT * FROM market_listings WHERE id = $1 AND is_active = TRUE FOR UPDATE', [listingId]);
        if (listingRes.rows.length === 0) throw new Error("Listing not found or already sold.");
        const listing = listingRes.rows[0];

        if (listing.owner_id === buyerId) throw new Error("Cannot buy your own listing.");

        const buyerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [buyerId]);
        if (buyerRes.rows.length === 0) throw new Error("Buyer not found.");
        let buyer = buyerRes.rows[0].data;

        const price = parseFloat(listing.price_coins);
        if (Number(buyer.balance) < price) throw new Error("Insufficient funds.");
        
        buyer.balance = Number(buyer.balance) - price;
        buyer.unlockedSkins[listing.skin_id] = (buyer.unlockedSkins[listing.skin_id] || 0) + 1;
        
        const skin = config.coinSkins.find(s => s.id === listing.skin_id);
        if (skin) {
            buyer.lastPurchaseResult = { type: 'lootbox', item: skin };
        }

        const sellerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [listing.owner_id]);
        if (sellerRes.rows.length > 0) {
            let seller = sellerRes.rows[0].data;
            seller.balance = Number(seller.balance) + price;
            await client.query('UPDATE players SET data = $1 WHERE id = $2', [seller, listing.owner_id]);
        } else {
            console.warn(`Seller ${listing.owner_id} not found for listing ${listingId}. Coins will be held.`);
            // In a real scenario, you'd handle this case, e.g., by creating a transaction log.
        }

        await client.query('UPDATE players SET data = $1 WHERE id = $2', [buyer, buyerId]);
        await client.query('UPDATE market_listings SET is_active = FALSE WHERE id = $1', [listingId]);

        await client.query('COMMIT');
        return buyer;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
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

        if (!player.tonWalletAddress) throw new Error("TON wallet is not connected.");
        if (Number(player.marketCredits || 0) < amountCredits) throw new Error("Insufficient credits.");

        player.marketCredits = Number(player.marketCredits) - amountCredits;

        await client.query('INSERT INTO withdrawal_requests (player_id, amount_credits, ton_wallet) VALUES ($1, $2, $3)', [userId, amountCredits, player.tonWalletAddress]);
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

// --- Video Submission DB Functions ---
export const submitVideoForReviewDb = async (playerId, url) => {
    const res = await executeQuery(
        'INSERT INTO video_submissions (player_id, video_url) VALUES ($1, $2) RETURNING *',
        [playerId, url]
    );
    return res.rows[0];
};

export const getPlayerSubmissionsDb = async (playerId) => {
    const res = await executeQuery('SELECT * FROM video_submissions WHERE player_id = $1 ORDER BY submitted_at DESC', [playerId]);
    return res.rows;
};

export const getAdminSubmissionsDb = async () => {
    const res = await executeQuery(`
        SELECT vs.*, u.name as player_name 
        FROM video_submissions vs
        JOIN users u ON vs.player_id = u.id
        ORDER BY vs.status = 'pending' DESC, vs.submitted_at DESC
    `);
    return res.rows;
};

export const approveSubmissionDb = async (submissionId, rewardAmount) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const subRes = await client.query('SELECT * FROM video_submissions WHERE id = $1 AND status = \'pending\' FOR UPDATE', [submissionId]);
        if (subRes.rows.length === 0) throw new Error("Submission not found or already reviewed.");
        const submission = subRes.rows[0];

        await client.query('UPDATE video_submissions SET status = \'approved\', reviewed_at = NOW(), reward_amount = $1 WHERE id = $2', [rewardAmount, submissionId]);

        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [submission.player_id]);
        if (playerRes.rows.length > 0) {
            let player = playerRes.rows[0].data;
            player.balance = Number(player.balance || 0) + rewardAmount;
            await client.query('UPDATE players SET data = $1 WHERE id = $2', [player, submission.player_id]);
        }
        
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const rejectSubmissionDb = async (submissionId) => {
    await executeQuery('UPDATE video_submissions SET status = \'rejected\', reviewed_at = NOW() WHERE id = $1 AND status = \'pending\'', [submissionId]);
};

// --- Missing Functions Implementation ---

export const getBattleStatusForCell = async (cellId) => {
    const battleRes = await executeQuery('SELECT id, end_time FROM cell_battles WHERE start_time <= NOW() AND end_time > NOW() ORDER BY start_time DESC LIMIT 1');
    const activeBattle = battleRes.rows[0];

    if (!activeBattle) {
        return { isActive: false, isParticipant: false, battleId: null, timeRemaining: 0, myScore: 0, activeBoosts: {} };
    }

    const timeRemaining = Math.max(0, Math.floor((new Date(activeBattle.end_time).getTime() - Date.now()) / 1000));
    
    if (!cellId) {
        return { isActive: true, isParticipant: false, battleId: activeBattle.id, timeRemaining, myScore: 0, activeBoosts: {} };
    }

    const participantRes = await executeQuery(
        'SELECT score, active_boosts FROM cell_battle_participants WHERE battle_id = $1 AND cell_id = $2',
        [activeBattle.id, cellId]
    );

    const participant = participantRes.rows[0];
    
    return {
        isActive: true,
        isParticipant: !!participant,
        battleId: activeBattle.id,
        timeRemaining,
        myScore: participant ? parseFloat(participant.score) : 0,
        activeBoosts: participant ? participant.active_boosts : {}
    };
};

export const activateBattleBoostInDb = async (userId, boostId, config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const playerRes = await client.query('SELECT data FROM players WHERE id = $1', [userId]);
        const player = playerRes.rows[0]?.data;
        if (!player || !player.cellId) {
            throw new Error("You must be in a cell to activate a boost.");
        }
        const { cellId } = player;

        const battleRes = await client.query('SELECT id FROM cell_battles WHERE end_time > NOW() AND start_time <= NOW() LIMIT 1');
        const activeBattleId = battleRes.rows[0]?.id;
        if (!activeBattleId) {
            throw new Error("There is no active battle.");
        }

        const participantRes = await client.query('SELECT * FROM cell_battle_participants WHERE battle_id = $1 AND cell_id = $2 FOR UPDATE', [activeBattleId, cellId]);
        if (participantRes.rows.length === 0) {
            throw new Error("Your cell is not participating in the current battle.");
        }
        let participant = participantRes.rows[0];

        const boost = (config.battleBoosts || []).find(b => b.id === boostId);
        if (!boost) {
            throw new Error("Invalid boost ID.");
        }

        const cell = (await client.query('SELECT * FROM cells WHERE id = $1 FOR UPDATE', [cellId])).rows[0];
        if (parseFloat(cell.balance) < boost.cost) {
            throw new Error("Insufficient funds in cell bank to activate boost.");
        }

        let activeBoosts = participant.active_boosts || {};
        if (activeBoosts[boostId] && activeBoosts[boostId].expiresAt > Date.now()) {
            throw new Error("This boost is already active.");
        }

        await client.query('UPDATE cells SET balance = balance - $1 WHERE id = $2', [boost.cost, cellId]);
        
        const expiresAt = Date.now() + boost.durationSeconds * 1000;
        activeBoosts[boostId] = { expiresAt };

        await client.query('UPDATE cell_battle_participants SET active_boosts = $1 WHERE id = $2', [activeBoosts, participant.id]);
        
        await client.query('COMMIT');

        const newStatus = await getBattleStatusForCell(cellId);
        const newCell = await getCellFromDb(cellId, config);
        
        return { status: newStatus, cell: newCell };

    } catch (e) {
        await client.query('ROLLBACK');
        console.error(`[ACTIVATE_BOOST_ERROR] User ${userId} failed to activate boost ${boostId}:`, e.message);
        throw e;
    } finally {
        client.release();
    }
};

export const buyUpgradeInDb = async (userId, upgradeId, config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error("Player not found.");
        let player = playerRes.rows[0].data;
        
        const allUpgrades = [...(config.upgrades || []), ...(config.blackMarketCards || [])];
        const upgrade = allUpgrades.find(u => u.id === upgradeId);
        if (!upgrade) throw new Error("Upgrade not found.");

        const currentLevel = player.upgrades[upgradeId] || 0;
        const price = Math.floor((upgrade.price || upgrade.profitPerHour * 10) * Math.pow(1.15, currentLevel));

        if (player.balance < price) throw new Error("Not enough coins.");

        player.balance -= price;
        player.upgrades[upgradeId] = currentLevel + 1;
        
        const today = new Date().toISOString().split('T')[0];
        const dailyEvent = await getDailyEvent(today);
        const comboIds = parseDbComboIds(dailyEvent);
        if (comboIds.includes(upgradeId)) {
            if (!player.comboTokens) player.comboTokens = {};
            player.comboTokens[upgradeId] = (player.comboTokens[upgradeId] || 0) + 1;
        }
        
        player = await recalculatePlayerProfitInDb(player, config);
        
        const userRes = await client.query('SELECT referrer_id FROM users WHERE id = $1', [userId]);
        const referrerId = userRes.rows[0]?.referrer_id;
        if (referrerId) {
             await recalculateReferralProfit(referrerId);
        }

        const user = await getUser(userId);
        player = applySuspicion(player, upgrade.suspicionModifier, user.language);

        for (const event of (config.glitchEvents || [])) {
            if (event.trigger?.type === 'upgrade_purchased' && event.trigger.params.upgradeId === upgradeId) {
                const alreadyDiscovered = player.discoveredGlitchCodes?.includes(event.code);
                if (!alreadyDiscovered) {
                    player.discoveredGlitchCodes = [...(player.discoveredGlitchCodes || []), event.code];
                }
            }
        }

        const updatedRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        
        await client.query('COMMIT');
        return updatedRes.rows[0].data;

    } catch(e) {
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
        if (playerRes.rows.length === 0) throw new Error("Player not found.");
        let player = playerRes.rows[0].data;

        const boost = config.boosts.find(b => b.id === boostId);
        if (!boost) throw new Error("Boost not found.");

        const limit = BOOST_PURCHASE_LIMITS[boostId];
        const purchasesToday = player.dailyBoostPurchases?.[boostId] || 0;
        if (limit !== undefined && purchasesToday >= limit) {
            throw new Error("Daily limit for this boost reached.");
        }

        let cost = boost.costCoins;
        if (boostId === 'boost_tap_guru') {
            cost = Math.floor(boost.costCoins * Math.pow(1.5, player.tapGuruLevel || 0));
        } else if (boostId === 'boost_energy_limit') {
            cost = Math.floor(boost.costCoins * Math.pow(1.8, player.energyLimitLevel || 0));
        } else if (boostId === 'boost_suspicion_limit') {
             cost = Math.floor(boost.costCoins * Math.pow(2.0, player.suspicionLimitLevel || 0));
        }

        if (player.balance < cost) throw new Error("Not enough coins.");
        player.balance -= cost;

        if (boostId === 'boost_full_energy') {
            const maxEnergy = INITIAL_MAX_ENERGY * Math.pow(2, player.energyLimitLevel || 0);
            player.energy = Math.min(maxEnergy, MAX_ENERGY_CAP);
        } else if (boostId === 'boost_tap_guru') {
            player.tapGuruLevel = (player.tapGuruLevel || 0) + 1;
        } else if (boostId === 'boost_energy_limit') {
            player.energyLimitLevel = (player.energyLimitLevel || 0) + 1;
        } else if (boostId === 'boost_suspicion_limit') {
            player.suspicionLimitLevel = (player.suspicionLimitLevel || 0) + 1;
        }
        
        if (limit !== undefined) {
             if (!player.dailyBoostPurchases) player.dailyBoostPurchases = {};
             player.dailyBoostPurchases[boostId] = purchasesToday + 1;
        }

        const user = await getUser(userId);
        player = applySuspicion(player, boost.suspicionModifier, user.language);

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

const distributeBattleRewards = async (battleId, client, config) => {
    const rewards = config.battleRewards || BATTLE_REWARDS_DEFAULT;
    
    const leaderboardRes = await client.query(`
        SELECT cbp.cell_id, c.name, cbp.score FROM cell_battle_participants cbp
        JOIN cells c ON cbp.cell_id = c.id
        WHERE cbp.battle_id = $1 ORDER BY cbp.score DESC
    `, [battleId]);
    const leaderboard = leaderboardRes.rows;
    
    let winnerDetails = {};

    for (let i = 0; i < leaderboard.length; i++) {
        const entry = leaderboard[i];
        let rewardAmount = rewards.participant;
        if (i === 0) { rewardAmount += rewards.firstPlace; winnerDetails.firstPlace = { id: entry.cell_id, name: entry.name, score: entry.score }; }
        if (i === 1) { rewardAmount += rewards.secondPlace; winnerDetails.secondPlace = { id: entry.cell_id, name: entry.name, score: entry.score }; }
        if (i === 2) { rewardAmount += rewards.thirdPlace; winnerDetails.thirdPlace = { id: entry.cell_id, name: entry.name, score: entry.score }; }
        
        await client.query('UPDATE cells SET balance = balance + $1 WHERE id = $2', [rewardAmount, entry.cell_id]);
    }
    
    await client.query("UPDATE cell_battles SET rewards_distributed = TRUE, winner_details = $1 WHERE id = $2", [winnerDetails, battleId]);
    console.log(`[BATTLE] Distributed rewards for battle ${battleId}.`);
};

const startNewBattle = async (schedule, client) => {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + (schedule.durationHours * 60 * 60 * 1000));
    await client.query('INSERT INTO cell_battles (start_time, end_time) VALUES ($1, $2)', [startTime, endTime]);
    console.log(`[BATTLE] New battle started. Ends at: ${endTime.toISOString()}`);
};

export const checkAndManageBattles = async (config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const endedBattlesRes = await client.query(
            "SELECT id FROM cell_battles WHERE end_time <= NOW() AND rewards_distributed = FALSE FOR UPDATE"
        );
        for (const battle of endedBattlesRes.rows) {
            await distributeBattleRewards(battle.id, client, config);
        }

        const activeBattleRes = await client.query("SELECT id FROM cell_battles WHERE end_time > NOW()");
        if (activeBattleRes.rows.length > 0) {
            await client.query('COMMIT');
            return; 
        }
        
        const schedule = config.battleSchedule || BATTLE_SCHEDULE_DEFAULT;
        const now = new Date();
        const dayOfWeek = now.getUTCDay();
        const hour = now.getUTCHours();
        
        if (dayOfWeek === schedule.dayOfWeek && hour >= schedule.startHourUTC) {
             const lastBattleRes = await client.query("SELECT end_time FROM cell_battles ORDER BY end_time DESC LIMIT 1");
             let shouldStart = true;
             if (lastBattleRes.rows.length > 0) {
                 const lastBattleEnd = new Date(lastBattleRes.rows[0].end_time);
                 const daysSinceLastBattle = (now - lastBattleEnd) / (1000 * 60 * 60 * 24);
                 
                 if (schedule.frequency === 'weekly' && daysSinceLastBattle < 6.5) shouldStart = false;
                 if (schedule.frequency === 'biweekly' && daysSinceLastBattle < 13.5) shouldStart = false;
                 if (schedule.frequency === 'monthly' && now.getUTCDate() < 25) shouldStart = false;
             }

             if (shouldStart) {
                 await startNewBattle(schedule, client);
             }
        }
        
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error in checkAndManageBattles cron job:", e);
    } finally {
        client.release();
    }
};

export const forceStartBattle = async (config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const activeBattleRes = await client.query("SELECT id FROM cell_battles WHERE end_time > NOW()");
        if (activeBattleRes.rows.length > 0) throw new Error("A battle is already active.");
        const schedule = config.battleSchedule || BATTLE_SCHEDULE_DEFAULT;
        await startNewBattle(schedule, client);
        await client.query('COMMIT');
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const forceEndBattle = async (config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const battleRes = await client.query("UPDATE cell_battles SET end_time = NOW() WHERE end_time > NOW() AND rewards_distributed = FALSE RETURNING id");
        if(battleRes.rows.length > 0) {
            await distributeBattleRewards(battleRes.rows[0].id, client, config);
        }
        await client.query('COMMIT');
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const getAllPlayersForAdmin = async () => {
    const res = await executeQuery(`
        SELECT 
            u.id, 
            u.name, 
            p.data->>'balance' as balance,
            p.data->>'profitPerHour' as "profitPerHour",
            p.data->>'referrals' as referrals,
            u.language,
            p.data->>'tonWalletAddress' as "tonWalletAddress"
        FROM users u
        JOIN players p ON u.id = p.id
        ORDER BY (p.data->>'balance')::numeric DESC
    `);
    return res.rows.map(row => ({
        ...row,
        balance: parseFloat(row.balance),
        profitPerHour: parseFloat(row.profitPerHour),
        referrals: parseInt(row.referrals, 10)
    }));
};

export const getDashboardStats = async () => {
    const totalPlayersRes = await executeQuery('SELECT COUNT(*) FROM users');
    const newPlayersRes = await executeQuery("SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '24 hours'");
    const totalProfitRes = await executeQuery("SELECT SUM((data->>'profitPerHour')::numeric) as total_profit FROM players");
    const popularUpgradesRes = await executeQuery(`
        SELECT key as upgrade_id, COUNT(*) as purchase_count
        FROM players, jsonb_each_text(data->'upgrades')
        GROUP BY key
        ORDER BY purchase_count DESC
        LIMIT 5;
    `);
    const registrationsRes = await executeQuery(`
        SELECT date_trunc('day', created_at)::date as date, COUNT(*) as count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY 1
        ORDER BY 1;
    `);

    return {
        totalPlayers: totalPlayersRes.rows[0].count,
        newPlayersToday: newPlayersRes.rows[0].count,
        totalProfitPerHour: totalProfitRes.rows[0].total_profit,
        popularUpgrades: popularUpgradesRes.rows,
        registrations: registrationsRes.rows
    };
};

export const getOnlinePlayerCount = async () => {
    const res = await executeQuery("SELECT COUNT(*) FROM users WHERE last_seen >= NOW() - INTERVAL '5 minutes'");
    return res.rows[0].count;
};

export const getPlayerLocations = async () => {
    const res = await executeQuery("SELECT country, COUNT(*) as player_count FROM users WHERE country IS NOT NULL GROUP BY country");
    return res.rows;
};

export const resetPlayerDailyProgress = async (userId, player) => {
    player.lastDailyReset = Date.now();
    player.completedDailyTaskIds = [];
    player.dailyTaps = 0;
    player.claimedComboToday = false;
    player.claimedCipherToday = false;
    player.dailyBoostPurchases = {};
    player.comboTokens = {};
    await savePlayer(userId, player);
    return player;
};

export const getLeaderboardData = async () => {
    const res = await executeQuery(`
        SELECT u.id, u.name, (p.data->>'profitPerHour')::numeric as "profitPerHour"
        FROM users u
        JOIN players p ON u.id = p.id
        ORDER BY "profitPerHour" DESC
        LIMIT 100
    `);
    return res.rows;
};

export const getTotalPlayerCount = async () => {
    const res = await executeQuery('SELECT COUNT(*) FROM users');
    return parseInt(res.rows[0].count, 10);
};

export const getPlayerDetails = async (userId) => {
    const user = await getUser(userId);
    const player = await getPlayer(userId);
    if (!user || !player) return null;
    return { ...user, ...player };
};

export const updatePlayerBalance = async (userId, amount) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const playerRes = await client.query('SELECT data FROM players WHERE id = $1 FOR UPDATE', [userId]);
        if (playerRes.rows.length === 0) throw new Error("Player not found");
        let player = playerRes.rows[0].data;
        player.balance = (Number(player.balance) || 0) + Number(amount);
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [player, userId]);
        await client.query('COMMIT');
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const getCheaters = async () => {
    const res = await executeQuery("SELECT u.id, u.name FROM users u JOIN players p ON u.id = p.id WHERE p.data->>'isCheater' = 'true'");
    return res.rows;
};

export const resetPlayerProgress = async (userId) => {
    const player = await getPlayer(userId);
    if (!player) return;
    
    player.balance = 0;
    player.profitPerHour = 0;
    player.upgrades = {};
    player.isCheater = false;
    player.cheatLog = [];
    player.cheatStrikes = 0;
    await savePlayer(userId, player);
};

export const getCellAnalytics = async () => {
    const kpiRes = await executeQuery(`
        SELECT
            (SELECT COUNT(*) FROM cells) as "totalCells",
            (SELECT COUNT(DISTINCT cell_id) FROM cell_battle_participants) as "battleParticipants",
            (SELECT SUM(balance) FROM cells) as "totalBank",
            (SELECT SUM(ticket_count) FROM cells) as "ticketsSpent"
    `);
    
    const leaderboardRes = await executeQuery(`
        SELECT 
            c.id, c.name, 
            COUNT(p.id) as members, 
            c.balance,
            SUM((p.data->>'profitPerHour')::numeric) as total_profit
        FROM cells c
        LEFT JOIN players p ON (p.data->>'cellId')::int = c.id
        GROUP BY c.id, c.name, c.balance
        ORDER BY total_profit DESC NULLS LAST
        LIMIT 100;
    `);

    const battleHistoryRes = await executeQuery(`
        SELECT id, end_time, winner_details
        FROM cell_battles
        WHERE rewards_distributed = TRUE
        ORDER BY end_time DESC
        LIMIT 10;
    `);

    return {
        kpi: kpiRes.rows[0],
        leaderboard: leaderboardRes.rows,
        battleHistory: battleHistoryRes.rows
    };
};

export const getAllUserIds = async () => {
    const res = await executeQuery('SELECT id FROM users');
    return res.rows.map(r => r.id);
};

export const getWithdrawalRequestsForAdmin = async () => {
    const res = await executeQuery(`
        SELECT wr.*, u.name as player_name
        FROM withdrawal_requests wr
        JOIN users u ON wr.player_id = u.id
        ORDER BY wr.status = 'pending' DESC, wr.created_at DESC
    `);
    return res.rows;
};

export const updateWithdrawalRequestStatusInDb = async (requestId, status) => {
    await executeQuery(
        "UPDATE withdrawal_requests SET status = $1, processed_at = NOW() WHERE id = $2 AND status = 'pending'",
        [status, requestId]
    );
};

export const getPlayerWithdrawalRequests = async (playerId) => {
    const res = await executeQuery('SELECT * FROM withdrawal_requests WHERE player_id = $1 ORDER BY created_at DESC', [playerId]);
    return res.rows;
};
