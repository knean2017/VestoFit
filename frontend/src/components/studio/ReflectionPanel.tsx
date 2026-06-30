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
    <div className="stage-plate relative aspect-[3/4] rounded-2xl overflow-hidden">
      {completed && active.result_url && active.garment_url ? (
        <MirrorFlipCard garmentUrl={active.garment_url} resultUrl={active.result_url} />
      ) : completed && active.result_url ? (
        /* Outfit render or job without garment — show result directly */
        <div className="relative w-full h-full flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.result_url}
            alt="Your look"
            className="relative z-10 w-full h-full object-contain drop-shadow-lg"
          />
        </div>
      ) : (
        <>
          {avatar?.photo_url ? (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatar.photo_url}
                alt="You"
                className="relative z-10 w-[85%] h-[85%] object-contain drop-shadow-lg"
              />
              <div className="contact-shadow z-0" />
              {/* Reflective floor */}
              <div className="hidden sm:block absolute bottom-0 inset-x-0 h-[18%] overflow-hidden opacity-30 scale-y-[-1] pointer-events-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatar.photo_url}
                  alt=""
                  className="w-[85%] mx-auto object-contain"
                  style={{ filter: "blur(3px)", maskImage: "linear-gradient(to top, black, transparent)" }}
                />
              </div>
            </div>
          ) : (
            <div className="w-full h-full grid place-items-center text-muted text-sm">
              Your render will appear here
            </div>
          )}
          {processing && (
            <>
              <div className="glass-shimmer" />
              <div className="absolute inset-x-0 bottom-0 z-20">
                <div className="h-[2px] bg-coral/60 animate-pulse" />
                <p className="text-center text-xs text-ink/80 py-2">
                  Rendering your look…
                </p>
              </div>
            </>
          )}
          {failed && (
            <div className="absolute bottom-3 inset-x-3 z-20 bg-surface/90 backdrop-blur rounded-xl px-4 py-3 text-center">
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
