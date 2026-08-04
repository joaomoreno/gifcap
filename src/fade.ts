export type FadeMode = "none" | "in" | "out" | "both";

export interface FadeOptions {
  readonly mode: FadeMode;
  readonly durationMs: number;
}

export const defaultFadeOptions: FadeOptions = { mode: "none", durationMs: 1000 };

// Single source of truth for fade timing: both the live preview
// (preview.ts) and the baked render (render.ts) must call this, or the
// two will drift apart visually.
//
// Returns 0 (no darkening) to 1 (fully black) for a given timestamp,
// relative to the trimmed range [rangeStartMs, rangeEndMs].
export function getFadeFactor(
  timestampMs: number,
  rangeStartMs: number,
  rangeEndMs: number,
  fade: FadeOptions
): number {
  if (fade.mode === "none") {
    return 0;
  }

  const rangeLength = rangeEndMs - rangeStartMs;

  if (rangeLength <= 0) {
    return 0;
  }

  const duration = Math.min(fade.durationMs, rangeLength / (fade.mode === "both" ? 2 : 1));

  let factor = 0;

  if (fade.mode === "in" || fade.mode === "both") {
    const t = (timestampMs - rangeStartMs) / duration;
    factor = Math.max(factor, 1 - Math.max(0, Math.min(1, t)));
  }

  if (fade.mode === "out" || fade.mode === "both") {
    const t = (rangeEndMs - timestampMs) / duration;
    factor = Math.max(factor, 1 - Math.max(0, Math.min(1, t)));
  }

  return factor;
}

// Darkens ImageData in place toward black by `factor` (0-1). Alpha untouched.
export function applyFade(imageData: ImageData, factor: number): void {
  if (factor <= 0) {
    return;
  }

  const data = imageData.data;
  const mult = 1 - factor;

  for (let i = 0; i < data.length; i += 4) {
    data[i] *= mult;
    data[i + 1] *= mult;
    data[i + 2] *= mult;
  }
}
