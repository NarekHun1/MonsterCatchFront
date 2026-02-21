// src/EventTournamentCard.tsx
import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import './EventTournament.css';

type TournamentStatus = 'PLANNED' | 'ACTIVE' | 'FINISHED';

interface Participant {
    userId: number;
    username?: string | null;
    score: number;
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
                                        slug,
                                        token,
                                        onStartGame,
                                        onCoinsChange,
                                        t,
                                    }: {
    slug: string; // "big-march-2026"
    token: string;
    onStartGame: (tournamentId: number) => void;
    onCoinsChange?: (coins: number) => void;
    t: (key: string) => string;
}) {
    const [data, setData] = useState<EventTournamentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [, setJoining] = useState(false);
    const [hint, setHint] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [timeLeft, setTimeLeft] = useState(0);
    const [joinLeft, setJoinLeft] = useState(0);

    // ─────────────────────────────────────────────
    // LOAD (SERVER = SOURCE OF TRUTH)
    // ─────────────────────────────────────────────
    const load = async (first = false) => {
        if (first) setLoading(true);
        setError('');

        try {
            const res = await apiFetch(`/event-tournament/current?slug=${encodeURIComponent(slug)}`, token);
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.message || 'Failed to load event tournament');

            setData(json as EventTournamentData);
            // ✅ если уже joined — больше никогда не показывать рекламу
            try {
                if ((json as EventTournamentData).joined) {
                    localStorage.setItem(`mc_event_done_${slug}`, '1');
                }
            } catch {}
            onCoinsChange?.((json as EventTournamentData).coins ?? 0);
        } catch (e: any) {
            setError(e.message || 'Ошибка загрузки турнира');
        } finally {
            if (first) setLoading(false);
        }
    };

    useEffect(() => {
        load(true);
        const i = setInterval(() => load(false), 15000);
        return () => clearInterval(i);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    // local timers (smooth)
    useEffect(() => {
        if (!data?.endsAt) return;

        const tick = () => {
            const endMs = new Date(data.endsAt).getTime();
            setTimeLeft(Math.max(0, endMs - Date.now()));
        };

        tick();
        const i = setInterval(tick, 1000);
        return () => clearInterval(i);
    }, [data?.endsAt, data?.tournamentId]);

    useEffect(() => {
        if (!data?.joinDeadline) return;

        const tick = () => {
            const endMs = new Date(data.joinDeadline).getTime();
            setJoinLeft(Math.max(0, endMs - Date.now()));
        };

        tick();
        const i = setInterval(tick, 1000);
        return () => clearInterval(i);
    }, [data?.joinDeadline, data?.tournamentId]);

    function formatMs(ms: number) {
        if (ms <= 0) return '00:00';
        const total = Math.floor(ms / 1000);
        const m = Math.floor(total / 60);
        const s = total % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    // ─────────────────────────────────────────────
    // JOIN (coins only)
    // ─────────────────────────────────────────────
    const handleJoin = async () => {
        if (!data) return;

        try {
            setJoining(true);
            setError('');

            const res = await apiFetch('/event-tournament/join', token, {
                method: 'POST',
                body: JSON.stringify({ slug }),
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Ошибка входа');

            await load();
            try {
                localStorage.setItem(`mc_event_done_${slug}`, '1');
            } catch {}
        } catch (e: any) {
            setError(e.message);
        } finally {
            setJoining(false);
        }
    };

    // ─────────────────────────────────────────────
    // UI STATE
    // ─────────────────────────────────────────────
    const canJoin =
        data?.status === 'ACTIVE' &&
        !data.joined &&
        joinLeft > 0;

    // ─────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────
    if (loading) {
        return <div className="tournament-card">{t('loading')}</div>;
    }

    if (error) {
        return <div className="tournament-card error">{error}</div>;
    }

    if (!data) return null;

    return (
        <div className="tournament-card">
            <h3>{data.title || '🏆 Event Tournament'}</h3>

            <div className="tc-row">
                <span>{t('entry')}</span>
                <strong>🪙 {data.entryFee}</strong>
            </div>

            <div className="tc-row">
                <span>{t('prizePool')}</span>
                <strong>{data.prizePool ?? 0} 🪙</strong>
            </div>

            <div className="tc-status">
                {data.status === 'ACTIVE' ? (
                    <>
                        <span className="tc-badge tc-badge--active">🟢 {t('activeNow')}</span>

                        <div className="tc-timer">
                            ⏳ {t('timeLeft')}: <strong>{formatMs(timeLeft)}</strong>
                        </div>

                        <div className="tc-timer">
                            🕒 {t('joinTimeLeft') || 'Join left'}: <strong>{formatMs(joinLeft)}</strong>
                        </div>
                    </>
                ) : data.status === 'PLANNED' ? (
                    <span className="tc-badge tc-badge--planned">🟡 {t('planned') || 'PLANNED'}</span>
                ) : (
                    <span className="tc-badge tc-badge--finished">🏁 {t('finished')}</span>
                )}
            </div>

            <div className="tc-actions">
                {data.joined ? (
                    <button
                        className="tc-play-main"
                        onClick={() => onStartGame(data.tournamentId)}
                    >
                        <span className="glow" />
                        🎮 {t('play')}
                    </button>
                ) : canJoin ? (
                    <div className="tc-entry-cards">
                        <div
                            className={`entry-card coin ${data.coins < data.entryFee ? 'locked' : ''}`}
                            onClick={() => {
                                if (data.coins < data.entryFee) {
                                    setHint(`❌ Нужно ещё ${data.entryFee - data.coins} 🪙`);
                                    setTimeout(() => setHint(null), 2500);
                                    return;
                                }
                                handleJoin();

                            }}
                        >
                            <div className="entry-glow" />
                            <div className="entry-icon">🪙</div>
                            <div className="entry-title">{t('joinWithCoins')}</div>
                            <div className="entry-sub">
                                {t('price')}: {data.entryFee} · {t('balance')}: {data.coins}
                            </div>
                        </div>

                        {hint && <div className="tc-hint">{hint}</div>}
                    </div>
                ) : (
                    <div className="tc-closed">
                        🚫 {joinLeft <= 0 ? (t('joinClosed') || 'Join closed') : t('tournamentFinished')}
                    </div>
                )}
            </div>

            {/* LEADERBOARD */}
            <div className="tc-leaderboard">
                <h4 className="tc-lb-title">🏆 {t('tournamentTop')}</h4>

                {data.participants.length === 0 ? (
                    <div className="tc-lb-empty">{t('noPlayersYet')}</div>
                ) : (
                    <div className="tc-lb-list">
                        {data.participants.map((p, i) => {
                            const medal =
                                i === 0 ? '🥇' :
                                    i === 1 ? '🥈' :
                                        i === 2 ? '🥉' :
                                            `#${i + 1}`;

                            return (
                                <div key={`${p.userId}-${i}`} className="tc-lb-row">
                                    <div className="tc-lb-rank">{medal}</div>

                                    <div className="tc-lb-name">
                                        {p.username || t('player')}
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