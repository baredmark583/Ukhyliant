
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

    // --- DOM ELEMENTS ---
    const tabContainer = document.getElementById('tab-content-container');
    const tabTitle = document.getElementById('tab-title');
    const saveMainButton = document.getElementById('save-main-button');
    const modalsContainer = document.getElementById('modals-container');
    
    // --- TRANSLATION FUNCTION ---
    const t = (key) => LOCALES[currentLang]?.[key] || LOCALES['en']?.[key] || `[${key}]`;

    // --- UTILS ---
    const escapeHtml = (unsafe) => {
        if (typeof unsafe !== 'string' && typeof unsafe !== 'number') return unsafe || '';
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
                    <div class="spinner-border" role="status"></div>
                    <p class="mt-2 text-muted">${t(messageKey)}</p>
                </div>
            </div>`;
    };

    const render = () => {
        destroyCharts();
        document.querySelectorAll('.tab-button').forEach(btn => {
            const isActive = btn.dataset.tab === activeTab;
            btn.classList.toggle('active', isActive);
            // Handle dropdown parents
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

        saveMainButton.classList.toggle('d-none', ['players'].includes(activeTab));

        switch (activeTab) {
            case 'dashboard': renderDashboard(); break;
            case 'players': renderPlayersTab(); break;
            case 'dailyEvents': renderDailyEvents(); break;
            case 'specialTasks': renderConfigTable('specialTasks'); break;
            case 'upgrades': renderConfigTable('upgrades'); break;
            case 'tasks': renderConfigTable('tasks'); break;
            case 'boosts': renderBoostsConfig(); break;
            case 'blackMarketCards': renderConfigTable('blackMarketCards'); break;
            case 'coinSkins': renderConfigTable('coinSkins'); break;
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
                <div class="col-sm-6 col-lg-3"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><div class="subheader" data-translate="total_players"></div></div><div class="h1 mb-3">${formatNumber(dashboardStats.totalPlayers)}</div></div></div></div>
                <div class="col-sm-6 col-lg-3"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><div class="subheader" data-translate="new_players_24h"></div></div><div class="h1 mb-3">${formatNumber(dashboardStats.newPlayersToday)}</div></div></div></div>
                <div class="col-sm-6 col-lg-3"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><div class="subheader" data-translate="online_now"></div></div><div class="h1 mb-3">${formatNumber(dashboardStats.onlineNow)}</div></div></div></div>
                <div class="col-sm-6 col-lg-3"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><div class="subheader" data-translate="total_coins_in_game"></div></div><div class="h1 mb-3 text-green">${formatNumber(dashboardStats.totalCoins)}</div></div></div></div>
                
                <!-- Charts -->
                 <div class="col-lg-6">
                    <div class="card">
                        <div class="card-body">
                            <h3 class="card-title" data-translate="new_users_last_7_days"></h3>
                            <canvas id="chart-registrations" height="175"></canvas>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="card">
                        <div class="card-body">
                           <h3 class="card-title" data-translate="top_5_upgrades"></h3>
                           <canvas id="chart-upgrades" height="175"></canvas>
                        </div>
                    </div>
                </div>

                 <!-- General Settings -->
                <div class="col-12">
                    <div class="card">
                        <div class="card-body">
                            <h3 class="card-title" data-translate="general_settings"></h3>
                            <div class="mb-3">
                                <label class="form-label" data-translate="loading_screen_image_url"></label>
                                <input type="text" class="form-control" id="loading-screen-url-input" value="${escapeHtml(localConfig.loadingScreenImageUrl || '')}">
                                <div class="form-text" data-translate="loading_screen_image_url_desc"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Map -->
                <div class="col-12">
                    <div class="card">
                        <div class="card-body">
                            <h3 class="card-title" data-translate="player_map"></h3>
                            <div id="map-world" style="height: 350px;"></div>
                        </div>
                    </div>
                </div>
            </div>`;

        // Initialize Charts
        const upgradeNames = (dashboardStats.popularUpgrades || []).map(upg => {
            const allUpgrades = [...(localConfig.upgrades || []), ...(localConfig.blackMarketCards || [])];
            const details = allUpgrades.find(u => u.id === upg.upgrade_id);
            return details?.name?.[currentLang] || details?.name?.en || upg.upgrade_id;
        });
        const upgradeCounts = (dashboardStats.popularUpgrades || []).map(upg => parseInt(upg.purchase_count));
        
        charts.upgrades = new Chart(document.getElementById('chart-upgrades'), {
            type: 'bar',
            data: { labels: upgradeNames, datasets: [{ label: t('purchases'), data: upgradeCounts }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: true }
        });

        const regDates = (dashboardStats.registrations || []).map(r => new Date(r.date).toLocaleDateString(currentLang));
        const regCounts = (dashboardStats.registrations || []).map(r => r.count);
        charts.registrations = new Chart(document.getElementById('chart-registrations'), {
            type: 'line',
            data: { labels: regDates, datasets: [{ label: t('new_players_24h'), data: regCounts, tension: 0.1, pointRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: true }
        });

        // Initialize jsVectorMap
        const mapData = playerLocations.reduce((acc, loc) => {
            acc[loc.country] = loc.player_count;
            return acc;
        }, {});
        
        const mapEl = document.getElementById('map-world');
        if (mapEl) {
            charts.map = new jsVectorMap({
                selector: '#map-world',
                map: 'world',
                backgroundColor: 'transparent',
                regionStyle: {
                    initial: { fill: '#3A445D' },
                    hover: { fill: '#2A3347' }
                },
                series: {
                    regions: [{
                        values: mapData,
                        scale: ['#C8EEFF', '#0071A4'],
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
            <div class="card-header"><h3 class="card-title" data-translate="daily_events_setup"></h3></div>
            <div class="card-body">
                <div class="row g-4">
                    <div class="col-lg-6">
                        <h4 data-translate="daily_combo"></h4>
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
                        <h4 data-translate="daily_cipher"></h4>
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
                <h3 class="card-title" data-translate="players"></h3>
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
                            <tr class="player-row" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name?.toLowerCase())}">
                                <td>${escapeHtml(p.id)}</td>
                                <td>${escapeHtml(p.name)}</td>
                                <td>${formatNumber(p.balance)}</td>
                                <td>+${formatNumber(p.profitPerHour)}</td>
                                <td>${formatNumber(p.starsSpent)}</td>
                                <td>${formatNumber(p.referrals)}</td>
                                <td><span class="badge bg-secondary-lt">${escapeHtml(p.language)}</span></td>
                                <td class="text-end">
                                    <button data-id="${p.id}" class="btn btn-sm btn-ghost-primary reset-daily-btn" data-translate="reset_daily"></button>
                                    <button data-id="${p.id}" class="btn btn-sm btn-ghost-danger delete-player-btn" data-translate="delete"></button>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        `;
    };
    
    // -- CONFIG TABLE RENDERERS --
    const createLocalizedInputGroup = (section, index, field, value) => `
        <div class="col-md-6">
            <label class="form-label" data-translate="${field}"></label>
            <div class="input-group">
                <input type="text" class="form-control" data-section="${section}" data-index="${index}" data-lang="en" data-field="${field}" value="${escapeHtml(value.en)}" placeholder="EN">
                <input type="text" class="form-control" data-section="${section}" data-index="${index}" data-lang="ru" data-field="${field}" value="${escapeHtml(value.ru)}" placeholder="RU">
                <button class="btn translate-btn" type="button" data-section="${section}" data-index="${index}" data-field="${field}">AI</button>
            </div>
        </div>`;

    const createInput = (section, index, field, type = 'text', hidden = false, placeholder = '') => `
        <div class="col-md-3 ${hidden ? 'd-none' : ''}" id="field-container-${section}-${index}-${field}">
            <label class="form-label" data-translate="${field}"></label>
            <input type="${type}" data-section="${section}" data-index="${index}" data-field="${field}" value="${escapeHtml(localConfig[section][index]?.[field] ?? '')}" class="form-control" placeholder="${placeholder}">
        </div>`;

    const createSelect = (section, index, field, options, hidden = false) => `
         <div class="col-md-3 ${hidden ? 'd-none' : ''}" id="field-container-${section}-${index}-${field}">
            <label class="form-label" data-translate="${field}"></label>
            <select data-section="${section}" data-index="${index}" data-field="${field}" class="form-select">
                ${options.map(o => `<option value="${o}" ${o === localConfig[section][index]?.[field] ? 'selected' : ''}>${t(o)}</option>`).join('')}
            </select>
         </div>`;

    const createRewardInput = (section, index, reward) => {
        const safeReward = reward || { type: 'coins', amount: 0 };
        return `
        <div class="col-md-3">
            <label class="form-label" data-translate="reward"></label>
            <div class="input-group">
                <select data-section="${section}" data-index="${index}" data-field="reward.type" class="form-select" style="flex: 2;">
                    <option value="coins" ${safeReward.type === 'coins' ? 'selected' : ''}>${t('reward_type_coins')}</option>
                    <option value="profit" ${safeReward.type === 'profit' ? 'selected' : ''}>${t('reward_type_profit')}</option>
                </select>
                <input type="number" data-section="${section}" data-index="${index}" data-field="reward.amount" value="${safeReward.amount}" class="form-control" style="flex: 3;">
            </div>
        </div>`;
    };

    const renderConfigTable = (sectionKey) => {
        const items = localConfig[sectionKey] || [];
        const isTask = sectionKey === 'tasks' || sectionKey === 'specialTasks';
        tabContainer.innerHTML = `<div class="space-y-4">
             <div class="card">
                <div class="card-header">
                    <h3 class="card-title" data-translate="${sectionKey}"></h3>
                    <div class="card-actions">
                        <input type="file" id="upload-config-input" class="d-none" accept=".json">
                        <button class="btn btn-outline-secondary me-2" id="upload-config-btn" data-translate="upload_config"></button>
                        <button class="btn btn-outline-secondary" id="download-config-btn" data-translate="download_config"></button>
                    </div>
                </div>
            </div>
            ${items.map((item, index) => {
                let fieldsHTML = '<div class="row g-3">';
                fieldsHTML += `<div class="col-md-3"><label class="form-label" data-translate="id"></label><input type="text" value="${escapeHtml(item.id)}" class="form-control" readonly></div>`;
                if (item.name) fieldsHTML += createLocalizedInputGroup(sectionKey, index, 'name', item.name);
                if (item.description) fieldsHTML += createLocalizedInputGroup(sectionKey, index, 'description', item.description);
                if (sectionKey === 'upgrades') {
                    fieldsHTML += createInput(sectionKey, index, 'price', 'number');
                    fieldsHTML += createInput(sectionKey, index, 'profitPerHour', 'number');
                    fieldsHTML += createSelect(sectionKey, index, 'category', ['Documents', 'Legal', 'Lifestyle', 'Special']);
                    fieldsHTML += createInput(sectionKey, index, 'iconUrl', 'text', false, 'https://.../img.svg');
                } else if (isTask) {
                    const taskTypes = ['taps', 'telegram_join', 'social_follow', 'video_watch', 'video_code'];
                    fieldsHTML += createSelect(sectionKey, index, 'type', taskTypes);
                    fieldsHTML += createRewardInput(sectionKey, index, item.reward);
                    fieldsHTML += createInput(sectionKey, index, 'imageUrl', 'text', false, 'https://.../img.svg');
                    fieldsHTML += createInput(sectionKey, index, 'url', 'text', item.type === 'taps', 'https://t.me/...');
                    fieldsHTML += createInput(sectionKey, index, 'requiredTaps', 'number', item.type !== 'taps');
                    fieldsHTML += createInput(sectionKey, index, 'secretCode', 'text', item.type !== 'video_code');
                    if (sectionKey === 'specialTasks') {
                         fieldsHTML += createInput(sectionKey, index, 'priceStars', 'number');
                    }
                } else if (sectionKey === 'blackMarketCards') {
                    fieldsHTML += createInput(sectionKey, index, 'profitPerHour', 'number');
                    fieldsHTML += createInput(sectionKey, index, 'iconUrl', 'text', false, 'https://.../img.svg');
                    fieldsHTML += createSelect(sectionKey, index, 'boxType', ['coin', 'star']);
                    fieldsHTML += createInput(sectionKey, index, 'chance', 'number');
                } else if (sectionKey === 'coinSkins') {
                    fieldsHTML += createInput(sectionKey, index, 'profitBoostPercent', 'number');
                    fieldsHTML += createInput(sectionKey, index, 'iconUrl', 'text', false, 'https://.../img.svg');
                    fieldsHTML += createSelect(sectionKey, index, 'boxType', ['coin', 'star', 'direct']);
                    fieldsHTML += createInput(sectionKey, index, 'chance', 'number');
                }

                fieldsHTML += `<div class="col-12 text-end"><button data-section="${sectionKey}" data-index="${index}" class="btn btn-ghost-danger delete-btn" data-translate="delete"></button></div>`;
                fieldsHTML += '</div>';
                return `<div class="card"><div class="card-body">${fieldsHTML}</div></div>`;
            }).join('')}
            <button class="btn btn-primary add-new-btn" data-section="${sectionKey}" data-translate="add_new"></button>
            </div>`;
    };
    
    const renderBoostsConfig = () => {
        const items = localConfig.boosts || [];
        const sectionKey = 'boosts';
        tabContainer.innerHTML = `<div class="space-y-4">
             <div class="card">
                <div class="card-header">
                    <h3 class="card-title" data-translate="boosts"></h3>
                </div>
            </div>
            ${items.map((item, index) => {
                const effectKey = `boost_effect_${item.id.replace('boost_', '')}`;
                const isMultiLevel = item.id === 'boost_tap_guru' || item.id === 'boost_energy_limit';

                let fieldsHTML = '<div class="row g-3">';
                fieldsHTML += `<div class="col-md-6"><label class="form-label" data-translate="id"></label><input type="text" value="${escapeHtml(item.id)}" class="form-control" readonly><div class="form-text" data-translate="id_readonly_note"></div></div>`;
                fieldsHTML += `<div class="col-md-6"><label class="form-label" data-translate="boost_effect"></label><div class="form-control-plaintext" data-translate="${effectKey}"></div></div>`;

                if (item.name) fieldsHTML += createLocalizedInputGroup(sectionKey, index, 'name', item.name);
                if (item.description) fieldsHTML += createLocalizedInputGroup(sectionKey, index, 'description', item.description);
                
                fieldsHTML += `<div class="col-md-6">
                    <label class="form-label" data-translate="cost_in_coins"></label>
                    <input type="number" data-section="${sectionKey}" data-index="${index}" data-field="costCoins" value="${escapeHtml(item.costCoins || '')}" class="form-control">
                    ${isMultiLevel ? `<div class="form-text" data-translate="base_cost_note"></div>` : ''}
                </div>`;
                
                fieldsHTML += createInput(sectionKey, index, 'iconUrl', 'text', false, 'https://.../img.svg');
                fieldsHTML += '</div>';
                return `<div class="card"><div class="card-body">${fieldsHTML}</div></div>`;
            }).join('')}
            </div>`;
    };

    // --- EVENT HANDLERS ---
    const handleFieldChange = (e) => {
        const { section, index, field } = e.target.dataset;
        if (!section || !index || !field) return;
        const value = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
        if (field.includes('.')) {
            const [parent, child] = field.split('.');
            if (!localConfig[section][index][parent]) localConfig[section][index][parent] = {};
            localConfig[section][index][parent][child] = value;
        } else if (e.target.dataset.lang) {
            localConfig[section][index][field][e.target.dataset.lang] = value;
        } else {
            localConfig[section][index][field] = value;
        }
        if (field === 'type' && (section === 'tasks' || section === 'specialTasks')) {
            const type = localConfig[section][index].type;
            document.getElementById(`field-container-${section}-${index}-url`).classList.toggle('d-none', type === 'taps');
            document.getElementById(`field-container-${section}-${index}-requiredTaps`).classList.toggle('d-none', type !== 'taps');
            document.getElementById(`field-container-${section}-${index}-secretCode`).classList.toggle('d-none', type !== 'video_code');
        }
    };
    
    const handleTranslate = async (e) => {
        const button = e.target.closest('button');
        const { section, index, field } = button.dataset;
        const group = button.closest('.input-group');
        const sourceInput = group.querySelector(`[data-lang="ru"]`) || group.querySelector(`[data-lang="en"]`);
        if (!sourceInput.value) { alert(t('enter_text_to_translate')); return; }
        button.disabled = true;
        const originalText = button.innerHTML;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
        try {
            for (const lang of ['en', 'ru']) {
                if(lang !== sourceInput.dataset.lang) {
                    const targetInput = group.querySelector(`[data-lang="${lang}"]`);
                    const response = await fetch('/admin/api/translate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: sourceInput.value, from: sourceInput.dataset.lang, to: lang }),
                    });
                    const data = await response.json();
                    if (response.ok) {
                        targetInput.value = data.translatedText;
                        localConfig[section][index][field][lang] = data.translatedText;
                    } else throw new Error(data.error || t('translation_error'));
                }
            }
        } catch(err) { alert(err.message); } 
        finally { button.disabled = false; button.innerHTML = originalText; }
    };
    
    const saveChanges = async () => {
        saveMainButton.disabled = true;
        saveMainButton.querySelector('span').textContent = t('saving');
        try {
            if (activeTab === 'dailyEvents') {
                const comboSelects = document.querySelectorAll('[data-event="combo"]');
                const comboIds = Array.from(comboSelects).map(sel => sel.value).filter(Boolean);
                const uniqueComboIds = [...new Set(comboIds)];
                if (comboIds.length > 0 && uniqueComboIds.length !== 3) {
                    alert(t('error_3_unique_cards')); return;
                }
                await fetch('/admin/api/daily-events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        comboIds: uniqueComboIds, 
                        cipherWord: document.getElementById('cipher-word-input').value.toUpperCase().trim(),
                        comboReward: document.getElementById('combo-reward-input').value,
                        cipherReward: document.getElementById('cipher-reward-input').value,
                    }),
                });
            }
            if (activeTab === 'dashboard') {
                localConfig.loadingScreenImageUrl = document.getElementById('loading-screen-url-input').value;
            }

            const configResponse = await fetch('/admin/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: localConfig }),
            });
            if (!configResponse.ok) throw new Error('Failed to save config');
            alert(t('save_all_changes') + '!');
        } catch (error) {
            console.error(error);
            alert('Error saving data.');
        } finally {
            saveMainButton.disabled = false;
            saveMainButton.querySelector('span').textContent = t('save_all_changes');
        }
    };
    
    const addNewItem = (e) => {
        const { section } = e.target.dataset;
        if (!localConfig[section]) localConfig[section] = [];
        const newItem = {
            id: `${section.slice(0, 4)}_${Date.now()}`,
            name: { en: '', ru: '' },
        };
        if (section === 'upgrades') Object.assign(newItem, { price: 0, profitPerHour: 0, category: 'Documents', iconUrl: '' });
        else if (section === 'boosts') Object.assign(newItem, { description: { en: '', ru: '' }, costCoins: 0, iconUrl: '' });
        else if (section === 'tasks' || section === 'specialTasks') {
            Object.assign(newItem, { type: 'taps', reward: { type: 'coins', amount: 0 }, imageUrl: '', url: '', requiredTaps: 0, secretCode: '' });
        }
        if (section === 'specialTasks') {
            Object.assign(newItem, { description: { en: '', ru: '' }, priceStars: 0, isOneTime: true });
        }
        if (section === 'blackMarketCards') {
            Object.assign(newItem, { profitPerHour: 0, iconUrl: '', boxType: 'coin', chance: 10 });
        }
        if (section === 'coinSkins') {
            Object.assign(newItem, { profitBoostPercent: 0, iconUrl: '', boxType: 'coin', chance: 10 });
        }
        localConfig[section].push(newItem);
        render();
    };
    
    const deleteItem = (e) => {
        const { section, index } = e.target.closest('button').dataset;
        if (confirm(t('confirm_delete'))) {
            localConfig[section].splice(index, 1);
            render();
        }
    };

    const handleDeletePlayer = async (e) => {
        const { id } = e.target.dataset;
        if (confirm(t('confirm_delete_player'))) {
            try {
                const response = await fetch(`/admin/api/player/${id}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Failed to delete player');
                allPlayers = allPlayers.filter(p => p.id !== id);
                render();
            } catch (err) { alert('Error deleting player.'); }
        }
    };

    const handleResetDaily = async (e) => {
        const button = e.target;
        const { id } = button.dataset;
        if (confirm(t('confirm_reset_daily'))) {
            button.disabled = true;
            try {
                const response = await fetch(`/admin/api/player/${id}/reset-daily`, { method: 'POST' });
                if (!response.ok) throw new Error(t('daily_progress_reset_error'));
                alert(t('daily_progress_reset_success'));
            } catch (err) {
                alert(err.message);
            } finally {
                button.disabled = false;
            }
        }
    };
    
    const handleDownloadConfig = (e) => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localConfig[activeTab] || [], null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${activeTab}_config_backup.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };
    
    const handleUploadConfig = (e) => {
        if (!confirm(t('confirm_upload'))) return;
        const input = document.getElementById('upload-config-input');
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const uploadedConfig = JSON.parse(e.target.result);
                        if (Array.isArray(uploadedConfig)) {
                            localConfig[activeTab] = uploadedConfig;
                            render();
                            alert('Config uploaded successfully! Press "Save All Changes" to apply.');
                        } else {
                            alert('Invalid file format. Expected a JSON array.');
                        }
                    } catch (err) {
                        alert('Error parsing JSON file.');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    };

    const handlePlayerRowClick = async (e) => {
        const row = e.target.closest('.player-row');
        if (!row) return;
        const playerId = row.dataset.id;
        const response = await fetchData(`/admin/api/player/${playerId}/details`);
        if (response) {
            renderPlayerDetailsModal(response);
        }
    };
    
    const renderPlayerDetailsModal = (player) => {
        modalsContainer.innerHTML = '';
        const modalEl = document.createElement('div');
        const allUpgrades = [...(localConfig.upgrades || []), ...(localConfig.blackMarketCards || [])];
        const upgradesList = Object.entries(player.upgrades || {}).map(([id, level]) => {
             const upg = allUpgrades.find(u => u.id === id);
             return `<li>${upg?.name?.[currentLang] || id}: <strong data-translate="level">${t('level')} ${level}</strong></li>`;
        }).join('');
        
        modalEl.innerHTML = `
            <div class="modal modal-blur fade show" id="player-details-modal" tabindex="-1" style="display: block;">
                <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" data-translate="player_details"></h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h3>${escapeHtml(player.name)} (${escapeHtml(player.id)})</h3>
                                    <p data-translate="current_balance"></p>
                                    <p class="h1">${formatNumber(player.balance)} 🪙</p>
                                    <form id="update-balance-form" data-id="${player.id}">
                                        <label class="form-label" data-translate="bonus_amount"></label>
                                        <div class="input-group">
                                            <input type="number" class="form-control" id="bonus-amount-input" required>
                                            <button type="submit" class="btn btn-primary" data-translate="add_bonus"></button>
                                        </div>
                                    </form>
                                </div>
                                <div class="col-md-6">
                                    <h4 data-translate="player_upgrades"></h4>
                                    <ul class="list-unstyled">${upgradesList || `<li class="text-secondary">${t('no_data')}</li>`}</ul>
                                </div>
                            </div>
                        </div>
                         <div class="modal-footer">
                            <button type="button" class="btn" data-bs-dismiss="modal" data-translate="close"></button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-backdrop fade show"></div>`;
        document.body.appendChild(modalEl);
        applyTranslations();
        
        const modalInstance = new bootstrap.Modal(modalEl.querySelector('.modal'));
        modalInstance.show();

        modalEl.querySelector('.btn-close').addEventListener('click', () => modalInstance.hide());
        modalEl.querySelector('[data-bs-dismiss="modal"]').addEventListener('click', () => modalInstance.hide());
        modalEl.querySelector('.modal').addEventListener('hidden.bs.modal', () => modalEl.remove());
        
        modalEl.querySelector('#update-balance-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const amount = parseFloat(form.querySelector('#bonus-amount-input').value);
            const playerId = form.dataset.id;
            if (isNaN(amount)) return;
            try {
                const res = await fetch(`/admin/api/player/${playerId}/update-balance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount })
                });
                if (!res.ok) throw new Error(t('error_updating_balance'));
                const updatedPlayer = await res.json();
                
                // Update local state and UI
                const playerIndex = allPlayers.findIndex(p => p.id === playerId);
                if (playerIndex !== -1) allPlayers[playerIndex].balance = updatedPlayer.balance;
                document.querySelector(`.player-row[data-id="${playerId}"] td:nth-child(3)`).textContent = formatNumber(updatedPlayer.balance);
                
                alert(t('balance_updated'));
                modalInstance.hide();
            } catch(err) {
                alert(err.message);
            }
        });
    };

    const handleSearch = (e) => {
        const query = e.target.value.toLowerCase().trim();
        const tableBody = document.getElementById('players-table-body');
        if (!tableBody) return;
        for (const row of tableBody.rows) {
            const id = row.dataset.id || '';
            const name = row.dataset.name || '';
            row.style.display = (id.includes(query) || name.includes(query)) ? '' : 'none';
        }
    };

    const addEventListeners = () => {
        tabContainer.querySelectorAll('input, select, textarea').forEach(input => input.addEventListener('input', handleFieldChange));
        tabContainer.querySelectorAll('.translate-btn').forEach(btn => btn.addEventListener('click', handleTranslate));
        tabContainer.querySelectorAll('.add-new-btn').forEach(btn => btn.addEventListener('click', addNewItem));
        tabContainer.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', deleteItem));
        tabContainer.querySelectorAll('.delete-player-btn').forEach(btn => btn.addEventListener('click', handleDeletePlayer));
        tabContainer.querySelectorAll('.reset-daily-btn').forEach(btn => btn.addEventListener('click', handleResetDaily));
        tabContainer.querySelectorAll('.player-row').forEach(row => row.addEventListener('click', handlePlayerRowClick));
        
        const searchInput = document.getElementById('player-search');
        if (searchInput) searchInput.addEventListener('input', handleSearch);
        
        const downloadBtn = document.getElementById('download-config-btn');
        if (downloadBtn) downloadBtn.addEventListener('click', handleDownloadConfig);
        
        const uploadBtn = document.getElementById('upload-config-btn');
        if (uploadBtn) uploadBtn.addEventListener('click', handleUploadConfig);
    };

    // --- INITIALIZATION ---
    const fetchData = async (url) => {
        const response = await fetch(url);
        if (response.status === 401) { window.location.href = '/admin/login.html'; return null; }
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    };
    
    const init = async () => {
        currentLang = localStorage.getItem('adminLang') || 'ru';
        applyTranslations();
        showLoading();
        
        try {
            [localConfig, allPlayers, dashboardStats, dailyEvent, playerLocations] = await Promise.all([
                fetchData('/admin/api/config'),
                fetchData('/admin/api/players'),
                fetchData('/admin/api/dashboard-stats'),
                fetchData('/admin/api/daily-events'),
                fetchData('/admin/api/player-locations')
            ]);
            
            dailyEvent = dailyEvent || { combo_ids: [], cipher_word: '', combo_reward: 5000000, cipher_reward: 1000000 };
            
            const urlParams = new URLSearchParams(window.location.hash.substring(1));
            activeTab = urlParams.get('tab') || 'dashboard';

            render();
        } catch (error) {
            console.error(error);
            tabContainer.innerHTML = `<div class="alert alert-danger" role="alert"><h4 class="alert-title">Critical Error</h4><div class="text-secondary">${error.message}</div></div>`;
        }
    };
    
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            activeTab = button.dataset.tab;
            window.location.hash = `tab=${activeTab}`;
            render();
        });
    });

     document.querySelectorAll('.lang-select-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            currentLang = button.dataset.lang;
            localStorage.setItem('adminLang', currentLang);
            render();
        });
    });
    
    saveMainButton.addEventListener('click', saveChanges);
    init();
});
