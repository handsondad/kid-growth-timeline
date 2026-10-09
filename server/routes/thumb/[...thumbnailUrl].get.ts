import sharp from 'sharp'
import { eq, tables, useDB } from '~~/server/utils/db'

const MAX_THUMBNAIL_BYTES = 20 * 1024 * 1024

export default eventHandler(async (event) => {
  const { storageProvider } = useStorageProvider(event)

  let url = getRouterParam(event, 'thumbnailUrl')

  if (!url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid thumbnailUrl',
    })
  }

  url = decodeURIComponent(url)
  const storedThumbnail = useDB()
    .select({ thumbnailUrl: tables.photos.thumbnailUrl })
    .from(tables.photos)
    .where(eq(tables.photos.thumbnailUrl, url))
    .get()

  if (!storedThumbnail) {
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }

  const isAppPath = url.startsWith('/storage/') || url.startsWith('/image/')
  let absoluteUrl: URL | undefined
  if (!isAppPath) {
    try {
      absoluteUrl = new URL(url)
    } catch {
      throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
    }
    if (absoluteUrl.protocol !== 'http:' && absoluteUrl.protocol !== 'https:') {
      throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
    }
  }
  if (
    storageProvider.config?.provider === 'local' &&
    (url.startsWith('/storage/') || url.startsWith('/image/'))
  ) {
    const scheme = event.node.req.headers['x-forwarded-proto'] || 'http'
    url = `${scheme}://${event.node.req.headers.host}${url}`
  }

  let response: Response
  try {
    response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }

  if (!response.ok || !response.body) {
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }

  const contentLength = Number(response.headers.get('content-length'))
  if (contentLength > MAX_THUMBNAIL_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Thumbnail too large' })
  }

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    totalBytes += value.byteLength
    if (totalBytes > MAX_THUMBNAIL_BYTES) {
      await reader.cancel()
      throw createError({
        statusCode: 413,
        statusMessage: 'Thumbnail too large',
      })
    }

    chunks.push(Buffer.from(value))
  }

  const photo = Buffer.concat(chunks)

  const sharpInst = sharp(photo).rotate()
  return await sharpInst.jpeg({ quality: 85 }).toBuffer()
})
