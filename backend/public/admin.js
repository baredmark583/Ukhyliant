
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
        blackMarketCards: { titleKey: 'nav_market_cards', cols: ['id', 'name', 'profitPerHour', 'chance', 'boxType', 'suspicionModifier', 'iconUrl'] },
        coinSkins: { titleKey: 'nav_coin_skins', cols: ['id', 'name', 'profitBoostPercent', 'chance', 'boxType', 'suspicionModifier', 'iconUrl'] },
        uiIcons: { titleKey: 'nav_ui_icons' },
        boosts: { titleKey: 'nav_boosts', cols: ['id', 'name', 'description', 'costCoins', 'suspicionModifier', 'iconUrl'] },
        cellSettings: { titleKey: 'nav_cell_settings', fields: ['cellCreationCost', 'cellMaxMembers', 'informantRecruitCost', 'lootboxCostCoins', 'lootboxCostStars', 'cellBattleTicketCost'] },
    };
    
    // --- DOM ELEMENTS ---
    const tabContainer = document.getElementById('tab-content-container');
    const tabTitle = document.getElementById('tab-title');
    const saveMainButton = document.getElementById('save-main-button');
    const modalsContainer = document.getElementById('modals-container');
    
    // --- TRANSLATION FUNCTION ---
    const t = (key) => window.LOCALES[currentLang]?.[key] || window.LOCALES['en']?.[key] || `[${key}]`;

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
            localConfig = await fetchData('config');
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
        
        const activeButton = document.querySelector(`.tab-button[data-tab="${activeTab}"]`);
        if (activeButton && activeButton.dataset.titleKey) {
            tabTitle.textContent = t(activeButton.dataset.titleKey);
        }

        saveMainButton.classList.toggle('d-none', !configMeta[activeTab] && activeTab !== 'dailyEvents' && activeTab !== 'cellSettings');
        
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
        applyTranslations();
    };

    const renderDashboard = async () => {
        showLoading();
        dashboardStats = await fetchData('dashboard-stats') || {};
        playerLocations = await fetchData('player-locations') || [];
        const socialStats = await fetchData('social-stats') || {};

        const kpis = [
            { key: 'total_players', value: formatNumber(dashboardStats.totalPlayers), icon: 'users', color: 'blue' },
            { key: 'new_players_24h', value: formatNumber(dashboardStats.newPlayersToday), icon: 'user-plus', color: 'green' },
            { key: 'online_now', value: formatNumber(dashboardStats.onlineNow), icon: 'wifi', color: 'azure' },
            { key: 'total_profit_per_hour', value: formatNumber(dashboardStats.totalProfitPerHour), icon: 'trending-up', color: 'yellow' },
            { key: 'earned_stars', value: formatNumber(dashboardStats.totalStarsEarned), icon: 'star', color: 'purple' }
        ];

        const kpiHtml = kpis.map(kpi => `
            <div class="col-lg-2-4 col-md-4 col-6">
                <div class="card card-sm">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-auto">
                                <span class="bg-${kpi.color}-lt text-${kpi.color} avatar">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-${kpi.icon}" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path>${window.tablerIcons[kpi.icon]}</svg>
                                </span>
                            </div>
                            <div class="col">
                                <div class="font-weight-medium">${formatNumber(kpi.value)}</div>
                                <div class="text-secondary">${t(kpi.key)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        const topUpgradesHtml = (dashboardStats.popularUpgrades || []).map(u => `<li>${u.upgrade_id}: ${formatNumber(u.purchase_count)} ${t('purchases')}</li>`).join('');
        const socialStatsHtml = `
            <div class="col-md-6 col-lg-3">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">${t('youtube_stats')}</h3>
                        <div class="card-actions"><button class="btn btn-sm" data-action="edit-socials" data-social="youtube">${t('edit')}</button></div>
                    </div>
                    <div class="card-body">
                        <dl class="row">
                            <dt class="col-8">${t('social_youtube_subs')}:</dt><dd class="col-4 text-end">${formatNumber(socialStats.youtubeSubscribers)}</dd>
                            <dt class="col-8">${t('views')}:</dt><dd class="col-4 text-end">${formatNumber(socialStats.youtubeViews)}</dd>
                        </dl>
                    </div>
                </div>
            </div>
            <div class="col-md-6 col-lg-3">
                 <div class="card">
                    <div class="card-header">
                         <h3 class="card-title">${t('telegram_stats')}</h3>
                         <div class="card-actions"><button class="btn btn-sm" data-action="edit-socials" data-social="telegram">${t('edit')}</button></div>
                    </div>
                    <div class="card-body">
                        <dl class="row">
                            <dt class="col-8">${t('social_telegram_subs')}:</dt><dd class="col-4 text-end">${formatNumber(socialStats.telegramSubscribers)}</dd>
                        </dl>
                    </div>
                </div>
            </div>`;

        tabContainer.innerHTML = `
            <div class="row row-deck row-cards">${kpiHtml}</div>
            <div class="row row-cards mt-4">
                <div class="col-lg-8">
                    <div class="card">
                        <div class="card-body">
                            <h3 class="card-title">${t('new_users_last_7_days')}</h3>
                            <div class="chart-container" style="height: 300px;"><canvas id="chart-registrations"></canvas></div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-4">
                    <div class="card">
                        <div class="card-body">
                            <h3 class="card-title">${t('top_5_upgrades')}</h3>
                            <ul class="list-unstyled space-y-2">${topUpgradesHtml || `<li class="text-secondary">${t('no_data')}</li>`}</ul>
                        </div>
                    </div>
                </div>
                 ${socialStatsHtml}
                 <div class="col-md-6 col-lg-6">
                    <div class="card">
                        <div class="card-header"><h3 class="card-title">${t('loading_screen_image_url')}</h3></div>
                        <div class="card-body">
                            <input type="text" class="form-control" id="loadingScreenUrl" value="${escapeHtml(localConfig.loadingScreenImageUrl || '')}">
                        </div>
                    </div>
                </div>
            </div>
             <div class="row row-cards mt-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-body">
                            <h3 class="card-title">${t('player_map')}</h3>
                            <div id="map-world" style="height: 400px;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Render charts
        if (dashboardStats.registrations) {
            const ctx = document.getElementById('chart-registrations').getContext('2d');
            charts.registrations = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: dashboardStats.registrations.map(r => new Date(r.date).toLocaleDateString(currentLang)),
                    datasets: [{
                        label: t('new_users_last_7_days'),
                        data: dashboardStats.registrations.map(r => r.count),
                        backgroundColor: 'rgba(74, 222, 128, 0.6)',
                        borderColor: 'rgba(74, 222, 128, 1)',
                        borderWidth: 1
                    }]
                },
                options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
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
                        scale: ['#6366f1', '#3b82f6'], // Indigo to Blue
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
        const cardOptions = allCards.map(c => `<option value="${c.id}">${c.name[currentLang] || c.name['en']}</option>`).join('');

        const comboSelectors = [0, 1, 2].map(i => `
            <select class="form-select combo-card-select">
                <option value="">${t('select_card')}</option>
                ${cardOptions}
            </select>
        `).join('');

        tabContainer.innerHTML = `
            <div class="card">
                <div class="card-header"><h3 class="card-title">${t('daily_events_setup')}</h3></div>
                <div class="card-body">
                    <fieldset class="form-fieldset">
                        <legend>${t('daily_combo')}</legend>
                        <p class="text-secondary">${t('select_3_cards_for_combo')}</p>
                        <div class="row">
                            <div class="col-md-4 mb-3">${comboSelectors.split('</select>')[0]}</select></div>
                            <div class="col-md-4 mb-3">${comboSelectors.split('</select>')[1]}</select></div>
                            <div class="col-md-4 mb-3">${comboSelectors.split('</select>')[2]}</select></div>
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
            const cells = cols.map(col => `<td>${renderTableCell(item[col])}</td>`).join('');
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
        if (typeof data === 'object' && data !== null) return `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
        if (typeof data === 'string' && (data.startsWith('http') || data.startsWith('/assets'))) {
            return `<img src="${escapeHtml(data)}" alt="icon" style="width: 32px; height: 32px; object-fit: contain; background: #fff; padding: 2px;">`;
        }
        return escapeHtml(data);
    };
    
    const renderUiIconsConfig = () => {
        const iconGroups = {
            nav: { titleKey: 'icon_group_nav', keys: ['exchange', 'mine', 'missions', 'airdrop', 'profile'] },
            gameplay: { titleKey: 'icon_group_gameplay', keys: ['energy', 'coin', 'star', 'suspicion'] },
            market: { titleKey: 'icon_group_market', keys: ['marketCoinBox', 'marketStarBox'] }
        };
        const iconsData = localConfig.uiIcons || {};
        
        const formHtml = Object.entries(iconGroups).map(([groupKey, group]) => `
            <fieldset class="form-fieldset">
                <legend>${t(group.titleKey)}</legend>
                ${Object.entries(iconsData[groupKey] || {}).map(([key, value]) => `
                     <div class="mb-3">
                         <label class="form-label">${t(`icon_${groupKey}_${key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`)}</label>
                         <div class="input-group">
                            <input type="text" class="form-control" data-group="${groupKey}" data-key="${key}" value="${escapeHtml(value)}">
                            <span class="input-group-text"><img src="${escapeHtml(value)}" alt="" style="width: 24px; height: 24px; background: #fff;"></span>
                         </div>
                     </div>
                `).join('')}
            </fieldset>
        `).join('');
        
        tabContainer.innerHTML = `
            <div class="card"><div class="card-body">${formHtml}</div></div>
        `;
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
        const economyFields = ['informantProfitBonus', 'cellBankProfitShare'].map(field => `
            <div class="mb-3">
                <label class="form-label">${t(field.replace('informantProfitBonus', 'informant_bonus_percent').replace('cellBankProfitShare', 'bank_tax_percent'))}</label>
                <input type="number" step="0.01" class="form-control" data-config-key="${field}" value="${escapeHtml(settingsData[field] || 0)}">
            </div>
        `).join('');

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

        const historyRows = data.battleHistory.map(b => `
             <tr>
                <td>${new Date(b.end_time).toLocaleString()}</td>
                <td>${b.winner_details?.firstPlace?.cell_id || 'N/A'}</td>
                <td>${formatNumber(b.winner_details?.firstPlace?.score || 0)}</td>
                <td>${formatNumber(Object.values(localConfig.battleRewards).reduce((s, r) => s + r, 0) * 1)}</td>
            </tr>
        `).join('');


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
                            <tbody>${historyRows}</tbody>
                        </table></div>
                    </div>
                </div>
            </div>
        `;
    };
    
    // --- EVENT LISTENERS & HANDLERS ---
    const handleTabClick = async (e) => {
        const button = e.target.closest('.tab-button');
        if (button && button.dataset.tab !== activeTab) {
            activeTab = button.dataset.tab;
            render();
        }
    };
    
    const init = async () => {
        showLoading();
        localConfig = await fetchData('config');
        if (localConfig) {
            document.querySelectorAll('.navbar').forEach(el => el.style.visibility = 'visible');
            document.querySelector('.page-wrapper').style.visibility = 'visible';
            render();
        } else {
             tabContainer.innerHTML = `<div class="alert alert-danger">${t('save_error')}</div>`;
        }
        applyTranslations();
    };

    // --- MAIN EXECUTION ---
    init();

    // Event Delegation
    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        const action = target.closest('[data-action]')?.dataset.action;
        if (!action) return;
        
        const button = target.closest('[data-action]');
        
        switch (action) {
            case 'player-details':
                renderPlayerDetailsModal(button.dataset.id);
                break;
            case 'delete-player':
                 if (confirm(t('confirm_delete_player'))) {
                    await deleteData(`player/${button.dataset.id}`);
                    renderPlayers();
                }
                break;
            case 'edit-config':
            case 'add-config':
                 const key = button.dataset.key;
                 const index = button.dataset.index;
                 renderConfigForm(key, index);
                 break;
            case 'delete-config':
                 if (confirm(t('confirm_delete'))) {
                     localConfig[button.dataset.key].splice(button.dataset.index, 1);
                     render();
                 }
                 break;
            case 'reset-progress':
                 if (confirm(t('confirm_reset_progress'))) {
                    const res = await postData(`player/${button.dataset.id}/reset-progress`);
                    alert(res ? t('progress_reset_success') : t('error_resetting_progress'));
                    renderCheaters();
                }
                break;
            case 'view-cheat-log':
                const cheater = (await fetchData('cheaters')).find(c => c.id === button.dataset.id);
                renderCheatLogModal(cheater);
                break;
            case 'edit-socials':
                renderSocialsModal(button.dataset.social);
                break;
             case 'force-start-battle':
                const startRes = await postData('battle/force-start');
                if (startRes?.ok) {
                    alert('Battle started!');
                    renderBattleStatus();
                }
                break;
            case 'force-end-battle':
                const endRes = await postData('battle/force-end');
                 if (endRes?.ok) {
                    alert('Battle ended!');
                    renderBattleStatus();
                }
                break;
        }
    });

    document.body.addEventListener('change', (e) => {
        const target = e.target;
        
        // Config change in cell config page
        const configKey = target.dataset.configKey;
        if (configKey) {
            const subKey = target.dataset.subKey;
            const value = target.type === 'number' ? parseFloat(target.value) : target.value;
            if (subKey) {
                if (!localConfig[configKey]) localConfig[configKey] = {};
                localConfig[configKey][subKey] = value;
            } else {
                localConfig[configKey] = value;
            }
             saveMainButton.classList.remove('d-none');
            return;
        }

        // Daily events
        if (target.id === 'cipher-word-input') dailyEvent.cipher_word = target.value;
        if (target.id === 'combo-reward-input') dailyEvent.combo_reward = parseInt(target.value);
        if (target.id === 'cipher-reward-input') dailyEvent.cipher_reward = parseInt(target.value);
        if (target.classList.contains('combo-card-select')) {
            const selects = Array.from(document.querySelectorAll('.combo-card-select'));
            dailyEvent.combo_ids = selects.map(s => s.value).filter(v => v);
        }

        // Loading screen URL
        if (target.id === 'loadingScreenUrl') {
            localConfig.loadingScreenImageUrl = target.value;
        }
        
        // UI Icons
        const iconGroup = target.dataset.group;
        const iconKey = target.dataset.key;
        if (iconGroup && iconKey) {
            localConfig.uiIcons[iconGroup][iconKey] = target.value;
             const img = target.nextElementSibling.querySelector('img');
             if (img) img.src = target.value;
        }
        
        // For settings page with generic fields
        const genericKey = target.dataset.key;
        if(genericKey && configMeta.cellSettings.fields.includes(genericKey)) {
             localConfig[genericKey] = parseFloat(target.value);
        }

        if (target.closest('.card')) {
            saveMainButton.classList.remove('d-none');
        }
    });
    
    document.body.addEventListener('input', (e) => {
        const target = e.target;
        if (target.id === 'player-search') {
            const searchTerm = target.value.toLowerCase();
            const filteredPlayers = allPlayers.filter(p => p.id.includes(searchTerm) || p.name.toLowerCase().includes(searchTerm));
            document.getElementById('players-table-body').innerHTML = generatePlayerRows(filteredPlayers);
        }
    });
    
    // Switch lang
    document.querySelectorAll('.lang-select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            currentLang = e.currentTarget.dataset.lang;
            localStorage.setItem('adminLang', currentLang);
            applyTranslations();
        });
    });

    document.querySelector('.navbar-nav').addEventListener('click', handleTabClick);
    saveMainButton.addEventListener('click', saveAllChanges);
});

// Helper for icon paths - replace with your actual icon paths or a library
window.tablerIcons = {
    'users': '<path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" />',
    'user-plus': '<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M16 19h6" /><path d="M19 16v6" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4" />',
    'wifi': '<path d="M12 18l.01 0" /><path d="M9.172 15.172a4 4 0 0 1 5.656 0" /><path d="M6.343 12.343a8 8 0 0 1 11.314 0" /><path d="M3.515 9.515c4.686 -4.687 12.284 -4.687 17 0" />',
    'trending-up': '<path d="M3 17l6 -6l4 4l8 -8" /><path d="M14 7l7 0l0 7" />',
    'star': '<path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" />',
};

// Functions to render modals will be added here if not already present.
// For brevity, assuming they are defined and called from event handlers.
// Example: renderPlayerDetailsModal, renderConfigForm, etc.
// These would dynamically create and inject modal HTML into #modals-container
// and use Bootstrap's modal JS API to show/hide them.
