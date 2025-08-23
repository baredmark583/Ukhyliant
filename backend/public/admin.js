document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let localConfig = {};
    let allPlayers = [];
    let dashboardStats = {};
    let playerLocations = [];
    let dailyEvent = { combo_ids: [], cipher_word: '', combo_reward: 5000000, cipher_reward: 1000000 };
    let activeTab = 'dashboard';
    let currentLang = localStorage.getItem('adminLang') || 'ru';
    let charts = {}; // To hold chart instances
    let lastAiContent = null; // To store the result from the last AI generation

    // --- CONFIG META (for dynamic table rendering) ---
    const configMeta = {
        leagues: { titleKey: 'nav_leagues', cols: ['id', 'name', 'description', 'minProfitPerHour', 'iconUrl', 'overlayIconUrl'] },
        upgrades: { titleKey: 'nav_upgrades', cols: ['id', 'name', 'price', 'profitPerHour', 'category', 'suspicionModifier', 'iconUrl'] },
        tasks: { titleKey: 'nav_daily_tasks', cols: ['id', 'name', 'type', 'reward', 'requiredTaps', 'suspicionModifier', 'url', 'secretCode', 'imageUrl'] },
        specialTasks: { titleKey: 'nav_special_tasks', cols: ['id', 'name', 'description', 'type', 'reward', 'priceStars', 'suspicionModifier', 'url', 'secretCode', 'imageUrl'] },
        glitchEvents: { titleKey: 'nav_glitch_events', cols: ['id', 'message', 'code', 'reward', 'trigger', 'isFinal'] },
        blackMarketCards: { titleKey: 'nav_market_cards', cols: ['id', 'name', 'profitPerHour', 'chance', 'boxType', 'suspicionModifier', 'iconUrl'] },
        coinSkins: { titleKey: 'nav_coin_skins', cols: ['id', 'name', 'profitBoostPercent', 'chance', 'boxType', 'suspicionModifier', 'maxSupply', 'iconUrl'] },
        videoRewardTiers: { titleKey: 'nav_video_rewards', cols: ['viewsRequired', 'rewardCoins'] },
        uiIcons: { titleKey: 'nav_ui_icons' },
        boosts: { titleKey: 'nav_boosts', cols: ['id', 'name', 'description', 'costCoins', 'suspicionModifier', 'iconUrl'] },
        cellSettings: { titleKey: 'nav_cell_settings', fields: ['cellCreationCost', 'cellMaxMembers', 'informantRecruitCost', 'lootboxCostCoins', 'lootboxCostStars', 'cellBattleTicketCost', 'boostLimitResetCostStars'] },
    };
    
    const META_TAP_TARGETS = [
        { id: 'referral-counter', nameKey: 'target_name_referral_counter' },
        { id: 'balance-display', nameKey: 'target_name_balance_display' },
        { id: 'mine-title', nameKey: 'target_name_mine_title' },
        { id: 'profile-title', nameKey: 'target_name_profile_title' }
    ];

    // --- DOM ELEMENTS ---
    const tabContainer = document.getElementById('tab-content-container');
    const tabTitle = document.getElementById('tab-title');
    const saveMainButton = document.getElementById('save-main-button');
    const modalsContainer = document.getElementById('modals-container');
    
    // --- TRANSLATION FUNCTION ---
    const t = (key) => {
        return window.LOCALES?.[currentLang]?.[key] || window.LOCALES?.['en']?.[key] || `[${key}]`;
    }

    // --- UTILS ---
    const escapeHtml = (unsafe) => {
        if (unsafe === null || unsafe === undefined) return '';
        if (typeof unsafe !== 'string' && typeof unsafe !== 'number') return JSON.stringify(unsafe);
        return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&quot;").replace(/'/g, "&#039;");
    };

    const formatNumber = (num) => {
        if (num === null || num === undefined) return '0';
        return Number(num).toLocaleString(currentLang === 'ru' ? 'ru-RU' : 'en-US');
    };

    const getLocalizedText = (data) => {
        if (typeof data === 'object' && data !== null && (data.hasOwnProperty('en') || data.hasOwnProperty('ru') || data.hasOwnProperty('ua'))) {
            return escapeHtml(data[currentLang] || data['en'] || '');
        }
        return escapeHtml(data);
    };
    
    const applyTranslationsToDOM = () => {
        document.querySelectorAll('[data-translate]').forEach(el => {
            const key = el.dataset.translate;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if(el.placeholder) el.placeholder = t(key);
            } else {
                el.textContent = t(key);
            }
        });
        
        const activeButton = document.querySelector('.tab-button.active');
        if (activeButton && activeButton.dataset.titleKey) {
            tabTitle.textContent = t(activeButton.dataset.titleKey);
        }

        document.querySelector('html').setAttribute('lang', currentLang);
        const flag = document.getElementById('lang-switcher-flag');
        if (flag) {
            flag.className = `flag flag-country-${currentLang === 'en' ? 'us' : currentLang}`;
        }
    };
    
    const destroyCharts = () => {
        Object.values(charts).forEach(chart => chart.destroy());
        charts = {};
    };

    const showLoading = (messageKey = 'loading') => {
        tabContainer.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="min-height: 50vh;">
                <div>
                    <div class="spinner-border text-success" role="status"></div>
                    <p class="mt-2 text-secondary">${t(messageKey)}</p>
                </div>
            </div>`;
    };

    // --- API & DATA HANDLING ---
    const fetchData = async (endpoint) => {
        try {
            const response = await fetch(`/admin/api/${endpoint}`, { cache: 'no-cache' });
            if (!response.ok) {
                if (response.status === 401) window.location.href = '/admin/login.html';
                console.error(`Error fetching ${endpoint}: ${response.statusText}`);
                alert(`Error fetching data: ${response.statusText}`);
                return null;
            }
            return await response.json();
        } catch (error) {
            console.error(`Network error fetching ${endpoint}:`, error);
            alert(`Network Error: ${error.message}`);
            return null;
        }
    };

    const postData = async (endpoint, data = {}) => {
        try {
            const response = await fetch(`/admin/api/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error posting to ${endpoint}: ${response.statusText}`, errorText);
                alert(`Error: ${errorText}`);
                return null;
            }
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return await response.json();
            }
            return { ok: true };
        } catch (error) {
            console.error(`Network error posting to ${endpoint}:`, error);
            alert(`Network Error: ${error.message}`);
            return null;
        }
    };
    
    const deleteData = async (endpoint) => {
        try {
            const response = await fetch(`/admin/api/${endpoint}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error deleting from ${endpoint}: ${response.statusText}`, errorText);
                alert(`Error: ${errorText}`);
                return null;
            }
            return { ok: true };
        } catch (error) {
            console.error(`Network error deleting from ${endpoint}:`, error);
            alert(`Network Error: ${error.message}`);
            return null;
        }
    };

    const saveAllChanges = async () => {
        saveMainButton.disabled = true;
        saveMainButton.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span> ${t('saving')}`;
        
        try {
            const configPromise = postData('config', { config: localConfig });
            const dailyEventPromise = postData('daily-events', {
                combo_ids: dailyEvent.combo_ids,
                cipher_word: dailyEvent.cipher_word,
                combo_reward: dailyEvent.combo_reward,
                cipher_reward: dailyEvent.cipher_reward,
            });

            const [configRes, eventRes] = await Promise.all([configPromise, dailyEventPromise]);

            if (configRes && eventRes) {
                alert(t('save_success'));
            } else {
                alert(t('save_error'));
                throw new Error('One or more save operations failed.');
            }
        } catch (error) {
            console.error('Error saving changes:', error);
        } finally {
            saveMainButton.disabled = false;
            saveMainButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><path d="M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M14 4l0 4l-6 0l0 -4" /></svg> ${t('save_all_changes')}`;
            localConfig = await fetchData('config') || {};
        }
    };
    
    // --- RENDER LOGIC ---
    const render = () => {
        destroyCharts();
        document.querySelectorAll('.tab-button').forEach(btn => {
            const isActive = btn.dataset.tab === activeTab;
            btn.classList.toggle('active', isActive);
            const dropdownMenu = btn.closest('.dropdown-menu');
            if (dropdownMenu) {
                const dropdownToggle = dropdownMenu.previousElementSibling;
                const parentNavItem = dropdownToggle.closest('.nav-item');
                if (parentNavItem.querySelector('.dropdown-item.active')) {
                    dropdownToggle.classList.add('show', 'active');
                    parentNavItem.classList.add('active');
                } else {
                    dropdownToggle.classList.remove('show', 'active');
                    parentNavItem.classList.remove('active');
                }
            }
        });
        
        saveMainButton.classList.toggle('d-none', !configMeta[activeTab] && activeTab !== 'dailyEvents' && activeTab !== 'cellSettings' && activeTab !== 'cellConfiguration' && activeTab !== 'dashboard');
        
        switch (activeTab) {
            case 'dashboard':
                renderDashboard();
                break;
            case 'players':
                renderPlayers();
                break;
            case 'cheaters':
                renderCheaters();
                break;
            case 'videoModeration':
                renderVideoModeration();
                break;
            case 'withdrawalRequests':
                renderWithdrawalRequests();
                break;
            case 'dailyEvents':
                renderDailyEvents();
                break;
            case 'cellAnalytics':
                renderCellAnalytics();
                break;
            case 'cellConfiguration':
                 renderCellConfiguration();
                 break;
            case 'uiIcons':
                renderUiIconsConfig();
                break;
            case 'cellSettings':
                 renderGenericSettingsForm('cellSettings', configMeta.cellSettings.fields, 'cell_config');
                 break;
            default:
                if (configMeta[activeTab]) {
                    renderConfigTable(activeTab);
                }
                break;
        }
        applyTranslationsToDOM();
    };

    const renderDashboard = async () => {
        showLoading();
        // Fetch all data concurrently
        const [stats, locations, socials] = await Promise.all([
            fetchData('dashboard-stats'),
            fetchData('player-locations'),
            fetchData('social-stats')
        ]);

        dashboardStats = stats || {};
        playerLocations = locations || [];
        const socialStats = socials || {};

        const kpis = [
            { key: 'total_players', value: formatNumber(dashboardStats.totalPlayers) },
            { key: 'new_players_24h', value: formatNumber(dashboardStats.newPlayersToday) },
            { key: 'online_now', value: formatNumber(dashboardStats.onlineNow) },
            { key: 'total_profit_per_hour', value: formatNumber(dashboardStats.totalProfitPerHour) },
            { key: 'earned_stars', value: formatNumber(dashboardStats.totalStarsEarned) }
        ];

        const kpiHtml = kpis.map(kpi => `
            <div class="col">
                <div class="card card-sm h-100">
                    <div class="card-body">
                        <div class="subheader" data-translate="${kpi.key}">${t(kpi.key)}</div>
                        <div class="h1 mb-3">${kpi.value}</div>
                    </div>
                </div>
            </div>
        `).join('');

        const topUpgradeCount = (dashboardStats.popularUpgrades?.[0]?.purchase_count) || 1;
        const topUpgradesHtml = (dashboardStats.popularUpgrades || []).map(u => {
            const allUpgrades = [...(localConfig.upgrades || []), ...(localConfig.blackMarketCards || [])];
            const upgradeInfo = allUpgrades.find(upg => upg.id === u.upgrade_id);
            const name = upgradeInfo ? getLocalizedText(upgradeInfo.name) : u.upgrade_id;
            const percentage = (u.purchase_count / topUpgradeCount) * 100;
            return `
                <div class="row g-2 align-items-center mb-3">
                    <div class="col-auto">
                        <span class="text-sm">${name}:</span>
                    </div>
                    <div class="col">
                        <div class="progress progress-sm">
                            <div class="progress-bar" style="width: ${percentage}%" role="progressbar" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('') || `<p class="text-secondary" data-translate="no_data">${t('no_data')}</p>`;

        const broadcastCardHtml = `
            <div class="card">
                <div class="card-header"><h3 class="card-title" data-translate="broadcast_message">Массовая рассылка</h3></div>
                <div class="card-body">
                    <p class="text-secondary" data-translate="broadcast_message_desc">Отправьте сообщение всем пользователям бота.</p>
                    <div class="mb-3">
                        <label class="form-label" data-translate="message_text">Текст сообщения</label>
                        <textarea id="broadcast-text" class="form-control" rows="4"></textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label" data-translate="image_url_optional">URL изображения (необязательно)</label>
                        <input type="text" id="broadcast-image-url" class="form-control" placeholder="https://example.com/image.png">
                    </div>
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label class="form-label" data-translate="button_url_optional">URL кнопки (необязательно)</label>
                            <input type="text" id="broadcast-button-url" class="form-control" placeholder="https://t.me/yourchannel">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label" data-translate="button_text_optional">Текст кнопки (необязательно)</label>
                            <input type="text" id="broadcast-button-text" class="form-control">
                        </div>
                    </div>
                    <button class="btn btn-primary w-100" data-action="send-broadcast">
                        <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-send" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></svg>
                        <span data-translate="send_broadcast">Отправить рассылку</span>
                    </button>
                </div>
            </div>
        `;
        
        const aiCardHtml = `
            <div class="card">
                <div class="card-header"><h3 class="card-title" data-translate="ai_content_generation">AI Content Generation</h3></div>
                <div class="card-body">
                    <p class="text-secondary" data-translate="ai_generate_desc_v2">Enter a prompt to generate any type of game content (upgrades, tasks, boosts, etc.). The AI will attempt to create balanced and thematic items based on your request.</p>
                    <div class="mb-3">
                        <label class="form-label" data-translate="ai_prompt">Prompt</label>
                        <textarea id="ai-custom-prompt" class="form-control" rows="4" placeholder="${t('ai_prompt_placeholder')}"></textarea>
                    </div>
                    <button class="btn btn-primary w-100" data-action="generate-ai-content">
                        <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-sparkles" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z" /><path d="M8 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z" /><path d="M12 12a5 5 0 0 1 5 5a5 5 0 0 1 5 -5a5 5 0 0 1 -5 -5a5 5 0 0 1 -5 5z" /></svg>
                        <span data-translate="generate_new_content">Generate New Content</span>
                    </button>
                </div>
            </div>
        `;

        tabContainer.innerHTML = `
            <div id="dashboard-layout">
                <div class="row row-deck row-cards kpi-row">
                    ${kpiHtml}
                </div>
                <div class="row main-content-row">
                    <div class="col-lg-4">
                        <div class="card">
                            <div class="card-body">
                                <h3 class="card-title" data-translate="youtube_stats">Статистика YouTube</h3>
                                <dl class="row">
                                    <dt class="col-8" data-translate="social_youtube_subs">Подписчики:</dt><dd class="col-4 text-end">${formatNumber(socialStats.youtubeSubscribers)}</dd>
                                    <dt class="col-8" data-translate="views">Просмотры:</dt><dd class="col-4 text-end">${formatNumber(socialStats.youtubeViews)}</dd>
                                </dl>
                                 <button class="btn btn-sm w-100 mt-2" data-action="edit-socials" data-social="youtube" data-translate="edit">Редактировать</button>
                            </div>
                        </div>
                         <div class="card">
                            <div class="card-body">
                                <h3 class="card-title" data-translate="telegram_stats">Статистика Telegram</h3>
                                 <dl class="row">
                                    <dt class="col-8" data-translate="social_telegram_subs">Подписчики:</dt><dd class="col-4 text-end">${formatNumber(socialStats.telegramSubscribers)}</dd>
                                </dl>
                                <button class="btn btn-sm w-100 mt-2" data-action="edit-socials" data-social="telegram" data-translate="edit">Редактировать</button>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-body">
                                <h3 class="card-title" data-translate="top_5_upgrades">Топ 5 улучшений по покупкам</h3>
                                ${topUpgradesHtml}
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-body">
                                <h3 class="card-title" data-translate="loading_screen_image_url">URL изображения экрана загрузки</h3>
                                <input type="text" class="form-control" id="loadingScreenUrl" value="${escapeHtml(localConfig.loadingScreenImageUrl || '')}">
                            </div>
                        </div>
                         <div class="card">
                            <div class="card-body">
                                <h3 class="card-title" data-translate="background_audio_url">URL фоновой музыки</h3>
                                <input type="text" class="form-control" id="backgroundAudioUrl" value="${escapeHtml(localConfig.backgroundAudioUrl || '')}">
                            </div>
                        </div>
                         <div class="card">
                            <div class="card-body">
                                <h3 class="card-title" data-translate="final_video_url">URL финального видео</h3>
                                <input type="text" class="form-control" id="finalVideoUrl" value="${escapeHtml(localConfig.finalVideoUrl || '')}">
                            </div>
                        </div>
                        ${aiCardHtml}
                    </div>
                    <div class="col-lg-8">
                        <div class="card card-grow">
                             <div class="card-body d-flex flex-column">
                                <h3 class="card-title" data-translate="new_users_last_7_days">Новые игроки (7 дней)</h3>
                                <div class="flex-grow-1" style="position: relative;">
                                    <canvas id="chart-registrations" style="position: absolute; width: 100%; height: 100%;"></canvas>
                                </div>
                            </div>
                        </div>
                        ${broadcastCardHtml}
                    </div>
                </div>
                <div class="row row-cards map-row">
                    <div class="col-12">
                        <div class="card h-100">
                             <div class="card-body d-flex flex-column">
                                <h3 class="card-title" data-translate="player_map">Карта игроков</h3>
                                <div id="map-world" class="w-100 h-100 flex-grow-1"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Render charts
        if (dashboardStats.registrations) {
            const ctx = document.getElementById('chart-registrations').getContext('2d');
            charts.registrations = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dashboardStats.registrations.map(r => new Date(r.date).toLocaleDateString(currentLang, {day: '2-digit', month: '2-digit'})),
                    datasets: [{
                        label: t('new_players_24h'),
                        data: dashboardStats.registrations.map(r => r.count),
                        borderColor: 'var(--accent-green)',
                        backgroundColor: 'rgba(74, 222, 128, 0.1)',
                        tension: 0.3,
                        fill: true,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' } },
                        x: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' } }
                    }
                }
            });
        }

        // Render map
        const mapEl = document.getElementById('map-world');
        if (mapEl && window.jsVectorMap) {
            const mapData = playerLocations.reduce((acc, loc) => {
                acc[loc.country.toUpperCase()] = loc.player_count;
                return acc;
            }, {});
            
            charts.map = new jsVectorMap({
                selector: '#map-world',
                map: 'world',
                backgroundColor: 'transparent',
                regionStyle: {
                    initial: { fill: 'var(--bg-card-hover)' },
                    hover: { fill: 'var(--accent-green-glow)' }
                },
                series: {
                    regions: [{
                        values: mapData,
                        scale: ['#374151', '#4ade80'],
                        normalizeFunction: 'polynomial'
                    }]
                },
                onRegionTooltipShow(event, tooltip, code) {
                    tooltip.text(
                        `${tooltip.text()} (${(mapData[code] || 0).toLocaleString()} players)`,
                        true,
                    );
                },
            });
        }
        applyTranslationsToDOM();
    };

    const renderPlayers = async () => {
        showLoading();
        allPlayers = await fetchData('players') || [];
        
        const tableHeader = `
            <div class="card">
                <div class="card-header">
                    <div class="input-icon">
                        <span class="input-icon-addon">
                            <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"></path><path d="M21 21l-6 -6"></path></svg>
                        </span>
                        <input type="text" id="player-search" class="form-control" placeholder="${t('search_by_id_name')}" aria-label="Search players">
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table card-table table-vcenter text-nowrap datatable">
                        <thead>
                            <tr>
                                <th>${t('id')}</th>
                                <th>${t('name')}</th>
                                <th>${t('balance')}</th>
                                <th>${t('profit_ph')}</th>
                                <th>${t('referrals')}</th>
                                <th>${t('language')}</th>
                                <th>TON Wallet</th>
                                <th>${t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody id="players-table-body">
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        tabContainer.innerHTML = tableHeader;
        renderPlayersTable(allPlayers);
    };
    
    const renderPlayersTable = (players) => {
        const tableBody = document.getElementById('players-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = players.map(player => `
            <tr>
                <td><span class="text-secondary">${player.id}</span></td>
                <td>${escapeHtml(player.name)}</td>
                <td>${formatNumber(player.balance)}</td>
                <td>${formatNumber(player.profitPerHour)}</td>
                <td>${player.referrals}</td>
                <td><span class="flag flag-country-${player.language === 'en' ? 'us' : player.language}"></span> ${player.language}</td>
                <td>
                    ${player.tonWalletAddress ? `
                        <div class="d-flex align-items-center">
                            <code class="text-secondary me-2" title="${escapeHtml(player.tonWalletAddress)}">${player.tonWalletAddress.slice(0, 6)}...${player.tonWalletAddress.slice(-4)}</code>
                            <button class="btn btn-sm btn-icon" data-action="copy-wallet" data-wallet="${escapeHtml(player.tonWalletAddress)}" title="${t('copy_wallet_address')}">
                                <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" /></svg>
                            </button>
                        </div>
                    ` : 'N/A'}
                </td>
                <td>
                    <button class="btn btn-sm" data-action="player-details" data-id="${player.id}">${t('details')}</button>
                </td>
            </tr>
        `).join('');
    };

    const renderCheaters = async () => {
        showLoading('loading_cheaters');
        const cheaters = await fetchData('cheaters');
        
        tabContainer.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title" data-translate="cheater_list"></h3>
                </div>
                 <div class="card-body">
                    <p class="text-secondary" data-translate="cheater_list_desc"></p>
                </div>
                <div class="table-responsive">
                    <table class="table card-table table-vcenter">
                        <thead>
                            <tr>
                                <th>${t('id')}</th>
                                <th>${t('name')}</th>
                                <th>${t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cheaters && cheaters.length > 0 ? cheaters.map(cheater => `
                                <tr>
                                    <td>${cheater.id}</td>
                                    <td>${escapeHtml(cheater.name)}</td>
                                    <td>
                                        <button class="btn btn-sm btn-warning" data-action="player-details" data-id="${cheater.id}">${t('details')}</button>
                                        <button class="btn btn-sm btn-danger ms-2" data-action="reset-progress" data-id="${cheater.id}">${t('reset_progress')}</button>
                                    </td>
                                </tr>
                            `).join('') : `<tr><td colspan="3" class="text-center text-secondary">${t('no_cheaters_found')}</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        applyTranslationsToDOM();
    };

    const renderVideoModeration = async () => {
        showLoading('loading_submissions');
        const submissions = await fetchData('video-submissions');

        const getStatusBadge = (status) => {
            switch (status) {
                case 'pending': return `<span class="badge bg-yellow-lt">${t('status_pending')}</span>`;
                case 'approved': return `<span class="badge bg-green-lt">${t('status_approved')}</span>`;
                case 'rejected': return `<span class="badge bg-red-lt">${t('status_rejected')}</span>`;
                default: return status;
            }
        };

        const tableRows = submissions && submissions.length > 0
            ? submissions.map(sub => `
                <tr>
                    <td>${escapeHtml(sub.player_name)}</td>
                    <td><a href="${escapeHtml(sub.video_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sub.video_url)}</a></td>
                    <td>${getStatusBadge(sub.status)}</td>
                    <td>${new Date(sub.submitted_at).toLocaleString()}</td>
                    <td>${sub.status === 'approved' ? formatNumber(sub.reward_amount) : 'N/A'}</td>
                    <td>
                        ${sub.status === 'pending' ? `
                            <button class="btn btn-sm btn-success" data-action="approve-video" data-id="${sub.id}">${t('approve')}</button>
                            <button class="btn btn-sm btn-danger ms-2" data-action="reject-video" data-id="${sub.id}">${t('reject')}</button>
                        ` : ''}
                    </td>
                </tr>
            `).join('')
            : `<tr><td colspan="6" class="text-center text-secondary">${t('no_submissions')}</td></tr>`;

        tabContainer.innerHTML = `
            <div class="card">
                <div class="card-header"><h3 class="card-title" data-translate="video_moderation"></h3></div>
                <div class="card-body"><p class="text-secondary" data-translate="video_moderation_desc"></p></div>
                <div class="table-responsive">
                    <table class="table card-table table-vcenter">
                        <thead>
                            <tr>
                                <th>${t('player_name')}</th>
                                <th>${t('video_url')}</th>
                                <th>${t('status')}</th>
                                <th>${t('submitted_at')}</th>
                                <th>${t('reward_amount')}</th>
                                <th>${t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            </div>
        `;
        applyTranslationsToDOM();
    };

    const renderWithdrawalRequests = async () => {
        showLoading('loading');
        const requests = await fetchData('withdrawal-requests');

        const getStatusBadge = (status) => {
            switch (status) {
                case 'pending': return `<span class="badge bg-yellow-lt">${t('status_pending')}</span>`;
                case 'approved': return `<span class="badge bg-green-lt">${t('status_approved')}</span>`;
                case 'rejected': return `<span class="badge bg-red-lt">${t('status_rejected')}</span>`;
                default: return status;
            }
        };

        const tableRows = requests && requests.length > 0
            ? requests.map(req => `
                <tr>
                    <td>${escapeHtml(req.player_name)}</td>
                    <td><code class="text-secondary" title="${escapeHtml(req.ton_wallet)}">${escapeHtml(req.ton_wallet)}</code></td>
                    <td>${formatNumber(req.amount_credits)}</td>
                    <td>${getStatusBadge(req.status)}</td>
                    <td>${new Date(req.created_at).toLocaleString()}</td>
                    <td>
                        ${req.status === 'pending' ? `
                            <button class="btn btn-sm btn-success" data-action="approve-withdrawal" data-id="${req.id}">${t('approve')}</button>
                            <button class="btn btn-sm btn-danger ms-2" data-action="reject-withdrawal" data-id="${req.id}">${t('reject')}</button>
                        ` : (req.processed_at ? new Date(req.processed_at).toLocaleString() : '')}
                    </td>
                </tr>
            `).join('')
            : `<tr><td colspan="6" class="text-center text-secondary">${t('no_withdrawal_requests')}</td></tr>`;

        tabContainer.innerHTML = `
            <div class="card">
                <div class="card-header"><h3 class="card-title" data-translate="withdrawal_requests"></h3></div>
                <div class="card-body"><p class="text-secondary" data-translate="withdrawal_requests_desc"></p></div>
                <div class="table-responsive">
                    <table class="table card-table table-vcenter">
                        <thead>
                            <tr>
                                <th>${t('player_name')}</th>
                                <th>${t('wallet_address')}</th>
                                <th>${t('amount')}</th>
                                <th>${t('status')}</th>
                                <th>${t('requested_at')}</th>
                                <th>${t('actions')} / ${t('processed_at')}</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            </div>
        `;
        applyTranslationsToDOM();
    };
    
    const renderDailyEvents = async () => {
        dailyEvent = await fetchData('daily-events') || { combo_ids: [], cipher_word: '', combo_reward: 5000000, cipher_reward: 1000000 };
        const allUpgrades = [...(localConfig.upgrades || []), ...(localConfig.blackMarketCards || [])];

        const cardOptions = allUpgrades.map(u => `<option value="${u.id}">${getLocalizedText(u.name)}</option>`).join('');

        const comboSelectors = [0, 1, 2].map(i => `
            <div class="col-md-4">
                <select class="form-select combo-card-select" data-index="${i}">
                    <option value="" data-translate="select_card">${t('select_card')}</option>
                    ${cardOptions}
                </select>
            </div>
        `).join('');

        tabContainer.innerHTML = `
            <div class="container-xl">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title" data-translate="daily_events_setup"></h3>
                    </div>
                    <div class="card-body">
                        <fieldset class="form-fieldset">
                             <legend data-translate="daily_combo"></legend>
                             <p class="text-secondary mb-3" data-translate="select_3_cards_for_combo"></p>
                             <div class="row g-2 mb-3">
                                ${comboSelectors}
                             </div>
                             <div class="mb-3">
                                 <label class="form-label" data-translate="combo_reward"></label>
                                 <input type="number" class="form-control" id="combo-reward-input" value="${escapeHtml(dailyEvent.combo_reward)}">
                             </div>
                        </fieldset>
                        <fieldset class="form-fieldset">
                            <legend data-translate="daily_cipher"></legend>
                            <p class="text-secondary mb-3" data-translate="enter_cipher_word"></p>
                             <div class="mb-3">
                                 <label class="form-label" data-translate="cipher_word"></label>
                                 <input type="text" class="form-control" id="cipher-word-input" placeholder="${t('example_btc')}" value="${escapeHtml(dailyEvent.cipher_word)}">
                             </div>
                             <div class="mb-3">
                                 <label class="form-label" data-translate="cipher_reward"></label>
                                 <input type="number" class="form-control" id="cipher-reward-input" value="${escapeHtml(dailyEvent.cipher_reward)}">
                             </div>
                        </fieldset>
                    </div>
                </div>
            </div>
        `;
        
        document.querySelectorAll('.combo-card-select').forEach((select, index) => {
            if (dailyEvent.combo_ids && dailyEvent.combo_ids[index]) {
                select.value = dailyEvent.combo_ids[index];
            }
        });

        applyTranslationsToDOM();
    };
    
    const renderCellAnalytics = async () => {
        showLoading();
        const analytics = await fetchData('cell-analytics');
        if (!analytics) return;

        const kpiHtml = `
            <div class="col"><div class="card card-sm"><div class="card-body"><div class="subheader">${t('kpi_totalCells')}</div><div class="h1 mb-3">${formatNumber(analytics.kpi.totalCells)}</div></div></div></div>
            <div class="col"><div class="card card-sm"><div class="card-body"><div class="subheader">${t('kpi_battleParticipants')}</div><div class="h1 mb-3">${formatNumber(analytics.kpi.battleParticipants)}</div></div></div></div>
            <div class="col"><div class="card card-sm"><div class="card-body"><div class="subheader">${t('kpi_totalBank')}</div><div class="h1 mb-3">${formatNumber(analytics.kpi.totalBank)}</div></div></div></div>
            <div class="col"><div class="card card-sm"><div class="card-body"><div class="subheader">${t('kpi_ticketsSpent')}</div><div class="h1 mb-3">${formatNumber(analytics.kpi.ticketsSpent)}</div></div></div></div>
        `;

        const leaderboardHtml = analytics.leaderboard.map(cell => `
            <tr>
                <td>${cell.id}</td>
                <td>${escapeHtml(cell.name)}</td>
                <td>${formatNumber(cell.members)}</td>
                <td>${formatNumber(cell.balance)}</td>
                <td>${formatNumber(cell.total_profit)}</td>
            </tr>
        `).join('') || `<tr><td colspan="5" class="text-center">${t('no_data')}</td></tr>`;
        
        const historyHtml = analytics.battleHistory.map(battle => {
            const winner = battle.winner_details?.firstPlace;
            return `
                 <tr>
                    <td>${battle.id}</td>
                    <td>${new Date(battle.end_time).toLocaleString()}</td>
                    <td>${winner ? `${escapeHtml(winner.name)} (${formatNumber(winner.score)} pts)` : 'N/A'}</td>
                </tr>
            `
        }).join('') || `<tr><td colspan="3" class="text-center">${t('no_data')}</td></tr>`;

        tabContainer.innerHTML = `
            <div class="container-xl">
                 <div class="row row-deck row-cards">${kpiHtml}</div>
                 <div class="row mt-4">
                     <div class="col-lg-7">
                         <div class="card">
                             <div class="card-header"><h3 class="card-title">${t('cell_leaderboard')}</h3></div>
                             <div class="table-responsive">
                                 <table class="table card-table table-vcenter">
                                     <thead><tr><th>ID</th><th>${t('cell_name')}</th><th>${t('members')}</th><th>${t('cell_bank')}</th><th>${t('total_profit')}</th></tr></thead>
                                     <tbody>${leaderboardHtml}</tbody>
                                 </table>
                             </div>
                         </div>
                     </div>
                      <div class="col-lg-5">
                         <div class="card">
                             <div class="card-header"><h3 class="card-title">${t('battle_history')}</h3></div>
                             <div class="table-responsive">
                                 <table class="table card-table table-vcenter">
                                     <thead><tr><th>ID</th><th>${t('battle_date')}</th><th>${t('winner')}</th></tr></thead>
                                     <tbody>${historyHtml}</tbody>
                                 </table>
                             </div>
                         </div>
                     </div>
                 </div>
            </div>
        `;
        applyTranslationsToDOM();
    };

    const renderCellConfiguration = async () => {
        showLoading();
        const battleStatus = await fetchData('battle/status');
        const config = localConfig;
        
        const schedule = config.battleSchedule || {};
        const rewards = config.battleRewards || {};
        
        const freqOptions = ['weekly', 'biweekly', 'monthly'].map(f => `<option value="${f}" ${schedule.frequency === f ? 'selected' : ''}>${t(`freq_${f}`)}</option>`).join('');
        const dayOptions = [
            {val: 0, key: 'day_sun'}, {val: 1, key: 'day_mon'}, {val: 2, key: 'day_tue'}, {val: 3, key: 'day_wed'},
            {val: 4, key: 'day_thu'}, {val: 5, key: 'day_fri'}, {val: 6, key: 'day_sat'}
        ].map(d => `<option value="${d.val}" ${schedule.dayOfWeek == d.val ? 'selected' : ''}>${t(d.key)}</option>`).join('');

        tabContainer.innerHTML = `
            <div class="container-xl">
                <div class="row">
                    <div class="col-md-6">
                        <fieldset class="form-fieldset">
                             <legend>${t('battle_management')}</legend>
                             <p class="text-secondary">${t('battle_status')}: <strong class="${battleStatus?.status?.isActive ? 'text-success' : 'text-warning'}">${battleStatus?.status?.isActive ? t('battle_status_active') : t('battle_status_inactive')}</strong></p>
                             <div class="d-flex gap-2">
                                <button class="btn btn-success flex-fill" data-action="force-start-battle">${t('force_start_battle')}</button>
                                <button class="btn btn-danger flex-fill" data-action="force-end-battle">${t('force_end_battle')}</button>
                             </div>
                        </fieldset>
                    </div>
                    <div class="col-md-6">
                         <fieldset class="form-fieldset">
                             <legend>${t('cell_economy')}</legend>
                             <div class="mb-3"><label class="form-label">${t('informant_bonus_percent')}</label><input type="number" class="form-control" data-config-key="informantProfitBonus" value="${config.informantProfitBonus || 0}"></div>
                             <div><label class="form-label">${t('bank_tax_percent')}</label><input type="number" class="form-control" data-config-key="cellBankProfitShare" value="${config.cellBankProfitShare || 0}"></div>
                        </fieldset>
                    </div>
                </div>
                 <div class="row mt-4">
                     <div class="col-12">
                         <fieldset class="form-fieldset">
                             <legend>${t('battle_schedule')}</legend>
                             <div class="row">
                                <div class="col-md-3 mb-3"><label class="form-label">${t('schedule_frequency')}</label><select class="form-select" data-schedule-key="frequency">${freqOptions}</select></div>
                                <div class="col-md-3 mb-3"><label class="form-label">${t('schedule_day')}</label><select class="form-select" data-schedule-key="dayOfWeek">${dayOptions}</select></div>
                                <div class="col-md-3 mb-3"><label class="form-label">${t('schedule_time_utc')}</label><input type="number" class="form-control" data-schedule-key="startHourUTC" value="${schedule.startHourUTC || 18}" min="0" max="23"></div>
                                <div class="col-md-3 mb-3"><label class="form-label">${t('schedule_duration_hours')}</label><input type="number" class="form-control" data-schedule-key="durationHours" value="${schedule.durationHours || 24}"></div>
                             </div>
                         </fieldset>
                     </div>
                 </div>
                  <div class="row mt-4">
                     <div class="col-12">
                         <fieldset class="form-fieldset">
                             <legend>${t('battle_rewards')}</legend>
                             <div class="row">
                                <div class="col-md-3 mb-3"><label class="form-label">${t('first_place_reward')}</label><input type="number" class="form-control" data-reward-key="firstPlace" value="${rewards.firstPlace || 0}"></div>
                                <div class="col-md-3 mb-3"><label class="form-label">${t('second_place_reward')}</label><input type="number" class="form-control" data-reward-key="secondPlace" value="${rewards.secondPlace || 0}"></div>
                                <div class="col-md-3 mb-3"><label class="form-label">${t('third_place_reward')}</label><input type="number" class="form-control" data-reward-key="thirdPlace" value="${rewards.thirdPlace || 0}"></div>
                                <div class="col-md-3 mb-3"><label class="form-label">${t('participant_reward')}</label><input type="number" class="form-control" data-reward-key="participant" value="${rewards.participant || 0}"></div>
                             </div>
                         </fieldset>
                     </div>
                 </div>
            </div>
        `;
        applyTranslationsToDOM();
    };

    const renderGenericSettingsForm = (key, fields, titleKey) => {
        const formFields = fields.map(field => `
            <div class="mb-3">
                <label for="${field}" class="form-label">${t(field)}</label>
                <input type="number" class="form-control" id="${field}" data-config-key="${field}" value="${escapeHtml(localConfig[field] || 0)}">
                <small class="form-hint">${t(`${field}_desc`)}</small>
            </div>
        `).join('');

        tabContainer.innerHTML = `
            <div class="container-xl">
                <div class="card">
                    <div class="card-header"><h3 class="card-title">${t(titleKey)}</h3></div>
                    <div class="card-body">
                        ${formFields}
                    </div>
                </div>
            </div>
        `;
        applyTranslationsToDOM();
    };

    const renderUiIconsConfig = () => {
        const renderGroup = (groupKey, iconsObject) => {
            const fields = Object.entries(iconsObject).map(([key, value]) => {
                if (value === undefined) return ''; // Skip rendering if the key doesn't exist
                const escapedValue = escapeHtml(value);
                const uniqueId = `icon-preview-${groupKey}-${key}`;
                return `
                    <div class="col-md-6 mb-3">
                        <label class="form-label">${t(`icon_${groupKey}_${key}`)}</label>
                        <div class="input-group">
                            <input type="text" class="form-control" data-icon-group="${groupKey}" data-icon-key="${key}" value="${escapedValue}" oninput="document.getElementById('${uniqueId}').src = this.value">
                            <span class="input-group-text">
                                <img id="${uniqueId}" src="${escapedValue}" alt="preview" style="width: 20px; height: 20px; object-fit: contain; background: #333;">
                            </span>
                        </div>
                    </div>
                `;
            }).join('');
            return `
                <fieldset class="form-fieldset">
                    <legend>${t(`icon_group_${groupKey}`)}</legend>
                    <div class="row">${fields}</div>
                </fieldset>
            `;
        };

        const { nav, profile_tabs, ...rest } = localConfig.uiIcons || { nav: {}, profile_tabs: {} };
        const generalIcons = { ...rest };

        const navHtml = renderGroup('nav', nav);
        const profileTabsHtml = renderGroup('profile_tabs', profile_tabs);
        
        const gameplayGroup = {
            energy: generalIcons.energy, coin: generalIcons.coin, star: generalIcons.star, suspicion: generalIcons.suspicion,
        };
        const marketGroup = {
            marketCoinBox: generalIcons.marketCoinBox, marketStarBox: generalIcons.marketStarBox,
        };
        const generalGroup = {
            soundOn: generalIcons.soundOn, soundOff: generalIcons.soundOff, secretCodeEntry: generalIcons.secretCodeEntry, languageSwitcher: generalIcons.languageSwitcher, wallet: generalIcons.wallet,
        };
        
        const gameplayHtml = renderGroup('gameplay', gameplayGroup);
        const marketHtml = renderGroup('market', marketGroup);
        const generalHtml = renderGroup('general', generalGroup);

        tabContainer.innerHTML = `
            <div class="container-xl">
                 <div class="card">
                    <div class="card-header"><h3 class="card-title">${t('nav_ui_icons')}</h3></div>
                    <div class="card-body">
                        ${navHtml}
                        ${profileTabsHtml}
                        ${gameplayHtml}
                        ${marketHtml}
                        ${generalHtml}
                    </div>
                 </div>
            </div>
        `;
        applyTranslationsToDOM();
    };
    
    const formatCellContent = (value, colKey) => {
        if (value === null || value === undefined) return '';

        // Handle specific object types by key
        if (typeof value === 'object') {
            if (colKey === 'reward' && value.type && value.amount !== undefined) {
                const typeText = t('reward_type_' + value.type) || value.type;
                return `${formatNumber(value.amount)} (${typeText})`;
            }
            if (colKey === 'trigger' && value.type && value.params) {
                let paramsStr = Object.entries(value.params).map(([k, v]) => `${k}: ${v}`).join(', ');
                return `<span class="d-block text-nowrap"><strong>${value.type}</strong></span><small class="text-secondary">${paramsStr}</small>`;
            }
            if (value.hasOwnProperty('en') || value.hasOwnProperty('ru') || value.hasOwnProperty('ua')) {
                const en = escapeHtml(value.en || '');
                const ua = escapeHtml(value.ua || '');
                const ru = escapeHtml(value.ru || '');
                return `<div class="d-flex flex-column" style="font-size: 0.8em; line-height: 1.2;">
                            <span class="text-muted">EN: <span class="text-white">${en}</span></span>
                            <span class="text-muted">UA: <span class="text-white">${ua}</span></span>
                            <span class="text-muted">RU: <span class="text-white">${ru}</span></span>
                        </div>`;
            }
            // Fallback for other objects
            return `<code class="text-secondary" style="white-space: normal; word-break: break-all;">${escapeHtml(JSON.stringify(value))}</code>`;
        }
        
        // Handle booleans
        if (typeof value === 'boolean') {
            return value ? `<span class="badge bg-success-lt">${t('yes')}</span>` : ``;
        }

        // Handle images
        const colLower = colKey.toLowerCase();
        if ((colLower.includes('iconurl') || colLower.includes('imageurl')) && typeof value === 'string' && value) {
            if (value.startsWith('http') || value.startsWith('/')) {
                 return `<img src="${escapeHtml(value)}" alt="icon" style="width: 40px; height: 40px; object-fit: contain; background: #333; border-radius: 4px; padding: 2px;">`;
            }
        }
        
        // Default for strings, numbers
        return escapeHtml(value);
    };

    const renderConfigTable = (key) => {
        const { titleKey, cols } = configMeta[key];
        const items = localConfig[key] || [];

        const tableHeaders = cols.map(col => `<th>${t(col)}</th>`).join('') + `<th>${t('actions')}</th>`;
        const tableRows = items.map((item, index) => `
            <tr>
                ${cols.map(col => `<td>${formatCellContent(item[col], col)}</td>`).join('')}
                <td>
                    <button class="btn btn-sm" data-action="edit-config" data-key="${key}" data-index="${index}">${t('edit')}</button>
                    <button class="btn btn-sm btn-danger ms-2" data-action="delete-config" data-key="${key}" data-index="${index}">${t('delete')}</button>
                </td>
            </tr>
        `).join('');

        tabContainer.innerHTML = `
            <div class="container-xl">
                <div class="card">
                    <div class="card-header">
                         <h3 class="card-title">${t(titleKey)}</h3>
                         <div class="ms-auto">
                            <button class="btn btn-primary" data-action="add-config" data-key="${key}">${t('add_new')}</button>
                         </div>
                    </div>
                    <div class="table-responsive">
                        <table class="table card-table table-vcenter">
                            <thead><tr>${tableHeaders}</tr></thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        applyTranslationsToDOM();
    };
    
    // --- MODALS ---
    const renderPlayerDetailsModal = async (userId) => {
        const details = await fetchData(`player/${userId}/details`);
        if (!details) return;

        const allUpgradesMap = new Map([...(localConfig.upgrades || []), ...(localConfig.blackMarketCards || [])].map(u => [u.id, u]));
        const upgradesHtml = Object.entries(details.upgrades || {}).map(([id, level]) => {
            const upgradeInfo = allUpgradesMap.get(id);
            return `<li><strong>${upgradeInfo ? getLocalizedText(upgradeInfo.name) : id}:</strong> ${t('level')} ${level}</li>`;
        }).join('') || `<li>${t('no_data')}</li>`;
        
        const cheatLogHtml = (details.cheatLog || []).map(log => `
            <li class="text-warning small">
                ${new Date(log.timestamp).toLocaleString()}: ${log.tps.toFixed(2)} TPS (${log.taps} taps / ${log.timeDiff.toFixed(2)}s)
            </li>
        `).join('') || `<li>${t('no_data')}</li>`;

        const modalHtml = `
            <div class="modal fade show" style="display: block;" tabindex="-1" id="player-details-modal">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${t('player_details')}: ${escapeHtml(details.name)}</h5>
                            <button type="button" class="btn-close" data-action="close-modal"></button>
                        </div>
                        <div class="modal-body">
                           <div class="row">
                               <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">${t('current_balance')}</label>
                                        <input type="text" class="form-control" value="${formatNumber(details.balance)}" readonly>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">${t('suspicion')}</label>
                                        <input type="text" class="form-control" value="${formatNumber(details.suspicion || 0)}" readonly>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">${t('bonus_amount')}</label>
                                        <input type="number" id="bonus-amount-input" class="form-control" placeholder="e.g., 10000 or -5000">
                                    </div>
                                    <button class="btn btn-primary w-100" data-action="add-player-bonus" data-id="${details.id}">${t('add_bonus')}</button>
                                    <hr class="my-4">
                                    <div class="d-flex gap-2">
                                        <button class="btn btn-warning w-100" data-action="reset-player-daily" data-id="${details.id}">${t('reset_daily')}</button>
                                        <button class="btn btn-danger w-100" data-action="delete-player" data-id="${details.id}">${t('delete')}</button>
                                    </div>
                               </div>
                               <div class="col-md-6">
                                    <h6>${t('player_upgrades')}</h6>
                                    <ul class="list-unstyled overflow-auto" style="max-height: 150px;">${upgradesHtml}</ul>
                                    <h6 class="mt-3">${t('cheat_log')}</h6>
                                    <ul class="list-unstyled overflow-auto" style="max-height: 150px;">${cheatLogHtml}</ul>
                               </div>
                           </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        modalsContainer.innerHTML = modalHtml;
        const modalEl = document.getElementById('player-details-modal');
        const modalInstance = new bootstrap.Modal(modalEl);
        modalInstance.show();
        modalEl.addEventListener('hidden.bs.modal', () => modalsContainer.innerHTML = '');
    };

    const renderConfigModal = (key, index) => {
        const isNew = index === null;
        const item = isNew ? {} : { ...localConfig[key][index] }; // Create a copy to edit
        const title = isNew ? t('config_add_item') : t('config_edit_item');
        const cols = configMeta[key].cols;

        const formFieldsHtml = cols.map(col => {
            const value = item[col];
            let inputHtml = '';
            
            // Localized String
            if (['name', 'description', 'message'].includes(col)) {
                const valEn = value?.en || '';
                const valUa = value?.ua || '';
                const valRu = value?.ru || '';
                inputHtml = `
                    <div class="input-group mb-2">
                         <span class="input-group-text">EN</span>
                         <input type="text" class="form-control" data-col="${col}" data-lang="en" value="${escapeHtml(valEn)}">
                    </div>
                     <div class="input-group mb-2">
                         <span class="input-group-text">UA</span>
                         <input type="text" class="form-control" data-col="${col}" data-lang="ua" value="${escapeHtml(valUa)}">
                    </div>
                    <div class="input-group">
                         <span class="input-group-text">RU</span>
                         <input type="text" class="form-control" data-col="${col}" data-lang="ru" value="${escapeHtml(valRu)}">
                         <button class="btn" type="button" data-action="translate" data-col="${col}" title="${t('translate')}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-language" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 5h7" /><path d="M9 3v2c0 4.418 -2.239 8 -5 8" /><path d="M5 9c0 2.144 2.952 3.908 6.7 4" /><path d="M12 20l4 -9l4 9" /><path d="M19.1 18h-6.2" /></svg>
                         </button>
                    </div>`;
            } 
            // Select for Category
            else if (col === 'category') {
                const categories = ["Documents", "Legal", "Lifestyle", "Special"];
                const options = categories.map(c => `<option value="${c}" ${value === c ? 'selected' : ''}>${c}</option>`).join('');
                inputHtml = `<select class="form-select" data-col="${col}">${options}</select>`;
            }
            // Select for Task Type
            else if (col === 'type' && ['tasks', 'specialTasks'].includes(key)) {
                const types = ['taps', 'telegram_join', 'video_watch', 'video_code', 'youtube_subscribe', 'twitter_follow', 'instagram_follow'];
                const options = types.map(t => `<option value="${t}" ${value === t ? 'selected' : ''}>${t}</option>`).join('');
                inputHtml = `<select class="form-select" data-col="${col}">${options}</select>`;
            }
            // Select for Box Type
            else if (col === 'boxType') {
                const types = ['coin', 'star', 'direct'];
                const options = types.map(t => `<option value="${t}" ${value === t ? 'selected' : ''}>${t}</option>`).join('');
                inputHtml = `<select class="form-select" data-col="${col}">${options}</select>`;
            }
            // Reward Object
            else if (col === 'reward') {
                const rewardType = value?.type || 'coins';
                const rewardAmount = value?.amount || 0;
                inputHtml = `
                    <div class="input-group">
                        <select class="form-select" data-col="${col}" data-subcol="type">
                            <option value="coins" ${rewardType === 'coins' ? 'selected' : ''}>${t('reward_type_coins')}</option>
                            <option value="profit" ${rewardType === 'profit' ? 'selected' : ''}>${t('reward_type_profit')}</option>
                        </select>
                        <input type="number" class="form-control" data-col="${col}" data-subcol="amount" value="${rewardAmount}">
                    </div>`;
            }
            // Glitch Trigger Object
            else if (col === 'trigger') {
                 // The trigger UI will be dynamically generated based on selected type
                inputHtml = `<div id="trigger-config-area" data-col="trigger">${renderTriggerFields(value)}</div>`;
            }
            // Checkbox for isFinal
            else if (col === 'isFinal') {
                 inputHtml = `<div class="form-check"><input class="form-check-input" type="checkbox" data-col="${col}" ${value ? 'checked' : ''}><label class="form-check-label">${t('is_final_event')}</label></div>`;
            }
             // Image Preview
            else if (col.toLowerCase().includes('iconurl') || col.toLowerCase().includes('imageurl')) {
                 const uniqueId = `modal-preview-${key}-${index}-${col}`;
                 inputHtml = `
                    <div class="input-group">
                        <input type="text" class="form-control" data-col="${col}" value="${escapeHtml(value || '')}" oninput="document.getElementById('${uniqueId}').src = this.value">
                        <span class="input-group-text">
                            <img id="${uniqueId}" src="${escapeHtml(value || '')}" alt="preview" style="width: 20px; height: 20px; object-fit: contain; background: #333;">
                        </span>
                    </div>`;
            }
            // Default input
            else {
                const inputType = (typeof value === 'number' || ['price', 'profitPerHour', 'chance', 'costCoins', 'suspicionModifier', 'maxSupply', 'viewsRequired', 'rewardCoins'].includes(col)) ? 'number' : 'text';
                inputHtml = `<input type="${inputType}" class="form-control" data-col="${col}" value="${escapeHtml(value || '')}">`;
            }

            return `<div class="mb-3"><label class="form-label">${t(col)}</label>${inputHtml}</div>`;
        }).join('');

        const modalHtml = `
            <div class="modal fade show" style="display: block;" tabindex="-1" id="config-modal">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header"><h5 class="modal-title">${title}</h5><button type="button" class="btn-close" data-action="close-modal"></button></div>
                        <div class="modal-body">${formFieldsHtml}</div>
                        <div class="modal-footer">
                            <button type="button" class="btn me-auto" data-action="close-modal">${t('cancel')}</button>
                            <button type="button" class="btn btn-primary" data-action="save-config-item" data-key="${key}" data-index="${isNew ? '' : index}">${t('save')}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        modalsContainer.innerHTML = modalHtml;
        const modalEl = document.getElementById('config-modal');
        const modalInstance = new bootstrap.Modal(modalEl);
        modalInstance.show();
        modalEl.addEventListener('hidden.bs.modal', () => modalsContainer.innerHTML = '');
    };
    
    const renderTriggerFields = (triggerData = {}) => {
        const type = triggerData.type || 'meta_tap';
        const params = triggerData.params || {};

        const typeOptions = ['meta_tap', 'login_at_time', 'balance_equals', 'upgrade_purchased']
            .map(t => `<option value="${t}" ${type === t ? 'selected' : ''}>${t}</option>`).join('');
        
        let paramsHtml = '';
        switch (type) {
            case 'meta_tap':
                const targetOptions = META_TAP_TARGETS.map(t => `<option value="${t.id}" ${params.targetId === t.id ? 'selected': ''}>${t.id}</option>`).join('');
                paramsHtml = `
                    <div class="mb-2"><label class="form-label">${t('param_targetId')}</label><select class="form-select" data-param="targetId">${targetOptions}</select></div>
                    <div><label class="form-label">${t('param_taps')}</label><input type="number" class="form-control" data-param="taps" value="${params.taps || 1}"></div>`;
                break;
            case 'login_at_time':
                 paramsHtml = `
                    <div class="mb-2"><label class="form-label">${t('param_hour')}</label><input type="number" class="form-control" data-param="hour" value="${params.hour || 0}" min="0" max="23"></div>
                    <div><label class="form-label">${t('param_minute')}</label><input type="number" class="form-control" data-param="minute" value="${params.minute || 0}" min="0" max="59"></div>`;
                break;
            case 'balance_equals':
                 paramsHtml = `<div><label class="form-label">${t('param_amount')}</label><input type="number" class="form-control" data-param="amount" value="${params.amount || 0}"></div>`;
                break;
            case 'upgrade_purchased':
                const upgradeOptions = [...(localConfig.upgrades || []), ...(localConfig.blackMarketCards || [])].map(u => `<option value="${u.id}" ${params.upgradeId === u.id ? 'selected' : ''}>${getLocalizedText(u.name)}</option>`).join('');
                 paramsHtml = `<div><label class="form-label">${t('param_upgradeId')}</label><select class="form-select" data-param="upgradeId">${upgradeOptions}</select></div>`;
                break;
        }

        return `
            <div class="mb-3">
                <label class="form-label">${t('trigger_type')}</label>
                <select class="form-select" data-subcol="type" onchange="this.dispatchEvent(new CustomEvent('triggerTypeChange', { bubbles: true }))">
                    ${typeOptions}
                </select>
            </div>
            <div id="trigger-params-container">${paramsHtml}</div>
        `;
    };

    const renderApproveVideoModal = (submissionId) => {
        const modalHtml = `
            <div class="modal fade show" style="display: block;" tabindex="-1" id="approve-video-modal">
                <div class="modal-dialog modal-sm modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header"><h5 class="modal-title">${t('approve_submission')}</h5><button type="button" class="btn-close" data-action="close-modal"></button></div>
                        <div class="modal-body">
                            <label class="form-label">${t('reward_amount')}</label>
                            <input type="number" id="reward-amount-input" class="form-control" value="1000000">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn me-auto" data-action="close-modal">${t('cancel')}</button>
                            <button type="button" class="btn btn-success" data-action="confirm-approve-video" data-id="${submissionId}">${t('approve')}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        modalsContainer.innerHTML = modalHtml;
        const modalEl = document.getElementById('approve-video-modal');
        const modalInstance = new bootstrap.Modal(modalEl);
        modalInstance.show();
        modalEl.addEventListener('hidden.bs.modal', () => modalsContainer.innerHTML = '');
    };
    
    const renderAiContentModal = (content) => {
        let contentHtml = '';
        const contentKeys = Object.keys(content).filter(k => Array.isArray(content[k]) && content[k].length > 0);
        
        if (contentKeys.length === 0) {
            contentHtml = `<p class="text-secondary">${t('ai_no_content_generated')}</p>`;
        } else {
            contentKeys.forEach(key => {
                const items = content[key];
                const titleKey = configMeta[key]?.titleKey || `generated_${key}`; // Fallback title
                contentHtml += `<h4 class="mt-4 mb-2 font-display">${t(titleKey)} (${items.length})</h4>`;
                
                const tableHeaders = configMeta[key] ? configMeta[key].cols.map(col => `<th>${t(col)}</th>`).join('') : '';
                const tableRows = items.map(item => {
                    const rowCells = configMeta[key] 
                        ? configMeta[key].cols.map(col => `<td>${formatCellContent(item[col], col)}</td>`).join('')
                        : `<td>${escapeHtml(JSON.stringify(item))}</td>`; // Fallback for unknown types
                    return `<tr>${rowCells}</tr>`;
                }).join('');
                
                contentHtml += `
                    <div class="table-responsive">
                        <table class="table card-table table-vcenter">
                            <thead><tr>${tableHeaders}</tr></thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>`;
            });
        }
        
        const modalHtml = `
            <div class="modal fade show" style="display: block;" tabindex="-1" id="ai-content-modal">
                <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${t('ai_generated_content')}</h5>
                            <button type="button" class="btn-close" data-action="close-modal"></button>
                        </div>
                        <div class="modal-body">${contentHtml}</div>
                        <div class="modal-footer">
                             <button type="button" class="btn me-auto" data-action="close-modal">${t('close')}</button>
                            ${contentKeys.length > 0 ? `<button type="button" class="btn btn-success" data-action="add-ai-content">${t('add_to_game')}</button>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;
            
        modalsContainer.innerHTML = modalHtml;
        const modalEl = document.getElementById('ai-content-modal');
        const modalInstance = new bootstrap.Modal(modalEl);
        modalInstance.show();
        modalEl.addEventListener('hidden.bs.modal', () => {
            modalsContainer.innerHTML = '';
            lastAiContent = null;
        });
        applyTranslationsToDOM();
    };

    const init = async () => {
        showLoading();
        localConfig = await fetchData('config') || {};
        const hash = window.location.hash.slice(1);
        if (configMeta[hash] || ['players', 'cheaters', 'dailyEvents', 'cellAnalytics', 'cellConfiguration', 'videoModeration', 'withdrawalRequests'].includes(hash)) {
            activeTab = hash;
        }
        render();

        // --- Event Listeners (Delegated) ---
        document.body.addEventListener('click', async e => {
            const actionTarget = e.target.closest('[data-action]');
            if (!actionTarget) return;

            const { action, id, key, index, lang, social } = actionTarget.dataset;

            switch (action) {
                case 'close-modal':
                    bootstrap.Modal.getInstance(actionTarget.closest('.modal'))?.hide();
                    break;
                case 'player-details':
                    renderPlayerDetailsModal(id);
                    break;
                case 'add-player-bonus': {
                    const amount = document.getElementById('bonus-amount-input').value;
                    if (!amount) return;
                    await postData(`player/${id}/update-balance`, { amount: Number(amount) });
                    alert(t('balance_updated'));
                    bootstrap.Modal.getInstance(document.getElementById('player-details-modal'))?.hide();
                    renderPlayers();
                    break;
                }
                case 'delete-player':
                    if (confirm(t('confirm_delete_player'))) {
                        await deleteData(`player/${id}`);
                        bootstrap.Modal.getInstance(document.getElementById('player-details-modal'))?.hide();
                        renderPlayers();
                    }
                    break;
                case 'reset-player-daily':
                     if (confirm(t('confirm_reset_daily'))) {
                         await postData(`player/${id}/reset-daily`);
                         alert(t('daily_progress_reset_success'));
                         bootstrap.Modal.getInstance(document.getElementById('player-details-modal'))?.hide();
                     }
                    break;
                 case 'reset-progress':
                     if(confirm(t('confirm_reset_progress'))) {
                        await postData(`player/${id}/reset-progress`);
                        alert(t('progress_reset_success'));
                        if (activeTab === 'cheaters') renderCheaters();
                     }
                    break;
                case 'add-config':
                    renderConfigModal(key, null);
                    break;
                case 'edit-config':
                    renderConfigModal(key, index);
                    break;
                case 'delete-config':
                    if (confirm(t('confirm_delete'))) {
                        localConfig[key].splice(index, 1);
                        render();
                    }
                    break;
                case 'save-config-item': {
                    const modal = document.getElementById('config-modal');
                    const isNew = !index;
                    const newItem = isNew ? {} : { ...localConfig[key][index] };

                    modal.querySelectorAll('[data-col]').forEach(input => {
                        const col = input.dataset.col;
                        const lang = input.dataset.lang;
                        const subcol = input.dataset.subcol;

                        let value;
                        if(input.type === 'checkbox') value = input.checked;
                        else if(input.type === 'number') value = Number(input.value) || 0;
                        else value = input.value;
                        
                        if (lang) {
                            if (!newItem[col] || typeof newItem[col] !== 'object') newItem[col] = {};
                            newItem[col][lang] = value;
                        } else if (subcol) {
                            if (!newItem[col] || typeof newItem[col] !== 'object') newItem[col] = {};
                            newItem[col][subcol] = value;
                        } else {
                            newItem[col] = value;
                        }
                    });

                    if (isNew) {
                        if (!localConfig[key]) localConfig[key] = [];
                        localConfig[key].push(newItem);
                    } else {
                        localConfig[key][index] = newItem;
                    }
                    bootstrap.Modal.getInstance(modal)?.hide();
                    render();
                    break;
                }
                 case 'translate': {
                    const button = actionTarget;
                    button.disabled = true;
                    button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span>`;

                    const modal = button.closest('.modal-content');
                    const baseInput = modal.querySelector(`[data-col="${key}"][data-lang="en"]`);
                    const text = baseInput.value;
                    const targetLangs = ['ua', 'ru'];
                    
                    try {
                        const res = await postData('translate-text', { text, targetLangs });
                        if (res.translations) {
                            for (const lang of targetLangs) {
                                const input = modal.querySelector(`[data-col="${key}"][data-lang="${lang}"]`);
                                if (input) input.value = res.translations[lang] || '';
                            }
                        } else {
                             alert(t('translation_error'));
                        }
                    } catch (err) {
                        alert(t('translation_error'));
                    } finally {
                        button.disabled = false;
                        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-language" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 5h7" /><path d="M9 3v2c0 4.418 -2.239 8 -5 8" /><path d="M5 9c0 2.144 2.952 3.908 6.7 4" /><path d="M12 20l4 -9l4 9" /><path d="M19.1 18h-6.2" /></svg>`;
                    }
                    break;
                }
                case 'force-start-battle':
                    await postData('battle/force-start');
                    render();
                    break;
                case 'force-end-battle':
                    await postData('battle/force-end');
                    render();
                    break;
                case 'approve-video':
                    renderApproveVideoModal(id);
                    break;
                case 'reject-video':
                    if (confirm(t('confirm_reject_submission'))) {
                        await postData(`video-submissions/${id}/reject`);
                        renderVideoModeration();
                    }
                    break;
                case 'confirm-approve-video': {
                    const amountInput = document.getElementById('reward-amount-input');
                    const rewardAmount = Number(amountInput.value);
                    if (rewardAmount > 0) {
                        await postData(`video-submissions/${id}/approve`, { rewardAmount });
                        bootstrap.Modal.getInstance(document.getElementById('approve-video-modal'))?.hide();
                        renderVideoModeration();
                    } else {
                        alert('Reward amount must be a positive number.');
                    }
                    break;
                }
                case 'approve-withdrawal':
                    if (confirm(t('confirm_approve_withdrawal'))) {
                        await postData(`withdrawal-requests/${id}/approve`);
                        renderWithdrawalRequests();
                    }
                    break;
                case 'reject-withdrawal':
                    if (confirm(t('confirm_reject_withdrawal'))) {
                        await postData(`withdrawal-requests/${id}/reject`);
                        renderWithdrawalRequests();
                    }
                    break;
                case 'generate-ai-content': {
                    const button = actionTarget;
                    button.disabled = true;
                    button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span> ${t('generating')}`;
                    
                    const customPrompt = document.getElementById('ai-custom-prompt').value;
                    
                    try {
                        const result = await postData('generate-ai-content', { customPrompt });
                        if (result) {
                            lastAiContent = result;
                            renderAiContentModal(result);
                        } else {
                            alert(t('ai_generation_failed'));
                        }
                    } catch (err) {
                        console.error(err);
                        alert(t('ai_generation_failed'));
                    } finally {
                        button.disabled = false;
                        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-sparkles" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z" /><path d="M8 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z" /><path d="M12 12a5 5 0 0 1 5 5a5 5 0 0 1 5 -5a5 5 0 0 1 -5 -5a5 5 0 0 1 -5 5z" /></svg> <span data-translate="generate_new_content">${t('generate_new_content')}</span>`;
                    }
                    break;
                }
                case 'add-ai-content': {
                    if (!lastAiContent) return;
                    
                    Object.keys(lastAiContent).forEach(key => {
                        if (Array.isArray(lastAiContent[key]) && lastAiContent[key].length > 0) {
                            if (!localConfig[key]) {
                                localConfig[key] = [];
                            }
                            localConfig[key].push(...lastAiContent[key]);
                        }
                    });
                    
                    alert(t('ai_add_success'));
                    bootstrap.Modal.getInstance(document.getElementById('ai-content-modal'))?.hide();
                    
                    const firstKey = Object.keys(lastAiContent).find(k => Array.isArray(lastAiContent[k]) && lastAiContent[k].length > 0);
                    if(firstKey && configMeta[firstKey]) {
                        activeTab = firstKey;
                        render();
                    }
                    break;
                }
            }
        });

        document.body.addEventListener('change', e => {
            const el = e.target;
            // Handle trigger type change in config modal
            if (el.matches('#config-modal [data-subcol="type"]') && el.closest('#trigger-config-area')) {
                 const triggerContainer = document.getElementById('trigger-config-area');
                 const triggerParamsContainer = document.getElementById('trigger-params-container');
                 const newType = el.value;
                 triggerParamsContainer.innerHTML = renderTriggerFields({ type: newType }).match(/<div id="trigger-params-container">([\s\S]*)<\/div>/)[1];
            }
        });

        document.body.addEventListener('input', e => {
            const el = e.target;
            // Config table form inputs
            if (el.closest('.card-body')) {
                const configKey = el.dataset.configKey;
                if (configKey) {
                    localConfig[configKey] = el.type === 'number' ? Number(el.value) : el.value;
                    return;
                }
                const iconGroup = el.dataset.iconGroup;
                const iconKey = el.dataset.iconKey;
                if (iconGroup && iconKey) {
                    if (['nav', 'profile_tabs'].includes(iconGroup)) {
                        localConfig.uiIcons[iconGroup][iconKey] = el.value;
                    } else {
                        localConfig.uiIcons[iconKey] = el.value;
                    }
                    return;
                }
                const scheduleKey = el.dataset.scheduleKey;
                if (scheduleKey) {
                    if (!localConfig.battleSchedule) localConfig.battleSchedule = {};
                    localConfig.battleSchedule[scheduleKey] = el.type === 'number' ? Number(el.value) : el.value;
                    return;
                }
                 const rewardKey = el.dataset.rewardKey;
                if (rewardKey) {
                    if (!localConfig.battleRewards) localConfig.battleRewards = {};
                    localConfig.battleRewards[rewardKey] = Number(el.value);
                    return;
                }
            }
            
            // Daily Events
            if (el.matches('.combo-card-select')) {
                if (!dailyEvent.combo_ids) dailyEvent.combo_ids = [];
                dailyEvent.combo_ids[Number(el.dataset.index)] = el.value;
            } else if (el.id === 'cipher-word-input') {
                dailyEvent.cipher_word = el.value.toUpperCase();
            } else if (el.id === 'combo-reward-input') {
                dailyEvent.combo_reward = Number(el.value);
            } else if (el.id === 'cipher-reward-input') {
                dailyEvent.cipher_reward = Number(el.value);
            }

            // Player Search
            if (el.id === 'player-search') {
                const query = el.value.toLowerCase();
                const filtered = allPlayers.filter(p => 
                    String(p.id).includes(query) || 
                    (p.name && p.name.toLowerCase().includes(query))
                );
                renderPlayersTable(filtered);
            }
            
             // Dashboard settings
            if (el.id === 'loadingScreenUrl') localConfig.loadingScreenImageUrl = el.value;
            if (el.id === 'backgroundAudioUrl') localConfig.backgroundAudioUrl = el.value;
            if (el.id === 'finalVideoUrl') localConfig.finalVideoUrl = el.value;
        });

        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', e => {
                e.preventDefault();
                activeTab = button.dataset.tab;
                window.location.hash = activeTab;
                render();
            });
        });

        // Main Save Button
        saveMainButton.addEventListener('click', saveAllChanges);

        // Language Switcher
        document.querySelectorAll('.lang-select-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault();
                currentLang = btn.dataset.lang;
                localStorage.setItem('adminLang', currentLang);
                applyTranslationsToDOM();
            });
        });
    };

    init();
});