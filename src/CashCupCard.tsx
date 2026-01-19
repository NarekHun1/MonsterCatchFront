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
    const join = async (entry: 'TICKET' | 'COINS') => {
        if (!data) return;
        if (joining) return;

        try {
            setJoining(true);
            setError('');
            setHint(null);

            const canByTickets = data.ticketsCount >= 10;
            const canByCoins = data.coins >= 10;

            if (entry === 'TICKET' && !canByTickets) {
                setHint(`❌ Нужно ещё ${10 - data.ticketsCount} 🎟`);
                setTimeout(() => setHint(null), 2500);
                return;
            }

            if (entry === 'COINS' && !canByCoins) {
                setHint(`❌ Нужно ещё ${10 - data.coins} 🪙`);
                setTimeout(() => setHint(null), 2500);
                return;
            }

            const res = await apiFetch('/tournament/join', token, {
                method: 'POST',
                body: JSON.stringify({ type: 'CASH_CUP', entry }),
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
    if (loading) {
        return <div className="tournament-card">{t('loading')}</div>;
    }

    if (error) {
        return <div className="tournament-card error">{error}</div>;
    }

    if (!data) return null;

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

            {/* ───────── JOIN POLICY UI ───────── */}
            <div className="cashcup-join-grid">
                {/* 🎟 TICKETS */}
                <button
                    className={`cashcup-join-card ticket ${!canByTickets ? 'locked' : ''}`}
                    disabled={!canByTickets || joining}
                    onClick={() => join('TICKET')}
                >
                    <div className="join-icon">🎟</div>
                    <div className="join-title">{t('joinWithTickets')}</div>
                    <div className="join-sub">
                        {canByTickets
                            ? `Цена: 10 · Баланс: ${data.ticketsCount}`
                            : `Нужно ещё ${10 - data.ticketsCount}`}
                    </div>
                </button>

                {/* 🪙 COINS */}
                <button
                    className={`cashcup-join-card coin ${!canByCoins ? 'locked' : ''}`}
                    disabled={!canByCoins || joining}
                    onClick={() => join('COINS')}
                >
                    <div className="join-icon">🪙</div>
                    <div className="join-title">{t('joinWithCoins')}</div>
                    <div className="join-sub">Цена: 10 · Баланс: {data.coins}</div>
                </button>
            </div>

            {hint && <div className="tc-hint">{hint}</div>}

            {/* 🎮 PLAY */}
            {data.joined && (
                <div className="tc-actions">
                    <button className="tc-play-main" onClick={() => onStartGame(data.tournamentId)}>
                        🎮 {t('play')}
                    </button>
                </div>
            )}

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
