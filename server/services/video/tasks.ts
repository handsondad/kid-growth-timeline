import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { useDB, tables, eq, sql, type PipelineQueueItem } from '../../utils/db'
import type { StorageProvider, StorageObject } from '../storage/interfaces'
import type { LocalStorageConfig } from '../storage'
import { generateThumbnailAndHash } from '../image/thumbnail'
import { compressUint8Array } from '../../../shared/utils/u8array'
import { validateTrimRange } from '../../../shared/utils/video'
import {
  checkVideoTools,
  encodeVideo,
  generateVideoCover,
  probeVideo,
  stopVideoProcesses,
  type VideoToolConfig,
} from './ffmpeg'

export type LocalVideoStorage = StorageProvider & {
  config: LocalStorageConfig
  getFilePath: (key: string) => Promise<string>
  createFromFile: (key: string, file: string) => Promise<StorageObject>
}

export function requireLocalVideoStorage(
  provider: StorageProvider,
): asserts provider is LocalVideoStorage {
  if (
    provider.config?.provider !== 'local' ||
    !provider.getFilePath ||
    !provider.createFromFile
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Video import and trimming require the local storage provider',
    })
  }
}

export function videoMediaId(storageKey: string) {
  return `video-${createHash('sha256').update(storageKey).digest('hex').slice(0, 32)}`
}

export function trimIdentity(mediaId: string, startMs: number, endMs: number) {
  const digest = createHash('sha256')
    .update(JSON.stringify([mediaId, startMs, endMs]))
    .digest('hex')
    .slice(0, 32)
  return { outputId: `clip-${digest}`, outputKey: `clips/${digest}.mp4` }
}

const lockedMedia = new Set<string>()
export async function withVideoMediaLock<T>(
  id: string,
  action: () => Promise<T>,
) {
  if (lockedMedia.has(id)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Media is busy; retry shortly',
    })
  }
  lockedMedia.add(id)
  try {
    return await action()
  } finally {
    lockedMedia.delete(id)
  }
}

export function assertVideoQueueCapacity(incoming = 1) {
  const count =
    useDB()
      .select({ count: sql<number>`count(*)` })
      .from(tables.pipelineQueue)
      .where(
        sql`${tables.pipelineQueue.status} IN ('pending', 'in-stages') AND json_extract(${tables.pipelineQueue.payload}, '$.type') IN ('video', 'video-trim')`,
      )
      .get()?.count ?? 0
  if (count + incoming > 20) {
    throw createError({
      statusCode: 429,
      statusMessage:
        'Video queue is full (20 tasks); wait for existing tasks to finish',
    })
  }
}

let serial: Promise<void> = Promise.resolve()
let stopping = false

export async function shutdownVideoTasks() {
  stopping = true
  stopVideoProcesses()
  await serial
}

