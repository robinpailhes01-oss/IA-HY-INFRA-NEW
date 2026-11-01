"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer, MeshDistortMaterial } from "@react-three/drei";
import type { Group, Mesh } from "three";

// Léa en 3D : une perle liquide irisée, cerclée de deux anneaux de lumière.
//
// Pas de visage, pas d'avatar humain : un personnage 3D réaliste vieillit mal
// et tombe vite dans l'étrange. Une matière, elle, reste élégante. La perle
// est vivante (sa surface ondule), les anneaux disent « agent en orbite
// autour de tes données » — et l'ensemble se lit encore à 60 px, ce qu'une
// sphère de verre réfractant ne faisait pas (essayé : à cette taille, elle
// ressemblait à un œil gris).
//
// L'état de Léa change le rythme : elle respire au repos, accélère quand
// elle écoute, tourbillonne quand elle réfléchit, pulse quand elle répond.
//
// L'environnement lumineux est construit sur place (Lightformer) plutôt que
// chargé depuis une image HDR distante : aucune requête réseau, et une seule
// source de lumière principale en haut à gauche, comme le reste de l'interface.

export type LeaState = "idle" | "listening" | "thinking" | "speaking";

const PARAMS: Record<LeaState, { distort: number; speed: number; spin: number; glow: number; ring: number }> = {
  idle: { distort: 0.28, speed: 1.3, spin: 0.2, glow: 0.18, ring: 0.35 },
  listening: { distort: 0.4, speed: 2.6, spin: 0.45, glow: 0.32, ring: 0.9 },
  thinking: { distort: 0.5, speed: 4, spin: 1.2, glow: 0.42, ring: 2.2 },
  speaking: { distort: 0.42, speed: 3, spin: 0.6, glow: 0.36, ring: 1.1 },
};

function Pearl({ state }: { state: LeaState }) {
  const pearl = useRef<Mesh>(null);
  const ringA = useRef<Group>(null);
  const ringB = useRef<Group>(null);
  const p = PARAMS[state];

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    if (pearl.current) {
      pearl.current.rotation.y += dt * p.spin;
      const breath = state === "speaking" ? Math.sin(t * 7) * 0.035 : Math.sin(t * 1.5) * 0.02;
      pearl.current.scale.setScalar(0.82 + breath);
    }
    if (ringA.current) ringA.current.rotation.z += dt * p.ring;
    if (ringB.current) ringB.current.rotation.z -= dt * p.ring * 0.7;
  });

  return (
    <Float speed={1.5} rotationIntensity={0.25} floatIntensity={0.35} floatingRange={[-0.05, 0.05]}>
      <mesh ref={pearl} scale={0.82}>
        <icosahedronGeometry args={[1, 24]} />
        <MeshDistortMaterial
          color="#7cbcf4"
          emissive="#2f7fe0"
          emissiveIntensity={p.glow}
          distort={p.distort}
          speed={p.speed}
          roughness={0.12}
          metalness={0.15}
          clearcoat={1}
          clearcoatRoughness={0.08}
          iridescence={1}
          iridescenceIOR={1.35}
          iridescenceThicknessRange={[180, 520]}
        />
      </mesh>

      {/* Deux orbites inclinées : l'agent qui tourne autour de tes données. */}
      <group rotation={[1.2, 0.25, 0]}>
        <group ref={ringA}>
          <mesh>
            <torusGeometry args={[1.18, 0.016, 16, 160]} />
            <meshStandardMaterial color="#ffffff" emissive="#cfe8ff" emissiveIntensity={1.2} roughness={0.3} />
          </mesh>
          <mesh position={[1.18, 0, 0]}>
            <sphereGeometry args={[0.05, 24, 24]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} />
          </mesh>
        </group>
      </group>
      <group rotation={[-1.05, -0.6, 0.4]}>
        <group ref={ringB}>
          <mesh>
            <torusGeometry args={[1.1, 0.009, 12, 160]} />
            <meshStandardMaterial color="#9fd0f7" emissive="#7cc0f5" emissiveIntensity={0.9} roughness={0.4} transparent opacity={0.85} />
          </mesh>
          <mesh position={[-1.1, 0, 0]}>
            <sphereGeometry args={[0.035, 20, 20]} />
            <meshStandardMaterial color="#cfe8ff" emissive="#cfe8ff" emissiveIntensity={1.6} />
          </mesh>
        </group>
      </group>
    </Float>
  );
}

export default function LeaOrb3D({ state = "idle", className }: { state?: LeaState; className?: string }) {
  return (
    <Canvas
      className={className}
      dpr={[1, 2]}
      camera={{ position: [0, 0, 4.1], fov: 36 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[-3, 4, 5]} intensity={1.6} color="#ffffff" />
      <pointLight position={[2.5, -2, 2]} intensity={6} color="#7cc0f5" />
      <Pearl state={state} />
      <Environment resolution={128}>
        {/* La fenêtre : la source principale, en haut à gauche. */}
        <Lightformer form="rect" intensity={5} position={[-3, 3, 4]} scale={[3, 1.6, 1]} color="#ffffff" />
        {/* Le reflet du ciel et de la mer, pour l'irisation. */}
        <Lightformer form="ring" intensity={2.4} position={[3, -1, 3]} scale={2.2} color="#9fd0f7" />
        <Lightformer form="rect" intensity={2} position={[0, -4, -1]} scale={[10, 2, 1]} color="#2f7fe0" />
        <Lightformer form="rect" intensity={1.2} position={[4, 3, -3]} scale={[4, 4, 1]} color="#c7d4fa" />
      </Environment>
    </Canvas>
  );
}
