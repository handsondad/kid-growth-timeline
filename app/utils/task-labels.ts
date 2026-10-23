import type { PipelineQueueItem } from '~~/server/utils/db'

export const taskTypeLabels: Record<
  PipelineQueueItem['payload']['type'],
  string
> &
  Record<string, string> = {
  video: '视频导入',
  'video-trim': '视频裁剪',
  photo: '照片处理',
  'live-photo-video': 'LivePhoto视频',
  'photo-reverse-geocoding': '照片逆地理编码',
  'photo-erase-location': '照片位置信息抹除',
}

export const taskStageLabels: Record<
  NonNullable<PipelineQueueItem['statusStage']>,
  string
> &
  Record<string, string> = {
  'video-probe': '视频探测',
  'video-encode': '视频编码',
  'video-cover': '生成视频封面',
  preprocessing: '预处理',
  metadata: '元数据',
  thumbnail: '缩略图',
  exif: 'EXIF处理',
  'motion-photo': '动态照片处理',
  'reverse-geocoding': '地理解析',
  'live-photo': 'LivePhoto处理',
  'location-erase': '位置信息抹除',
}

export const taskStatusLabels: Record<PipelineQueueItem['status'], string> &
  Record<string, string> = {
  pending: '等待中',
  'in-stages': '处理中',
  completed: '已完成',
  failed: '失败',
}
