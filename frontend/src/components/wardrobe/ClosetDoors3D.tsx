"use client";
import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei/core/PerspectiveCamera";
import { gsap, useGSAP } from "@/lib/gsap";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";
import type { Group } from "three";

export function DoorsFallback() {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-surface2">
      <svg
        viewBox="0 0 64 64"
        className="w-20 h-20 text-muted/40"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="14" y="8" width="36" height="48" rx="3" />
        <line x1="32" y1="8" x2="32" y2="56" />
        <circle cx="27" cy="32" r="1.5" />
        <circle cx="37" cy="32" r="1.5" />
      </svg>
    </div>
  );
}

function webglOK(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

function Doors({ onComplete }: { onComplete: () => void }) {
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);

  useGSAP(() => {
    if (!left.current || !right.current) return;
    const tl = gsap.timeline({ delay: 0.25, onComplete });
    tl.to(
      left.current.rotation,
      { y: -(105 * Math.PI) / 180, duration: 1.0, ease: "power3.inOut" },
      0,
    );
    tl.to(
      right.current.rotation,
      { y: (105 * Math.PI) / 180, duration: 1.0, ease: "power3.inOut" },
      0,
    );
  });

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 3, 5]} intensity={0.6} />
      <PerspectiveCamera makeDefault fov={45} position={[0, 0, 6]} />
      {/* left door: hinge at its left edge (x = -1.5) */}
      <group ref={left} position={[-1.5, 0, 0]}>
        <mesh position={[0.75, 0, 0]}>
          <boxGeometry args={[1.5, 4, 0.08]} />
          <meshStandardMaterial color="#8B6914" />
        </mesh>
      </group>
      {/* right door: hinge at its right edge (x = 1.5) */}
      <group ref={right} position={[1.5, 0, 0]}>
        <mesh position={[-0.75, 0, 0]}>
          <boxGeometry args={[1.5, 4, 0.08]} />
          <meshStandardMaterial color="#8B6914" />
        </mesh>
      </group>
    </>
  );
}

export default function ClosetDoors3D({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const reduce = usePrefersReducedMotion();
  const [supported, setSupported] = useState<boolean | null>(null);
  const done = useRef(false);

  const finish = useRef(() => {
    if (done.current) return;
    done.current = true;
    onComplete();
  }).current;

  useEffect(() => {
    if (reduce) {
      finish();
      return;
    }
    const ok = webglOK();
    setSupported(ok);
    if (!ok) finish();
  }, [reduce, finish]);

  if (reduce || supported === false) return null;
  if (supported === null) return <DoorsFallback />;

  return (
    <div className="absolute inset-0 z-40" aria-hidden="true">
      <Canvas gl={{ antialias: true }}>
        <Doors onComplete={finish} />
      </Canvas>
    </div>
  );
}
