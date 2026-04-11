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
}

export function EventTournamentCard({
                                        token,
                                        onStartGame,
                                        onCoinsChange,
                                    }: {
    token: string;
    onStartGame: (tournamentId: number) => void;
    onCoinsChange?: (coins: number) => void;
}) {
    const slug = 'monster-april-2026';

    const [data, setData] = useState<EventTournamentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [, setJoining] = useState(false);
    const [hint, setHint] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [timeLeft, setTimeLeft] = useState(0);
    const [joinLeft, setJoinLeft] = useState(0);

    /* ───────── LOAD ───────── */
    const load = async (first = false) => {
        if (first) setLoading(true);
        setError('');

        try {
            const res = await apiFetch(`/event-tournament/current?slug=${slug}`, token);
            const json = await res.json();

            if (!res.ok) throw new Error(json.message);

            setData(json);
            onCoinsChange?.(json.coins ?? 0);
        } catch (e: any) {
            setError(e.message);
        } finally {
            if (first) setLoading(false);
        }
    };

    useEffect(() => {
        load(true);
        const i = setInterval(() => load(false), 15000);
        return () => clearInterval(i);
    }, []);

    /* ───────── TIMERS ───────── */
    useEffect(() => {
        if (!data?.endsAt) return;

        const tick = () => {
            const end = new Date(data.endsAt).getTime();
            setTimeLeft(Math.max(0, end - Date.now()));
        };

        tick();
        const i = setInterval(tick, 1000);
        return () => clearInterval(i);
    }, [data]);

    useEffect(() => {
        if (!data?.joinDeadline) return;

        const tick = () => {
            const end = new Date(data.joinDeadline).getTime();
            setJoinLeft(Math.max(0, end - Date.now()));
        };

        tick();
        const i = setInterval(tick, 1000);
        return () => clearInterval(i);
    }, [data]);

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

    /* ───────── JOIN ───────── */
    const handleJoin = async () => {
        if (!data) return;

        try {
            setJoining(true);

            const res = await apiFetch('/event-tournament/join', token, {
                method: 'POST',
                body: JSON.stringify({ slug }),
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.message);

            await load();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setJoining(false);
        }
    };

    /* ───────── UI ───────── */
    if (loading) return <div className="tournament-card">Loading...</div>;
    if (error) return <div className="tournament-card error">{error}</div>;
    if (!data) return null;

    const canJoin =
        data.status === 'ACTIVE' &&
        !data.joined &&
        joinLeft > 0;

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

            <div className="tc-status">
                {data.status === 'ACTIVE' ? (
                    <>
                        <span className="tc-badge tc-badge--active">🟢 Active</span>
                        <div className="tc-timer">
                            ⏳ {formatMs(timeLeft)}
                        </div>
                        <div className="tc-timer">
                            🕒 Join left: {formatMs(joinLeft)}
                        </div>
                    </>
                ) : data.status === 'PLANNED' ? (
                    <span className="tc-badge tc-badge--planned">🟡 Planned</span>
                ) : (
                    <span className="tc-badge tc-badge--finished">🏁 Finished</span>
                )}
            </div>

            {/* ───────── ACTIONS ───────── */}
            <div className="tc-actions">
                {data.joined ? (
                    <button
                        className="tc-play-main"
                        onClick={() => onStartGame(data.tournamentId)}
                    >
                        🎮 PLAY
                    </button>
                ) : canJoin ? (
                    <div
                        className={`cashcup-join-card coin ${
                            data.coins < data.entryFee ? 'locked' : ''
                        }`}
                        onClick={() => {
                            if (data.coins < data.entryFee) {
                                setHint(`❌ Need ${data.entryFee - data.coins} coins`);
                                setTimeout(() => setHint(null), 1500);
                                return;
                            }
                            handleJoin();
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

            {/* ───────── LEADERBOARD ───────── */}
            <div className="tc-leaderboard">
                <h4>🏆 TOP PLAYERS</h4>

                {data.participants.length === 0 ? (
                    <div className="tc-lb-empty">No players yet</div>
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
                                    <div className="tc-lb-name">{p.username || 'Player'}</div>
                                    <div className="tc-lb-score">{p.score}</div>

                                    {(p.prize ?? 0) > 0 && (
                                        <div className="tc-prize">
                                            🪙 {p.prize ?? 0}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}