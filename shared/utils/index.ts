export const zeroArray = (length: number): number[] =>
  Array.from({ length }, () => 0)

export const hasCoordinates = <T extends object>(
  value: T,
): value is T & { latitude: number; longitude: number } =>
  'latitude' in value &&
  typeof value.latitude === 'number' &&
  Number.isFinite(value.latitude) &&
  'longitude' in value &&
  typeof value.longitude === 'number' &&
  Number.isFinite(value.longitude)
