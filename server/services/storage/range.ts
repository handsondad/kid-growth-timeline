export function parseByteRange(header: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (!match || (!match[1] && !match[2]) || size < 1) {
    throw new RangeError('Invalid byte range')
  }
  const first = match[1] ? Number(match[1]) : null
  const last = match[2] ? Number(match[2]) : null
  if (
    (first !== null && !Number.isSafeInteger(first)) ||
    (last !== null && !Number.isSafeInteger(last))
  ) {
    throw new RangeError('Invalid byte range')
  }
  const start = first === null ? Math.max(0, size - (last ?? 0)) : first
  const end =
    first === null || last === null ? size - 1 : Math.min(last, size - 1)
  if (start >= size || start > end)
    throw new RangeError('Unsatisfiable byte range')
  return { start, end }
}
