"use client";
import MagneticButton from "@/components/MagneticButton";
import ModeHooks from "./ModeHooks";

type Mode = "url" | "upload";

export default function GarmentInput({
  mode,
  setMode,
  url,
  setUrl,
  description,
  setDescription,
  filePreview,
  fileInput,
  onFile,
  onSubmit,
  submitting,
  canSubmit,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  url: string;
  setUrl: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  filePreview: string | null;
  fileInput: React.RefObject<HTMLInputElement>;
  onFile: (f: File | null) => void;
  onSubmit: () => void;
  submitting: boolean;
  canSubmit: boolean;
}) {
  return (
    <div className="rounded-xl3 bg-surface2 p-4 space-y-4">
      <ModeHooks mode={mode} setMode={setMode} />

      {mode === "url" ? (
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a product URL"
          className="field w-full"
        />
      ) : (
        <div
          onClick={() => fileInput.current?.click()}
          className="border-2 border-dashed border-line rounded-xl p-6 text-center cursor-pointer hover:border-coral transition-colors"
        >
          {filePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={filePreview}
              alt="preview"
              className="max-h-40 mx-auto object-contain"
            />
          ) : (
            <p className="text-muted text-sm">Tap to upload a garment image</p>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </div>
      )}

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the item (optional)"
        className="field w-full min-h-[72px]"
      />

      <MagneticButton>
        <button
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className="btn-primary"
        >
          {submitting ? "Rendering…" : "Render"}
        </button>
      </MagneticButton>
      <p className="text-xs text-muted">~15-30 seconds per render</p>
    </div>
  );
}
