// src/App.tsx
import {useCallback, useEffect, useState} from 'react';
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
import { translations } from './i18n';
import type { Lang } from './i18n';
import {Quests} from "./Quests.tsx";
import { BottomNav } from './BottomNav';
import LevelsMap from './match3/LevelsMap.tsx';
import Match3Level from './match3/Match3Level.tsx';
import MonstersFarm from "./MonstersFarm.tsx";
import { Market } from './Market';
import { EventTournamentCard } from './EventTournamentCard';


type Page = 'menu' | 'game' | 'leaderboard' | 'invite' | 'tournament' | 'wallet' | 'cashcup'| 'roulette' | 'quests'| 'match3'| 'monsters'|'market';

const getTournamentLabel = (type?: string | null) => {
    if (type === 'CASH_CUP') return '💰 Cash Cup';
    if (type === 'HOURLY') return '⏱ Hourly Tournament';
    if (type === 'DAILY') return '📅 Daily Tournament';
    return '🎯 Турнир';
};

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
                         t
                     }: {
    token: string;
    onStarsChange?: (stars: number) => void;
    t: (key: string) => string;
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
                <h2 className="panel-title">{t('dailyQuests')}</h2>
                <p className="panel-muted">{t('loading')}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="panel">
                <h2 className="panel-title">{t('dailyQuests')}</h2>
                <p className="panel-muted">{t('error')}: {error}</p>
            </div>
        );
    }

    return (
        <div className="panel">
            <h2 className="panel-title">{t('dailyQuests')}</h2>
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
                                    <span className="daily-badge">{t('claimed')}</span>
                                ) : q.claimable ? (
                                    <button
                                        className="daily-claim-btn"
                                        onClick={() => handleClaim(q.id)}
                                    >
                                        {t('claim')}
                                    </button>
                                ) : (
                                    <span className="daily-badge daily-badge--grey">
                                            {t('inProgress')}
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

function Shop({ token, translate }: { token: string ,translate: (key: string) => string; })
{
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
            <h2 className="panel-title">🛒 {translate('shopTitle')}</h2>
            <p className="panel-muted">{translate('yourStars')}:  <BlueStarIcon size={16} /> {stars}</p>

            {loading && <p className="panel-muted">{translate('loading')}</p>}
            {error && <p className="panel-error">{translate('error')}:{error}</p>}

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
                            <span className="shop-price">{translate('price')}: {item.price}  <BlueStarIcon size={16}/></span>
                            <button
                                className="shop-buy-btn"
                                onClick={() => handleBuy(item.id)}
                                disabled={!item.canBuy}
                            >
                                {item.level >= item.maxLevel ? translate('max') : translate('buy')}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {rewardPopup && rewardPopup.type === 'extra_time' && (
                <div className="reward-overlay" onClick={() => setRewardPopup(null)}>
                    <div className="reward-card">
                        <div className="reward-emoji">⏳</div>
                        <div className="reward-title">{translate('timeMonster')}</div>
                        <div className="reward-text">{translate('timeBonus')}</div>
                        <div className="reward-level">
                            {translate('cool')}: {rewardPopup.newLevel} / 5
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
    const [,setTournamentType] =
        useState<'HOURLY' | 'DAILY' | null>(null);
    const [isBooting, setIsBooting] = useState(true);
    const [showRoulette, setShowRoulette] = useState(false);
    const [minDelayPassed, setMinDelayPassed] = useState(false);
    const [tickets, setTickets] = useState<number>(0);
    const [lang, setLang] = useState<Lang>('ru');
    const [showLangMenu, setShowLangMenu] = useState(false);
    const [questsDot, setQuestsDot] = useState(false);
    const [match3Level, setMatch3Level] = useState<number | null>(null);
    const [showEventAd, setShowEventAd] = useState(false);
    const [incomingInvite, setIncomingInvite] = useState<any | null>(null);

    const t = (key: string) => translations[lang][key] || key;

// ───────────────── EVENT AD CONTROL ─────────────────

    const EVENT_SLUG = 'big-march-2026';

    const eventDoneKey = (slug: string) => `mc_event_done_${slug}`;

    const isEventDone = (slug: string) => {
        try {
            return localStorage.getItem(eventDoneKey(slug)) === '1';
        } catch {
            return false;
        }
    };

    const markEventDone = (slug: string) => {
        try {
            localStorage.setItem(eventDoneKey(slug), '1');
        } catch {}
    };
    const handleAcceptInvite = async (
        inviteId: number,
        payWith: 'coins' | 'tickets'
    ) => {
        try {
            const res = await apiFetch(
                `/tournament/invite/${inviteId}/accept`,
                token ?? undefined,
                {
                    method: 'POST',
                    body: JSON.stringify({ payWith }),
                }
            );

            const json = await res.json().catch(() => ({}));

            if (!res.ok) {
                const msg = String(json?.message || 'Failed to accept invite').toLowerCase();

                if (
                    msg.includes('not enough') ||
                    msg.includes('insufficient') ||
                    msg.includes('недостаточно') ||
                    msg.includes('need') ||
                    msg.includes('ticket') ||
                    msg.includes('coin')
                ) {
                    setShowCoinShop(true);
                    return;
                }

                throw new Error(json?.message || 'Failed to accept invite');
            }

            setIncomingInvite(null);

            if (json?.tournamentId) {
                setTournamentGameId(json.tournamentId);
                setCurrentPage('game');
            } else {
                setCurrentPage('tournament');
            }
        } catch (e: any) {
            alert(e.message || 'Failed to accept invite');
        }
    };

    const handleDeclineInvite = async () => {
        if (!incomingInvite || !token) return;

        try {
            const res = await apiFetch(
                `/tournament/invite/${incomingInvite.id}/decline`,
                token,
                { method: 'POST' }
            );

            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json?.message || 'Failed to decline invite');
            }

            setIncomingInvite(null);
        } catch (e: any) {
            alert(e.message);
        }
    };
    useEffect(() => {
        if (!token) return;

        const checkInvite = async () => {
            try {
                const res = await apiFetch('/tournament/invite/pending', token);
                const json = await res.json().catch(() => ({}));

                if (json?.invite) {
                    setIncomingInvite(json.invite);
                } else {
                    setIncomingInvite(null);
                }
            } catch {}
        };

        checkInvite();
        const i = setInterval(checkInvite, 2000);

        return () => clearInterval(i);
    }, [token]);
    useEffect(() => {
        const tgLang =
            (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.language_code;

        if (tgLang === 'en') {
            setLang('en');
        } else {
            setLang('ru');
        }
    }, []);
    useEffect(() => {
        if (isBooting) return;

        // ✅ если юзер уже участвовал/играл Big March — НЕ показываем никогда
        if (isEventDone(EVENT_SLUG)) return;

        // дальше твоя логика "раз в день"
        const today = new Date().toISOString().slice(0, 10);
        const lastSeen = localStorage.getItem('mc_event_ad_last_seen');
        if (lastSeen === today) return;

        setShowEventAd(true);
        localStorage.setItem('mc_event_ad_last_seen', today);
    }, [isBooting]);

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

        const doExpand = () => {
            try {
                tg.ready?.();
                tg.expand?.();
                tg.setBackgroundColor?.('#000000');
                tg.disableVerticalSwipes?.();
            } catch {}
        };

        // 1) сразу
        doExpand();

        // 2) чуть позже — на iOS это часто решает “не фулл”
        const t1 = setTimeout(doExpand, 120);
        const t2 = setTimeout(doExpand, 350);
        const t3 = setTimeout(doExpand, 900);

        // 3) ещё и на resize (когда телега пересчитает размеры)
        const onResize = () => doExpand();
        tg.onEvent?.('viewportChanged', onResize);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            tg.offEvent?.('viewportChanged', onResize);
        };
    }, []);

    useEffect(() => {
        if (isBooting) return;
        const tg = (window as any).Telegram?.WebApp;
        if (!tg) return;

        // когда приложение реально показало UI
        tg.expand?.();
    }, [isBooting]);



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

    const refreshQuestsDot = useCallback(async () => {
        if (!token) return;

        try {
            const res = await apiFetch('/game/daily-quests', token);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return;

            const hasClaimable = !!(data.quests ?? []).some((q: any) => q.claimable);
            setQuestsDot(hasClaimable);
        } catch (e) {
            console.error(e);
        }
    }, [token]);

    useEffect(() => {
        if (!token) return;

        const sendPing = async () => {
            try {
                await apiFetch('/presence/ping', token, {
                    method: 'POST',
                    body: JSON.stringify({
                        screen: 'cashcup',
                        inGame: false,
                    }),
                });
            } catch {}
        };

        sendPing();
        const interval = setInterval(sendPing, 15000);

        return () => clearInterval(interval);
    }, [token]);

    useEffect(() => {
        if (!token) return;
        refreshQuestsDot();
    }, [token, refreshQuestsDot]);

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

                                <div className="header-actions-column">
                                    <div
                                        className="header-wallet-btn"
                                        onClick={() => setCurrentPage('wallet')}
                                    >
                                        <WalletIcon />
                                    </div>

                                    <div className="header-lang-wrapper">
                                        <button
                                            className="lang-glass-btn"
                                            onClick={() => setShowLangMenu(v => !v)}
                                        >
                                            🌍
                                        </button>

                                        {showLangMenu && (
                                            <div className="lang-glass-menu">
                                                <button
                                                    className={lang === 'ru' ? 'active' : ''}
                                                    onClick={() => {
                                                        setLang('ru');
                                                        setShowLangMenu(false);
                                                    }}
                                                >
                                                    🇷🇺 Русский
                                                </button>
                                                <button
                                                    className={lang === 'en' ? 'active' : ''}
                                                    onClick={() => {
                                                        setLang('en');
                                                        setShowLangMenu(false);
                                                    }}
                                                >
                                                    🇬🇧 English
                                                </button>
                                            </div>
                                        )}
                                    </div>
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
                        <h3 className="panel-title">{t('error')}</h3>
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
                                <div className="tab-label">{t('menu')}</div>
                            </button>

                            <button
                                className={`menu-tab ${currentPage === 'game' ? 'menu-tab--active' : ''}`}
                                onClick={() => goTo('game')}
                            >
                                <div className="tab-icon">🎮</div>
                                <div className="tab-label">{t('game')}</div>
                            </button>

                            <button
                                className={`menu-tab ${currentPage === 'tournament' ? 'menu-tab--active' : ''}`}
                                onClick={() => goTo('tournament')}
                            >
                                <div className="tab-icon">🎯</div>
                                <div className="tab-label">{t('tournaments')}</div>
                            </button>
                            <button
                                className={`menu-tab ${currentPage === 'leaderboard' ? 'menu-tab--active' : ''}`}
                                onClick={() => goTo('leaderboard')}
                            >
                                <div className="tab-icon">📊</div>
                                <div className="tab-label">{t('leaderboard')}</div>
                            </button>

                        </nav>

                        {currentPage === 'cashcup' && token && (
                            <CashCupCard
                                token={token}
                                t={t}
                                onStartGame={(tournamentId) => {
                                    setTournamentGameId(tournamentId);
                                    setTournamentType(null);
                                    setCurrentPage('game');
                                }}
                                onOpenCoinsShop={() => setShowCoinShop(true)} // 🔥 ВОТ ЭТО
                            />
                        )}


                        {currentPage === 'menu' && me && (
                            <div className="panel panel-menu">
                                <HeroCard level={me.level} xp={me.xp} />

                                <button className="play-main-btn" onClick={() => setCurrentPage('game')}>
                                    <span className="play-glow" />
                                    <span className="play-shine" />

                                    <span className="play-icon">🎮</span>
                                    <span className="play-text">{t('play')}</span>
                                </button>

                                <div className="menu-actions">
                                    {/* КУПИТЬ МОНЕТЫ */}
                                    <div className="buy-coins-card" onClick={buyCoinsMenu}>
                                        <div className="buy-coins-glow" />

                                        <div className="buy-coins-icon">🪙</div>

                                        <div className="buy-coins-content">
                                            <div className="buy-coins-title">
                                                {t('buyCoins')}
                                            </div>

                                            <div className="buy-coins-subtitle">
                                                {t('buyCoinsSubtitle')}
                                            </div>

                                            <div className="buy-coins-note">
                                                {t('buyCoinsNote')}
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
                                            <div className="cashcup-prize">{t('prizePool')}</div>
                                            <div className="cashcup-amount">💰REAL CASH PRIZ</div>

                                            <div className="cashcup-info">
                                                ⏱ {t('every30min')} <br />
                                                🎟{t('entryTickets')}: 10 билетов
                                            </div>
                                        </div>

                                        <div className="cashcup-footer">
                                            <span>▶ {t('enterAndWin')}</span>
                                        </div>

                                    </div>
                                    <div className="menu-card menu-card--gold" onClick={() => setShowRoulette(true)}>
                                        <div className="menu-icon">🎰</div>
                                        <div className="menu-card-title">{t('rouletteDesc')}</div>
                                        <div className="menu-card-text">{t('rouletteDesc')}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <section className="app-content">
                            {currentPage === 'menu' && (
                                <div className="panel panel-menu">
                                    <h2 className="panel-title">{t('mainMenuTitle')}</h2>
                                    <p className="panel-muted">
                                        {t('mainMenuDesc')}
                                    </p>
                                    <div className="menu-grid">

                                        <button
                                            className="menu-card"
                                            onClick={() => setCurrentPage('wallet')}
                                        >
                                            <div className="menu-icon">👛</div>
                                            <div className="menu-card-title">{t('wallet')}</div>
                                            <div className="menu-card-text">
                                                {t('walletDesc')}
                                            </div>
                                        </button>

                                        <button
                                            className="menu-card"
                                            onClick={() => setCurrentPage('quests')}
                                        >
                                            <div className="menu-icon">✅</div>
                                            <div className="menu-card-title">{t('tasks') || 'Задания'}</div>
                                            <div className="menu-card-text">
                                                {t('tasksDesc') || 'Подпишись и получи 🎟 билеты'}
                                            </div>
                                        </button>

                                        <button
                                            className="menu-card"
                                            onClick={() => goTo('game')}
                                        >
                                            <div className="menu-icon">🎮</div>
                                            <div className="menu-card-title">
                                                {t('singleGame')}                                            </div>
                                            <div className="menu-card-text">
                                                {t('singleGameDesc')}
                                            </div>
                                        </button>
                                        <button
                                            className="menu-card"
                                            onClick={() => {
                                                setMatch3Level(null);
                                                setCurrentPage('match3');
                                            }}
                                        >
                                            <div className="menu-icon">🍬</div>
                                            <div className="menu-card-title">Monster Crush</div>
                                            <div className="menu-card-text">
                                                Match-3 · уровни · награды
                                            </div>
                                        </button>

                                        <button
                                            className="menu-btn menu-btn--secondary"
                                            onClick={() => setCurrentPage('invite')}
                                        >
                                            👥 {t('inviteFriend')}
                                        </button>
                                        <button
                                            className="menu-card"
                                            onClick={() => goTo('leaderboard')}
                                        >
                                            <div className="menu-icon">🏆</div>
                                            <div className="menu-card-title">{t('leaderboardTitle')}</div>
                                            <div className="menu-card-text">
                                                {t('leaderboardDesc')}                                            </div>
                                        </button>
                                        <button
                                            className="menu-card"
                                            onClick={() => goTo('tournament')}
                                        >
                                            <div className="menu-icon">🎯</div>
                                            <div className="menu-card-title">{t('tournaments')}</div>
                                            <div className="menu-card-text">
                                                {t('tournamentDesc')}
                                            </div>
                                        </button>
                                        {me && token && (
                                            <ExchangeTicket
                                                stars={me.stars}
                                                token={token}
                                                onStarsChange={handleStarsChange}
                                                onTicketChange={(delta) =>
                                                    setTickets((prev) => prev + delta)
                                                }
                                            />

                                        )}
                                    </div>

                                    {token && (
                                        <DailyQuests
                                            token={token}
                                            onStarsChange={handleStarsChange}
                                            t={t}
                                        />
                                    )}
                                    {token && <Shop token={token} translate={t} />}
                                </div>

                            )}
                            {showRoulette && (
                                <RouletteWheel
                                    token={token}
                                    onClose={() => setShowRoulette(false)}
                                    onReward={(r) => {
                                        // ✅ мгновенное обновление UI
                                        setMe((prev) => {
                                            if (!prev) return prev;

                                            const next = { ...prev };

                                            // списание coins за платный спин
                                            next.coins = Math.max(0, next.coins - (r.costCoins ?? 0));

                                            // начисление приза
                                            if (r.type === 'COINS' || r.type === 'JACKPOT') {
                                                next.coins = next.coins + (r.amount ?? 0);
                                            }

                                            if (r.type === 'STARS') {
                                                next.stars = next.stars + (r.amount ?? 0);
                                            }

                                            return next;
                                        });

                                        if (r.type === 'TICKETS') {
                                            setTickets((prev) => prev + (r.amount ?? 0));
                                        }

                                        // (опционально) тихо синхронизировать с сервером через 400-700мс
                                        // чтобы 100% совпало даже если на бэке что-то иначе
                                        // setTimeout(async () => { ... apiFetch('/users/me'), apiFetch('/tickets/count') ... }, 600);
                                    }}
                                />
                            )}
                            {currentPage === 'quests' && token && (
                                <div className="panel panel-menu">
                                    {/* 🔥 ЕЖЕДНЕВНЫЕ ЗАДАНИЯ */}
                                    <DailyQuests
                                        token={token}
                                        onStarsChange={handleStarsChange}
                                        t={t}
                                    />

                                    {/* 🔽 ТВОИ ОСТАЛЬНЫЕ ЗАДАНИЯ */}
                                    <Quests
                                        token={token}
                                        t={t}
                                        onBack={() => setCurrentPage('menu')}
                                        onTicketsClaimed={async () => {
                                            try {
                                                const ticketsRes = await apiFetch('/tickets/count', token);
                                                const ticketsData = await ticketsRes.json().catch(() => ({}));
                                                if (typeof ticketsData.count === 'number') {
                                                    setTickets(ticketsData.count);
                                                }

                                                const meRes = await apiFetch('/users/me', token);
                                                const meData = await meRes.json().catch(() => ({}));
                                                if (meRes.ok) {
                                                    setMe((prev) => (prev ? { ...prev, ...meData } : meData));
                                                }

                                                // ✅ после сбора пересчитать точку
                                                await refreshQuestsDot();
                                            } catch (e) {
                                                console.error(e);
                                            }
                                        }}
                                    />
                                </div>

                            )}
                            {currentPage === 'monsters' && token && (
                                <MonstersFarm token={token} />
                            )}

                            {currentPage === 'match3' && (
                                <div className="panel panel-menu">
                                    {!match3Level ? (
                                        <>
                                            <h2 className="panel-title">🍬 Monster Crush</h2>

                                            <LevelsMap
                                                onSelect={(lvl: number) => {
                                                    setMatch3Level(lvl);
                                                }}
                                            />

                                            <button
                                                className="menu-btn menu-btn--secondary"
                                                onClick={() => setCurrentPage('menu')}
                                            >
                                                ⬅ Назад
                                            </button>
                                        </>
                                    ) : (
                                        <Match3Level
                                            level={match3Level}
                                            onBack={() => setMatch3Level(null)}
                                        />
                                    )}
                                </div>

                            )}
                            {currentPage === 'market' && token && (
                                <Market
                                    token={token}
                                    t={t}
                                    onBack={() => setCurrentPage('menu')}
                                    onMeRefresh={async () => {
                                        const meRes = await apiFetch('/users/me', token);
                                        const meData = await meRes.json().catch(() => ({}));
                                        if (meRes.ok) {
                                            setMe((prev) => (prev ? { ...prev, ...meData } : meData));
                                        }
                                    }}
                                />
                            )}

                            {currentPage === 'game' && token && (
                                <Game
                                    token={token}
                                    t={t}
                                    tournamentId={tournamentGameId ?? undefined}
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

                                    <EventTournamentCard
                                        slug="big-march-2026"
                                        token={token}
                                        t={t}
                                        onCoinsChange={(coins) =>
                                            setMe((prev) => (prev ? { ...prev, coins } : prev))
                                        }
                                        onStartGame={(tournamentId) => {
                                            markEventDone('big-march-2026'); // 🔥 вот тут
                                            setTournamentGameId(tournamentId);
                                            setTournamentType(null);
                                            setCurrentPage('game');
                                        }}
                                    />

                                    <TournamentCard
                                        type="HOURLY"
                                        token={token}
                                        t={t}
                                        onStartGame={(id) => {
                                            setTournamentGameId(id);
                                            setTournamentType('HOURLY');
                                            setCurrentPage('game');
                                        }}
                                        onOpenCoinsShop={() => setShowCoinShop(true)}
                                    />


                                    <TournamentCard
                                        type="DAILY"
                                        token={token}
                                        t={t}
                                        onStartGame={(id) => {
                                            setTournamentGameId(id);
                                            setTournamentType('DAILY');
                                            setCurrentPage('game');
                                        }}
                                        onOpenCoinsShop={() => setShowCoinShop(true)}
                                    />

                                    <CashCupCard
                                        token={token}
                                        t={t}
                                        onStartGame={(tournamentId) => {
                                            setTournamentGameId(tournamentId);
                                            setTournamentType(null); // или 'CASH_CUP' если хочешь
                                            setCurrentPage('game');
                                        }}
                                        onOpenCoinsShop={() => setShowCoinShop(true)}
                                    />
                                    {/* ✅ EVENT TOURNAMENT — ВНИЗУ */}


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
                            <h3 className="panel-title">🪙 {t('buyCoinsTitle')}</h3>

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
                                    <span>{t('summonDemon')}</span>
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
                {/* FIXED BOTTOM NAV */}
                {token && (
                    <div
                        style={{
                            position: 'fixed',
                            bottom: 84, // ⬅️ выше BottomNav
                            left: 16,
                            right: 16,
                            zIndex: 50,
                        }}
                    >
                    </div>
                )}

                {!error && (
                    <BottomNav
                        active={
                            currentPage === 'tournament'
                                ? 'tournaments'
                                : currentPage === 'invite'
                                    ? 'friends'
                                    : currentPage === 'quests'
                                        ? 'quests'
                                        : currentPage === 'monsters'
                                            ? 'monster'
                                            : 'shop'
                        }
                        questsDot={questsDot}
                        eggsBadge={0}
                        onShop={() => setCurrentPage('market')}
                        onQuests={async () => {
                            await refreshQuestsDot()
                            setCurrentPage('quests')
                        }}
                        onMonster={() => {
                            setCurrentPage('monsters') // ✅ Monster Farm page
                            setShowHero(false) // на всякий (если было открыто)
                        }}
                        onFriends={() => setCurrentPage('invite')}
                        onTournaments={() => setCurrentPage('tournament')}
                    />
                )}
                {showEventAd && (
                    <div className="event-ad-overlay" onClick={() => setShowEventAd(false)}>
                        <div className="event-ad-card" onClick={(e) => e.stopPropagation()}>
                            <button
                                className="event-ad-close"
                                onClick={() => setShowEventAd(false)}
                                aria-label="close"
                            >
                                ✕
                            </button>

                            <div className="event-ad-badge">🔥 BIG EVENT</div>

                            <div className="event-ad-title">
                                Играй Big Tournament до <b>1 марта</b>!
                            </div>

                            <div className="event-ad-sub">
                                🏆 Призовой фонд: <b>10 000 coins</b> <br />
                                🐯 Стань лучшим — забери награду
                            </div>

                            <div className="event-ad-actions">
                                <button
                                    className="event-ad-btn event-ad-btn--primary"
                                    onClick={() => {
                                        setShowEventAd(false);
                                        setCurrentPage('tournament'); // кидаем в турниры
                                    }}
                                >
                                    🎮 Играть
                                </button>

                                <button
                                    className="event-ad-btn event-ad-btn--ghost"
                                    onClick={() => setShowEventAd(false)}
                                >
                                    Позже
                                </button>
                            </div>

                            <div className="event-ad-foot">
                                *Успей войти до дедлайна
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {incomingInvite && (
                <div className="invite-overlay">
                    <div className="invite-card">
                        <h3>🎯 Приглашение</h3>

                        <p>
                            {incomingInvite.fromUsername || 'Игрок'} вызывает вас в{' '}
                            <strong>
                                {getTournamentLabel(incomingInvite.tournamentType)}
                            </strong>
                        </p>

                        <p>Выберите способ входа:</p>

                        <div className="invite-actions">
                            {/* 💰 COINS */}
                            <button
                                className="invite-btn coins"
                                onClick={() => {
                                    const coinsNeed = Number(incomingInvite?.entryFeeCoins ?? 0);

                                    // если есть цена и не хватает
                                    if (coinsNeed > 0 && (me?.coins ?? 0) < coinsNeed) {
                                        setShowCoinShop(true);
                                        return;
                                    }

                                    handleAcceptInvite(incomingInvite.id, 'coins');
                                }}
                            >
                                🪙 Coins {incomingInvite?.entryFeeCoins ? `(${incomingInvite.entryFeeCoins})` : ''}
                            </button>

                            {/* 🎟 TICKETS */}
                            <button
                                className="invite-btn tickets"
                                onClick={() => {
                                    const ticketsNeed = Number(incomingInvite?.entryFeeTickets ?? 0);

                                    if (ticketsNeed > 0 && (tickets ?? 0) < ticketsNeed) {
                                        setShowCoinShop(true); // пока ведём в coin shop
                                        return;
                                    }

                                    handleAcceptInvite(incomingInvite.id, 'tickets');
                                }}
                            >
                                🎟 Tickets {incomingInvite?.entryFeeTickets ? `(${incomingInvite.entryFeeTickets})` : ''}
                            </button>

                            {/* ❌ DECLINE */}
                            <button
                                className="invite-btn decline"
                                onClick={handleDeclineInvite}
                            >
                                ❌ Отказаться
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
