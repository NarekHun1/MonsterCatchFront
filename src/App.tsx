// src/App.tsx
import { useEffect, useState } from 'react';
import { Game } from './Game';
import './App.css';
import { InviteFriends } from './InviteFriends';
import { HeroCard } from './HeroCard';
import { apiFetch } from './api';
import HeroViewer from './HeroViewer'; // 😈 3D демон

type Page = 'menu' | 'game' | 'leaderboard' | 'invite'| 'tournament';

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
type TournamentStatus = 'PLANNED' | 'ACTIVE' | 'FINISHED';

interface TournamentParticipant {
    userId: number;
    username?: string | null;
    score: number;
}

interface TournamentInfo {
    tournamentId: number;
    startsAt: string;
    endsAt: string;
    joinDeadline: string;
    prizePool: number;
    entryFee: number;
    status: TournamentStatus;
    participants: TournamentParticipant[];
}

function TournamentView({
                            token,
                            onStartGame,
                            onCoinsChange,
                        }: {
    token: string;
    onStartGame?: (tournamentId: number) => void;
    onCoinsChange?: (coins: number) => void;
}) {
    const [info, setInfo] = useState<TournamentInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [joining, setJoining] = useState(false);
    const [joinMessage, setJoinMessage] = useState<string | null>(null);

    // загрузка турнира + периодический рефреш
    useEffect(() => {
        let canceled = false;

        const load = async () => {
            if (canceled) return;
            setLoading(true);
            setError('');
            try {
                const res = await apiFetch('/tournament/current');
                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    throw new Error(data.message || 'Не удалось загрузить турнир');
                }

                if (canceled) return;

                if (!data) {
                    setInfo(null);
                } else {
                    setInfo(data as TournamentInfo);
                }
            } catch (e: any) {
                if (canceled) return;
                console.error(e);
                setError(e.message || 'Ошибка загрузки турнира');
            } finally {
                if (!canceled) setLoading(false);
            }
        };

        load();
        const id = window.setInterval(load, 15000); // обновляем раз в 15 секунд

        return () => {
            canceled = true;
            window.clearInterval(id);
        };
    }, []);

    const handleJoin = async () => {
        if (!token || !info) return;
        setJoining(true);
        setError('');
        setJoinMessage(null);

        try {
            const res = await apiFetch('/tournament/join', token, {
                method: 'POST',
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.message || 'Не удалось вступить в турнир');
            }

            if (data.joined === false && data.reason === 'ALREADY_JOINED') {
                setJoinMessage('Ты уже участвуешь в этом турнире 😎');
            } else if (data.joined) {
                setJoinMessage('Ты успешно вступил в турнир! Удачи 🏆');
            } else {
                setJoinMessage('Запрос выполнен, но непонятный ответ от сервера 🤔');
            }
            // 👇 ОБНОВЛЯЕМ МОНЕТЫ В APP, ЕСЛИ СЕРВЕР ИХ ВЕРНУЛ
            if (typeof data.coins === 'number' && onCoinsChange) {
                onCoinsChange(data.coins);
            }

            // Обновим информацию о турнире
            try {
                const refresh = await apiFetch('/tournament/current');
                const refreshedData = await refresh.json().catch(() => ({}));
                if (refresh.ok) {
                    setInfo(refreshedData as TournamentInfo);
                }
            } catch {
                // игнорим, не критично
            }
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Ошибка при вступлении');
        } finally {
            setJoining(false);
        }
    };

    // красивые вычисления времени
    const now = new Date();
    let statusLabel = '—';
    let statusClass = 'tournament-badge';

    if (info) {
        if (info.status === 'PLANNED') {
            statusLabel = 'Скоро начнётся';
            statusClass += ' tournament-badge--planned';
        } else if (info.status === 'ACTIVE') {
            statusLabel = 'Идёт сейчас';
            statusClass += ' tournament-badge--active';
        } else if (info.status === 'FINISHED') {
            statusLabel = 'Завершён';
            statusClass += ' tournament-badge--finished';
        }
    }

    let canJoin = false;
    let joinHint = '';
    if (info) {
        const joinDeadline = new Date(info.joinDeadline);
        const endsAt = new Date(info.endsAt);

        if (info.status === 'FINISHED' || now > endsAt) {
            canJoin = false;
            joinHint = 'Турнир уже завершён. Жди следующего часа ⏳';
        } else if (now > joinDeadline) {
            canJoin = false;
            joinHint = 'Окно входа в турнир закрыто. Загляни в следующий турнир 🕒';
        } else {
            canJoin = true;
            const minutesLeft = Math.max(
                0,
                Math.ceil((joinDeadline.getTime() - now.getTime()) / 60000),
            );
            joinHint = `Ещё можно вступить! Осталось примерно ${minutesLeft} мин.`;
        }
    }

    return (
        <div className="panel">
            <h2 className="panel-title">🏆 Почасовой турнир</h2>

            {loading && <p className="panel-muted">Загружаем турнир...</p>}
            {error && <p className="panel-error">Ошибка: {error}</p>}

            {!loading && !error && !info && (
                <p className="panel-muted">
                    Сейчас активного турнира нет. Зайди в начале следующего часа 😉
                </p>
            )}

            {info && (
                <>
                    <div className="tournament-header">
                        <span className={statusClass}>{statusLabel}</span>
                        <div className="tournament-times">
                            <div>
                                Старт:{' '}
                                {new Date(info.startsAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </div>
                            <div>
                                Конец:{' '}
                                {new Date(info.endsAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="tournament-stats">
                        <div className="tournament-stat">
                            <span className="tournament-stat-label">Вход:</span>
                            <span className="tournament-stat-value">
                                {info.entryFee} монетка
                            </span>
                        </div>
                        <div className="tournament-stat">
                            <span className="tournament-stat-label">
                                Призовой фонд:
                            </span>
                            <span className="tournament-stat-value">
                                {info.prizePool} монет
                            </span>
                        </div>
                    </div>

                    <p className="panel-muted tournament-hint">
                        Награда распределяется между топ-3 игроками в конце турнира.
                    </p>

                    <div className="tournament-join-block">
                        {info && onStartGame && (
                            <div className="tournament-play-block">
                                <button
                                    className="menu-btn menu-btn--secondary"
                                    onClick={() => onStartGame(info.tournamentId)}
                                >
                                    🎮 Начать турнирную игру
                                </button>
                                <p className="panel-muted">
                                    Результат этой игры пойдёт в таблицу турнира.
                                </p>
                            </div>
                        )}


                        <button
                            className="menu-btn"
                            disabled={!canJoin || joining || !token}
                            onClick={handleJoin}
                        >
                            {joining
                                ? 'Вступаем...'
                                : canJoin
                                    ? 'Вступить в турнир за 1 монетку'
                                    : 'Вступление недоступно'}
                        </button>
                        {joinHint && (
                            <p className="panel-muted tournament-join-hint">
                                {joinHint}
                            </p>
                        )}
                        {joinMessage && (
                            <p className="tournament-join-message">{joinMessage}</p>
                        )}
                    </div>

                    <div className="tournament-leaderboard">
                        <h3 className="panel-subtitle">Текущий топ</h3>
                        {info.participants.length === 0 ? (
                            <p className="panel-muted">
                                Пока ещё никто не отправил результат. Будь первым! 💥
                            </p>
                        ) : (
                            <div className="leaderboard-list">
                                {info.participants.map((p, index) => (
                                    <div
                                        key={p.userId}
                                        className="leaderboard-row leaderboard-row--compact"
                                    >
                                        <span className="leaderboard-place">
                                            #{index + 1}
                                        </span>
                                        <span className="leaderboard-name">
                                            {p.username || 'Игрок'}
                                        </span>
                                        <span className="leaderboard-score">
                                            {p.score} pts
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// -------- DailyQuests --------

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]); // важно: не триггерим перезагрузку при каждом новом onStarsChange

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

// -------- Shop --------

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

// -------- App --------

function App() {
    const [token, setToken] = useState('');
    const [me, setMe] = useState<MeResponse | null>(null);
    const [userId, setUserId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState<Page>('menu');
    const [showHero, setShowHero] = useState(false);
    const [tournamentGameId, setTournamentGameId] = useState<number | null>(null);


    // Настройка Telegram WebApp
    useEffect(() => {
        // @ts-ignore
        const tg = window.Telegram?.WebApp;
        if (!tg) return;

        tg.ready();
        tg.expand();
        tg.setBackgroundColor('#050816');
        tg.setHeaderColor('#050816');
    }, []);

    // Читаем token из URL
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

    // Загружаем профиль
    useEffect(() => {
        if (!token) return;

        let cancelled = false;

        const loadMe = async () => {
            try {
                const res = await apiFetch('/users/me', token);
                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    throw new Error(data.message || 'Не удалось загрузить профиль');
                }

                if (!cancelled) {
                    setMe(data);
                }
            } catch (e) {
                console.error(e);
            }
        };

        // первый запрос при старте
        loadMe();

        // дальше обновляем профиль каждые 10 секунд
        const id = window.setInterval(() => {
            loadMe();
        }, 10000); // 10000 мс = 10 секунд

        return () => {
            cancelled = true;
            window.clearInterval(id);
        };
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

                    {me && userId && (
                        <div className="app-userchip">
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
                                <div className="user-pill">
                                    <span className="user-pill-icon">⭐</span>
                                    <span className="user-pill-value">{me.stars}</span>
                                </div>
                                <div className="user-pill user-pill--coins">
                                    <span className="user-pill-icon">🪙</span>
                                    <span className="user-pill-value">{me.coins}</span>
                                </div>
                            </div>
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
                                    tournamentId={tournamentGameId ?? undefined}
                                    onBack={() => {
                                        setCurrentPage('menu');
                                        setTournamentGameId(null);
                                    }}
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

                            {currentPage === 'tournament' && token && (
                                <TournamentView
                                    token={token}
                                    onStartGame={(tournamentId) => {
                                        setTournamentGameId(tournamentId);
                                        setCurrentPage('game');
                                    }}
                                    onCoinsChange={(coins) => {
                                        setMe((prev) => (prev ? { ...prev, coins } : prev));
                                    }}
                                />
                            )}




                        </section>
                    </>
                )}

                <footer className="app-footer">
                    <span>Monster Catch · alpha</span>
                    <span>Powered by твоё безумие и JS ⚡️</span>
                </footer>

                {/* 🔥 ПАНЕЛЬ ГЕРОЯ СНИЗУ + МОДАЛКА С ДЕМОНОМ */}
                {me && (
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

                                    {/* только демон */}
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
