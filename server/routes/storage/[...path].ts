import { createReadStream, promises as fs } from 'node:fs'
import { getStorageManager } from '../../plugins/3.storage'
import { parseByteRange } from '../../services/storage/range'
// lightweight: avoid TS type dep; fallback when not resolvable
const guessContentType = (filePath: string): string => {
  const ext = (filePath.split('.').pop() || '').toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    case 'bmp':
      return 'image/bmp'
    case 'tif':
    case 'tiff':
      return 'image/tiff'
    case 'mp4':
    case 'm4v':
      return 'video/mp4'
    case 'mov':
      return 'video/quicktime'
    case 'webm':
      return 'video/webm'
    case 'avi':
      return 'video/x-msvideo'
    case 'mkv':
      return 'video/x-matroska'
    case 'json':
      return 'application/json'
    default:
      return 'application/octet-stream'
  }
}

export default defineEventHandler(async (event) => {
  const manager = getStorageManager()
  const provider = manager.getProvider()

  if (provider.config?.provider !== 'local' || !provider.getFilePath) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const p = getRouterParam(event, 'path') || ''
  const relPathRaw = Array.isArray(p) ? p.join('/') : p
  // handle CJK characters in URL
  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(relPathRaw)
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid path encoding',
    })
  }
  const relPath = decodedPath
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '')

  if (decodedPath !== relPath) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  // 阻止路径穿越
  if (relPath.includes('..') || relPath.split('/').includes('.')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  let absolute: string
  let stat: Awaited<ReturnType<typeof fs.stat>>
  try {
    absolute = await provider.getFilePath(relPath)
    stat = await fs.stat(absolute)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
  // 设置缓存头
  const etag = `W/"${stat.size}-${stat.mtimeMs}"`
  setHeader(event, 'ETag', etag)
  setHeader(event, 'Last-Modified', stat.mtime.toUTCString())
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

  // Content-Type
  const contentType = guessContentType(absolute)
  setHeader(event, 'Content-Type', contentType)

  // 条件请求
  const inm = getHeader(event, 'if-none-match')
  const ims = getHeader(event, 'if-modified-since')
  if (
    inm === etag ||
    (ims && new Date(ims).getTime() >= stat.mtime.getTime())
  ) {
    event.node.res.statusCode = 304
    return null
  }

  // Range 支持
  const ifRange = getHeader(event, 'if-range')
  const range =
    !ifRange ||
    new Date(ifRange).getTime() >= Math.floor(stat.mtimeMs / 1000) * 1000
      ? getHeader(event, 'range')
      : undefined
  if (range) {
    try {
      const { start, end } = parseByteRange(range, stat.size)
      event.node.res.statusCode = 206
      setHeader(event, 'Content-Range', `bytes ${start}-${end}/${stat.size}`)
      setHeader(event, 'Accept-Ranges', 'bytes')
      event.node.res.setHeader('Content-Length', String(end - start + 1))
      if (event.method === 'HEAD') return null
      const stream = createReadStream(absolute, { start, end })
      return sendStream(event, stream)
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
      event.node.res.statusCode = 416
      setHeader(event, 'Content-Range', `bytes */${stat.size}`)
      return null
    }
  }

  // Full-file response: advertise the size so browsers can compute download
  // progress (XHR `lengthComputable`). Without it Node falls back to chunked
  // transfer encoding and the viewer's progress stays at 0% (#191).
  setHeader(event, 'Accept-Ranges', 'bytes')
  setHeader(event, 'Content-Length', stat.size)
  if (event.method === 'HEAD') return null
  const stream = createReadStream(absolute)
  return sendStream(event, stream)
})
