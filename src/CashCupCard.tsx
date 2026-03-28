import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import './TournamentLeaderboard.css';

type TournamentStatus = 'ACTIVE' | 'FINISHED';

interface Participant {
    userId: number;
    username?: string | null;
    score: number;
}

interface CashCupData {
    tournamentId: number;
    status: TournamentStatus;
    startsAt: string;
    endsAt: string;
    prizePool: number;
    joined: boolean;
    participants: Participant[];
    ticketsCount: number;
    coins: number;

    replayCount: number;
    usedAttempts: number;
    attemptsLeft: number;
    nextReplayPrice: number | null;
    bestScore: number;
}

/* ───────────────── TIMER HELPER ───────────────── */
function formatMs(ms: number) {
    if (ms <= 0) return '00:00';
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getErrorMessage(e: unknown, fallback = 'Ошибка') {
    if (e instanceof Error) return e.message;
    if (typeof e === 'string') return e;
    return fallback;
}

function getApiMessage(x: unknown): string | null {
    if (typeof x === 'object' && x !== null && 'message' in x) {
        const m = (x as { message?: unknown }).message;
        if (typeof m === 'string') return m;
    }
    return null;
}

export function CashCupCard({
                                token,
                                onStartGame,
                                t,
                            }: {
    token: string;
    t: (key: string) => string;
    onStartGame: (tournamentId: number) => void;
}) {
    const [data, setData] = useState<CashCupData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [hint, setHint] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [joining, setJoining] = useState(false);
    const [buyingReplay, setBuyingReplay] = useState(false);

    const handleBuyReplay = async () => {
        if (!data) return;

        try {
            setBuyingReplay(true);
            setError('');
            setHint(null);

            const res = await apiFetch(`/tournament/${data.tournamentId}/replay`, token, {
                method: 'POST',
            });

            const json: unknown = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(getApiMessage(json) ?? 'Failed to buy replay');
            }

            await load();
        } catch (e: unknown) {
            setHint(getErrorMessage(e, 'Ошибка покупки попытки'));
            setTimeout(() => setHint(null), 2500);
        } finally {
            setBuyingReplay(false);
        }
    };
    /* ───────────────── LOAD ───────────────── */
    const load = async () => {
        try {
            setError('');
            const res = await apiFetch('/tournament/current?type=CASH_CUP', token);

            const json: unknown = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(getApiMessage(json) ?? 'Failed to load Cash Cup');
            }

            setData(json as CashCupData);
        } catch (e: unknown) {
            setError(getErrorMessage(e, 'Ошибка загрузки Cash Cup'));
        } finally {
            setLoading(false);
        }
    };

    /* ───────────── POLLING (3s) ───────────── */
    useEffect(() => {
        load();
        const i = setInterval(load, 3000);
        return () => clearInterval(i);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ───────────────── TIMER ───────────────── */
    useEffect(() => {
        if (!data?.endsAt) return;

        const tick = () => {
            const end = new Date(data.endsAt).getTime();
            setTimeLeft(end - Date.now());
        };

        tick();
        const i = setInterval(tick, 1000);
        return () => clearInterval(i);
    }, [data?.endsAt]);

    /* ───────────────── JOIN (🎟 or 🪙) ───────────────── */
    const join = async (payWith: 'tickets' | 'coins') => {
        if (!data) return;
        if (joining) return;

        try {
            setJoining(true);
            setError('');
            setHint(null);

            const canByTickets = data.ticketsCount >= 10;
            const canByCoins = data.coins >= 10;

            if (payWith === 'tickets' && !canByTickets) {
                setHint(`❌ Нужно ещё ${10 - data.ticketsCount} 🎟`);
                setTimeout(() => setHint(null), 2500);
                return;
            }

            if (payWith === 'coins' && !canByCoins) {
                setHint(`❌ Нужно ещё ${10 - data.coins} 🪙`);
                setTimeout(() => setHint(null), 2500);
                return;
            }

            console.log('[JOIN CLICK]', payWith); // ✅ 1) клик реально сюда дошел?

            const payload = { type: 'CASH_CUP', payWith };
            console.log('[JOIN PAYLOAD]', payload, JSON.stringify(payload)); // ✅ 2) что реально сериализуется

            const res = await apiFetch('/tournament/join', token, {
                method: 'POST',
                body: JSON.stringify(payload), // ✅ FIX
            });

            const json: unknown = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(getApiMessage(json) ?? 'Join failed');
            }

            await load();
        } catch (e: unknown) {
            setError(getErrorMessage(e, 'Ошибка входа'));
        } finally {
            setJoining(false);
        }
    };

    /* ───────────────── RENDER ───────────────── */
    if (loading) return <div className="tournament-card">{t('loading')}</div>;
    if (error) return <div className="tournament-card error">{error}</div>;
    if (!data) return null;

    const canByTickets = data.ticketsCount >= 10;
    const canByCoins = data.coins >= 10;

    const canPlay =
        data.joined &&
        data.status === 'ACTIVE' &&
        (data.attemptsLeft ?? 0) > 0;

    const canBuyReplay =
        data.joined &&
        data.status === 'ACTIVE' &&
        (data.attemptsLeft ?? 0) <= 0 &&
        data.nextReplayPrice !== null;

    const replayLocked =
        canBuyReplay && data.coins < (data.nextReplayPrice ?? 0);

    const replayLimitReached =
        data.joined &&
        (data.attemptsLeft ?? 0) <= 0 &&
        data.nextReplayPrice === null;

    return (
        <div className="tournament-card cash-cup">
            <h3>💰 CASH CUP</h3>

            <div className="tc-timer">
                ⏳ {timeLeft > 0 ? formatMs(timeLeft) : t('nextRound')}
            </div>

            <div className="tc-row">
                <span>🎟 / 🪙 {t('entry')}</span>
                <strong>10</strong>
            </div>

            <div className="tc-row">
                <span>💎 {t('prizePool')}</span>
                <strong>{data.prizePool} 🪙</strong>
            </div>

            {!data.joined && (
                <div className="cashcup-join-grid">
                    <button
                        className={`cashcup-join-card ticket ${!canByTickets ? 'locked' : ''}`}
                        disabled={!canByTickets || joining}
                        onClick={() => join('tickets')}
                    >
                        <div className="join-icon">🎟</div>
                        <div className="join-title">{t('joinWithTickets')}</div>
                        <div className="join-sub">
                            {canByTickets
                                ? `Цена: 10 · Баланс: ${data.ticketsCount}`
                                : `Нужно ещё ${10 - data.ticketsCount}`}
                        </div>
                    </button>

                    <button
                        className={`cashcup-join-card coin ${!canByCoins ? 'locked' : ''}`}
                        disabled={!canByCoins || joining}
                        onClick={() => join('coins')}
                    >
                        <div className="join-icon">🪙</div>
                        <div className="join-title">{t('joinWithCoins')}</div>
                        <div className="join-sub">
                            Цена: 10 · Баланс: {data.coins}
                        </div>
                    </button>
                </div>
            )}

            {hint && <div className="tc-hint">{hint}</div>}
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
            {data.joined && (
                <div className="tc-actions">
                    {data.status !== 'ACTIVE' ? (
                        <div className="tc-closed">🚫 {t('tournamentFinished')}</div>
                    ) : canPlay ? (
                        <button
                            className="tc-play-main"
                            onClick={() => onStartGame(data.tournamentId)}
                            disabled={buyingReplay}
                        >
                            🎮 {t('play')}
                        </button>
                    ) : canBuyReplay ? (
                        <div className="tc-replay-wrap">
                            <button
                                className="tc-play-main tc-replay-main"
                                disabled={buyingReplay}
                                onClick={() => {
                                    if (replayLocked) {
                                        setHint(`❌ Нужно ещё ${(data.nextReplayPrice ?? 0) - data.coins} 🪙`);
                                        setTimeout(() => setHint(null), 2500);
                                        return;
                                    }

                                    void handleBuyReplay();
                                }}
                            >
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
                </div>
            )}

            <div className="tc-leaderboard">
                <h4>🏆 {t('topPlayers')}</h4>

                {(data.participants?.length ?? 0) === 0 ? (
                    <div className="tc-lb-empty">{t('noPlayersYet')}</div>
                ) : (
                    <div className="tc-lb-list">
                        {data.participants.map((p, i) => (
                            <div key={p.userId} className="tc-lb-row">
                                <div className="tc-lb-rank">
                                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                </div>
                                <div className="tc-lb-name">{p.username || t('player')}</div>
                                <div className="tc-lb-score">{p.score}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
