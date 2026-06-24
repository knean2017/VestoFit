"use client";
import { useRef, useState } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";

export default function CurtainReveal() {
  const reduce = usePrefersReducedMotion();
  const [hidden, setHidden] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (reduce) {
        setHidden(true);
        return;
      }
      if (!left.current || !right.current) return;
      const tl = gsap.timeline({ delay: 0.2, onComplete: () => setHidden(true) });
      tl.to(
        [left.current, right.current],
        { xPercent: (i: number) => (i === 0 ? 2 : -2), duration: 0.12, ease: "power2.out" },
        0,
      );
      tl.to(left.current, { xPercent: -100, duration: 0.9, ease: "power2.inOut" }, 0.12);
      tl.to(right.current, { xPercent: 100, duration: 0.9, ease: "power2.inOut" }, 0.12);
    },
    { dependencies: [reduce] },
  );

  if (hidden) return null;

  return (
    <div ref={root} className="fixed inset-0 z-50 pointer-events-none" aria-hidden="true">
      <div
        ref={left}
        className="absolute inset-y-0 left-0 w-1/2 curtain-fold"
        style={{ background: "linear-gradient(90deg,#FF6B5E,#E0594E)" }}
      />
      <div
        ref={right}
        className="absolute inset-y-0 right-0 w-1/2 curtain-fold"
        style={{ background: "linear-gradient(270deg,#FF6B5E,#E0594E)" }}
      />
    </div>
  );
}
