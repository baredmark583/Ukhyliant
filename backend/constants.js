// This file makes the backend self-contained by providing initial data.
// It prevents the server from trying to import files from the frontend.

// --- ROLE MANAGEMENT ---
export const ADMIN_TELEGRAM_ID = '7327258482'; 
export const MODERATOR_TELEGRAM_IDS = ['987654321'];

// --- LEAGUES (Backend Safe) ---
export const INITIAL_LEAGUES = [
  { id: 'league4', name: { en: 'European Baron', ua: 'Європейський Барон', ru: 'Европейский Барон' }, description: { en: 'You are on top of the world!', ua: 'Ви на вершині світу!', ru: 'Вы на вершине мира!' }, minProfitPerHour: 100000, iconUrl: 'https://api.iconify.design/twemoji/crown.svg' },
  { id: 'league3', name: { en: 'Across the Tisza', ua: 'Переплив Тису', ru: 'Переплыл Тиссу' }, description: { en: 'You have successfully escaped.', ua: 'Ви успішно втекли.', ru: 'Вы успешно сбежали.' }, minProfitPerHour: 10000, iconUrl: 'https://api.iconify.design/twemoji/european-castle.svg' },
  { id: 'league2', name: { en: 'Grandma\'s Village', ua: 'В селі у бабці', ru: 'В деревне у бабушки' }, description: { en: 'Hiding out, away from the city.', ua: 'Ховаєтесь, подалі від міста.', ru: 'Прячетесь, подальше от города.' }, minProfitPerHour: 1000, iconUrl: 'https://api.iconify.design/twemoji/briefcase.svg' },
  { id: 'league1', name: { en: 'In The City', ua: 'В місті', ru: 'В городе' }, description: { en: 'Just starting your journey.', ua: 'Тільки починаєте свій шлях.', ru: 'Только начинаете свой путь.' }, minProfitPerHour: 0, iconUrl: 'https://api.iconify.design/twemoji/passport-control.svg' },
];

export const INITIAL_UI_ICONS = {
  nav: {
    exchange: "https://api.iconify.design/ph/bank-bold.svg?color=white",
    mine: "https://api.iconify.design/ph/hammer-bold.svg?color=white",
    missions: "https://api.iconify.design/ph/list-checks-bold.svg?color=white",
    airdrop: "https://api.iconify.design/ph/parachute-bold.svg?color=white",
    profile: "https://api.iconify.design/ph/user-bold.svg?color=white"
  },
  profile_tabs: {
    contacts: "https://api.iconify.design/ph/users-three-bold.svg?color=white",
    boosts: "https://api.iconify.design/ph/rocket-launch-bold.svg?color=white",
    skins: "https://api.iconify.design/ph/paint-brush-bold.svg?color=white",
    market: "https://api.iconify.design/ph/storefront-bold.svg?color=white",
    cell: "https://api.iconify.design/ph/users-group-bold.svg?color=white"
  },
  energy: "https://api.iconify.design/ph/lightning-bold.svg?color=%2367e8f9", // cyan-300
  coin: "/assets/coin.svg",
  star: "https://api.iconify.design/ph/star-four-bold.svg?color=%2360a5fa", // blue-400
  suspicion: "https://api.iconify.design/ph/eye-bold.svg?color=%23f87171", // red-400
  marketCoinBox: 'https://api.iconify.design/twemoji/package.svg',
  marketStarBox: 'https://api.iconify.design/twemoji/glowing-star.svg',
  soundOn: "https://api.iconify.design/ph/speaker-high-bold.svg?color=white",
  soundOff: "https://api.iconify.design/ph/speaker-slash-bold.svg?color=white"
};


export const INITIAL_UPGRADES = [
    { id: 'doc1', name: { en: 'Student ID', ua: 'Студентський квиток', ru: 'Студенческий билет' }, price: 100, profitPerHour: 10, category: 'Documents', iconUrl: 'https://api.iconify.design/twemoji/graduation-cap.svg', suspicionModifier: -5 },
    { id: 'doc2', name: { en: 'Disability Certificate', ua: 'Довідка про інвалідність', ru: 'Справка об инвалидности' }, price: 1500, profitPerHour: 80, category: 'Documents', iconUrl: 'https://api.iconify.design/twemoji/wheelchair-symbol.svg', suspicionModifier: -10 },
    { id: 'doc3', name: { en: 'White Ticket', ua: 'Білий квиток', ru: 'Белый билет' }, price: 10000, profitPerHour: 500, category: 'Documents', iconUrl: 'https://api.iconify.design/twemoji/page-facing-up.svg', suspicionModifier: 5 },
    { id: 'leg1', name: { en: 'Lawyer Consultation', ua: 'Консультація адвоката', ru: 'Консультация адвоката' }, price: 500, profitPerHour: 25, category: 'Legal', iconUrl: 'https://api.iconify.design/twemoji/