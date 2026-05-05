import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import './EventTournament.css';

type TournamentStatus = 'PLANNED' | 'ACTIVE' | 'FINISHED';

interface Participant {
    userId: number;
    username?: string | null;
    score: number;
    prize?: number;
}

interface EventTournamentData {
    tournamentId: number;
    slug: string | null;
    title: string;
    status: TournamentStatus;
    startsAt: string;
    endsAt: string;
    joinDeadline: string;
    entryFee: number;
    prizePool: number;
    joined: boolean;
    coins: number;
    participants: Participant[];
    timeLeftSec: number;
    joinLeftSec: number;

    replayCount: number;
    usedAttempts: number;
    attemptsLeft: number;
    nextReplayPrice: number | null;
    bestScore: number;
}

function getApiMessage(x: unknown): string | null {
    if (typeof x === 'object' && x !== null && 'message' in x) {
        const m = (x as { message?: unknown }).message;
        if (typeof m === 'string') return m;
    }
    return null;
}

function getErrorMessage(e: unknown, fallback = 'Something went wrong') {
    if (e instanceof Error) return e.message;
    if (typeof e === 'string') return e;
    return fallback;
}

export function EventTournamentCard({
                                        token,
                                        onStartGame,
                                        onCoinsChange,
                                        onOpenCoinsShop,
                                    }: {
    token: string;
    onStartGame: (tournamentId: number) => void;
    onCoinsChange?: (coins: number) => void;
    onOpenCoinsShop?: () => void;
}) {
    const slug = import.meta.env.VITE_EVENT_SLUG || 'monster-may-2026';
    const [data, setData] = useState<EventTournamentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [buyingReplay, setBuyingReplay] = useState(false);
    const [hint, setHint] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [timeLeft, setTimeLeft] = useState(0);
    const [joinLeft, setJoinLeft] = useState(0);

    const load = async (first = false) => {
        if (first) setLoading(true);
        setError('');

        try {
            const res = await apiFetch(`/event-tournament/current?slug=${slug}`, token);
            const json: unknown = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(getApiMessage(json) ?? 'Failed to load tournament');
            }

            const tournamentData = json as EventTournamentData;
            setData(tournamentData);
            onCoinsChange?.(tournamentData.coins ?? 0);
        } catch (e: unknown) {
            setError(getErrorMessage(e, 'Failed to load tournament'));
        } finally {
            if (first) setLoading(false);
        }
    };

    useEffect(() => {
        load(true);
        const i = setInterval(() => load(false), 15000);
        return () => clearInterval(i);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!data?.endsAt) return;

        const tick = () => {
            const end = new Date(data.endsAt).getTime();
            setTimeLeft(Math.max(0, end - Date.now()));
        };

        tick();
        const i = setInterval(tick, 1000);
        return () => clearInterval(i);
    }, [data?.endsAt]);

    useEffect(() => {
        if (!data?.joinDeadline) return;

        const tick = () => {
            const end = new Date(data.joinDeadline).getTime();
            setJoinLeft(Math.max(0, end - Date.now()));
        };

        tick();
        const i = setInterval(tick, 1000);
        return () => clearInterval(i);
    }, [data?.joinDeadline]);

    const formatMs = (ms: number) => {
        if (ms <= 0) return '00:00';

        const total = Math.floor(ms / 1000);
        const d = Math.floor(total / 86400);
        const h = Math.floor((total % 86400) / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;

        if (d > 0) return `${d}d ${h}h`;
        if (h > 0) return `${h}h ${m}m`;

        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleJoin = async () => {
        if (!data || joining) return;

        try {
            setJoining(true);
            setError('');
            setHint(null);

            const res = await apiFetch('/event-tournament/join', token, {
                method: 'POST',
                body: JSON.stringify({ slug }),
            });

            const json: unknown = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(getApiMessage(json) ?? 'Join failed');
            }

            await load();
        } catch (e: unknown) {
            setError(getErrorMessage(e, 'Join failed'));
        } finally {
            setJoining(false);
        }
    };

    const handleBuyReplay = async () => {
        if (!data || buyingReplay) return;

        try {
            setBuyingReplay(true);
            setError('');
            setHint(null);

            const res = await apiFetch(`/event-tournament/${data.tournamentId}/replay`, token, {
                method: 'POST',
            });

            const json: unknown = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(getApiMessage(json) ?? 'Failed to buy replay');
            }

            await load();
        } catch (e: unknown) {
            setHint(getErrorMessage(e, 'Replay purchase failed'));
            setTimeout(() => setHint(null), 2000);
        } finally {
            setBuyingReplay(false);
        }
    };

    if (loading) return <div className="tournament-card">Loading...</div>;
    if (error) return <div className="tournament-card error">{error}</div>;
    if (!data) return null;

    const canJoin =
        data.status === 'ACTIVE' &&
        !data.joined &&
        joinLeft > 0;

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
        data.status === 'ACTIVE' &&
        (data.attemptsLeft ?? 0) <= 0 &&
        data.nextReplayPrice === null;

    return (
        <div className="tournament-card">
            <h3>{data.title || '🔥 MONSTER TOURNAMENT'}</h3>

            <div className="tc-row">
                <span>Entry</span>
                <strong>🪙 {data.entryFee}</strong>
            </div>

            <div className="tc-row">
                <span>Prize Pool</span>
                <strong>{data.prizePool} 🪙</strong>
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
                        <div className="tc-progress-label">🪙 Next Replay</div>
                        <div className="tc-progress-value">
                            {data.nextReplayPrice !== null ? `${data.nextReplayPrice}` : 'Max'}
                        </div>
                    </div>
                </div>
            )}

            <div className="tc-status">
                {data.status === 'ACTIVE' ? (
                    <>
                        <span className="tc-badge tc-badge--active">🟢 Active</span>
                        <div className="tc-timer">⏳ {formatMs(timeLeft)}</div>
                        <div className="tc-timer">🕒 Join left: {formatMs(joinLeft)}</div>
                    </>
                ) : data.status === 'PLANNED' ? (
                    <span className="tc-badge tc-badge--planned">🟡 Planned</span>
                ) : (
                    <span className="tc-badge tc-badge--finished">🏁 Finished</span>
                )}
            </div>

            <div className="tc-actions">
                {data.joined ? (
                    data.status !== 'ACTIVE' ? (
                        <div className="tc-closed">🚫 Tournament finished</div>
                    ) : canPlay ? (
                        <button
                            className="tc-play-main"
                            onClick={() => onStartGame(data.tournamentId)}
                            disabled={buyingReplay}
                        >
                            🎮 PLAY
                        </button>
                    ) : canBuyReplay ? (
                        <div className="tc-replay-wrap">
                            <button
                                className="tc-play-main tc-replay-main"
                                disabled={buyingReplay}
                                onClick={() => {
                                    if (replayLocked) {
                                        setHint(`❌ Need ${(data.nextReplayPrice ?? 0) - data.coins} more coins`);
                                        setTimeout(() => setHint(null), 1500);
                                        onOpenCoinsShop?.();
                                        return;
                                    }

                                    void handleBuyReplay();
                                }}
                            >
                                {buyingReplay
                                    ? '⏳ Processing...'
                                    : `🔥 Play Again for ${data.nextReplayPrice} Coins`}
                            </button>

                            <div className="tc-replay-note">
                                Buy one more try and improve your best score
                            </div>
                        </div>
                    ) : replayLimitReached ? (
                        <div className="tc-closed">⛔ Replay limit reached</div>
                    ) : (
                        <div className="tc-closed">⌛ No attempts left</div>
                    )
                ) : canJoin ? (
                    <div
                        className={`cashcup-join-card coin ${data.coins < data.entryFee ? 'locked' : ''}`}
                        onClick={() => {
                            if (data.coins < data.entryFee) {
                                setHint(`❌ Need ${data.entryFee - data.coins} coins`);
                                setTimeout(() => setHint(null), 1500);
                                onOpenCoinsShop?.();
                                return;
                            }
                            void handleJoin();
                        }}
                    >
                        <div className="join-icon">🪙</div>
                        <div className="join-title">Join with Coins</div>
                        <div className="join-sub">
                            Price: {data.entryFee} · Balance: {data.coins}
                        </div>
                    </div>
                ) : (
                    <div className="tc-closed">
                        🚫 {joinLeft <= 0 ? 'Join closed' : 'Tournament finished'}
                    </div>
                )}

                {hint && <div className="tc-hint">{hint}</div>}
            </div>

            <div className="tc-leaderboard">
                <div className="tc-lb-head">
                    <h4>🏆 TOP PLAYERS</h4>
                    <span className="tc-lb-head-sub">
                        {data.participants.length} player{data.participants.length === 1 ? '' : 's'}
                    </span>
                </div>

                {data.participants.length === 0 ? (
                    <div className="tc-lb-empty">
                        <div className="tc-lb-empty-icon">🏆</div>
                        <div className="tc-lb-empty-title">No players yet</div>
                        <div className="tc-lb-empty-sub">Be the first to enter this event tournament</div>
                    </div>
                ) : (
                    <div className="tc-lb-list">
                        {data.participants.map((p, i) => {
                            const medal =
                                i === 0 ? '🥇' :
                                    i === 1 ? '🥈' :
                                        i === 2 ? '🥉' :
                                            `#${i + 1}`;

                            const topClass =
                                i === 0 ? ' first' :
                                    i === 1 ? ' second' :
                                        i === 2 ? ' third' : '';

                            return (
                                <div key={p.userId} className={`tc-lb-row${topClass}`}>
                                    <div className="tc-lb-rank-wrap">
                                        <div className="tc-lb-rank">{medal}</div>
                                    </div>

                                    <div className="tc-lb-user">
                                        <div className="tc-lb-name">{p.username || 'Player'}</div>
                                        <div className="tc-lb-meta">
                                            Position #{i + 1}
                                        </div>
                                    </div>

                                    <div className="tc-lb-stats">
                                        <div className="tc-lb-score-box">
                                            <span className="tc-lb-score-label">Score</span>
                                            <strong className="tc-lb-score">{p.score}</strong>
                                        </div>

                                        {(p.prize ?? 0) > 0 && (
                                            <div className="tc-lb-prize-box">
                                                <span className="tc-lb-prize-label">Prize</span>
                                                <strong className="tc-prize">🪙 {p.prize ?? 0}</strong>
                                            </div>
                                        )}
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