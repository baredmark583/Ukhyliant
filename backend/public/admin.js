
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
            const response = await fetch(`/admin/api/${endpoint}`);
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
                    dropdownToggle.classList.add('show');
                    parentNavItem.classList.add('active');
                } else {
                    dropdownToggle.classList.remove('show');
                    parentNavItem.classList.remove('active');
                }
            }
        });
        
        const titleKey = configMeta[activeTab]?.title || activeTab;
        tabTitle.textContent = t(titleKey);
        tabTitle.dataset.translate = titleKey;

        saveMainButton.classList.toggle('d-none', ['dashboard', 'players', 'cheaters'].includes(activeTab));
        showLoading();

        switch (activeTab) {
            case 'dashboard': renderDashboard(); break;
            case 'players': renderPlayers(); break;
            case 'cheaters': renderCheaters(); break;
            case 'dailyEvents': renderDailyEvents(); break;
            case 'cellSettings': renderCellSettings(); break;
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
        
        return escapeHtml(data);
    };
    
    const renderConfigTable = (key) => {
        if (!localConfig || !localConfig[key]) {
            tabContainer.innerHTML = `<p>${t('no_data')}</p>`;
            return;
        }
        const meta = configMeta[key];
        const items = localConfig[key];
        const cols = meta.cols;

        const tableHtml = `
            <div class="card">
                <div class="table-responsive">
                    <table class="table table-vcenter card-table">
                        <thead>
                            <tr>
                                ${cols.map(col => `<th>${t(col)}</th>`).join('')}
                                <th>${t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map((item, index) => `
                                <tr>
                                    ${cols.map(col => `<td>${col === 'id' ? `<div class="font-mono text-muted">${escapeHtml(item[col])}</div>` : formatCellContent(item, col)}</td>`).join('')}
                                    <td>
                                        <button class="btn btn-sm btn-primary" data-action="edit-item" data-key="${key}" data-index="${index}">${t('edit')}</button>
                                        <button class="btn btn-sm btn-danger ms-2" data-action="delete-item" data-key="${key}" data-index="${index}">${t('delete')}</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="mt-4">
                <button class="btn btn-success" data-action="add-new" data-key="${key}">${t('add_new')}</button>
            </div>
        `;
        tabContainer.innerHTML = tableHtml;
    };

    const renderPlayers = async () => {
        const players = await fetchData('players');
        if (!players) {
            tabContainer.innerHTML = `<p>${t('no_data')}</p>`;
            return;
        }
        allPlayers = players;
        
        const renderTable = (playerList) => {
            tabContainer.innerHTML = `
                <div class="card">
                    <div class="card-header">
                        <input type="text" id="player-search" class="form-control" placeholder="${t('search_by_id_name')}">
                    </div>
                    <div class="table-responsive">
                        <table class="table table-vcenter card-table">
                            <thead><tr>
                                <th>${t('id')}</th>
                                <th>${t('name')}</th>
                                <th>${t('balance')}</th>
                                <th>${t('profit_ph')}</th>
                                <th>${t('referrals')}</th>
                                <th>${t('language')}</th>
                                <th>${t('actions')}</th>
                            </tr></thead>
                            <tbody id="players-table-body">
                                ${playerList.map(p => `
                                    <tr>
                                        <td><div class="font-mono text-muted">${p.id}</div></td>
                                        <td>${escapeHtml(p.name)}</td>
                                        <td>${formatNumber(p.balance)}</td>
                                        <td>${formatNumber(p.profitPerHour)}</td>
                                        <td>${formatNumber(p.referrals)}</td>
                                        <td>${escapeHtml(p.language)}</td>
                                        <td>
                                            <button class="btn btn-sm" data-action="player-details" data-id="${p.id}">${t('details')}</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        renderTable(allPlayers);

        document.getElementById('player-search').addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredPlayers = allPlayers.filter(p => 
                p.id.includes(searchTerm) || p.name.toLowerCase().includes(searchTerm)
            );
            renderTable(filteredPlayers);
            document.getElementById('player-search').value = searchTerm; // a bit hacky, but restores search term after re-render
        });
    };

    const renderDashboard = async () => {
        const stats = await fetchData('dashboard-stats');
        const locations = await fetchData('player-locations');
        const socialStats = await fetchData('social-stats');
        if (!stats || !locations) {
            tabContainer.innerHTML = `<p>${t('no_data')}</p>`; return;
        }
        
        tabContainer.innerHTML = `
            <div class="row row-deck row-cards">
                <!-- Stat Cards -->
                <div class="col-lg-2-4"><div class="card card-sm"><div class="card-body"><p class="subheader">${t('total_players')}</p><p class="h1">${formatNumber(stats.totalPlayers)}</p></div></div></div>
                <div class="col-lg-2-4"><div class="card card-sm"><div class="card-body"><p class="subheader">${t('new_players_24h')}</p><p class="h1 text-green">+${formatNumber(stats.newPlayersToday)}</p></div></div></div>
                <div class="col-lg-2-4"><div class="card card-sm"><div class="card-body"><p class="subheader">${t('online_now')}</p><p class="h1">${formatNumber(stats.onlineNow)}</p></div></div></div>
                <div class="col-lg-2-4"><div class="card card-sm"><div class="card-body"><p class="subheader">${t('total_profit_per_hour')}</p><p class="h1">${formatNumber(Math.round(stats.totalProfitPerHour))}</p></div></div></div>
                <div class="col-lg-2-4"><div class="card card-sm"><div class="card-body"><p class="subheader">${t('earned_stars')}</p><p class="h1 text-yellow">${formatNumber(stats.totalStarsEarned)}</p></div></div></div>

                <!-- Charts -->
                <div class="col-lg-8"><div class="card"><div class="card-body"><h3 class="card-title">${t('new_users_last_7_days')}</h3><div class="chart-container"><canvas id="chart-registrations"></canvas></div></div></div></div>
                <div class="col-lg-4"><div class="card"><div class="card-body"><h3 class="card-title">${t('top_5_upgrades')}</h3><div id="top-upgrades-list"></div></div></div></div>

                 <!-- Social Stats -->
                <div class="col-md-6 col-lg-4"><div class="card"><div class="card-body"><h3 class="card-title">${t('youtube_stats')}</h3>
                    <p class="subheader">${t('social_youtube_subs')}: <span class="h2">${formatNumber(socialStats.youtubeSubscribers)}</span></p>
                    <button class="btn btn-sm mt-2" data-action="edit-socials" data-platform="youtube">${t('edit')}</button>
                </div></div></div>
                <div class="col-md-6 col-lg-4"><div class="card"><div class="card-body"><h3 class="card-title">${t('telegram_stats')}</h3>
                    <p class="subheader">${t('social_telegram_subs')}: <span class="h2">${formatNumber(socialStats.telegramSubscribers)}</span></p>
                    <button class="btn btn-sm mt-2" data-action="edit-socials" data-platform="telegram">${t('edit')}</button>
                </div></div></div>
                
                <!-- Player Map -->
                <div class="col-12"><div class="card"><div class="card-body card-body-scrollable card-body-scrollable-shadow"><div id="map-world" style="height: 35rem;"></div></div></div></div>
            </div>`;
        
        // Render Top Upgrades
        const topUpgradesList = document.getElementById('top-upgrades-list');
        topUpgradesList.innerHTML = stats.popularUpgrades.map(u => {
            const upgradeInfo = [...(localConfig.upgrades || []), ...(localConfig.blackMarketCards || [])].find(cfg => cfg.id === u.upgrade_id);
            const name = upgradeInfo ? (upgradeInfo.name[currentLang] || upgradeInfo.name.en) : u.upgrade_id;
            return `<div class="d-flex justify-content-between align-items-center mb-2"><span>${name}</span> <span class="badge bg-green-lt">${formatNumber(u.purchase_count)} ${t('purchases')}</span></div>`;
        }).join('');

        // Init Charts
        charts.registrations = new Chart(document.getElementById('chart-registrations'), {
            type: 'bar',
            data: {
                labels: stats.registrations.map(r => new Date(r.date).toLocaleDateString(currentLang, { month: 'short', day: 'numeric'})),
                datasets: [{
                    label: t('new_users_last_7_days'),
                    data: stats.registrations.map(r => r.count),
                    backgroundColor: 'rgba(74, 222, 128, 0.5)',
                    borderColor: 'rgba(74, 222, 128, 1)',
                    borderWidth: 1
                }]
            },
            options: { scales: { y: { beginAtZero: true } } }
        });

        // Init Map
        const mapData = locations.reduce((acc, loc) => ({ ...acc, [loc.country]: loc.player_count }), {});
        charts.map = new jsVectorMap({
            selector: '#map-world',
            map: 'world',
            backgroundColor: 'transparent',
            series: { regions: [{
                values: mapData,
                scale: ['#C8DBFF', '#4263Eb'],
                normalizeFunction: 'polynomial'
            }] },
            onRegionTooltipShow(event, tooltip, code) {
                tooltip.text(
                    `${tooltip.text()} (${formatNumber(mapData[code] || 0)})`
                );
            }
        });
    };
    
    const renderCheaters = async () => {
        showLoading('loading_cheaters');
        const cheaters = await fetchData('cheaters');
        if (!cheaters) { tabContainer.innerHTML = `<p>${t('no_data')}</p>`; return; }
        
        if (cheaters.length === 0) {
            tabContainer.innerHTML = `<div class="card"><div class="card-body text-center"><h3 class="card-title">${t('no_cheaters_found')}</h3></div></div>`;
            return;
        }

        tabContainer.innerHTML = `
            <div class="card">
                <div class="card-header"><h3 class="card-title">${t('cheater_list')}</h3></div>
                <div class="card-body">${t('cheater_list_desc')}</div>
                <div class="table-responsive">
                    <table class="table table-vcenter card-table">
                        <thead><tr><th>${t('id')}</th><th>${t('name')}</th><th>${t('cheat_log')}</th><th>${t('actions')}</th></tr></thead>
                        <tbody>
                            ${cheaters.map(p => `
                                <tr>
                                    <td><div class="font-mono text-muted">${p.id}</div></td>
                                    <td>${escapeHtml(p.name)}</td>
                                    <td><pre class="m-0">${escapeHtml(JSON.stringify(p.cheat_log, null, 2))}</pre></td>
                                    <td><button class="btn btn-sm btn-warning" data-action="reset-progress" data-id="${p.id}">${t('reset_progress')}</button></td>
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
        if (eventData) dailyEvent = eventData;
        
        const allCards = [...localConfig.upgrades, ...localConfig.blackMarketCards];
        const cardOptions = allCards.map(c => `<option value="${c.id}">${c.name[currentLang] || c.name.en}</option>`).join('');

        const renderSelectedCard = (cardId) => {
            if (!cardId) return `<div class="w-100 h-100 d-flex align-items-center justify-content-center bg-dark-lt">?</div>`;
            const card = allCards.find(c => c.id === cardId);
            return card ? `<img src="${card.iconUrl}" class="img-fluid" alt="${card.name[currentLang]}">` : '?';
        };

        tabContainer.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header"><h3 class="card-title">${t('daily_combo')}</h3></div>
                        <div class="card-body">
                            <p class="text-secondary mb-3">${t('select_3_cards_for_combo')}</p>
                            <div class="row g-2 align-items-center mb-3">
                                <div class="col">
                                    <select class="form-select combo-card-select" data-index="0">
                                        <option value="">${t('select_card')} 1</option>${cardOptions}
                                    </select>
                                </div>
                                <div class="col">
                                    <select class="form-select combo-card-select" data-index="1">
                                        <option value="">${t('select_card')} 2</option>${cardOptions}
                                    </select>
                                </div>
                                <div class="col">
                                    <select class="form-select combo-card-select" data-index="2">
                                        <option value="">${t('select_card')} 3</option>${cardOptions}
                                    </select>
                                </div>
                            </div>
                            <div class="row g-2 mb-3">
                                <div class="col combo-card-preview" data-index="0" style="height: 80px;">${renderSelectedCard(dailyEvent.combo_ids?.[0])}</div>
                                <div class="col combo-card-preview" data-index="1" style="height: 80px;">${renderSelectedCard(dailyEvent.combo_ids?.[1])}</div>
                                <div class="col combo-card-preview" data-index="2" style="height: 80px;">${renderSelectedCard(dailyEvent.combo_ids?.[2])}</div>
                            </div>
                            <label class="form-label">${t('combo_reward')}</label>
                            <input type="number" id="combo-reward-input" class="form-control" value="${dailyEvent.combo_reward || 5000000}">
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header"><h3 class="card-title">${t('daily_cipher')}</h3></div>
                        <div class="card-body">
                            <p class="text-secondary mb-3">${t('enter_cipher_word')}</p>
                            <label class="form-label">${t('cipher_word')}</label>
                            <input type="text" id="cipher-word-input" class="form-control mb-3" placeholder="${t('example_btc')}" value="${dailyEvent.cipher_word || ''}">
                            <label class="form-label">${t('cipher_reward')}</label>
                            <input type="number" id="cipher-reward-input" class="form-control" value="${dailyEvent.cipher_reward || 1000000}">
                        </div>
                    </div>
                </div>
            </div>`;
        
        // Populate selects and listen for changes
        document.querySelectorAll('.combo-card-select').forEach((select, index) => {
            select.value = dailyEvent.combo_ids?.[index] || '';
            select.addEventListener('change', (e) => {
                dailyEvent.combo_ids = dailyEvent.combo_ids || ['', '', ''];
                dailyEvent.combo_ids[index] = e.target.value;
                document.querySelector(`.combo-card-preview[data-index="${index}"]`).innerHTML = renderSelectedCard(e.target.value);
            });
        });
        
        document.getElementById('combo-reward-input').addEventListener('input', (e) => dailyEvent.combo_reward = Number(e.target.value));
        document.getElementById('cipher-word-input').addEventListener('input', (e) => dailyEvent.cipher_word = e.target.value.toUpperCase());
        document.getElementById('cipher-reward-input').addEventListener('input', (e) => dailyEvent.cipher_reward = Number(e.target.value));
    };

    const renderCellSettings = () => {
        tabContainer.innerHTML = `
            <div class="card">
                <div class="card-header"><h3 class="card-title">${t('cellSettings')}</h3></div>
                <div class="card-body">
                     <div class="mb-3">
                        <label class="form-label">${t('cell_creation_cost')}</label>
                        <input type="number" class="form-control" id="cell-creation-cost" value="${localConfig.cellCreationCost || 0}">
                        <div class="form-text">${t('cell_creation_cost_desc')}</div>
                    </div>
                     <div class="mb-3">
                        <label class="form-label">${t('cell_max_members')}</label>
                        <input type="number" class="form-control" id="cell-max-members" value="${localConfig.cellMaxMembers || 0}">
                        <div class="form-text">${t('cell_max_members_desc')}</div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">${t('informant_recruit_cost')}</label>
                        <input type="number" class="form-control" id="informant-recruit-cost" value="${localConfig.informantRecruitCost || 0}">
                        <div class="form-text">${t('informant_recruit_cost_desc')}</div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('cell-creation-cost').addEventListener('input', (e) => localConfig.cellCreationCost = Number(e.target.value));
        document.getElementById('cell-max-members').addEventListener('input', (e) => localConfig.cellMaxMembers = Number(e.target.value));
        document.getElementById('informant-recruit-cost').addEventListener('input', (e) => localConfig.informantRecruitCost = Number(e.target.value));
    };

    const renderUiIcons = () => {
        const icons = localConfig.uiIcons || {};
        const iconFields = [
            { group: 'icon_group_nav', key: 'nav.exchange', label: 'icon_nav_exchange' },
            { group: 'icon_group_nav', key: 'nav.mine', label: 'icon_nav_mine' },
            { group: 'icon_group_nav', key: 'nav.missions', label: 'icon_nav_missions' },
            { group: 'icon_group_nav', key: 'nav.airdrop', label: 'icon_nav_airdrop' },
            { group: 'icon_group_nav', key: 'nav.profile', label: 'icon_nav_profile' },
            { group: 'icon_group_gameplay', key: 'energy', label: 'icon_energy' },
            { group: 'icon_group_gameplay', key: 'coin', label: 'icon_coin' },
            { group: 'icon_group_gameplay', key: 'star', label: 'icon_star' },
            { group: 'icon_group_gameplay', key: 'suspicion', label: 'icon_suspicion' },
            { group: 'icon_group_market', key: 'marketCoinBox', label: 'icon_market_coin_box' },
            { group: 'icon_group_market', key: 'marketStarBox', label: 'icon_market_star_box' },
        ];
        
        const getValue = (key) => key.split('.').reduce((o, i) => o?.[i], icons);
        const setValue = (key, value) => {
            const keys = key.split('.');
            let obj = icons;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!obj[keys[i]]) obj[keys[i]] = {};
                obj = obj[keys[i]];
            }
            obj[keys[keys.length - 1]] = value;
        };

        const groupedFields = iconFields.reduce((acc, field) => {
            (acc[field.group] = acc[field.group] || []).push(field);
            return acc;
        }, {});

        tabContainer.innerHTML = Object.entries(groupedFields).map(([groupKey, fields]) => `
            <div class="card mb-4">
                <div class="card-header"><h3 class="card-title">${t(groupKey)}</h3></div>
                <div class="card-body">
                    <div class="row g-3">
                        ${fields.map(field => `
                            <div class="col-md-6">
                                <label class="form-label">${t(field.label)}</label>
                                <div class="input-group">
                                    <input type="text" class="form-control" data-icon-key="${field.key}" value="${escapeHtml(getValue(field.key) || '')}">
                                    <span class="input-group-text"><img src="${escapeHtml(getValue(field.key) || '')}" class="w-5 h-5" alt="preview" style="width:20px; height:20px;"></span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('input[data-icon-key]').forEach(input => {
            input.addEventListener('input', (e) => {
                setValue(e.target.dataset.iconKey, e.target.value);
                // Update preview
                e.target.nextElementSibling.querySelector('img').src = e.target.value;
            });
        });
    };

    // --- MODALS ---
    const renderModal = (titleKey, bodyHtml, footerHtml) => {
        const modalId = `modal-${Date.now()}`;
        const modalHtml = `
            <div class="modal modal-blur fade" id="${modalId}" tabindex="-1" style="display: none;" aria-hidden="true">
              <div class="modal-dialog modal-lg modal-dialog-centered" role="document">
                <div class="modal-content">
                  <div class="modal-header">
                    <h5 class="modal-title">${t(titleKey)}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="${t('close')}"></button>
                  </div>
                  <div class="modal-body">${bodyHtml}</div>
                  <div class="modal-footer">${footerHtml}</div>
                </div>
              </div>
            </div>`;
        modalsContainer.innerHTML = modalHtml;
        const modal = new bootstrap.Modal(document.getElementById(modalId));
        modal.show();
        document.getElementById(modalId).addEventListener('hidden.bs.modal', () => {
            modalsContainer.innerHTML = ''; // Clean up after close
        });
        return modalId;
    };
    
    const renderPlayerDetailsModal = async (playerId) => {
        const player = await fetchData(`player/${playerId}/details`);
        if (!player) { alert('Player not found.'); return; }

        const upgradesHtml = Object.entries(player.upgrades || {}).map(([id, level]) => {
            const upgrade = [...(localConfig.upgrades || []), ...(localConfig.blackMarketCards || [])].find(u => u.id === id);
            return upgrade ? `<li>${upgrade.name[currentLang] || upgrade.name.en}: ${t('level')} ${level}</li>` : '';
        }).join('');

        const bodyHtml = `
            <p><strong>${t('id')}:</strong> ${player.id}</p>
            <p><strong>${t('name')}:</strong> ${escapeHtml(player.name)}</p>
            <p><strong>${t('current_balance')}:</strong> ${formatNumber(player.balance)}</p>
            <p><strong>${t('suspicion')}:</strong> ${formatNumber(player.suspicion || 0)}</p>
            <hr>
            <h4>${t('player_upgrades')}</h4>
            <ul>${upgradesHtml || '<li>No upgrades</li>'}</ul>
            <hr>
            <h4>${t('add_bonus')}</h4>
            <div class="input-group">
                <input type="number" id="bonus-amount-input" class="form-control" placeholder="${t('bonus_amount')}">
                <button class="btn btn-primary" id="add-bonus-btn">${t('add_bonus')}</button>
            </div>
        `;
        const footerHtml = `
            <button class="btn btn-warning" id="reset-daily-btn">${t('reset_daily')}</button>
            <button class="btn btn-danger" id="delete-player-btn">${t('delete')}</button>
            <button class="btn" data-bs-dismiss="modal">${t('close')}</button>`;
        
        const modalId = renderModal('player_details', bodyHtml, footerHtml);
        
        document.getElementById('add-bonus-btn').onclick = async () => {
            const amount = parseInt(document.getElementById('bonus-amount-input').value, 10);
            if (!isNaN(amount)) {
                const res = await postData(`player/${playerId}/update-balance`, { amount });
                if (res) { alert(t('balance_updated')); bootstrap.Modal.getInstance(document.getElementById(modalId)).hide(); renderPlayers(); }
            }
        };
        document.getElementById('reset-daily-btn').onclick = async () => {
            if (confirm(t('confirm_reset_daily'))) {
                const res = await postData(`player/${playerId}/reset-daily`);
                if (res) { alert(t('daily_progress_reset_success')); }
            }
        };
        document.getElementById('delete-player-btn').onclick = async () => {
             if (confirm(t('confirm_delete_player'))) {
                const res = await deleteData(`player/${playerId}`);
                if (res) { bootstrap.Modal.getInstance(document.getElementById(modalId)).hide(); renderPlayers(); }
            }
        };
    };

    const renderTaskEditModal = (key, index) => {
        const isNew = index === null;
        const item = isNew ? { name: {}, description: {}, reward: { type: 'coins', amount: 0 } } : { ...localConfig[key][index] };
        const meta = configMeta[key];
        const titleKey = isNew ? 'config_add_item' : 'config_edit_item';

        const taskTypes = [
            'taps', 'telegram_join', 'youtube_subscribe', 'twitter_follow', 'instagram_follow', 'video_watch', 'video_code'
        ];

        const typeOptions = taskTypes.map(type => 
            `<option value="${type}" ${item.type === type ? 'selected' : ''}>${t(`task_type_${type}`)}</option>`
        ).join('');

        const bodyHtml = `
            <form id="task-edit-form">
                ${isNew ? '' : `<div class="mb-3"><label class="form-label">${t('id')}</label><input type="text" class="form-control" value="${escapeHtml(item.id)}" disabled></div>`}
                ${meta.cols.filter(c => ['name', 'description'].includes(c)).map(col => `
                     <div class="mb-3">
                        <label class="form-label">${t(col)}</label>
                        <input type="text" class="form-control" data-col="${col}" data-lang="en" placeholder="EN" value="${escapeHtml(item[col]?.en || '')}">
                        <input type="text" class="form-control mt-1" data-col="${col}" data-lang="ru" placeholder="RU" value="${escapeHtml(item[col]?.ru || '')}">
                        <input type="text" class="form-control mt-1" data-col="${col}" data-lang="ua" placeholder="UA" value="${escapeHtml(item[col]?.ua || '')}">
                    </div>
                `).join('')}

                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label">${t('type')}</label>
                        <select class="form-select" data-col="type">${typeOptions}</select>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label">${t('reward')}</label>
                        <div class="input-group">
                           <input type="number" class="form-control" data-col="reward.amount" value="${item.reward?.amount || 0}">
                           <select class="form-select" data-col="reward.type" style="flex-grow: 0.5;">
                                <option value="coins" ${item.reward?.type === 'coins' ? 'selected' : ''}>${t('reward_type_coins')}</option>
                                <option value="profit" ${item.reward?.type === 'profit' ? 'selected' : ''}>${t('reward_type_profit')}</option>
                           </select>
                        </div>
                    </div>
                </div>
                 <div class="row">
                    ${meta.cols.filter(c => ['requiredTaps', 'priceStars', 'suspicionModifier'].includes(c)).map(col => `
                         <div class="col-md-4 mb-3">
                            <label class="form-label">${t(col)}</label>
                            <input type="number" class="form-control" data-col="${col}" value="${item[col] || 0}">
                        </div>
                    `).join('')}
                 </div>
                ${meta.cols.filter(c => ['url', 'secretCode', 'imageUrl'].includes(c)).map(col => `
                     <div class="mb-3">
                        <label class="form-label">${t(col)}</label>
                        <input type="text" class="form-control" data-col="${col}" value="${escapeHtml(item[col] || '')}">
                    </div>
                `).join('')}
            </form>
        `;
        const footerHtml = `<button class="btn btn-success" id="save-item-btn">${t('save')}</button>`;
        const modalId = renderModal(titleKey, bodyHtml, footerHtml);
        
        document.getElementById('save-item-btn').onclick = () => {
            const form = document.getElementById('task-edit-form');
            const newItem = isNew ? { id: `${key}_${Date.now()}` } : { ...item };

            form.querySelectorAll('[data-col]').forEach(input => {
                const colPath = input.dataset.col;
                const keys = colPath.split('.');
                let current = newItem;
                for (let i = 0; i < keys.length - 1; i++) {
                    current = current[keys[i]] = current[keys[i]] || {};
                }
                const finalKey = keys[keys.length - 1];
                if (input.dataset.lang) {
                    current[finalKey] = current[finalKey] || {};
                    current[finalKey][input.dataset.lang] = input.value;
                } else {
                     current[finalKey] = isNaN(input.value) || input.value === '' ? input.value : Number(input.value);
                }
            });
            
            if (isNew) {
                localConfig[key].push(newItem);
            } else {
                localConfig[key][index] = newItem;
            }
            bootstrap.Modal.getInstance(document.getElementById(modalId)).hide();
            renderConfigTable(key);
        };
    };

    const renderDefaultEditModal = (key, index) => {
        const isNew = index === null;
        let item = isNew ? {} : { ...localConfig[key][index] };
        const meta = configMeta[key];
        const titleKey = isNew ? 'config_add_item' : 'config_edit_item';

        const bodyHtml = `
            <form id="edit-form">
                 ${isNew ? '' : `<div class="mb-3"><label class="form-label">${t('id')}</label><input type="text" class="form-control" value="${escapeHtml(item.id)}" disabled></div>`}
                ${meta.cols.filter(c => c !== 'id').map(col => {
                    const value = item[col];
                    if (typeof value === 'object' && value !== null) { // Handle localized strings
                        return `
                            <div class="mb-3">
                                <label class="form-label">${t(col)}</label>
                                <input type="text" class="form-control" data-col="${col}" data-lang="en" placeholder="EN" value="${escapeHtml(value.en || '')}">
                                <input type="text" class="form-control mt-1" data-col="${col}" data-lang="ru" placeholder="RU" value="${escapeHtml(value.ru || '')}">
                                <input type="text" class="form-control mt-1" data-col="${col}" data-lang="ua" placeholder="UA" value="${escapeHtml(value.ua || '')}">
                            </div>`;
                    } else if (typeof value === 'number') {
                         return `
                            <div class="mb-3">
                                <label class="form-label">${t(col)}</label>
                                <input type="number" class="form-control" data-col="${col}" value="${value || 0}">
                            </div>`;
                    } else {
                        return `
                            <div class="mb-3">
                                <label class="form-label">${t(col)}</label>
                                <input type="text" class="form-control" data-col="${col}" value="${escapeHtml(value || '')}">
                            </div>`;
                    }
                }).join('')}
            </form>
        `;

        const footerHtml = `<button class="btn btn-success" id="save-item-btn">${t('save')}</button>`;
        const modalId = renderModal(titleKey, bodyHtml, footerHtml);

        document.getElementById('save-item-btn').onclick = () => {
            const form = document.getElementById('edit-form');
            const newItem = isNew ? { id: `${key}_${Date.now()}` } : { ...item };
            
            form.querySelectorAll('[data-col]').forEach(input => {
                const col = input.dataset.col;
                if (input.dataset.lang) {
                    newItem[col] = newItem[col] || {};
                    newItem[col][input.dataset.lang] = input.value;
                } else {
                    newItem[col] = isNaN(input.value) || input.value === '' ? input.value : Number(input.value);
                }
            });

            if (isNew) {
                if (!localConfig[key]) localConfig[key] = [];
                localConfig[key].push(newItem);
            } else {
                localConfig[key][index] = newItem;
            }
            bootstrap.Modal.getInstance(document.getElementById(modalId)).hide();
            renderConfigTable(key);
        };
    };
    
    const renderSocialsModal = (platform) => {
        const socials = localConfig.socials || {};
        const isYoutube = platform === 'youtube';
        const titleKey = isYoutube ? 'edit_youtube_settings' : 'edit_telegram_settings';
        const urlValue = isYoutube ? socials.youtubeUrl : socials.telegramUrl;
        const idValue = isYoutube ? socials.youtubeChannelId : socials.telegramChannelId;
        
        const bodyHtml = `
            <form id="socials-edit-form">
                <div class="mb-3">
                    <label class="form-label">${t(isYoutube ? 'youtube_channel_url' : 'telegram_channel_url')}</label>
                    <input type="text" id="social-url-input" class="form-control" value="${escapeHtml(urlValue || '')}">
                    <div class="form-text">${t(isYoutube ? 'youtube_channel_url_desc' : 'telegram_channel_url_desc')}</div>
                </div>
                <div class="mb-3">
                    <label class="form-label">${t(isYoutube ? 'youtube_channel_id' : 'telegram_channel_id')}</label>
                    <input type="text" id="social-id-input" class="form-control" value="${escapeHtml(idValue || '')}">
                    <div class="form-text">${t(isYoutube ? 'youtube_channel_id_desc' : 'telegram_channel_id_desc')}</div>
                </div>
            </form>
        `;
        
        const footerHtml = `<button class="btn btn-success" id="save-socials-btn">${t('save')}</button>`;
        const modalId = renderModal(titleKey, bodyHtml, footerHtml);
        
        document.getElementById('save-socials-btn').onclick = () => {
            const url = document.getElementById('social-url-input').value;
            const id = document.getElementById('social-id-input').value;
            
            if (isYoutube) {
                localConfig.socials.youtubeUrl = url;
                localConfig.socials.youtubeChannelId = id;
            } else {
                localConfig.socials.telegramUrl = url;
                localConfig.socials.telegramChannelId = id;
            }
            
            bootstrap.Modal.getInstance(document.getElementById(modalId)).hide();
            alert(t('save_success')); // Or add to a queue to save with main button
        };
    };


    // --- EVENT LISTENERS ---
    const setupEventListeners = () => {
        // Main nav tabs
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = e.currentTarget.dataset.tab;
                if (tab !== activeTab) {
                    activeTab = tab;
                    render();
                }
            });
        });

        // Language switcher
        document.getElementById('lang-menu').addEventListener('click', (e) => {
            if (e.target.matches('.lang-select-btn')) {
                e.preventDefault();
                currentLang = e.target.dataset.lang;
                localStorage.setItem('adminLang', currentLang);
                applyTranslations();
                render();
            }
        });

        // Main save button
        saveMainButton.addEventListener('click', saveAllChanges);
        
        // Delegated events for dynamic content
        document.body.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            
            const { action, key, index, id, platform } = target.dataset;

            switch (action) {
                case 'add-new':
                    if (['tasks', 'specialTasks'].includes(key)) {
                        renderTaskEditModal(key, null);
                    } else {
                        renderDefaultEditModal(key, null);
                    }
                    break;
                case 'edit-item':
                     if (['tasks', 'specialTasks'].includes(key)) {
                        renderTaskEditModal(key, Number(index));
                    } else {
                        renderDefaultEditModal(key, Number(index));
                    }
                    break;
                case 'delete-item':
                    if (confirm(t('confirm_delete'))) {
                        localConfig[key].splice(Number(index), 1);
                        renderConfigTable(key);
                    }
                    break;
                case 'player-details':
                    renderPlayerDetailsModal(id);
                    break;
                case 'reset-progress':
                     if (confirm(t('confirm_reset_progress'))) {
                        postData(`player/${id}/reset-progress`).then(res => {
                           if(res) {
                               alert(t('progress_reset_success'));
                               renderCheaters();
                           } else {
                               alert(t('error_resetting_progress'));
                           }
                        });
                     }
                    break;
                case 'edit-socials':
                    renderSocialsModal(platform);
                    break;
            }
        });
    };

    // --- INITIALIZATION ---
    const init = async () => {
        applyTranslations();
        showLoading();
        localConfig = await fetchData('config');
        if (localConfig) {
            setupEventListeners();
            render();
        } else {
            tabContainer.innerHTML = '<h2>Failed to load configuration. Please check server logs.</h2>';
        }
    };

    init();
});
