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
}

export function CashCupCard({
                                token,
                                onStartGame,
                            }: {
    token: string;
    onStartGame: (tournamentId: number) => void;
}) {
    const [data, setData] = useState<CashCupData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [hint, setHint] = useState<string | null>(null);

    const load = async () => {
        try {
            setLoading(true);
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

    useEffect(() => {
        load();
        const i = setInterval(load, 15000);
        return () => clearInterval(i);
    }, []);

    const join = async () => {
        try {
            setError('');
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

    if (loading) {
        return <div className="tournament-card">Загрузка…</div>;
    }

    if (error) {
        return <div className="tournament-card error">{error}</div>;
    }

    if (!data) return null;

    const canJoin = data.status === 'ACTIVE' && !data.joined;

    return (
        <div className="tournament-card cash-cup">
            <h3>💰 CASH CUP</h3>

            <div className="tc-row">
                <span>⏱ Старт</span>
                <strong>каждые 30 минут</strong>
            </div>

            <div className="tc-row">
                <span>🎟 Вход</span>
                <strong>10 билетов</strong>
            </div>

            <div className="tc-row">
                <span>💎 Призовой фонд</span>
                <strong>{data.prizePool} 🪙</strong>
            </div>

            <div className="tc-row small">
                🥇 50% · 🥈 20% · 🥉 10% · 🏦 20%
            </div>

            <div className="tc-actions">
                {data.joined ? (
                    <button
                        className="tc-play-main"
                        onClick={() => onStartGame(data.tournamentId)}
                    >
                        🎮 ИГРАТЬ
                    </button>
                ) : canJoin ? (
                    <button
                        className={`tc-join ${
                            data.ticketsCount < 10 ? 'locked' : ''
                        }`}
                        onClick={() => {
                            if (data.ticketsCount < 10) {
                                setHint(`❌ Нужно ещё ${10 - data.ticketsCount} 🎟`);
                                setTimeout(() => setHint(null), 2500);
                                return;
                            }
                            join();
                        }}
                    >
                        💰 Войти в Cash Cup
                    </button>
                ) : (
                    <div className="tc-closed">⏳ Ожидание следующего раунда</div>
                )}

                {hint && <div className="tc-hint">{hint}</div>}
            </div>

            {/* LEADERBOARD */}
            <div className="tc-leaderboard">
                <h4>🏆 Топ игроков</h4>

                {(data.participants?.length ?? 0) === 0 ? (
                    <div className="tc-lb-empty">
                        Пока никто не сыграл — будь первым 💥
                    </div>
                ) : (
                    <div className="tc-lb-list">
                        {data.participants.map((p, i) => (
                            <div key={p.userId} className="tc-lb-row">
                                <div className="tc-lb-rank">
                                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                </div>
                                <div className="tc-lb-name">
                                    {p.username || 'Игрок'}
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
