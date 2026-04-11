// src/EventTournamentCard.tsx
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
    fixedPrizes?: number[];
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
    const slug = 'monster-april-2026'; // 🔥 новый турнир

    const [data, setData] = useState<EventTournamentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [, setJoining] = useState(false);
    const [hint, setHint] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [timeLeft, setTimeLeft] = useState(0);
    const [joinLeft, setJoinLeft] = useState(0);

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
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        return `${m}:${(s % 60).toString().padStart(2, '0')}`;
    };

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

    if (loading) return <div className="tournament-card">Loading...</div>;
    if (error) return <div className="tournament-card error">{error}</div>;
    if (!data) return null;

    const canJoin =
        data.status === 'ACTIVE' &&
        !data.joined &&
        joinLeft > 0;

    return (
        <div className="tournament-card">
            <h3>🔥 MONSTER TOURNAMENT</h3>

            <div className="tc-row">
                <span>Entry</span>
                <strong>🪙 {data.entryFee}</strong>
            </div>

            <div className="tc-row">
                <span>Prize Pool</span>
                <strong>{data.prizePool} 🪙</strong>
            </div>

            <div className="tc-timer">
                ⏳ {formatMs(timeLeft)}
            </div>

            {/* ACTIONS */}
            <div className="tc-actions">
                {data.joined ? (
                    <button
                        className="tc-play-main"
                        onClick={() => onStartGame(data.tournamentId)}
                    >
                        🎮 PLAY
                    </button>
                ) : canJoin ? (
                    <button
                        className="tc-join-btn"
                        onClick={() => {
                            if (data.coins < data.entryFee) {
                                setHint(`Need ${data.entryFee - data.coins} coins`);
                                setTimeout(() => setHint(null), 2000);
                                return;
                            }
                            handleJoin();
                        }}
                    >
                        🔥 Join for {data.entryFee}
                    </button>
                ) : (
                    <div>Closed</div>
                )}

                {hint && <div className="tc-hint">{hint}</div>}
            </div>

            {/* LEADERBOARD */}
            <div className="tc-leaderboard">
                <h4>🏆 TOP PLAYERS</h4>

                {data.participants.map((p, i) => {
                    const medal =
                        i === 0 ? '🥇' :
                            i === 1 ? '🥈' :
                                i === 2 ? '🥉' :
                                    `#${i + 1}`;

                    return (
                        <div key={p.userId} className="tc-lb-row">
                            <div>{medal}</div>
                            <div>{p.username || 'Player'}</div>
                            <div>{p.score}</div>

                            {/* 🔥 НОВОЕ: ПРИЗ */}
                            {(p.prize ?? 0) > 0 && (
                                <div className="tc-prize">
                                    🪙 {p.prize ?? 0}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}