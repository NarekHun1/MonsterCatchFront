// src/App.tsx
import { useEffect, useState } from 'react';
import { Game } from './Game';
import './App.css';
import { InviteFriends } from './InviteFriends';
import { HeroCard } from './HeroCard';
import { apiFetch } from './api';
import HeroViewer from './HeroViewer'; // 😈 3D демон
import { initAuth } from './auth/initAuth';
import { Wallet } from './Wallet';
import {WalletIcon} from "./styles/WalletIcon.tsx";
import {TournamentCard} from "./TournamentCard.tsx";
import { ExchangeTicket } from './ExchangeTicket';
import {BlueStarIcon} from "./styles/BlueStarIcon.tsx";
import {CashCupCard} from "./CashCupCard.tsx";
import { RouletteWheel } from './RouletteWheel';





type Page = 'menu' | 'game' | 'leaderboard' | 'invite' | 'tournament' | 'wallet' | 'cashcup'| 'roulette';

interface MeResponse {
    id: number;
    username?: string | null;
    firstName?: string | null;
    stars: number;
    coins: number;
    multiplierLevel: number;
    extraTimeLevel: number;
    epicBoostLevel: number;
    level: number;
    xp: number;
}

interface LeaderboardItem {
    id: number;
    score: number;
    user?: {
        username?: string | null;
        firstName?: string | null;
    };
}

