<script setup lang="ts">
const props = defineProps<{
  photos: Photo[]
  activeYear: number | null
}>()

const emit = defineEmits<{
  selectYear: [index: number, year: number]
}>()

const dayjs = useDayjs()
const accents = ['#527061', '#a16d52', '#5e7b8b', '#8b625f']

const yearEntries = computed(() => {
  const groups = new Map<
    number,
    { year: number; count: number; firstIndex: number; coverUrl: string }
  >()

  props.photos.forEach((photo, index) => {
    if (!photo.dateTaken) return

    const date = dayjs(photo.dateTaken)
    if (!date.isValid()) return

    const year = date.year()
    const group = groups.get(year)
    if (group) {
      group.count += 1
      return
    }

    groups.set(year, {
      year,
      count: 1,
      firstIndex: index,
      coverUrl: photo.thumbnailUrl,
    })
  })

  return Array.from(groups.values())
    .sort((first, second) => first.year - second.year)
    .map((entry, index) => ({
      ...entry,
      accent: accents[index % accents.length],
    }))
})

const dateRange = computed(() => {
  const first = yearEntries.value[0]?.year
  const last = yearEntries.value.at(-1)?.year
  return first && last ? `${first} - ${last}` : ''
})
</script>

<template>
  <section
    v-if="yearEntries.length"
    class="time-index"
    :aria-label="$t('title.memories')"
  >
    <div class="time-index__heading">
      <div>
        <p class="time-index__eyebrow">
          {{ $t('title.memories') }}
        </p>
        <h2 class="time-index__title">
          {{ dateRange }}
        </h2>
      </div>
      <p class="time-index__summary">
        {{
          $t('ui.stats.totalPhotosWithRange', {
            range: dateRange,
            count: props.photos.length,
          })
        }}
      </p>
    </div>

    <div class="time-index__scroller">
      <div class="time-index__rail">
        <button
          v-for="entry in yearEntries"
          :key="entry.year"
          type="button"
          class="time-index__year"
          :class="{ 'is-active': activeYear === entry.year }"
          :style="{ '--year-accent': entry.accent }"
          :aria-label="
            $t('ui.stats.totalPhotosWithRange', {
              range: String(entry.year),
              count: entry.count,
            })
          "
          :aria-pressed="activeYear === entry.year"
          @click="emit('selectYear', entry.firstIndex, entry.year)"
        >
          <span class="time-index__cover">
            <img
              v-if="entry.coverUrl"
              :src="entry.coverUrl"
              alt=""
              loading="lazy"
            />
          </span>
          <span class="time-index__marker"></span>
          <span class="time-index__year-label">{{ entry.year }}</span>
          <span class="time-index__count">{{ entry.count }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.time-index {
  --index-paper: #efede6;
  --index-ink: #292c27;
  --index-rule: #d2d0c6;
  --index-muted: #77786f;
  padding: 24px clamp(16px, 4vw, 64px) 18px;
  position: sticky;
  top: 0;
  z-index: 30;
  color: var(--index-ink);
  background: var(--index-paper);
  border-block: 1px solid var(--index-rule);
}

.time-index__heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;
}

.time-index__eyebrow {
  margin: 0 0 5px;
  color: var(--index-muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.time-index__title {
  margin: 0;
  font-family: Georgia, 'Noto Serif SC', serif;
  font-size: 27px;
  font-weight: 400;
  line-height: 1.15;
}

.time-index__summary {
  margin: 0 0 3px;
  color: var(--index-muted);
  font-size: 12px;
  text-align: right;
}

.time-index__scroller {
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-color: var(--index-rule) transparent;
  scrollbar-width: thin;
  scroll-snap-type: x proximity;
}

.time-index__rail {
  position: relative;
  display: flex;
  width: max-content;
  min-width: 100%;
  justify-content: space-between;
  padding: 0 8px 3px;
}

.time-index__rail::before {
  position: absolute;
  top: 77px;
  right: 26px;
  left: 26px;
  height: 1px;
  background: repeating-linear-gradient(
    90deg,
    var(--index-rule) 0,
    var(--index-rule) 1px,
    transparent 1px,
    transparent 42px
  );
  content: '';
}

.time-index__year {
  position: relative;
  display: flex;
  flex: 1 0 112px;
  max-width: 176px;
  flex-direction: column;
  align-items: center;
  padding: 0 8px 4px;
  color: inherit;
  background: transparent;
  border: 0;
  cursor: pointer;
  scroll-snap-align: center;
}

.time-index__cover {
  display: block;
  width: 100%;
  aspect-ratio: 1.55;
  overflow: hidden;
  background: color-mix(in srgb, var(--index-rule) 65%, transparent);
  border: 2px solid var(--index-paper);
  outline: 1px solid var(--index-rule);
}

.time-index__cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.84);
  transition:
    filter 180ms ease,
    transform 220ms ease;
}

.time-index__year:hover .time-index__cover img,
.time-index__year.is-active .time-index__cover img {
  filter: saturate(1);
  transform: scale(1.04);
}

.time-index__marker {
  z-index: 1;
  width: 9px;
  height: 9px;
  margin-top: 12px;
  background: var(--year-accent);
  border: 2px solid var(--index-paper);
  border-radius: 50%;
  outline: 1px solid var(--year-accent);
  transition: transform 160ms ease;
}

.time-index__year.is-active .time-index__marker {
  transform: scale(1.35);
}

.time-index__year-label {
  margin-top: 9px;
  font-family: Georgia, 'Noto Serif SC', serif;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}

.time-index__count {
  margin-top: 2px;
  color: var(--index-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

:global(.dark) .time-index {
  --index-paper: #20231f;
  --index-ink: #e9e5db;
  --index-rule: #454940;
  --index-muted: #a5a69c;
}

@media (max-width: 640px) {
  .time-index {
    padding: 20px 14px 14px;
  }

  .time-index__heading {
    align-items: start;
    margin-bottom: 18px;
  }

  .time-index__title {
    font-size: 23px;
  }

  .time-index__summary {
    max-width: 42%;
    font-size: 11px;
  }

  .time-index__year {
    flex-basis: 104px;
  }
}
</style>
