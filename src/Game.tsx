            // src/Game.tsx
            import { useCallback, useEffect, useRef, useState } from 'react';
            import './Game.css';
            import { apiFetch } from './api';
            import commonImg from './assets/monsters/common.svg';
            import rareImg from './assets/monsters/rare.svg';
            import epicImg from './assets/monsters/epic.svg';
            import legendaryImg from './assets/monsters/legendary.svg';

            interface GameProps {
                token: string;
                onBack: () => void;
                t: (key: string) => string;
                onStarsChange?: (stars: number) => void;
                onStatsChange?: (stats: { stars: number; level: number; xp: number }) => void;
                tournamentId?: number; // ✅ ЕДИНСТВЕННЫЙ ИСТОЧНИК
            }


            type GameStatus = 'idle' | 'running' | 'finished';
            type GamePhase = 'intro' | 'playing';
            type MonsterRarity = 'common' | 'rare' | 'epic' | 'legendary';

            interface MonsterDef {
                img: string; // ✅ SVG файл
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
                { img: commonImg,    rarity: 'common',    score: 1,  weight: 60 },
                { img: rareImg,      rarity: 'rare',      score: 3,  weight: 25 },
                { img: epicImg,      rarity: 'epic',      score: 5,  weight: 10 },
                { img: legendaryImg, rarity: 'legendary', score: 10, weight: 5  },
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

            export function Game({ token, onBack, onStarsChange, onStatsChange,t, tournamentId}: GameProps) {
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

                // ✅/game/finish
                const finishGame = useCallback(async () => {
                    if (!gameId || finishSentRef.current) return;
                    finishSentRef.current = true;

                    setLoading(true);

                    try {
                        // 1️⃣ Завершаем игру
                        const res = await apiFetch('/game/finish', token, {
                            method: 'POST',
                            body: JSON.stringify({
                                gameId,
                                score,
                                clicks,
                                epicCount,
                            }),
                        });

                        const data = await res.json().catch(() => ({}));

                        if (!res.ok) {
                            throw new Error(data?.message || 'Не удалось завершить игру');
                        }

                        // 2️⃣ Локальные обновления
                        setBestScore((prev) =>
                            prev === null || score > prev ? score : prev,
                        );

                        if (typeof data.totalStars === 'number') {
                            onStarsChange?.(data.totalStars);
                        }

                        if (typeof data.level === 'number' && typeof data.xp === 'number') {
                            onStatsChange?.({
                                stars: data.totalStars,
                                level: data.level,
                                xp: data.xp,
                            });
                        }

                        // 3️⃣ 🔥 ОТПРАВКА РЕЗУЛЬТАТА В ТУРНИР (НОВЫЙ КОНТРАКТ)
                        if (tournamentId) {
                            const tRes = await apiFetch('/tournament/submit-score', token, {
                                method: 'POST',
                                body: JSON.stringify({
                                    tournamentId, // ✅ ЧИСЛО
                                    score,
                                }),
                            });

                            const tData = await tRes.json().catch(() => ({}));

                            if (!tRes.ok) {
                                console.error(
                                    'Tournament submit failed:',
                                    tData?.message || tData,
                                );
                            } else {
                                console.log('✅ Tournament score submitted:', tData);
                            }
                        }

                        setStatus('finished');
                    } catch (e: any) {
                        console.error('finishGame failed:', e);
                        setError(e.message || 'Ошибка завершения игры');
                    } finally {
                        setLoading(false);
                    }
                }, [
                    gameId,
                    score,
                    clicks,
                    epicCount,
                    token,
                    tournamentId, // 🔥 ВАЖНО
                    onStarsChange,
                    onStatsChange,
                ]);



                // ✅ ПРАВИЛЬНЫЙ /game/start
                const startGame = useCallback(async () => {
                    try {
                        setError('');
                        setLoading(true);
                        setScore(0);
                        setStatus('idle');
                        finishSentRef.current = false;

                        const res = await apiFetch('/game/start', token, {
                            method: 'POST',
                        });

                        const data = await res.json().catch(() => ({}));

                        if (!res.ok) {
                            console.error('startGame error response:', res.status, data);
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
                        console.error('startGame failed:', e);
                        setError(e.message || 'Ошибка старта игры');
                    } finally {
                        setLoading(false);
                    }
                }, [startLocalTimer, token]);

                // когда статус finished — шлём результат один раз
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

                    setClicks((c) => c + 1);

                    if (monster.rarity === 'epic') {
                        setEpicCount((e) => e + 1);
                    }
                    setScore((s) => s + monster.score);

                    const hitId = Date.now() + Math.random();
                    const { x, y } = monsterPos;
                    setHits((prev) => [...prev, { id: hitId, x, y, amount: monster.score }]);
                    setTimeout(() => {
                        setHits((prev) => prev.filter((h) => h.id !== hitId));
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
                                ← {t('back')}
                            </button>

                            {phase === 'playing' && (
                                <div className="game-hud">
                                    <div className="game-hud-item">
                                        <span className="game-hud-label">{t('score')}</span>
                                        <span className="game-hud-value">{score}</span>
                                    </div>
                                    <div className="game-hud-item">
                                        <span className="game-hud-label">{t('best')}</span>
                                        <span className="game-hud-value">
                                            {bestScore !== null ? bestScore : '—'}
                                        </span>
                                    </div>
                                    <div className="game-hud-item">
                                        <span className="game-hud-label">{t('time')}</span>
                                        <span className="game-hud-value">
                                            {status === 'running' ? `${secondsLeft}s` : '—'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Таймер — только в игре */}
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
                                    <h2 className="game-intro-title">{t('gameGoal')}</h2>
                                    <p className="game-intro-text">
                                        {t('gameGoalDesc')}
                                    </p>
                                </div>

                                <div className="game-intro-monsters">
                                    {MONSTERS.map((m) => (
                                        <div key={m.rarity} className="game-intro-monster-card">
                                            <div className="game-intro-monster-emoji">
                                                <img className="game-monster-img" src={m.img} alt={m.rarity} />
                                            </div>
                                            <div className="game-intro-monster-score">
                                                +{m.score} {t('points')}.
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    className="game-start-btn"
                                    onClick={() => void startGame()}
                                    disabled={loading}
                                >
                                    {loading ? t('loading') : t('startGame')}
                                </button>
                            </div>
                        )}

                        {/* Полноэкранная арена */}
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
                                    <img
                                        className="game-monster-img game-monster-img--arena"
                                        src={monster.img}
                                        alt={monster.rarity}
                                    />
                                </div>

                                {hits.map((h) => (
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
                        {status === 'finished' && (
                            <div className="game-finish-overlay">
                                <div className="game-finish-card">
                                    <h2>🎉 Congratulations!</h2>

                                    <p className="game-finish-score">
                                        {t('youScored')} <strong>{score}</strong> {t('points')}
                                    </p>

                                    <div className="game-finish-actions">
                                        <button
                                            className="game-restart-btn"
                                            onClick={() => {
                                                setPhase('intro');
                                                setStatus('idle');
                                                setGameId(null);
                                            }}
                                        >
                                            🔄 {t('restart')}
                                        </button>

                                        <button
                                            className="game-back-btn"
                                            onClick={onBack}
                                        >
                                            ⬅ {t('back')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && <p className="game-error">Ошибка: {error}</p>}
                    </div>
                );
            }