export async function processVideoTask(
  task: PipelineQueueItem,
  provider: StorageProvider,
  config: VideoToolConfig,
) {
  const previous = serial
  let release!: () => void
  serial = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous
  let temporary: string | undefined
  const published: string[] = []
  try {
    if (stopping) throw new Error('Video processing was interrupted')
    if (!Number.isSafeInteger(task.id) || task.id < 1)
      throw new Error('Invalid video task ID')
    const scope = createHash('sha256')
      .update(process.cwd())
      .digest('hex')
      .slice(0, 16)
    temporary = path.join(
      tmpdir(),
      `kid-growth-video-${scope}`,
      `task-${task.id}`,
    )
    await rm(temporary, { recursive: true, force: true })
    requireLocalVideoStorage(provider)
    const payload = task.payload
    if (payload.type !== 'video' && payload.type !== 'video-trim') {
      throw new Error('Invalid video task')
    }
    const isTrim = payload.type === 'video-trim'
    const id = isTrim ? payload.outputId : payload.mediaId
    if (isTrim) {
      validateTrimRange(payload.startMs, payload.endMs, Number.MAX_SAFE_INTEGER)
      const identity = trimIdentity(
        payload.mediaId,
        payload.startMs,
        payload.endMs,
      )
      if (
        identity.outputId !== id ||
        identity.outputKey !== payload.outputKey
      ) {
        throw new Error('Invalid generated trim identity')
      }
    } else if (videoMediaId(payload.storageKey) !== id) {
      throw new Error('Invalid generated video identity')
    }
    const existing = useDB()
      .select()
      .from(tables.photos)
      .where(eq(tables.photos.id, id))
      .get()
    if (existing) return existing.id
    const source = isTrim
      ? useDB()
          .select()
          .from(tables.photos)
          .where(eq(tables.photos.id, payload.mediaId))
          .get()
      : null
    if (
      isTrim &&
      (!source ||
        source.mediaType !== 'video' ||
        source.isLivePhoto ||
        !source.storageKey)
    ) {
      throw new Error(
        'Original video no longer exists or is not an ordinary video',
      )
    }
    const storageKey = isTrim ? source!.storageKey! : payload.storageKey
    const input = await provider.getFilePath(storageKey)
    await checkVideoTools(config)
    const stage = (statusStage: PipelineQueueItem['statusStage']) =>
      useDB()
        .update(tables.pipelineQueue)
        .set({ statusStage })
        .where(eq(tables.pipelineQueue.id, task.id))
        .run()
    stage('video-probe')
    const info = await probeVideo(input, config)
    const startMs = isTrim ? payload.startMs : 0
    const endMs = isTrim ? payload.endMs : info.durationMs
    validateTrimRange(startMs, endMs, info.durationMs)
    const playbackKey = isTrim ? payload.outputKey : `video-playback/${id}.mp4`
    await mkdir(temporary, { recursive: true })
    let playbackFile: string
    if (await provider.getFileMeta(playbackKey)) {
      playbackFile = await provider.getFilePath(playbackKey)
      const recovered = await probeVideo(playbackFile, config)
      if (Math.abs(recovered.durationMs - (endMs - startMs)) > 500) {
        throw new Error(
          'Existing output is inconsistent; refusing to overwrite it',
        )
      }
    } else {
      const encoded = path.join(temporary, 'encoded.mp4')
      stage('video-encode')
      let lastProgress = -1
      await encodeVideo(
        input,
        encoded,
        { startMs, endMs, durationMs: info.durationMs },
        config,
        (progress) => {
          if (progress === lastProgress) return
          lastProgress = progress
          useDB()
            .update(tables.pipelineQueue)
            .set({ progress })
            .where(eq(tables.pipelineQueue.id, task.id))
            .run()
        },
      )
      await provider.createFromFile(playbackKey, encoded)
      published.push(playbackKey)
      playbackFile = await provider.getFilePath(playbackKey)
    }
    stage('video-cover')
    const cover = path.join(temporary, 'cover.jpg')
    await generateVideoCover(playbackFile, cover, config)
    const { thumbnailBuffer, thumbnailHash } = await generateThumbnailAndHash(
      await readFile(cover),
    )
    const thumbnailKey = `video-covers/${id}.webp`
    if (!(await provider.getFileMeta(thumbnailKey))) {
      const webp = path.join(temporary, 'cover.webp')
      await writeFile(webp, thumbnailBuffer)
      await provider.createFromFile(thumbnailKey, webp)
      published.push(thumbnailKey)
    }
    const outputInfo = await probeVideo(playbackFile, config)
    const originalMeta = await provider.getFileMeta(
      isTrim ? playbackKey : storageKey,
    )
    if (stopping) throw new Error('Video processing was interrupted')
    useDB()
      .insert(tables.photos)
      .values({
        id,
        mediaType: 'video',
        title: source?.title ?? path.basename(storageKey),
        description: source?.description ?? null,
        storageKey: isTrim ? playbackKey : storageKey,
        videoPlaybackKey: isTrim ? null : playbackKey,
        originalUrl: provider.getPublicUrl(playbackKey),
        thumbnailKey,
        thumbnailUrl: provider.getPublicUrl(thumbnailKey),
        thumbnailHash: thumbnailHash ? compressUint8Array(thumbnailHash) : null,
        width: outputInfo.width,
        height: outputInfo.height,
        aspectRatio: outputInfo.width / outputInfo.height,
        durationMs: outputInfo.durationMs,
        dateTaken:
          source?.dateTaken ??
          info.dateTaken ??
          originalMeta?.lastModified?.toISOString() ??
          new Date().toISOString(),
        lastModified:
          originalMeta?.lastModified?.toISOString() ?? new Date().toISOString(),
        fileSize: originalMeta?.size ?? null,
        tags: source?.tags ?? [],
        latitude: source?.latitude ?? null,
        longitude: source?.longitude ?? null,
        city: source?.city ?? null,
        country: source?.country ?? null,
        locationName: source?.locationName ?? null,
        sourceMediaId: source?.id ?? null,
        trimStartMs: isTrim ? startMs : null,
        trimEndMs: isTrim ? endMs : null,
      })
      .onConflictDoNothing()
      .run()
    published.length = 0
    return id
  } finally {
    try {
      const cleanup = await Promise.allSettled([
        ...published.map((key) => provider.delete(key)),
        ...(temporary ? [rm(temporary, { recursive: true, force: true })] : []),
      ])
      if (cleanup.some((result) => result.status === 'rejected')) {
        throw new Error(
          'Video cleanup failed; check storage permissions and retry the task',
        )
      }
    } finally {
      release()
    }
  }
}
