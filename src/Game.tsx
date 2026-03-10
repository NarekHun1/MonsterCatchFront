// src/Game.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import './Game.css';
import { apiFetch } from './api';
import commonImg from './assets/monsters/common.svg';
import rareImg from './assets/monsters/rare.svg';
import epicImg from './assets/monsters/epic.svg';
import legendaryImg from './assets/monsters/legendary.svg';
import melasImg from './assets/monsters/meat.svg';
import catchSfx from './assets/sfx/catch.wav';

interface GameProps {
    token: string;
    onBack: () => void;
    t: (key: string) => string;
    onStarsChange?: (stars: number) => void;
    onStatsChange?: (stats: { stars: number; level: number; xp: number }) => void;
    onLeaderboardRefresh?: () => Promise<void> | void;
    tournamentId?: number;
}

type GameStatus = 'idle' | 'running' | 'finishing' | 'finished';
type GamePhase = 'intro' | 'playing';
type MonsterRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'meet';

interface MonsterDef {
    img: string;
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
    { img: commonImg, rarity: 'common', score: 1, weight: 60 },
    { img: rareImg, rarity: 'rare', score: 3, weight: 25 },
    { img: epicImg, rarity: 'epic', score: 5, weight: 10 },
    { img: legendaryImg, rarity: 'legendary', score: 10, weight: 5 },
    { img: melasImg, rarity: 'meet', score: 1, weight: 8 },
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
    const x = 15 + Math.random() * 70;
    const y = 20 + Math.random() * 60;
    return { x, y };
}

