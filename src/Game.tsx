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
    tournamentId?: number;
}

type GameStatus = 'idle' | 'running' | 'finished';
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
                         t,
                         tournamentId,
                     }: GameProps) {
    const [phase, setPhase] = useState<GamePhase>('intro');
    const [status, setStatus] = useState<GameStatus>('idle');
    const [, setGameId] = useState<number | null>(null);
    const [totalMs, setTotalMs] = useState<number>(60_000);
    const [remainingMs, setRemainingMs] = useState<number>(60_000);
    const [score, setScore] = useState<number>(0);
    const [finalScore, setFinalScore] = useState<number | null>(null);
    const [bestScore, setBestScore] = useState<number | null>(null);
    const [, setClicks] = useState<number>(0);
    const [, setEpicCount] = useState<number>(0);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [, setMelasCount] = useState<number>(0);

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
    const gameEndedRef = useRef(false);
    const catchAudioRef = useRef<HTMLAudioElement | null>(null);

    const scoreRef = useRef(0);
    const clicksRef = useRef(0);
    const epicCountRef = useRef(0);
    const melasCountRef = useRef(0);
    const gameIdRef = useRef<number | null>(null);

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
            // ignore autoplay/mobile audio errors
        }
    };

    const clearTimer = useCallback(() => {
        if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const finishGame = useCallback(async () => {
        const currentGameId = gameIdRef.current;
        if (!currentGameId || finishSentRef.current) return;

        finishSentRef.current = true;
        gameEndedRef.current = true;
        hitLockRef.current = true;
        clearTimer();
        setLoading(true);

        try {
            const finalScoreValue = scoreRef.current;
            const finalClicksValue = clicksRef.current;
            const finalEpicCountValue = epicCountRef.current;
            const finalMelasCountValue = melasCountRef.current;

            setFinalScore(finalScoreValue);

            console.log('🎯 finishGame send:', {
                gameId: currentGameId,
                score: finalScoreValue,
                clicks: finalClicksValue,
                epicCount: finalEpicCountValue,
                melasCount: finalMelasCountValue,
            });

            const res = await apiFetch('/game/finish', token, {
                method: 'POST',
                body: JSON.stringify({
                    gameId: currentGameId,
                    score: finalScoreValue,
                    clicks: finalClicksValue,
                    epicCount: finalEpicCountValue,
                    melasCount: finalMelasCountValue,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error((data as any)?.message || 'Не удалось завершить игру');
            }

            setBestScore((prev) =>
                prev === null || finalScoreValue > prev ? finalScoreValue : prev,
            );

            if (typeof (data as any).totalStars === 'number') {
                onStarsChange?.((data as any).totalStars);
            }

            if (
                typeof (data as any).totalStars === 'number' &&
                typeof (data as any).level === 'number' &&
                typeof (data as any).xp === 'number'
            ) {
                onStatsChange?.({
                    stars: (data as any).totalStars,
                    level: (data as any).level,
                    xp: (data as any).xp,
                });
            }

            if (tournamentId) {
                const tRes = await apiFetch('/tournament/submit-score', token, {
                    method: 'POST',
                    body: JSON.stringify({
                        tournamentId,
                        score: finalScoreValue,
                    }),
                });

                const tData = await tRes.json().catch(() => ({}));

                if (!tRes.ok) {
                    console.error(
                        'Tournament submit failed:',
                        (tData as any)?.message || tData,
                    );
                } else {
                    console.log('✅ Tournament score submitted:', tData);
                }
            }

            setStatus('finished');
        } catch (e: any) {
            console.error('finishGame failed:', e);
            setError(e?.message || 'Ошибка завершения игры');
            setStatus('finished');
        } finally {
            setLoading(false);
        }
    }, [clearTimer, token, tournamentId, onStarsChange, onStatsChange]);

    const startLocalTimer = useCallback(
        (durationMs: number) => {
            clearTimer();

            const startAt = Date.now();
            setRemainingMs(durationMs);

            timerRef.current = window.setInterval(() => {
                const elapsed = Date.now() - startAt;
                const left = durationMs - elapsed;

                if (left <= 0) {
                    gameEndedRef.current = true;
                    setRemainingMs(0);
                    clearTimer();
                    setStatus('finished');
                    return;
                }

                setRemainingMs(left);
            }, 100);
        },
        [clearTimer],
    );

    const startGame = useCallback(async () => {
        try {
            setError('');
            setLoading(true);

            setPhase('intro');
            setStatus('idle');

            finishSentRef.current = false;
            hitLockRef.current = false;
            gameEndedRef.current = false;

            setGameId(null);
            gameIdRef.current = null;

            setScore(0);
            scoreRef.current = 0;

            setFinalScore(null);

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

            if (!res.ok) {
                console.error('startGame error response:', res.status, data);
                throw new Error((data as any)?.message || 'Не удалось начать игру');
            }

            const duration = (data as any).roundDurationMs ?? 60_000;
            const startedGameId = (data as any).gameId;

            setGameId(startedGameId);
            gameIdRef.current = startedGameId;

            setTotalMs(duration);
            setRemainingMs(duration);

            setMonster(pickRandomMonster());
            setMonsterPos(randomPosition());

            setStatus('running');
            setPhase('playing');
            startLocalTimer(duration);
        } catch (e: any) {
            console.error('startGame failed:', e);
            setError(e?.message || 'Ошибка старта игры');
        } finally {
            setLoading(false);
        }
    }, [startLocalTimer, token]);

    useEffect(() => {
        if (status === 'finished' && gameIdRef.current && !finishSentRef.current) {
            void finishGame();
        }
    }, [status, finishGame]);

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
        if (gameEndedRef.current) return;
        if (finishSentRef.current) return;
        if (hitLockRef.current) return;

        hitLockRef.current = true;
        void playCatchSound();

        const currentMonster = monster;
        const currentPos = monsterPos;

        setIsHit(true);
        window.setTimeout(() => {
            setIsHit(false);
        }, 120);

        const nextClicks = clicksRef.current + 1;
        clicksRef.current = nextClicks;
        setClicks(nextClicks);

        if (currentMonster.rarity === 'meet') {
            const nextMelas = melasCountRef.current + 1;
            melasCountRef.current = nextMelas;
            setMelasCount(nextMelas);
        }

        if (currentMonster.rarity === 'epic') {
            const nextEpic = epicCountRef.current + 1;
            epicCountRef.current = nextEpic;
            setEpicCount(nextEpic);
        }

        const nextScore = scoreRef.current + currentMonster.score;
        scoreRef.current = nextScore;
        setScore(nextScore);

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
            if (!gameEndedRef.current && !finishSentRef.current) {
                hitLockRef.current = false;
            }
        });
    }, [status, monster, monsterPos]);

    const handleBack = () => {
        if (status === 'running' && gameIdRef.current && !finishSentRef.current) {
            gameEndedRef.current = true;
            setStatus('finished');
            return;
        }

        clearTimer();
        onBack();
    };

    const handleRestartToIntro = () => {
        clearTimer();
        hitLockRef.current = false;
        finishSentRef.current = false;
        gameEndedRef.current = false;

        setPhase('intro');
        setStatus('idle');
        setGameId(null);
        gameIdRef.current = null;

        setRemainingMs(totalMs);
        setHits([]);
        setIsHit(false);
        setFinalScore(null);
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
                    disabled={loading}
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
                            status === 'finished' ? 'game-monster-emoji-wrapper--finished' : '',
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

            {status === 'finished' && (
                <div className="game-finish-overlay">
                    <div className="game-finish-card">
                        <h2>🎉 Congratulations!</h2>

                        <p className="game-finish-score">
                            {t('youScored')} <strong>{finalScore ?? score}</strong> {t('points')}
                        </p>

                        <div className="game-finish-actions">
                            <button
                                className="game-restart-btn"
                                onClick={handleRestartToIntro}
                                type="button"
                            >
                                🔄 {t('restart')}
                            </button>

                            <button className="game-back-btn" onClick={handleBack} type="button">
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