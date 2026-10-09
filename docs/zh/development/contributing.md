# 开始贡献

本文档将指导您搭建 成长时光轴 的开发环境，包括环境要求、依赖安装、配置设置和开发工具。

## 环境要求

### 必需软件

- **Node.js**: 22 LTS
- **pnpm**: 10.34.1
- **Git**: 最新版本

## 克隆与安装

### 1. 克隆代码库

```bash
# 使用 HTTPS
git clone https://github.com/handsondad/kid-growth-timeline.git

# 或使用 SSH
git clone git@github.com:handsondad/kid-growth-timeline.git

# 进入项目目录
cd kid-growth-timeline

# 设置上游远程仓库
git remote add upstream https://github.com/handsondad/kid-growth-timeline.git
```

### 2. 安装依赖

```bash
# 安装 pnpm（如果尚未安装）
npm install -g pnpm

# 安装项目依赖
pnpm install
```

### 3. 本机运行

本地开发无需环境文件。应用会在 `data/` 下自动初始化 SQLite 和本地文件存储。服务仅监听 `127.0.0.1`；由于应用不启用身份验证，请保持本机访问。

## 项目架构

### 目录结构

```
kid-growth-timeline/
├── app/                    # Nuxt 4 应用目录
│   ├── components/         # Vue 组件
│   │   ├── ui/            # 通用 UI 组件
│   │   ├── photo/         # 照片相关组件
│   │   ├── masonry/       # 瀑布流布局组件
│   │   └── ...
│   ├── pages/             # 路由页面
│   ├── composables/       # Vue 组合式函数
│   ├── stores/            # Pinia 状态管理
│   ├── layouts/           # 布局模板
│   ├── plugins/           # Nuxt 插件
│   └── utils/             # 工具函数
│       ├── src/
│       │   ├── core/      # 核心引擎
│       │   ├── components/ # Vue 组件
│       │   └── types/     # 类型定义
│       └── package.json
├── server/                # Nitro 服务端
│   ├── api/              # API 路由
│   │   ├── photos/       # 照片管理 API
│   │   └── system/       # 系统 API
│   ├── database/         # 数据库相关
│   │   ├── schema.ts     # 数据库模式
│   │   └── migrations/   # 迁移文件
│   ├── services/         # 业务逻辑服务
│   │   ├── storage/      # 存储服务
│   │   ├── image/        # 图片处理
│   │   ├── location/     # 地理位置
│   │   └── pipeline-queue/ # 处理队列
│   ├── tasks/            # 后台任务
│   └── utils/            # 服务端工具
├── shared/               # 前后端共享代码
│   ├── types/           # TypeScript 类型定义
│   └── utils/           # 共享工具函数
├── docs/                # 项目文档
├── scripts/             # 构建和部署脚本
└── 配置文件...
```

### 技术栈

#### 前端技术

- **Nuxt 4**: Vue.js 全栈框架
- **TypeScript**: 类型安全的 JavaScript
- **TailwindCSS**: 实用优先的 CSS 框架

#### 后端技术

- **Nitro**: 服务端框架
- **SQLite**: 轻量级数据库
- **Drizzle ORM**: 类型安全的 ORM
- **Sharp**: 高性能图片处理
- **ExifTool**: EXIF 数据提取

## 开发流程

### 启动开发服务器

```bash
# 启动本机开发服务器
pnpm dev
```

### 数据库操作

```bash
# 生成迁移文件
pnpm db:generate

# 执行数据库迁移
pnpm db:migrate
```

### 构建项目

```bash
# 构建完整项目
pnpm build

# 预览生产构建
pnpm preview
```

## 测试环境

### Mapbox 开发令牌

1. 注册 [Mapbox 账户](https://account.mapbox.com/)
2. 创建开发用的访问令牌
3. 设置 URL 限制：`http://localhost:3000`
4. 将令牌添加到 `.env` 文件

## 代码规范

### TypeScript 规范

```typescript
// ✅ 好的做法
interface PhotoMetadata {
  id: string
  title?: string
  width: number
  height: number
  createdAt: Date
}

// ❌ 避免使用 any
const processPhoto = (photo: any) => { ... }

// ✅ 使用具体类型
const processPhoto = (photo: PhotoMetadata) => { ... }
```

### Vue 组件规范

```vue
<!-- ✅ 推荐的组件结构 -->
<script setup lang="ts">
// 导入
import { ref, computed } from 'vue'
import type { Photo } from '~/types'

// Props 和 Emits
interface Props {
  photos: Photo[]
  loading?: boolean
}

interface Emits {
  select: [photo: Photo]
  delete: [photoId: string]
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const emit = defineEmits<Emits>()

// 响应式数据
const selectedPhoto = ref<Photo | null>(null)

// 计算属性
const photoCount = computed(() => props.photos.length)

// 方法
const handlePhotoClick = (photo: Photo) => {
  selectedPhoto.value = photo
  emit('select', photo)
}
</script>

<template>
  <div class="photo-grid">
    <!-- 模板内容 -->
  </div>
</template>

<style scoped>
/* 组件样式 */
</style>
```

### 数据库调用

在 `server` 中使用数据库操作时，使用 `useDB()` 获取数据库的 Drizzle 实例。该 composable 在服务端是全局自动导入的：

```typescript
const db = useDB()

const photos = await db.select().from(photosTable)
```

### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
feat: 添加照片批量删除功能
fix: 修复图片查看器在 Safari 中的兼容性问题
docs: 更新部署文档
style: 统一代码格式
refactor: 重构存储服务接口
test: 添加照片上传的单元测试
chore: 更新依赖包版本
```

## 贡献指南

### 开发流程

1. **Fork 项目**: 在 GitHub 上 fork 项目
2. **创建分支**: `git checkout -b feature/new-feature`
3. **开发功能**: 编写代码和测试
4. **提交更改**: 使用规范的提交信息
5. **推送分支**: `git push origin feature/new-feature`
6. **创建 PR**: 在 GitHub 上创建 Pull Request

### Pull Request 检查清单

提交 PR 前请确保：

- 代码通过所有测试
- 遵循代码规范
- 更新相关文档
- 添加适当的测试用例
- PR 描述清晰，包含变更说明

## 贡献机会

### 适合新手的任务

寻找标有以下标签的 Issues：

- `good first issue`: 适合新手的任务
- `help wanted`: 需要社区帮助的任务
- `documentation`: 文档相关的改进

## 有用资源

### 官方文档

- [Nuxt 4 文档](https://nuxt.com/)
- [Vue 3 文档](https://vuejs.org/)
- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [TailwindCSS 文档](https://tailwindcss.com/)

### 社区资源

- [GitHub Issues](https://github.com/handsondad/kid-growth-timeline/issues)
- [GitHub Discussions](https://github.com/handsondad/kid-growth-timeline/discussions)
