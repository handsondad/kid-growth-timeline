# Contributing Guide

For the latest development instructions, see the [contributing guide](docs/development/contributing.md).

## Environment Requirements

### Required Software

- **Node.js**: 22 LTS
- **pnpm**: 10.34.1
- **Git**: Latest version

## Clone and Install

### 1. Clone Repository

```bash
# Using HTTPS
git clone https://github.com/handsondad/kid-growth-timeline.git

# Or using SSH
git clone git@github.com:handsondad/kid-growth-timeline.git

# Enter project directory
cd kid-growth-timeline

# Set upstream remote repository
git remote add upstream https://github.com/handsondad/kid-growth-timeline.git
```

### 2. Install Dependencies

```bash
# Install pnpm (if not already installed)
npm install -g pnpm

# Install project dependencies
pnpm install
```

### 3. Run Locally

No environment file is required for local development. SQLite and local file storage are initialized under `data/` automatically. The server binds to `127.0.0.1`; keep it local because authentication is disabled.

## Project Architecture

### Directory Structure

```
kid-growth-timeline/
├── app/                    # Nuxt 4 application directory
│   ├── components/         # Vue components
│   │   ├── ui/            # Common UI components
│   │   ├── photo/         # Photo-related components
│   │   ├── masonry/       # Masonry layout components
│   │   └── ...
│   ├── pages/             # Route pages
│   ├── composables/       # Vue composables
│   ├── stores/            # Pinia state management
│   ├── layouts/           # Layout templates
│   ├── plugins/           # Nuxt plugins
│   └── utils/             # Utility functions
├── server/                # Nitro server-side
│   ├── api/              # API routes
│   │   ├── photos/       # Photo management API
│   │   └── system/       # System API
│   ├── database/         # Database related
│   │   ├── schema.ts     # Database schema
│   │   └── migrations/   # Migration files
│   ├── services/         # Business logic services
│   │   ├── storage/      # Storage services
│   │   ├── image/        # Image processing
│   │   ├── location/     # Geolocation
│   │   └── pipeline-queue/ # Processing queue
│   ├── tasks/            # Background tasks
│   └── utils/            # Server-side utilities
├── shared/               # Shared code between frontend and backend
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Shared utilities
├── docs/                # Project documentation
├── scripts/             # Build and deployment scripts
└── Configuration files...
```

### Technology Stack

#### Frontend Technologies

- **Nuxt 4**: Vue.js full-stack framework
- **TypeScript**: Type-safe JavaScript
- **TailwindCSS**: Utility-first CSS framework

#### Backend Technologies

- **Nitro**: Server-side framework
- **SQLite**: Lightweight database
- **Drizzle ORM**: Type-safe ORM
- **Sharp**: High-performance image processing
- **ExifTool**: EXIF data extraction

## Development Workflow

### Start Development Server

```bash
# Start development server on localhost
pnpm dev
```

### Database Operations

```bash
# Generate migration files
pnpm db:generate

# Execute database migrations
pnpm db:migrate
```

### Build Project

```bash
# Build complete project
pnpm build

# Preview production build
pnpm preview
```

## Testing Environment

### Mapbox Development Tokens

1. Register [Mapbox account](https://account.mapbox.com/)
2. Create development access tokens
3. Set URL restriction: `http://localhost:3000`
4. Add tokens to `.env` file

## Code Standards

### TypeScript Standards

```typescript
// ✅ Good practice
interface PhotoMetadata {
  id: string
  title?: string
  width: number
  height: number
  createdAt: Date
}

// ❌ Avoid using any
const processPhoto = (photo: any) => { ... }

// ✅ Use specific types
const processPhoto = (photo: PhotoMetadata) => { ... }
```

### Vue Component Standards

```vue
<!-- ✅ Recommended component structure -->
<script setup lang="ts">
// Imports
import { ref, computed } from 'vue'
import type { Photo } from '~/types'

// Props and Emits
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

// Reactive data
const selectedPhoto = ref<Photo | null>(null)

// Computed properties
const photoCount = computed(() => props.photos.length)

// Methods
const handlePhotoClick = (photo: Photo) => {
  selectedPhoto.value = photo
  emit('select', photo)
}
</script>

<template>
  <div class="photo-grid">
    <!-- Template content -->
  </div>
</template>

<style scoped>
/* Component styles */
</style>
```

### Database Calls

When using database operations in `server`, use `useDB()` to get the Drizzle instance. This composable is globally auto-imported on the server side:

```typescript
const db = useDB()

const photos = await db.select().from(photosTable)
```

### Commit Message Standards

Use [Conventional Commits](https://www.conventionalcommits.org/) standard:

```
feat: add photo batch delete functionality
fix: fix WebGL viewer compatibility issue in Safari
docs: update deployment documentation
style: unify code formatting
refactor: refactor storage service interface
test: add unit tests for photo upload
chore: update dependency versions
```

## Contribution Guidelines

### Development Process

1. **Fork Project**: Fork the project on GitHub
2. **Create Branch**: `git checkout -b feature/new-feature`
3. **Develop Feature**: Write code and tests
4. **Commit Changes**: Use standard commit messages
5. **Push Branch**: `git push origin feature/new-feature`
6. **Create PR**: Create Pull Request on GitHub

### Pull Request Checklist

Before submitting PR, ensure:

- Code passes all tests
- Follows code standards
- Updates relevant documentation
- Adds appropriate test cases
- PR description is clear with change explanations

## Contribution Opportunities

### Beginner-friendly Tasks

Look for Issues labeled with:

- `good first issue`: Tasks suitable for beginners
- `help wanted`: Tasks needing community help
- `documentation`: Documentation-related improvements

## Useful Resources

### Official Documentation

- [Nuxt 4 Documentation](https://nuxt.com/)
- [Vue 3 Documentation](https://vuejs.org/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [TailwindCSS Documentation](https://tailwindcss.com/)

### Community Resources

- [GitHub Issues](https://github.com/handsondad/kid-growth-timeline/issues)
- [GitHub Discussions](https://github.com/handsondad/kid-growth-timeline/discussions)
