"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { TryOnStatus } from "@/lib/api";

const ROT = [-4, 3, -2, 5, -3, 4];

export default function PolaroidCard({
  job,
  index,
  onSelect,
}: {
  job: TryOnStatus;
  index: number;
  onSelect: (job: TryOnStatus) => void;
}) {
  const reduce = useReducedMotion();
  const rot = reduce ? 0 : ROT[index % 6];
  const img = job.result_url;

  return (
    <motion.button
      onClick={() => onSelect(job)}
      className="polaroid shrink-0 w-32"
      initial={{ rotateZ: rot }}
      whileHover={
        reduce
          ? {}
          : {
              rotateZ: 0,
              scale: 1.03,
              transition: { type: "spring", stiffness: 200, damping: 18 },
            }
      }
    >
      <div className="aspect-square bg-surface2 overflow-hidden">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="render" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-[10px] text-muted">
            {job.status}
          </div>
        )}
      </div>
    </motion.button>
  );
}
