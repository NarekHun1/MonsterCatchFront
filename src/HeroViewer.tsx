// src/App.tsx
import { useEffect, useState } from 'react';
import { Game } from './Game';
import './App.css';
import { InviteFriends } from './InviteFriends';
import { HeroCard } from './HeroCard';
import { apiFetch } from './api';

type Page = 'menu' | 'game' | 'leaderboard' | 'invite';

interface MeResponse {
    id: number;
    username?: string | null;
    firstName?: string | null;
    stars: number;
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
                console.error(e);
                setError(e.message || 'Ошибка загрузки лидеров');
            });
    }, []);

    return (
        <div className="panel">
            <h2 className="panel-title">📊 Таблица лидеров</h2>
            {error && <p className="panel-error">Ошибка: {error}</p>}

            {items.length === 0 && !error && (
                <p className="panel-muted">Пока ещё никто не сыграл. Будь первым!</p>
            )}

            <div className="leaderboard-list">
                {items.map((g, index) => (
                    <div key={g.id} className="leaderboard-row">
                        <span className="leaderboard-place">#{index + 1}</span>
                        <span className="leaderboard-name">
                            {g.user?.username || g.user?.firstName || 'Игрок'}
                        </span>
                        <span className="leaderboard-score">{g.score ?? 0} pts</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// DailyQuests

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
        let canceled = false;

        setLoading(true);
        setError('');

        (async () => {
            try {
                // GET /game/daily-quests с токеном
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
    }, [token, onStarsChange]);


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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <p className="panel-muted">Твои звёзды: ⭐ {stars}</p>

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
                            <span className="shop-price">Цена: {item.price} ⭐</span>
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
    const [token, setToken] = useState('');
    const [me, setMe] = useState<MeResponse | null>(null);
    const [userId, setUserId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState<Page>('menu');
    const [showHero, setShowHero] = useState(false);

    useEffect(() => {
        // @ts-ignore
        const tg = window.Telegram?.WebApp;
        if (!tg) return;

        tg.ready();
        tg.expand();
        tg.setBackgroundColor('#1a0b2e');
        tg.setHeaderColor('#1a0b2e');
    }, []);

    useEffect(() => {
        // @ts-ignore
        const tg = window.Telegram?.WebApp;
        if (!tg) return;

        tg.ready();
        tg.expand();
        tg.setBackgroundColor('#050816');
        tg.setHeaderColor('#050816');
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('token');

        if (!t) {
            setError('Не найден token в URL (запусти через кнопку в Telegram)');
            return;
        }

        setToken(t);

        try {
            const payload = JSON.parse(atob(t.split('.')[1]));
            if (payload.userId) {
                setUserId(payload.userId);
            }
        } catch (e) {
            console.error(e);
            setError('Не получилось прочитать JWT payload');
        }
    }, []);

    useEffect(() => {
        if (!token) return;

        apiFetch('/users/me', token)
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.message || 'Не удалось загрузить профиль');
                }
                return res.json();
            })
            .then((data) => setMe(data))
            .catch((e) => {
                console.error(e);
            });
    }, [token]);

    const goTo = (page: Page) => setCurrentPage(page);

    const handleStarsChange = (stars: number) => {
        setMe((prev) => (prev ? { ...prev, stars } : prev));
    };

    const handleStatsChange = (stats: { stars: number; level: number; xp: number }) => {
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

    return (
        <div className="app-root">
            <div className="app-bg-glow" />
            <main className="app-shell">
                <header className="app-header">
                    <div>
                        <h1 className="app-title">Monster Catch</h1>
                        <p className="app-subtitle">Telegram mini-game • турниры • призы</p>
                    </div>
                    {userId && (
                        <div className="app-userchip">
                            <span className="user-label">Игрок</span>
                            <span className="user-id">ID: {userId}</span>
                            {me && <span className="user-stars">⭐ {me.stars}</span>}
                        </div>
                    )}
                </header>

                {error && (
                    <div className="panel panel-error-box">
                        <h3 className="panel-title">Ошибка</h3>
                        <p>{error}</p>
                    </div>
                )}

                {!error && (
                    <>
                        {/* Навигация */}
                        <nav className="menu-nav">
                            <button
                                className={`menu-tab ${
                                    currentPage === 'menu' ? 'menu-tab--active' : ''
                                }`}
                                onClick={() => goTo('menu')}
                            >
                                🏠 Меню
                            </button>
                            <button
                                className={`menu-tab ${
                                    currentPage === 'game' ? 'menu-tab--active' : ''
                                }`}
                                onClick={() => goTo('game')}
                            >
                                🎮 Игра
                            </button>
                            <button
                                className={`menu-tab ${
                                    currentPage === 'leaderboard' ? 'menu-tab--active' : ''
                                }`}
                                onClick={() => goTo('leaderboard')}
                            >
                                📊 Лидеры
                            </button>
                        </nav>

                        {currentPage === 'menu' && me && (
                            <div className="panel panel-menu">
                                <HeroCard level={me.level} xp={me.xp} />
                                <button
                                    className="menu-btn"
                                    onClick={() => setCurrentPage('game')}
                                >
                                    🎮 Играть
                                </button>
                            </div>
                        )}

                        {/* Контент */}
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
                                            <div className="menu-card-title">
                                                Таблица лидеров
                                            </div>
                                            <div className="menu-card-text">
                                                Посмотри топ игроков и свои лучшие результаты.
                                            </div>
                                        </button>
                                        <button className="menu-card menu-card--disabled">
                                            <div className="menu-icon">🎯</div>
                                            <div className="menu-card-title">Турниры</div>
                                            <div className="menu-card-text">
                                                Скоро: платные турниры, призы и крипто-вывод.
                                            </div>
                                            <span className="menu-badge">Soon</span>
                                        </button>
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

                            {currentPage === 'game' && token && (
                                <Game
                                    token={token}
                                    onBack={() => setCurrentPage('menu')}
                                    onStarsChange={handleStarsChange}
                                    onStatsChange={handleStatsChange}
                                />
                            )}

                            {currentPage === 'invite' && token && (
                                <InviteFriends
                                    token={token}
                                    onBack={() => setCurrentPage('menu')}
                                />
                            )}

                            {currentPage === 'leaderboard' && <Leaderboard />}
                        </section>
                    </>
                )}

                <footer className="app-footer">
                    <span>Monster Catch · alpha</span>
                    <span>Powered by твоё безумие и JS ⚡️</span>
                </footer>

                {/* 🔥 ПАНЕЛЬ ГЕРОЯ СНИЗУ + МОДАЛКА */}
                {me && (
                    <>
                        <button
                            className="hero-floating-bar"
                            onClick={() => setShowHero(true)}
                        >
                            <div className="hero-floating-avatar">
                                <span>🧙‍♂️</span>
                            </div>
                            <div className="hero-floating-info">
                                <div className="hero-floating-name">
                                    {me.username || me.firstName || 'Герой'}
                                </div>
                                <div className="hero-floating-meta">
                                    <span>Lvl {me.level}</span>
                                    <span className="dot">•</span>
                                    <span>{me.xp} XP</span>
                                    <span className="dot">•</span>
                                    <span>⭐ {me.stars}</span>
                                </div>
                            </div>
                        </button>

                        {showHero && (
                            <div
                                className="hero-modal-overlay"
                                onClick={() => setShowHero(false)}
                            >
                                <div
                                    className="hero-modal-card"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {/* Тут можешь потом добавить HeroViewer или доп-инфу */}
                                    <button
                                        className="hero-modal-close"
                                        onClick={() => setShowHero(false)}
                                    >
                                        Закрыть
                                    </button>
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
