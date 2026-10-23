import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq, sql } from 'drizzle-orm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../', import.meta.url))
function typescriptLoader(overrides = {}) {
  const cache = new Map()
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText
    const localRequire = (id) => {
      if (id in overrides) return overrides[id]
      const candidate = id.startsWith('.')
        ? path.resolve(path.dirname(file), `${id}.ts`)
        : id.startsWith('~~/')
          ? path.resolve(root, `${id.slice(3)}.ts`)
          : null
      return candidate && existsSync(candidate) ? load(candidate) : require(id)
    }
    new Function('require', 'module', 'exports', 'createError', compiled)(
      localRequire,
      module,
      module.exports,
      (options) => Object.assign(new Error(options.statusMessage), options),
    )
    return module.exports
  }
  return (relative) => load(path.join(root, relative))
}
const load = typescriptLoader()
const { validateTrimRange, formatVideoTime, VIDEO_EXTENSIONS } = load(
  'shared/utils/video.ts',
)
const { parseByteRange } = load('server/services/storage/range.ts')
const { LocalStorageProvider } = load(
  'server/services/storage/providers/local.ts',
)
const tools = load('server/services/video/ffmpeg.ts')
const migrationsDirectory = path.join(root, 'server/database/migrations')
const journal = JSON.parse(
  readFileSync(path.join(migrationsDirectory, 'meta/_journal.json'), 'utf8'),
)
const applyMigration = (db, tag) =>
  db.exec(readFileSync(path.join(migrationsDirectory, `${tag}.sql`), 'utf8'))

test('video ranges require finite safe integer milliseconds and at least 250 ms', () => {
  for (const [start, end, duration] of [
    [NaN, 1000, 2000],
    [0, Infinity, 2000],
    [-1, 1000, 2000],
    [1000, 1000, 2000],
    [1001, 1000, 2000],
    [0, 2001, 2000],
    [0, 249, 2000],
    [0.1, 1000, 2000],
    [0, '1000', 2000],
    [0, Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER + 1],
    [0, 1000, NaN],
  ])
    assert.throws(() => validateTrimRange(start, end, duration))
  validateTrimRange(1234, 3987, 6000)
  validateTrimRange(0, 250, 250)
  assert.equal(formatVideoTime(3723123, true), '1:02:03.123')
  for (const extension of ['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv']) {
    assert.ok(VIDEO_EXTENSIONS.includes(extension))
  }
})

test('streamed byte ranges support seeking, suffixes, clamping and 416 cases', () => {
  assert.deepEqual(parseByteRange('bytes=10-19', 100), { start: 10, end: 19 })
  assert.deepEqual(parseByteRange('bytes=90-', 100), { start: 90, end: 99 })
  assert.deepEqual(parseByteRange('bytes=-10', 100), { start: 90, end: 99 })
  assert.deepEqual(parseByteRange('bytes=90-999', 100), { start: 90, end: 99 })
  assert.deepEqual(parseByteRange('bytes=-999', 100), { start: 0, end: 99 })
  for (const range of [
    'bytes=-0',
    'bytes=-',
    'bytes=100-',
    'bytes=20-10',
    'bytes=0-1,4-5',
    'bytes=999999999999999999999-',
  ]) {
    assert.throws(() => parseByteRange(range, 100), RangeError)
  }
  assert.throws(() => parseByteRange('bytes=0-', 0), RangeError)
})

test('the additive migration preserves legacy photos and supplies safe defaults', () => {
  const db = new Database(':memory:')
  try {
    for (const entry of journal.entries.slice(0, -1))
      applyMigration(db, entry.tag)
    db.prepare(
      'INSERT INTO photos (id, title, storage_key, latitude, longitude) VALUES (?, ?, ?, ?, ?)',
    ).run('legacy', 'Existing family photo', 'photos/original.jpg', 0, 0)
    applyMigration(db, journal.entries.at(-1).tag)
    const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get('legacy')
    assert.equal(photo.title, 'Existing family photo')
    assert.equal(photo.media_type, 'photo')
    assert.equal(photo.duration_ms, null)
    assert.equal(photo.source_media_id, null)
    assert.equal(photo.latitude, 0)
    db.prepare(
      'INSERT INTO pipeline_queue (payload, dedupe_key) VALUES (?, ?)',
    ).run('{}', 'stable')
    assert.throws(
      () =>
        db
          .prepare(
            'INSERT INTO pipeline_queue (payload, dedupe_key) VALUES (?, ?)',
          )
          .run('{}', 'stable'),
      /UNIQUE/,
    )
    assert.equal(
      db.prepare('SELECT progress FROM pipeline_queue').get().progress,
      0,
    )
  } finally {
    db.close()
  }
})

