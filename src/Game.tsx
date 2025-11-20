// src/Game.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import './Game.css';
import { apiFetch } from './api';

interface GameProps {
    token: string;
    onBack: () => void;
    onStarsChange?: (stars: number) => void;
    onStatsChange?: (stats: { stars: number; level: number; xp: number }) => void;
}

type GameStatus = 'idle' | 'running' | 'finished';
type GamePhase = 'intro' | 'playing';
type MonsterRarity = 'common' | 'rare' | 'epic' | 'legendary';

interface MonsterDef {
    emoji: string;
    rarity: MonsterRarity;
    score: number;
    weight: number;
}

interface HitLabel {
    id: number;
    x: number;
    y: number;
    amount: number;
}

const MONSTERS: MonsterDef[] = [
    { emoji: '👾', rarity: 'common', score: 1, weight: 60 },
    { emoji: '🧟‍♂️', rarity: 'rare', score: 3, weight: 25 },
    { emoji: '🐉', rarity: 'epic', score: 5, weight: 10 },
    { emoji: '👑', rarity: 'legendary', score: 10, weight: 5 },
];

function pickRandomMonster(): MonsterDef {
    const totalWeight = MONSTERS.reduce((sum, m) => sum + m.weight, 0);
    const rnd = Math.random() * totalWeight;
    let acc = 0;
    for (const m of MONSTERS) {
        acc += m.weight;
        if (rnd <= acc) return m;
    }
    return MONSTERS[0];
}

function randomPosition() {
    const x = 15 + Math.random() * 70; // 15–85%
    const y = 20 + Math.random() * 60; // 20–80%
    return { x, y };
}

