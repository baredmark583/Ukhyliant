document.addEventListener('DOMContentLoaded', () => {
    let localConfig = {};
    let allPlayers = [];
    let dashboardStats = {};
    let dailyEvent = { combo_ids: [], cipher_word: '', combo_reward: 5000000, cipher_reward: 1000000 };
    let activeTab = 'dashboard';

    const tabContainer = document.getElementById('tab-content-container');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabTitle = document.getElementById('tab-title');
    const saveMainButton = document.getElementById('save-main-button');

    const escapeHtml = (unsafe) => {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    };

    const formatNumber = (num) => {
        if (num === null || num === undefined) return '0';
        return Number(num).toLocaleString('ru-RU');
    };

    const render = () => {
        tabContainer.innerHTML = '';
        tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === activeTab));
        
        const currentButton = document.querySelector(`.tab-button[data-tab="${activeTab}"]`);
        tabTitle.textContent = currentButton ? currentButton.textContent : 'Дашборд';

        saveMainButton.style.display = ['dashboard', 'players'].includes(activeTab) ? 'none' : 'inline-block';

        switch (activeTab) {
            case 'dashboard': renderDashboard(); break;
            case 'players': renderPlayersTab(); break;
            case 'dailyEvents': renderDailyEvents(); break;
            case 'special': renderConfigTable('specialTasks'); break;
            case 'upgrades': renderConfigTable('upgrades'); break;
            case 'tasks': renderConfigTable('tasks'); break;
            case 'boosts': renderConfigTable('boosts'); break;
        }
        addEventListeners();
    };
    
    // --- RENDER FUNCTIONS ---
    const renderDashboard = () => {
        tabContainer.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="bg-gray-700/50 p-6 rounded-lg shadow-lg">
                    <h3 class="text-gray-400 text-sm font-bold uppercase tracking-wider">Всего игроков</h3>
                    <p class="text-4xl font-bold mt-2 text-white">${formatNumber(dashboardStats.totalPlayers)}</p>
                </div>
                <div class="bg-gray-700/50 p-6 rounded-lg shadow-lg">
                    <h3 class="text-gray-400 text-sm font-bold uppercase tracking-wider">Новых за 24ч</h3>
                    <p class="text-4xl font-bold mt-2 text-white">${formatNumber(dashboardStats.newPlayersToday)}</p>
                </div>
                <div class="bg-gray-700/50 p-6 rounded-lg shadow-lg col-span-1 md:col-span-2">
                    <h3 class="text-gray-400 text-sm font-bold uppercase tracking-wider">Всего монет в игре</h3>
                    <p class="text-4xl font-bold mt-2 text-green-400">${formatNumber(dashboardStats.totalCoins)}</p>
                </div>
            </div>
            <div class="mt-8">
                <h3 class="text-xl font-bold mb-4 text-white">Топ-5 Популярных Улучшений</h3>
                <div class="bg-gray-700/50 rounded-lg p-4">
                    <ul class="space-y-3">
                        ${(dashboardStats.popularUpgrades || []).map(upg => {
                            const upgradeDetails = localConfig.upgrades?.find(u => u.id === upg.upgrade_id);
                            const iconHtml = upgradeDetails?.iconUrl ? `<img src="${upgradeDetails.iconUrl}" alt="" class="w-6 h-6 inline-block mr-2" />` : '❓';
                            return `<li class="flex justify-between items-center text-gray-300 hover:bg-gray-600/50 p-2 rounded-md transition-colors">
                                <span class="flex items-center">${iconHtml} ${upgradeDetails?.name?.ru || upgradeDetails?.name?.en || upg.upgrade_id}</span>
                                <span class="font-bold text-white">${formatNumber(upg.purchase_count)} покупок</span>
                            </li>`;
                        }).join('') || '<p class="text-gray-400">Нет данных</p>'}
                    </ul>
                </div>
            </div>`;
    };

    const renderDailyEvents = () => {
        tabContainer.innerHTML = `
            <div>
                <h2 class="text-2xl font-bold mb-6 text-white">Настройка событий дня</h2>
                <div class="space-y-8">
                    <div class="bg-gray-700/50 p-6 rounded-lg shadow-lg">
                        <h3 class="text-xl font-semibold mb-3 text-white">Ежедневное Комбо</h3>
                        <p class="text-sm text-gray-400 mb-4">Выберите 3 уникальных улучшения для комбо. Игроки, купившие все три, получат награду.</p>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            ${[0, 1, 2].map(i => `
                                <select data-event="combo" data-index="${i}" class="w-full bg-gray-600 p-3 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow">
                                    <option value="">-- Выберите карту ${i + 1} --</option>
                                    ${localConfig.upgrades?.map(u => `<option value="${u.id}" ${dailyEvent.combo_ids?.[i] === u.id ? 'selected' : ''}>${u.name.ru || u.name.en}</option>`).join('')}
                                </select>
                            `).join('')}
                        </div>
                         <div>
                            <label for="combo-reward-input" class="block text-sm font-medium text-gray-300 mb-1">Награда за Комбо</label>
                            <input type="number" id="combo-reward-input" value="${dailyEvent.combo_reward || '5000000'}" class="w-full max-w-xs bg-gray-600 p-3 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="5000000">
                        </div>
                    </div>
                    <div class="bg-gray-700/50 p-6 rounded-lg shadow-lg">
                        <h3 class="text-xl font-semibold mb-3 text-white">Ежедневный Шифр</h3>
                        <p class="text-sm text-gray-400 mb-4">Введите слово для шифра Морзе (только латинские буквы, без пробелов, в верхнем регистре).</p>
                        <div class="mb-4">
                            <label for="cipher-word-input" class="block text-sm font-medium text-gray-300 mb-1">Слово для шифра</label>
                            <input type="text" id="cipher-word-input" value="${dailyEvent.cipher_word || ''}" class="w-full max-w-sm bg-gray-600 p-3 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest" placeholder="например, BTC">
                        </div>
                        <div>
                            <label for="cipher-reward-input" class="block text-sm font-medium text-gray-300 mb-1">Награда за Шифр</label>
                            <input type="number" id="cipher-reward-input" value="${dailyEvent.cipher_reward || '1000000'}" class="w-full max-w-xs bg-gray-600 p-3 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="1000000">
                        </div>
                    </div>
                </div>
            </div>`;
    };

    const renderPlayersTab = (filteredPlayers) => {
        const playersToRender = filteredPlayers || allPlayers;
        tabContainer.innerHTML = `
            <div class="mb-4">
                <input type="text" id="player-search" class="w-full max-w-lg bg-gray-700 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Поиск по ID или имени...">
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-gray-700/50 rounded-lg">
                    <thead>
                        <tr class="text-left text-xs text-gray-400 uppercase tracking-wider">
                            <th class="p-3">ID</th>
                            <th class="p-3">Имя</th>
                            <th class="p-3">Баланс</th>
                            <th class="p-3">Рефералы</th>
                            <th class="p-3">Язык</th>
                            <th class="p-3">Действия</th>
                        </tr>
                    </thead>
                    <tbody class="text-sm">
                        ${playersToRender.map(p => `
                            <tr class="border-t border-gray-700 hover:bg-gray-600/50 transition-colors">
                                <td class="p-3 font-mono">${escapeHtml(p.id)}</td>
                                <td class="p-3 text-white">${escapeHtml(p.name)}</td>
                                <td class="p-3 font-mono">${formatNumber(p.balance)}</td>
                                <td class="p-3 font-mono">${formatNumber(p.referrals)}</td>
                                <td class="p-3 uppercase">${escapeHtml(p.language)}</td>
                                <td class="p-3 whitespace-nowrap space-x-2">
                                    <button data-id="${p.id}" class="reset-daily-btn text-blue-400 hover:text-blue-300 text-xs font-bold px-2 py-1 bg-blue-900/50 rounded-md">Сброс дня</button>
                                    <button data-id="${p.id}" class="delete-player-btn text-red-500 hover:text-red-400 text-xs font-bold px-2 py-1 bg-red-900/50 rounded-md">Удалить</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    };
    
    const createLocalizedInputGroup = (section, index, field, value) => {
        return `
        <div class="col-span-full md:col-span-2">
            <div class="relative">
                <div class="absolute -top-2 left-2 bg-gray-700 px-1 text-xs text-gray-400">${field}</div>
                <div class="grid grid-cols-4 gap-2 border border-gray-600 rounded-lg p-2 pt-4">
                    <input type="text" data-section="${section}" data-index="${index}" data-lang="en" data-field="${field}" value="${escapeHtml(value.en)}" class="col-span-1 bg-gray-600 p-1 rounded placeholder-gray-500" placeholder="EN">
                    <input type="text" data-section="${section}" data-index="${index}" data-lang="ua" data-field="${field}" value="${escapeHtml(value.ua)}" class="col-span-1 bg-gray-600 p-1 rounded placeholder-gray-500" placeholder="UA">
                    <input type="text" data-section="${section}" data-index="${index}" data-lang="ru" data-field="${field}" value="${escapeHtml(value.ru)}" class="col-span-1 bg-gray-600 p-1 rounded placeholder-gray-500" placeholder="RU">
                    <button class="translate-btn col-span-1 bg-blue-600 hover:bg-blue-500 rounded text-xs" data-section="${section}" data-index="${index}" data-field="${field}">🈂️ AI</button>
                </div>
            </div>
        </div>
        `;
    };

    const createInput = (section, index, field, type = 'text', hidden = false, placeholder = '') => {
        const item = localConfig[section][index];
        const value = item ? (item[field] ?? '') : '';
        return `<div class="col-span-1 ${hidden ? 'hidden' : ''}" id="field-container-${section}-${index}-${field}"><label class="block text-xs text-gray-400 mb-1 capitalize">${field.replace(/([A-Z])/g, ' $1')}</label><input type="${type}" data-section="${section}" data-index="${index}" data-field="${field}" value="${escapeHtml(value)}" class="w-full bg-gray-600 p-2 rounded" placeholder="${placeholder}"></div>`;
    };

    const createSelect = (section, index, field, options, hidden = false) => {
         const item = localConfig[section][index];
         const value = item ? item[field] : '';
         return `<div class="col-span-1 ${hidden ? 'hidden' : ''}" id="field-container-${section}-${index}-${field}"><label class="block text-xs text-gray-400 mb-1 capitalize">${field}</label><select data-section="${section}" data-index="${index}" data-field="${field}" class="w-full bg-gray-600 p-2 rounded">${options.map(o => `<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
    };

    const createRewardInput = (section, index, reward) => {
        const safeReward = reward || { type: 'coins', amount: 0 };
        return `
        <div class="col-span-2">
            <label class="block text-xs text-gray-400 mb-1">Награда</label>
            <div class="flex items-center space-x-2">
                <select data-section="${section}" data-index="${index}" data-field="reward.type" class="w-1/3 bg-gray-600 p-2 rounded">
                    <option value="coins" ${safeReward.type === 'coins' ? 'selected' : ''}>Монеты 🪙</option>
                    <option value="profit" ${safeReward.type === 'profit' ? 'selected' : ''}>Прибыль ⚡</option>
                </select>
                <input type="number" data-section="${section}" data-index="${index}" data-field="reward.amount" value="${safeReward.amount}" class="w-2/3 bg-gray-600 p-2 rounded">
            </div>
        </div>`;
    };

    const renderConfigTable = (sectionKey) => {
        const items = localConfig[sectionKey] || [];
        const isTask = sectionKey === 'tasks' || sectionKey === 'specialTasks';

        let tableHTML = `<div class="space-y-4">
            ${items.map((item, index) => {
                let fieldsHTML = '<div class="grid grid-cols-1 md:grid-cols-4 gap-4">';
                
                // Common fields for all types
                fieldsHTML += `<div class="col-span-1"><label class="block text-xs text-gray-400 mb-1">ID</label><input type="text" value="${escapeHtml(item.id)}" class="w-full bg-gray-500 p-2 rounded" readonly></div>`;
                if (item.name) fieldsHTML += createLocalizedInputGroup(sectionKey, index, 'name', item.name);
                if (item.description) fieldsHTML += createLocalizedInputGroup(sectionKey, index, 'description', item.description);

                // Specific fields based on section
                if (sectionKey === 'upgrades') {
                    fieldsHTML += createInput(sectionKey, index, 'price', 'number');
                    fieldsHTML += createInput(sectionKey, index, 'profitPerHour', 'number');
                    fieldsHTML += createSelect(sectionKey, index, 'category', ['Documents', 'Legal', 'Lifestyle', 'Special']);
                    fieldsHTML += createInput(sectionKey, index, 'iconUrl', 'text', false, 'https://.../img.svg');
                } else if (sectionKey === 'boosts') {
                    fieldsHTML += createInput(sectionKey, index, 'costCoins', 'number');
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
                }

                fieldsHTML += `<div class="col-span-full flex justify-end"><button data-section="${sectionKey}" data-index="${index}" class="delete-btn bg-red-800/80 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Удалить</button></div>`;
                fieldsHTML += '</div>';
                return `<div class="bg-gray-700/50 p-4 rounded-lg">${fieldsHTML}</div>`;
            }).join('')}
            <button class="add-new-btn bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg" data-section="${sectionKey}">Добавить</button>
            </div>`;
        tabContainer.innerHTML = tableHTML;
    };
    
    // --- EVENT HANDLERS ---
    const handleFieldChange = (e) => {
        const { section, index, field } = e.target.dataset;
        if (!section || !index || !field) return;

        const value = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
        
        // Handle nested fields like reward.type
        if (field.includes('.')) {
            const [parent, child] = field.split('.');
            if (!localConfig[section][index][parent]) {
                localConfig[section][index][parent] = {}; // Ensure parent object exists
            }
            localConfig[section][index][parent][child] = value;
        } else if (e.target.dataset.lang) {
            localConfig[section][index][field][e.target.dataset.lang] = value;
        } else {
            localConfig[section][index][field] = value;
        }

        // Dynamic UI update for task types
        if (field === 'type' && (section === 'tasks' || section === 'specialTasks')) {
            const item = localConfig[section][index];
            const type = item.type;
            document.getElementById(`field-container-${section}-${index}-url`).classList.toggle('hidden', type === 'taps');
            document.getElementById(`field-container-${section}-${index}-requiredTaps`).classList.toggle('hidden', type !== 'taps');
            document.getElementById(`field-container-${section}-${index}-secretCode`).classList.toggle('hidden', type !== 'video_code');
        }
    };
    
    const handleTranslate = async (e) => {
        const button = e.target;
        const { section, index, field } = button.dataset;
        const group = button.closest('.grid');
        const enInput = group.querySelector(`[data-lang="en"]`);
        const uaInput = group.querySelector(`[data-lang="ua"]`);
        const ruInput = group.querySelector(`[data-lang="ru"]`);
        const sourceInput = ruInput.value ? ruInput : (uaInput.value ? uaInput : enInput);
        if (!sourceInput.value) {
            alert('Введите текст хотя бы на одном языке для перевода.');
            return;
        }
        button.disabled = true; button.textContent = '...';
        try {
            for (const targetInput of [enInput, uaInput, ruInput]) {
                if (targetInput !== sourceInput && !targetInput.value) {
                     const fromLang = sourceInput.dataset.lang;
                     const toLang = targetInput.dataset.lang;
                     const response = await fetch('/admin/api/translate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: sourceInput.value, from: fromLang, to: toLang }),
                     });
                     const data = await response.json();
                     if (response.ok) {
                        targetInput.value = data.translatedText;
                        localConfig[section][index][field][toLang] = data.translatedText;
                     } else {
                        throw new Error(data.error || 'Ошибка перевода');
                     }
                }
            }
        } catch(err) {
            alert(err.message);
        } finally {
            button.disabled = false; button.textContent = '🈂️ AI';
        }
    };
    
    const saveChanges = async () => {
        saveMainButton.disabled = true;
        saveMainButton.textContent = 'Сохранение...';
        try {
            if (activeTab === 'dailyEvents') {
                const comboSelects = document.querySelectorAll('[data-event="combo"]');
                const comboIds = Array.from(comboSelects).map(sel => sel.value).filter(Boolean);
                const cipherWord = document.getElementById('cipher-word-input').value.toUpperCase().trim();
                const comboReward = document.getElementById('combo-reward-input').value;
                const cipherReward = document.getElementById('cipher-reward-input').value;

                const uniqueComboIds = [...new Set(comboIds)];
                if (comboIds.length > 0 && uniqueComboIds.length !== 3) {
                    alert('Для комбо необходимо выбрать ровно 3 УНИКАЛЬНЫХ карты.');
                    return;
                }
                
                await fetch('/admin/api/daily-events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ comboIds: uniqueComboIds, cipherWord, comboReward, cipherReward }),
                });
            }

            const configResponse = await fetch('/admin/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: localConfig }),
            });
            if (!configResponse.ok) throw new Error('Failed to save config');
            
            alert('Конфигурация успешно сохранена!');
            
        } catch (error) {
            console.error(error);
            alert('Ошибка сохранения.');
        } finally {
            saveMainButton.disabled = false;
            saveMainButton.textContent = 'Сохранить все изменения';
        }
    };
    
    const addNewItem = (e) => {
        const { section } = e.target.dataset;
        const newItem = JSON.parse(JSON.stringify(localConfig[section][0] || {}));
        
        // Create a default structure if the section is empty
        if (Object.keys(newItem).length === 0) {
            newItem.id = `${section.slice(0, 4)}_${Date.now()}`;
            newItem.name = { en: '', ua: '', ru: '' };
            if (section === 'tasks' || section === 'specialTasks') {
                newItem.type = 'taps';
                newItem.reward = { type: 'coins', amount: 0 };
                newItem.imageUrl = '';
                newItem.url = '';
                newItem.requiredTaps = 0;
                newItem.secretCode = '';
            }
             if (section === 'specialTasks') {
                 newItem.description = { en: '', ua: '', ru: '' };
                 newItem.priceStars = 0;
                 newItem.isOneTime = true;
             }
        } else {
            Object.keys(newItem).forEach(key => {
                if (key === 'id') newItem[key] = `${section.slice(0, 4)}_${Date.now()}`;
                else if (key === 'reward') newItem[key] = { type: 'coins', amount: 0 };
                else if (typeof newItem[key] === 'object' && newItem[key] !== null && !Array.isArray(newItem[key])) {
                    Object.keys(newItem[key]).forEach(subKey => newItem[key][subKey] = '');
                } else if (typeof newItem[key] === 'number') newItem[key] = 0;
                else if (typeof newItem[key] === 'string') newItem[key] = '';
            });
        }

        localConfig[section].push(newItem);
        render();
    };
    
    const deleteItem = (e) => {
        const { section, index } = e.target.dataset;
        if (confirm('Вы уверены, что хотите удалить этот элемент?')) {
            localConfig[section].splice(index, 1);
            render();
        }
    };

    const handleDeletePlayer = async (e) => {
        const { id } = e.target.dataset;
        if (confirm(`Вы уверены, что хотите удалить игрока с ID: ${id}? Это действие необратимо.`)) {
            try {
                const response = await fetch(`/admin/api/player/${id}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Failed to delete player');
                allPlayers = allPlayers.filter(p => p.id !== id);
                render();
            } catch (err) {
                alert('Ошибка при удалении игрока.');
            }
        }
    };

    const handleResetDaily = async (e) => {
        const button = e.target;
        const { id } = button.dataset;
        if (confirm(`Вы уверены, что хотите сбросить ежедневный прогресс (комбо/шифр) для игрока ${id}?`)) {
            button.disabled = true;
            button.textContent = '...';
            try {
                const response = await fetch(`/admin/api/player/${id}/reset-daily`, { method: 'POST' });
                if (!response.ok) throw new Error('Failed to reset daily progress');
                const data = await response.json();
                alert(data.message || 'Прогресс сброшен!');
            } catch (err) {
                alert('Ошибка при сбросе прогресса.');
                console.error(err);
            } finally {
                button.disabled = false;
                button.textContent = 'Сброс дня';
            }
        }
    };

    const handleSearch = (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allPlayers.filter(p => p.id.includes(query) || p.name.toLowerCase().includes(query));
        renderPlayersTab(filtered);
    };

    const addEventListeners = () => {
        tabContainer.querySelectorAll('input, select, textarea').forEach(input => input.addEventListener('input', handleFieldChange));
        tabContainer.querySelectorAll('.translate-btn').forEach(btn => btn.addEventListener('click', handleTranslate));
        tabContainer.querySelectorAll('.add-new-btn').forEach(btn => btn.addEventListener('click', addNewItem));
        tabContainer.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', deleteItem));
        tabContainer.querySelectorAll('.delete-player-btn').forEach(btn => btn.addEventListener('click', handleDeletePlayer));
        tabContainer.querySelectorAll('.reset-daily-btn').forEach(btn => btn.addEventListener('click', handleResetDaily));
        const searchInput = document.getElementById('player-search');
        if (searchInput) searchInput.addEventListener('input', handleSearch);
    };

    const fetchData = async (url, errorMessage) => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                 if (response.status === 401) { window.location.href = '/admin/login.html'; return null; }
                 throw new Error(errorMessage || `HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(error);
            alert(errorMessage || 'Ошибка загрузки данных.');
            throw error;
        }
    };
    
    const init = async () => {
        try {
            tabContainer.innerHTML = `<div class="flex items-center justify-center h-full"><p class="text-gray-500 animate-pulse">Загрузка данных...</p></div>`;
            const data = await Promise.all([
                fetchData('/admin/api/config', 'Не удалось загрузить конфигурацию.'),
                fetchData('/admin/api/players', 'Не удалось загрузить список игроков.'),
                fetchData('/admin/api/dashboard-stats', 'Не удалось загрузить статистику.'),
                fetchData('/admin/api/daily-events', 'Не удалось загрузить события дня.')
            ]);
            
            if (data.some(d => d === null)) return; // Stop if any fetch failed due to auth

            [localConfig, allPlayers, dashboardStats, dailyEvent] = data;
            
            dailyEvent = dailyEvent || { combo_ids: [], cipher_word: '', combo_reward: 5000000, cipher_reward: 1000000 };
            dailyEvent.combo_ids = dailyEvent.combo_ids || [];
            dailyEvent.combo_reward = dailyEvent.combo_reward || 5000000;
            dailyEvent.cipher_reward = dailyEvent.cipher_reward || 1000000;

            render();
        } catch (error) {
            tabContainer.innerHTML = `<div class="bg-red-900/50 border border-red-700 p-4 rounded-lg"><p class="text-red-300 font-bold">Критическая ошибка загрузки.</p><p class="text-red-400 text-sm mt-2">${error.message}. Попробуйте обновить страницу.</p></div>`;
        }
    };
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            activeTab = button.dataset.tab;
            render();
        });
    });
    
    saveMainButton.addEventListener('click', saveChanges);
    init();
});