
document.addEventListener('DOMContentLoaded', () => {
    let localConfig = {};
    const tabContainer = document.getElementById('tab-content');
    const tabButtons = document.querySelectorAll('.tab-button');
    const saveMainButton = document.getElementById('save-main-button');
    let activeTab = 'special';

    const render = () => {
        tabContainer.innerHTML = '';
        switch (activeTab) {
            case 'special':
                tabContainer.innerHTML = createSectionHTML('specialTasks', localConfig.specialTasks);
                break;
            case 'upgrades':
                tabContainer.innerHTML = createSectionHTML('upgrades', localConfig.upgrades);
                break;
            case 'tasks':
                tabContainer.innerHTML = createSectionHTML('tasks', localConfig.tasks);
                break;
            case 'boosts':
                tabContainer.innerHTML = createSectionHTML('boosts', localConfig.boosts);
                break;
        }
        addEventListeners();
    };
    
    const createSectionHTML = (sectionKey, items) => {
        const itemHTML = items.map((item, index) => createItemHTML(sectionKey, item, index)).join('');
        return `
            <div class="space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar pr-2">${itemHTML}</div>
            <button data-section="${sectionKey}" class="add-new-btn w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg">
                Add New ${sectionKey.replace('Tasks', ' Task').replace('s', '')}
            </button>
        `;
    };

    const createLocalizedInput = (section, index, field, value, placeholder) => `
        <div class="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
            <div class="md:col-span-11 flex items-center">
                 <span class="bg-gray-500 p-2 rounded-l-md text-xs font-bold">EN</span>
                <input type="text" data-section="${section}" data-index="${index}" data-field="${field}.en" value="${value.en}" placeholder="${placeholder} (EN)" class="w-full bg-gray-600 p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <button data-section="${section}" data-index="${index}" data-field-type="${field}" class="translate-btn bg-blue-600 p-2 rounded-r-md">🈂️</button>
            </div>
            <div class="md:col-span-12 grid grid-cols-2 gap-2">
                 <input type="text" data-section="${section}" data-index="${index}" data-field="${field}.ua" value="${value.ua}" placeholder="${placeholder} (UA)" class="w-full bg-gray-600 p-2 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                 <input type="text" data-section="${section}" data-index="${index}" data-field="${field}.ru" value="${value.ru}" placeholder="${placeholder} (RU)" class="w-full bg-gray-600 p-2 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
        </div>`;
        
    const createLocalizedTextarea = (section, index, field, value, placeholder) => `
        <div class="flex items-center">
            <span class="bg-gray-500 p-2 rounded-l-md text-xs font-bold self-stretch flex items-center">EN</span>
            <textarea data-section="${section}" data-index="${index}" data-field="${field}.en" placeholder="${placeholder} (EN)" class="w-full bg-gray-600 p-2 text-white h-24 focus:outline-none focus:ring-2 focus:ring-blue-500">${value.en}</textarea>
            <button data-section="${section}" data-index="${index}" data-field-type="${field}" class="translate-btn bg-blue-600 p-2 rounded-r-md self-stretch flex items-center">🈂️</button>
        </div>
        <div class="grid grid-cols-2 gap-2">
           <textarea data-section="${section}" data-index="${index}" data-field="${field}.ua" placeholder="${placeholder} (UA)" class="w-full bg-gray-600 p-2 rounded text-white h-24 focus:outline-none focus:ring-2 focus:ring-blue-500">${value.ua}</textarea>
           <textarea data-section="${section}" data-index="${index}" data-field="${field}.ru" placeholder="${placeholder} (RU)" class="w-full bg-gray-600 p-2 rounded text-white h-24 focus:outline-none focus:ring-2 focus:ring-blue-500">${value.ru}</textarea>
        </div>`;

    const createItemHTML = (sectionKey, item, index) => {
        let fieldsHTML = '';
        const baseInput = (type, field, placeholder) => `<input type="${type}" data-section="${sectionKey}" data-index="${index}" data-field="${field}" value="${item[field]}" placeholder="${placeholder}" class="w-full bg-gray-600 p-2 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500">`;
        
        fieldsHTML += createLocalizedInput(sectionKey, index, 'name', item.name, 'Name');
        
        if ('description' in item) {
             fieldsHTML += createLocalizedTextarea(sectionKey, index, 'description', item.description, 'Description');
        }
        if ('price' in item) {
            fieldsHTML += baseInput('number', 'price', 'Price');
        }
        if ('profitPerHour' in item) {
            fieldsHTML += baseInput('number', 'profitPerHour', 'Profit Per Hour');
        }
        if ('category' in item) {
             fieldsHTML += `
                <select data-section="${sectionKey}" data-index="${index}" data-field="category" value="${item.category}" class="w-full bg-gray-600 p-2 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Documents</option><option>Legal</option><option>Lifestyle</option><option>Special</option>
                </select>`;
        }
        if ('icon' in item) {
            fieldsHTML += baseInput('text', 'icon', 'Icon (e.g., 🚀)');
        }
        if ('requiredTaps' in item) {
            fieldsHTML += baseInput('number', 'requiredTaps', 'Required Taps');
        }
        if ('rewardCoins' in item) {
            fieldsHTML += baseInput('number', 'rewardCoins', 'Reward Coins');
        }
        if ('rewardStars' in item) {
            fieldsHTML += baseInput('number', 'rewardStars', 'Reward Stars');
        }
        if ('cost' in item) {
            fieldsHTML += baseInput('number', 'cost', 'Cost (in Stars)');
        }
        if ('type' in item) {
             fieldsHTML += `
                <select data-section="${sectionKey}" data-index="${index}" data-field="type" value="${item.type}" class="w-full bg-gray-600 p-2 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="telegram_join">Join Telegram</option><option value="social_follow">Follow Social Media</option><option value="video_watch">Watch Video</option>
                </select>`;
        }
        if ('url' in item) {
            fieldsHTML += baseInput('text', 'url', 'URL');
        }
        if ('priceStars' in item) {
            fieldsHTML += baseInput('number', 'priceStars', 'Price (in Stars)');
        }

        return `
            <div class="bg-gray-700 p-4 rounded-lg space-y-3">
                <div class="flex justify-between items-center">
                     <p class="text-xs text-gray-400">ID: ${item.id}</p>
                     <button data-section="${sectionKey}" data-index="${index}" class="delete-btn text-red-500 hover:text-red-400 font-bold">Delete</button>
                </div>
                ${fieldsHTML}
            </div>
        `;
    };

    const handleFieldChange = (e) => {
        const { section, index, field } = e.target.dataset;
        const value = e.target.type === 'number' ? parseInt(e.target.value, 10) || 0 : e.target.value;
        const keys = field.split('.');
        
        let newItems = [...localConfig[section]];
        if (keys.length > 1) { // Nested object like name.en
            newItems[index] = { ...newItems[index], [keys[0]]: { ...newItems[index][keys[0]], [keys[1]]: value } };
        } else {
            newItems[index] = { ...newItems[index], [field]: value };
        }
        localConfig = { ...localConfig, [section]: newItems };
    };
    
    const handleTranslate = async (e) => {
        const button = e.target.closest('button');
        button.disabled = true;
        button.textContent = '...';
        const { section, index, fieldType } = button.dataset;
        const item = localConfig[section][index];
        const textObject = item[fieldType];
        
        const fromLang = (Object.keys(textObject)).find(lang => textObject[lang]?.length > 0);
        if (!fromLang) {
            alert('Please enter text in at least one language field to translate from.');
            button.disabled = false;
            button.textContent = '🈂️';
            return;
        }
        const sourceText = textObject[fromLang];
        
        const toTranslateLangs = ['en', 'ua', 'ru'].filter(l => l !== fromLang);
        for (const toLang of toTranslateLangs) {
             try {
                const response = await fetch('/admin/api/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: sourceText, from: fromLang, to: toLang }),
                });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                
                // Update state and re-render
                const fieldPath = `${fieldType}.${toLang}`;
                const keys = fieldPath.split('.');
                let newItems = [...localConfig[section]];
                newItems[index] = { ...newItems[index], [keys[0]]: { ...newItems[index][keys[0]], [keys[1]]: data.translatedText } };
                localConfig = { ...localConfig, [section]: newItems };

            } catch (error) {
                console.error(`Error translating to ${toLang}:`, error);
                alert(`Failed to translate to ${toLang}.`);
            }
        }
        render(); // Re-render the whole form to show new values
        button.disabled = false;
        button.textContent = '🈂️';
    };
    
    const saveChanges = async () => {
        saveMainButton.disabled = true;
        saveMainButton.textContent = 'Saving...';
        try {
            const response = await fetch('/admin/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: localConfig }),
            });
            if (!response.ok) throw new Error('Failed to save config');
            alert('Configuration saved successfully!');
        } catch (error) {
            console.error(error);
            alert('Error saving configuration.');
        } finally {
            saveMainButton.disabled = false;
            saveMainButton.textContent = 'Save All Changes';
        }
    };
    
    const addNewItem = (e) => {
        const section = e.target.dataset.section;
        let newItem = {};
        const id = `${section.slice(0, 4)}_${Date.now()}`;
        const base = { id, name: { en: '', ua: '', ru: '' } };

        switch (section) {
            case 'upgrades':
                newItem = { ...base, price: 100, profitPerHour: 10, category: 'Documents', icon: '🆕' };
                break;
            case 'tasks':
                newItem = { ...base, rewardCoins: 1000, rewardStars: 5, requiredTaps: 500 };
                break;
            case 'boosts':
                newItem = { ...base, description: { en: '', ua: '', ru: '' }, cost: 10, icon: '🆕' };
                break;
            case 'specialTasks':
                newItem = { ...base, description: { en: '', ua: '', ru: '' }, type: 'telegram_join', url: 'https://t.me/', rewardCoins: 10000, rewardStars: 10, priceStars: 0, isOneTime: true };
                break;
        }
        localConfig[section].push(newItem);
        render();
    };
    
    const deleteItem = (e) => {
        const { section, index } = e.target.dataset;
        if (confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
            localConfig[section].splice(index, 1);
            render();
        }
    };

    const addEventListeners = () => {
        document.querySelectorAll('input, select, textarea').forEach(input => {
            input.addEventListener('change', handleFieldChange);
        });
        document.querySelectorAll('.translate-btn').forEach(btn => {
            btn.addEventListener('click', handleTranslate);
        });
        document.querySelectorAll('.add-new-btn').forEach(btn => {
            btn.addEventListener('click', addNewItem);
        });
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', deleteItem);
        });
    };

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            activeTab = tabName;
            tabButtons.forEach(btn => {
                if (btn.dataset.tab === tabName) {
                    btn.classList.add('bg-gray-800', 'text-white');
                    btn.classList.remove('bg-gray-900', 'text-gray-400');
                } else {
                    btn.classList.remove('bg-gray-800', 'text-white');
                    btn.classList.add('bg-gray-900', 'text-gray-400');
                }
            });
            render();
        });
    });

    const init = async () => {
        try {
            const response = await fetch('/admin/api/config');
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                     window.location.href = '/admin/login.html';
                }
                throw new Error('Could not fetch config');
            }
            localConfig = await response.json();
            render();
        } catch (error) {
            console.error('Initialization error:', error);
            tabContainer.innerHTML = `<p class="text-red-500">Error loading configuration. Please try refreshing the page.</p>`;
        }
    };
    
    saveMainButton.addEventListener('click', saveChanges);
    init();
});
