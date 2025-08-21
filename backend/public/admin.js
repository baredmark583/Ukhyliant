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
        return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
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
                    <p class="text-secondary" data-translate="ai_generate_desc">Use AI to generate new thematic upgrades and tasks based on the game's context.</p>
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
                    <td>${winner ? `${escapeHtml(winner.cell_id)} (${formatNumber(winner.score)} pts)` : 'N/A'}</td>
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
        const renderGroup = (groupKey, icons) => {
            const fields = Object.entries(icons).map(([key, value]) => `
                <div class="col-md-6 mb-3">
                    <label class="form-label">${t(`icon_${groupKey}_${key}`)}</label>
                    <input type="text" class="form-control" data-icon-group="${groupKey}" data-icon-key="${key}" value="${escapeHtml(value)}">
                </div>
            `).join('');
            return `
                <fieldset class="form-fieldset">
                    <legend>${t(`icon_group_${groupKey}`)}</legend>
                    <div class="row">${fields}</div>
                </fieldset>
            `;
        };
        
        const { nav, profile_tabs, ...rest } = localConfig.uiIcons;
        const generalIcons = {
            ...rest,
            ...Object.fromEntries(Object.entries(profile_tabs).map(([key, value]) => [`profile_tabs_${key}`, value]))
        };

        const navHtml = renderGroup('nav', nav);

        // Re-structure other icons for better grouping
        const gameplayGroup = {
            energy: generalIcons.energy,
            coin: generalIcons.coin,
            star: generalIcons.star,
            suspicion: generalIcons.suspicion,
        };
        const marketGroup = {
            marketCoinBox: generalIcons.marketCoinBox,
            marketStarBox: generalIcons.marketStarBox,
        };
        const generalGroup = {
            soundOn: generalIcons.soundOn,
            soundOff: generalIcons.soundOff,
            secretCodeEntry: generalIcons.secretCodeEntry,
            languageSwitcher: generalIcons.languageSwitcher,
        };
        const profileTabsGroup = profile_tabs;

        const gameplayHtml = renderGroup('gameplay', gameplayGroup);
        const marketHtml = renderGroup('market', marketGroup);
        const profileTabsHtml = renderGroup('profile_tabs', profileTabsGroup);
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
            // Handle localized strings (name, description, message)
            if (value.hasOwnProperty('en') || value.hasOwnProperty('ru') || value.hasOwnProperty('ua')) {
                return getLocalizedText(value); // This already escapes
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
            // A simple check to prevent breaking on non-urls
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
            <div class="modal-backdrop fade show"></div>
        `;
        modalsContainer.innerHTML = modalHtml;
    };
    
    const renderConfigModal = (key, index, presetItem = null) => {
        const isNew = index === null || index === undefined;
        const item = presetItem || (isNew ? {} : (localConfig[key] || [])[index]);
        const { titleKey, cols } = configMeta[key];
        
        const formFields = cols.map(col => {
            const value = item[col];
            let inputHtml;
            const colLower = col.toLowerCase();
            
            if (typeof value === 'object' && value !== null) { // For 'name', 'description', 'reward', 'trigger'
                 let subFieldsHtml = '';
                 if (col === 'trigger') {
                    const triggerType = value.type || 'meta_tap';
                    const triggerParams = value.params || {};

                    const typeOptions = [
                        'meta_tap', 'login_at_time', 'balance_equals', 'upgrade_purchased'
                    ].map(t => `<option value="${t}" ${triggerType === t ? 'selected' : ''}>${t}</option>`).join('');

                    let paramsHtml = '';
                    switch (triggerType) {
                        case 'meta_tap':
                            const targetOptions = META_TAP_TARGETS.map(t => `<option value="${t.id}" ${triggerParams.targetId === t.id ? 'selected': ''}>${t(t.nameKey)}</option>`).join('');
                            paramsHtml = `
                                <label class="form-label">${t('param_targetId')}</label>
                                <select class="form-select mb-2" data-sub-key="targetId">${targetOptions}</select>
                                <label class="form-label">${t('param_taps')}</label>
                                <input type="number" class="form-control" data-sub-key="taps" value="${triggerParams.taps || 1}">
                            `;
                            break;
                        case 'login_at_time':
                             paramsHtml = `
                                <label class="form-label">${t('param_hour')}</label>
                                <input type="number" class="form-control mb-2" data-sub-key="hour" value="${triggerParams.hour || 0}" min="0" max="23">
                                <label class="form-label">${t('param_minute')}</label>
                                <input type="number" class="form-control" data-sub-key="minute" value="${triggerParams.minute || 0}" min="0" max="59">
                            `;
                            break;
                        case 'balance_equals':
                             paramsHtml = `<label class="form-label">${t('param_amount')}</label><input type="number" class="form-control" data-sub-key="amount" value="${triggerParams.amount || 0}">`;
                            break;
                        case 'upgrade_purchased':
                             const upgradeOptions = localConfig.upgrades.map(u => `<option value="${u.id}" ${triggerParams.upgradeId === u.id ? 'selected': ''}>${getLocalizedText(u.name)}</option>`).join('');
                             paramsHtml = `<label class="form-label">${t('param_upgradeId')}</label><select class="form-select" data-sub-key="upgradeId">${upgradeOptions}</select>`;
                            break;
                    }

                    subFieldsHtml = `
                        <div class="mb-2">
                            <label class="form-label">${t('trigger_type')}</label>
                            <select class="form-select" data-sub-key="type" data-trigger-type-select="true">${typeOptions}</select>
                        </div>
                        <div data-trigger-params-container="true">
                            <label class="form-label mt-2">${t('trigger_params')}</label>
                            <div class="border p-2 rounded">${paramsHtml}</div>
                        </div>
                    `;

                 } else { // For 'name', 'description', 'reward'
                     subFieldsHtml = Object.entries(value).map(([subKey, subVal]) => {
                         if (subKey === 'type') {
                             const options = col === 'reward' ? ['coins', 'profit'] : [];
                             const optionHtml = options.map(opt => `<option value="${opt}" ${subVal === opt ? 'selected' : ''}>${t(`reward_type_${opt}`)}</option>`).join('');
                             return `<div class="mb-2"><label class="form-label">${t(subKey)}</label><select class="form-select" data-sub-key="${subKey}">${optionHtml}</select></div>`;
                         }
                         return `<div class="mb-2"><label class="form-label">${t(subKey)}</label><input type="text" class="form-control" data-sub-key="${subKey}" value="${escapeHtml(subVal)}"></div>`;
                     }).join('');
                 }
                inputHtml = `<div class="border p-2 rounded" data-col="${col}">${subFieldsHtml}</div>`;
                if (col === 'name' || col === 'description' || col === 'message') {
                     inputHtml += `<button class="btn btn-sm btn-outline-info mt-2" data-action="translate-field" data-col="${col}">${t('translate')}</button>`;
                }
            } else if (col === 'type') {
                 const options = [
                    'taps', 'telegram_join', 'video_watch', 'video_code', 
                    'youtube_subscribe', 'twitter_follow', 'instagram_follow'
                ].map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${t(`task_type_${opt}`)}</option>`).join('');
                inputHtml = `<select class="form-select" data-col="${col}">${options}</select>`;
            } else if (col === 'category') {
                 const options = ["Documents", "Legal", "Lifestyle", "Special"].map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`).join('');
                inputHtml = `<select class="form-select" data-col="${col}">${options}</select>`;
            } else if (col === 'boxType') {
                const options = ['coin', 'star', 'direct'].map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`).join('');
                inputHtml = `<select class="form-select" data-col="${col}">${options}</select>`;
            } else if (col === 'isFinal') {
                inputHtml = `<select class="form-select" data-col="${col}">
                    <option value="false" ${!value ? 'selected' : ''}>${t('no')}</option>
                    <option value="true" ${value ? 'selected' : ''}>${t('yes')}</option>
                </select>`;
            } else if (colLower.includes('url')) {
                const currentValue = escapeHtml(value || '');
                inputHtml = `
                    <div class="input-group">
                        <input type="text" class="form-control" data-col="${col}" value="${currentValue}">
                        ${currentValue ? `<span class="input-group-text"><img src="${currentValue}" alt="preview" style="width: 20px; height: 20px; object-fit: contain;"></span>` : ''}
                    </div>`;
            } else {
                inputHtml = `<input type="${typeof value === 'number' ? 'number' : 'text'}" class="form-control" data-col="${col}" value="${escapeHtml(value)}">`;
            }

            return `<div class="mb-3"><label class="form-label">${t(col)}</label>${inputHtml}</div>`;
        }).join('');

        const modalHtml = `
            <div class="modal fade show" style="display: block;" tabindex="-1" id="config-modal">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${isNew ? t('config_add_item') : t('config_edit_item')}</h5>
                            <button type="button" class="btn-close" data-action="close-modal"></button>
                        </div>
                        <div class="modal-body">${formFields}</div>
                        <div class="modal-footer">
                            <button type="button" class="btn" data-action="close-modal">${t('cancel')}</button>
                            <button type="button" class="btn btn-primary" data-action="save-config-item" data-key="${key}" data-index="${isNew ? '' : index}">${t('save')}</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-backdrop fade show"></div>
        `;
        modalsContainer.innerHTML = modalHtml;
    };

    const renderTranslationModal = (field, originalText) => {
        modalsContainer.innerHTML = `
             <div class="modal fade show" style="display: block;" tabindex="-1" id="translate-modal">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${t('translate')}</h5>
                            <button type="button" class="btn-close" data-action="close-modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3"><label class="form-label">English (en)</label><textarea class="form-control" data-lang="en" rows="2">${escapeHtml(originalText)}</textarea></div>
                            <div class="mb-3"><label class="form-label">Українська (ua)</label><textarea class="form-control" data-lang="ua" rows="2"></textarea></div>
                            <div class="mb-3"><label class="form-label">Русский (ru)</label><textarea class="form-control" data-lang="ru" rows="2"></textarea></div>
                            <div id="translation-spinner" class="text-center d-none"><div class="spinner-border"></div></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn" data-action="close-modal">${t('cancel')}</button>
                            <button type="button" class="btn btn-primary" data-action="apply-translation" data-field="${field}">${t('save')}</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-backdrop fade show"></div>
        `;

        const modal = document.getElementById('translate-modal');
        const spinner = modal.querySelector('#translation-spinner');
        spinner.classList.remove('d-none');
        
        postData('translate-text', { text: originalText, targetLangs: ['ua', 'ru'] })
            .then(data => {
                if (data && data.translations) {
                    modal.querySelector('textarea[data-lang="ua"]').value = data.translations.ua || '';
                    modal.querySelector('textarea[data-lang="ru"]').value = data.translations.ru || '';
                } else {
                    alert(t('translation_error'));
                }
            })
            .finally(() => {
                spinner.classList.add('d-none');
            });
    };
    
    const renderSocialsModal = (socialType) => {
        const socials = localConfig.socials || {};
        const isYoutube = socialType === 'youtube';
        
        modalsContainer.innerHTML = `
             <div class="modal fade show" style="display: block;" tabindex="-1" id="socials-modal">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${t(isYoutube ? 'edit_youtube_settings' : 'edit_telegram_settings')}</h5>
                            <button type="button" class="btn-close" data-action="close-modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">${t(isYoutube ? 'youtube_channel_url' : 'telegram_channel_url')}</label>
                                <input type="text" class="form-control" id="social-url" value="${escapeHtml(socials[`${socialType}Url`] || '')}">
                                <small class="form-hint">${t(isYoutube ? 'youtube_channel_url_desc' : 'telegram_channel_url_desc')}</small>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">${t(isYoutube ? 'youtube_channel_id' : 'telegram_channel_id')}</label>
                                <input type="text" class="form-control" id="social-id" value="${escapeHtml(socials[`${socialType}ChannelId`] || '')}">
                                <small class="form-hint">${t(isYoutube ? 'youtube_channel_id_desc' : 'telegram_channel_id_desc')}</small>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn" data-action="close-modal">${t('cancel')}</button>
                            <button type="button" class="btn btn-primary" data-action="save-socials" data-social="${socialType}">${t('save')}</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-backdrop fade show"></div>
        `;
    };
    
    const renderAiContentModal = (content) => {
        const renderItems = (items, key) => items.map((item, index) => `
            <div class="card card-sm mb-2">
                <div class="card-body">
                    <p class="mb-1"><strong>${getLocalizedText(item.name)}</strong></p>
                    <p class="text-secondary text-sm mb-2">${getLocalizedText(item.description || '')}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">ID: ${item.id}</small>
                        <button class="btn btn-sm btn-success" data-action="add-ai-item" data-key="${key}" data-index="${index}">${t('add_to_game')}</button>
                    </div>
                </div>
            </div>
        `).join('') || `<p class="text-secondary text-center">${t('no_data')}</p>`;

        modalsContainer.innerHTML = `
            <div class="modal fade show" style="display: block;" tabindex="-1" id="ai-content-modal">
                <div class="modal-dialog modal-xl modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${t('ai_generated_content')}</h5>
                            <button type="button" class="btn-close" data-action="close-modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6 class="mb-3">${t('generated_upgrades')}</h6>
                                    <div class="overflow-auto" style="max-height: 50vh;">${renderItems(content.upgrades || [], 'upgrades')}</div>
                                </div>
                                <div class="col-md-6">
                                    <h6 class="mb-3">${t('generated_tasks')}</h6>
                                    <div class="overflow-auto" style="max-height: 50vh;">${renderItems(content.specialTasks || [], 'specialTasks')}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-backdrop fade show"></div>
        `;
    };


    // --- EVENT LISTENERS ---
    const initEventListeners = () => {
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', e => {
                e.preventDefault();
                activeTab = button.dataset.tab;
                render();
            });
        });
        
        // Save button
        saveMainButton.addEventListener('click', saveAllChanges);

        // Language switcher
        document.querySelectorAll('.lang-select-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault();
                currentLang = e.currentTarget.dataset.lang;
                localStorage.setItem('adminLang', currentLang);
                applyTranslationsToDOM();
            });
        });

        // Event delegation for dynamic content
        document.body.addEventListener('click', async e => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            
            const { action, id, key, index, social, wallet } = target.dataset;

            switch (action) {
                case 'close-modal':
                    modalsContainer.innerHTML = '';
                    break;
                case 'player-details':
                    renderPlayerDetailsModal(id);
                    break;
                case 'copy-wallet': {
                    if (wallet) {
                        navigator.clipboard.writeText(wallet).then(() => {
                            const originalIcon = target.innerHTML;
                            target.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-check" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" /></svg>`;
                            setTimeout(() => { target.innerHTML = originalIcon; }, 1500);
                        }).catch(err => console.error('Failed to copy:', err));
                    }
                    break;
                }
                case 'add-player-bonus': {
                    const amount = document.getElementById('bonus-amount-input').value;
                    if (amount && !isNaN(amount)) {
                        await postData(`player/${id}/update-balance`, { amount });
                        alert(t('balance_updated'));
                        modalsContainer.innerHTML = '';
                        renderPlayers();
                    } else {
                        alert(t('error_updating_balance'));
                    }
                    break;
                }
                case 'reset-player-daily':
                    if (confirm(t('confirm_reset_daily'))) {
                       await postData(`player/${id}/reset-daily`);
                       alert(t('daily_progress_reset_success'));
                       modalsContainer.innerHTML = '';
                    }
                    break;
                case 'delete-player':
                     if (confirm(t('confirm_delete_player'))) {
                       await deleteData(`player/${id}`);
                       modalsContainer.innerHTML = '';
                       renderPlayers();
                    }
                    break;
                case 'reset-progress':
                     if (confirm(t('confirm_reset_progress'))) {
                       await postData(`player/${id}/reset-progress`);
                       alert(t('progress_reset_success'));
                       renderCheaters();
                    }
                    break;
                case 'edit-config':
                    renderConfigModal(key, index);
                    break;
                case 'add-config':
                    renderConfigModal(key, null);
                    break;
                case 'delete-config':
                    if (confirm(t('confirm_delete'))) {
                        localConfig[key].splice(index, 1);
                        render();
                    }
                    break;
                case 'save-config-item': {
                    const modal = document.getElementById('config-modal');
                    let newItem = {};
                    configMeta[key].cols.forEach(col => {
                        const input = modal.querySelector(`[data-col="${col}"]`);
                        if (input) {
                            if (input.dataset.hasOwnProperty('subKey')) { // complex object
                                newItem[col] = {};
                                input.querySelectorAll('[data-sub-key]').forEach(subInput => {
                                     let val = subInput.value;
                                     if(subInput.type === 'number') val = Number(val);
                                     if(subInput.tagName === 'SELECT' && (val === 'true' || val === 'false')) val = val === 'true';
                                     newItem[col][subInput.dataset.subKey] = val;
                                });
                            } else {
                                 let val = input.value;
                                 if(input.type === 'number') val = Number(val);
                                 if(input.tagName === 'SELECT' && (val === 'true' || val === 'false')) val = val === 'true';
                                newItem[col] = val;
                            }
                        }
                    });

                    if (index) {
                        localConfig[key][index] = newItem;
                    } else {
                        if (!localConfig[key]) localConfig[key] = [];
                        localConfig[key].push(newItem);
                    }
                    modalsContainer.innerHTML = '';
                    render();
                    break;
                }
                 case 'translate-field':
                    const fieldName = target.dataset.col;
                    const fieldContainer = target.closest('.mb-3').querySelector(`[data-col="${fieldName}"]`);
                    const originalText = fieldContainer.querySelector('[data-sub-key="en"]').value;
                    renderTranslationModal(fieldName, originalText);
                    break;
                case 'apply-translation': {
                    const field = target.dataset.field;
                    const translateModal = document.getElementById('translate-modal');
                    const configModal = document.getElementById('config-modal');
                    
                    const newTranslations = {
                        en: translateModal.querySelector('[data-lang="en"]').value,
                        ua: translateModal.querySelector('[data-lang="ua"]').value,
                        ru: translateModal.querySelector('[data-lang="ru"]').value,
                    };
                    
                    const targetContainer = configModal.querySelector(`[data-col="${field}"]`);
                    Object.entries(newTranslations).forEach(([lang, text]) => {
                        const input = targetContainer.querySelector(`[data-sub-key="${lang}"]`);
                        if (input) input.value = text;
                    });

                    modalsContainer.innerHTML = ''; // Close only translation modal
                    break;
                }
                case 'edit-socials':
                    renderSocialsModal(social);
                    break;
                case 'save-socials':
                    if (!localConfig.socials) localConfig.socials = {};
                    localConfig.socials[`${social}Url`] = document.getElementById('social-url').value;
                    localConfig.socials[`${social}ChannelId`] = document.getElementById('social-id').value;
                    modalsContainer.innerHTML = '';
                    break;
                case 'send-broadcast': {
                    const text = document.getElementById('broadcast-text').value;
                    const imageUrl = document.getElementById('broadcast-image-url').value;
                    const buttonUrl = document.getElementById('broadcast-button-url').value;
                    const buttonText = document.getElementById('broadcast-button-text').value;

                    if (!text) { alert(t('message_text_required')); return; }
                    if ((buttonUrl && !buttonText) || (!buttonUrl && buttonText)) { alert(t('button_requires_url_and_text')); return; }
                    if (confirm(t('confirm_broadcast'))) {
                        target.disabled = true;
                        target.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${t('sending_broadcast')}`;
                        const res = await postData('broadcast-message', { text, imageUrl, buttonUrl, buttonText });
                        if (res) alert(res.message);
                        target.disabled = false;
                        target.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-send" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></svg> ${t('send_broadcast')}`;
                    }
                    break;
                }
                case 'generate-ai-content':
                    target.disabled = true;
                    target.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${t('generating')}`;
                    const content = await postData('generate-ai-content');
                    if (content && (content.upgrades || content.specialTasks)) {
                        lastAiContent = content; // Store result
                        renderAiContentModal(content);
                    } else if (content && content.error) {
                         alert(`AI Error: ${content.error}`);
                    }
                    target.disabled = false;
                    target.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-sparkles" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z" /><path d="M8 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z" /><path d="M12 12a5 5 0 0 1 5 5a5 5 0 0 1 5 -5a5 5 0 0 1 -5 -5a5 5 0 0 1 -5 5z" /></svg> ${t('generate_new_content')}`;
                    break;
                case 'add-ai-item': {
                    const itemKey = target.dataset.key;
                    const itemIndex = parseInt(target.dataset.index, 10);
                    if (lastAiContent && lastAiContent[itemKey] && lastAiContent[itemKey][itemIndex]) {
                        const itemToAdd = lastAiContent[itemKey][itemIndex];
                        if (!localConfig[itemKey]) localConfig[itemKey] = [];
                        localConfig[itemKey].push(itemToAdd);
                        alert(t('ai_add_success'));
                        target.textContent = t('added');
                        target.disabled = true;
                    } else {
                        alert('Could not find AI content to add. Please generate again.');
                    }
                    break;
                }
                 case 'force-start-battle': {
                    const startRes = await postData('battle/force-start');
                    if(startRes.ok) {
                        alert(startRes.message || 'Battle started');
                        renderCellConfiguration();
                    } else {
                        alert(startRes.error || 'Failed to start battle');
                    }
                    break;
                }
                case 'force-end-battle': {
                     const endRes = await postData('battle/force-end');
                    if(endRes.ok) {
                        alert(endRes.message || 'Battle ended');
                        renderCellConfiguration();
                    } else {
                        alert(endRes.error || 'Failed to end battle');
                    }
                    break;
                }
            }
        });

        document.body.addEventListener('input', e => {
            const target = e.target;
            if (target.matches('#player-search')) {
                const searchTerm = target.value.toLowerCase();
                const filteredPlayers = allPlayers.filter(p =>
                    p.id.includes(searchTerm) || p.name.toLowerCase().includes(searchTerm)
                );
                renderPlayersTable(filteredPlayers);
            } else if (target.matches('#loadingScreenUrl')) {
                 if (!localConfig) localConfig = {};
                 localConfig.loadingScreenImageUrl = target.value;
            } else if (target.matches('#backgroundAudioUrl')) {
                if (!localConfig) localConfig = {};
                localConfig.backgroundAudioUrl = target.value;
            } else if (target.matches('#finalVideoUrl')) {
                 if (!localConfig) localConfig = {};
                 localConfig.finalVideoUrl = target.value;
            } else if (target.matches('#combo-reward-input')) {
                dailyEvent.combo_reward = parseInt(target.value, 10);
            } else if (target.matches('#cipher-reward-input')) {
                dailyEvent.cipher_reward = parseInt(target.value, 10);
            } else if (target.matches('#cipher-word-input')) {
                dailyEvent.cipher_word = target.value.toUpperCase();
            } else if (target.matches('.combo-card-select')) {
                const index = parseInt(target.dataset.index, 10);
                if (!dailyEvent.combo_ids) dailyEvent.combo_ids = [];
                dailyEvent.combo_ids[index] = target.value;
            } else if (target.matches('[data-config-key]')) {
                 const key = target.dataset.configKey;
                 localConfig[key] = Number(target.value);
            } else if (target.matches('[data-schedule-key]')) {
                const key = target.dataset.scheduleKey;
                if (!localConfig.battleSchedule) localConfig.battleSchedule = {};
                localConfig.battleSchedule[key] = target.type === 'number' ? Number(target.value) : target.value;
            } else if (target.matches('[data-reward-key]')) {
                 const key = target.dataset.rewardKey;
                 if (!localConfig.battleRewards) localConfig.battleRewards = {};
                 localConfig.battleRewards[key] = Number(target.value);
            } else if (target.matches('[data-icon-group]')) {
                 const group = target.dataset.iconGroup;
                 const key = target.dataset.iconKey;
                 if (!localConfig.uiIcons) localConfig.uiIcons = {};
                 
                 if (group === 'nav' || group === 'profile_tabs') {
                     if (!localConfig.uiIcons[group]) localConfig.uiIcons[group] = {};
                     localConfig.uiIcons[group][key] = target.value;
                 } else {
                     localConfig.uiIcons[key] = target.value;
                 }
            } else if (target.closest('#config-modal [data-trigger-type-select]')) {
                // Re-render the params part of the modal
                const modal = document.getElementById('config-modal');
                const key = modal.querySelector('[data-action="save-config-item"]').dataset.key;
                const index = modal.querySelector('[data-action="save-config-item"]').dataset.index;

                // Grab current values from the form to create a temporary item
                let tempItem = {};
                configMeta[key].cols.forEach(col => {
                    const input = modal.querySelector(`[data-col="${col}"]`);
                    if (input) {
                        if (input.dataset.col === 'trigger') {
                             tempItem[col] = {};
                             input.querySelectorAll('[data-sub-key]').forEach(subInput => {
                                 let val = subInput.value;
                                 if(subInput.tagName === 'SELECT' && (val === 'true' || val === 'false')) val = val === 'true';
                                 tempItem[col][subInput.dataset.subKey] = subInput.type === 'number' ? Number(val) : val;
                             });
                        } else if (typeof (isNew ? {} : (localConfig[key] || [])[parseInt(index,10)])[col] === 'object') {
                             tempItem[col] = {};
                             input.querySelectorAll('[data-sub-key]').forEach(subInput => {
                                let val = subInput.value;
                                if(subInput.tagName === 'SELECT' && (val === 'true' || val === 'false')) val = val === 'true';
                                tempItem[col][subInput.dataset.subKey] = subInput.type === 'number' ? Number(val) : val;
                             });
                        } else {
                            let val = input.value;
                            if(input.tagName === 'SELECT' && (val === 'true' || val === 'false')) val = val === 'true';
                            tempItem[col] = input.type === 'number' ? Number(val) : val;
                        }
                    }
                });
                modalsContainer.innerHTML = '';
                renderConfigModal(key, index === '' ? null : index, tempItem);
            }
        });
    };
    
    // --- INITIALIZATION ---
    const init = async () => {
        showLoading();
        localConfig = await fetchData('config') || {};
        await render(); // Initial render to set up the page structure
        activeTab = window.location.hash.substring(1) || 'dashboard';
        await render(); // Render the correct starting tab
        initEventListeners();
    };

    init();
});