export function Game({ token, onBack, onStarsChange, onStatsChange }: GameProps) {
    const [phase, setPhase] = useState<GamePhase>('intro');
    const [status, setStatus] = useState<GameStatus>('idle');
    const [gameId, setGameId] = useState<number | null>(null);
    const [totalMs, setTotalMs] = useState<number>(60_000);
    const [remainingMs, setRemainingMs] = useState<number>(60_000);
    const [score, setScore] = useState<number>(0);
    const [bestScore, setBestScore] = useState<number | null>(null);
    const [clicks, setClicks] = useState<number>(0);
    const [epicCount, setEpicCount] = useState<number>(0);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    const [monster, setMonster] = useState<MonsterDef>(MONSTERS[0]);
    const [monsterPos, setMonsterPos] = useState<{ x: number; y: number }>({
        x: 50,
        y: 50,
    });
    const [isHit, setIsHit] = useState(false);
    const [hits, setHits] = useState<HitLabel[]>([]);

    const timerRef = useRef<number | null>(null);
    const finishSentRef = useRef(false);

    const clearTimer = () => {
        if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const startLocalTimer = useCallback((durationMs: number) => {
        clearTimer();
        const start = Date.now();
        setRemainingMs(durationMs);

        timerRef.current = window.setInterval(() => {
            const elapsed = Date.now() - start;
            const left = durationMs - elapsed;

            if (left <= 0) {
                setRemainingMs(0);
                clearTimer();
                setStatus('finished');
            } else {
                setRemainingMs(left);
            }
        }, 100);
    }, []);

    const finishGame = useCallback(
        async () => {
            if (!gameId || finishSentRef.current) return;
            finishSentRef.current = true;

            setLoading(true);

            try {
                const res = await apiFetch('/game/finish', token, {
                    method: 'POST',
                    body: JSON.stringify({
                        gameId,
                        score,
                        clicks,
                        epicCount,
                    }),
                });

                let data: any = {};
                try {
                    data = await res.json();
                } catch {
                    // если тело пустое — просто игнор
                }

                if (!res.ok) {
                    const msg = data?.message ?? data?.error ?? 'Не удалось завершить игру';
                    throw new Error(msg);
                }

                // обновление bestScore
                setBestScore(prev => (prev === null || score > prev ? score : prev));

                // обновляем звезды через onStarsChange, если есть
                if (typeof data.totalStars === 'number') {
                    onStarsChange?.(data.totalStars);
                }

                // обновление уровня и XP
                if (
                    typeof data.level === 'number' &&
                    typeof data.xp === 'number' &&
                    typeof onStatsChange === 'function'
                ) {
                    onStatsChange({
                        stars: data.totalStars,
                        level: data.level,
                        xp: data.xp,
                    });
                }

                // реферальная награда
                if (data.referralReward > 0) {
                    alert(`🎉 +${data.referralReward} ⭐ за первую игру друга!`);
                }

                setStatus('finished');
                return { success: true, data };
            } catch (e: any) {
                console.error(e);
                setError(e.message ?? 'Ошибка завершения игры');
                return { success: false, error: e };
            } finally {
                setLoading(false);
            }
        },
        [gameId, score, clicks, epicCount, token, onStarsChange, onStatsChange],
    );

    const startGame = useCallback(
        async () => {
            try {
                setError('');
                setLoading(true);
                setScore(0);
                setStatus('idle');
                finishSentRef.current = false;

                const res = await apiFetch('/game/start', token, {
                    method: 'POST',
                });

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.message || 'Не удалось начать игру');
                }

                const duration = data.roundDurationMs ?? 60_000;

                setGameId(data.gameId);
                setTotalMs(duration);
                setRemainingMs(duration);

                setMonster(pickRandomMonster());
                setMonsterPos(randomPosition());

                setScore(0);
                setClicks(0);
                setEpicCount(0);

                setStatus('running');
                setPhase('playing');
                startLocalTimer(duration);
            } catch (e: any) {
                console.error(e);
                setError(e.message || 'Ошибка старта игры');
            } finally {
                setLoading(false);
            }
        },
        [startLocalTimer, token],
    );

    // Когда статус finished — шлём результат один раз
    useEffect(() => {
        if (status === 'finished' && gameId) {
            clearTimer();
            void finishGame();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    useEffect(() => {
        return () => {
            clearTimer();
        };
    }, []);

    const handleCatch = () => {
        if (status !== 'running') return;

        setIsHit(true);
        setTimeout(() => setIsHit(false), 120);

        setClicks(c => c + 1);

        if (monster.rarity === 'epic') {
            setEpicCount(e => e + 1);
        }
        setScore(s => s + monster.score);

        const hitId = Date.now() + Math.random();
        const { x, y } = monsterPos;
        setHits(prev => [...prev, { id: hitId, x, y, amount: monster.score }]);
        setTimeout(() => {
            setHits(prev => prev.filter(h => h.id !== hitId));
        }, 500);

        setMonster(pickRandomMonster());
        setMonsterPos(randomPosition());
    };

    const secondsLeft = Math.ceil(remainingMs / 1000);
    const progress =
        totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;

    return (
        <div className="game-fullscreen">
            {/* Верхняя панель */}
            <div className="game-topbar">
                <button
                    className="game-back-btn"
                    onClick={() => {
                        clearTimer();
                        onBack();
                    }}
                    disabled={loading}
                >
                    ← Назад
                </button>

                {phase === 'playing' && (
                    <div className="game-hud">
                        <div className="game-hud-item">
                            <span className="game-hud-label">Счёт</span>
                            <span className="game-hud-value">{score}</span>
                        </div>
                        <div className="game-hud-item">
                            <span className="game-hud-label">Лучший</span>
                            <span className="game-hud-value">
                {bestScore !== null ? bestScore : '—'}
              </span>
                        </div>
                        <div className="game-hud-item">
                            <span className="game-hud-label">Время</span>
                            <span className="game-hud-value">
                {status === 'running' ? `${secondsLeft}s` : '—'}
              </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Таймер */}
            {phase === 'playing' && (
                <div className="game-timer-bar game-timer-bar--overlay">
                    <div
                        className="game-timer-fill"
                        style={{ transform: `scaleX(${progress})` }}
                    />
                </div>
            )}

            {/* Интро-экран */}
            {phase === 'intro' && (
                <div className="game-intro">
                    <div className="game-intro-top">
                        <h2 className="game-intro-title">Цель игры</h2>
                        <p className="game-intro-text">
                            Лови как можно больше монстров за ограниченное время.
                            У разных монстров разное количество очков.
                        </p>
                    </div>

                    <div className="game-intro-monsters">
                        {MONSTERS.map(m => (
                            <div key={m.rarity} className="game-intro-monster-card">
                                <div className="game-intro-monster-emoji">{m.emoji}</div>
                                <div className="game-intro-monster-score">+{m.score} очк.</div>
                            </div>
                        ))}
                    </div>

                    <button
                        className="game-start-btn"
                        onClick={() => void startGame()}
                        disabled={loading}
                    >
                        {loading ? 'Загрузка...' : 'Начать игру'}
                    </button>
                </div>
            )}

            {/* Игровая арена */}
            {phase === 'playing' && (
                <div className="game-arena game-arena--fullscreen">
                    <div
                        className={[
                            'game-monster-emoji-wrapper',
                            status === 'running' ? 'game-monster-emoji-wrapper--active' : '',
                            status === 'finished'
                                ? 'game-monster-emoji-wrapper--finished'
                                : '',
                            isHit ? 'game-monster-emoji-wrapper--hit' : '',
                        ]
                            .filter(Boolean)
                            .join(' ')}
                        style={{
                            left: `${monsterPos.x}%`,
                            top: `${monsterPos.y}%`,
                        }}
                        onClick={handleCatch}
                    >
                        <span className="game-monster-emoji">{monster.emoji}</span>
                    </div>

                    {hits.map(h => (
                        <div
                            key={h.id}
                            className="game-hit-label"
                            style={{
                                left: `${h.x}%`,
                                top: `${h.y}%`,
                            }}
                        >
                            +{h.amount}
                        </div>
                    ))}
                </div>
            )}

            {error && <p className="game-error">Ошибка: {error}</p>}
        </div>
    );
}