function Leaderboard() {
    const [items, setItems] = useState<LeaderboardItem[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        apiFetch('/game/leaderboard')
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.message || 'Не удалось загрузить таблицу лидеров');
                }
                return res.json();
            })
            .then((data) => setItems(data))
            .catch((e: any) => {
                setError(e.message || 'Ошибка загрузки лидеров');
            });
    }, []);

    return (
        <div className="leaderboard-container">
            <h2 className="leaderboard-title">🏆 Таблица лидеров</h2>

            {error && <p className="panel-error">{error}</p>}

            <div className="leaderboard-big-list">
                {items.map((entry, index) => (
                    <div key={entry.id} className="leaderboard-card">
                        <div className={`lb-place lb-place-${index + 1}`}>
                            {index + 1 <= 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                        </div>

                        <div className="lb-avatar">😈</div>

                        <div className="lb-name">
                            {entry.user?.username || entry.user?.firstName || 'Игрок'}
                        </div>

                        <div className="lb-score">{entry.score} pts</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

interface Quest {
    id: string;
    title: string;
    target: number;
    current: number;
    reward: number;
    rewardLabel: string;
    completed: boolean;
    claimed: boolean;
    claimable: boolean;
}

function DailyQuests({
                         token,
                         onStarsChange,
                     }: {
    token: string;
    onStarsChange?: (stars: number) => void;
}) {
    const [quests, setQuests] = useState<Quest[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) return;

        let canceled = false;

        setLoading(true);
        setError('');

        (async () => {
            try {
                const res = await apiFetch('/game/daily-quests', token);
                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    throw new Error(data.message || 'Не удалось загрузить квесты');
                }

                if (canceled) return;

                setQuests(data.quests ?? []);
                if (onStarsChange && typeof data.stars === 'number') {
                    onStarsChange(data.stars);
                }
            } catch (e: any) {
                if (canceled) return;
                console.error(e);
                setError(e.message || 'Ошибка загрузки квестов');
            } finally {
                if (!canceled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            canceled = true;
        };
    }, [token]);

    const handleClaim = async (questId: string) => {
        try {
            setError('');

            const res = await apiFetch('/game/daily-quests/claim', token, {
                method: 'POST',
                body: JSON.stringify({ questId }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.message || 'Не удалось забрать награду');
            }

            setQuests((prev) =>
                prev.map((q) =>
                    q.id === questId ? { ...q, claimed: true, claimable: false } : q,
                ),
            );

            if (onStarsChange && typeof data.stars === 'number') {
                onStarsChange(data.stars);
            }
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Ошибка при получении награды');
        }
    };

    if (loading) {
        return (
            <div className="panel">
                <h2 className="panel-title">🎯 Ежедневные задания</h2>
                <p className="panel-muted">Загружаем...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="panel">
                <h2 className="panel-title">🎯 Ежедневные задания</h2>
                <p className="panel-muted">Ошибка: {error}</p>
            </div>
        );
    }

    return (
        <div className="panel">
            <h2 className="panel-title">🎯 Ежедневные задания</h2>
            <div className="daily-list">
                {quests.map((q) => {
                    const progress = Math.min(1, q.current / q.target);
                    return (
                        <div key={q.id} className="daily-item">
                            <div className="daily-row">
                                <span>{q.title}</span>
                                <span className="daily-progress-text">
                                    {Math.min(q.current, q.target)} / {q.target}
                                </span>
                            </div>
                            <div className="daily-bar">
                                <div
                                    className="daily-bar-fill"
                                    style={{ transform: `scaleX(${progress})` }}
                                />
                            </div>
                            <div className="daily-footer">
                                <span className="daily-reward">{q.rewardLabel}</span>

                                {q.claimed ? (
                                    <span className="daily-badge">Получено</span>
                                ) : q.claimable ? (
                                    <button
                                        className="daily-claim-btn"
                                        onClick={() => handleClaim(q.id)}
                                    >
                                        Забрать
                                    </button>
                                ) : (
                                    <span className="daily-badge daily-badge--grey">
                                        В процессе
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface ShopItem {
    id: 'multiplier' | 'extra_time' | 'epic_boost';
    title: string;
    level: number;
    maxLevel: number;
    price: number;
    canBuy: boolean;
}

function Shop({ token }: { token: string }) {
    const [items, setItems] = useState<ShopItem[]>([]);
    const [stars, setStars] = useState<number>(0);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const [rewardPopup, setRewardPopup] = useState<null | {
        type: 'extra_time';
        newLevel: number;
    }>(null);

    const load = () => {
        setLoading(true);
        setError('');

        apiFetch('/shop/status', token)
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.message || 'Не удалось загрузить магазин');
                }
                return res.json();
            })
            .then((data) => {
                setStars(data.stars);
                setItems(data.items ?? []);
            })
            .catch((e: any) => {
                console.error(e);
                setError(e.message || 'Ошибка магазина');
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, [token]);

    const handleBuy = (id: ShopItem['id']) => {
        apiFetch('/shop/buy', token, {
            method: 'POST',
            body: JSON.stringify({ itemId: id }),
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data.message || 'Не удалось купить улучшение');
                }
                return data;
            })
            .then((data) => {
                setStars(data.stars);
                if (id === 'extra_time') {
                    setRewardPopup({
                        type: 'extra_time',
                        newLevel: data.extraTimeLevel,
                    });
                }
                load();
            })
            .catch((e: any) => {
                console.error(e);
                setError(e.message || 'Ошибка покупки');
            });
    };

    return (
        <div className="panel">
            <h2 className="panel-title">🛒 Магазин улучшений</h2>
            <p className="panel-muted">Твои звёзды:  <BlueStarIcon size={16} /> {stars}</p>

            {loading && <p className="panel-muted">Загрузка...</p>}
            {error && <p className="panel-error">Ошибка: {error}</p>}

            <div className="shop-list">
                {items.map((item) => (
                    <div key={item.id} className="shop-item">
                        <div className="shop-row">
                            <span className="shop-title">{item.title}</span>
                            <span className="shop-level">
                                Уровень: {item.level} / {item.maxLevel}
                            </span>
                        </div>
                        <div className="shop-row">
                            <span className="shop-price">Цена: {item.price}  <BlueStarIcon size={16}/></span>
                            <button
                                className="shop-buy-btn"
                                onClick={() => handleBuy(item.id)}
                                disabled={!item.canBuy}
                            >
                                {item.level >= item.maxLevel ? 'Макс' : 'Купить'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {rewardPopup && rewardPopup.type === 'extra_time' && (
                <div className="reward-overlay" onClick={() => setRewardPopup(null)}>
                    <div className="reward-card">
                        <div className="reward-emoji">⏳</div>
                        <div className="reward-title">Монстр времени!</div>
                        <div className="reward-text">+5 секунд к каждому раунду</div>
                        <div className="reward-level">
                            Уровень времени: {rewardPopup.newLevel} / 5
                        </div>
                        <button
                            className="reward-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                setRewardPopup(null);
                            }}
                        >
                            Круто 🚀
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function App() {
    const [token, setToken] = useState<string | null>(null);
    const [me, setMe] = useState<MeResponse | null>(null);
    const [userId, setUserId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState<Page>('menu');
    const [showHero, setShowHero] = useState(false);
    const [tournamentGameId, setTournamentGameId] = useState<number | null>(null);
    const [tournamentType, setTournamentType] =
        useState<'HOURLY' | 'DAILY' | null>(null);
    const [isBooting, setIsBooting] = useState(true);
    const [showRoulette, setShowRoulette] = useState(false);
    const [minDelayPassed, setMinDelayPassed] = useState(false);
    const [tickets, setTickets] = useState<number>(0);



    // 👇 состояние для магазина монет
    const [showCoinShop, setShowCoinShop] = useState(false);

    // минимальная длительность сплэша — 1500 мс
    useEffect(() => {
        const timer = setTimeout(() => {
            setMinDelayPassed(true);
        }, 2000); // можешь поставить 2000, если хочешь ещё дольше

        return () => clearTimeout(timer);
    }, []);


    useEffect(() => {
        // прятать сплэш только когда:
        // 1) либо авторизовались (есть token) либо ошибка (error)
        // 2) и прошла минимальная задержка
        if ((token || error) && minDelayPassed) {
            setIsBooting(false);
        }
    }, [token, error, minDelayPassed]);

    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (!tg) return;

        // говорим, что всё загрузили
        tg.ready?.();

        // просим максимум доступной высоты
        tg.expand?.();

        // опционально — отключить свайпы, чтобы не сворачивался
        tg.disableVerticalSwipes?.();

        tg.setBackgroundColor?.('#000000');
    }, []);

    useEffect(() => {
        if (currentPage !== 'menu') {
            setShowHero(false);
        }
    }, [currentPage]);


    useEffect(() => {
        if (!token) return;

        let cancelled = false;

        const loadProfile = async () => {
            try {
                const res = await apiFetch('/users/me', token);

                if (res.status === 401) {
                    console.warn('401 → reauth');
                    const newToken = await initAuth();
                    if (newToken) setToken(newToken);
                    return;
                }

                const data = await res.json().catch(() => ({}));
                if (!res.ok) return;

                if (!cancelled) {
                    setMe(data);
                    setUserId(data.id);
                }

                const ticketsRes = await apiFetch('/tickets/count', token);
                const ticketsData = await ticketsRes.json().catch(() => ({}));

                if (typeof ticketsData.count === 'number') {
                    setTickets(ticketsData.count);
                }
            } catch (e) {
                console.error(e);
            }
        };

        loadProfile();

        return () => {
            cancelled = true;
        };
    }, [token]);


    // кнопка "Купить монеты" в меню
    const buyCoinsMenu = () => {
        setShowCoinShop(true);
    };

    const buyCoinsPack = async (packId: string) => {
        const tg = (window as any).Telegram?.WebApp;
        if (!tg || !token) return;

        try {
            const backendUrl =
                import.meta.env.VITE_API_BASE_URL ||
                'https://monstercatch-production.up.railway.app';

            // ❗ вызываем свой backend, а НЕ бота через sendData
            const res = await fetch(`${backendUrl}/payment/create-stars-invoice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ packId }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok || !data.invoiceLink) {
                throw new Error(data.message || 'Не удалось создать оплату');
            }

            // 🔥 открываем Stars-оплату ПРЯМО в игре
            tg.openInvoice(data.invoiceLink, (status: string) => {
                console.log('Invoice status:', status);
            });
        } catch (e: any) {
            console.error(e);
            tg.showAlert?.(e.message || 'Ошибка создания платежа');
        }
    };



    useEffect(() => {
        (async () => {
            const t = await initAuth();

            if (!t) {
                setError(
                    'Запусти игру через Telegram (кнопка «Играть» в боте или через раздел Игр).',
                );
                // setIsBooting(false);
                return;
            }

            setToken(t);
        })();
    }, []);



    // 🔁 обновляем профиль после закрытия invoice (после оплаты Stars)
    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (!tg) return;

        const handler = () => {
            if (!token) return;

            apiFetch('/users/me', token)
                .then((res) => res.json().catch(() => ({})))
                .then((data) => {
                    if (!data) return;
                    setMe((prev) =>
                        prev
                            ? {
                                ...prev,
                                coins:
                                    typeof data.coins === 'number'
                                        ? data.coins
                                        : prev.coins,
                                stars:
                                    typeof data.stars === 'number'
                                        ? data.stars
                                        : prev.stars,
                            }
                            : data,
                    );
                })
                .catch((e) => console.error(e));
        };

        tg.onEvent('invoiceClosed', handler);

        return () => {
            tg.offEvent('invoiceClosed', handler);
        };
    }, [token]);

    const goTo = (page: Page) => setCurrentPage(page);

    const handleStarsChange = (stars: number) => {
        setMe((prev) => (prev ? { ...prev, stars } : prev));
    };

    const handleStatsChange = (stats: {
        stars: number;
        level: number;
        xp: number;
    }) => {
        setMe((prev) =>
            prev
                ? {
                    ...prev,
                    stars: stats.stars,
                    level: stats.level,
                    xp: stats.xp,
                }
                : prev,
        );
    };

    if (isBooting && !error) {
        return (
            <div className="splash-root">
                <div className="splash-inner">
                    <div className="splash-logo-circle">
                        <img src="/monster.jpeg" alt="Monster" className="splash-logo-img" />
                    </div>

                    <h1 className="splash-title">Monster Catch</h1>
                    <p className="splash-subtitle">Загружаем монстров...</p>

                    <div className="splash-bar">
                        <div className="splash-bar-fill" />
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="app-root">
            <div className="app-bg-glow" />

            {/* ХЕДЕР НА ВЕСЬ ЭКРАН */}
            {currentPage !== 'game' && (
                <header className="app-header">
                    {me && userId && (
                        <div className="app-userchip">
                            <div className="chip-title">Monster Catch</div>
                            <div className="user-main">
                                <div className="user-avatar">
                                    <span>😈</span>
                                </div>
                                <div className="user-meta">
                                    <div className="user-name">
                                        {me.username || me.firstName || 'Игрок'}
                                    </div>
                                    <div className="user-id-small">ID: {userId}</div>
                                </div>
                            </div>

                            <div className="user-stats-row">
                                <div className="user-pill user-pill--stars">
                                    <BlueStarIcon size={16} />
                                    <span className="user-pill-value">{me.stars}</span>
                                </div>


                                <div className="user-pill user-pill--coins">
                                    <span className="user-pill-icon">🪙</span>
                                    <span className="user-pill-value">{me.coins}</span>
                                </div>
                                <div className="user-pill user-pill--tickets">
                                    <span className="user-pill-icon">🎟</span>
                                    <span className="user-pill-value">{tickets}</span>
                                </div>

                                <div className="header-wallet-btn" onClick={() => setCurrentPage('wallet')}>
                                    <WalletIcon />
                                </div>

                            </div>
                        </div>
                    )}
                </header>
            )}

            {/* ВСЯ ОСТАЛЬНАЯ ИГРА — ВНУТРИ КАРТОЧКИ */}
            <main className={`app-shell ${currentPage === 'game' ? 'game-active' : ''}`}>
                {error && (
                    <div className="panel panel-error-box">
                        <h3 className="panel-title">Ошибка</h3>
                        <p>{error}</p>
                    </div>
                )}

                {!error && (
                    <>
                        <nav className="menu-nav">
                            <button
                                className={`menu-tab ${currentPage === 'menu' ? 'menu-tab--active' : ''}`}
                                onClick={() => goTo('menu')}
                            >
                                <div className="tab-icon">🏠</div>
                                <div className="tab-label">Меню</div>
                            </button>

                            <button
                                className={`menu-tab ${currentPage === 'game' ? 'menu-tab--active' : ''}`}
                                onClick={() => goTo('game')}
                            >
                                <div className="tab-icon">🎮</div>
                                <div className="tab-label">Игра</div>
                            </button>

                            <button
                                className={`menu-tab ${currentPage === 'tournament' ? 'menu-tab--active' : ''}`}
                                onClick={() => goTo('tournament')}
                            >
                                <div className="tab-icon">🎯</div>
                                <div className="tab-label">Турниры</div>
                            </button>
                            <button
                                className={`menu-tab ${currentPage === 'leaderboard' ? 'menu-tab--active' : ''}`}
                                onClick={() => goTo('leaderboard')}
                            >
                                <div className="tab-icon">📊</div>
                                <div className="tab-label">Лидеры</div>
                            </button>

                        </nav>

                        {currentPage === 'cashcup' && token && (
                            <CashCupCard
                                token={token}
                                onStartGame={(tournamentId) => {
                                    setTournamentGameId(tournamentId);
                                    setTournamentType(null);
                                    setCurrentPage('game');
                                }}
                            />
                        )}


                        {currentPage === 'menu' && me && (
                            <div className="panel panel-menu">
                                <HeroCard level={me.level} xp={me.xp} />

                                <button className="play-main-btn" onClick={() => setCurrentPage('game')}>
                                    <span className="play-glow" />
                                    <span className="play-shine" />

                                    <span className="play-icon">🎮</span>
                                    <span className="play-text">ИГРАТЬ</span>
                                </button>

                                <div className="menu-actions">
                                    {/* КУПИТЬ МОНЕТЫ */}
                                    <div className="buy-coins-card" onClick={buyCoinsMenu}>
                                        <div className="buy-coins-glow" />

                                        <div className="buy-coins-icon">🪙</div>

                                        <div className="buy-coins-content">
                                            <div className="buy-coins-title">
                                                Купить монеты
                                            </div>

                                            <div className="buy-coins-subtitle">
                                                💰 Играй • выигрывай • выводи
                                            </div>

                                            <div className="buy-coins-note">
                                                Оплата через Telegram Stars ⭐
                                            </div>
                                        </div>
                                    </div>

                                    {/* 💰 CASH CUP */}
                                    <div
                                        className="cashcup-card"
                                        onClick={() => setCurrentPage('cashcup')}
                                    >
                                        <div className="cashcup-glow" />

                                        <div className="cashcup-header">
                                            <span className="cashcup-badge">LIVE</span>
                                            <span className="cashcup-title">💰 CASH CUP</span>
                                        </div>

                                        <div className="cashcup-body">
                                            <div className="cashcup-prize">Призовой фонд</div>
                                            <div className="cashcup-amount">💰REAL CASH PRIZ</div>

                                            <div className="cashcup-info">
                                                ⏱ каждые 30 минут <br />
                                                🎟 вход: 10 билетов
                                            </div>
                                        </div>

                                        <div className="cashcup-footer">
                                            <span>▶ Войти и выиграть</span>
                                        </div>

                                    </div>
                                    <div className="menu-card menu-card--gold" onClick={() => setShowRoulette(true)}>
                                        <div className="menu-icon">🎰</div>
                                        <div className="menu-card-title">Рулетка удачи</div>
                                        <div className="menu-card-text">Зарабатывай реальные 💰 деньги</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <section className="app-content">
                            {currentPage === 'menu' && (
                                <div className="panel panel-menu">
                                    <h2 className="panel-title">Главное меню</h2>
                                    <p className="panel-muted">
                                        Лови монстров, набирай очки и поднимайся в таблице лидеров.
                                    </p>
                                    <div className="menu-grid">

                                        <button
                                            className="menu-card"
                                            onClick={() => setCurrentPage('wallet')}
                                        >
                                            <div className="menu-icon">👛</div>
                                            <div className="menu-card-title">Кошелёк</div>
                                            <div className="menu-card-text">
                                                Выводи награды в USDT или TON.
                                            </div>
                                        </button>


                                        <button
                                            className="menu-card"
                                            onClick={() => goTo('game')}
                                        >
                                            <div className="menu-icon">🎮</div>
                                            <div className="menu-card-title">
                                                Одиночная игра
                                            </div>
                                            <div className="menu-card-text">
                                                60 секунд, один раунд, сколько монстров успеешь
                                                поймать?
                                            </div>
                                        </button>
                                        <button
                                            className="menu-btn menu-btn--secondary"
                                            onClick={() => setCurrentPage('invite')}
                                        >
                                            👥 Пригласить друга
                                        </button>
                                        <button
                                            className="menu-card"
                                            onClick={() => goTo('leaderboard')}
                                        >
                                            <div className="menu-icon">🏆</div>
                                            <div className="menu-card-title">Таблица лидеров</div>
                                            <div className="menu-card-text">
                                                Посмотри топ игроков и свои лучшие результаты.
                                            </div>
                                        </button>
                                        <button
                                            className="menu-card"
                                            onClick={() => goTo('tournament')}
                                        >
                                            <div className="menu-icon">🎯</div>
                                            <div className="menu-card-title">Турниры</div>
                                            <div className="menu-card-text">
                                                Почасовые турниры, призовой фонд и топ-3 победителя.
                                            </div>
                                        </button>
                                        {me && token && (
                                            <ExchangeTicket
                                                stars={me.stars}
                                                token={token}
                                                onStarsChange={handleStarsChange}
                                            />
                                        )}
                                    </div>

                                    {token && (
                                        <DailyQuests
                                            token={token}
                                            onStarsChange={handleStarsChange}
                                        />
                                    )}
                                    {token && <Shop token={token} />}
                                </div>

                            )}
                                {showRoulette && (
                                    <RouletteWheel
                                        token={token}
                                        onClose={() => setShowRoulette(false)}
                                        onReward={() => {
                                            // после спина можно обновить профиль/тикеты
                                            // самый простой вариант: дернуть /users/me и /tickets/count как ты уже делаешь
                                            // или просто ничего (UI уже покажет результат)
                                        }}
                                    />
                                )}

                            {currentPage === 'game' && token && (
                                <Game
                                    token={token}
                                    tournamentId={tournamentGameId ?? undefined}
                                    tournamentType={tournamentType ?? undefined} // 🔥 ВАЖНО
                                    onBack={() => {
                                        setCurrentPage('menu');
                                        setTournamentGameId(null);
                                        setTournamentType(null); // 🔥 очистка
                                    }}
                                   onStarsChange={handleStarsChange}
                                    onStatsChange={handleStatsChange}
                                />
                            )}


                            {currentPage === 'wallet' && token && (
                                <Wallet
                                    token={token}
                                    onBack={() => setCurrentPage('menu')}
                                />
                            )}

                            {currentPage === 'invite' && token && (
                                <InviteFriends
                                    token={token}
                                    onBack={() => setCurrentPage('menu')}
                                />
                            )}

                            {currentPage === 'leaderboard' && <Leaderboard />}



                            {currentPage === 'tournament' && token && (
                                <div className="tournament-page">
                                    <TournamentCard
                                        type="HOURLY"
                                        token={token}
                                        onStartGame={(id) => {
                                            setTournamentGameId(id);
                                            setTournamentType('HOURLY');
                                            setCurrentPage('game');
                                        }}
                                    />


                                    <TournamentCard
                                        type="DAILY"
                                        token={token}
                                        onStartGame={(id) => {
                                            setTournamentGameId(id);
                                            setTournamentType('DAILY');
                                            setCurrentPage('game');
                                        }}
                                    />

                                </div>
                            )}

                        </section>
                    </>
                )}

                {/* POPUP магазина монет */}
                {showCoinShop && (
                    <div
                        className="shop-overlay"
                        onClick={() => setShowCoinShop(false)}
                    >
                        <div
                            className="shop-popup"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="panel-title">🪙 Покупка монет</h3>

                            <button className="menu-btn" onClick={() => buyCoinsPack('coins_500')}>
                                100 монет — 100 Stars
                            </button>

                            <button className="menu-btn" onClick={() => buyCoinsPack('coins_1000')}>
                                150 монет — 150 Stars
                            </button>

                            <button className="menu-btn" onClick={() => buyCoinsPack('coins_2500')}>
                                300 монет — 250 Stars
                            </button>

                            <button
                                className="menu-btn menu-btn--secondary"
                                onClick={() => setShowCoinShop(false)}
                            >
                                Закрыть
                            </button>
                        </div>
                    </div>
                )}

                <footer className="app-footer">
                    <span>Monster Catch · alpha</span>
                    <span>Powered by твоё безумие и JS ⚡️</span>
                </footer>

                {me && currentPage === 'menu' && (
                    <>
                        <button
                            className="hero-floating-bar"
                            onClick={() => setShowHero(true)}
                        >
                            <div className="hero-floating-avatar">
                                <span>😈</span>
                            </div>
                            <div className="hero-floating-info">
                                <div className="hero-floating-name">
                                    {me.username || me.firstName || 'Герой'}
                                </div>
                                <div className="hero-floating-meta">
                                    <span>Нажми, чтобы призвать демона</span>
                                </div>
                            </div>
                        </button>

                        {showHero && (
                            <div
                                className="hero-modal-overlay"
                                onClick={() => setShowHero(false)}
                            >
                                <div
                                    className="hero-modal-card hero-modal-card--demon"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        className="hero-modal-close"
                                        onClick={() => setShowHero(false)}
                                    >
                                        ✕
                                    </button>
                                    <HeroViewer />
                                </div>
                            </div>
                        )}
                    </>
                )}

            </main>
        </div>
    );
}

export default App;
