import { useEffect, useState } from 'react';
import { apiFetch } from './api';

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
    entryFee: number;
    joined: boolean;
    participants: Participant[];
}

export function TournamentCard({
                                   type,
                                   token,
                                   onStartGame,
                                   onCoinsChange,
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
    const handleJoin = async () => {
        if (!data) return;

        setJoining(true);
        setError('');

        try {
            const res = await apiFetch('/tournament/join', token, {
                method: 'POST',
                body: JSON.stringify({ type }),
            });

            const json = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(json.message || 'Не удалось вступить');
            }

            if (typeof json.coins === 'number' && onCoinsChange) {
                onCoinsChange(json.coins);
            }

            await load();
        } catch (e: any) {
            setError(e.message || 'Ошибка вступления');
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
                <strong>{data.entryFee} 🪙</strong>
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
                {data.joined ? (
                    <button
                        className="tc-btn play"
                        onClick={() => onStartGame(data.tournamentId)}
                    >
                        🎮 Играть
                    </button>
                ) : canJoin ? (
                    <button
                        className="tc-btn join"
                        onClick={handleJoin}
                        disabled={joining}
                    >
                        {joining
                            ? 'Входим…'
                            : `Вступить за ${data.entryFee} 🪙`}
                    </button>
                ) : (
                    <div className="tc-closed">
                        🚫 Турнир завершён. Жди следующий
                    </div>
                )}
            </div>

            {/* ───────────────────────────────────── */}
            {/* LEADERBOARD (как в старом коде) */}
            {/* ───────────────────────────────────── */}
            <div className="tc-leaderboard">
                <h4>🏆 Текущий топ</h4>

                {data.participants.length === 0 ? (
                    <div className="tc-muted">
                        Пока ещё никто не отправил результат
                    </div>
                ) : (
                    data.participants.map((p, i) => (
                        <div key={p.userId} className="tc-leaderboard-row">
                            <span className="tc-place">#{i + 1}</span>
                            <span className="tc-name">
                {p.username || 'Игрок'}
              </span>
                            <strong className="tc-score">
                                {p.score}
                            </strong>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
