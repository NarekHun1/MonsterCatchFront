// src/Game.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
type MonsterRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'melas';

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

type RawTap = {
    at: number;
    x: number;
    y: number;
    hit: boolean;
    targetType: string | null;
    spawnedAt: number | null;
};

const MONSTERS: MonsterDef[] = [
    { img: commonImg, rarity: 'common', score: 1, weight: 60 },
    { img: rareImg, rarity: 'rare', score: 3, weight: 25 },
    { img: epicImg, rarity: 'epic', score: 10, weight: 10 },
    { img: legendaryImg, rarity: 'legendary', score: 5, weight: 5 },
    { img: melasImg, rarity: 'melas', score: 1, weight: 8 },
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

function mapMonsterToTargetType(rarity: MonsterRarity): string {
    if (rarity === 'epic') return 'EPIC';
    if (rarity === 'melas') return 'MELAS';
    if (rarity === 'rare') return 'RARE';
    if (rarity === 'legendary') return 'LEGENDARY';
    return 'COMMON';
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
    const [, setMelasCount] = useState<number>(0);
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
    const gameEndedRef = useRef(false);
    const catchAudioRef = useRef<HTMLAudioElement | null>(null);

    const scoreRef = useRef(0);
    const clicksRef = useRef(0); // только хиты, для UI
    const epicCountRef = useRef(0);
    const melasCountRef = useRef(0);
    const gameIdRef = useRef<number | null>(null);

    const tapsRef = useRef<RawTap[]>([]);
    const gameStartAtRef = useRef<number>(0);
    const monsterSpawnedAtRef = useRef<number>(0);

    const playCatchSound = async () => {
        try {
            if (!catchAudioRef.current) {
                const audio = new Audio(catchSfx);
                audio.preload = 'auto';
                audio.volume = 0.7;
                catchAudioRef.current = audio;
            }

            const audio = catchAudioRef.current;
            audio.currentTime = 0;
            await audio.play();
        } catch {
            // ignore
        }
    };

    const clearTimer = useCallback(() => {
        if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const spawnNextMonster = useCallback(() => {
        setMonster(pickRandomMonster());
        setMonsterPos(randomPosition());
        monsterSpawnedAtRef.current = Date.now();
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
            const localScore = scoreRef.current;
            setFinalScore(localScore);

            const res = await apiFetch('/game/finish', token, {
                method: 'POST',
                body: JSON.stringify({
                    gameId: currentGameId,
                    rawTaps: tapsRef.current,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error((data as any)?.message || 'Не удалось завершить игру');
            }

            const serverScore =
                typeof (data as any)?.serverScore === 'number'
                    ? (data as any).serverScore
                    : localScore;

            setFinalScore(serverScore);
            setScore(serverScore);

            setBestScore((prev) =>
                prev === null || serverScore > prev ? serverScore : prev,
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
                        score: serverScore,
                    }),
                });

                const tData = await tRes.json().catch(() => ({}));

                if (!tRes.ok) {
                    console.error(
                        'Tournament submit failed:',
                        (tData as any)?.message || tData,
                    );
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

            tapsRef.current = [];
            gameStartAtRef.current = Date.now();
            monsterSpawnedAtRef.current = gameStartAtRef.current;

            setHits([]);
            setIsHit(false);

            const res = await apiFetch('/game/start', token, {
                method: 'POST',
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error((data as any)?.message || 'Не удалось начать игру');
            }

            const duration = (data as any).roundDurationMs ?? 60_000;
            const startedGameId = (data as any).gameId;

            setGameId(startedGameId);
            gameIdRef.current = startedGameId;

            setTotalMs(duration);
            setRemainingMs(duration);

            spawnNextMonster();

            setStatus('running');
            setPhase('playing');
            startLocalTimer(duration);
        } catch (e: any) {
            console.error('startGame failed:', e);
            setError(e?.message || 'Ошибка старта игры');
        } finally {
            setLoading(false);
        }
    }, [startLocalTimer, token, spawnNextMonster]);

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

    const handleArenaMiss = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (status !== 'running') return;
            if (gameEndedRef.current) return;
            if (finishSentRef.current) return;

            const target = e.target as HTMLElement;
            if (target.closest('.game-monster-emoji-wrapper')) return;

            const at = Math.max(0, Date.now() - gameStartAtRef.current);

            tapsRef.current.push({
                at,
                x: e.clientX,
                y: e.clientY,
                hit: false,
                targetType: null,
                spawnedAt: null,
            });
        },
        [status],
    );

    const handleCatch = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            e.stopPropagation();

            if (status !== 'running') return;
            if (gameEndedRef.current) return;
            if (finishSentRef.current) return;
            if (hitLockRef.current) return;

            hitLockRef.current = true;
            void playCatchSound();

            const currentMonster = monster;
            const currentPos = monsterPos;

            const now = Date.now();
            const at = Math.max(0, now - gameStartAtRef.current);
            const spawnedAtAbsolute = monsterSpawnedAtRef.current || now;
            const spawnedAt = Math.max(0, spawnedAtAbsolute - gameStartAtRef.current);

            tapsRef.current.push({
                at,
                x: currentPos.x,
                y: currentPos.y,
                hit: true,
                targetType: mapMonsterToTargetType(currentMonster.rarity),
                spawnedAt,
            });

            setIsHit(true);
            window.setTimeout(() => {
                setIsHit(false);
            }, 120);

            const nextClicks = clicksRef.current + 1;
            clicksRef.current = nextClicks;
            setClicks(nextClicks);

            if (currentMonster.rarity === 'melas') {
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

            spawnNextMonster();

            requestAnimationFrame(() => {
                if (!gameEndedRef.current && !finishSentRef.current) {
                    hitLockRef.current = false;
                }
            });
        },
        [status, monster, monsterPos, spawnNextMonster],
    );

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

        tapsRef.current = [];
        gameStartAtRef.current = 0;
        monsterSpawnedAtRef.current = 0;

        setRemainingMs(totalMs);
        setHits([]);
        setIsHit(false);
        setFinalScore(null);
        setError('');
        setScore(0);
        scoreRef.current = 0;
        clicksRef.current = 0;
        epicCountRef.current = 0;
        melasCountRef.current = 0;
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
                <div
                    className="game-arena game-arena--fullscreen"
                    onPointerDown={handleArenaMiss}
                >
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