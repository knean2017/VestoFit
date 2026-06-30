"use client";
import MagneticButton from "@/components/MagneticButton";

export default function GarmentInput({
  description,
  setDescription,
  filePreview,
  fileInput,
  onFile,
  onSubmit,
  submitting,
  canSubmit,
}: {
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
    <div className="rounded-2xl bg-surface p-5 space-y-5 shadow-soft">
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
