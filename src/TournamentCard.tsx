import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import './TournamentLeaderboard.css'

type TournamentType = 'HOURLY' | 'DAILY';
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
}


export function TournamentCard({
                                   type,
                                   token,
                                   onStartGame,
                               }: {
    type: TournamentType;
    token: string;
    onStartGame: (tournamentId: number) => void;
    onCoinsChange?: (coins: number) => void;
}) {
    const [data, setData] = useState<TournamentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState('');

    // ─────────────────────────────────────────────
    // LOAD TOURNAMENT (SERVER = SOURCE OF TRUTH)
    // ─────────────────────────────────────────────
    const load = async () => {
        setLoading(true);
        setError('');

        try {
            const res = await apiFetch(
                `/tournament/current?type=${type}`,
                token,
            );

            const json = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(json.message || 'Failed to load tournament');
            }

            setData(json as TournamentData);
        } catch (e: any) {
            setError(e.message || 'Ошибка загрузки турнира');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        const i = setInterval(load, 15000); // 🔁 live leaderboard
        return () => clearInterval(i);
    }, [type]);

    // ─────────────────────────────────────────────
    // JOIN
    // ─────────────────────────────────────────────
    const handleJoin = async (entry: 'TICKETS' | 'COINS') => {
        try {
            setJoining(true);
            setError('');

            const res = await apiFetch('/tournament/join', token, {
                method: 'POST',
                body: JSON.stringify({ type, entry }),
            });

            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || 'Ошибка входа');
            }

            await load(); // 🔄 обновляем турнир
        } catch (e: any) {
            setError(e.message);
        } finally {
            setJoining(false);
        }
    };



    // ─────────────────────────────────────────────
    // UI STATE (ONLY SERVER STATUS)
    // ─────────────────────────────────────────────
    const canJoin =
        data?.status === 'ACTIVE' && !data.joined;

    const title =
        type === 'HOURLY'
            ? '⏱ Почасовой турнир'
            : '📅 Ежедневный турнир';

    // ─────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────
    if (loading) {
        return <div className="tournament-card">Загрузка…</div>;
    }

    if (error) {
        return <div className="tournament-card error">{error}</div>;
    }

    if (!data) return null;

    return (
        <div className="tournament-card">
            <h3>{title}</h3>

            <div className="tc-row">
                <span>Вход</span>
                <strong>🎟 50 или 🪙 50</strong>
            </div>

            <div className="tc-row">
                <span>Призовой фонд</span>
                <strong>{data.prizePool} 🪙</strong>
            </div>

            <div className="tc-status">
                {data.status === 'ACTIVE' ? (
                    <span className="tc-badge tc-badge--active">
            🟢 Идёт сейчас
          </span>
                ) : (
                    <span className="tc-badge tc-badge--finished">
            🏁 Завершён
          </span>
                )}
            </div>

            <div className="tc-actions">
                {/* 🎮 УЖЕ ВСТУПИЛ → ИГРАТЬ */}
                {data.joined ? (
                    <button
                        className="tc-btn play"
                        onClick={() => onStartGame(data.tournamentId)}
                    >
                        🎮 Играть
                    </button>
                ) : canJoin ? (
                    <>
                        {/* 🎟 ВХОД ЗА БИЛЕТЫ */}
                        <button
                            className="tc-btn join"
                            disabled={joining || data.ticketsCount < 50}
                            onClick={() => handleJoin('TICKETS')}
                        >
                            🎟 Войти за билеты
                            <div className="tc-btn-sub">
                                {data.ticketsCount >= 50
                                    ? `Билеты: ${data.ticketsCount}`
                                    : `Нужно ещё ${50 - data.ticketsCount}`}
                            </div>
                        </button>

                        {/* 🪙 ВХОД ЗА МОНЕТЫ */}
                        <button
                            className="tc-btn join secondary"
                            disabled={joining || data.coins < data.entryFee}
                            onClick={() => handleJoin('COINS')}
                        >
                            🪙 Войти за {data.entryFee} монет
                            <div className="tc-btn-sub">
                                Монеты: {data.coins}
                            </div>
                        </button>
                    </>
                ) : (
                    <div className="tc-closed">
                        🚫 Турнир завершён
                    </div>
                )}
            </div>



            {/* ───────────────────────────────────── */}
            {/* LEADERBOARD (как в старом коде) */}
            {/* ───────────────────────────────────── */}
            <div className="tc-leaderboard">
                <h4 className="tc-lb-title">🏆 Турнирный топ</h4>

                {data.participants.length === 0 ? (
                    <div className="tc-lb-empty">
                        Пока никто не сыграл — будь первым 💥
                    </div>
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
                                        {p.username || 'Игрок'}
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
