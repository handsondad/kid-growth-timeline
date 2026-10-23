import type { SettingConfig } from '~~/shared/types/settings'

// 存储提供商的枚举值
export const STORAGE_PROVIDERS = ['local', 's3', 'openlist'] as const
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number]

export const DEFAULT_SETTINGS = [
  // NAMESPACE: system
  // NAMESPACE: app
  {
    namespace: 'app',
    key: 'title',
    type: 'string',
    defaultValue: 'Kid Growth Timeline',
    label: '实例名称',
    description: '实例的标题',
    isPublic: true,
  },
  {
    namespace: 'app',
    key: 'slogan',
    type: 'string',
    defaultValue: '',
    label: '标语',
    description: '实例的标语',
    isPublic: true,
  },
  {
    namespace: 'app',
    key: 'author',
    type: 'string',
    defaultValue: '',
    label: '所有者',
    description: '实例的所有者名称',
    isPublic: true,
  },
  {
    namespace: 'app',
    key: 'avatarUrl',
    type: 'string',
    defaultValue: '',
    label: '头像 URL',
    description: '所有者头像的图片链接',
    isPublic: true,
  },
  {
    namespace: 'app',
    key: 'appearance.theme',
    type: 'string',
    defaultValue: 'system',
    enum: ['light', 'dark', 'system'],
    label: '主题',
    description: '选择应用主题',
    isPublic: true,
  },
  // NAMESPACE: map
  {
    namespace: 'map',
    key: 'provider',
    type: 'string',
    defaultValue: 'maplibre',
    enum: ['mapbox', 'maplibre'],
    label: '地图服务商',
    description: '选择地图服务商提供者',
    isPublic: true,
  },
  {
    namespace: 'map',
    key: 'mapbox.token',
    type: 'string',
    defaultValue: '',
    label: 'Mapbox Token',
    description: 'Mapbox API 访问令牌',
    isPublic: true,
  },
  {
    namespace: 'map',
    key: 'mapbox.style',
    type: 'string',
    defaultValue: '',
    label: 'Mapbox 样式',
    description: 'Mapbox 地图样式 URL',
    isPublic: true,
  },
  {
    namespace: 'map',
    key: 'maplibre.token',
    type: 'string',
    defaultValue: '',
    label: 'MapTiler Token',
    description: 'MapTiler API 访问令牌',
    isPublic: true,
  },
  {
    namespace: 'map',
    key: 'maplibre.style',
    type: 'string',
    defaultValue: '',
    label: 'MapLibre 样式',
    description: 'MapLibre 地图样式 URL',
    isPublic: true,
  },
  // NAMESPACE: location
  {
    namespace: 'location',
    key: 'mapbox.token',
    type: 'string',
    defaultValue: '',
    label: 'Mapbox Token',
    description: 'Mapbox API 访问令牌',
    isPublic: true,
  },
  {
    namespace: 'location',
    key: 'nominatim.baseUrl',
    type: 'string',
    defaultValue: '',
    label: 'Nominatim 基础 URL',
    description: 'Nominatim 反向地理编码 API 的基础 URL',
    isPublic: true,
  },
  // NAMESPACE: storage
  {
    namespace: 'storage',
    key: 'provider',
    type: 'number',
    defaultValue: null,
    label: '默认存储配置',
    description: '选择应用管理媒体文件时默认使用的存储配置',
  },
  // NAMESPACE: analytics
  {
    namespace: 'analytics',
    key: 'headScripts',
    type: 'string',
    defaultValue: '',
    label: 'Head 脚本',
    description: '包含 script 标签的 HTML 片段，注入到页面 head 中。',
    isPublic: true,
  },
  {
    namespace: 'analytics',
    key: 'bodyScripts',
    type: 'string',
    defaultValue: '',
    label: 'Body 脚本',
    description: '包含 script 标签的 HTML 片段，注入到 body 开头。',
    isPublic: true,
  },
] as const satisfies SettingConfig[]

export const settingNamespaces = [
  ...new Set(DEFAULT_SETTINGS.map((s) => s.namespace)),
] as const
export const settingKeys = [
  ...new Set(DEFAULT_SETTINGS.map((s) => s.key)),
] as const

export type SettingNamespace = (typeof settingNamespaces)[number]
export type SettingKey<N extends SettingNamespace> = Extract<
  (typeof DEFAULT_SETTINGS)[number],
  { namespace: N }
>['key']
