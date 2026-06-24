"use client";
import type { AvatarResponse, TryOnStatus } from "@/lib/api";
import MirrorFlipCard from "./MirrorFlipCard";

export default function ReflectionPanel({
  avatar,
  active,
}: {
  avatar: AvatarResponse | null;
  active: TryOnStatus | null;
}) {
  const processing =
    active && (active.status === "processing" || active.status === "queued");
  const completed = active && active.status === "completed";
  const failed = active && active.status === "failed";

  return (
    <div className="relative aspect-[3/4] rounded-xl3 overflow-hidden bg-surface2">
      {completed && active.garment_url && active.result_url ? (
        <MirrorFlipCard garmentUrl={active.garment_url} resultUrl={active.result_url} />
      ) : (
        <>
          {avatar?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar.photo_url} alt="You" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center text-muted text-sm">
              Your render will appear here
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent" />
          {processing && (
            <>
              <div className="glass-shimmer" />
              <div className="absolute inset-x-0 bottom-3 text-center text-xs text-ink/80">
                Rendering your look — about 15-30 seconds
              </div>
            </>
          )}
          {failed && (
            <div className="absolute inset-0 grid place-items-center bg-surface/80 text-center px-4">
              <p className="text-danger text-sm">
                {active.error || "Render failed. Try again."}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
