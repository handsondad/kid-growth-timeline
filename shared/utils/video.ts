export const VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.m4v',
  '.webm',
  '.avi',
  '.mkv',
]
export const MIN_TRIM_MS = 250
export const MAX_VIDEO_DURATION_MS = 4 * 60 * 60 * 1000
export const MAX_VIDEO_BYTES = 8 * 1024 * 1024 * 1024

export function formatVideoTime(milliseconds: number, precise = false) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '--:--'
  const total = Math.floor(milliseconds / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor(total / 60) % 60
  const seconds = total % 60
  return `${hours ? `${hours}:` : ''}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}${precise ? `.${String(Math.floor(milliseconds) % 1000).padStart(3, '0')}` : ''}`
}

export function validateTrimRange(
  startMs: unknown,
  endMs: unknown,
  durationMs: number,
): asserts startMs is number {
  if (
    typeof startMs !== 'number' ||
    typeof endMs !== 'number' ||
    !Number.isSafeInteger(startMs) ||
    !Number.isSafeInteger(endMs) ||
    !Number.isSafeInteger(durationMs) ||
    startMs < 0 ||
    endMs > durationMs ||
    endMs - startMs < MIN_TRIM_MS
  ) {
    throw new Error(
      'Select an integer-millisecond range of at least 250 ms within the video duration',
    )
  }
}
