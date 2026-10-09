import { eq } from 'drizzle-orm'
import { Readable } from 'node:stream'
import { tables, useDB } from '../../utils/db'

export default eventHandler(async (event) => {
  const { storageProvider } = useStorageProvider(event)
  const key = getRouterParam(event, 'key')

  if (!key) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid key' })
  }
  const decodedKey = decodeURIComponent(key)
  const cleanKey = decodedKey
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '')
  if (decodedKey !== cleanKey) {
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }
  if (cleanKey.split('/').some((part) => part === '..' || part === '.')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid key' })
  }

  const protectedMatch = /^__photo__\/([^/]+)\/(original|thumbnail|live)$/.exec(
    decodedKey,
  )
  if (protectedMatch) {
    const [, photoId, kind] = protectedMatch
    const photo = useDB()
      .select()
      .from(tables.photos)
      .where(eq(tables.photos.id, photoId))
      .get()
    if (!photo) {
      throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
    }
    const targetUrl =
      kind === 'original'
        ? photo.originalUrl
        : kind === 'thumbnail'
          ? photo.thumbnailUrl
          : photo.livePhotoVideoUrl
    if (!targetUrl) {
      throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
    }

    const absoluteTarget = new URL(targetUrl, getRequestURL(event)).toString()
    const headers: Record<string, string> = {}
    for (const name of ['range', 'if-range']) {
      const value = getHeader(event, name)
      if (value) headers[name] = value
    }
    const response = await fetch(
      absoluteTarget,
      Object.keys(headers).length ? { headers } : undefined,
    )
    if (!response.ok) {
      throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
    }
    event.node.res.statusCode = response.status
    for (const name of [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'content-disposition',
      'etag',
      'last-modified',
      'cache-control',
    ]) {
      const value = response.headers.get(name)
      if (value) setHeader(event, name, value)
    }
    if (!response.body) {
      throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
    }
    return sendStream(event, Readable.fromWeb(response.body))
  }

  const photo = await storageProvider.get(cleanKey)
  if (!photo) {
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }
  logger.main.info('Serve image from key', key)
  return photo
})
