import type { FieldUIConfig } from '~~/shared/types/settings'

/**
 * Extended settings configuration with UI descriptions
 * This defines how the frontend displays and interacts with each settings field
 *
 * Note:
 * - This is only used on the Server side
 * - UI configuration information is returned to the frontend via API
 * - Avoid duplicating these configurations on the frontend
 */
export const APP_SETTINGS_UI: Record<string, FieldUIConfig> = {
  title: {
    type: 'input',
    placeholder: 'Kid Growth Timeline',
    required: true,
  },
  slogan: {
    type: 'input',
    placeholder: '图库标语',
    help: '标语显示在首页的标题下方',
  },
  author: {
    type: 'input',
    placeholder: '你的名字',
  },
  avatarUrl: {
    type: 'url',
    placeholder: 'https://example.com/avatar.jpg',
    help: '头像显示加载页面和首页头像中',
  },
  'appearance.theme': {
    type: 'tabs',
    options: [
      {
        label: '浅色',
        value: 'light',
        icon: 'tabler:sun',
      },
      {
        label: '深色',
        value: 'dark',
        icon: 'tabler:moon',
      },
      {
        label: '系统',
        value: 'system',
        icon: 'tabler:device-desktop',
      },
    ],
    help: '用户可以在自己的浏览器中覆盖此项',
  },
}

export const MAP_SETTINGS_UI: Record<string, FieldUIConfig> = {
  provider: {
    type: 'tabs',
    options: [
      { label: 'MapBox', value: 'mapbox' },
      { label: 'MapLibre', value: 'maplibre' },
    ],
  },
  'mapbox.token': {
    type: 'password',
    placeholder: 'pk.xxxxxx',
    required: true,
    visibleIf: { fieldKey: 'provider', value: 'mapbox' },
    help: '应当使用没有域名限制的令牌',
  },
  'mapbox.style': {
    type: 'input',
    placeholder: 'mapbox://styles/mapbox/light-v11',
    visibleIf: { fieldKey: 'provider', value: 'mapbox' },
  },
  'maplibre.token': {
    type: 'password',
    placeholder: 'pk.xxxxxx',
    required: true,
    visibleIf: { fieldKey: 'provider', value: 'maplibre' },
    help: 'MapLibre 默认使用免费地图服务商 MapTiler',
  },
  'maplibre.style': {
    type: 'input',
    placeholder: 'https://example.com/style.json',
    visibleIf: { fieldKey: 'provider', value: 'maplibre' },
  },
}

export const LOCATION_SETTINGS_UI: Record<string, FieldUIConfig> = {
  'mapbox.token': {
    type: 'password',
    placeholder: 'pk.xxxxxx',
    help: '配置后将取代 Nominatim 作为位置信息服务',
  },
  'nominatim.baseUrl': {
    type: 'url',
    placeholder: 'https://nominatim.openstreetmap.org',
    help: '留空则默认使用公共 Nominatim 服务',
  },
}

export const PRIVACY_SETTINGS_UI: Record<string, FieldUIConfig> = {
  'upload.autoEraseLocation': {
    type: 'toggle',
    help: '启用后会将抹除位置信息操作放入队列异步执行',
  },
}

export const ANALYTICS_SETTINGS_UI: Record<string, FieldUIConfig> = {
  headScripts: {
    type: 'textarea',
    rows: 12,
    placeholder:
      "<!-- Google Analytics -->\n<script async src=\"https://www.googletagmanager.com/gtag/js?id=G-XXXX\"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', 'G-XXXX');\n</script>",
    help: '粘贴完整的 script 标签（支持多个）。适用于 GA、百度统计、Plausible、Umami、JSON-LD 等。已有的 Matomo 集成独立运行，互不干扰。',
  },
  bodyScripts: {
    type: 'textarea',
    rows: 12,
    placeholder:
      '<!-- Umami / Openpanel SDK -->\n<script src="https://analytics.example.com/script.js" data-website-id="xxx" defer></script>',
    help: '粘贴完整的 script 标签（支持多个）。适用于需要在 body 开始处执行的脚本。',
  },
}

export const SYSTEM_SETTINGS_UI: Record<string, FieldUIConfig> = {
  'upload.maxFileSize': {
    type: 'number',
    help: '设置后将立即生效，影响所有用户的文件上传操作',
    min: 1,
    max: 10240,
  },
  'upload.duplicateCheck.enabled': {
    type: 'toggle',
    help: '关闭后将不进行重复预检查，同名文件会直接进入上传流程',
  },
  'upload.duplicateCheck.mode': {
    type: 'tabs',
    options: [
      {
        label: '跳过',
        value: 'skip',
        icon: 'tabler:player-track-next',
      },
      {
        label: '警告并覆盖',
        value: 'warn',
        icon: 'tabler:alert-triangle',
      },
      {
        label: '阻止上传',
        value: 'block',
        icon: 'tabler:ban',
      },
    ],
    help: '仅在开启重复文件检测时生效',
  },
}