export function Game({
                         token,
                         onBack,
                         onStarsChange,
                         onStatsChange,
                         onLeaderboardRefresh,
                         t,
                         tournamentId,
                     }: GameProps) {
    const [phase, setPhase] = useState<GamePhase>('intro');
    const [status, setStatus] = useState<GameStatus>('idle');
    const [gameId, setGameId] = useState<number | null>(null);
    const [totalMs, setTotalMs] = useState<number>(60_000);
    const [remainingMs, setRemainingMs] = useState<number>(60_000);
    const [score, setScore] = useState<number>(0);
    const [bestScore, setBestScore] = useState<number | null>(null);
    const [clicks, setClicks] = useState<number>(0);
    const [epicCount, setEpicCount] = useState<number>(0);
    const [melasCount, setMelasCount] = useState<number>(0);
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
    const hitLockRef = useRef(false);
    const catchAudioRef = useRef<HTMLAudioElement | null>(null);

    const scoreRef = useRef(0);
    const clicksRef = useRef(0);
    const epicCountRef = useRef(0);
    const melasCountRef = useRef(0);
    const gameIdRef = useRef<number | null>(null);

    useEffect(() => {
        scoreRef.current = score;
    }, [score]);

    useEffect(() => {
        clicksRef.current = clicks;
    }, [clicks]);

    useEffect(() => {
        epicCountRef.current = epicCount;
    }, [epicCount]);

    useEffect(() => {
        melasCountRef.current = melasCount;
    }, [melasCount]);

    useEffect(() => {
        gameIdRef.current = gameId;
    }, [gameId]);

    const playCatchSound = async () => {
        try {
            if (!catchAudioRef.current) {
                const a = new Audio(catchSfx);
                a.preload = 'auto';
                a.volume = 0.7;
                catchAudioRef.current = a;
            }

            const a = catchAudioRef.current;
            a.currentTime = 0;
            await a.play();
        } catch {
            // mobile autoplay errors ignore
        }
    };

    const clearTimer = useCallback(() => {
        if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const safeRefreshLeaderboard = useCallback(async () => {
        try {
            await onLeaderboardRefresh?.();
        } catch (e) {
            console.error('Leaderboard refresh failed:', e);
        }
    }, [onLeaderboardRefresh]);

    const finishGame = useCallback(async () => {
        const currentGameId = gameIdRef.current;

        if (!currentGameId) {
            console.warn('finishGame skipped: no gameId');
            return;
        }

        if (finishSentRef.current) {
            console.warn('finishGame skipped: already sent');
            return;
        }

        finishSentRef.current = true;
        setStatus('finishing');
        setLoading(true);
        setError('');

        try {
            const finalScore = scoreRef.current;
            const finalClicks = clicksRef.current;
            const finalEpicCount = epicCountRef.current;
            const finalMelasCount = melasCountRef.current;

            console.log('🎯 finishGame start', {
                gameId: currentGameId,
                tournamentId,
                finalScore,
                finalClicks,
                finalEpicCount,
                finalMelasCount,
            });

            const res = await apiFetch('/game/finish', token, {
                method: 'POST',
                body: JSON.stringify({
                    gameId: currentGameId,
                    score: finalScore,
                    clicks: finalClicks,
                    epicCount: finalEpicCount,
                    melasCount: finalMelasCount,
                }),
            });

            const data = await res.json().catch(() => ({}));

            console.log('✅ /game/finish response', {
                ok: res.ok,
                status: res.status,
                data,
            });

            if (!res.ok) {
                throw new Error((data as any)?.message || 'Не удалось завершить игру');
            }

            const finalServerScore =
                typeof (data as any)?.serverScore === 'number'
                    ? (data as any).serverScore
                    : finalScore;

            setScore(finalServerScore);
            scoreRef.current = finalServerScore;

            setBestScore((prev) =>
                prev === null || finalServerScore > prev ? finalServerScore : prev,
            );

            if (typeof (data as any)?.totalStars === 'number') {
                onStarsChange?.((data as any).totalStars);
            }

            if (
                typeof (data as any)?.level === 'number' &&
                typeof (data as any)?.xp === 'number'
            ) {
                onStatsChange?.({
                    stars:
                        typeof (data as any)?.totalStars === 'number'
                            ? (data as any).totalStars
                            : 0,
                    level: (data as any).level,
                    xp: (data as any).xp,
                });
            }

            if (typeof tournamentId === 'number') {
                console.log('🏆 submit tournament score', {
                    tournamentId,
                    score: finalServerScore,
                });

                const tRes = await apiFetch('/tournament/submit-score', token, {
                    method: 'POST',
                    body: JSON.stringify({
                        tournamentId,
                        score: finalServerScore,
                    }),
                });

                const tData = await tRes.json().catch(() => ({}));

                console.log('🏆 /tournament/submit-score response', {
                    ok: tRes.ok,
                    status: tRes.status,
                    data: tData,
                });

                if (!tRes.ok) {
                    console.error(
                        'Tournament submit failed:',
                        (tData as any)?.message || tData,
                    );
                }
            } else {
                console.log('ℹ️ No tournamentId, skipping tournament submit');
            }

            await safeRefreshLeaderboard();
            setStatus('finished');
        } catch (e: any) {
            console.error('finishGame failed:', e);
            setError(e?.message || 'Ошибка завершения игры');

            // Даже при ошибке показываем финальный экран
            setStatus('finished');

            // Иногда полезно всё равно попробовать обновить leaderboard,
            // вдруг score сохранился, а ошибка была уже после.
            await safeRefreshLeaderboard();
        } finally {
            setLoading(false);
        }
    }, [
        token,
        tournamentId,
        onStarsChange,
        onStatsChange,
        safeRefreshLeaderboard,
    ]);

    const startLocalTimer = useCallback(
        (durationMs: number) => {
            clearTimer();

            const startAt = Date.now();
            setRemainingMs(durationMs);

            timerRef.current = window.setInterval(() => {
                const elapsed = Date.now() - startAt;
                const left = durationMs - elapsed;

                if (left <= 0) {
                    setRemainingMs(0);
                    clearTimer();
                    void finishGame();
                    return;
                }

                setRemainingMs(left);
            }, 200);
        },
        [clearTimer, finishGame],
    );

    const startGame = useCallback(async () => {
        try {
            setError('');
            setLoading(true);

            finishSentRef.current = false;
            hitLockRef.current = false;

            setPhase('intro');
            setStatus('idle');

            setScore(0);
            scoreRef.current = 0;

            setClicks(0);
            clicksRef.current = 0;

            setEpicCount(0);
            epicCountRef.current = 0;

            setMelasCount(0);
            melasCountRef.current = 0;

            setHits([]);
            setIsHit(false);

            const res = await apiFetch('/game/start', token, {
                method: 'POST',
            });

            const data = await res.json().catch(() => ({}));

            console.log('🎮 /game/start response', {
                ok: res.ok,
                status: res.status,
                data,
                tournamentId,
            });

            if (!res.ok) {
                throw new Error((data as any)?.message || 'Не удалось начать игру');
            }

            const duration = (data as any)?.roundDurationMs ?? 60_000;
            const startedGameId = (data as any)?.gameId;

            if (typeof startedGameId !== 'number') {
                throw new Error('gameId не пришёл с сервера');
            }

            setGameId(startedGameId);
            gameIdRef.current = startedGameId;

            setTotalMs(duration);
            setRemainingMs(duration);

            setMonster(pickRandomMonster());
            setMonsterPos(randomPosition());

            setPhase('playing');
            setStatus('running');

            startLocalTimer(duration);
        } catch (e: any) {
            console.error('startGame failed:', e);
            setError(e?.message || 'Ошибка старта игры');
        } finally {
            setLoading(false);
        }
    }, [token, tournamentId, startLocalTimer]);

    useEffect(() => {
        const imgs = [commonImg, rareImg, epicImg, legendaryImg, melasImg];
        imgs.forEach((src) => {
            const img = new Image();
            img.src = src;
        });

        const audio = new Audio(catchSfx);
        audio.preload = 'auto';
        catchAudioRef.current = audio;

        return () => {
            clearTimer();

            if (catchAudioRef.current) {
                try {
                    catchAudioRef.current.pause();
                } catch {}
                catchAudioRef.current = null;
            }
        };
    }, [clearTimer]);

    const handleCatch = useCallback(() => {
        if (status !== 'running') return;
        if (hitLockRef.current) return;

        hitLockRef.current = true;
        void playCatchSound();

        const currentMonster = monster;
        const currentPos = monsterPos;

        setIsHit(true);
        window.setTimeout(() => {
            setIsHit(false);
        }, 120);

        setClicks((prev) => {
            const next = prev + 1;
            clicksRef.current = next;
            return next;
        });

        if (currentMonster.rarity === 'meet') {
            setMelasCount((prev) => {
                const next = prev + 1;
                melasCountRef.current = next;
                return next;
            });
        }

        if (currentMonster.rarity === 'epic') {
            setEpicCount((prev) => {
                const next = prev + 1;
                epicCountRef.current = next;
                return next;
            });
        }

        setScore((prev) => {
            const next = prev + currentMonster.score;
            scoreRef.current = next;
            return next;
        });

        const hitId = Date.now() + Math.random();

        setHits((prev) => [
            ...prev,
            {
                id: hitId,
                x: currentPos.x,
                y: currentPos.y,
                amount: currentMonster.score,
            },
        ]);

        window.setTimeout(() => {
            setHits((prev) => prev.filter((h) => h.id !== hitId));
        }, 500);

        setMonster(pickRandomMonster());
        setMonsterPos(randomPosition());

        requestAnimationFrame(() => {
            hitLockRef.current = false;
        });
    }, [status, monster, monsterPos]);

    const handleBack = () => {
        if (status === 'finishing') return;
        clearTimer();
        onBack();
    };

    const handleRestartToIntro = () => {
        if (status === 'finishing') return;

        clearTimer();
        hitLockRef.current = false;
        finishSentRef.current = false;

        setPhase('intro');
        setStatus('idle');
        setGameId(null);
        gameIdRef.current = null;
        setRemainingMs(totalMs);
        setHits([]);
        setIsHit(false);
        setError('');
    };

    const secondsLeft = Math.ceil(remainingMs / 1000);
    const progress =
        totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;

    return (
        <div className="game-fullscreen">
            <div className="game-topbar">
                <button
                    className="game-back-btn"
                    onClick={handleBack}
                    disabled={loading || status === 'finishing'}
                    type="button"
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

            {phase === 'playing' && (
                <div className="game-timer-bar game-timer-bar--overlay">
                    <div
                        className="game-timer-fill"
                        style={{ transform: `scaleX(${progress})` }}
                    />
                </div>
            )}

            {phase === 'intro' && (
                <div className="game-intro">
                    <div className="game-intro-top">
                        <h2 className="game-intro-title">{t('gameGoal')}</h2>
                        <p className="game-intro-text">{t('gameGoalDesc')}</p>
                    </div>

                    <div className="game-intro-monsters">
                        {MONSTERS.map((m) => (
                            <div key={m.rarity} className="game-intro-monster-card">
                                <div className="game-intro-monster-emoji">
                                    <img
                                        className="game-monster-img"
                                        src={m.img}
                                        alt={m.rarity}
                                    />
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
                        type="button"
                    >
                        {loading ? t('loading') : t('startGame')}
                    </button>
                </div>
            )}

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
                            touchAction: 'manipulation',
                            WebkitTapHighlightColor: 'transparent',
                        }}
                        onPointerDown={handleCatch}
                        role="button"
                        tabIndex={0}
                        aria-label="Catch monster"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleCatch();
                            }
                        }}
                    >
                        <img
                            className="game-monster-img game-monster-img--arena"
                            src={monster.img}
                            alt={monster.rarity}
                            draggable={false}
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

            {status === 'finishing' && (
                <div className="game-finish-overlay">
                    <div className="game-finish-card">
                        <h2>⏳ {t('loading')}</h2>
                        <p className="game-finish-score">Saving result...</p>
                    </div>
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
                                onClick={handleRestartToIntro}
                                type="button"
                            >
                                🔄 {t('restart')}
                            </button>

                            <button
                                className="game-back-btn"
                                onClick={handleBack}
                                type="button"
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