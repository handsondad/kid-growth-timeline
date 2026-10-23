import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasCoordinates } from '../shared/utils/index.ts'

test('coordinates include the equator, prime meridian, and origin', () => {
  for (const [latitude, longitude] of [
    [0, 0],
    [0, 120],
    [45, 0],
    [-35, -120],
    [-90, -180],
    [90, 180],
  ]) {
    assert.equal(hasCoordinates({ latitude, longitude }), true)
  }
})

test('both coordinates must be finite numbers', () => {
  for (const missing of [null, undefined, NaN, Infinity, -Infinity, '', '0']) {
    assert.equal(hasCoordinates({ latitude: missing, longitude: 0 }), false)
    assert.equal(hasCoordinates({ latitude: 0, longitude: missing }), false)
  }
  assert.equal(hasCoordinates({}), false)
})

test('filtering coordinates preserves photo metadata without mutation', () => {
  const photos = [
    Object.freeze({ id: 'origin', latitude: 0, longitude: 0 }),
    Object.freeze({ id: 'missing', latitude: null, longitude: 0 }),
    Object.freeze({ id: 'equator', latitude: 0, longitude: 120 }),
    Object.freeze({ id: 'invalid', latitude: NaN, longitude: 10 }),
  ]
  const locatedPhotos = photos.filter(hasCoordinates)

  assert.deepEqual(
    locatedPhotos.map((photo) => photo.id),
    ['origin', 'equator'],
  )
  assert.equal(locatedPhotos[0], photos[0])
  assert.equal(locatedPhotos[1], photos[2])
  assert.equal(photos.length, 4)
})
