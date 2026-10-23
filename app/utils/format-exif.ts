const exifValues = {
  exposureProgram: {
    notDefined: '未定义',
    manual: '手动',
    programAe: '程序自动曝光',
    aperturePriorityAe: '光圈优先自动曝光',
    shutterSpeedPriorityAe: '快门优先自动曝光',
    creativeSlowSpeed: '创意（慢速）',
    actionHighSpeed: '动作（高速）',
    portrait: '人像',
    landscape: '风景',
    bulb: 'B门',
  },
  exposureMode: {
    auto: '自动',
    manual: '手动',
    autoBracket: '自动包围曝光',
  },
  flash: {
    noFlash: '未闪光',
    fired: '已闪光',
    firedReturnNotDetected: '已闪光，未检测到回光',
    firedReturnDetected: '已闪光，检测到回光',
    onDidNotFire: '开启，未闪光',
    onFired: '开启，已闪光',
    onReturnNotDetected: '开启，未检测到回光',
    onReturnDetected: '开启，检测到回光',
    offDidNotFire: '关闭，未闪光',
    offDidNotFireReturnNotDetected: '关闭，未闪光，未检测到回光',
    autoDidNotFire: '自动，未闪光',
    autoFired: '自动，已闪光',
    autoFiredReturnNotDetected: '自动，已闪光，未检测到回光',
    autoFiredReturnDetected: '自动，已闪光，检测到回光',
    noFlashFunction: '无闪光功能',
    offNoFlashFunction: '关闭，无闪光功能',
    firedRedEyeReduction: '已闪光，防红眼',
    firedRedEyeReductionReturnNotDetected: '已闪光，防红眼，未检测到回光',
    firedRedEyeReductionReturnDetected: '已闪光，防红眼，检测到回光',
    onRedEyeReduction: '开启，防红眼',
    onRedEyeReductionReturnNotDetected: '开启，防红眼，未检测到回光',
    onRedEyeReductionReturnDetected: '开启，防红眼，检测到回光',
    offRedEyeReduction: '关闭，防红眼',
    autoDidNotFireRedEyeReduction: '自动，未闪光，防红眼',
    autoFiredRedEyeReduction: '自动，已闪光，防红眼',
    autoFiredRedEyeReductionReturnNotDetected:
      '自动，已闪光，防红眼，未检测到回光',
    autoFiredRedEyeReductionReturnDetected: '自动，已闪光，防红眼，检测到回光',
  },
  meteringMode: {
    unknown: '未知',
    average: '平均测光',
    centerWeightedAverage: '中央重点平均测光',
    spot: '点测光',
    multiSpot: '多点测光',
    multiSegment: '矩阵测光',
    partial: '局部测光',
    other: '其他',
  },
  whiteBalance: {
    auto: '自动',
    manual: '手动',
    auto1: '正常校正，中性',
    auto2: '保留环境暖色',
  },
  sceneCaptureType: {
    standard: '标准',
    landscape: '风景',
    portrait: '人像',
    night: '夜景',
    other: '其他',
  },
  sensingMethod: {
    notDefined: '未定义',
    monochromeArea: '单色区域传感器',
    oneChipColorArea: '单片彩色区域传感器',
    twoChipColorArea: '双片彩色区域传感器',
    threeChipColorArea: '三片彩色区域传感器',
    colorSequentialArea: '顺序彩色区域传感器',
    monochromeLinear: '单色线性传感器',
    trilinear: '三线性传感器',
    colorSequentialLinear: '顺序彩色线性传感器',
  },
  colorSpace: {
    srgb: 'sRGB',
    adobeRgb: 'Adobe RGB',
    wideGamutRgb: '广色域 RGB',
    displayP3: 'Display P3',
    iccProfile: 'ICC 配置文件',
    uncalibrated: '未校准',
    rgb: 'RGB',
  },
} as const
export type ExifCategory = keyof typeof exifValues
export function formatExifValue(
  category: ExifCategory,
  value: string | number | undefined,
): string {
  if (value === undefined || value === null || value === '') return ''
  const original = String(value)
  const key = original
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase()
      return index === 0
        ? lower
        : lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join('')
  const labels: Record<string, string> = exifValues[category]
  return labels[key] ?? original
}
