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
  if (!history.length) return null;
  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="heading-md">Your renders</h2>
        <span className="chip text-[10px]">{history.length}</span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 px-2">
        {history.map((job, i) => (
          <PolaroidCard key={job.job_id} job={job} index={i} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
