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

        leaderboardTitle: 'Таблица лидеров',
        claimed: 'Получено',
        claim: 'Забрать',
        inProgress: 'В процессе',
        error: 'Ошибка',

        shopTitle: 'Магазин улучшений',
        yourStars: 'Твои звёзды',
        price: 'Цена',
        buy: 'Купить',
        max: 'Макс',
        timeMonster: 'Монстр времени!',
        timeBonus: '+5 секунд к каждому раунду',
        cool: 'Круто',
        buyCoinsSubtitle: '💰 Играй • выигрывай • выводи',
        buyCoinsNote: 'Оплата через Telegram Stars ⭐',

        prizePool: 'Призовой фонд',
        every30min: 'каждые 30 минут',
        enterAndWin: 'Войти и выиграть',

        rouletteDesc: 'Зарабатывай реальные 💰 деньги',
        walletDesc: 'Выводи награды в USDT или TON.',
        inviteFriend: 'Пригласить друга',
        leaderboardDesc: 'Посмотри топ игроков и свои лучшие результаты.',
        tournamentDesc: 'Почасовые турниры, призовой фонд и топ-3 победителя.',
        buyCoinsTitle: 'Покупка монет',
        summonDemon: 'Нажми, чтобы призвать демона',

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
        claimed: 'Claimed',
        claim: 'Claim',
        inProgress: 'In progress',
        error: 'Error',

        shopTitle: 'Upgrade Shop',
        yourStars: 'Your stars',
        price: 'Price',
        buy: 'Buy',
        max: 'Max',
        timeMonster: 'Time Monster!',
        timeBonus: '+5 seconds per round',
        cool: 'Awesome',
        buyCoinsSubtitle: '💰 Play • win • withdraw',
        buyCoinsNote: 'Payment via Telegram Stars ⭐',

        prizePool: 'Prize pool',
        every30min: 'every 30 minutes',
        enterAndWin: 'Enter and win',

        rouletteDesc: 'Earn real 💰 money',
        walletDesc: 'Withdraw rewards in USDT or TON.',
        inviteFriend: 'Invite a friend',
        leaderboardDesc: 'Check top players and your best results.',
        tournamentDesc: 'Hourly tournaments, prize pool and top 3 winners.',
        buyCoinsTitle: 'Buy coins',
        summonDemon: 'Tap to summon the demon',

    },
};
