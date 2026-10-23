import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Kid Growth Timeline',
  description: '本机使用的家庭照片与视频时间轴',
  lang: 'zh-CN',
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    [
      'script',
      {
        async: '',
        src: 'https://www.googletagmanager.com/gtag/js?id=G-RQSZM9PP5F',
      },
    ],
    [
      'script',
      {},
      `window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-RQSZM9PP5F');`,
    ],
    [
      'script',
      {
        async: '',
        src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7236608137732943',
        crossorigin: 'anonymous',
      },
    ],
  ],
  lastUpdated: true,
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '使用指南', link: '/guide/getting-started' },
      { text: '开发文档', link: '/development/contributing' },
      { text: '演示', link: 'https://lens.bh8.ga' },
    ],

    sidebar: [
      {
        text: '使用指南',
        items: [
          { text: '快速开始', link: '/guide/getting-started' },
          { text: '配置', link: '/guide/configuration' },
          { text: '更新指南', link: '/guide/updates' },
        ],
      },
      {
        text: '配置',
        items: [
          {
            text: '存储服务',
            link: '/configuration/storage-providers',
          },
          { text: '地图服务', link: '/configuration/map-providers' },
          {
            text: '地理编码服务',
            link: '/configuration/location-providers',
          },
        ],
      },
      {
        text: '开发文档',
        items: [
          { text: '贡献指南', link: '/development/contributing' },
          { text: 'API 文档', link: '/development/api' },
          { text: '添加设置项', link: '/development/how-to-add-setting' },
        ],
      },
    ],

    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/handsondad/kid-growth-timeline',
      },
    ],

    editLink: {
      pattern:
        'https://github.com/handsondad/kid-growth-timeline/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页',
    },

    search: {
      provider: 'local',
    },

    footer: {
      message: '基于 MIT 许可证发布。',
      copyright: 'Copyright © 2025 Timothy Yin',
    },
  },
  ignoreDeadLinks: [/^http?:\/\/localhost/],
})
