// src/Quests.tsx
import { useEffect, useMemo, useState } from 'react';
import './Quests.css';
import { apiFetch } from './api';

type UserQuestStatus = 'PENDING' | 'COMPLETED' | 'CLAIMED';

// ✅ ВАЖНО: у тебя в Prisma сейчас SUBSCRIBE, а не TELEGRAM_CHANNEL
type QuestType = 'SUBSCRIBE' | 'INSTAGRAM_FOLLOW' | string;

type QuestItem = {
    id: number;
    title: string;
    description?: string | null;
    rewardTickets: number;
    openUrl: string | null;
    chatUsername?: string | null;
    type?: QuestType;

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

    const statusOf = (q: QuestItem): UserQuestStatus => q.progress?.status ?? 'PENDING';

    const prettifyError = (msg?: string) => {
        const m = (msg || '').trim();

        if (!m) return 'Ошибка. Попробуй позже.';

        // Instagram flow
        if (m === 'OPEN_INSTAGRAM_FIRST')
            return 'Сначала нажми “Выполнить” и открой Instagram, потом возвращайся и нажми “Проверить”.';
        if (m === 'WAIT_A_BIT')
            return 'Подожди 10 секунд и нажми “Проверить” ещё раз.';

        // Telegram flow
        if (m === 'NOT_SUBSCRIBED')
            return 'Подписка не найдена. Подпишись на канал и попробуй снова.';
        if (m === 'SUBSCRIPTION_CHECK_FAILED')
            return 'Не удалось проверить подписку. Проверь, что бот админ в канале (или канал приватный).';
        if (m === 'QUEST_CHAT_NOT_SET')
            return 'У задания не настроен канал. Напиши администратору.';
        if (m === 'QUEST_NOT_FOUND')
            return 'Задание не найдено или отключено.';

        // Claim flow
        if (m === 'QUEST_NOT_COMPLETED')
            return 'Сначала нажми “Проверить”, потом можно забрать награду.';
        if (m === 'ALREADY_CLAIMED') return 'Награда уже получена ✅';

        return m;
    };

    const isTelegramLink = (url: string) =>
        /^https?:\/\/t\.me\//i.test(url) || /^tg:\/\//i.test(url);

    const isInstagramQuest = (q: QuestItem) => {
        if (q.type === 'INSTAGRAM_FOLLOW') return true;
        if (!q.openUrl) return false;
        return /instagram\.com/i.test(q.openUrl);
    };

    const openAnyLink = (url: string) => {
        const tg = (window as any)?.Telegram?.WebApp;

        // Telegram deep links
        if (isTelegramLink(url) && tg?.openTelegramLink) {
            tg.openTelegramLink(url);
            tg?.HapticFeedback?.impactOccurred?.('light');
            return;
        }

        // Normal links (instagram / site)
        if (tg?.openLink) {
            tg.openLink(url);
            tg?.HapticFeedback?.impactOccurred?.('light');
            return;
        }

        window.open(url, '_blank');
    };

    const load = async () => {
        setError('');
        setLoading(true);
        try {
            const res = await apiFetch('/quests', token);
            const data = await res.json().catch(() => []);
            if (!res.ok) throw new Error(prettifyError(data?.message || 'Failed to load quests'));

            const arr: QuestItem[] = Array.isArray(data) ? data : [];

            // ✅ задание исчезает после получения
            const visible = arr.filter((q) => statusOf(q) !== 'CLAIMED');

            setItems(visible);
        } catch (e: any) {
            setError(prettifyError(e?.message || 'Failed to load quests'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ✅ "Выполнить": фиксируем open на бэке и открываем ссылку
    const openTask = async (quest: QuestItem) => {
        if (!quest.openUrl) return;

        setError('');
        setBusyId(quest.id);
        try {
            await apiFetch(`/quests/${quest.id}/open`, token, { method: 'POST' }).catch(() => {});
            openAnyLink(quest.openUrl);
        } finally {
            setBusyId(null);
        }
    };

    const verify = async (questId: number) => {
        setError('');
        setBusyId(questId);
        try {
            const res = await apiFetch(`/quests/${questId}/verify`, token, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(prettifyError(data?.message || 'Verify failed'));
            await load();
        } catch (e: any) {
            setError(prettifyError(e?.message || 'Verify failed'));
        } finally {
            setBusyId(null);
        }
    };

    const claim = async (questId: number) => {
        setError('');
        setBusyId(questId);
        try {
            const res = await apiFetch(`/quests/${questId}/claim`, token, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(prettifyError(data?.message || 'Claim failed'));

            // ✅ моментально убираем карточку
            setItems((prev) => prev.filter((q) => q.id !== questId));

            onTicketsClaimed?.();
        } catch (e: any) {
            setError(prettifyError(e?.message || 'Claim failed'));
        } finally {
            setBusyId(null);
        }
    };

    const count = useMemo(() => items.length, [items]);

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
            ) : items.length === 0 ? (
                <div className="quests-empty">
                    ✅ {t('noTasks') || 'Пока нет доступных заданий. Возвращайся позже!'}
                </div>
            ) : (
                <div className="quests-list">
                    {items.map((q) => {
                        const st = statusOf(q);
                        const busy = busyId === q.id;
                        const insta = isInstagramQuest(q);

                        const doIcon = insta ? '📸' : '📣';
                        const doSub = q.openUrl
                            ? insta
                                ? 'Открыть Instagram'
                                : 'Открыть канал'
                            : 'Нет ссылки';

                        const hintPending = insta
                            ? 'Открой Instagram, подпишись и нажми “Проверить”.'
                            : 'Открой канал, подпишись и нажми “Проверить”.';

                        return (
                            <div className="quests-card" key={q.id}>
                                <div className="quests-card-top">
                                    <div className="quests-icon">🎯</div>

                                    <div className="quests-meta">
                                        <div className="quests-head-row">
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

                                        <div className="quests-reward-row">
                                            <div className="quests-reward-pill">
                        <span className="quests-reward-pill-label">
                          {t('reward') || 'Награда'}
                        </span>
                                                <span className="quests-reward-pill-val">
                          +{q.rewardTickets} 🎟
                        </span>
                                            </div>

                                            {q.chatUsername && !insta && (
                                                <div className="quests-mini">
                                                    <span className="quests-mini-dot" />
                                                    {q.chatUsername}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="quests-actions-wrap">
                                    <button
                                        className="q-btn q-btn--soft"
                                        disabled={!q.openUrl || busy || st === 'CLAIMED'}
                                        onClick={() => void openTask(q)}
                                    >
                                        <span className="q-btn-ico">{doIcon}</span>
                                        <span className="q-btn-txt">{t('doTask') || 'Выполнить'}</span>
                                        <span className="q-btn-sub">{doSub}</span>
                                    </button>

                                    <button
                                        className="q-btn q-btn--blue"
                                        disabled={busy || st === 'CLAIMED'}
                                        onClick={() => void verify(q.id)}
                                    >
                                        <span className="q-btn-ico">🔎</span>
                                        <span className="q-btn-txt">
                      {busy ? 'Проверяю...' : t('check') || 'Проверить'}
                    </span>
                                        <span className="q-btn-sub">
                      {insta ? 'Подтвердить подписку' : 'Проверить подписку'}
                    </span>
                                    </button>

                                    <button
                                        className="q-btn q-btn--gold"
                                        disabled={busy || st !== 'COMPLETED'}
                                        onClick={() => void claim(q.id)}
                                    >
                                        <span className="q-btn-ico">🎁</span>
                                        <span className="q-btn-txt">
                      {st === 'COMPLETED'
                          ? `${t('claim') || 'Забрать'} +${q.rewardTickets}`
                          : t('claim') || 'Забрать'}
                    </span>
                                        <span className="q-btn-sub">
                      {st === 'COMPLETED' ? 'Награда готова' : 'Сначала проверь'}
                    </span>
                                    </button>
                                </div>

                                <div className="quests-hint">
                                    {st === 'PENDING' && (t('taskHint1') || hintPending)}
                                    {st === 'COMPLETED' &&
                                        (t('taskHint2') || 'Подписка подтверждена. Забери награду!')}
                                    {st === 'CLAIMED' && (t('taskHint3') || 'Награда уже получена ✅')}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
