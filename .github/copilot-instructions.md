# Kid Growth Timeline AI Coding Guidelines

Kid Growth Timeline is a local-first child photo and video timeline built with Nuxt 4, comprehensive EXIF processing, and SQLite-backed local storage.

## Architecture Overview

### Core Components

- **Frontend**: Nuxt 4 app with Vue 3, TypeScript, and TailwindCSS
- **Backend**: Nitro server with SQLite (Drizzle ORM) and local-first storage
- **Processing Pipeline**: Async photo processing with EXIF, thumbnails, and geolocation

### Key Directories

- `app/`: Nuxt 4 application (components, pages, composables)
- `server/`: API routes and backend services
- `shared/`: Type definitions shared between client/server

## Development Workflow

### Essential Commands

```bash
# Start the local-only development server
pnpm dev

# Database operations
pnpm db:generate  # Generate migrations
pnpm db:migrate   # Apply migrations

# Production build
pnpm build
```

### Monorepo Structure

This is a single-package pnpm project. The default development server binds to `127.0.0.1`; do not expose the unauthenticated app to a network.

## Storage Architecture

### Multi-Provider System

Storage providers are abstracted through `server/services/storage/interfaces.ts`:

- **Local**: Filesystem storage under `data/storage` (default)
- **S3**: AWS S3-compatible storage
- **HubR2**: Cloudflare R2 via NuxtHub
- **GitHub**: Git-based storage (experimental)

### Key Pattern

All storage operations go through `useStorageProvider(event)` in API routes. The provider is configured via `NUXT_STORAGE_PROVIDER` environment variable.

## Photo Processing Pipeline

### Async Processing Pattern

Photos are processed via `execPhotoPipelineAsync()` in `server/services/photo/pipeline-async.ts`:

1. **Preprocessing**: HEIC conversion to JPEG, buffer management
2. **Metadata**: Sharp processing for dimensions/format
3. **Thumbnails**: WebP generation with ThumbHash
4. **EXIF**: Comprehensive metadata extraction via exiftool-vendored
5. **Geolocation**: Reverse geocoding for GPS coordinates
6. **LivePhoto**: Video companion file detection and processing

### Critical Implementation Details

- Use `setImmediate()` for non-blocking async operations
- Always handle HEIC → JPEG conversion for Apple photos
- EXIF processing requires temporary file writes (see `server/services/image/exif.ts`)
- Thumbnails are stored as separate WebP files with hash compression

## Component Patterns

### Vue Components

- All components are auto imported via Nuxt (eg. `/app/components/photo/PhotoItem.client.vue` can be used directly as `<PhotoPhotoItem />`)

### Vue Composables

- `usePhotos()`: Central photo data management with injection/provide pattern
- `usePhotoFilters()`: Client-side filtering with reactive state
- `useLivePhotoProcessor()`: Live Photo video conversion and playback support

### Masonry Grid System

The `app/components/masonry/Root.vue` implements a CSS-based masonry layout:

- Auto-responsive column counts based on viewport
- Intersection Observer for performance and date range tracking
- Background LivePhoto processing for visible items only

### Image Loading

`ProgressiveImage.vue` uses the shared image loader and a standard `<img>` element, with a thumbnail fallback while the original image loads.

## Database Operations

### Core Database Pattern

**ALWAYS use `useDB()` from `server/utils/db.ts` for all database operations:**

```typescript
import { useDB, tables, eq } from '~~/server/utils/db'

// Get all photos
const photos = await useDB().select().from(tables.photos)

// Get specific photo
const photo = await useDB()
  .select()
  .from(tables.photos)
  .where(eq(tables.photos.id, photoId))
  .get()

// Insert new photo
await useDB().insert(tables.photos).values(photoData)

// Update photo
await useDB()
  .update(tables.photos)
  .set({ title: 'New Title' })
  .where(eq(tables.photos.id, photoId))
```

### Database Configuration

- Uses **better-sqlite3** with Drizzle ORM
- Database file: `data/app.sqlite3`
- Schema exports types including `Photo` from `useDB`
- Import patterns: `eq`, `and`, `or`, `sql` from the same file

### Photo Model Schema

Key fields in `server/database/schema.ts`:

- `storageKey`: Original file path in storage
- `originalUrl`: Public URL (may point to JPEG version for HEIC)
- `thumbnailUrl`/`thumbnailHash`: WebP thumbnail with ThumbHash
- `exif`: Full EXIF JSON (typed as `NeededExif`)
- `latitude`/`longitude`/`city`/`country`: Extracted geolocation
- `isLivePhoto`: Boolean with optional video companion file

### Migration Pattern

Use Drizzle migrations for schema changes. Do not delete or rewrite existing user data or database files.

## API Conventions

### Local Access

Authentication is intentionally disabled. Keep development and preview servers bound to `127.0.0.1`; do not expose the app or its APIs through a reverse proxy.

### Upload Flow

1. POST `/api/photos` → Get presigned URL
2. Direct upload to storage provider
3. POST `/api/photos/process` → Trigger async processing
4. Background pipeline processes and saves to database

### Background Processing

Use this pattern for long-running operations:

```typescript
// Return immediately, process in background
processPhotoInBackground(fileKey, storageObject)
return { message: 'Processing started' }
```

## Environment Configuration

### Optional Variables

- `NUXT_STORAGE_PROVIDER`: defaults to `local`; may select another configured storage provider
- `MAPBOX_TOKEN`: For map functionality

### Storage Provider Config

Each provider has specific env vars (see README). S3 is most commonly used with CDN support via `NUXT_PROVIDER_S3_CDN_URL`.

## Performance Considerations

### Image Processing

- Large images are processed asynchronously to avoid blocking
- HEIC files automatically get JPEG versions uploaded
- Thumbnails use WebP format for optimal size/quality
- Use Sharp for all image manipulation

## Code Style

### Database Operations

- **CRITICAL**: Always use `useDB()` from `server/utils/db.ts` - never import Drizzle directly
- Import query helpers: `import { useDB, tables, eq, and, or } from '~~/server/utils/db'`
- Use `tables.photos`, `tables.users` for schema references
- Database file is `data/app.sqlite3` (better-sqlite3 + Drizzle ORM)

### TypeScript

- Strict typing with shared types in `shared/types/`
- Use Drizzle schema types for database operations
- Avoid `any` except for complex EXIF data structures

### Vue/Nuxt

- Composition API throughout
- Use `definePageMeta()` for layouts
- Server-side components for data fetching
- Client-side `.vue` files for interactive components (see `PhotoItem.client.vue`)

When working on this codebase, prioritize understanding the async processing pipeline and storage abstraction layer, as these are the most complex architectural decisions that impact all photo operations.