test('video tasks retain Chinese type, stage and status labels', () => {
  const { taskTypeLabels, taskStageLabels, taskStatusLabels } = load(
    'app/utils/task-labels.ts',
  )
  assert.equal(taskTypeLabels.video, '视频导入')
  assert.equal(taskTypeLabels['video-trim'], '视频裁剪')
  assert.equal(taskStageLabels['video-probe'], '视频探测')
  assert.equal(taskStageLabels['video-encode'], '视频编码')
  assert.equal(taskStageLabels['video-cover'], '生成视频封面')
  assert.equal(taskStatusLabels.completed, '已完成')
  assert.equal(taskStatusLabels.failed, '失败')
})

test('local file publication is exclusive, bounded to storage, and preserves source bytes', async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'kid-video-storage-test-'),
  )
  try {
    const basePath = path.join(directory, 'storage')
    await mkdir(basePath)
    const source = path.join(directory, 'source.mp4')
    await writeFile(source, Buffer.alloc(1024 * 1024, 37))
    const provider = new LocalStorageProvider({
      provider: 'local',
      basePath,
      baseUrl: '/storage',
      prefix: 'photos/',
    })
    provider.get = () =>
      assert.fail('Video operations must not read whole storage Buffers')
    const object = await provider.createFromFile('videos/example.mp4', source)
    assert.equal(object.key, 'photos/videos/example.mp4')
    assert.equal(object.size, 1024 * 1024)
    const stored = await provider.getFilePath(object.key)
    assert.deepEqual(await readFile(stored), await readFile(source))
    await assert.rejects(
      provider.createFromFile('videos/example.mp4', source),
      { code: 'EEXIST' },
    )
    await assert.rejects(
      provider.createFromFile('../outside.mp4', source),
      /traversal/,
    )
    await assert.rejects(provider.getFilePath('../outside.mp4'), /traversal/)
    assert.deepEqual(await readdir(path.dirname(stored)), ['example.mp4'])
    const outside = path.join(directory, 'outside')
    await mkdir(outside)
    await writeFile(path.join(outside, 'private.mp4'), 'outside')
    await symlink(
      outside,
      path.join(basePath, 'photos', 'escape'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    await assert.rejects(provider.getFilePath('escape/private.mp4'), /boundary/)
    await assert.rejects(
      provider.createFromFile('escape/created.mp4', source),
      /boundary/,
    )
    assert.deepEqual(await readdir(outside), ['private.mp4'])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('video child processes report missing tools, timeout, exit failure and progress callback failure', async () => {
  await assert.rejects(
    tools.runVideoTool(`missing-video-tool-${randomUUID()}`, []),
    /NUXT_FFMPEG_PATH/,
  )
  await assert.rejects(
    tools.runVideoTool(
      process.execPath,
      ['-e', 'setTimeout(() => {}, 10000)'],
      { timeoutMs: 100 },
    ),
    /timed out/,
  )
  await assert.rejects(
    tools.runVideoTool(process.execPath, ['-e', 'process.exit(7)']),
    /exit 7/,
  )
  const progress = []
  await tools.runVideoTool(
    process.execPath,
    ['-e', 'process.stdout.write("out_time_us=1234\\nprogress=end\\n")'],
    {
      progress: (value) => progress.push(value),
    },
  )
  assert.deepEqual(progress, [1234])
  await assert.rejects(
    tools.runVideoTool(
      process.execPath,
      [
        '-e',
        'process.stdout.write("out_time_us=1\\n"); setTimeout(() => {}, 10000)',
      ],
      {
        progress: () => {
          throw new Error('Synthetic database failure')
        },
      },
    ),
    /save video task progress/,
  )
})

const config = {
  ffmpegPath: process.env.NUXT_FFMPEG_PATH || 'ffmpeg',
  ffprobePath: process.env.NUXT_FFPROBE_PATH || 'ffprobe',
}
const available = [config.ffmpegPath, config.ffprobePath].every(
  (file) =>
    spawnSync(file, ['-version'], { windowsHide: true, stdio: 'ignore' })
      .status === 0,
)

test(
  'native video import and non-keyframe trim preserve originals, provenance, audio and rotation',
  {
    skip: available
      ? false
      : 'Install FFmpeg/FFprobe or configure NUXT_FFMPEG_PATH/NUXT_FFPROBE_PATH for native integration',
    timeout: 180000,
  },
  async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), 'kid-video-native-test-'),
    )
    const previousDirectory = process.cwd()
    const db = new Database(':memory:')
    try {
      process.chdir(directory)
      for (const entry of journal.entries) applyMigration(db, entry.tag)
      const schema = load('server/database/schema.ts')
      const orm = drizzle(db, { schema })
      const pipeline = typescriptLoader({
        '../../utils/db': { useDB: () => orm, tables: schema, eq, sql },
      })('server/services/video/tasks.ts')
      assert.throws(
        () => pipeline.requireLocalVideoStorage({ config: { provider: 's3' } }),
        /local storage/,
      )
      const original = path.join(directory, 'original.mp4')
      await tools.runVideoTool(config.ffmpegPath, [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-n',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=size=160x90:rate=25',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:sample_rate=48000',
        '-t',
        '6',
        '-c:v',
        'libx264',
        '-threads',
        '2',
        '-g',
        '60',
        '-c:a',
        'aac',
        '-metadata',
        'title=private input title',
        '-metadata',
        'location=+12.34+056.78/',
        '-metadata',
        'creation_time=2020-02-03T04:05:06Z',
        original,
      ])
      const hash = async (file) =>
        createHash('sha256')
          .update(await readFile(file))
          .digest('hex')
      const before = await hash(original)
      const provider = new LocalStorageProvider({
        provider: 'local',
        basePath: path.join(directory, 'storage'),
        baseUrl: '/storage',
        prefix: 'photos/',
      })
      provider.get = () =>
        assert.fail('Video task attempted whole-file storage Buffer access')
      const copied = await provider.createFromFile(
        'videos/original.mp4',
        original,
      )
      const mediaId = pipeline.videoMediaId(copied.key)
      const task = orm
        .insert(schema.pipelineQueue)
        .values({
          payload: { type: 'video', mediaId, storageKey: copied.key },
        })
        .returning()
        .get()
      await pipeline.processVideoTask(task, provider, config)
      await pipeline.processVideoTask(task, provider, config)
      assert.equal(orm.select().from(schema.photos).all().length, 1)
      const source = orm.select().from(schema.photos).get()
      assert.equal(source.mediaType, 'video')
      assert.equal(source.isLivePhoto, 0)
      assert.equal(source.dateTaken, '2020-02-03T04:05:06.000Z')
      assert.ok(source.thumbnailHash)
      assert.ok(source.videoPlaybackKey)
      orm
        .update(schema.photos)
        .set({ latitude: 0, longitude: 0, city: 'Test city' })
        .where(eq(schema.photos.id, mediaId))
        .run()
      const identity = pipeline.trimIdentity(mediaId, 1234, 3987)
      const trim = orm
        .insert(schema.pipelineQueue)
        .values({
          payload: {
            type: 'video-trim',
            mediaId,
            startMs: 1234,
            endMs: 3987,
            ...identity,
          },
        })
        .returning()
        .get()
      await pipeline.processVideoTask(trim, provider, config)
      await pipeline.processVideoTask(trim, provider, config)
      assert.equal(orm.select().from(schema.photos).all().length, 2)
      const clip = orm
        .select()
        .from(schema.photos)
        .where(eq(schema.photos.id, identity.outputId))
        .get()
      assert.equal(clip.sourceMediaId, mediaId)
      assert.equal(clip.trimStartMs, 1234)
      assert.equal(clip.trimEndMs, 3987)
      assert.equal(clip.latitude, 0)
      assert.equal(clip.city, 'Test city')
      assert.equal(clip.dateTaken, source.dateTaken)
      assert.ok(Math.abs(clip.durationMs - 2753) <= 500)
      const clipFile = await provider.getFilePath(clip.storageKey)
      const details = JSON.parse(
        await tools.runVideoTool(config.ffprobePath, [
          '-v',
          'error',
          '-show_streams',
          '-show_format',
          '-of',
          'json',
          clipFile,
        ]),
      )
      assert.equal(
        details.streams.find((stream) => stream.codec_type === 'video')
          .codec_name,
        'h264',
      )
      assert.equal(
        details.streams.find((stream) => stream.codec_type === 'audio')
          .codec_name,
        'aac',
      )
      assert.equal(details.format.tags?.title, undefined)
      assert.equal(details.format.tags?.location, undefined)
      assert.equal(details.format.tags?.creation_time, undefined)
      assert.equal(await hash(original), before)
      assert.equal(await hash(await provider.getFilePath(copied.key)), before)
      await assert.rejects(
        pipeline.processVideoTask(
          {
            ...trim,
            id: trim.id + 10,
            payload: { ...trim.payload, startMs: -1 },
          },
          provider,
          config,
        ),
        /identity|range/,
      )

      const silent = path.join(directory, 'silent.mp4')
      await tools.runVideoTool(config.ffmpegPath, [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=size=160x90:rate=25',
        '-t',
        '2',
        '-an',
        '-c:v',
        'libx264',
        '-threads',
        '2',
        silent,
      ])
      const rotated = path.join(directory, 'rotated.mov')
      await tools.runVideoTool(config.ffmpegPath, [
        '-v',
        'error',
        '-i',
        silent,
        '-c',
        'copy',
        '-metadata:s:v:0',
        'rotate=90',
        rotated,
      ])
      const rotatedInfo = await tools.probeVideo(rotated, config)
      assert.equal(rotatedInfo.width, 90)
      assert.equal(rotatedInfo.height, 160)
      const output = path.join(directory, 'rotated-clip.mp4')
      const noAudio = await tools.encodeVideo(
        rotated,
        output,
        { startMs: 333, endMs: 1555, durationMs: rotatedInfo.durationMs },
        config,
        () => {},
      )
      assert.equal(noAudio.hasAudio, false)
      assert.equal(noAudio.width, 90)
      assert.equal(noAudio.height, 160)
      assert.ok(Math.abs(noAudio.durationMs - 1222) <= 500)

      const failedCopy = await provider.createFromFile(
        'videos/failure.mp4',
        silent,
      )
      const failedId = pipeline.videoMediaId(failedCopy.key)
      const failed = orm
        .insert(schema.pipelineQueue)
        .values({
          payload: {
            type: 'video',
            mediaId: failedId,
            storageKey: failedCopy.key,
          },
        })
        .returning()
        .get()
      const publish = provider.createFromFile.bind(provider)
      provider.createFromFile = (key, file) =>
        key.startsWith('video-covers/')
          ? Promise.reject(new Error('Synthetic cover publication failure'))
          : publish(key, file)
      await assert.rejects(
        pipeline.processVideoTask(failed, provider, config),
        /publication failure/,
      )
      assert.equal(
        orm
          .select()
          .from(schema.photos)
          .where(eq(schema.photos.id, failedId))
          .get(),
        undefined,
      )
      assert.equal(
        await provider.getFileMeta(`video-playback/${failedId}.mp4`),
        null,
      )
      const scope = createHash('sha256')
        .update(process.cwd())
        .digest('hex')
        .slice(0, 16)
      assert.deepEqual(
        await readdir(path.join(tmpdir(), `kid-growth-video-${scope}`)),
        [],
      )
      await rm(path.join(tmpdir(), `kid-growth-video-${scope}`), {
        recursive: true,
        force: true,
      })
    } finally {
      process.chdir(previousDirectory)
      db.close()
      await rm(directory, { recursive: true, force: true })
    }
  },
)
