import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import { EventTournamentCard } from './EventTournamentCard';
import './EventTournamentNotice.css';

interface DailyNoticeResponse {
    showNotice: boolean;
    reason?: string;
    tournament?: {
        tournamentId: number;
        slug: string;
        title: string;
        entryFee: number;
        prizePool: number;
        endsAt: string;
    };
}

export function EventTournamentNotice({
                                          token,
                                          onStartGame,
                                          onCoinsChange,
                                      }: {
    token: string;
    onStartGame: (tournamentId: number) => void;
    onCoinsChange?: (coins: number) => void;
}) {
    const slug = 'monster-april-2026';

    const [loading, setLoading] = useState(true);
    const [visible, setVisible] = useState(false);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const checkNotice = async () => {
            try {
                setLoading(true);

                const res = await apiFetch('/event-tournament/daily-notice', token, {
                    method: 'POST',
                    body: JSON.stringify({ slug }),
                });

                const json: DailyNoticeResponse = await res.json();

                if (!res.ok) {
                    throw new Error((json as any)?.message || 'Failed to check event notice');
                }

                if (!cancelled) {
                    setVisible(!!json.showNotice);
                    setChecked(true);
                }
            } catch (e) {
                console.error('daily-notice failed', e);
                if (!cancelled) {
                    setVisible(false);
                    setChecked(true);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        if (token) {
            checkNotice();
        } else {
            setLoading(false);
            setChecked(true);
        }

        return () => {
            cancelled = true;
        };
    }, [token]);

    if (loading || !checked || !visible) return null;

    return (
        <div className="event-notice-overlay" onClick={() => setVisible(false)}>
            <div
                className="event-notice-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="event-notice-close"
                    onClick={() => setVisible(false)}
                    aria-label="Close"
                    type="button"
                >
                    ×
                </button>

                <div className="event-notice-head">
                    <div className="event-notice-badge">LIMITED EVENT</div>
                    <h2>🔥 New Tournament Is Live</h2>
                    <p>
                        Join today and fight for a place in the top leaderboard.
                    </p>
                </div>

                <EventTournamentCard
                    token={token}
                    onStartGame={(tournamentId) => {
                        setVisible(false);
                        onStartGame(tournamentId);
                    }}
                    onCoinsChange={onCoinsChange}
                />
            </div>
        </div>
    );
}