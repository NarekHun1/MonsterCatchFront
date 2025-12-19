export type Lang = 'ru' | 'en';

export const translations: Record<Lang, Record<string, string>> = {
    ru: {
        play: 'Играть',
        menu: 'Меню',
        game: 'Игра',
        tournaments: 'Турниры',
        leaderboard: 'Лидеры',

        buyCoins: 'Купить монеты',
        buyCoinsDesc: 'Пополнить баланс монет через Stars',

        mainMenuTitle: 'Главное меню',
        mainMenuDesc:
            'Лови монстров, набирай очки и поднимайся в таблице лидеров.',

        wallet: 'Кошелёк',
        singleGame: 'Одиночная игра',
        singleGameDesc:
            '60 секунд, один раунд, сколько монстров успеешь поймать?',

        exchange: 'Обмен',
        needMore: 'Нужно ещё',

        loading: 'Загрузка...',
        exchanging: '⏳ Обмен...',

        dailyQuests: '🎯 Ежедневные задания',
        shop: '🛒 Магазин улучшений',

        leaderboardTitle: '🏆 Таблица лидеров',
    },

    en: {
        play: 'Play',
        menu: 'Menu',
        game: 'Game',
        tournaments: 'Tournaments',
        leaderboard: 'Leaders',

        buyCoins: 'Buy Coins',
        buyCoinsDesc: 'Top up your coin balance via Stars',

        mainMenuTitle: 'Main Menu',
        mainMenuDesc:
            'Catch monsters, score points and climb the leaderboard.',

        wallet: 'Wallet',
        singleGame: 'Single Game',
        singleGameDesc:
            '60 seconds, one round — how many monsters can you catch?',

        exchange: 'Exchange',
        needMore: 'You need',

        loading: 'Loading...',
        exchanging: '⏳ Exchanging...',

        dailyQuests: '🎯 Daily Quests',
        shop: '🛒 Upgrade Shop',

        leaderboardTitle: '🏆 Leaderboard',
    },
};
