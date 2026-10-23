import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: '成长时光轴',
  description: '自部署、在线管理的个人画廊',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '指南', link: '/guide/getting-started' },
      { text: '开发文档', link: '/development/contributing' },
      { text: '演示', link: 'https://lens.bh8.ga' },
    ],

    sidebar: [
      {
        text: '指南',
        items: [
          { text: '快速开始', link: '/guide/getting-started' },
          { text: '配置说明', link: '/guide/configuration' },
          { text: '升级指南', link: '/guide/updates' },
        ],
      },
      {
        text: '配置',
        items: [
          { text: '存储提供器', link: '/configuration/storage-providers' },
          { text: '地图提供器', link: '/configuration/map-providers' },
          { text: '位置提供器', link: '/configuration/location-providers' },
        ],
      },
      {
        text: '开发',
        items: [
          { text: '贡献指南', link: '/development/contributing' },
          { text: 'API 文档', link: '/development/api' },
        ],
      },
    ],

    editLink: {
      text: '在 GitHub 上编辑此页面',
    },
  },
})
