// src/HeroViewer.tsx
import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

function DemonModel() {
    const { scene } = useGLTF('/models/demon.glb');
    const groupRef = useRef<THREE.Group | null>(null);

    const [isReacting, setIsReacting] = useState(false);
    const shakeTimeRef = useRef(0);

    const handleClick = () => {
        setIsReacting(true);
        shakeTimeRef.current = 0.25;

        setTimeout(() => setIsReacting(false), 180);
    };

    const baseScale = 1.2;

    useFrame((state, delta) => {
        if (!groupRef.current) return;

        const t = state.clock.getElapsedTime();

        // лёгкое дыхание
        const breathe = 1 + Math.sin(t * 2) * 0.03;
        const reactBoost = isReacting ? 1.07 : 1;
        const finalScale = baseScale * breathe * reactBoost;
        groupRef.current.scale.set(finalScale, finalScale, finalScale);

        // shake эффект
        let shakeX = 0;
        if (shakeTimeRef.current > 0) {
            shakeX = Math.sin(t * 40) * 0.06;
            shakeTimeRef.current -= delta;
            if (shakeTimeRef.current < 0) shakeTimeRef.current = 0;
        }

        // позиция демона — слегка ниже центра
        groupRef.current.position.set(shakeX, -0.3, 0);
    });

    return (
        <group ref={groupRef} onClick={handleClick}>
            <primitive object={scene} />
        </group>
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
