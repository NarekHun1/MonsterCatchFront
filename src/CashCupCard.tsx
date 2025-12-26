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
}

/* ───────────────── TIMER HELPER ───────────────── */
function formatMs(ms: number) {
    if (ms <= 0) return '00:00';
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s
        .toString()
        .padStart(2, '0')}`;
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

    /* ───────────────── LOAD ───────────────── */
    const load = async () => {
        try {
            const res = await apiFetch(
                '/tournament/current?type=CASH_CUP',
                token,
            );

            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || 'Failed to load Cash Cup');
            }

            setData(json);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    /* ───────────── POLLING (3s) ───────────── */
    useEffect(() => {
        load();
        const i = setInterval(load, 3000);
        return () => clearInterval(i);
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

    /* ───────────────── JOIN ───────────────── */
    const join = async () => {
        try {
            setError('');
            setHint(null);

            const canByTickets = data!.ticketsCount >= 10;
            const canByCoins = data!.coins >= 10;

            if (!canByTickets && !canByCoins) {
                setHint(`❌ ${t('needTicketsOrCoins')} (🎟 10 / 🪙 10)`);
                setTimeout(() => setHint(null), 2500);
                return;
            }

            const res = await apiFetch('/tournament/join', token, {
                method: 'POST',
                body: JSON.stringify({ type: 'CASH_CUP' }),
            });

            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message);
            }

            await load();
        } catch (e: any) {
            setError(e.message);
        }
    };

    /* ───────────────── RENDER ───────────────── */
    if (loading) {
        return <div className="tournament-card">{t('loading')}</div>;
    }

    if (error) {
        return <div className="tournament-card error">{error}</div>;
    }

    if (!data) return null;

    const canJoin = data.status === 'ACTIVE' && !data.joined;
    const canByTickets = data.ticketsCount >= 10;
    const canByCoins = data.coins >= 10;

    return (
        <div className="tournament-card cash-cup">
            <h3>💰 CASH CUP</h3>

            {/* ⏳ TIMER */}
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

            <div className="tc-actions">
                {data.joined ? (
                    <button
                        className="tc-play-main"
                        onClick={() => onStartGame(data.tournamentId)}
                    >
                        🎮 {t('play')}
                    </button>
                ) : canJoin ? (
                    <button className="tc-join" onClick={join}>
                        💰 {t('joinCashCup')}
                        <div className="tc-sub">
                            {canByTickets
                                ? '🎟 tickets'
                                : canByCoins
                                    ? '🪙 coins'
                                    : '❌'}
                        </div>
                    </button>
                ) : (
                    <div className="tc-closed">⏳ {t('waitingNextRound')}</div>
                )}

                {hint && <div className="tc-hint">{hint}</div>}
            </div>

            {/* ───────────── LEADERBOARD ───────────── */}
            <div className="tc-leaderboard">
                <h4>🏆 {t('topPlayers')}</h4>

                {(data.participants?.length ?? 0) === 0 ? (
                    <div className="tc-lb-empty">{t('noPlayersYet')}</div>
                ) : (
                    <div className="tc-lb-list">
                        {data.participants.map((p, i) => (
                            <div key={p.userId} className="tc-lb-row">
                                <div className="tc-lb-rank">
                                    {i === 0
                                        ? '🥇'
                                        : i === 1
                                            ? '🥈'
                                            : i === 2
                                                ? '🥉'
                                                : `#${i + 1}`}
                                </div>
                                <div className="tc-lb-name">
                                    {p.username || t('player')}
                                </div>
                                <div className="tc-lb-score">{p.score}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
