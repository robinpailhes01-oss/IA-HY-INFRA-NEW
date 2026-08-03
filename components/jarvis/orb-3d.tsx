'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Sparkles } from '@react-three/drei';
import type { Mesh } from 'three';

export type JarvisStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

const STATUS_PARAMS: Record<JarvisStatus, { distort: number; speed: number; emissive: number; spin: number; sparkleSpeed: number }> = {
  idle: { distort: 0.25, speed: 1.2, emissive: 0.5, spin: 0.12, sparkleSpeed: 0.25 },
  listening: { distort: 0.4, speed: 2.4, emissive: 0.8, spin: 0.35, sparkleSpeed: 0.6 },
  thinking: { distort: 0.5, speed: 4, emissive: 0.9, spin: 1.1, sparkleSpeed: 1 },
  speaking: { distort: 0.65, speed: 3.2, emissive: 1.1, spin: 0.5, sparkleSpeed: 0.9 },
};

function OrbMesh({ status }: { status: JarvisStatus }) {
  const coreRef = useRef<Mesh>(null);
  const wireRef = useRef<Mesh>(null);
  const groupRef = useRef<Mesh>(null);
  const params = STATUS_PARAMS[status];

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * params.spin;
    if (wireRef.current) wireRef.current.rotation.y -= delta * params.spin * 0.6;
    if (coreRef.current) {
      // Léger "souffle" en plus de la distorsion du matériau — plus marqué
      // quand Jarvis parle, pour un effet de pulsation vivante.
      const pulse = status === 'speaking' ? Math.sin(Date.now() * 0.006) * 0.05 : Math.sin(Date.now() * 0.0015) * 0.02;
      const scale = 1 + pulse;
      coreRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1, 6]} />
        <MeshDistortMaterial
          color="#f5b942"
          emissive="#d97f0a"
          emissiveIntensity={params.emissive}
          distort={params.distort}
          speed={params.speed}
          roughness={0.2}
          metalness={0.55}
        />
      </mesh>
      <mesh ref={wireRef} scale={1.32}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ffd27a" wireframe transparent opacity={0.28} />
      </mesh>
      <Sparkles count={90} scale={3} size={2.2} speed={params.sparkleSpeed} color="#ffd27a" opacity={0.6} />
    </group>
  );
}

export default function Orb3D({ status }: { status: JarvisStatus }) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0, 4.2], fov: 40 }}
      style={{ pointerEvents: 'none' }}
    >
      <ambientLight intensity={0.5} color="#ffe6bd" />
      <pointLight position={[3, 3, 3]} intensity={2.2} color="#ffdca8" />
      <pointLight position={[-3, -2, -3]} intensity={0.7} color="#ff9c3a" />
      <OrbMesh status={status} />
    </Canvas>
  );
}
