import { useEffect, useState } from 'react';
import { apiFetch } from './api';

type TournamentType = 'HOURLY' | 'DAILY';

interface Participant {
    userId: number;
    username?: string | null;
    score: number;
}

interface TournamentData {
    tournamentId: number;
    endsAt: string;
    prizePool: number;
    joinDeadline: string;
    entryFee: number;
    participants: Participant[];
    joined?: boolean;
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
    const [now, setNow] = useState(Date.now());
    const [error, setError] = useState('');

    // тик таймера
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    // загрузка ОДНОГО турнира по type
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

            setData(json);
        } catch (e: any) {
            setError(e.message || 'Failed to load tournament');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        const i = setInterval(load, 10000);
        return () => clearInterval(i);
    }, [type]);

    // вступление
    const handleJoin = async () => {
        if (!data) return;
        setJoining(true);

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

    const formatTime = (ms: number) => {
        if (ms <= 0) return '00:00';
        const s = Math.floor(ms / 1000);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return h > 0
            ? `${h}:${m.toString().padStart(2, '0')}:${sec
                .toString()
                .padStart(2, '0')}`
            : `${m}:${sec.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return <div className="tournament-card">Загрузка…</div>;
    }

    if (error) {
        return <div className="tournament-card error">{error}</div>;
    }

    if (!data) return null;

    const timeLeft = new Date(data.endsAt).getTime() - now;

    const joinDeadlineLeft =
        data.joinDeadline
            ? new Date(data.joinDeadline).getTime() - now
            : 0;

    const canJoin =
        joinDeadlineLeft > 0 &&
        !data.joined &&
        timeLeft > 0;

    const title =
        type === 'HOURLY'
            ? '⏱ Почасовой турнир'
            : '📅 Ежедневный турнир';

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

            <div className="tc-timer">
                ⏳ До конца: {formatTime(timeLeft)}
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
                        🚫 Окно вступления закрыто
                    </div>
                )}
            </div>
        </div>
    );
}
