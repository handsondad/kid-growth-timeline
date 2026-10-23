import { createHash } from 'node:crypto'
import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { generateSafePhotoId } from '~~/server/utils/file-utils'
import { eq, tables, useDB } from '~~/server/utils/db'
import { useStorageProvider } from '~~/server/utils/useStorageProvider'
import { MAX_VIDEO_BYTES, VIDEO_EXTENSIONS } from '~~/shared/utils/video'
import { checkVideoTools } from '~~/server/services/video/ffmpeg'
import {
  assertVideoQueueCapacity,
  requireLocalVideoStorage,
  videoMediaId,
} from '~~/server/services/video/tasks'

const IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.heic',
  '.heif',
  '.jpeg',
  '.jpg',
  '.png',
  '.tif',
  '.tiff',
  '.webp',
])

const isWithinDirectory = (parent: string, child: string) => {
  const relative = path.relative(parent, child)
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  )
}

const listMediaFiles = async (directory: string): Promise<string[]> => {
  const files: string[] = []
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listMediaFiles(fullPath)))
    } else if (
      entry.isFile() &&
      (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) ||
        VIDEO_EXTENSIONS.includes(path.extname(entry.name).toLowerCase()))
    ) {
      files.push(fullPath)
    }
  }

  return files
}

const getImportRelativeKey = (relativePath: string): string => {
  const parsedPath = path.parse(relativePath)
  const relativeStem = path
    .join(parsedPath.dir, parsedPath.name)
    .split(path.sep)
    .join('/')
  const pathHash = createHash('sha256')
    .update(relativeStem)
    .digest('hex')
    .slice(0, 8)

  return path
    .join(parsedPath.dir, `${parsedPath.name}-${pathHash}${parsedPath.ext}`)
    .split(path.sep)
    .join('/')
}

