



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
        leagues: { title: 'leagues', cols: ['id', 'name', 'description', 'minProfitPerHour', 'iconUrl'] },
        upgrades: { title: 'upgrades', cols: ['id', 'name', 'price', 'profitPerHour', 'category', 'iconUrl'] },
        tasks: { title: 'tasks', cols: ['id', 'name', 'type', 'reward', 'requiredTaps', 'url', 'secretCode', 'imageUrl'] },
        specialTasks: { title: 'specialTasks', cols: ['id', 'name', 'description', 'type', 'reward', 'priceStars', 'url', 'secretCode', 'imageUrl'] },
        blackMarketCards: { title: 'blackMarketCards', cols: ['id', 'name', 'profitPerHour', 'chance', 'boxType', 'iconUrl'] },
        coinSkins: { title: 'coinSkins', cols: ['id', 'name', 'profitBoostPercent', 'chance', 'boxType', 'iconUrl'] },
        uiIcons: { title: 'ui_icons' },
        boosts: { title: 'boosts', cols: ['id', 'name', 'description', 'costCoins', 'iconUrl'] },
    };

    // --- DOM ELEMENTS ---
    const tabContainer = document.getElementById('tab-content-container');
    const tabTitle = document.getElementById('tab-title');
    const saveMainButton = document.getElementById('save-main-button');
    const modalsContainer = document.getElementById('modals-container');
    
    // --- TRANSLATION FUNCTION ---
    const t = (key) => LOCALES[currentLang]?.[key] || LOCALES['en']?.[key] || `[${key}]`;

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
    
    const applyTranslations = () => {
        document.querySelectorAll('[data-translate]').forEach(el => {
            const key = el.dataset.translate;
            el.textContent = t(key);
        });
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

    const render = () => {
        destroyCharts();
        document.querySelectorAll('.tab-button').forEach(btn => {
            const isActive = btn.dataset.tab === activeTab;
            btn.classList.toggle('active', isActive);
            const dropdownToggle = btn.closest('.dropdown-menu')?.previousElementSibling;
            if(dropdownToggle) {
                 const parentNavItem = dropdownToggle.closest('.nav-item');
                 if(parentNavItem.querySelector('.tab-button.active')){
                    parentNavItem.classList.add('active');
                    dropdownToggle.classList.add('show');
                    btn.closest('.dropdown-menu').classList.add('show');
                 } else {
                    parentNavItem.classList.remove('active');
                 }
            }
        });

        tabTitle.dataset.translate = activeTab;
        tabTitle.classList.add('font-display');

        const configTabs = ['upgrades', 'tasks', 'specialTasks', 'dailyEvents', 'boosts', 'blackMarketCards', 'coinSkins', 'leagues', 'uiIcons'];
        saveMainButton.classList.toggle('d-none', !(configTabs.includes(activeTab) || activeTab === 'dashboard'));

        switch (activeTab) {
            case 'dashboard': renderDashboard(); break;
            case 'players': renderPlayersTab(); break;
            case 'cheaters': renderCheatersTab(); break;
            case 'dailyEvents': renderDailyEvents(); break;
            case 'leagues': renderConfigTable('leagues'); break;
            case 'specialTasks': renderConfigTable('specialTasks'); break;
            case 'upgrades': renderConfigTable('upgrades'); break;
            case 'tasks': renderConfigTable('tasks'); break;
            case 'boosts': renderConfigTable('boosts'); break;
            case 'blackMarketCards': renderConfigTable('blackMarketCards'); break;
            case 'coinSkins': renderConfigTable('coinSkins'); break;
            case 'uiIcons': renderUiIcons(); break;
            default: renderDashboard();
        }
        applyTranslations();
        addEventListeners();
    };
    
    // --- RENDER FUNCTIONS ---
    const renderDashboard = () => {
        tabContainer.innerHTML = `
            <div class="row row-deck row-cards">
                <!-- Stats Cards -->
                <div class="col-lg-2-4 col-sm-6"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><div class="subheader" data-translate="total_players"></div></div><div class="h1 mb-3">${formatNumber(dashboardStats.totalPlayers)}</div></div></div></div>
                <div class="col-lg-2-4 col-sm-6"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><div class="subheader" data-translate="new_players_24h"></div></div><div class="h1 mb-3">${formatNumber(dashboardStats.newPlayersToday)}</div></div></div></div>
                <div class="col-lg-2-4 col-sm-6"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><div class="subheader" data-translate="online_now"></div></div><div class="h1 mb-3">${formatNumber(dashboardStats.onlineNow)}</div></div></div></div>
                <div class="col-lg-2-4 col-sm-6"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><div class="subheader" data-translate="total_profit_per_hour"></div></div><div class="h1 mb-3 text-green">${formatNumber(dashboardStats.totalProfitPerHour)}</div></div></div></div>
                <div class="col-lg-2-4 col-sm-6"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><div class="subheader" data-translate="earned_stars"></div></div><div class="h1 mb-3 text-yellow">${formatNumber(dashboardStats.totalStarsEarned)}</div></div></div></div>
            </div>
            
            <div class="row row-cards mt-4">
                <div class="col-lg-5">
                    <div class="card mb-3">
                        <div class="card-body" style="padding: 1rem;">
                           <label class="form-label font-display" data-translate="loading_screen_image_url"></label>
                           <input type="text" class="form-control" id="loading-screen-url-input" value="${escapeHtml(localConfig.loadingScreenImageUrl || '')}">
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-body" style="height: 284px;">
                            <h3 class="card-title font-display" data-translate="player_map"></h3>
                            <div id="map-world" class="w-100 h-100"></div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-7">
                    <div class="card mb-3">
                        <div class="card-body" style="height: 142px;">
                            <h3 class="card-title font-display" data-translate="new_users_last_7_days"></h3>
                            <canvas id="chart-registrations"></canvas>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-body" style="height: 250px;">
                           <h3 class="card-title font-display" data-translate="top_5_upgrades"></h3>
                           <canvas id="chart-upgrades"></canvas>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="row row-cards mt-4">
                 <div class="col-md-6">
                    <div class="card" style="height: 300px;">
                         <div class="card-body d-flex flex-column">
                            <div class="d-flex justify-content-between align-items-center">
                               <h3 class="card-title font-display" data-translate="youtube_stats"></h3>
                               <button class="btn btn-sm btn-icon btn-ghost-secondary social-edit-btn" data-social="youtube" title="${t('edit')}">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-pencil" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"></path><path d="M13.5 6.5l4 4"></path></svg>
                               </button>
                            </div>
                            <div class="flex-grow-1"><canvas id="chart-youtube"></canvas></div>
                        </div>
                    </div>
                 </div>
                 <div class="col-md-6">
                    <div class="card" style="height: 300px;">
                        <div class="card-body d-flex flex-column">
                             <div class="d-flex justify-content-between align-items-center">
                               <h3 class="card-title font-display" data-translate="telegram_stats"></h3>
                               <button class="btn btn-sm btn-icon btn-ghost-secondary social-edit-btn" data-social="telegram" title="${t('edit')}">
                                   <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-pencil" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"></path><path d="M13.5 6.5l4 4"></path></svg>
                               </button>
                            </div>
                            <div class="flex-grow-1"><canvas id="chart-telegram"></canvas></div>
                        </div>
                    </div>
                </div>
            </div>`;

        // Chart Options
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(156, 163, 175, 0.2)' } },
                x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(156, 163, 175, 0.2)' } }
            }
        };
        const barChartOptions = { ...chartOptions, indexAxis: 'y' };

        // Initialize Charts
        const upgradeNames = (dashboardStats.popularUpgrades || []).map(upg => {
            const allUpgrades = [...(localConfig.upgrades || []), ...(localConfig.blackMarketCards || [])];
            const details = allUpgrades.find(u => u.id === upg.upgrade_id);
            return details?.name?.[currentLang] || details?.name?.en || upg.upgrade_id;
        });
        const upgradeCounts = (dashboardStats.popularUpgrades || []).map(upg => parseInt(upg.purchase_count));
        charts.upgrades = new Chart(document.getElementById('chart-upgrades'), {
            type: 'bar',
            data: { labels: upgradeNames, datasets: [{ label: t('purchases'), data: upgradeCounts, backgroundColor: '#4ade80' }] },
            options: barChartOptions
        });

        const regDates = (dashboardStats.registrations || []).map(r => new Date(r.date).toLocaleDateString(currentLang));
        const regCounts = (dashboardStats.registrations || []).map(r => r.count);
        charts.registrations = new Chart(document.getElementById('chart-registrations'), {
            type: 'line',
            data: { labels: regDates, datasets: [{ label: t('new_players_24h'), data: regCounts, tension: 0.1, pointRadius: 4, borderColor: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.2)', fill: true }] },
            options: chartOptions
        });
        
        // Social charts using same registration data for trend visualization
        charts.youtube = new Chart(document.getElementById('chart-youtube'), {
            type: 'line',
            data: { labels: regDates, datasets: [{ label: t('social_youtube_subs'), data: regCounts, tension: 0.1, pointRadius: 4, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.2)', fill: true }] },
            options: chartOptions
        });
        charts.telegram = new Chart(document.getElementById('chart-telegram'), {
            type: 'line',
            data: { labels: regDates, datasets: [{ label: t('social_telegram_subs'), data: regCounts, tension: 0.1, pointRadius: 4, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.2)', fill: true }] },
            options: chartOptions
        });


        // Initialize jsVectorMap
        const mapData = (playerLocations || []).reduce((acc, loc) => {
            if (loc.country) {
                acc[loc.country] = loc.player_count;
            }
            return acc;
        }, {});
        
        const mapEl = document.getElementById('map-world');
        if (mapEl && window.jsVectorMap) {
            mapEl.innerHTML = ''; // Clear previous map
            charts.map = new jsVectorMap({
                selector: '#map-world',
                map: 'world',
                backgroundColor: 'transparent',
                regionStyle: {
                    initial: { fill: '#374151' }, // gray-700
                    hover: { fill: '#4ade80' } // green-400
                },
                series: {
                    regions: [{
                        values: mapData,
                        scale: ['#374151', '#16a34a'], // gray-700 to green-600
                        normalizeFunction: 'polynomial'
                    }]
                },
                onRegionTooltipShow(event, tooltip, code) {
                    const playerCount = mapData[code] || 0;
                    tooltip.text(`${tooltip.text()} - ${formatNumber(playerCount)} ${t('players')}`);
                }
            });
        }
    };

    const renderDailyEvents = () => {
        tabContainer.innerHTML = `
         <div class="card">
            <div class="card-header"><h3 class="card-title font-display" data-translate="daily_events_setup"></h3></div>
            <div class="card-body">
                <div class="row g-4">
                    <div class="col-lg-6">
                        <h4 class="font-display" data-translate="daily_combo"></h4>
                        <p class="text-secondary" data-translate="select_3_cards_for_combo"></p>
                        <div class="row g-2 mb-3">
                           ${[0, 1, 2].map(i => `
                            <div class="col-md-4">
                                <select data-event="combo" data-index="${i}" class="form-select">
                                    <option value="">${t('select_card')} ${i + 1}</option>
                                    ${(localConfig.upgrades || []).map(u => `<option value="${u.id}" ${dailyEvent.combo_ids?.[i] === u.id ? 'selected' : ''}>${u.name[currentLang] || u.name.en}</option>`).join('')}
                                </select>
                            </div>
                           `).join('')}
                        </div>
                        <div class="mb-3">
                            <label class="form-label" data-translate="combo_reward"></label>
                            <input type="number" id="combo-reward-input" value="${dailyEvent.combo_reward || '5000000'}" class="form-control">
                        </div>
                    </div>
                     <div class="col-lg-6">
                        <h4 class="font-display" data-translate="daily_cipher"></h4>
                        <p class="text-secondary" data-translate="enter_cipher_word"></p>
                        <div class="mb-3">
                            <label class="form-label" data-translate="cipher_word"></label>
                            <input type="text" id="cipher-word-input" value="${dailyEvent.cipher_word || ''}" class="form-control" placeholder="${t('example_btc')}">
                        </div>
                         <div class="mb-3">
                            <label class="form-label" data-translate="cipher_reward"></label>
                            <input type="number" id="cipher-reward-input" value="${dailyEvent.cipher_reward || '1000000'}" class="form-control">
                        </div>
                    </div>
                </div>
            </div>
         </div>
        `;
    };

    const renderPlayersTab = (filteredPlayers) => {
        const playersToRender = filteredPlayers || allPlayers;
        tabContainer.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title font-display" data-translate="players"></h3>
                <div class="ms-auto text-secondary">
                    <input type="text" id="player-search" class="form-control form-control-sm" placeholder="${t('search_by_id_name')}">
                </div>
            </div>
            <div class="table-responsive">
                <table class="table card-table table-vcenter text-nowrap datatable">
                    <thead>
                        <tr>
                            <th data-translate="id"></th>
                            <th data-translate="name"></th>
                            <th data-translate="balance"></th>
                            <th data-translate="profit_ph"></th>
                            <th data-translate="stars_spent"></th>
                            <th data-translate="referrals"></th>
                            <th data-translate="language"></th>
                            <th data-translate="actions"></th>
                        </tr>
                    </thead>
                    <tbody id="players-table-body">
                        ${playersToRender.map(p => `
                            <tr class="player-row" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name?.toLowerCase() ?? '')}">
                                <td><span class="text-secondary">${escapeHtml(p.id)}</span></td>
                                <td class="font-bold">${escapeHtml(p.name)}</td>
                                <td><span class="text-yellow-400 font-bold">${formatNumber(p.balance)}</span></td>
                                <td><span class="text-green-400">+${formatNumber(p.profitPerHour)}</span></td>
                                <td>${formatNumber(p.starsSpent)}</td>
                                <td>${formatNumber(p.referrals)}</td>
                                <td>${escapeHtml(p.language)}</td>
                                <td>
                                    <button class="btn btn-sm btn-icon view-player-btn" data-id="${p.id}" title="${t('player_details')}">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-eye" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6s-6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6s6.6 2 9 6" /></svg>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
        if (playersToRender.length === 0) {
            document.getElementById('players-table-body').innerHTML = `<tr><td colspan="8" class="text-center p-5 text-secondary">${t('no_data')}</td></tr>`;
        }
    };
    
    const renderCheatersTab = async () => {
        showLoading('loading_cheaters');
        try {
            const cheaters = await fetchApi('/admin/api/cheaters');
            tabContainer.innerHTML = `
                <div class="card">
                    <div class="card-header"><h3 class="card-title font-display" data-translate="cheater_list"></h3></div>
                    <div class="card-body">
                        <p class="text-secondary" data-translate="cheater_list_desc"></p>
                    </div>
                    <div class="table-responsive">
                        <table class="table card-table table-vcenter">
                            <thead>
                                <tr>
                                    <th data-translate="id"></th>
                                    <th data-translate="name"></th>
                                    <th data-translate="cheat_log"></th>
                                    <th data-translate="actions"></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${cheaters.map(c => `
                                    <tr>
                                        <td><span class="text-secondary">${escapeHtml(c.id)}</span></td>
                                        <td>${escapeHtml(c.name)}</td>
                                        <td><pre class="text-xs text-danger" style="white-space: pre-wrap; word-break: break-all;">${escapeHtml(JSON.stringify(c.cheat_log, null, 2))}</pre></td>
                                        <td>
                                            <button class="btn btn-sm btn-danger reset-progress-btn" data-id="${c.id}" data-translate="reset_progress"></button>
                                        </td>
                                    </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>`;

            if (cheaters.length === 0) {
                tabContainer.querySelector('tbody').innerHTML = `<tr><td colspan="4" class="text-center p-5 text-secondary" data-translate="no_cheaters_found"></td></tr>`;
            }
            applyTranslations();
            addEventListeners();
        } catch (e) {
            tabContainer.innerHTML = `<div class="alert alert-danger">${t('error_loading_data')}</div>`;
            applyTranslations();
        }
    };
    
    const formatCellContent = (item, col) => {
        const value = item[col];
        if (value === null || value === undefined) return '';

        if (typeof value === 'object') {
            if (col === 'name' || col === 'description') {
                return escapeHtml(value[currentLang] || value.en || JSON.stringify(value));
            }
            if (col === 'reward') {
                const typeText = t(`reward_type_${value.type}`);
                return `${formatNumber(value.amount)} (${typeText})`;
            }
            return escapeHtml(JSON.stringify(value));
        }
        return escapeHtml(value);
    };

    const renderConfigTable = (configKey) => {
        const items = localConfig[configKey] || [];
        const meta = configMeta[configKey];

        tabContainer.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title font-display" data-translate="${meta.title}"></h3>
                    <div class="ms-auto btn-list">
                         <button class="btn btn-primary add-item-btn" data-config-key="${configKey}">
                             <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M12 5l0 14"></path><path d="M5 12l14 0"></path></svg>
                             <span data-translate="add_new"></span>
                         </button>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table card-table table-vcenter">
                        <thead>
                            <tr>
                                ${meta.cols.map(col => `<th data-translate="${col}">${col}</th>`).join('')}
                                <th data-translate="actions"></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => `
                                <tr data-id="${item.id}">
                                    ${meta.cols.map(col => `<td>${formatCellContent(item, col)}</td>`).join('')}
                                    <td>
                                        <button class="btn btn-sm btn-icon edit-item-btn" data-config-key="${configKey}" data-id="${item.id}" title="${t('edit')}">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-pencil" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /></svg>
                                        </button>
                                        <button class="btn btn-sm btn-icon btn-danger delete-item-btn" data-config-key="${configKey}" data-id="${item.id}" title="${t('delete')}">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-x" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    };
    
    const renderUiIcons = () => {
        const icons = localConfig.uiIcons || {};
        const iconGroups = [
            {
                title: 'icon_group_nav',
                icons: [
                    { key: 'nav.exchange', label: 'icon_nav_exchange' },
                    { key: 'nav.mine', label: 'icon_nav_mine' },
                    { key: 'nav.missions', label: 'icon_nav_missions' },
                    { key: 'nav.airdrop', label: 'icon_nav_airdrop' },
                    { key: 'nav.profile', label: 'icon_nav_profile' }
                ]
            },
            {
                title: 'icon_group_gameplay',
                icons: [
                    { key: 'energy', label: 'icon_energy' },
                    { key: 'coin', label: 'icon_coin' },
                    { key: 'star', label: 'icon_star' }
                ]
            },
            {
                title: 'icon_group_market',
                icons: [
                    { key: 'marketCoinBox', label: 'icon_market_coin_box' },
                    { key: 'marketStarBox', label: 'icon_market_star_box' }
                ]
            }
        ];

        const renderInputRow = (icon) => {
             const keyParts = icon.key.split('.');
             const value = keyParts.length > 1 ? icons[keyParts[0]]?.[keyParts[1]] : icons[keyParts[0]];
             return `
                <div class="row align-items-center mb-3">
                    <label class="col-sm-3 col-form-label" data-translate="${icon.label}"></label>
                    <div class="col-sm-7">
                        <input type="text" class="form-control config-input" data-field="${icon.key}" value="${escapeHtml(value || '')}">
                    </div>
                    <div class="col-sm-2">
                        <img src="${escapeHtml(value || '')}" class="avatar" alt="Preview" onerror="this.style.display='none'">
                    </div>
                </div>
             `;
        };

        tabContainer.innerHTML = `
            <div class="card">
                <div class="card-header"><h3 class="card-title font-display" data-translate="ui_icons"></h3></div>
                <div class="card-body">
                    ${iconGroups.map(group => `
                        <fieldset class="form-fieldset">
                            <legend class="font-display" data-translate="${group.title}"></legend>
                            ${group.icons.map(renderInputRow).join('')}
                        </fieldset>
                    `).join('')}
                </div>
            </div>`;
    };

    // --- MODALS ---
    const showPlayerDetailsModal = (player) => {
        modalsContainer.innerHTML = `
            <div class="modal modal-blur fade show" style="display: block;" tabindex="-1">
              <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                  <div class="modal-header">
                    <h5 class="modal-title font-display" data-translate="player_details"></h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div class="modal-body">
                    <div class="row">
                        <div class="col-md-6">
                           <p><strong>ID:</strong> ${player.id}</p>
                           <p><strong>${t('name')}:</strong> ${escapeHtml(player.name)}</p>
                           <p><strong>${t('current_balance')}:</strong> ${formatNumber(player.balance)}</p>
                           <hr>
                           <div class="mb-3">
                                <label class="form-label" data-translate="bonus_amount"></label>
                                <input type="number" class="form-control" id="bonus-amount-input" placeholder="10000">
                           </div>
                           <button class="btn btn-primary" id="add-bonus-btn">${t('add_bonus')}</button>
                           <hr class="my-3">
                           <button class="btn btn-warning me-2" id="reset-daily-btn">${t('reset_daily')}</button>
                           <button class="btn btn-danger" id="delete-player-btn">${t('delete')}</button>
                        </div>
                        <div class="col-md-6">
                            <h5 data-translate="player_upgrades"></h5>
                            <div class="table-responsive" style="max-height: 300px;">
                                <table class="table table-sm">
                                    <thead><tr><th>${t('name')}</th><th>${t('level')}</th></tr></thead>
                                    <tbody>
                                        ${Object.entries(player.upgrades || {}).map(([id, level]) => {
                                            const allUpgrades = [...(localConfig.upgrades || []), ...(localConfig.blackMarketCards || [])];
                                            const upgrade = allUpgrades.find(u => u.id === id);
                                            return `<tr><td>${escapeHtml(upgrade?.name?.[currentLang] || id)}</td><td>${level}</td></tr>`;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>`;
        applyTranslations();
        document.querySelector('.modal .btn-close').addEventListener('click', () => modalsContainer.innerHTML = '');
        document.getElementById('add-bonus-btn').addEventListener('click', async () => {
            const amount = document.getElementById('bonus-amount-input').value;
            const response = await postApi(`/admin/api/player/${player.id}/update-balance`, { amount: parseFloat(amount) });
            if (response.ok) {
                alert(t('balance_updated'));
                modalsContainer.innerHTML = '';
                await init();
            } else {
                alert(t('error_updating_balance'));
            }
        });
        document.getElementById('reset-daily-btn').addEventListener('click', () => {
             showConfirmationModal(t('confirm_reset_daily'), async () => {
                const response = await postApi(`/admin/api/player/${player.id}/reset-daily`, {});
                if (response.ok) {
                    alert(t('daily_progress_reset_success'));
                } else {
                    alert(t('daily_progress_reset_error'));
                }
             });
        });
        document.getElementById('delete-player-btn').addEventListener('click', () => {
            showConfirmationModal(t('confirm_delete_player'), async () => {
                const response = await fetchApi(`/admin/api/player/${player.id}`, { method: 'DELETE' });
                if (response.ok) {
                    modalsContainer.innerHTML = '';
                    await init();
                }
            });
        });
    };
    
    const showConfirmationModal = (messageKey, onConfirm) => {
        modalsContainer.innerHTML = ''; // Clear previous modals
        const modalHtml = `
          <div class="modal modal-blur fade show" style="display: block; background-color: rgba(0,0,0,0.5);" tabindex="-1">
            <div class="modal-dialog modal-sm modal-dialog-centered">
              <div class="modal-content">
                <button type="button" class="btn-close" aria-label="Close"></button>
                <div class="modal-status bg-danger"></div>
                <div class="modal-body text-center py-4">
                  <h3 data-translate="${messageKey}"></h3>
                </div>
                <div class="modal-footer">
                  <div class="w-100">
                    <div class="row">
                      <div class="col"><a href="#" class="btn w-100 cancel-btn" data-translate="cancel"></a></div>
                      <div class="col"><a href="#" class="btn btn-danger w-100 confirm-btn" data-translate="confirm"></a></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>`;
        modalsContainer.innerHTML = modalHtml;
        applyTranslations();
        
        const modalElement = modalsContainer.firstElementChild;
        modalElement.querySelector('.btn-close').addEventListener('click', () => modalElement.remove());
        modalElement.querySelector('.cancel-btn').addEventListener('click', (e) => { e.preventDefault(); modalElement.remove(); });
        modalElement.querySelector('.confirm-btn').addEventListener('click', (e) => {
            e.preventDefault();
            onConfirm();
            modalElement.remove();
        });
    };

    const showConfigItemModal = (configKey, itemId = null) => {
        const isNew = itemId === null;
        const meta = configMeta[configKey];
        const items = localConfig[configKey] || [];
        const item = isNew ? {} : items.find(i => i.id === itemId);

        if (!isNew && !item) return;

        const generateFieldHtml = (col) => {
            const val = item[col] || '';
            const isReadonly = col === 'id' && !isNew;
            let inputHtml = '';
            
            if (col === 'name' || col === 'description') {
                inputHtml = `
                    <div class="row g-2">
                        <div class="col">
                             <input type="text" class="form-control" name="${col}.en" value="${escapeHtml(val.en || '')}" placeholder="EN">
                        </div>
                        <div class="col">
                             <input type="text" class="form-control" name="${col}.ru" value="${escapeHtml(val.ru || '')}" placeholder="RU">
                        </div>
                    </div>`;
            } else if (col === 'category') {
                const categories = ['Documents', 'Legal', 'Lifestyle', 'Special'];
                inputHtml = `<select class="form-select" name="${col}">${categories.map(c => `<option value="${c}" ${val === c ? 'selected' : ''}>${c}</option>`).join('')}</select>`;
            } else if (col === 'type') {
                const types = ['taps', 'telegram_join', 'social_follow', 'video_watch', 'video_code'];
                inputHtml = `<select class="form-select" name="${col}">${types.map(t => `<option value="${t}" ${val === t ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
            } else if (col === 'boxType') {
                const types = ['coin', 'star', 'direct'];
                inputHtml = `<select class="form-select" name="${col}">${types.map(t => `<option value="${t}" ${val === t ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
            } else if (col === 'reward') {
                 inputHtml = `
                    <div class="input-group">
                        <input type="number" class="form-control" name="reward.amount" value="${escapeHtml(val.amount || 0)}" placeholder="Amount">
                        <select class="form-select" name="reward.type">
                            <option value="coins" ${val.type === 'coins' ? 'selected' : ''}>${t('reward_type_coins')}</option>
                            <option value="profit" ${val.type === 'profit' ? 'selected' : ''}>${t('reward_type_profit')}</option>
                        </select>
                    </div>`;
            } else {
                const inputType = typeof val === 'number' ? 'number' : 'text';
                 inputHtml = `<input type="${inputType}" class="form-control" name="${col}" value="${escapeHtml(val)}" ${isReadonly ? 'readonly' : ''}>`;
            }
            return `<div class="mb-3"><label class="form-label" data-translate="${col}"></label>${inputHtml}</div>`;
        };
        
        const formHtml = meta.cols.map(generateFieldHtml).join('');

        modalsContainer.innerHTML = `
        <div class="modal modal-blur fade show" style="display: block; background-color: rgba(0,0,0,0.5);" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title font-display" data-translate="${isNew ? 'config_add_item' : 'config_edit_item'}"></h5>
                <button type="button" class="btn-close" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <form id="config-item-form">${formHtml}</form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn me-auto cancel-btn" data-translate="cancel"></button>
                <button type="button" class="btn btn-primary save-item-btn" data-translate="save"></button>
              </div>
            </div>
          </div>
        </div>
        `;
        applyTranslations();
        
        const modalElement = modalsContainer.firstElementChild;
        modalElement.querySelector('.btn-close').addEventListener('click', () => modalElement.remove());
        modalElement.querySelector('.cancel-btn').addEventListener('click', () => modalElement.remove());
        
        modalElement.querySelector('.save-item-btn').addEventListener('click', () => {
            const form = document.getElementById('config-item-form');
            const formData = new FormData(form);
            const newItemData = isNew ? { id: `new_${configKey}_${Date.now()}` } : { ...item };
            
            formData.forEach((value, key) => {
                 const keys = key.split('.');
                 let current = newItemData;
                 keys.forEach((k, i) => {
                     if (i === keys.length - 1) {
                         current[k] = isNaN(Number(value)) || value === '' ? value : Number(value);
                     } else {
                         if (!current[k]) current[k] = {};
                         current = current[k];
                     }
                 });
            });

            if (isNew) {
                if (!localConfig[configKey]) localConfig[configKey] = [];
                localConfig[configKey].push(newItemData);
            } else {
                const index = localConfig[configKey].findIndex(i => i.id === itemId);
                if (index !== -1) {
                    localConfig[configKey][index] = newItemData;
                }
            }
            
            render(); // Re-render the table
            modalElement.remove();
        });
    };

    const showSocialsEditModal = (socialType) => {
        const socials = localConfig.socials || {};
        const isYouTube = socialType === 'youtube';
        const titleKey = isYouTube ? 'edit_youtube_settings' : 'edit_telegram_settings';
        const urlKey = isYouTube ? 'youtubeUrl' : 'telegramUrl';
        const idKey = isYouTube ? 'youtubeChannelId' : 'telegramChannelId';
        const urlLabelKey = isYouTube ? 'youtube_channel_url' : 'telegram_channel_url';
        const urlDescKey = isYouTube ? 'youtube_channel_url_desc' : 'telegram_channel_url_desc';
        const idLabelKey = isYouTube ? 'youtube_channel_id' : 'telegram_channel_id';
        const idDescKey = isYouTube ? 'youtube_channel_id_desc' : 'telegram_channel_id_desc';

        modalsContainer.innerHTML = `
        <div class="modal modal-blur fade show" style="display: block;" tabindex="-1" id="socials-edit-modal">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title font-display" data-translate="${titleKey}"></h5>
                <button type="button" class="btn-close" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                    <label class="form-label" data-translate="${urlLabelKey}"></label>
                    <input type="text" class="form-control" id="social-url-input" value="${escapeHtml(socials[urlKey] || '')}">
                    <div class="form-text" data-translate="${urlDescKey}"></div>
                </div>
                <div class="mb-3">
                    <label class="form-label" data-translate="${idLabelKey}"></label>
                    <input type="text" class="form-control" id="social-id-input" value="${escapeHtml(socials[idKey] || '')}">
                    <div class="form-text" data-translate="${idDescKey}"></div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn me-auto" data-bs-dismiss="modal" data-translate="close"></button>
                <button type="button" class="btn btn-primary" id="save-socials-btn" data-translate="save"></button>
              </div>
            </div>
          </div>
        </div>
        `;
        applyTranslations();

        const modalElement = document.getElementById('socials-edit-modal');
        modalElement.querySelector('.btn-close').addEventListener('click', () => modalElement.remove());
        modalElement.querySelector('[data-bs-dismiss="modal"]').addEventListener('click', () => modalElement.remove());
        modalElement.querySelector('#save-socials-btn').addEventListener('click', () => {
            if (!localConfig.socials) localConfig.socials = {};
            localConfig.socials[urlKey] = document.getElementById('social-url-input').value;
            localConfig.socials[idKey] = document.getElementById('social-id-input').value;
            
            // Trigger main save
            handleSave();
            modalElement.remove();
        });
    };


    // --- EVENT LISTENERS ---
    function addEventListeners() {
        document.body.addEventListener('click', e => {
            const tabButton = e.target.closest('.tab-button');
            if(tabButton) {
                e.preventDefault();
                activeTab = tabButton.dataset.tab;
                history.pushState(null, '', `#${activeTab}`);
                render();
            }

            const viewPlayerBtn = e.target.closest('.view-player-btn');
            if(viewPlayerBtn) {
                const playerId = viewPlayerBtn.dataset.id;
                fetchApi(`/admin/api/player/${playerId}/details`).then(playerDetails => {
                     if(playerDetails) showPlayerDetailsModal(playerDetails);
                });
            }
            
            const resetProgressBtn = e.target.closest('.reset-progress-btn');
            if (resetProgressBtn) {
                const playerId = resetProgressBtn.dataset.id;
                showConfirmationModal('confirm_reset_progress', async () => {
                    const response = await postApi(`/admin/api/player/${playerId}/reset-progress`, {});
                    if(response.ok) {
                        alert(t('progress_reset_success'));
                        render(); // Re-render cheaters tab
                    } else {
                        alert(t('error_resetting_progress'));
                    }
                });
            }

            const editItemBtn = e.target.closest('.edit-item-btn');
            if (editItemBtn) {
                const { configKey, id } = editItemBtn.dataset;
                showConfigItemModal(configKey, id);
            }

            const addItemBtn = e.target.closest('.add-item-btn');
            if (addItemBtn) {
                const { configKey } = addItemBtn.dataset;
                showConfigItemModal(configKey, null);
            }

            const deleteItemBtn = e.target.closest('.delete-item-btn');
            if(deleteItemBtn) {
                const { configKey, id } = deleteItemBtn.dataset;
                 showConfirmationModal('confirm_delete', () => {
                    localConfig[configKey] = localConfig[configKey].filter(item => item.id !== id);
                    render();
                });
            }

            const socialEditBtn = e.target.closest('.social-edit-btn');
            if(socialEditBtn) {
                const socialType = socialEditBtn.dataset.social;
                showSocialsEditModal(socialType);
            }

            const langSelectBtn = e.target.closest('.lang-select-btn');
            if (langSelectBtn) {
                e.preventDefault();
                currentLang = langSelectBtn.dataset.lang;
                localStorage.setItem('adminLang', currentLang);
                applyTranslations();
                if(activeTab === 'dashboard') render();
            }
        });
        
        // Use event delegation for inputs to simplify re-rendering
        document.body.addEventListener('input', e => {
            const playerSearch = e.target.closest('#player-search');
            if (playerSearch) {
                 const searchTerm = playerSearch.value.toLowerCase();
                 const filtered = allPlayers.filter(p => p.id.includes(searchTerm) || (p.name && p.name.toLowerCase().includes(searchTerm)));
                 renderPlayersTab(filtered);
            }

            const loadingScreenInput = e.target.closest('#loading-screen-url-input');
            if (loadingScreenInput) {
                localConfig.loadingScreenImageUrl = loadingScreenInput.value;
            }

            const dailyEventInput = e.target.closest('[data-event="combo"], #cipher-word-input, #combo-reward-input, #cipher-reward-input');
            if (dailyEventInput) {
                if (dailyEventInput.dataset.event === 'combo') {
                    const index = parseInt(dailyEventInput.dataset.index);
                    if (!dailyEvent.combo_ids) dailyEvent.combo_ids = [];
                    dailyEvent.combo_ids[index] = dailyEventInput.value;
                } else if (dailyEventInput.id === 'cipher-word-input') {
                    dailyEvent.cipher_word = dailyEventInput.value;
                } else if (dailyEventInput.id === 'combo-reward-input') {
                    dailyEvent.combo_reward = parseInt(dailyEventInput.value) || 0;
                } else if (dailyEventInput.id === 'cipher-reward-input') {
                    dailyEvent.cipher_reward = parseInt(dailyEventInput.value) || 0;
                }
            }

            const uiIconInput = e.target.closest('#tab-content-container .config-input');
            if(uiIconInput && activeTab === 'uiIcons') {
                const field = uiIconInput.dataset.field;
                const value = uiIconInput.value;
                 const fieldParts = field.split('.');
                 if (!localConfig.uiIcons) localConfig.uiIcons = {};
                 if (fieldParts.length > 1) {
                      if (!localConfig.uiIcons[fieldParts[0]]) localConfig.uiIcons[fieldParts[0]] = {};
                      localConfig.uiIcons[fieldParts[0]][fieldParts[1]] = value;
                 } else {
                      localConfig.uiIcons[field] = value;
                 }
                 const previewImg = uiIconInput.closest('.row').querySelector('img');
                 if (previewImg) {
                     previewImg.src = value;
                     previewImg.style.display = 'block';
                 }
            }
        });
        
        saveMainButton.addEventListener('click', handleSave);
    }

    // --- API & SAVE FUNCTIONS ---
    async function handleSave() {
        saveMainButton.disabled = true;
        const originalText = saveMainButton.innerHTML;
        saveMainButton.innerHTML = `<div class="spinner-border spinner-border-sm" role="status"></div><span class="ms-2">${t('saving')}</span>`;
        
        try {
            if (activeTab === 'dailyEvents') {
                if (dailyEvent.combo_ids && new Set(dailyEvent.combo_ids.filter(id => id)).size !== 3) {
                     alert(t('error_3_unique_cards'));
                     return;
                }
                await postApi('/admin/api/daily-events', dailyEvent);
            } else {
                 await postApi('/admin/api/config', { config: localConfig });
            }
            alert(t('save_success'));
        } catch (e) {
            alert(t('save_error'));
            console.error(e);
        } finally {
            saveMainButton.disabled = false;
            saveMainButton.innerHTML = originalText;
            applyTranslations();
        }
    }
    
    async function fetchApi(url, options = {}) {
        try {
            const response = await fetch(url, options);
            if (response.status === 401) {
                window.location.href = '/admin/login.html';
                throw new Error('Unauthorized');
            }
            if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
                return response.json();
            }
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            console.error(`Fetch API failed for ${url}:`, error);
            throw error;
        }
    }

    async function postApi(url, data) {
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    }

    // --- INITIALIZATION ---
    async function init() {
        showLoading();
        applyTranslations();
        try {
            const [config, players, stats, locations, events] = await Promise.all([
                fetchApi('/admin/api/config'),
                fetchApi('/admin/api/players'),
                fetchApi('/admin/api/dashboard-stats'),
                fetchApi('/admin/api/player-locations'),
                fetchApi('/admin/api/daily-events')
            ]);
            localConfig = config;
            allPlayers = players;
            dashboardStats = stats;
            playerLocations = locations;
            if(events) dailyEvent = { ...dailyEvent, ...events };

            const hash = window.location.hash.substring(1);
            if (hash) activeTab = hash;
            
            render();

        } catch (error) {
            console.error("Initialization failed", error);
            if (error.message !== 'Unauthorized') {
                tabContainer.innerHTML = `<div class="alert alert-danger" data-translate="error_loading_data">${t('error_loading_data')}</div>`;
            }
        }
    }

    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.substring(1);
        if (hash) {
            activeTab = hash;
            render();
        }
    });

    init();
});