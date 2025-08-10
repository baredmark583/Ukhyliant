
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
        upgrades: { title: 'upgrades', cols: ['id', 'name', 'price', 'profitPerHour', 'category', 'suspicionModifier', 'iconUrl'] },
        tasks: { title: 'tasks', cols: ['id', 'name', 'type', 'reward', 'requiredTaps', 'suspicionModifier', 'url', 'secretCode', 'imageUrl'] },
        specialTasks: { title: 'specialTasks', cols: ['id', 'name', 'description', 'type', 'reward', 'priceStars', 'suspicionModifier', 'url', 'secretCode', 'imageUrl'] },
        blackMarketCards: { title: 'blackMarketCards', cols: ['id', 'name', 'profitPerHour', 'chance', 'boxType', 'suspicionModifier', 'iconUrl'] },
        coinSkins: { title: 'coinSkins', cols: ['id', 'name', 'profitBoostPercent', 'chance', 'boxType', 'suspicionModifier', 'iconUrl'] },
        uiIcons: { title: 'uiIcons' },
        boosts: { title: 'boosts', cols: ['id', 'name', 'description', 'costCoins', 'suspicionModifier', 'iconUrl'] },
        cellSettings: { title: 'cellSettings', fields: ['cellCreationCost', 'cellMaxMembers', 'informantRecruitCost', 'lootboxCostCoins', 'lootboxCostStars', 'cellBattleTicketCost', 'informantProfitBonus', 'cellBankProfitShare'] },
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
        return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&quot;").replace(/'/g, "&#039;");
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

    // --- API & DATA HANDLING ---
    const fetchData = async (endpoint) => {
        try {
            const response = await fetch(`/admin/api/${endpoint}`, { cache: 'no-cache' }); // Use no-cache to ensure freshness
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
            localConfig = await fetchData('config');
        }
    };

    // --- RENDER LOGIC ---
    const render = () => {
        destroyCharts();
        document.querySelectorAll('.tab-button').forEach(btn => {
            const isActive = btn.dataset.tab === activeTab;
            btn.classList.toggle('active', isActive);
            // Handle dropdown active state
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
        
        const titleKey = configMeta[activeTab]?.title || activeTab;
        tabTitle.textContent = t(titleKey);
        tabTitle.dataset.translate = titleKey;

        saveMainButton.classList.toggle('d-none', ['dashboard', 'players', 'cheaters', 'cellAnalytics', 'cellConfiguration'].includes(activeTab));
        showLoading();

        switch (activeTab) {
            case 'dashboard': renderDashboard(); break;
            case 'players': renderPlayers(); break;
            case 'cheaters': renderCheaters(); break;
            case 'dailyEvents': renderDailyEvents(); break;
            case 'cellSettings': renderCellSettings(); break;
            case 'cellAnalytics': renderCellAnalytics(); break;
            case 'cellConfiguration': renderCellConfiguration(); break;
            case 'uiIcons': renderUiIcons(); break;
            default:
                if (configMeta[activeTab]) {
                    renderConfigTable(activeTab);
                } else {
                    tabContainer.innerHTML = `<p>Tab "${activeTab}" not found.</p>`;
                }
                break;
        }
    };
    
    const formatCellContent = (item, col) => {
        const data = item[col];
        if (data === null || data === undefined) return '';

        if (typeof data === 'object') {
            if ('en' in data && ('ru' in data || 'ua' in data)) {
                return escapeHtml(data[currentLang] || data['en'] || '');
            }
            if (col === 'reward' && 'type' in data && 'amount' in data) {
                const typeText = t(`reward_type_${data.type}`);
                return `${formatNumber(data.amount)} (${typeText})`;
            }
            return `<pre class="m-0">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
        }

        if (col === 'type') {
            return t(`task_type_${data}`) || escapeHtml(data);
        }
        
        if ((col === 'price' || col === 'costCoins' || col === 'priceStars' || col === 'profitPerHour' || col === 'minProfitPerHour' || col.toLowerCase().includes('reward')) && typeof data === 'number') {
            return formatNumber(data);
        }
        
        if (col === 'iconUrl' && typeof data === 'string' && data.startsWith('http')) {
            return `<img src="${escapeHtml(data)}" alt="icon" class="w-8 h-8 object-contain">`;
        }
        
        return escapeHtml(data);
    };

    const renderDashboard = async () => {
        const [stats, locations] = await Promise.all([
            fetchData('dashboard-stats'),
            fetchData('player-locations')
        ]);
        if (!stats || !locations) return showLoading();

        dashboardStats = stats;
        playerLocations = locations;
        
        const kpiCards = `
            <div class="col-sm-6 col-lg-2-4">
                <div class="card"><div class="card-body"><div class="d-flex align-items-center"><div class="subheader">${t('total_players')}</div></div><div class="h1 mb-3">${formatNumber(stats.totalPlayers)}</div></div></div>
            </div>
            <div class="col-sm-6 col-lg-2-4">
                <div class="card"><div class="card-body"><div class="d-flex align-items-center"><div class="subheader">${t('new_players_24h')}</div></div><div class="h1 mb-3 text-green">${formatNumber(stats.newPlayersToday)}</div></div></div>
            </div>
            <div class="col-sm-6 col-lg-2-4">
                <div class="card"><div class="card-body"><div class="d-flex align-items-center"><div class="subheader">${t('online_now')}</div></div><div class="h1 mb-3">${formatNumber(stats.onlineNow)}</div></div></div>
            </div>
            <div class="col-sm-6 col-lg-2-4">
                <div class="card"><div class="card-body"><div class="d-flex align-items-center"><div class="subheader">${t('total_profit_per_hour')}</div></div><div class="h1 mb-3 text-yellow">${formatNumber(stats.totalProfitPerHour)}</div></div></div>
            </div>
             <div class="col-sm-6 col-lg-2-4">
                <div class="card"><div class="card-body"><div class="d-flex align-items-center"><div class="subheader">${t('earned_stars')}</div></div><div class="h1 mb-3 text-blue">${formatNumber(stats.totalStarsEarned)}</div></div></div>
            </div>
        `;

        tabContainer.innerHTML = `
            <div class="row row-deck row-cards">${kpiCards}</div>
            <div class="row row-cards mt-4">
                <div class="col-lg-7">
                    <div class="card h-100"><div class="card-body"><h3 class="card-title">${t('new_users_last_7_days')}</h3><div class="chart-container"><canvas id="registrations-chart"></canvas></div></div></div>
                </div>
                <div class="col-lg-5">
                     <div class="card h-100"><div class="card-body"><h3 class="card-title">${t('top_5_upgrades')}</h3><div class="chart-container"><canvas id="top-upgrades-chart"></canvas></div></div></div>
                </div>
            </div>
             <div class="row row-cards mt-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-body">
                           <h3 class="card-title">${t('player_map')}</h3>
                           <div id="map-world" style="height: 400px; background: #111827;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // --- Render Charts ---
        if (stats.registrations) {
            const regCtx = document.getElementById('registrations-chart').getContext('2d');
            charts.registrations = new Chart(regCtx, {
                type: 'line',
                data: {
                    labels: stats.registrations.map(r => new Date(r.date).toLocaleDateString(currentLang, { month: 'short', day: 'numeric' })),
                    datasets: [{
                        label: t('new_users_last_7_days'),
                        data: stats.registrations.map(r => r.count),
                        borderColor: '#4ade80',
                        backgroundColor: 'rgba(74, 222, 128, 0.2)',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: { maintainAspectRatio: false }
            });
        }
        
        if (stats.popularUpgrades) {
             const upgradeCtx = document.getElementById('top-upgrades-chart').getContext('2d');
             const upgradeNames = stats.popularUpgrades.map(u => {
                 const upgradeData = localConfig.upgrades?.find(cfg => cfg.id === u.upgrade_id);
                 return upgradeData?.name?.[currentLang] || u.upgrade_id;
             });
             charts.upgrades = new Chart(upgradeCtx, {
                 type: 'bar',
                 data: {
                     labels: upgradeNames,
                     datasets: [{
                         label: t('purchases'),
                         data: stats.popularUpgrades.map(u => u.purchase_count),
                         backgroundColor: ['#4ade80', '#2563eb', '#facc15', '#a855f7', '#f472b6'],
                     }]
                 },
                 options: { indexAxis: 'y', maintainAspectRatio: false }
             });
        }
        
        // --- Render Map ---
        if(locations.length > 0) {
            const mapData = locations.reduce((acc, loc) => {
                acc[loc.country] = loc.player_count;
                return acc;
            }, {});

            charts.map = new jsVectorMap({
                selector: '#map-world',
                map: 'world',
                backgroundColor: '#111827',
                regionStyle: {
                    initial: { fill: '#374151' },
                },
                series: {
                    regions: [{
                        values: mapData,
                        scale: ['#4ade80', '#166534'],
                        normalizeFunction: 'polynomial'
                    }]
                },
                onRegionTooltipShow(event, tooltip, code) {
                    tooltip.text(
                      `${tooltip.text()} (${mapData[code] || 0} ${t('players')})`,
                      true,
                    );
                },
            });
        }
    };
    
    const renderPlayers = async () => {
        allPlayers = await fetchData('players');
        if (!allPlayers) return showLoading();
        
        const renderTable = (players) => `
            <div class="table-responsive">
                <table class="table card-table table-vcenter text-nowrap datatable">
                    <thead><tr>
                        <th>${t('id')}</th>
                        <th>${t('name')}</th>
                        <th>${t('balance')}</th>
                        <th>${t('profit_ph')}</th>
                        <th>${t('referrals')}</th>
                        <th>${t('language')}</th>
                        <th>${t('actions')}</th>
                    </tr></thead>
                    <tbody>
                    ${players.map(p => `
                        <tr>
                            <td><div class="text-secondary">${p.id}</div></td>
                            <td>${escapeHtml(p.name)}</td>
                            <td>${formatNumber(p.balance)}</td>
                            <td>${formatNumber(p.profitPerHour)}</td>
                            <td>${formatNumber(p.referrals)}</td>
                            <td>${escapeHtml(p.language)}</td>
                            <td>
                                <button class="btn btn-sm btn-secondary" data-action="view-player" data-id="${p.id}">${t('details')}</button>
                                <button class="btn btn-sm btn-secondary" data-action="reset-daily" data-id="${p.id}">${t('reset_daily')}</button>
                                <button class="btn btn-sm btn-danger" data-action="delete-player" data-id="${p.id}">${t('delete')}</button>
                            </td>
                        </tr>
                    `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        tabContainer.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div class="input-icon">
                        <span class="input-icon-addon"><svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"></path><path d="M21 21l-6 -6"></path></svg></span>
                        <input type="text" id="player-search" class="form-control" placeholder="${t('search_by_id_name')}">
                    </div>
                </div>
                <div id="players-table-container">
                    ${renderTable(allPlayers)}
                </div>
            </div>
        `;
        
        document.getElementById('player-search').addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = allPlayers.filter(p => p.id.includes(query) || p.name.toLowerCase().includes(query));
            document.getElementById('players-table-container').innerHTML = renderTable(filtered);
        });
    };

    const renderCheaters = async () => {
        showLoading('loading_cheaters');
        const cheaters = await fetchData('cheaters');
        if (!cheaters) return;

        if (cheaters.length === 0) {
            tabContainer.innerHTML = `<div class="card"><div class="card-body text-center">${t('no_cheaters_found')}</div></div>`;
            return;
        }

        tabContainer.innerHTML = `
            <div class="card">
                <div class="card-header"><h3 class="card-title">${t('cheater_list')}</h3></div>
                <div class="card-body">
                    <p class="text-secondary mb-4">${t('cheater_list_desc')}</p>
                    <div class="table-responsive">
                        <table class="table card-table table-vcenter">
                            <thead><tr><th>${t('id')}</th><th>${t('name')}</th><th>${t('cheat_log')}</th><th>${t('actions')}</th></tr></thead>
                            <tbody>
                                ${cheaters.map(c => `
                                    <tr>
                                        <td><div class="text-secondary">${c.id}</div></td>
                                        <td>${escapeHtml(c.name)}</td>
                                        <td><pre class="m-0">${escapeHtml(JSON.stringify(c.cheat_log, null, 2))}</pre></td>
                                        <td><button class="btn btn-warning" data-action="reset-progress" data-id="${c.id}">${t('reset_progress')}</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
    };

    const renderConfigTable = (key) => {
        const meta = configMeta[key];
        const data = localConfig[key] || [];
        
        tabContainer.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">${t(meta.title)}</h3>
                    <div class="ms-auto">
                        <button class="btn btn-success" data-action="add-item" data-key="${key}">${t('add_new')}</button>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table card-table table-vcenter text-nowrap">
                        <thead><tr>
                            ${meta.cols.map(col => `<th>${t(col)}</th>`).join('')}
                            <th>${t('actions')}</th>
                        </tr></thead>
                        <tbody>
                        ${data.map((item, index) => `
                            <tr>
                                ${meta.cols.map(col => `<td>${formatCellContent(item, col)}</td>`).join('')}
                                <td>
                                    <button class="btn btn-sm btn-secondary" data-action="edit-item" data-key="${key}" data-index="${index}">${t('edit')}</button>
                                    <button class="btn btn-sm btn-danger" data-action="delete-item" data-key="${key}" data-index="${index}">${t('delete')}</button>
                                </td>
                            </tr>
                        `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    };
    
    const renderDailyEvents = async () => {
        const eventData = await fetchData('daily-events');
        if(eventData) {
            dailyEvent = { ...dailyEvent, ...eventData };
        }
        
        const upgradeOptions = (localConfig.upgrades || []).map(u => `<option value="${u.id}" ${dailyEvent.combo_ids.includes(u.id) ? 'selected' : ''}>${escapeHtml(u.name[currentLang] || u.name['en'])}</option>`).join('');

        tabContainer.innerHTML = `
            <div class="card">
                <div class="card-header"><h3 class="card-title">${t('daily_events_setup')}</h3></div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <h4 class="mb-3">${t('daily_combo')}</h4>
                             <p class="text-secondary mb-2">${t('select_3_cards_for_combo')}</p>
                             ${[0, 1, 2].map(i => `
                                <div class="mb-3">
                                    <label class="form-label">${t('select_card')} #${i + 1}</label>
                                    <select class="form-select combo-card-select" data-index="${i}">
                                        <option value="">-- ${t('select_card')} --</option>
                                        ${upgradeOptions}
                                    </select>
                                </div>
                            `).join('')}
                             <div class="mb-3">
                                <label class="form-label">${t('combo_reward')}</label>
                                <input type="number" class="form-control" id="combo-reward-input" value="${dailyEvent.combo_reward}">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <h4 class="mb-3">${t('daily_cipher')}</h4>
                            <p class="text-secondary mb-2">${t('enter_cipher_word')}</p>
                            <div class="mb-3">
                                <label class="form-label">${t('cipher_word')}</label>
                                <input type="text" class="form-control" id="cipher-word-input" placeholder="${t('example_btc')}" value="${escapeHtml(dailyEvent.cipher_word)}">
                            </div>
                             <div class="mb-3">
                                <label class="form-label">${t('cipher_reward')}</label>
                                <input type="number" class="form-control" id="cipher-reward-input" value="${dailyEvent.cipher_reward}">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    const renderCellSettings = () => {
        const fields = configMeta.cellSettings.fields;
        
        tabContainer.innerHTML = `
            <div class="card">
                <div class="card-header"><h3 class="card-title">${t('cellSettings')}</h3></div>
                <div class="card-body">
                    <div class="row">
                    ${fields.map(field => `
                        <div class="col-md-6 mb-3">
                             <label class="form-label">${t(field)}</label>
                             <input type="number" class="form-control" data-config-key="${field}" value="${localConfig[field] || 0}">
                             <small class="form-hint">${t(`${field}_desc`)}</small>
                        </div>
                    `).join('')}
                    </div>
                </div>
            </div>`;
    };

    const renderUiIcons = () => {
        const { nav, ...otherIcons } = localConfig.uiIcons || { nav: {}, otherIcons: {} };
        const renderGroup = (titleKey, iconsObject) => `
            <div class="mb-4">
                <h4 class="mb-3">${t(titleKey)}</h4>
                <div class="row">
                    ${Object.entries(iconsObject).map(([key, value]) => `
                        <div class="col-md-6 mb-3">
                            <label class="form-label">${t(`icon_${key.replace('.', '_')}`)}</label>
                            <input type="text" class="form-control" data-config-key="uiIcons.${titleKey === 'icon_group_nav' ? 'nav.' : ''}${key}" value="${escapeHtml(value)}">
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        tabContainer.innerHTML = `
            <div class="card">
                <div class="card-header"><h3 class="card-title">${t('uiIcons')}</h3></div>
                <div class="card-body">
                    ${renderGroup('icon_group_nav', nav)}
                    <hr class="my-4">
                    ${renderGroup('icon_group_gameplay', { energy: otherIcons.energy, coin: otherIcons.coin, star: otherIcons.star, suspicion: otherIcons.suspicion })}
                    <hr class="my-4">
                    ${renderGroup('icon_group_market', { marketCoinBox: otherIcons.marketCoinBox, marketStarBox: otherIcons.marketStarBox })}
                </div>
            </div>
        `;
    };

    const renderCellAnalytics = async () => {
        showLoading();
        const data = await fetchData('cell-analytics');
        if (!data) return;

        const kpiCards = `
            <div class="col-sm-6 col-lg-3"><div class="card card-sm"><div class="card-body"><div class="row align-items-center"><div class="col-auto"><span class="bg-primary text-white avatar"><svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-users-group" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 13a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M8 21v-1a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v1" /><path d="M15 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 10h2a2 2 0 0 1 2 2v1" /><path d="M5 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M3 13v-1a2 2 0 0 1 2 -2h2" /></svg></span></div><div class="col"><div class="font-weight-medium">${formatNumber(data.kpi.totalCells)}</div><div class="text-secondary">${t('kpi_total_cells')}</div></div></div></div></div></div>
            <div class="col-sm-6 col-lg-3"><div class="card card-sm"><div class="card-body"><div class="row align-items-center"><div class="col-auto"><span class="bg-green text-white avatar"><svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-sword" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M21 3v5l-11 9l-4 4l-3 -3l4 -4l9 -11z" /><path d="M5 14l-1 1" /><path d="M14 5l1 -1" /><path d="M18 9l2 2" /></svg></span></div><div class="col"><div class="font-weight-medium">${formatNumber(data.kpi.battleParticipants)}</div><div class="text-secondary">${t('kpi_battle_participants')}</div></div></div></div></div></div>
            <div class="col-sm-6 col-lg-3"><div class="card card-sm"><div class="card-body"><div class="row align-items-center"><div class="col-auto"><span class="bg-yellow text-white avatar"><svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-coin" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M14.8 9a2 2 0 0 0 -1.8 -1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1 -1.8 -1" /><path d="M12 6v2m0 8v2" /></svg></span></div><div class="col"><div class="font-weight-medium">${formatNumber(data.kpi.totalBank)}</div><div class="text-secondary">${t('kpi_total_bank')}</div></div></div></div></div></div>
        `;

        const leaderboardHtml = `
            <div class="card"><div class="card-header"><h3 class="card-title">${t('cell_leaderboard')}</h3></div>
            <div class="table-responsive"><table class="table card-table table-vcenter">
                <thead><tr><th>#</th><th>${t('cell_name')}</th><th>${t('members')}</th><th>${t('total_profit')}</th><th>${t('cell_bank')}</th></tr></thead>
                <tbody>${data.leaderboard.map((cell, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${escapeHtml(cell.name)}</td>
                        <td>${formatNumber(cell.members)}</td>
                        <td>${formatNumber(cell.total_profit)}</td>
                        <td>${formatNumber(cell.balance)}</td>
                    </tr>
                `).join('')}</tbody>
            </table></div></div>
        `;

        const historyHtml = `
            <div class="card"><div class="card-header"><h3 class="card-title">${t('battle_history')}</h3></div>
            <div class="table-responsive"><table class="table card-table table-vcenter">
                <thead><tr><th>${t('battle_date')}</th><th>${t('winner')}</th><th>${t('score')}</th><th>${t('prize_pool')}</th></tr></thead>
                <tbody>${data.battleHistory.map(battle => {
                    const winner = battle.winner_details?.firstPlace;
                    return `
                        <tr>
                            <td>${new Date(battle.end_time).toLocaleString()}</td>
                            <td>${winner ? `Cell ID: ${winner.cell_id}` : 'N/A'}</td>
                            <td>${winner ? formatNumber(winner.score) : 'N/A'}</td>
                            <td>-</td>
                        </tr>
                    `;
                }).join('')}</tbody>
            </table></div></div>
        `;
        
        tabContainer.innerHTML = `
            <div class="row row-deck row-cards">${kpiCards}</div>
            <div class="row row-cards mt-4">
                <div class="col-lg-6">${leaderboardHtml}</div>
                <div class="col-lg-6">${historyHtml}</div>
            </div>`;
    };

    const renderCellConfiguration = async () => {
        // Fetch fresh battle status
        const battleStatus = await fetchData('battle/status?userId=admin'); // Use a dummy ID
        const isActive = battleStatus?.status?.isActive || false;

        const schedule = localConfig.battleSchedule || {};
        const rewards = localConfig.battleRewards || {};

        const dayOptions = [0,1,2,3,4,5,6].map(d => `<option value="${d}" ${schedule.dayOfWeek == d ? 'selected' : ''}>${t(`day_${['sun','mon','tue','wed','thu','fri','sat'][d]}`)}</option>`).join('');
        const freqOptions = ['weekly','biweekly','monthly'].map(f => `<option value="${f}" ${schedule.frequency == f ? 'selected' : ''}>${t(`freq_${f}`)}</option>`).join('');
        
        tabContainer.innerHTML = `
            <div class="row row-cards">
                <div class="col-lg-8">
                    <form id="cell-config-form" class="card">
                        <div class="card-header"><h3 class="card-title">${t('cell_config')}</h3></div>
                        <div class="card-body">
                            <fieldset class="form-fieldset">
                                <legend>${t('cell_economy')}</legend>
                                <div class="row">
                                    <div class="col-md-6 mb-3"><label class="form-label">${t('informant_bonus_percent')}</label><input type="number" step="0.1" class="form-control" name="informantProfitBonus" value="${(localConfig.informantProfitBonus || 0) * 100}"></div>
                                    <div class="col-md-6 mb-3"><label class="form-label">${t('bank_tax_percent')}</label><input type="number" step="0.1" class="form-control" name="cellBankProfitShare" value="${(localConfig.cellBankProfitShare || 0) * 100}"></div>
                                </div>
                            </fieldset>
                            <fieldset class="form-fieldset">
                                <legend>${t('battle_rewards')}</legend>
                                <div class="row">
                                    <div class="col-md-6 mb-3"><label class="form-label">${t('first_place_reward')}</label><input type="number" class="form-control" name="battleRewards.firstPlace" value="${rewards.firstPlace || 0}"></div>
                                    <div class="col-md-6 mb-3"><label class="form-label">${t('second_place_reward')}</label><input type="number" class="form-control" name="battleRewards.secondPlace" value="${rewards.secondPlace || 0}"></div>
                                    <div class="col-md-6 mb-3"><label class="form-label">${t('third_place_reward')}</label><input type="number" class="form-control" name="battleRewards.thirdPlace" value="${rewards.thirdPlace || 0}"></div>
                                    <div class="col-md-6 mb-3"><label class="form-label">${t('participant_reward')}</label><input type="number" class="form-control" name="battleRewards.participant" value="${rewards.participant || 0}"></div>
                                </div>
                            </fieldset>
                            <fieldset class="form-fieldset">
                                <legend>${t('battle_schedule')}</legend>
                                <div class="row">
                                    <div class="col-md-6 mb-3"><label class="form-label">${t('schedule_frequency')}</label><select class="form-select" name="battleSchedule.frequency">${freqOptions}</select></div>
                                    <div class="col-md-6 mb-3"><label class="form-label">${t('schedule_day')}</label><select class="form-select" name="battleSchedule.dayOfWeek">${dayOptions}</select></div>
                                    <div class="col-md-6 mb-3"><label class="form-label">${t('schedule_time_utc')}</label><input type="number" class="form-control" name="battleSchedule.startHourUTC" value="${schedule.startHourUTC || 12}" min="0" max="23"></div>
                                    <div class="col-md-6 mb-3"><label class="form-label">${t('schedule_duration_hours')}</label><input type="number" class="form-control" name="battleSchedule.durationHours" value="${schedule.durationHours || 24}" min="1"></div>
                                </div>
                            </fieldset>
                        </div>
                    </form>
                </div>
                <div class="col-lg-4">
                    <div class="card">
                        <div class="card-header"><h3 class="card-title">${t('battle_management')}</h3></div>
                        <div class="card-body text-center">
                            <p>${t('battle_status')}: <span class="badge ${isActive ? 'bg-success' : 'bg-secondary'}">${isActive ? t('battle_status_active') : t('battle_status_inactive')}</span></p>
                            <div class="d-grid gap-2">
                                <button id="force-start-btn" class="btn btn-success" ${isActive ? 'disabled' : ''}>${t('force_start_battle')}</button>
                                <button id="force-end-btn" class="btn btn-danger" ${!isActive ? 'disabled' : ''}>${t('force_end_battle')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    };


    // --- MODAL RENDERING ---
    const renderEditModal = (key, index = -1) => {
        const isNew = index === -1;
        const meta = configMeta[key];
        const item = isNew ? {} : localConfig[key][index];
        const title = isNew ? t('config_add_item') : t('config_edit_item');

        const formFields = meta.cols.map(col => {
            let inputHtml = '';
            const value = item[col] ?? '';
            const label = t(col);
            
            if (col === 'type') {
                 const options = ['taps', 'telegram_join', 'video_watch', 'video_code'].map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${t(`task_type_${opt}`)}</option>`).join('');
                 inputHtml = `<select class="form-select" name="${col}">${options}</select>`;
            } else if (col === 'category') {
                const options = ['Documents', 'Legal', 'Lifestyle', 'Special'].map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`).join('');
                inputHtml = `<select class="form-select" name="${col}">${options}</select>`;
            } else if (col === 'boxType') {
                const options = ['coin', 'star'].map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`).join('');
                inputHtml = `<select class="form-select" name="${col}">${options}</select>`;
            } else if (typeof value === 'object' && value !== null) {
                // Nested object, e.g., reward, name, description
                const subFields = Object.keys(value).map(subKey => `
                    <label class="form-label mt-2">${t(subKey)}</label>
                    <input type="text" class="form-control" name="${col}.${subKey}" value="${escapeHtml(value[subKey])}">
                `).join('');
                inputHtml = `<div class="p-2 border rounded">${subFields}</div>`;
            } else if (typeof value === 'number') {
                inputHtml = `<input type="number" class="form-control" name="${col}" value="${value}">`;
            } else {
                inputHtml = `<input type="text" class="form-control" name="${col}" value="${escapeHtml(value)}">`;
            }

            return `<div class="mb-3"><label class="form-label">${label}</label>${inputHtml}</div>`;
        }).join('');

        modalsContainer.innerHTML = `
            <div class="modal modal-blur fade show" id="edit-item-modal" tabindex="-1" style="display: block;">
                <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="btn-close" data-action="close-modal"></button>
                        </div>
                        <div class="modal-body">
                           <form id="edit-item-form">${formFields}</form>
                        </div>
                        <div class="modal-footer">
                           <button type="button" class="btn me-auto" data-action="close-modal">${t('cancel')}</button>
                           <button type="button" class="btn btn-primary" data-action="save-item" data-key="${key}" data-index="${index}">${t('save')}</button>
                        </div>
                    </div>
                </div>
            </div>`;
    };
    
    const renderPlayerDetailsModal = async (playerId) => {
        modalsContainer.innerHTML = `
         <div class="modal modal-blur fade show" id="player-details-modal" style="display: block;"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-body text-center py-4"><div class="spinner-border"></div></div></div></div></div>`;
        const player = await fetchData(`player/${playerId}/details`);
        if (!player) return;

        modalsContainer.innerHTML = `
             <div class="modal modal-blur fade show" id="player-details-modal" tabindex="-1" style="display: block;">
                <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${t('player_details')}: ${escapeHtml(player.name)} (${player.id})</h5>
                            <button type="button" class="btn-close" data-action="close-modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">${t('current_balance')}</label>
                                        <input type="text" class="form-control" value="${formatNumber(player.balance)}" readonly>
                                    </div>
                                    <form id="add-bonus-form">
                                        <div class="mb-3">
                                            <label class="form-label">${t('bonus_amount')}</label>
                                            <input type="number" name="bonusAmount" class="form-control" placeholder="1000" required>
                                        </div>
                                        <button type="submit" class="btn btn-success w-100">${t('add_bonus')}</button>
                                    </form>
                                </div>
                                <div class="col-md-6">
                                     <div class="mb-3">
                                        <label class="form-label">${t('suspicion')}</label>
                                        <input type="text" class="form-control" value="${player.suspicion || 0} / 100" readonly>
                                    </div>
                                    <label class="form-label">${t('player_upgrades')}</label>
                                    <div class="table-responsive" style="max-height: 150px;">
                                        <table class="table table-sm">
                                            <tbody>
                                            ${Object.entries(player.upgrades || {}).map(([id, level]) => `
                                                <tr><td>${id}</td><td>${t('level')} ${level}</td></tr>`).join('') || `<tr><td>${t('no_data')}</td></tr>`}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('add-bonus-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = e.target.elements.bonusAmount.value;
            if (!amount) return;
            const res = await postData(`player/${playerId}/update-balance`, { amount });
            if (res) {
                alert(t('balance_updated'));
                renderPlayerDetailsModal(playerId); // Re-render modal to show new balance
                renderPlayers(); // Re-render player list
            } else {
                alert(t('error_updating_balance'));
            }
        });
    };


    // --- EVENT HANDLING ---
    const handleAction = async (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        const { action, key, index, id, lang } = target.dataset;

        switch(action) {
            case 'close-modal':
                modalsContainer.innerHTML = '';
                break;
            case 'edit-item':
                renderEditModal(key, index);
                break;
            case 'add-item':
                renderEditModal(key, -1);
                break;
            case 'delete-item':
                if (confirm(t('confirm_delete'))) {
                    localConfig[key].splice(index, 1);
                    renderConfigTable(key);
                }
                break;
            case 'save-item': {
                const form = document.getElementById('edit-item-form');
                const formData = new FormData(form);
                const newItem = {};
                formData.forEach((value, name) => {
                    if (name.includes('.')) {
                        const [parentKey, subKey] = name.split('.');
                        if (!newItem[parentKey]) newItem[parentKey] = {};
                        newItem[parentKey][subKey] = value;
                    } else {
                        newItem[name] = isNaN(Number(value)) ? value : Number(value);
                    }
                });

                if (index == -1) { // New item
                    if (!localConfig[key]) localConfig[key] = [];
                    localConfig[key].push(newItem);
                } else { // Existing item
                    localConfig[key][index] = newItem;
                }
                modalsContainer.innerHTML = '';
                renderConfigTable(key);
                break;
            }
            case 'view-player':
                renderPlayerDetailsModal(id);
                break;
            case 'reset-daily':
                if (confirm(t('confirm_reset_daily'))) {
                    const res = await postData(`player/${id}/reset-daily`);
                    if(res) alert(t('daily_progress_reset_success')); else alert(t('daily_progress_reset_error'));
                }
                break;
            case 'delete-player':
                 if (confirm(t('confirm_delete_player'))) {
                    await deleteData(`player/${id}`);
                    renderPlayers();
                 }
                break;
            case 'reset-progress':
                if (confirm(t('confirm_reset_progress'))) {
                    const res = await postData(`player/${id}/reset-progress`);
                    if(res) { alert(t('progress_reset_success')); renderCheaters(); } else { alert(t('error_resetting_progress')); }
                }
                break;
            case 'force-start':
                target.disabled = true;
                await postData('battle/force-start');
                renderCellConfiguration();
                break;
            case 'force-end':
                target.disabled = true;
                await postData('battle/force-end');
                renderCellConfiguration();
                break;
        }
    };
    
    const handleInput = (e) => {
        const { configKey } = e.target.dataset;
        if (!configKey) return;
        
        let value = e.target.value;
        if (e.target.type === 'number' || !isNaN(Number(value))) {
            value = Number(value);
        }

        // Handle nested keys like "uiIcons.nav.exchange"
        const keys = configKey.split('.');
        let current = localConfig;
        keys.forEach((k, i) => {
            if (i === keys.length - 1) {
                current[k] = value;
            } else {
                if (!current[k]) current[k] = {};
                current = current[k];
            }
        });
    };
    
    const handleFormSubmit = (e) => {
        if (e.target.id === 'cell-config-form') {
            e.preventDefault();
            const formData = new FormData(e.target);
            formData.forEach((value, name) => {
                const keys = name.split('.');
                let current = localConfig;
                keys.forEach((k, i) => {
                    let parsedValue = value;
                    if (name === 'informantProfitBonus' || name === 'cellBankProfitShare') {
                        parsedValue = parseFloat(value) / 100;
                    } else if (!isNaN(Number(value))) {
                        parsedValue = Number(value);
                    }

                    if (i === keys.length - 1) {
                        current[k] = parsedValue;
                    } else {
                        if (!current[k]) current[k] = {};
                        current = current[k];
                    }
                });
            });
            saveAllChanges();
        }
    };

    const handleDailyEventInput = (e) => {
        if (e.target.matches('.combo-card-select')) {
            const index = parseInt(e.target.dataset.index, 10);
            dailyEvent.combo_ids[index] = e.target.value;
        } else if (e.target.id === 'cipher-word-input') {
            dailyEvent.cipher_word = e.target.value.toUpperCase();
        } else if (e.target.id === 'combo-reward-input') {
            dailyEvent.combo_reward = parseInt(e.target.value, 10);
        } else if (e.target.id === 'cipher-reward-input') {
            dailyEvent.cipher_reward = parseInt(e.target.value, 10);
        }
    };

    const init = async () => {
        // --- Setup Event Listeners ---
        document.body.addEventListener('click', handleAction);
        document.body.addEventListener('change', handleDailyEventInput);
        document.body.addEventListener('input', handleInput);
        document.body.addEventListener('submit', handleFormSubmit);

        document.querySelectorAll('.tab-button').forEach(btn => btn.addEventListener('click', (e) => {
            e.preventDefault();
            activeTab = e.currentTarget.dataset.tab;
            window.location.hash = activeTab;
            render();
        }));
        
        saveMainButton.addEventListener('click', saveAllChanges);
        
        document.querySelectorAll('.lang-select-btn').forEach(btn => btn.addEventListener('click', (e) => {
            e.preventDefault();
            currentLang = e.currentTarget.dataset.lang;
            localStorage.setItem('adminLang', currentLang);
            applyTranslations();
            render(); // Re-render to apply new language to dynamic content
        }));

        // --- Initial Load ---
        localConfig = await fetchData('config');
        if (!localConfig) {
            tabContainer.innerHTML = '<h2>Failed to load game configuration.</h2>';
            return;
        }
        
        const hash = window.location.hash.substring(1);
        if (hash) activeTab = hash;
        
        applyTranslations();
        render();
    };

    init();
});