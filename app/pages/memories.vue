<script setup lang="ts">
import type { Photo } from '~~/server/utils/db'

useHead({
  title: () => $t('title.memories'),
})

const dayjs = useDayjs()
const router = useRouter()
const { photos } = usePhotos()

interface MonthlyMemory {
  key: string
  label: string
  photos: Photo[]
}

const monthlyMemories = computed<MonthlyMemory[]>(() => {
  const groups = new Map<string, Photo[]>()

  for (const photo of photos.value) {
    if (!photo.dateTaken) continue

    const capturedAt = dayjs(photo.dateTaken)
    if (!capturedAt.isValid()) continue

    const key = capturedAt.format('YYYY-MM')
    const group = groups.get(key) || []
    group.push(photo)
    groups.set(key, group)
  }

  return Array.from(groups, ([key, groupPhotos]) => ({
    key,
    label: dayjs(`${key}-01`).format('MMMM YYYY'),
    photos: groupPhotos.sort(
      (left, right) =>
        dayjs(left.dateTaken).valueOf() - dayjs(right.dateTaken).valueOf(),
    ),
  })).sort((left, right) => right.key.localeCompare(left.key))
})

const startMemory = (memory: MonthlyMemory) => {
  const firstPhoto = memory.photos[0]
  if (!firstPhoto || memory.photos.length < 2) return

  const viewer = useViewerState()
  viewer.openViewer(0, '/memories', memory.photos)
  viewer.startSlideshow()
  router.push(`/${firstPhoto.id}`)
}
</script>

<template>
  <main
    class="min-h-svh bg-neutral-50 px-4 py-8 text-neutral-900 dark:bg-neutral-950 dark:text-white sm:px-8"
  >
    <div class="mx-auto max-w-7xl">
      <header
        class="mb-8 flex items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800"
      >
        <div class="min-w-0">
          <h1 class="text-2xl font-semibold">{{ $t('title.memories') }}</h1>
          <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {{ $t('title.memoriesDescription') }}
          </p>
        </div>
        <UButton
          to="/"
          variant="soft"
          color="neutral"
          icon="tabler:arrow-left"
          :aria-label="$t('ui.action.home.tooltip')"
        />
      </header>

      <div
        v-if="monthlyMemories.length"
        class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
      >
        <section
          v-for="memory in monthlyMemories"
          :key="memory.key"
          class="overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div class="relative aspect-[4/3] bg-neutral-100 dark:bg-neutral-800">
            <ThumbImage
              v-if="memory.photos.at(-1)"
              :src="memory.photos.at(-1)?.thumbnailUrl || ''"
              :thumbhash="memory.photos.at(-1)?.thumbnailHash"
              :alt="memory.label"
              class="size-full object-cover"
            />
            <div
              class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pb-4 pt-12 text-white"
            >
              <h2 class="text-lg font-semibold">{{ memory.label }}</h2>
              <p class="mt-1 text-sm text-white/80">
                {{
                  $t('title.memoriesPhotoCount', {
                    count: memory.photos.length,
                  })
                }}
              </p>
            </div>
          </div>
          <footer class="flex items-center justify-between gap-3 px-4 py-3">
            <span class="text-xs text-neutral-500 dark:text-neutral-400">
              {{ dayjs(memory.photos[0]?.dateTaken).format('ll') }}
              <template v-if="memory.photos.length > 1">
                – {{ dayjs(memory.photos.at(-1)?.dateTaken).format('ll') }}
              </template>
            </span>
            <UTooltip :text="$t('viewer.slideshow.playCurrent')">
              <UButton
                size="sm"
                variant="soft"
                color="neutral"
                icon="tabler:player-play"
                :disabled="memory.photos.length < 2"
                :aria-label="$t('viewer.slideshow.playCurrent')"
                @click="startMemory(memory)"
              />
            </UTooltip>
          </footer>
        </section>
      </div>

      <div
        v-else
        class="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center"
      >
        <Icon
          name="tabler:calendar-question"
          class="size-10 text-neutral-400"
        />
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          {{ $t('ui.stats.noPhotosTip') }}
        </p>
      </div>
    </div>
  </main>
</template>
