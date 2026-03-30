import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api';
import './TournamentLeaderboard.css';

type TournamentType = 'HOURLY' | 'DAILY' | 'CASH_CUP';
type TournamentStatus = 'ACTIVE' | 'FINISHED';

interface Participant {
    userId: number;
    username?: string | null;
    score: number;
}

interface TournamentData {
    tournamentId: number;
    type: TournamentType;
    status: TournamentStatus;
    startsAt: string;
    endsAt: string;
    prizePool: number;
    joined: boolean;
    participants: Participant[];
    entryFee: number;
    ticketsCount: number;
    coins: number;
    timeLeftSec: number;
    replayCount: number;
    usedAttempts: number;
    attemptsLeft: number;
    nextReplayPrice: number | null;
    bestScore: number
}

export function TournamentCard({
                                   type,
                                   token,
                                   onStartGame,
                                   t,
                                   onOpenCoinsShop,
                                   reloadKey = 0,
                               }: {
    type: TournamentType;
    token: string;
    onStartGame: (tournamentId: number) => void;
    onCoinsChange?: (coins: number) => void;
    onOpenCoinsShop?: () => void;
    t: (key: string) => string;
    reloadKey?: number;
}) {
    const [data, setData] = useState<TournamentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [buyingReplay, setBuyingReplay] = useState(false);
    const [hint, setHint] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [timeLeft, setTimeLeft] = useState(0);

    const handleBuyReplay = async () => {
        if (!data) return;

        try {
            setBuyingReplay(true);
            setError('');
            setHint(null);

            const res = await apiFetch(`/tournament/${data.tournamentId}/replay`, token, {
                method: 'POST',
            });

            const json = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(json.message || 'Failed to buy replay');
            }

            await load(false);

            // можно сразу запускать игру после покупки
            onStartGame(data.tournamentId);
        } catch (e: any) {
            console.error('Replay buy failed:', e);
            setHint(e.message || 'Ошибка покупки попытки');
            setTimeout(() => setHint(null), 2500);
        } finally {
            setBuyingReplay(false);
        }
    };

    const load = useCallback(
        async (first = false) => {
            if (first) setLoading(true);
            setError('');

            try {
                const res = await apiFetch(`/tournament/current?type=${type}`, token);
                const json = await res.json().catch(() => ({}));

                if (!res.ok) {
                    throw new Error(json.message || 'Failed to load tournament');
                }

                setData(json as TournamentData);
            } catch (e: any) {
                console.error('Tournament load failed:', e);
                setError(e.message || 'Ошибка загрузки турнира');
            } finally {
                if (first) setLoading(false);
            }
        },
        [type, token],
    );

    useEffect(() => {
        void load(true);
    }, [load]);

    useEffect(() => {
        const i = setInterval(() => {
            void load(false);
        }, 15000);

        return () => clearInterval(i);
    }, [load]);

    useEffect(() => {
        if (reloadKey > 0) {
            void load(false);
        }
    }, [reloadKey, load]);

    useEffect(() => {
        if (!data?.endsAt) return;

        const tick = () => {
            const endMs = new Date(data.endsAt).getTime();
            const leftMs = Math.max(0, endMs - Date.now());
            setTimeLeft(leftMs);
        };

        tick();
        const i = setInterval(tick, 1000);
        return () => clearInterval(i);
    }, [data?.endsAt, data?.tournamentId]);

    function formatMs(ms: number) {
        if (ms <= 0) return '00:00';
        const total = Math.floor(ms / 1000);
        const m = Math.floor(total / 60);
        const s = total % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    const handleJoin = async (payWith: 'tickets' | 'coins') => {
        try {
            setJoining(true);
            setError('');

            const res = await apiFetch('/tournament/join', token, {
                method: 'POST',
                body: JSON.stringify({ type, payWith }),
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.message || 'Ошибка входа');

            await load(false);
        } catch (e: any) {
            console.error('Tournament join failed:', e);
            setError(e.message || 'Ошибка входа');
        } finally {
            setJoining(false);
        }
    };

    const canJoin = data?.status === 'ACTIVE' && !data.joined;

    const canPlay = !!data?.joined && (data?.attemptsLeft ?? 0) > 0;
    const canBuyReplay =
        !!data?.joined &&
        (data?.attemptsLeft ?? 0) <= 0 &&
        data?.nextReplayPrice !== null &&
        data?.status === 'ACTIVE';

    const replayLocked =
        canBuyReplay && (data?.coins ?? 0) < (data?.nextReplayPrice ?? 0);

    const replayLimitReached =
        !!data?.joined &&
        (data?.attemptsLeft ?? 0) <= 0 &&
        data?.nextReplayPrice === null;

    const title =
        type === 'HOURLY'
            ? t('hourlyTournament')
            : type === 'DAILY'
                ? t('dailyTournament')
                : 'CASH CUP';

    if (loading) {
        return <div className="tournament-card">{t('loading')}</div>;
    }

    if (error) {
        return <div className="tournament-card error">{error}</div>;
    }

    if (!data) return null;

    return (
        <div className="tournament-card">
            <h3>{title}</h3>

            <div className="tc-row">
                <span>{t('entry')}</span>
                <strong>🎟 50 {t('or')} 🪙 {data.entryFee}</strong>
            </div>

            <div className="tc-row">
                <span>{t('prizePool')}</span>
                <strong>{data.prizePool ?? 0} 🪙</strong>
            </div>

            <div className="tc-status">
                {data.status === 'ACTIVE' ? (
                    <>
                        <span className="tc-badge tc-badge--active">🟢 {t('activeNow')}</span>

                        <div className="tc-timer">
                            ⏳ {t('timeLeft')}: <strong>{formatMs(timeLeft)}</strong>
                        </div>
                    </>
                ) : (
                    <span className="tc-badge tc-badge--finished">🏁 {t('finished')}</span>
                )}
            </div>
            {data.joined && (
                <div className="tc-progress">
                    <div className="tc-progress-card">
                        <div className="tc-progress-label">🏆 Best Score</div>
                        <div className="tc-progress-value">{data.bestScore ?? 0}</div>
                    </div>

                    <div className="tc-progress-card">
                        <div className="tc-progress-label">🎮 Attempts Left</div>
                        <div className="tc-progress-value">{data.attemptsLeft ?? 0}</div>
                    </div>

                    <div className="tc-progress-card">
                        <div className="tc-progress-label">🔁 Replays</div>
                        <div className="tc-progress-value">{data.replayCount ?? 0}/3</div>
                    </div>

                    <div className="tc-progress-card">
                        <div className="tc-progress-label">🪙 Next Try</div>
                        <div className="tc-progress-value">
                            {data.nextReplayPrice !== null ? `${data.nextReplayPrice} coins` : 'Max'}
                        </div>
                    </div>
                </div>
            )}
            <div className="tc-actions">
                {data.joined ? (
                    <>
                        {canPlay ? (
                            <button
                                className="tc-play-main"
                                onClick={() => onStartGame(data.tournamentId)}
                                disabled={joining || buyingReplay}
                            >
                                <span className="glow" />
                                🎮 {t('play')}
                            </button>
                        ) : canBuyReplay ? (
                            <div className="tc-replay-wrap">
                                <button
                                    className="tc-play-main tc-replay-main"
                                    onClick={() => {
                                        if (replayLocked) {
                                            onOpenCoinsShop?.();
                                            return;
                                        }

                                        void handleBuyReplay();
                                    }}
                                    disabled={buyingReplay}
                                >
                                    <span className="glow" />
                                    🔥 Play Again for {data.nextReplayPrice} Coins
                                </button>

                                <div className="tc-replay-note">
                                    Improve your best score and increase your chance to win
                                </div>
                            </div>
                        ) : replayLimitReached ? (
                            <div className="tc-closed">⛔ Replay limit reached</div>
                        ) : (
                            <div className="tc-closed">⌛ No attempts left</div>
                        )}
                    </>
                ) : canJoin ? (
                    <div className="tc-entry-cards">
                        <div
                            className={`entry-card ticket ${data.ticketsCount < 50 ? 'locked' : ''} ${joining ? 'disabled' : ''}`}
                            onClick={() => {
                                if (joining) return;

                                if (data.ticketsCount < 50) {
                                    onOpenCoinsShop?.();
                                    return;
                                }

                                void handleJoin('tickets');
                            }}
                        >
                            <div className="entry-glow" />
                            <div className="entry-icon">🎟</div>
                            <div className="entry-title">{t('joinWithTickets')}</div>
                            <div className="entry-sub">
                                {(data.ticketsCount ?? 0) >= 50
                                    ? `${t('tickets')}: ${data.ticketsCount}`
                                    : `${t('needMore')} ${50 - data.ticketsCount}`}
                            </div>
                        </div>

                        <div
                            className={`entry-card coin ${data.coins < data.entryFee ? 'locked' : ''} ${joining ? 'disabled' : ''}`}
                            onClick={() => {
                                if (joining) return;

                                if (data.coins < data.entryFee) {
                                    onOpenCoinsShop?.(); // 🔥 ПЕРЕХОД В МАГАЗИН
                                    return;
                                }

                                void handleJoin('coins');
                            }}
                        >
                            <div className="entry-glow" />
                            <div className="entry-icon">🪙</div>
                            <div className="entry-title">{t('joinWithCoins')}</div>
                            <div className="entry-sub">
                                {t('price')}: {data.entryFee} · {t('balance')}: {data.coins}
                            </div>
                        </div>

                        {hint && <div className="tc-hint">{hint}</div>}
                    </div>
                ) : (
                    <div className="tc-closed">🚫 {t('tournamentFinished')}</div>
                )}
            </div>

            <div className="tc-leaderboard">
                <h4 className="tc-lb-title">🏆 {t('tournamentTop')}</h4>

                {data.participants.length === 0 ? (
                    <div className="tc-lb-empty">{t('noPlayersYet')}</div>
                ) : (
                    <div className="tc-lb-list">
                        {data.participants.map((p, i) => {
                            const medal =
                                i === 0 ? '🥇' :
                                    i === 1 ? '🥈' :
                                        i === 2 ? '🥉' :
                                            `#${i + 1}`;

                            return (
                                <div key={p.userId} className="tc-lb-row">
                                    <div className="tc-lb-rank">{medal}</div>

                                    <div className="tc-lb-name">
                                        {p.username || t('player')}
                                    </div>

                                    <div className="tc-lb-score">
                                        {p.score} <span>pts</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}