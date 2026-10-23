import { z } from 'zod'
import { useDB, tables, eq } from '../../../utils/db'
import { checkVideoTools, probeVideo } from '../../../services/video/ffmpeg'
import {
  assertVideoQueueCapacity,
  requireLocalVideoStorage,
  trimIdentity,
  withVideoMediaLock,
} from '../../../services/video/tasks'
import { validateTrimRange } from '../../../../shared/utils/video'

export default eventHandler(async (event) => {
  const id = getRouterParam(event, 'photoId')
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: 'Media ID is required',
    })
  const { startMs, endMs } = await readValidatedBody(
    event,
    z
      .object({
        startMs: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        endMs: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      })
      .strict().parse,
  )
  const { storageProvider } = useStorageProvider(event)
  requireLocalVideoStorage(storageProvider)
  return withVideoMediaLock(id, async () => {
    const db = useDB()
    const source = db
      .select()
      .from(tables.photos)
      .where(eq(tables.photos.id, id))
      .get()
    if (
      !source ||
      source.mediaType !== 'video' ||
      source.isLivePhoto ||
      !source.storageKey
    ) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Ordinary source video not found',
      })
    }
    const workerPool = globalThis.__workerPool
    if (!workerPool)
      throw createError({
        statusCode: 503,
        statusMessage: 'Video queue is not ready',
      })
    const config = useRuntimeConfig(event)
    try {
      await checkVideoTools(config)
    } catch (error) {
      throw createError({
        statusCode: 503,
        statusMessage:
          error instanceof Error
            ? error.message
            : 'FFmpeg/FFprobe are unavailable',
      })
    }
    const info = await probeVideo(
      await storageProvider.getFilePath(source.storageKey),
      config,
    )
    try {
      validateTrimRange(startMs, endMs, info.durationMs)
    } catch (error) {
      throw createError({
        statusCode: 400,
        statusMessage:
          error instanceof Error ? error.message : 'Invalid trim range',
      })
    }
    const { outputId, outputKey } = trimIdentity(id, startMs, endMs)
    const dedupeKey = `trim:${outputId}`
    const existing = db
      .select()
      .from(tables.pipelineQueue)
      .where(eq(tables.pipelineQueue.dedupeKey, dedupeKey))
      .get()
    const clip = db
      .select({ id: tables.photos.id })
      .from(tables.photos)
      .where(eq(tables.photos.id, outputId))
      .get()
    if (existing) {
      if (existing.status === 'completed' && !clip) {
        assertVideoQueueCapacity()
        db.update(tables.pipelineQueue)
          .set({
            status: 'pending',
            statusStage: null,
            progress: 0,
            errorMessage: null,
            attempts: 0,
            completedAt: null,
            createdAt: new Date(),
          })
          .where(eq(tables.pipelineQueue.id, existing.id))
          .run()
      }
      return { taskId: existing.id, outputId }
    }
    if (!clip) assertVideoQueueCapacity()
    const taskId = await workerPool.addTask(
      { type: 'video-trim', mediaId: id, startMs, endMs, outputId, outputKey },
      { dedupeKey, priority: 2, maxAttempts: 3 },
    )
    return { taskId, outputId }
  })
})
