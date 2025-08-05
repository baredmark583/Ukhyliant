
// This file makes the backend self-contained by providing initial data.
// It prevents the server from trying to import files from the frontend.

// --- ROLE MANAGEMENT ---
export const ADMIN_TELEGRAM_ID = '7327258482'; 
export const MODERATOR_TELEGRAM_IDS = ['987654321'];


export const INITIAL_UPGRADES = [
    { id: 'doc1', name: { en: 'Student ID', ua: 'Студентський квиток', ru: 'Студенческий билет' }, price: 100, profitPerHour: 10, category: 'Documents', icon: '🎓' },
    { id: 'doc2', name: { en: 'Disability Certificate', ua: 'Довідка про інвалідність', ru: 'Справка об инвалидности' }, price: 1500, profitPerHour: 80, category: 'Documents', icon: '♿' },
    { id: 'doc3', name: { en: 'White Ticket', ua: 'Білий квиток', ru: 'Белый билет' }, price: 10000, profitPerHour: 500, category: 'Documents', icon: '📄' },
    { id: 'leg1', name: { en: 'Lawyer Consultation', ua: 'Консультація адвоката', ru: 'Консультация адвоката' }, price: 500, profitPerHour: 25, category: 'Legal', icon: '⚖️' },
    { id: 'leg2', name: { en: 'Open a Fake Company', ua: 'Відкрити фіктивну фірму', ru: 'Открыть фиктивную фирму' }, price: 5000, profitPerHour: 200, category: 'Legal', icon: '🏢' },
    { id: 'life1', name: { en: 'Hide in the Village', ua: 'Сховатись в селі', ru: 'Спрятаться в деревне' }, price: 2000, profitPerHour: 100, category: 'Lifestyle', icon: '🛖' },
    { id: 'life2', name: { en: 'Rent a Bunker', ua: 'Орендувати бункер', ru: 'Арендовать бункер' }, price: 25000, profitPerHour: 1100, category: 'Lifestyle', icon: '🔒' },
    { id: 'spec1', name: { en: 'Border Crossing', ua: 'Перетин кордону', ru: 'Пересечение границы' }, price: 100000, profitPerHour: 4000, category: 'Special', icon: '🗺️' },
    { id: 'spec2', name: { en: 'New Identity', ua: 'Нова особистість', ru: 'Новая личность' }, price: 500000, profitPerHour: 20000, category: 'Special', icon: '🎭' },
];

export const INITIAL_TASKS = [
    { id: 'task1', name: { en: 'Tap 500 times', ua: 'Натисни 500 разів', ru: 'Нажми 500 раз' }, type: 'taps', reward: { type: 'coins', amount: 1000 }, requiredTaps: 500, imageUrl: '', url: '', secretCode: '' },
    { id: 'task2', name: { en: 'Daily Check-in', ua: 'Щоденний візит', ru: 'Ежедневный визит' }, type: 'taps', reward: { type: 'coins', amount: 500 }, requiredTaps: 1, imageUrl: '', url: '', secretCode: '' },
    { id: 'task3', name: { en: 'Join Telegram', ua: 'Підпишись на Telegram', ru: 'Подпишись на Telegram' }, type: 'telegram_join', reward: { type: 'profit', amount: 100 }, url: 'https://t.me/durov', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg', requiredTaps: 0, secretCode: '' }
];

export const INITIAL_SPECIAL_TASKS = [
    { id: 'special1', name: { en: 'Join Our Channel', ua: 'Приєднайся до каналу', ru: 'Присоединись к каналу' }, description: { en: 'Get a huge bonus!', ua: 'Отримай великий бонус!', ru: 'Получи большой бонус!' }, type: 'telegram_join', url: 'https://t.me/durov', reward: { type: 'coins', amount: 100000 }, priceStars: 5, isOneTime: true, imageUrl: '', secretCode: '' },
    { id: 'special2', name: { en: 'Watch Review', ua: 'Подивись огляд', ru: 'Посмотри обзор' }, description: { en: 'Watch a video review.', ua: 'Подивись відео-огляд.', ru: 'Посмотри видео-обзор.'}, type: 'video_watch', url: 'https://youtube.com', reward: { type: 'coins', amount: 50000 }, priceStars: 0, isOneTime: true, imageUrl: '', secretCode: '' },
];

export const INITIAL_BOOSTS = [
    { id: 'boost1', name: { en: 'Full Energy', ua: 'Повна енергія', ru: 'Полная энергия' }, description: { en: 'Instantly refill your energy.', ua: 'Миттєво відновити енергію.', ru: 'Мгновенно восстановить энергию.' }, icon: '⚡', costCoins: 5000 },
    { id: 'boost2', name: { en: 'Turbo Taps (30s)', ua: 'Турбо-тапи (30с)', ru: 'Турбо-тапы (30с)' }, description: { en: 'Multiply coins per tap for 30 seconds.', ua: 'Помножити монети за тап на 30 секунд.', ru: 'Умножить монеты за тап на 30 секунд.' }, icon: '🔥', costCoins: 10000 },
];

export const REFERRAL_BONUS = 5000;
export const MAX_ENERGY = 1000;
export const ENERGY_REGEN_RATE = 2; // per second