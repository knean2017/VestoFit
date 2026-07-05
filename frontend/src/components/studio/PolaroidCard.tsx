"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { TryOnStatus } from "@/lib/api";

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
  const img = job.result_url;
  const date = job.created_at
    ? new Date(job.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;

  return (
    <motion.button
      onClick={() => onSelect(job)}
      className="polaroid shrink-0 w-32 snap-start"
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      whileHover={reduce ? {} : { scale: 1.04, transition: { type: "spring", stiffness: 200, damping: 18 } }}
    >
      <div className="aspect-square bg-surface2 overflow-hidden rounded-sm">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="render" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-[10px] text-muted">
            {job.status}
          </div>
        )}
      </div>
      {date && (
        <p className="text-[9px] text-muted/60 text-center mt-0.5 font-medium">{date}</p>
      )}
    </motion.button>
  );
}
