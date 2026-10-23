import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isMapServiceConfigured } from '../shared/utils/map-service.ts'

test('map service configuration is optional and disabled without credentials', () => {
  for (const config of [undefined, null, {}, { provider: 'maplibre' }]) {
    assert.equal(isMapServiceConfigured(config), false)
  }
  assert.equal(
    isMapServiceConfigured({
      'maplibre.token': ' ',
      'maplibre.style': '',
    }),
    false,
  )
})

test('MapLibre supports either a token or a custom style', () => {
  assert.equal(isMapServiceConfigured({ 'maplibre.token': 'test-token' }), true)
  assert.equal(
    isMapServiceConfigured({ 'maplibre.style': '/local-map-style.json' }),
    true,
  )
})

test('Mapbox needs its own token, not MapLibre configuration', () => {
  assert.equal(
    isMapServiceConfigured({
      provider: 'mapbox',
      'maplibre.token': 'test-token',
    }),
    false,
  )
  assert.equal(
    isMapServiceConfigured({
      provider: 'mapbox',
      'mapbox.token': 'test-token',
    }),
    true,
  )
})
