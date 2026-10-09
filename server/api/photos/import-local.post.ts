import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { generateSafePhotoId } from '~~/server/utils/file-utils'
import { tables, useDB } from '~~/server/utils/db'
import { useStorageProvider } from '~~/server/utils/useStorageProvider'

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

const listImageFiles = async (directory: string): Promise<string[]> => {
  const files: string[] = []
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listImageFiles(fullPath)))
    } else if (
      entry.isFile() &&
      IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
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

export default eventHandler(async (event) => {
  const configuredDirectory = useRuntimeConfig(event).localPhotoImportDir
  if (!configuredDirectory.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Set NUXT_LOCAL_PHOTO_IMPORT_DIR to a local photo folder',
    })
  }

  const sourceDirectory = path.resolve(configuredDirectory)
  const sourceStat = await stat(sourceDirectory).catch(() => null)
  if (!sourceStat?.isDirectory()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'The configured photo import path is not a directory',
    })
  }

  const { storageProvider } = useStorageProvider(event)
  const storageConfig = storageProvider.config
  if (storageConfig?.provider !== 'local') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Local photo import requires the local storage provider',
    })
  }

  const storageDirectory = path.resolve(storageConfig.basePath)
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

  const files = (await listImageFiles(sourceDirectory)).sort()
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
        task.payload.type === 'photo' ? [task.payload.storageKey] : [],
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

  return {
    scanned: files.length,
    queued,
    skipped,
    failed: errors.length,
    errors: errors.slice(0, 10),
  }
})
