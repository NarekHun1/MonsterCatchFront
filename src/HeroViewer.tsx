// src/HeroViewer.tsx
import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

function DemonModel() {
    const { scene } = useGLTF('/models/demon.glb');
    const groupRef = useRef<THREE.Group | null>(null);

    const [isReacting, setIsReacting] = useState(false);
    const shakeTimeRef = useRef(0);

    const [floatingText, setFloatingText] = useState<string | null>(null);
    const [textLife, setTextLife] = useState(0);

    const floatingTexts = ['🔥', '💥', '⚡', '😈', '+XP'];

    const handleClick = () => {
        setIsReacting(true);
        shakeTimeRef.current = 0.25;

        const randomText =
            floatingTexts[Math.floor(Math.random() * floatingTexts.length)];
        setFloatingText(randomText);
        setTextLife(1);

        setTimeout(() => setIsReacting(false), 180);
    };

    // ⭐ лучше подобрать меньше scale
    const baseScale = 1.2;

    useFrame((state, delta) => {
        if (!groupRef.current) return;

        const t = state.clock.getElapsedTime();

        // дыхание
        const breathe = 1 + Math.sin(t * 2) * 0.03;
        const reactBoost = isReacting ? 1.07 : 1;
        const finalScale = baseScale * breathe * reactBoost;

        groupRef.current.scale.set(finalScale, finalScale, finalScale);

        // shake
        let shakeX = 0;
        if (shakeTimeRef.current > 0) {
            shakeX = Math.sin(t * 40) * 0.06;
            shakeTimeRef.current -= delta;
        }

        // ⭐ теперь ставим демона по центру (идеально!)
        groupRef.current.position.set(shakeX, -0.3, 0);

        // text life decay
        if (textLife > 0) {
            setTextLife(prev => (prev - delta * 1 <= 0 ? 0 : prev - delta * 1));
        }
    });

    const hasText = floatingText && textLife > 0;

    // ⭐ текст ближе и меньше
    const textY = 1.7 + (1 - textLife) * 0.4; // поднимается, но мало
    const textSize = 0.35 * (0.6 + textLife * 0.4); // меньше!

    return (
        <>
            <group ref={groupRef} onClick={handleClick}>
                {/* нанесён финальный scale/позиция */}
                <primitive object={scene} />
            </group>

            {hasText && (
                <Text
                    position={[0, textY, 0]}
                    fontSize={textSize}
                    color="orange"
                    anchorX="center"
                    anchorY="middle"
                >
                    {floatingText}
                </Text>
            )}
        </>
    );
}

function HeroViewer() {
    return (
        <div className="hero-3d-wrapper">
            <Canvas
                camera={{ position: [0, 1.6, 3.8], fov: 45 }}
                style={{ width: '100%', height: '100%' }}
            >
                <ambientLight intensity={1} />
                <directionalLight position={[4, 4, 4]} intensity={1.2} />

                <DemonModel />

                <OrbitControls
                    enablePan={false}
                    enableZoom={false}
                    minPolarAngle={Math.PI / 2}
                    maxPolarAngle={Math.PI / 2}
                />
            </Canvas>
        </div>
    );
}

useGLTF.preload('/models/demon.glb');

export default HeroViewer;
