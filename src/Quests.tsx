import { useEffect, useMemo, useState } from 'react';
import './Quests.css';
import { apiFetch } from './api';

type UserQuestStatus = 'PENDING' | 'COMPLETED' | 'CLAIMED';

type QuestItem = {
    id: number;
    title: string;
    description?: string | null;
    rewardTickets: number;
    openUrl: string | null;
    chatUsername?: string | null;

    progress?: {
        questId: number;
        status: UserQuestStatus;
        completedAt?: string | null;
        claimedAt?: string | null;
    } | null;
};

export function Quests({
                           token,
                           onBack,
                           t,
                           onTicketsClaimed,
                       }: {
    token: string;
    onBack: () => void;
    t: (key: string) => string;
    onTicketsClaimed?: () => void;
}) {
    const [items, setItems] = useState<QuestItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [error, setError] = useState('');

    const count = useMemo(() => items.length, [items]);

    const load = async () => {
        setError('');
        setLoading(true);
        try {
            const res = await apiFetch('/quests', token);
            const data = await res.json().catch(() => []);
            if (!res.ok) throw new Error(data?.message || 'Failed to load quests');
            setItems(Array.isArray(data) ? data : []);
        } catch (e: any) {
            setError(e?.message || 'Failed to load quests');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openTelegram = (url: string) => {
        const tg = (window as any)?.Telegram?.WebApp;

        // лучший способ для WebApp
        if (tg?.openTelegramLink) {
            tg.openTelegramLink(url);
            return;
        }

        // fallback
        window.open(url, '_blank');
    };

    const statusOf = (q: QuestItem): UserQuestStatus => q.progress?.status ?? 'PENDING';

    const verify = async (questId: number) => {
        setError('');
        setBusyId(questId);
        try {
            const res = await apiFetch(`/quests/${questId}/verify`, token, {
                method: 'POST',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || 'Verify failed');
            await load();
        } catch (e: any) {
            setError(e?.message || 'Verify failed');
        } finally {
            setBusyId(null);
        }
    };

    const claim = async (questId: number) => {
        setError('');
        setBusyId(questId);
        try {
            const res = await apiFetch(`/quests/${questId}/claim`, token, {
                method: 'POST',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || 'Claim failed');

            await load();
            onTicketsClaimed?.();
        } catch (e: any) {
            setError(e?.message || 'Claim failed');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="quests-page">
            <div className="quests-topbar">
                <button className="quests-back" onClick={onBack} disabled={loading}>
                    ← {t('back')}
                </button>

                <div className="quests-titlebox">
                    <div className="quests-title">✅ {t('tasks') || 'Задания'}</div>
                    <div className="quests-sub">
                        {t('tasksDesc') || 'Подпишись и получи 🎟 билеты'}
                    </div>
                </div>

                <div className="quests-count">{count}</div>
            </div>

            {error && <div className="quests-error">⚠️ {error}</div>}

            {loading ? (
                <div className="quests-skeleton">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div className="quests-card quests-card--skeleton" key={i} />
                    ))}
                </div>
            ) : (
                <div className="quests-list">
                    {items.map((q) => {
                        const st = statusOf(q);
                        const busy = busyId === q.id;

                        return (
                            <div className="quests-card" key={q.id}>
                                <div className="quests-card-head">
                                    <div className="quests-card-title">{q.title}</div>

                                    <div className={`quests-badge quests-badge--${st.toLowerCase()}`}>
                                        {st === 'PENDING' && '⏳ Не выполнено'}
                                        {st === 'COMPLETED' && '✅ Выполнено'}
                                        {st === 'CLAIMED' && '🎉 Получено'}
                                    </div>
                                </div>

                                {!!q.description && (
                                    <div className="quests-card-desc">{q.description}</div>
                                )}

                                <div className="quests-reward">
                                    <span className="quests-reward-label">{t('reward') || 'Награда'}</span>
                                    <span className="quests-reward-val">+{q.rewardTickets} 🎟</span>
                                </div>

                                <div className="quests-actions">
                                    {/* Выполнить: открыть канал */}
                                    <button
                                        className="q-btn q-btn--ghost"
                                        disabled={!q.openUrl || busy || st === 'CLAIMED'}
                                        onClick={() => q.openUrl && openTelegram(q.openUrl)}
                                    >
                                        📣 {t('doTask') || 'Выполнить'}
                                    </button>

                                    {/* Проверить */}
                                    <button
                                        className="q-btn q-btn--blue"
                                        disabled={busy || st === 'CLAIMED'}
                                        onClick={() => void verify(q.id)}
                                    >
                                        {busy ? '⏳ ...' : `🔎 ${t('check') || 'Проверить'}`}
                                    </button>

                                    {/* Забрать */}
                                    <button
                                        className="q-btn q-btn--gold"
                                        disabled={busy || st !== 'COMPLETED'}
                                        onClick={() => void claim(q.id)}
                                    >
                                        {st === 'COMPLETED'
                                            ? `🎁 ${t('claim') || 'Забрать'} +${q.rewardTickets}`
                                            : `🔒 ${t('claim') || 'Забрать'}`}
                                    </button>
                                </div>

                                <div className="quests-hint">
                                    {st === 'PENDING' &&
                                        (t('taskHint1') || 'Открой канал, подпишись и нажми “Проверить”.')}
                                    {st === 'COMPLETED' &&
                                        (t('taskHint2') || 'Подписка подтверждена. Забери награду!')}
                                    {st === 'CLAIMED' &&
                                        (t('taskHint3') || 'Награда уже получена ✅')}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
