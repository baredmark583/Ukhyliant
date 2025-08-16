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

    // --- CONFIG META (for dynamic table rendering) ---
    const configMeta = {
        leagues: { titleKey: 'nav_leagues', cols: ['id', 'name', 'description', 'minProfitPerHour', 'iconUrl'] },
        upgrades: { titleKey: 'nav_upgrades', cols: ['id', 'name', 'price', 'profitPerHour', 'category', 'suspicionModifier', 'iconUrl'] },
        tasks: { titleKey: 'nav_daily_tasks', cols: ['id', 'name', 'type', 'reward', 'requiredTaps', 'suspicionModifier', 'url', 'secretCode', 'imageUrl'] },
        specialTasks: { titleKey: 'nav_special_tasks', cols: ['id', 'name', 'description', 'type', 'reward', 'priceStars', 'suspicionModifier', 'url', 'secretCode', 'imageUrl'] },
        glitchEvents: { titleKey: 'nav_glitch_events', cols: ['id', 'message', 'code', 'reward', 'trigger', 'isFinal'] },
        blackMarketCards: { titleKey: 'nav_market_cards', cols: ['id', 'name', 'profitPerHour', 'chance', 'boxType', 'suspicionModifier', 'iconUrl'] },
        coinSkins: { titleKey: 'nav_coin_skins', cols: ['id', 'name', 'profitBoostPercent', 'chance', 'boxType', 'suspicionModifier', 'iconUrl'] },
        uiIcons: { titleKey: 'nav_ui_icons' },
        boosts: { titleKey: 'nav_boosts', cols: ['id', 'name', 'description', 'costCoins', 'suspicionModifier', 'iconUrl'] },
        cellSettings: { titleKey: 'nav_cell_settings', fields: ['cellCreationCost', 'cellMaxMembers', 'informantRecruitCost', 'lootboxCostCoins', 'lootboxCostStars', 'cellBattleTicketCost'] },
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
        if (typeof data === 'object' && data !== null && data.hasOwnProperty('en')) {
            return escapeHtml(data[currentLang] || data['en']);
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
                        label: t('new_users_last_7_days'),
                        data: dashboardStats.registrations.map(r => r.count),
                        backgroundColor: 'rgba(22, 163, 74, 0.4)',
                        borderColor: 'rgba(34, 197, 94, 1)',
                        pointBackgroundColor: 'rgba(34, 197, 94, 1)',
                        pointBorderColor: '#fff',
                        pointHoverRadius: 6,
                        pointRadius: 4,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'var(--text-secondary)'} },
                        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'var(--text-secondary)' } }
                    },
                    plugins: { legend: { display: false } },
                    interaction: { intersect: false, mode: 'index' },
                }
            });
        }
        
        // Render map
        if (playerLocations.length > 0) {
            const mapData = playerLocations.reduce((acc, loc) => ({...acc, [loc.country]: loc.player_count }), {});
            charts.map = new jsVectorMap({
                selector: '#map-world',
                map: 'world',
                backgroundColor: 'transparent',
                regionStyle: { initial: { fill: 'var(--border-color)' }, hover: { fill: 'var(--accent-green-glow)' } },
                series: {
                    regions: [{
                        values: mapData,
                        scale: ['#374151', '#4ade80'], // Gray to Green
                        normalizeFunction: 'polynomial'
                    }]
                },
                 onRegionTooltipShow(event, tooltip, code) {
                    tooltip.text(
                      `${tooltip.text()} (${formatNumber(mapData[code] || 0)})`,
                      true,
                    );
                },
            });
        }
        applyTranslationsToDOM();
    };

    const renderPlayers = async () => {
        showLoading();
        allPlayers = await fetchData('players');
        if (!allPlayers) { tabContainer.innerHTML = `<p>${t('no_data')}</p>`; return; }

        const tableHtml = `
            <div class="card">
                <div class="card-header">
                    <input type="text" id="player-search" class="form-control w-auto" placeholder="${t('search_by_id_name')}">
                </div>
                <div class="table-responsive">
                    <table class="table table-vcenter card-table">
                        <thead>
                            <tr>
                                <th>${t('id')}</th>
                                <th>${t('name')}</th>
                                <th>${t('balance')}</th>
                                <th>${t('profit_ph')}</th>
                                <th>${t('referrals')}</th>
                                <th>${t('language')}</th>
                                <th class="w-1">${t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody id="players-table-body">
                            ${generatePlayerRows(allPlayers)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        tabContainer.innerHTML = tableHtml;
    };

    const generatePlayerRows = (players) => {
        if (!players || players.length === 0) return `<tr><td colspan="7" class="text-center">${t('no_data')}</td></tr>`;
        return players.map(p => `
            <tr>
                <td>${p.id}</td>
                <td>${escapeHtml(p.name)}</td>
                <td>${formatNumber(p.balance)}</td>
                <td>${formatNumber(p.profitPerHour)}</td>
                <td>${p.referrals}</td>
                <td><span class="flag flag-country-${p.language === 'en' ? 'us' : p.language}"></span> ${p.language}</td>
                <td>
                    <div class="btn-list flex-nowrap">
                        <button class="btn btn-sm" data-action="player-details" data-id="${p.id}">${t('details')}</button>
                        <button class="btn btn-sm btn-danger" data-action="delete-player" data-id="${p.id}">${t('delete')}</button>
                    </div>
                </td>
            </tr>
        `).join('');
    };
    
    const renderCheaters = async () => {
        showLoading('loading_cheaters');
        const cheaters = await fetchData('cheaters');
        
        let cheaterRows = `<tr><td colspan="3" class="text-center">${t('no_cheaters_found')}</td></tr>`;
        if (cheaters && cheaters.length > 0) {
            cheaterRows = cheaters.map(c => `
                <tr>
                    <td>${c.id}</td>
                    <td>${escapeHtml(c.name)}</td>
                    <td>
                        <button class="btn btn-sm" data-action="view-cheat-log" data-id="${c.id}">${t('cheat_log')}</button>
                        <button class="btn btn-sm btn-warning" data-action="reset-progress" data-id="${c.id}">${t('reset_progress')}</button>
                    </td>
                </tr>
            `).join('');
        }
        
        tabContainer.innerHTML = `
            <div class="card">
                <div class="card-header"><h3 class="card-title">${t('cheater_list')}</h3></div>
                <div class="card-body"><p class="text-secondary">${t('cheater_list_desc')}</p></div>
                <div class="table-responsive">
                    <table class="table table-vcenter card-table">
                        <thead>
                            <tr><th>${t('id')}</th><th>${t('name')}</th><th>${t('actions')}</th></tr>
                        </thead>
                        <tbody>${cheaterRows}</tbody>
                    </table>
                </div>
            </div>`;
    };

    const renderDailyEvents = async () => {
        showLoading();
        dailyEvent = await fetchData('daily-events') || { combo_ids: [], cipher_word: '', combo_reward: 5000000, cipher_reward: 1000000 };
        if (!Array.isArray(dailyEvent.combo_ids)) dailyEvent.combo_ids = [];
        
        const allCards = [...(localConfig.upgrades || []), ...(localConfig.blackMarketCards || [])];
        const cardOptions = allCards.map(c => `<option value="${c.id}">${getLocalizedText(c.name)}</option>`).join('');

        const comboSelectors = [0, 1, 2].map(i => `
            <select class="form-select combo-card-select">
                <option value="">${t('select_card')}</option>
                ${cardOptions}
            </select>
        `);

        tabContainer.innerHTML = `
            <div class="card">
                <div class="card-header"><h3 class="card-title">${t('daily_events_setup')}</h3></div>
                <div class="card-body">
                    <fieldset class="form-fieldset">
                        <legend>${t('daily_combo')}</legend>
                        <p class="text-secondary">${t('select_3_cards_for_combo')}</p>
                        <div class="row">
                            <div class="col-md-4 mb-3">${comboSelectors[0]}</div>
                            <div class="col-md-4 mb-3">${comboSelectors[1]}</div>
                            <div class="col-md-4 mb-3">${comboSelectors[2]}</div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">${t('combo_reward')}</label>
                            <input type="number" class="form-control" id="combo-reward-input" value="${dailyEvent.combo_reward}">
                        </div>
                    </fieldset>
                    <fieldset class="form-fieldset mt-4">
                        <legend>${t('daily_cipher')}</legend>
                        <p class="text-secondary">${t('enter_cipher_word')}</p>
                         <div class="mb-3">
                            <label class="form-label">${t('cipher_word')}</label>
                            <input type="text" class="form-control" id="cipher-word-input" placeholder="${t('example_btc')}" value="${escapeHtml(dailyEvent.cipher_word)}">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">${t('cipher_reward')}</label>
                            <input type="number" class="form-control" id="cipher-reward-input" value="${dailyEvent.cipher_reward}">
                        </div>
                    </fieldset>
                </div>
            </div>
        `;
        
        // Set selected options for combo cards
        const selects = document.querySelectorAll('.combo-card-select');
        selects.forEach((select, index) => {
            if (dailyEvent.combo_ids[index]) {
                select.value = dailyEvent.combo_ids[index];
            }
        });
    };

    const renderConfigTable = (key) => {
        const { titleKey, cols } = configMeta[key];
        const data = localConfig[key] || [];

        const headers = cols.map(col => `<th>${t(col) || col}</th>`).join('') + `<th>${t('actions')}</th>`;
        const rows = data.map((item, index) => {
            const cells = cols.map(col => {
                 let value = item[col];
                 if (key === 'glitchEvents' && col === 'isFinal') {
                    value = !!value; // Coerce undefined to false for proper rendering
                }
                return `<td>${renderTableCell(value)}</td>`
            }).join('');
            return `
                <tr>
                    ${cells}
                    <td>
                        <div class="btn-list flex-nowrap">
                            <button class="btn btn-sm" data-action="edit-config" data-key="${key}" data-index="${index}">${t('edit')}</button>
                            <button class="btn btn-sm btn-danger" data-action="delete-config" data-key="${key}" data-index="${index}">${t('delete')}</button>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        tabContainer.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">${t(titleKey)}</h3>
                    <div class="card-actions">
                        <button class="btn btn-primary" data-action="add-config" data-key="${key}">${t('add_new')}</button>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table card-table table-vcenter text-nowrap datatable">
                        <thead><tr>${headers}</tr></thead>
                        <tbody>${rows || `<tr><td colspan="${cols.length + 1}" class="text-center">${t('no_data')}</td></tr>`}</tbody>
                    </table>
                </div>
            </div>`;
    };

    const renderTableCell = (data) => {
        if (typeof data === 'boolean') {
            return data ? `<span class="badge bg-green-lt">${t('yes')}</span>` : `<span class="badge bg-red-lt">${t('no')}</span>`;
        }
        if (typeof data === 'string' && (data.startsWith('http') || data.startsWith('/assets'))) {
            return `<img src="${escapeHtml(data)}" alt="icon" style="width: 32px; height: 32px; object-fit: contain; background: #fff; padding: 2px;">`;
        }
        if (typeof data === 'object' && data !== null) {
            if (data.hasOwnProperty('en')) { // Localized string
                return getLocalizedText(data);
            }
            if (data.hasOwnProperty('type') && data.hasOwnProperty('amount')) { // Reward object
                const typeKey = `reward_type_${data.type === 'profit' ? 'profit' : 'coins'}`;
                return `${formatNumber(data.amount)} ${t(typeKey)}`;
            }
            if (data.hasOwnProperty('type') && data.hasOwnProperty('params')) { // Trigger object
                const typeText = t(`trigger_type_${data.type}`) || data.type;
                const paramsText = Object.entries(data.params).map(([key, value]) => {
                    const keyText = t(`param_${key}`) || key;
                    return `<div><small>${keyText}: <strong>${escapeHtml(value)}</strong></small></div>`;
                }).join('');
                return `<strong>${typeText}</strong>${paramsText}`;
            }
            // Fallback for other objects
            return `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
        }
        return escapeHtml(data);
    };

    const renderIconInput = (groupKey, key, value) => {
        const dataAttrs = groupKey ? `data-group="${groupKey}" data-key="${key}"` : `data-key="${key}"`;
        const translationKey = `icon_${groupKey ? `${groupKey}_${key}` : key}`;
        return `
            <div class="mb-3">
                <label class="form-label">${t(translationKey) || key}</label>
                <div class="input-group">
                    <input type="text" class="form-control" ${dataAttrs} value="${escapeHtml(value)}">
                    <span class="input-group-text"><img src="${escapeHtml(value)}" alt="" style="width: 24px; height: 24px; background: #fff;"></span>
                </div>
            </div>`;
    };
    
    const renderUiIconsConfig = () => {
        const iconsData = localConfig.uiIcons || {};
        const iconGroups = {
            nav: { titleKey: 'icon_group_nav', keys: ['exchange', 'mine', 'missions', 'airdrop', 'profile'] },
            profile_tabs: { titleKey: 'icon_group_profile_tabs', keys: ['contacts', 'boosts', 'skins', 'market', 'cell'] },
            gameplay: { titleKey: 'icon_group_gameplay', keys: ['energy', 'coin', 'star', 'suspicion', 'soundOn', 'soundOff', 'secretCodeEntry'] },
            market: { titleKey: 'icon_group_market', keys: ['marketCoinBox', 'marketStarBox'] },
            general: { titleKey: 'icon_group_general', keys: ['languageSwitcher'] }
        };

        let formHtml = '';
        for (const [groupKey, group] of Object.entries(iconGroups)) {
            formHtml += `<fieldset class="form-fieldset"><legend>${t(group.titleKey)}</legend>`;
            if (groupKey === 'nav' || groupKey === 'profile_tabs') {
                 formHtml += group.keys.map(key => renderIconInput(groupKey, key, iconsData[groupKey]?.[key] || '')).join('');
            } else {
                 formHtml += group.keys.map(key => renderIconInput(null, key, iconsData[key] || '')).join('');
            }
            formHtml += `</fieldset>`;
        }
        
        tabContainer.innerHTML = `<div class="card"><div class="card-body" id="ui-icons-form">${formHtml}</div></div>`;
    };
    
     const renderGenericSettingsForm = (key, fields, titleKey) => {
        const settingsData = localConfig || {};
        const formHtml = fields.map(field => `
            <div class="mb-3">
                <label class="form-label">${t(field)}</label>
                <input type="number" class="form-control" data-key="${field}" value="${escapeHtml(settingsData[field] || 0)}">
                <small class="form-hint">${t(`${field}_desc`)}</small>
            </div>
        `).join('');
        
        tabContainer.innerHTML = `
            <div class="card">
                <div class="card-header"><h3 class="card-title">${t(titleKey)}</h3></div>
                <div class="card-body">
                    <fieldset class="form-fieldset">${formHtml}</fieldset>
                </div>
            </div>`;
    };
    
    const renderCellConfiguration = () => {
        const settingsData = localConfig || {};
        const economyFields = ['informantProfitBonus', 'cellBankProfitShare'].map(field => {
            const labelKey = field.replace('informantProfitBonus', 'informant_bonus_percent').replace('cellBankProfitShare', 'bank_tax_percent');
            const value = (parseFloat(settingsData[field] || 0) * 100).toFixed(2);
            return `
                <div class="mb-3">
                    <label class="form-label">${t(labelKey)}</label>
                    <input type="number" step="0.01" class="form-control" data-config-key="${field}" value="${value}">
                </div>`;
        }).join('');

        const rewardsFields = ['firstPlace', 'secondPlace', 'thirdPlace', 'participant'].map(field => `
             <div class="mb-3">
                <label class="form-label">${t(`${field.replace('Place','_place')}_reward`)}</label>
                <input type="number" class="form-control" data-config-key="battleRewards" data-sub-key="${field}" value="${escapeHtml(settingsData.battleRewards?.[field] || 0)}">
            </div>
        `).join('');
        
        const schedule = settingsData.battleSchedule || {};
        const dayOptions = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
            .map((day, i) => `<option value="${i}" ${schedule.dayOfWeek === i ? 'selected' : ''}>${t(`day_${day}`)}</option>`).join('');
            
        const freqOptions = ['weekly', 'biweekly', 'monthly']
            .map(f => `<option value="${f}" ${schedule.frequency === f ? 'selected' : ''}>${t(`freq_${f}`)}</option>`).join('');


        tabContainer.innerHTML = `
        <div class="row row-cards">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header"><h3 class="card-title">${t('cell_economy')}</h3></div>
                    <div class="card-body">${economyFields}</div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header"><h3 class="card-title">${t('battle_rewards')}</h3></div>
                    <div class="card-body">${rewardsFields}</div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header"><h3 class="card-title">${t('battle_schedule')}</h3></div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label class="form-label">${t('schedule_frequency')}</label>
                            <select class="form-select" data-config-key="battleSchedule" data-sub-key="frequency">${freqOptions}</select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">${t('schedule_day')}</label>
                            <select class="form-select" data-config-key="battleSchedule" data-sub-key="dayOfWeek">${dayOptions}</select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">${t('schedule_time_utc')}</label>
                            <input type="number" class="form-control" data-config-key="battleSchedule" data-sub-key="startHourUTC" value="${schedule.startHourUTC || 12}">
                        </div>
                         <div class="mb-3">
                            <label class="form-label">${t('schedule_duration_hours')}</label>
                            <input type="number" class="form-control" data-config-key="battleSchedule" data-sub-key="durationHours" value="${schedule.durationHours || 24}">
                        </div>
                    </div>
                </div>
            </div>
             <div class="col-md-6">
                <div class="card">
                    <div class="card-header"><h3 class="card-title">${t('battle_management')}</h3></div>
                    <div class="card-body space-y-3">
                        <div id="battle-status-container"></div>
                        <button class="btn btn-primary w-100" data-action="force-start-battle">${t('force_start_battle')}</button>
                        <button class="btn btn-danger w-100" data-action="force-end-battle">${t('force_end_battle')}</button>
                    </div>
                </div>
            </div>
        </div>
        `;
        renderBattleStatus();
    };
    
    const renderBattleStatus = async () => {
        const container = document.getElementById('battle-status-container');
        if (!container) return;
        const res = await fetchData('battle/status');
        const status = res?.status;
        if (status) {
             container.innerHTML = `<p>${t('battle_status')}: <span class="badge bg-${status.isActive ? 'green' : 'red'}-lt">${status.isActive ? t('battle_status_active') : t('battle_status_inactive')}</span></p>`;
        }
    };
    
    const renderCellAnalytics = async () => {
        showLoading();
        const data = await fetchData('cell-analytics');
        if (!data) { tabContainer.innerHTML = 'Error loading data'; return; }
        
        const kpiHtml = Object.entries(data.kpi).map(([key, value]) => `
             <div class="col-md-3 col-6">
                <div class="card card-sm">
                    <div class="card-body text-center">
                        <div class="h1 mb-1">${formatNumber(value)}</div>
                        <div class="text-secondary">${t(`kpi_${key}`)}</div>
                    </div>
                </div>
            </div>
        `).join('');
        
        const leaderboardRows = data.leaderboard.map(c => `
            <tr>
                <td>${c.id}</td>
                <td>${escapeHtml(c.name)}</td>
                <td>${c.members}</td>
                <td>${formatNumber(c.total_profit)}</td>
                <td>${formatNumber(c.balance)}</td>
            </tr>
        `).join('');

        const battleHistoryRows = (data.battleHistory || []).map(b => {
             const winnerCell = (data.leaderboard || []).find(cell => cell.id === b.winner_details?.firstPlace?.cell_id);
             const winnerName = winnerCell ? winnerCell.name : (b.winner_details?.firstPlace?.cell_id || 'N/A');
             const prizePool = (b.winner_details && localConfig.battleRewards) 
                 ? (localConfig.battleRewards.firstPlace + localConfig.battleRewards.secondPlace + localConfig.battleRewards.thirdPlace + localConfig.battleRewards.participant)
                 : 'N/A';

            return `
             <tr>
                <td>${new Date(b.end_time).toLocaleString()}</td>
                <td>${escapeHtml(winnerName)}</td>
                <td>${formatNumber(b.winner_details?.firstPlace?.score || 0)}</td>
                <td>${formatNumber(prizePool)}</td>
            </tr>`;
        }).join('');


        tabContainer.innerHTML = `
            <div class="row row-cards">${kpiHtml}</div>
            <div class="row row-cards mt-4">
                <div class="col-lg-6">
                     <div class="card">
                        <div class="card-header"><h3 class="card-title">${t('cell_leaderboard')}</h3></div>
                        <div class="table-responsive" style="max-height: 400px;"><table class="table card-table table-vcenter">
                            <thead><tr><th>ID</th><th>${t('cell_name')}</th><th>${t('members')}</th><th>${t('total_profit')}</th><th>${t('cell_bank')}</th></tr></thead>
                            <tbody>${leaderboardRows}</tbody>
                        </table></div>
                    </div>
                </div>
                <div class="col-lg-6">
                     <div class="card">
                        <div class="card-header"><h3 class="card-title">${t('battle_history')}</h3></div>
                        <div class="table-responsive" style="max-height: 400px;"><table class="table card-table table-vcenter">
                            <thead><tr><th>${t('battle_date')}</th><th>${t('winner')}</th><th>${t('score')}</th><th>${t('prize_pool')}</th></tr></thead>
                            <tbody>${battleHistoryRows || `<tr><td colspan="4" class="text-center">${t('no_data')}</td></tr>`}</tbody>
                        </table></div>
                    </div>
                </div>
            </div>
        `;
    };
    
    // --- MODAL RENDERING ---
    const renderModal = (id, title, body, footer) => {
        const modalHtml = `
            <div class="modal modal-blur fade" id="${id}" tabindex="-1" role="dialog" aria-hidden="true">
              <div class="modal-dialog modal-lg modal-dialog-centered" role="document">
                <div class="modal-content">
                  <div class="modal-header">
                    <h5 class="modal-title">${title}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div class="modal-body">${body}</div>
                  <div class="modal-footer">${footer}</div>
                </div>
              </div>
            </div>`;
        modalsContainer.innerHTML = modalHtml;
        const modal = new bootstrap.Modal(document.getElementById(id));
        modal.show();
        document.getElementById(id).addEventListener('hidden.bs.modal', () => {
            modalsContainer.innerHTML = '';
        });
        return modal;
    };
    
    const renderPlayerDetailsModal = async (playerId) => {
        const player = await fetchData(`player/${playerId}/details`);
        if (!player) { alert('Could not load player details'); return; }
        
        const upgradesHtml = Object.entries(player.upgrades || {}).map(([id, level]) => `
            <li>${id}: <strong>${t('level')} ${level}</strong></li>
        `).join('');

        const body = `
            <p><strong>ID:</strong> ${player.id}</p>
            <p><strong>${t('name')}:</strong> ${escapeHtml(player.name)}</p>
            <p><strong>${t('current_balance')}:</strong> ${formatNumber(player.balance)}</p>
            <p><strong>${t('suspicion')}:</strong> ${player.suspicion || 0}</p>
            <hr>
            <h4>${t('player_upgrades')}</h4>
            <ul class="list-unstyled">${upgradesHtml || `<li>${t('no_data')}</li>`}</ul>
            <hr>
            <h4>${t('add_bonus')}</h4>
            <div class="input-group">
                <input type="number" id="bonus-amount-input" class="form-control" placeholder="${t('bonus_amount')}">
                <button class="btn btn-primary" id="add-bonus-btn">${t('add_bonus')}</button>
            </div>
            <hr>
            <button class="btn btn-warning" id="reset-daily-btn">${t('reset_daily')}</button>
        `;
        const footer = `<button type="button" class="btn" data-bs-dismiss="modal">${t('close')}</button>`;
        const modalInstance = renderModal('player-details-modal', `${t('player_details')}: ${escapeHtml(player.name)}`, body, footer);

        document.getElementById('add-bonus-btn').onclick = async () => {
            const amount = document.getElementById('bonus-amount-input').value;
            if (amount) {
                const res = await postData(`player/${playerId}/update-balance`, { amount: Number(amount) });
                if (res) { alert(t('balance_updated')); modalInstance.hide(); renderPlayers(); } 
                else { alert(t('error_updating_balance')); }
            }
        };
        document.getElementById('reset-daily-btn').onclick = async () => {
            if (confirm(t('confirm_reset_daily'))) {
                const res = await postData(`player/${playerId}/reset-daily`);
                if (res) { alert(t('daily_progress_reset_success')); modalInstance.hide(); } 
                else { alert(t('daily_progress_reset_error')); }
            }
        };
    };

    const renderTriggerParamsUI = (container, type, params = {}) => {
        let html = '';
        const localT = t; // Shadowing `t` in map function below was causing issues.
        switch (type) {
            case 'meta_tap':
                const options = META_TAP_TARGETS.map(target => `<option value="${target.id}" ${params.targetId === target.id ? 'selected' : ''}>${localT(target.nameKey)}</option>`).join('');
                html = `
                    <div class="mb-3">
                        <label class="form-label">${localT('param_targetId')}</label>
                        <select class="form-select" data-param="targetId">${options}</select>
                    </div>
                    <div class="mb-3"><label class="form-label">${localT('param_taps')}</label><input type="number" class="form-control" data-param="taps" value="${escapeHtml(params.taps || 5)}"></div>
                `;
                break;
            case 'login_at_time':
                html = `
                    <div class="row">
                        <div class="col"><div class="mb-3"><label class="form-label">${localT('param_hour')}</label><input type="number" class="form-control" data-param="hour" value="${escapeHtml(params.hour || 0)}"></div></div>
                        <div class="col"><div class="mb-3"><label class="form-label">${localT('param_minute')}</label><input type="number" class="form-control" data-param="minute" value="${escapeHtml(params.minute || 0)}"></div></div>
                    </div>
                `;
                break;
            case 'balance_equals':
                html = `<div class="mb-3"><label class="form-label">${localT('param_amount')}</label><input type="number" class="form-control" data-param="amount" value="${escapeHtml(params.amount || 0)}"></div>`;
                break;
            case 'upgrade_purchased':
                const allUpgrades = [...(localConfig.upgrades || []), ...(localConfig.blackMarketCards || [])];
                const upgradeOptions = allUpgrades.map(u => `<option value="${u.id}" ${params.upgradeId === u.id ? 'selected' : ''}>${getLocalizedText(u.name)}</option>`).join('');
                html = `<div class="mb-3"><label class="form-label">${localT('param_upgradeId')}</label><select class="form-select" data-param="upgradeId">${upgradeOptions}</select></div>`;
                break;
        }
        container.innerHTML = html;
    };

    const renderConfigForm = (key, index) => {
        const isNew = index === undefined;
        const item = isNew ? {} : localConfig[key][index];
        const title = isNew ? t('config_add_item') : t('config_edit_item');
        const { cols } = configMeta[key];
        
        let formBody = cols.map(col => {
            let value = item[col];
             if (isNew) {
                if (col === 'id') value = `new_${key}_${Date.now()}`;
                else if (typeof value === 'undefined') {
                    // Pre-fill default structures for certain types
                    if (['name', 'description', 'message'].includes(col)) value = { en: '', ru: '', ua: '' };
                    else if (col === 'reward') value = { type: 'coins', amount: 0 };
                    else if (col === 'trigger') value = { type: 'meta_tap', params: { targetId: '', taps: 5 } };
                    else value = '';
                }
            }
            
            const isLangObject = typeof value === 'object' && value !== null && (value.hasOwnProperty('en') || value.hasOwnProperty('ru') || value.hasOwnProperty('ua'));
            const isRewardObject = typeof value === 'object' && value !== null && value.hasOwnProperty('type') && value.hasOwnProperty('amount');
            const isTriggerObject = col === 'trigger';

            if (isLangObject && !isRewardObject) {
                return `
                    <fieldset class="form-fieldset mb-3">
                        <legend class="d-flex justify-content-between align-items-center">
                            <span>${t(col) || col}</span>
                            <button class="btn btn-sm btn-outline-info" data-action="translate-field" data-col="${col}">${t('translate')}</button>
                        </legend>
                        <div class="mb-2">
                            <label class="form-label">EN</label>
                            <input type="text" class="form-control" data-lang-col="${col}" data-lang="en" value="${escapeHtml(value.en || '')}">
                        </div>
                        <div class="mb-2">
                            <label class="form-label">RU</label>
                            <input type="text" class="form-control" data-lang-col="${col}" data-lang="ru" value="${escapeHtml(value.ru || '')}">
                        </div>
                        <div class="mb-2">
                            <label class="form-label">UA</label>
                            <input type="text" class="form-control" data-lang-col="${col}" data-lang="ua" value="${escapeHtml(value.ua || '')}">
                        </div>
                    </fieldset>
                 `;
            } else if (col === 'reward') {
                const reward = value || { type: 'coins', amount: 0 };
                const coinSelected = reward.type === 'coins' ? 'selected' : '';
                const profitSelected = reward.type === 'profit' ? 'selected' : '';
                 return `
                    <fieldset class="form-fieldset mb-3">
                        <legend>${t('reward')}</legend>
                        <div class="row">
                            <div class="col-md-6">
                                <label class="form-label">${t('type')}</label>
                                <select class="form-select" data-reward-col="${col}" data-reward-prop="type">
                                    <option value="coins" ${coinSelected}>${t('reward_type_coins')}</option>
                                    <option value="profit" ${profitSelected}>${t('reward_type_profit')}</option>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">${t('amount')}</label>
                                <input type="number" class="form-control" data-reward-col="${col}" data-reward-prop="amount" value="${escapeHtml(reward.amount || 0)}">
                            </div>
                        </div>
                    </fieldset>`;
            } else if (isTriggerObject) {
                 const trigger = value || { type: 'meta_tap', params: {} };
                 const triggerTypes = ['meta_tap', 'login_at_time', 'balance_equals', 'upgrade_purchased'];
                 const options = triggerTypes.map(opt => `<option value="${opt}" ${trigger.type === opt ? 'selected' : ''}>${t(`trigger_type_${opt}`)}</option>`).join('');
                 return `
                    <fieldset class="form-fieldset mb-3">
                        <legend>${t('trigger')}</legend>
                        <div class="mb-3">
                           <label class="form-label">${t('trigger_type')}</label>
                           <select class="form-select" id="trigger-type-select">${options}</select>
                        </div>
                        <div id="trigger-params-container"></div>
                    </fieldset>
                 `;
            } else if (col === 'type' && (key === 'tasks' || key === 'specialTasks')) {
                const taskTypes = ['taps', 'telegram_join', 'youtube_subscribe', 'twitter_follow', 'instagram_follow', 'video_watch', 'video_code'];
                const options = taskTypes.map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${t(`task_type_${opt}`)}</option>`).join('');
                return `<div class="mb-3">
                            <label class="form-label">${t(col) || col}</label>
                            <select class="form-select" data-col="${col}" id="task-type-select">${options}</select>
                        </div>`;
            } else if (col === 'secretCode') {
                const isVisible = item.type === 'video_code';
                return `<div class="mb-3" id="secret-code-container" style="display: ${isVisible ? 'block' : 'none'};">
                            <label class="form-label">${t(col) || col}</label>
                            <input type="text" class="form-control" data-col="${col}" value="${escapeHtml(value || '')}">
                        </div>`;
            } else if (col === 'isFinal') {
                // This column is handled separately below, so we skip it here.
                return '';
            } else if (typeof value === 'object' && value !== null) {
                return `
                    <div class="mb-3">
                        <label class="form-label">${t(col) || col}</label>
                        <textarea class="form-control" rows="3" data-col="${col}">${escapeHtml(JSON.stringify(value, null, 2))}</textarea>
                    </div>`;
            } else {
                const isReadonly = isNew && col === 'id';
                return `
                    <div class="mb-3">
                        <label class="form-label">${t(col) || col}</label>
                        <input type="${typeof value === 'number' ? 'number' : 'text'}" class="form-control" data-col="${col}" value="${escapeHtml(value)}" ${isReadonly ? 'readonly' : ''}>
                    </div>`;
            }
        }).join('');
        
        if (key === 'glitchEvents') {
            const isFinal = item.isFinal || false;
            formBody += `
                <div class="form-check form-switch mb-3">
                    <input class="form-check-input" type="checkbox" id="isFinal-checkbox" ${isFinal ? 'checked' : ''}>
                    <label class="form-check-label" for="isFinal-checkbox">${t('is_final_event')}</label>
                </div>
            `;
        }

        const footer = `<button type="button" class="btn me-auto" data-bs-dismiss="modal">${t('cancel')}</button>
                        <button type="button" class="btn btn-primary" data-action="save-config-item" data-key="${key}" data-index="${isNew ? '' : index}">${t('save')}</button>`;
        
        const modalInstance = renderModal('config-modal', title, formBody, footer);

        // Special handling for dynamic UI based on selections
        if (key === 'tasks' || key === 'specialTasks') {
            const taskTypeSelect = document.getElementById('task-type-select');
            const secretCodeContainer = document.getElementById('secret-code-container');
            if(taskTypeSelect && secretCodeContainer) {
                const toggleSecretCode = () => secretCodeContainer.style.display = taskTypeSelect.value === 'video_code' ? 'block' : 'none';
                taskTypeSelect.addEventListener('change', toggleSecretCode);
            }
        }
         if (key === 'glitchEvents') {
            const triggerTypeSelect = document.getElementById('trigger-type-select');
            const paramsContainer = document.getElementById('trigger-params-container');
            if (triggerTypeSelect && paramsContainer) {
                const trigger = item.trigger || { type: 'meta_tap', params: {} };
                renderTriggerParamsUI(paramsContainer, trigger.type, trigger.params);
                triggerTypeSelect.addEventListener('change', () => {
                    renderTriggerParamsUI(paramsContainer, triggerTypeSelect.value);
                });
            }
        }
    };

    // --- MAIN EVENT LISTENER ---
    document.addEventListener('click', async (e) => {
        const actionTarget = e.target.closest('[data-action]');
        if (!actionTarget) return;
        
        const { action, key, index, id, social } = actionTarget.dataset;

        switch(action) {
            case 'edit-config':
                renderConfigForm(key, index);
                break;
            case 'add-config':
                renderConfigForm(key);
                break;
            case 'delete-config':
                if (confirm(t('confirm_delete'))) {
                    localConfig[key].splice(index, 1);
                    renderConfigTable(key);
                }
                break;
            case 'save-config-item': {
                const modal = bootstrap.Modal.getInstance(document.getElementById('config-modal'));
                const newItem = {};
                document.querySelectorAll('#config-modal [data-col]').forEach(input => {
                    const col = input.dataset.col;
                    try {
                        const parsed = JSON.parse(input.value);
                        newItem[col] = parsed;
                    } catch {
                        newItem[col] = isNaN(input.value) || input.value === '' ? input.value : Number(input.value);
                    }
                });
                 // Handle localized fields
                document.querySelectorAll('#config-modal [data-lang-col]').forEach(input => {
                    const col = input.dataset.langCol;
                    const lang = input.dataset.lang;
                    if (!newItem[col]) newItem[col] = {};
                    newItem[col][lang] = input.value;
                });
                 // Handle reward fields
                 document.querySelectorAll('#config-modal [data-reward-col]').forEach(input => {
                    const col = input.dataset.rewardCol;
                    const prop = input.dataset.rewardProp;
                    if (!newItem[col]) newItem[col] = {};
                    newItem[col][prop] = isNaN(input.value) ? input.value : Number(input.value);
                });
                // Handle trigger and isFinal
                if (key === 'glitchEvents') {
                    const triggerType = document.getElementById('trigger-type-select').value;
                    const params = {};
                    document.querySelectorAll('#trigger-params-container [data-param]').forEach(input => {
                         params[input.dataset.param] = isNaN(input.value) || input.value === '' ? input.value : Number(input.value);
                    });
                    newItem.trigger = { type: triggerType, params };
                    newItem.isFinal = document.getElementById('isFinal-checkbox')?.checked || false;
                }

                if (index) { // Edit existing
                    localConfig[key][index] = newItem;
                } else { // Add new
                    if (!localConfig[key]) localConfig[key] = [];
                    localConfig[key].push(newItem);
                }
                modal.hide();
                renderConfigTable(key);
                break;
            }
            case 'translate-field': {
                const btn = actionTarget;
                const col = btn.dataset.col;
                const enInput = document.querySelector(`[data-lang-col="${col}"][data-lang="en"]`);
                if (!enInput || !enInput.value) { alert("English field must be filled to translate."); return; }

                btn.disabled = true;
                btn.textContent = t('translation_in_progress');
                
                const result = await postData('translate-text', {
                    text: enInput.value,
                    targetLangs: ['ru', 'ua']
                });

                if (result && result.translations) {
                    for (const [lang, text] of Object.entries(result.translations)) {
                        const input = document.querySelector(`[data-lang-col="${col}"][data-lang="${lang}"]`);
                        if (input) input.value = text;
                    }
                } else {
                    alert(t('translation_error'));
                }
                btn.disabled = false;
                btn.textContent = t('translate');
                break;
            }
            case 'player-details':
                renderPlayerDetailsModal(id);
                break;
            case 'delete-player':
                if (confirm(t('confirm_delete_player'))) {
                    const res = await deleteData(`player/${id}`);
                    if (res) renderPlayers();
                }
                break;
            case 'reset-progress':
                if (confirm(t('confirm_reset_progress'))) {
                    const res = await postData(`player/${id}/reset-progress`);
                    if (res) { alert(t('progress_reset_success')); renderCheaters(); }
                     else { alert(t('error_resetting_progress')); }
                }
                break;
            case 'view-cheat-log': {
                const player = await fetchData(`player/${id}/details`);
                const logHtml = player.cheatLog ? `<pre>${JSON.stringify(player.cheatLog, null, 2)}</pre>` : t('no_data');
                renderModal('cheat-log-modal', `${t('cheat_log')}: ${player.name}`, logHtml, `<button class="btn" data-bs-dismiss="modal">${t('close')}</button>`);
                break;
            }
            case 'force-start-battle':
                await postData('battle/force-start');
                renderBattleStatus();
                break;
            case 'force-end-battle':
                await postData('battle/force-end');
                renderBattleStatus();
                break;
            case 'generate-ai-content': {
                const btn = actionTarget;
                btn.disabled = true;
                btn.querySelector('span').textContent = t('generating');
                const content = await postData('generate-ai-content');
                if (content) {
                    const upgradesHtml = (content.upgrades || []).map(u => `<li>${u.id} - ${getLocalizedText(u.name)}</li>`).join('');
                    const tasksHtml = (content.specialTasks || []).map(t => `<li>${t.id} - ${getLocalizedText(t.name)}</li>`).join('');
                    const body = `
                        <h4>${t('generated_upgrades')}</h4><ul>${upgradesHtml}</ul>
                        <hr><h4>${t('generated_tasks')}</h4><ul>${tasksHtml}</ul>`;
                    const footer = `<button class="btn" data-bs-dismiss="modal">${t('cancel')}</button>
                                  <button class="btn btn-primary" data-action="confirm-ai-content">${t('add_to_game')}</button>`;
                    const modal = renderModal('ai-content-modal', t('ai_generated_content'), body, footer);
                    
                    document.querySelector('[data-action="confirm-ai-content"]').onclick = () => {
                        localConfig.upgrades = [...(localConfig.upgrades || []), ...content.upgrades];
                        localConfig.specialTasks = [...(localConfig.specialTasks || []), ...content.specialTasks];
                        alert(t('ai_add_success'));
                        modal.hide();
                    };
                }
                btn.disabled = false;
                btn.querySelector('span').textContent = t('generate_new_content');
                break;
            }
            case 'send-broadcast': {
                const btn = actionTarget;
                const text = document.getElementById('broadcast-text').value;
                const imageUrl = document.getElementById('broadcast-image-url').value;
                const buttonUrl = document.getElementById('broadcast-button-url').value;
                const buttonText = document.getElementById('broadcast-button-text').value;

                if (!text) { alert(t('message_text_required')); return; }
                if ((buttonUrl || buttonText) && !(buttonUrl && buttonText)) { alert(t('button_requires_url_and_text')); return; }
                if (!confirm(t('confirm_broadcast'))) return;
                
                btn.disabled = true;
                btn.querySelector('span').textContent = t('sending_broadcast');
                const result = await postData('broadcast-message', { text, imageUrl, buttonUrl, buttonText });
                if (result) alert(result.message);
                
                btn.disabled = false;
                btn.querySelector('span').textContent = t('send_broadcast');
                break;
            }
        }
    });

    // --- INPUT EVENT LISTENERS for live updates ---
    document.addEventListener('input', (e) => {
        const target = e.target;

        // Player search
        if (target.id === 'player-search') {
            const query = target.value.toLowerCase();
            const filtered = allPlayers.filter(p => p.id.includes(query) || p.name.toLowerCase().includes(query));
            document.getElementById('players-table-body').innerHTML = generatePlayerRows(filtered);
        }
        
        // Dashboard single value inputs
        if (target.id === 'loadingScreenUrl') localConfig.loadingScreenImageUrl = target.value;
        if (target.id === 'backgroundAudioUrl') localConfig.backgroundAudioUrl = target.value;
        if (target.id === 'finalVideoUrl') localConfig.finalVideoUrl = target.value;
        
        // Daily events
        if (target.classList.contains('combo-card-select')) {
            dailyEvent.combo_ids = Array.from(document.querySelectorAll('.combo-card-select')).map(select => select.value).filter(Boolean);
        }
        if (target.id === 'cipher-word-input') dailyEvent.cipher_word = target.value.toUpperCase();
        if (target.id === 'combo-reward-input') dailyEvent.combo_reward = Number(target.value);
        if (target.id === 'cipher-reward-input') dailyEvent.cipher_reward = Number(target.value);

        // UI Icons
        if (target.closest('#ui-icons-form')) {
            const { key, group } = target.dataset;
            if (group) {
                if (!localConfig.uiIcons[group]) localConfig.uiIcons[group] = {};
                localConfig.uiIcons[group][key] = target.value;
            } else {
                localConfig.uiIcons[key] = target.value;
            }
            // Update preview
            const preview = target.nextElementSibling?.querySelector('img');
            if(preview) preview.src = target.value;
        }

        // Generic settings & Cell config
        if (target.dataset.configKey) {
            const { configKey, subKey } = target.dataset;
            let value = target.type === 'number' ? Number(target.value) : target.value;

            if (configKey === 'informantProfitBonus' || configKey === 'cellBankProfitShare') {
                value = value / 100;
            }

            if (subKey) {
                if (!localConfig[configKey]) localConfig[configKey] = {};
                localConfig[configKey][subKey] = value;
            } else {
                localConfig[configKey] = value;
            }
        } else if (target.closest('.card-body')?.parentNode?.querySelector('h3')?.textContent === t('cell_config')) {
             const key = target.dataset.key;
             if (key) {
                localConfig[key] = Number(target.value);
             }
        }
    });
    
    // --- NAVIGATION & INITIALIZATION ---
    const switchTab = (tabName) => {
        activeTab = tabName;
        window.location.hash = tabName;
        render();
    };

    const init = async () => {
        // Setup nav links
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                switchTab(btn.dataset.tab);
            });
        });
        
        document.querySelectorAll('.lang-select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                currentLang = btn.dataset.lang;
                localStorage.setItem('adminLang', currentLang);
                render();
            });
        });
        
        saveMainButton.addEventListener('click', saveAllChanges);
        
        // Initial data load
        showLoading();
        localConfig = await fetchData('config') || {};
        
        // Initial tab from hash or default to dashboard
        const hash = window.location.hash.substring(1);
        if (hash) {
            activeTab = hash;
        }
        
        render();
    };

    init();
});