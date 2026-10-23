import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire, isBuiltin } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = readFileSync(
  new URL('../server/services/pipeline-queue/manager.ts', import.meta.url),
  'utf8',
)
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText

// Exercise the real processor without Nuxt globals, a database, or media tools.
const setupPipeline = ({ exif = null, livePhoto = null } = {}) => {
  const saved = []
  const createdKeys = []
  const geocoded = []
  const raw = Buffer.from('synthetic original')
  const log = {
    info() {},
    debug() {},
    warn() {},
    error() {},
    success() {},
    withTag() {
      return this
    },
  }
  const storage = {
    getFileMeta: async () => ({ size: raw.length }),
    getPublicUrl: (key) => `/storage/${key}`,
    create: async (key) => {
      createdKeys.push(key)
      return { key }
    },
  }
  const modules = {
    '../video/tasks': {},
    '../../../shared/utils/video': {
      VIDEO_EXTENSIONS: ['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv'],
    },
    'drizzle-orm': {},
    'exiftool-vendored': {},
    '~~/shared/utils/u8array': {
      compressUint8Array: (value) => Buffer.from(value).toString('base64'),
    },
    '../image/processor': {
      preprocessImageWithJpegUpload: async () => ({ raw, processed: raw }),
      processImageMetadataAndSharp: async () => ({
        imageBuffer: raw,
        metadata: { width: 64, height: 48 },
      }),
    },
    '../image/thumbnail': {
      generateThumbnailAndHash: async () => ({
        thumbnailBuffer: Buffer.from('thumbnail'),
        thumbnailHash: new Uint8Array([1, 2, 3]),
      }),
    },
    '../image/exif': {
      extractExifData: async () => exif,
      extractPhotoInfo: () => ({
        title: 'Test photo',
        description: null,
        dateTaken: '2026-01-01T00:00:00.000Z',
        tags: [],
      }),
    },
    '../location/geocoding': {
      parseGPSCoordinates: (value) => ({
        latitude: value.GPSLatitude,
        longitude: value.GPSLongitude,
      }),
      extractLocationFromGPS: async (...coordinates) => {
        geocoded.push(coordinates)
        return null
      },
    },
    '../video/livephoto': {
      findLivePhotoVideoForImage: async () => livePhoto,
    },
    '../video/motion-photo': {
      processMotionPhotoFromXmp: async () => null,
    },
    '~~/server/plugins/3.storage': {
      getStorageManager: () => ({ getProvider: () => storage }),
    },
  }
  const context = {
    exports: {},
    require: (id) => {
      if (id in modules) return modules[id]
      if (isBuiltin(id)) return require(id)
      throw new Error(`Unexpected pipeline dependency: ${id}`)
    },
    Buffer,
    setImmediate,
    generateSafePhotoId: () => 'test-photo',
    tables: { photos: { id: 'id' } },
    useDB: () => ({
      insert: () => ({
        values: (photo) => ({
          onConflictDoUpdate: async () => saved.push(photo),
        }),
      }),
    }),
  }
  runInNewContext(compiled, context)
  const manager = context.exports.QueueManager.getInstance('test', log)
  manager.updateTaskStage = async () => {}
  manager.addTask = async () => {
    assert.fail('Import must not implicitly enqueue location erasure')
  }
  const processPhoto = () =>
    manager.processors.photo({
      id: 1,
      payload: { type: 'photo', storageKey: 'photos/test.jpg' },
    })
  return { processPhoto, saved, createdKeys, geocoded, raw }
}

test('local import completes without EXIF or an old upload policy setting', async () => {
  const pipeline = setupPipeline()
  const photo = await pipeline.processPhoto()

  assert.equal(pipeline.saved[0], photo)
  assert.equal(photo.exif, null)
  assert.equal(photo.latitude, null)
  assert.equal(photo.longitude, null)
  assert.equal(photo.width, 64)
  assert.equal(photo.height, 48)
  assert.ok(photo.thumbnailHash)
  assert.deepEqual(pipeline.geocoded, [])
  assert.deepEqual(pipeline.createdKeys, ['thumbnails/test-photo.webp'])
  assert.equal(pipeline.raw.toString(), 'synthetic original')
})

test('zero GPS and Live Photo pairing survive unavailable optional geocoding', async () => {
  const exif = { GPSLatitude: 0, GPSLongitude: 0 }
  const pipeline = setupPipeline({
    exif,
    livePhoto: { videoKey: 'photos/test.MOV', videoSize: 20 },
  })
  const photo = await pipeline.processPhoto()

  assert.equal(photo.exif, exif)
  assert.equal(photo.latitude, 0)
  assert.equal(photo.longitude, 0)
  assert.equal(photo.city, null)
  assert.deepEqual(pipeline.geocoded, [[0, 0]])
  assert.equal(photo.isLivePhoto, 1)
  assert.equal(photo.livePhotoVideoKey, 'photos/test.MOV')
  assert.equal(photo.livePhotoVideoUrl, '/storage/photos/test.MOV')
  assert.deepEqual(pipeline.createdKeys, ['thumbnails/test-photo.webp'])
})