export const STORAGE_SETTINGS_UI: Record<string, FieldUIConfig> = {
  provider: {
    type: 'custom',
    options: [
      {
        label: '本地存储',
        value: 'local',
        icon: 'tabler:server',
        description: '直接将照片存储在服务器的文件系统中。',
      },
      {
        label: 'S3 兼容存储',
        value: 's3',
        icon: 'tabler:brand-aws',
        description: '使用 AWS S3、Cloudflare R2 或其他 S3 兼容服务。',
      },
      {
        label: 'OpenList',
        value: 'openlist',
        icon: 'tabler:stack',
        description: '连接到 Alist 或 OpenList 实例进行存储。',
      },
    ],
  },
  name: {
    type: 'input',
    required: true,
  },
  // Local
  'local.basePath': {
    type: 'input',
    required: true,
    help: '用于存储照片的本地文件系统路径',
    visibleIf: { fieldKey: 'provider', value: 'local' },
  },
  'local.baseUrl': {
    type: 'input',
    help: '用于访问存储照片的公开 URL 基础',
    visibleIf: { fieldKey: 'provider', value: 'local' },
  },
  'local.prefix': {
    type: 'input',
    placeholder: 'photos/',
    help: '用于在存储中组织照片的前缀路径',
    visibleIf: { fieldKey: 'provider', value: 'local' },
  },
  // S3
  's3.endpoint': {
    type: 'input',
    required: true,
    placeholder: 'https://s3.amazonaws.com',
    help: '自定义 S3 兼容端点 URL（例如 MinIO）',
    visibleIf: { fieldKey: 'provider', value: 's3' },
  },
  's3.bucket': {
    type: 'input',
    required: true,
    help: '用于存储照片的 S3 存储桶名称',
    visibleIf: { fieldKey: 'provider', value: 's3' },
  },
  's3.region': {
    type: 'input',
    required: true,
    help: 'S3 存储桶所在的 AWS 区域',
    visibleIf: { fieldKey: 'provider', value: 's3' },
  },
  's3.accessKeyId': {
    type: 'input',
    required: true,
    help: 'AWS 访问密钥 ID 或等效项',
    visibleIf: { fieldKey: 'provider', value: 's3' },
  },
  's3.secretAccessKey': {
    type: 'password',
    required: true,
    help: 'AWS 秘密访问密钥或等效项',
    visibleIf: { fieldKey: 'provider', value: 's3' },
  },
  's3.prefix': {
    type: 'input',
    placeholder: '/photos',
    help: '存储桶中对象的前缀路径',
    visibleIf: { fieldKey: 'provider', value: 's3' },
  },
  's3.cdnUrl': {
    type: 'input',
    help: '用于访问图像的自定义 CDN URL',
    visibleIf: { fieldKey: 'provider', value: 's3' },
  },
  's3.forcePathStyle': {
    type: 'toggle',
    help: '使用路径风格 URL 而不是虚拟主机风格',
    visibleIf: { fieldKey: 'provider', value: 's3' },
  },
  's3.maxKeys': {
    type: 'number',
    help: '每个请求检索的最大密钥数',
    visibleIf: { fieldKey: 'provider', value: 's3' },
  },
  // OpenList
  'openlist.baseUrl': {
    type: 'input',
    required: true,
    placeholder: 'https://alist.example.com',
    help: 'OpenList 服务器的基础 URL',
    visibleIf: { fieldKey: 'provider', value: 'openlist' },
  },
  'openlist.rootPath': {
    type: 'input',
    required: true,
    placeholder: '/photos',
    help: '在 OpenList 中存储照片的根路径',
    visibleIf: { fieldKey: 'provider', value: 'openlist' },
  },
  'openlist.token': {
    type: 'password',
    required: true,
    help: 'OpenList API 身份验证令牌',
    visibleIf: { fieldKey: 'provider', value: 'openlist' },
  },
  'openlist.cdnUrl': {
    type: 'input',
    help: '用于访问图像的自定义 CDN URL',
    visibleIf: { fieldKey: 'provider', value: 'openlist' },
  },
  'openlist.uploadEndpoint': {
    type: 'input',
    placeholder: '/api/fs/put',
    help: '用于上传文件的 API 端点（默认：/api/fs/put）',
    visibleIf: { fieldKey: 'provider', value: 'openlist' },
  },
  'openlist.downloadEndpoint': {
    type: 'input',
    help: '用于下载文件的 API 端点（可选）',
    visibleIf: { fieldKey: 'provider', value: 'openlist' },
  },
  'openlist.listEndpoint': {
    type: 'input',
    help: '用于列出文件的 API 端点（可选）',
    visibleIf: { fieldKey: 'provider', value: 'openlist' },
  },
  'openlist.deleteEndpoint': {
    type: 'input',
    placeholder: '/api/fs/remove',
    help: '用于删除文件的 API 端点（默认：/api/fs/remove）',
    visibleIf: { fieldKey: 'provider', value: 'openlist' },
  },
  'openlist.metaEndpoint': {
    type: 'input',
    placeholder: '/api/fs/get',
    help: '用于检索文件元数据的 API 端点（默认：/api/fs/get）',
    visibleIf: { fieldKey: 'provider', value: 'openlist' },
  },
  'openlist.pathField': {
    type: 'input',
    placeholder: 'path',
    help: 'API 请求中文件路径的参数名称（默认：path）',
    visibleIf: { fieldKey: 'provider', value: 'openlist' },
  },
}

/**
 * Get UI configuration for a specific setting
 * Used to return complete field descriptions in the fields.get.ts API
 */
export function getSettingUIConfig(
  namespace: string,
  key: string,
): FieldUIConfig | undefined {
  const uiConfigMap: Record<string, Record<string, FieldUIConfig>> = {
    app: APP_SETTINGS_UI,
    system: SYSTEM_SETTINGS_UI,
    privacy: PRIVACY_SETTINGS_UI,
    map: MAP_SETTINGS_UI,
    location: LOCATION_SETTINGS_UI,
    storage: STORAGE_SETTINGS_UI,
    analytics: ANALYTICS_SETTINGS_UI,
  }

  return uiConfigMap[namespace]?.[key]
}