const importLocal = eventHandler(async (event) => {
  const configuredDirectory = useRuntimeConfig(event).localPhotoImportDir
  if (!configuredDirectory.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Set NUXT_LOCAL_PHOTO_IMPORT_DIR to a local photo folder',
    })
  }

  let sourceDirectory = path.resolve(configuredDirectory)
  const sourceStat = await stat(sourceDirectory).catch(() => null)
  if (!sourceStat?.isDirectory()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'The configured photo import path is not a directory',
    })
  }
  sourceDirectory = await realpath(sourceDirectory)

  const { storageProvider } = useStorageProvider(event)
  const storageConfig = storageProvider.config
  if (storageConfig?.provider !== 'local') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Local photo import requires the local storage provider',
    })
  }

  const storageDirectory = await realpath(path.resolve(storageConfig.basePath))
  if (
    isWithinDirectory(sourceDirectory, storageDirectory) ||
    isWithinDirectory(storageDirectory, sourceDirectory)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'The photo import directory must be separate from local storage',
    })
  }

  const workerPool = globalThis.__workerPool
  if (!workerPool) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Photo processing queue is not ready',
    })
  }

  const allFiles = (await listMediaFiles(sourceDirectory)).sort()
  const files = allFiles.filter((file) =>
    IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()),
  )
  const companionPaths = new Set<string>()
  const pathIdentity = (file: string) =>
    process.platform === 'win32'
      ? path.resolve(file).toLowerCase()
      : path.resolve(file)
  const db = useDB()
  const [photos, tasks] = await Promise.all([
    db
      .select({ id: tables.photos.id, storageKey: tables.photos.storageKey })
      .from(tables.photos)
      .all(),
    db
      .select({
        payload: tables.pipelineQueue.payload,
        status: tables.pipelineQueue.status,
      })
      .from(tables.pipelineQueue)
      .all(),
  ])

  const knownPhotoIds = new Set(photos.map((photo) => photo.id))
  const knownStorageKeys = new Set(
    photos.map((photo) => photo.storageKey).filter(Boolean),
  )
  const queuedStorageKeys = new Set(
    tasks
      .filter(
        (task) => task.status === 'pending' || task.status === 'in-stages',
      )
      .flatMap((task) =>
        task.payload.type === 'photo' || task.payload.type === 'video'
          ? [task.payload.storageKey]
          : [],
      ),
  )

  const prefix = (storageConfig.prefix || '').replace(/^\/+|\/+$/g, '')
  const copiedVideoKeys = new Set<string>()
  let queued = 0
  let skipped = 0
  const errors: string[] = []

  for (const filePath of files) {
    const relativePath = path.relative(sourceDirectory, filePath)
    const relativeKey = relativePath.split(path.sep).join('/')
    const parsedPath = path.parse(relativePath)
    const importRelativeKey = getImportRelativeKey(relativePath)
    const storageKey = prefix
      ? `${prefix}/${importRelativeKey}`
      : importRelativeKey
    const photoId = generateSafePhotoId(storageKey)

    for (const videoExtension of ['.MOV', '.mov']) {
      const videoPath = path.join(
        path.dirname(filePath),
        `${parsedPath.name}${videoExtension}`,
      )
      const videoStat = await stat(videoPath).catch(() => null)
      if (!videoStat?.isFile() || videoStat.size > 12 * 1024 * 1024) {
        continue
      }
      companionPaths.add(pathIdentity(videoPath))

      const videoRelativePath = path.relative(sourceDirectory, videoPath)
      const videoRelativeKey = videoRelativePath.split(path.sep).join('/')
      const videoImportRelativeKey = getImportRelativeKey(videoRelativePath)
      const videoStorageKey = prefix
        ? `${prefix}/${videoImportRelativeKey}`
        : videoImportRelativeKey

      if (!copiedVideoKeys.has(videoStorageKey)) {
        try {
          const existingVideo = await storageProvider
            .get(videoStorageKey)
            .catch(() => null)
          if (!existingVideo) {
            const videoBuffer = await readFile(videoPath)
            await storageProvider.create(videoImportRelativeKey, videoBuffer)
          }
          copiedVideoKeys.add(videoStorageKey)
        } catch (error) {
          errors.push(
            `${videoRelativeKey}: ${error instanceof Error ? error.message : 'Import failed'}`,
          )
        }
      }
      break
    }

    if (
      knownPhotoIds.has(photoId) ||
      knownStorageKeys.has(storageKey) ||
      queuedStorageKeys.has(storageKey)
    ) {
      skipped += 1
      continue
    }

    try {
      const fileBuffer = await readFile(filePath)
      const storedFile = await storageProvider.create(
        importRelativeKey,
        fileBuffer,
      )
      await workerPool.addTask(
        { type: 'photo', storageKey: storedFile.key },
        { priority: 1, maxAttempts: 3 },
      )
      knownPhotoIds.add(photoId)
      knownStorageKeys.add(storedFile.key)
      queuedStorageKeys.add(storedFile.key)
      queued += 1
    } catch (error) {
      errors.push(
        `${relativeKey}: ${error instanceof Error ? error.message : 'Import failed'}`,
      )
    }
  }

  const videos = allFiles.filter(
    (file) =>
      VIDEO_EXTENSIONS.includes(path.extname(file).toLowerCase()) &&
      !companionPaths.has(pathIdentity(file)),
  )
  let toolsError: string | null = null
  if (videos.length) {
    try {
      requireLocalVideoStorage(storageProvider)
      await checkVideoTools(useRuntimeConfig(event))
    } catch (error) {
      toolsError =
        error instanceof Error ? error.message : 'Video tools are unavailable'
    }
  }
  for (const file of videos) {
    const relative = path
      .relative(sourceDirectory, file)
      .split(path.sep)
      .join('/')
    const digest = createHash('sha256')
      .update(relative)
      .digest('hex')
      .slice(0, 32)
    const key = `videos/${digest}${path.extname(file).toLowerCase()}`
    const storageKey = prefix ? `${prefix}/${key}` : key
    const mediaId = videoMediaId(storageKey)
    const dedupeKey = `video:${mediaId}`
    if (
      knownPhotoIds.has(mediaId) ||
      knownStorageKeys.has(storageKey) ||
      queuedStorageKeys.has(storageKey) ||
      db
        .select({ id: tables.pipelineQueue.id })
        .from(tables.pipelineQueue)
        .where(eq(tables.pipelineQueue.dedupeKey, dedupeKey))
        .get()
    ) {
      skipped++
      continue
    }
    try {
      if (toolsError) throw new Error(toolsError)
      requireLocalVideoStorage(storageProvider)
      const info = await stat(file)
      if (info.size === 0 || info.size > MAX_VIDEO_BYTES) {
        throw new Error('Video must be non-empty and no larger than 8 GiB')
      }
      assertVideoQueueCapacity()
      if (!(await storageProvider.getFileMeta(storageKey))) {
        await storageProvider.createFromFile(key, file)
      }
      await workerPool.addTask(
        { type: 'video', mediaId, storageKey },
        { dedupeKey, priority: 1, maxAttempts: 3 },
      )
      queuedStorageKeys.add(storageKey)
      queued++
    } catch (error) {
      errors.push(
        `${relative}: ${error instanceof Error ? error.message : 'Video import failed'}`,
      )
    }
  }

  return {
    scanned: files.length + videos.length,
    queued,
    skipped,
    failed: errors.length,
    errors: errors.slice(0, 10),
  }
})

let scanning = false
export default eventHandler(async (event) => {
  if (scanning) {
    throw createError({
      statusCode: 409,
      statusMessage: 'A local scan is already running',
    })
  }
  scanning = true
  try {
    return await importLocal(event)
  } finally {
    scanning = false
  }
})
