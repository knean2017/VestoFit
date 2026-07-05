"use client";
import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";

export default function MirrorReveal({ children }: { children: React.ReactNode }) {
  const reduce = usePrefersReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const glint = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!root.current) return;
      if (reduce) {
        gsap.fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.4 });
        return;
      }
      const tl = gsap.timeline();
      tl.fromTo(
        root.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: "power3.out" },
        0,
      );
      tl.fromTo(
        root.current.querySelector("[data-mirror-content]"),
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
        0.1,
      );
      if (glint.current) {
        tl.fromTo(
          glint.current,
          { left: "-20%", opacity: 0.9 },
          { left: "120%", opacity: 0.9, duration: 0.8, ease: "power2.inOut" },
          0.2,
        );
        tl.set(glint.current, { display: "none" });
      }
    },
    { scope: root, dependencies: [reduce] },
  );

  return (
    <div ref={root} className="relative">
      {!reduce && <div ref={glint} className="glint-bar z-20" />}
      <div data-mirror-content className="relative z-0">
        {children}
      </div>
    </div>
  );
}
