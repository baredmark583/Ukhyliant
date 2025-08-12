
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
    CELL_CREATION_COST,
    CELL_MAX_MEMBERS,
    INFORMANT_RECRUIT_COST,
    REFERRAL_PROFIT_SHARE,
    INITIAL_MAX_ENERGY,
    LOOTBOX_COST_COINS,
    LOOTBOX_COST_STARS,
    CELL_BATTLE_TICKET_COST,
    BATTLE_SCHEDULE_DEFAULT,
    BATTLE_REWARDS_DEFAULT,
    CELL_ECONOMY_DEFAULTS,
    PENALTY_MESSAGES,
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

    if (currentSuspicion >= 100) {
        player.balance = Number(player.balance || 0) * 0.75;
        currentSuspicion = 50;
        
        const messages = PENALTY_MESSAGES[lang] || PENALTY_MESSAGES.en;
        const message = messages[Math.floor(Math.random() * messages.length)];
        
        player.penaltyLog = [...(player.penaltyLog || []), { 
            type: 'confiscation_25_percent', 
            timestamp: new Date().toISOString(),
            message: message
        }];
    }
    
    player.suspicion = Math.max(0, Math.min(100, currentSuspicion));
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
        // Ensure new config fields exist on old installations
        const config = res.rows[0].value;
        let needsUpdate = false;
        
        const updateSuspicion = (item) => {
            if (item.suspicionModifier === undefined) {
                const initialItem = [...INITIAL_UPGRADES, ...INITIAL_TASKS, ...INITIAL_SPECIAL_TASKS, ...INITIAL_BOOSTS, ...INITIAL_BLACK_MARKET_CARDS, ...INITIAL_COIN_SKINS].find(i => i.id === item.id);
                item.suspicionModifier = initialItem ? initialItem.suspicionModifier : 0;
                needsUpdate = true;
            }
        };

        config.upgrades?.forEach(updateSuspicion);
        config.tasks?.forEach(updateSuspicion);
        config.specialTasks?.forEach(updateSuspicion);
        config.boosts?.forEach(updateSuspicion);
        config.blackMarketCards?.forEach(updateSuspicion);
        config.coinSkins?.forEach(updateSuspicion);

        if (!config.blackMarketCards) { config.blackMarketCards = INITIAL_BLACK_MARKET_CARDS; needsUpdate = true; }
        if (!config.coinSkins) { config.coinSkins = INITIAL_COIN_SKINS; needsUpdate = true; }
        if (config.loadingScreenImageUrl === undefined) { config.loadingScreenImageUrl = ''; needsUpdate = true; }
        if (!config.leagues) { config.leagues = INITIAL_LEAGUES; needsUpdate = true; }
        if (!config.socials || config.socials.twitter !== undefined) {
             config.socials = initialSocials; 
             needsUpdate = true; 
        }
        if (!config.uiIcons || !config.uiIcons.suspicion || !config.uiIcons.profile_tabs) { 
            config.uiIcons = INITIAL_UI_ICONS; 
            needsUpdate = true; 
        }
        if (config.cellCreationCost === undefined) { config.cellCreationCost = CELL_CREATION_COST; needsUpdate = true; }
        if (config.cellMaxMembers === undefined) { config.cellMaxMembers = CELL_MAX_MEMBERS; needsUpdate = true; }
        if (config.informantRecruitCost === undefined) { config.informantRecruitCost = INFORMANT_RECRUIT_COST; needsUpdate = true; }
        if (config.lootboxCostCoins === undefined) { config.lootboxCostCoins = LOOTBOX_COST_COINS; needsUpdate = true; }
        if (config.lootboxCostStars === undefined) { config.lootboxCostStars = LOOTBOX_COST_STARS; needsUpdate = true; }
        if (config.cellBattleTicketCost === undefined) { config.cellBattleTicketCost = CELL_BATTLE_TICKET_COST; needsUpdate = true; }
        if (!config.battleSchedule) { config.battleSchedule = BATTLE_SCHEDULE_DEFAULT; needsUpdate = true; }
        if (!config.battleRewards) { config.battleRewards = BATTLE_REWARDS_DEFAULT; needsUpdate = true; }
        if (config.informantProfitBonus === undefined) { config.informantProfitBonus = CELL_ECONOMY_DEFAULTS.informantProfitBonus; needsUpdate = true; }
        if (config.cellBankProfitShare === undefined) { config.cellBankProfitShare = CELL_ECONOMY_DEFAULTS.cellBankProfitShare; needsUpdate = true; }

        if (needsUpdate) {
            await saveConfig(config);
            console.log("Updated existing game config with new fields (suspicion, cells, etc).");
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


const applyReward = (player, reward) => {
    if (reward.type === 'coins') {
        player.balance = Number(player.balance || 0) + reward.amount;
    } else if (reward.type === 'profit') {
        player.profitPerHour = (player.profitPerHour || 0) + reward.amount;
        player.tasksProfitPerHour = (player.tasksProfitPerHour || 0) + reward.amount;
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
        if (player.completedDailyTaskIds?.includes(taskId)) throw new Error('Task already completed today.');

        if (task.type === 'taps' && player.dailyTaps < (task.requiredTaps || 0)) {
            throw new Error('Not enough taps to claim this task.');
        }
        if (task.type === 'video_code' && task.secretCode && task.secretCode.toLowerCase() !== code?.toLowerCase()) {
            throw new Error("Incorrect secret code.");
        }

        const user = await getUser(userId);
        player = applyReward(player, task.reward);
        player = applySuspicion(player, task.suspicionModifier, user.language);
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

        const possibleItems = [
            ...config.blackMarketCards.filter(c => c.boxType === boxType),
            ...config.coinSkins.filter(s => s.boxType === boxType && !(player.unlockedSkins || []).includes(s.id))
        ];
        
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
            const profitGained = wonItem.profitPerHour;
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

        const possibleItems = [
            ...config.blackMarketCards.filter(c => c.boxType === 'star'),
            ...config.coinSkins.filter(s => s.boxType === 'star' && !(player.unlockedSkins || []).includes(s.id))
        ];
        
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
            player.profitPerHour = (player.profitPerHour || 0) + wonItem.profitPerHour;
            
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


export const processSuccessfulPayment = async (payload) => {
    // Example payloads:
    // For tasks: task-USERID-TASKID
    // For lootboxes: lootbox-USERID-BOXTYPE
    const [type, userId, itemId] = payload.split('-');

    if (!type || !userId || !itemId) {
        throw new Error(`Invalid payload structure: ${payload}`);
    }

    const config = await getGameConfig();

    if (type === 'task') {
        const taskId = itemId;
        console.log(`Processing task unlock for user ${userId}, task ${taskId}`);
        await unlockSpecialTask(userId, taskId, config);
    } else if (type === 'lootbox') {
        const boxType = itemId;
        if (boxType === 'star') {
            console.log(`Processing star lootbox grant for user ${userId}`);
            await grantStarLootboxItem(userId, config);
        } else {
             throw new Error(`Unsupported lootbox type in payload: ${boxType}`);
        }
    } else {
        throw new Error(`Unknown payload type: ${type}`);
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
        // Instead of directly updating the balance, add to a temporary `adminBonus` field.
        // This prevents race conditions where the client's autosave might overwrite the admin's change.
        player.adminBonus = (Number(player.adminBonus) || 0) + Number(amount || 0);
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
        player.lastDailyReset = Date.now(); // Update the reset timestamp

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
        LIMIT 100;
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

        // Full Progress Reset
        player.balance = 0;
        player.adminBonus = 0; 
        player.profitPerHour = 0;
        player.tasksProfitPerHour = 0;
        player.referralProfitPerHour = 0;
        player.cellProfitBonus = 0;
        player.upgrades = {};
        player.completedSpecialTaskIds = [];
        player.purchasedSpecialTaskIds = []; // Also reset purchased airdrop tasks
        player.tapGuruLevel = 0;
        player.energyLimitLevel = 0;
        player.unlockedSkins = [DEFAULT_COIN_SKIN_ID];
        player.currentSkinId = DEFAULT_COIN_SKIN_ID;
        player.suspicion = 0;
        player.energy = INITIAL_MAX_ENERGY + (player.energyLimitLevel || 0) * 500;
        
        // Cheat flags reset
        player.isCheater = false;
        player.cheatStrikes = 0;
        player.cheatLog = [];
        
        // Daily Progress Reset
        player.dailyTaps = 0;
        player.completedDailyTaskIds = [];
        player.claimedComboToday = false;
        player.claimedCipherToday = false;
        player.dailyUpgrades = [];
        
        // Sync flag to force client update
        player.forceSync = true;
        player.lastDailyReset = Date.now();
        player.lastLoginTimestamp = Date.now(); // Crucial to prevent false cheat flags
        
        await client.query('UPDATE players SET data = $1 WHERE id = $2', [player, userId]);
        
        const userRes = await client.query('SELECT referrer_id FROM users WHERE id = $1', [userId]);
        const referrerId = userRes.rows[0]?.referrer_id;
        if(referrerId) {
             await recalculateReferralProfit(referrerId);
        }

        await client.query('COMMIT');
        return player;
    } catch(e) {
        await client.query('ROLLBACK');
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
        
        const allUpgrades = [...config.upgrades, ...config.blackMarketCards];
        const upgrade = allUpgrades.find(u => u.id === upgradeId);
        if (!upgrade) throw new Error("Upgrade not found");
        
        const currentLevel = player.upgrades[upgradeId] || 0;
        const price = Math.floor((upgrade.price || upgrade.profitPerHour * 10) * Math.pow(1.15, currentLevel));
        
        const currentBalance = Number(player.balance || 0);
        if (currentBalance < price) throw new Error("Not enough coins");

        player.balance = currentBalance - price;
        const profitGained = upgrade.profitPerHour;
        player.profitPerHour = (player.profitPerHour || 0) + profitGained;
        player.upgrades[upgradeId] = currentLevel + 1;
        player.dailyUpgrades = [...new Set([...(player.dailyUpgrades || []), upgradeId])];
        
        const user = await getUser(userId);
        player = applySuspicion(player, upgrade.suspicionModifier, user.language);
        
        const updatedPlayerRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        const updatedPlayer = updatedPlayerRes.rows[0].data;
        
        const userRes = await client.query('SELECT referrer_id FROM users WHERE id = $1', [userId]);
        const referrerId = userRes.rows[0]?.referrer_id;

        if (referrerId) {
            await recalculateReferralProfit(referrerId);
        }

        await client.query('COMMIT');
        return updatedPlayer;
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
        if (!boost) throw new Error("Boost not found");

        let cost = boost.costCoins;
        if (boostId === 'boost_tap_guru') {
            cost = Math.floor(boost.costCoins * Math.pow(1.5, player.tapGuruLevel || 0));
        } else if (boostId === 'boost_energy_limit') {
            cost = Math.floor(boost.costCoins * Math.pow(1.8, player.energyLimitLevel || 0));
        }
        
        const currentBalance = Number(player.balance || 0);
        if (currentBalance < cost) throw new Error("Not enough coins");
        player.balance = currentBalance - cost;

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
        
        const user = await getUser(userId);
        player = applySuspicion(player, boost.suspicionModifier, user.language);
        
        const updatedPlayerRes = await client.query('UPDATE players SET data = $1 WHERE id = $2 RETURNING data', [player, userId]);
        await client.query('COMMIT');
        return updatedPlayerRes.rows[0].data;

    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

// --- BATTLE FUNCTIONS ---

const distributeBattleRewards = async (battleId, rewards, client) => {
    const winnersRes = await client.query(
        'SELECT * FROM cell_battle_participants WHERE battle_id = $1 ORDER BY score DESC LIMIT 3',
        [battleId]
    );
    const winners = winnersRes.rows;
    if (winners.length === 0) return;

    const winnerDetails = {};

    // Distribute rewards to top 3
    if (winners[0]) {
        await client.query('UPDATE cells SET balance = balance + $1 WHERE id = $2', [rewards.firstPlace, winners[0].cell_id]);
        winnerDetails.firstPlace = { cell_id: winners[0].cell_id, score: winners[0].score };
    }
    if (winners[1]) {
        await client.query('UPDATE cells SET balance = balance + $1 WHERE id = $2', [rewards.secondPlace, winners[1].cell_id]);
        winnerDetails.secondPlace = { cell_id: winners[1].cell_id, score: winners[1].score };
    }
    if (winners[2]) {
        await client.query('UPDATE cells SET balance = balance + $1 WHERE id = $2', [rewards.thirdPlace, winners[2].cell_id]);
        winnerDetails.thirdPlace = { cell_id: winners[2].cell_id, score: winners[2].score };
    }

    // Distribute to all other participants
    await client.query(
        `UPDATE cells SET balance = balance + $1
         WHERE id IN (
             SELECT cell_id FROM cell_battle_participants WHERE battle_id = $2
         )`,
        [rewards.participant, battleId]
    );

    await client.query(
        'UPDATE cell_battles SET winner_details = $1, rewards_distributed = TRUE WHERE id = $2',
        [winnerDetails, battleId]
    );

    console.log(`Rewards distributed for battle ${battleId}`);
};

export const checkAndManageBattles = async (config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Check for finished battles that need rewards
        const finishedBattlesRes = await client.query(
            "SELECT * FROM cell_battles WHERE end_time <= NOW() AND rewards_distributed = FALSE"
        );
        for (const battle of finishedBattlesRes.rows) {
            await distributeBattleRewards(battle.id, config.battleRewards, client);
        }

        // 2. Check if a new battle needs to be started
        const activeBattleRes = await client.query('SELECT * FROM cell_battles WHERE end_time > NOW() ORDER BY start_time DESC LIMIT 1');
        if (activeBattleRes.rows.length === 0) { // No active battle
            const schedule = config.battleSchedule;
            const now = new Date();
            const lastBattleRes = await client.query('SELECT end_time FROM cell_battles ORDER BY end_time DESC LIMIT 1');
            const lastBattleEnd = lastBattleRes.rows[0]?.end_time;
            
            // Logic to check if we should start based on schedule.frequency is complex.
            // Simplified: Start if it's the right day and time, and the last battle ended long enough ago.
            // A full cron job implementation would be better.
            const isTimeToStart = now.getUTCDay() === schedule.dayOfWeek && now.getUTCHours() >= schedule.startHourUTC;
            const enoughTimePassed = !lastBattleEnd || (now.getTime() - new Date(lastBattleEnd).getTime()) > 12 * 60 * 60 * 1000;

            if (isTimeToStart && enoughTimePassed) {
                const startTime = new Date();
                startTime.setUTCHours(schedule.startHourUTC, 0, 0, 0);
                const endTime = new Date(startTime.getTime() + schedule.durationHours * 60 * 60 * 1000);
                const newBattleRes = await client.query('INSERT INTO cell_battles (start_time, end_time) VALUES ($1, $2) RETURNING *', [startTime, endTime]);
                console.log('New cell battle started:', newBattleRes.rows[0]);
            }
        }
        
        await client.query('COMMIT');
    } catch(e) {
        await client.query('ROLLBACK');
        console.error("Error managing cell battles:", e);
    } finally {
        client.release();
    }
};

export const getBattleStatusForCell = async (cellId) => {
    const activeBattleRes = await executeQuery('SELECT * FROM cell_battles WHERE end_time > NOW() ORDER BY start_time DESC LIMIT 1');
    const activeBattle = activeBattleRes.rows[0];

    if (!activeBattle) {
        return { isActive: false, isParticipant: false, battleId: null, timeRemaining: 0, myScore: 0 };
    }

    const timeRemaining = Math.floor((new Date(activeBattle.end_time).getTime() - Date.now()) / 1000);
    
    if (cellId) {
        const participantRes = await executeQuery('SELECT * FROM cell_battle_participants WHERE battle_id = $1 AND cell_id = $2', [activeBattle.id, cellId]);
        const participant = participantRes.rows[0];
        return {
            isActive: true,
            isParticipant: !!participant,
            battleId: activeBattle.id,
            timeRemaining: timeRemaining > 0 ? timeRemaining : 0,
            myScore: participant ? parseFloat(participant.score) : 0,
        };
    }
    
    return { isActive: true, isParticipant: false, battleId: activeBattle.id, timeRemaining: timeRemaining > 0 ? timeRemaining : 0, myScore: 0 };
};


export const joinActiveBattle = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const player = await getPlayer(userId);
        if (!player || !player.cellId) throw new Error("Must be in a cell to join a battle.");

        const status = await getBattleStatusForCell(player.cellId);
        if (!status.isActive) throw new Error("No active battle to join.");
        if (status.isParticipant) throw new Error("Your cell is already in the battle.");

        const cell = (await client.query('SELECT * FROM cells WHERE id = $1 FOR UPDATE', [player.cellId])).rows[0];
        if (!cell || cell.ticket_count < 1) throw new Error("Not enough battle tickets.");
        
        await client.query('UPDATE cells SET ticket_count = ticket_count - 1 WHERE id = $1', [player.cellId]);
        await client.query('INSERT INTO cell_battle_participants (battle_id, cell_id) VALUES ($1, $2)', [status.battleId, player.cellId]);

        await client.query('COMMIT');
        return getBattleStatusForCell(player.cellId);
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const addTapsToBattle = async (cellId, taps) => {
    try {
        const status = await getBattleStatusForCell(cellId);
        if (status.isActive && status.isParticipant) {
             await executeQuery(
                `UPDATE cell_battle_participants SET score = score + $1 WHERE battle_id = $2 AND cell_id = $3`,
                [taps, status.battleId, cellId]
            );
        }
    } catch(e) {
        console.error(`Failed to add taps for cell ${cellId}`, e);
    }
};

export const getBattleLeaderboard = async () => {
    const activeBattleRes = await executeQuery('SELECT id FROM cell_battles WHERE end_time > NOW() ORDER BY start_time DESC LIMIT 1');
    const activeBattle = activeBattleRes.rows[0];
    if (!activeBattle) return [];

    const leaderboardRes = await executeQuery(`
        SELECT p.cell_id as "cellId", c.name as "cellName", p.score
        FROM cell_battle_participants p
        JOIN cells c ON p.cell_id = c.id
        WHERE p.battle_id = $1
        ORDER BY p.score DESC
        LIMIT 50
    `, [activeBattle.id]);

    return leaderboardRes.rows.map(r => ({ ...r, score: parseFloat(r.score) }));
};

export const forceStartBattle = async (config) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const activeBattleRes = await client.query('SELECT * FROM cell_battles WHERE end_time > NOW()');
        if (activeBattleRes.rows.length > 0) throw new Error("A battle is already active.");
        const schedule = config.battleSchedule;
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + schedule.durationHours * 60 * 60 * 1000);
        await client.query('INSERT INTO cell_battles (start_time, end_time) VALUES ($1, $2)', [startTime, endTime]);
        await client.query('COMMIT');
        return true;
    } catch (e) {
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
        const activeBattleRes = await client.query('SELECT * FROM cell_battles WHERE end_time > NOW() ORDER BY start_time DESC LIMIT 1');
        if (activeBattleRes.rows.length === 0) throw new Error("No active battle to end.");
        const battle = activeBattleRes.rows[0];
        await client.query('UPDATE cell_battles SET end_time = NOW() WHERE id = $1', [battle.id]);
        await distributeBattleRewards(battle.id, config.battleRewards, client);
        await client.query('COMMIT');
        return true;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const getCellAnalytics = async () => {
    const totalCellsRes = await executeQuery('SELECT COUNT(*) FROM cells');
    const totalBankRes = await executeQuery('SELECT SUM(balance) as total_bank FROM cells');
    const ticketsSpentRes = await executeQuery('SELECT COUNT(*) FROM cell_battle_participants');
    
    const activeBattleRes = await executeQuery('SELECT id FROM cell_battles WHERE end_time > NOW() ORDER BY start_time DESC LIMIT 1');
    const activeBattle = activeBattleRes.rows[0];
    let participants = 0;
    if (activeBattle) {
        const participantsRes = await executeQuery('SELECT COUNT(*) FROM cell_battle_participants WHERE battle_id = $1', [activeBattle.id]);
        participants = parseInt(participantsRes.rows[0].count, 10);
    }
    
    const cellLeaderboardRes = await executeQuery(`
        SELECT c.id, c.name, c.balance, (SELECT COUNT(*) FROM players WHERE (data->>'cellId')::int = c.id) as members,
               (SELECT SUM((data->>'profitPerHour')::numeric) FROM players WHERE (data->>'cellId')::int = c.id) as total_profit
        FROM cells c ORDER BY total_profit DESC NULLS LAST LIMIT 100
    `);

    const battleHistoryRes = await executeQuery(`
        SELECT * FROM cell_battles WHERE rewards_distributed = TRUE ORDER BY end_time DESC LIMIT 10
    `);
    
    return {
        kpi: {
            totalCells: parseInt(totalCellsRes.rows[0].count, 10),
            battleParticipants: participants,
            totalBank: parseFloat(totalBankRes.rows[0].total_bank || 0),
            ticketsSpent: parseInt(ticketsSpentRes.rows[0].count, 10) || 0,
        },
        leaderboard: cellLeaderboardRes.rows.map(r => ({...r, members: parseInt(r.members, 10), total_profit: parseFloat(r.total_profit || 0), balance: parseFloat(r.balance || 0)})),
        battleHistory: battleHistoryRes.rows
    };
};

export const getAllUserIds = async () => {
    const res = await executeQuery('SELECT id FROM users');
    return res.rows.map(r => r.id);
};