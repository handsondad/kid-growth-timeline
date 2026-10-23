import { useDB, tables, eq, sql } from '../../../utils/db'
import { checkVideoTools, probeVideo } from '../../../services/video/ffmpeg'
import { requireLocalVideoStorage } from '../../../services/video/tasks'

export default eventHandler(async (event) => {
  const id = getRouterParam(event, 'photoId')
  const photo =
    id &&
    useDB().select().from(tables.photos).where(eq(tables.photos.id, id)).get()
  if (
    !photo ||
    photo.mediaType !== 'video' ||
    photo.isLivePhoto ||
    !photo.storageKey
  ) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Ordinary video not found',
    })
  }
  const latestTask =
    useDB()
      .select()
      .from(tables.pipelineQueue)
      .where(
        sql`json_extract(${tables.pipelineQueue.payload}, '$.type') = 'video-trim' AND json_extract(${tables.pipelineQueue.payload}, '$.mediaId') = ${photo.id}`,
      )
      .orderBy(sql`${tables.pipelineQueue.id} DESC`)
      .get() ?? null
  const { storageProvider } = useStorageProvider(event)
  const supported =
    storageProvider.config?.provider === 'local' &&
    !!storageProvider.getFilePath &&
    !!storageProvider.createFromFile
  if (!supported) {
    return {
      supported: false,
      available: false,
      reason: 'Video trimming requires local storage',
      durationMs: photo.durationMs,
      latestTask,
    }
  }
  try {
    requireLocalVideoStorage(storageProvider)
    const config = useRuntimeConfig(event)
    await checkVideoTools(config)
    const info = await probeVideo(
      await storageProvider.getFilePath(photo.storageKey),
      config,
    )
    return {
      supported: true,
      available: true,
      reason: null,
      durationMs: info.durationMs,
      latestTask,
    }
  } catch (error) {
    return {
      supported: true,
      available: false,
      reason:
        error instanceof Error ? error.message : 'Video tools are unavailable',
      durationMs: photo.durationMs,
      latestTask,
    }
  }
})
