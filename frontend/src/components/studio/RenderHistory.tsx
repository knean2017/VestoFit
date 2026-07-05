"use client";
import type { TryOnStatus } from "@/lib/api";
import PolaroidCard from "./PolaroidCard";

export default function RenderHistory({
  history,
  onSelect,
}: {
  history: TryOnStatus[];
  onSelect: (job: TryOnStatus) => void;
}) {
  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="heading-md">Your renders</h2>
        {history.length > 0 && (
          <span className="chip text-[10px]">{history.length}</span>
        )}
      </div>
      {history.length === 0 ? (
        <div>
          <div className="text-center py-4 space-y-2 max-w-sm mx-auto">
            <p className="font-bold text-ink">Nothing tried on yet</p>
            <p className="text-sm text-muted">
              Pick a garment from your closet or upload one — you&apos;ll see it
              rendered on your photo in about a minute.
            </p>
          </div>
          <div className="flex gap-4 px-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="polaroid shrink-0 w-32 opacity-20"
            >
              <div className="aspect-square bg-surface2 rounded grid place-items-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              </div>
            </div>
          ))}
          </div>
        </div>
      ) : (
        <div className="rail-mask">
          <div className="flex gap-4 overflow-x-auto pb-4 px-2 snap-x snap-mandatory">
            {history.map((job, i) => (
              <PolaroidCard key={job.job_id} job={job} index={i} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
