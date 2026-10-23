import { spawn, type ChildProcess } from 'node:child_process'
import { stat } from 'node:fs/promises'
import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_MS,
  validateTrimRange,
} from '../../../shared/utils/video'

export interface VideoToolConfig {
  ffmpegPath?: string
  ffprobePath?: string
}

export interface VideoInfo {
  durationMs: number
  width: number
  height: number
  hasAudio: boolean
  dateTaken: string | null
}

const processes = new Set<ChildProcess>()

export function stopVideoProcesses() {
  for (const process of processes) process.kill('SIGKILL')
}

export function runVideoTool(
  executable: string,
  args: string[],
  options: {
    timeoutMs?: number
    progress?: (microseconds: number) => void
  } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    processes.add(child)
    let output = ''
    let partial = ''
    let failure: Error | undefined
    const timeout = setTimeout(() => {
      failure = new Error(
        'Video processing timed out; retry with a shorter video',
      )
      child.kill('SIGKILL')
    }, options.timeoutMs ?? 30000)
    child.stdout?.on('data', (chunk: Buffer) => {
      if (options.progress) {
        partial += chunk.toString()
        const lines = partial.split(/\r?\n/)
        partial = lines.pop() || ''
        for (const line of lines) {
          const match = /^out_time_us=(\d+)$/.exec(line)
          if (match) {
            try {
              options.progress(Number(match[1]))
            } catch {
              failure = new Error('Unable to save video task progress')
              child.kill('SIGKILL')
            }
          }
        }
        if (partial.length > 16384) {
          failure = new Error('Invalid FFmpeg progress response')
          child.kill('SIGKILL')
        }
      } else {
        output += chunk.toString()
        if (output.length > 1024 * 1024) {
          failure = new Error('Video tool response exceeded the size limit')
          child.kill('SIGKILL')
        }
      }
    })
    // Drain stderr, but do not retain personal paths or embedded metadata.
    child.stderr?.resume()
    child.on('error', (error: NodeJS.ErrnoException) => {
      failure = new Error(
        error.code === 'ENOENT' || error.code === 'EACCES'
          ? 'FFmpeg/FFprobe unavailable. Install both and set NUXT_FFMPEG_PATH and NUXT_FFPROBE_PATH, or add them to PATH'
          : 'Unable to start the video processing tool',
      )
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      processes.delete(child)
      if (failure) reject(failure)
      else if (code !== 0) {
        reject(
          new Error(
            `Video tool failed (exit ${code ?? 'interrupted'}); check the file format and FFmpeg codecs`,
          ),
        )
      } else resolve(output)
    })
  })
}

export async function checkVideoTools(config: VideoToolConfig) {
  const results = await Promise.allSettled([
    runVideoTool(config.ffmpegPath || 'ffmpeg', ['-version']),
    runVideoTool(config.ffprobePath || 'ffprobe', ['-version']),
  ])
  for (const result of results) {
    if (result.status === 'rejected') throw result.reason
  }
}

export async function probeVideo(
  file: string,
  config: VideoToolConfig,
): Promise<VideoInfo> {
  const info = await stat(file)
  if (!info.isFile() || info.size === 0 || info.size > MAX_VIDEO_BYTES) {
    throw new Error('Video must be a non-empty file no larger than 8 GiB')
  }
  const output = await runVideoTool(config.ffprobePath || 'ffprobe', [
    '-v',
    'error',
    '-protocol_whitelist',
    'file',
    '-format_whitelist',
    'mov,matroska,webm,avi',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    file,
  ])
  const parsed: {
    format?: { duration?: string; tags?: Record<string, string> }
    streams?: Array<{
      codec_type?: string
      width?: number
      height?: number
      duration?: string
      disposition?: { attached_pic?: number }
      tags?: Record<string, string>
      side_data_list?: Array<{ rotation?: number }>
    }>
  } = JSON.parse(output)
  const stream = parsed.streams?.find(
    (item) => item.codec_type === 'video' && !item.disposition?.attached_pic,
  )
  const durationMs = Math.round(
    Number(parsed.format?.duration || stream?.duration) * 1000,
  )
  let width = stream?.width ?? 0
  let height = stream?.height ?? 0
  if (
    !Number.isSafeInteger(durationMs) ||
    durationMs < 250 ||
    durationMs > MAX_VIDEO_DURATION_MS ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > 4096 * 4096 ||
    Math.max(width, height) > 8192
  ) {
    throw new Error(
      'Unsupported video: maximum duration is 4 hours and maximum frame size is 16 megapixels / 8192 pixels per side',
    )
  }
  const rotation =
    stream?.side_data_list?.find((item) => item.rotation !== undefined)
      ?.rotation ?? Number(stream?.tags?.rotate || 0)
  if (Math.abs(rotation % 180) === 90) [width, height] = [height, width]
  const creation =
    parsed.format?.tags?.creation_time || stream?.tags?.creation_time
  const date = creation ? new Date(creation) : null
  return {
    durationMs,
    width,
    height,
    hasAudio:
      parsed.streams?.some((item) => item.codec_type === 'audio') ?? false,
    dateTaken:
      date && Number.isFinite(date.getTime()) ? date.toISOString() : null,
  }
}

export async function encodeVideo(
  input: string,
  output: string,
  range: { startMs: number; endMs: number; durationMs: number },
  config: VideoToolConfig,
  progress: (percent: number) => void,
) {
  validateTrimRange(range.startMs, range.endMs, range.durationMs)
  const duration = range.endMs - range.startMs
  await runVideoTool(
    config.ffmpegPath || 'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-n',
      '-threads',
      '2',
      '-protocol_whitelist',
      'file',
      '-format_whitelist',
      'mov,matroska,webm,avi',
      '-i',
      input,
      '-ss',
      (range.startMs / 1000).toFixed(3),
      '-t',
      (duration / 1000).toFixed(3),
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-map_metadata',
      '-1',
      '-map_chapters',
      '-1',
      '-metadata:s:v:0',
      'rotate=0',
      '-vf',
      'pad=ceil(iw/2)*2:ceil(ih/2)*2',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-threads',
      '2',
      '-filter_threads',
      '1',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-movflags',
      '+faststart',
      '-fs',
      String(MAX_VIDEO_BYTES),
      '-progress',
      'pipe:1',
      '-nostats',
      output,
    ],
    {
      timeoutMs: 30 * 60 * 1000,
      progress: (us) =>
        progress(Math.min(99, Math.floor(us / (duration * 10)))),
    },
  )
  const result = await probeVideo(output, config)
  if (Math.abs(result.durationMs - duration) > 500) {
    throw new Error(
      'Encoded duration does not match the selected range; no output was published',
    )
  }
  return result
}

export async function generateVideoCover(
  input: string,
  output: string,
  config: VideoToolConfig,
) {
  await runVideoTool(config.ffmpegPath || 'ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-n',
    '-threads',
    '2',
    '-protocol_whitelist',
    'file',
    '-format_whitelist',
    'mov,matroska,webm,avi',
    '-i',
    input,
    '-map',
    '0:v:0',
    '-frames:v',
    '1',
    '-vf',
    'scale=600:600:force_original_aspect_ratio=decrease',
    '-an',
    '-map_metadata',
    '-1',
    '-threads',
    '2',
    output,
  ])
}
