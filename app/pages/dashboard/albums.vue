<script lang="ts" setup>
import type { Album, Photo } from '~~/server/utils/db'
import type { FormSubmitEvent, FormError } from '@nuxt/ui'

definePageMeta({
  layout: 'dashboard',
})

useHead({
  title: () => '相簿',
})

interface AlbumItem extends Album {
  photoCount?: number
  photoIds?: string[]
  coverPhoto?: Photo | null
}

interface AlbumFormState {
  title: string
  description: string
}

const albums = ref<AlbumItem[]>([])
const isLoadingAlbums = ref(false)
const allPhotos = ref<Photo[]>([])
const isLoadingPhotos = ref(false)

const isAlbumSlideoverOpen = ref(false)
const isDeleteConfirmOpen = ref(false)
const isPhotoSelectorOpen = ref(false)

const currentAlbum = ref<AlbumItem | null>(null)

const formData = reactive<AlbumFormState>({
  title: '',
  description: '',
})

const formRef = ref()
const isSubmittingForm = ref(false)

const selectedPhotoIds = ref<string[]>([])
const coverPhotoId = ref('')

const draftSelectedPhotoIds = ref<string[]>([])
const draftCoverPhotoId = ref('')
const {
  filteredPhotos: unifiedFilteredPhotos,
  selectedCounts,
  hasActiveFilters,
  clearAllFilters,
} = usePhotoFilters()

const isSelectorFilterOpen = ref(false)

const totalSelectedFilters = computed(() => {
  return Object.values(selectedCounts.value).reduce(
    (total, count) => total + count,
    0,
  )
})

const validateForm = (state: any): FormError[] => {
  const errors: FormError[] = []
  if (!state.title?.trim()) {
    errors.push({
      name: 'title',
      message: '请输入相簿标题',
    })
  }
  return errors
}

const loadAlbums = async () => {
  isLoadingAlbums.value = true
  try {
    const response = await $fetch('/api/albums')
    albums.value = (response as any[]).map((album) => ({
      ...album,
      photoCount: album.photoIds?.length || 0,
    }))

    for (const album of albums.value) {
      const displayCoverPhotoId = album.coverPhotoId || album.photoIds?.[0]
      if (displayCoverPhotoId && allPhotos.value.length > 0) {
        const coverPhoto = allPhotos.value.find(
          (p) => p.id === displayCoverPhotoId,
        )
        if (coverPhoto) {
          album.coverPhoto = coverPhoto
        }
      }
    }
  } catch (error) {
    console.error('Failed to load albums:', error)
    useToast().add({
      title: '加载相簿失败',
      color: 'error',
    })
  } finally {
    isLoadingAlbums.value = false
  }
}

const loadPhotos = async () => {
  isLoadingPhotos.value = true
  try {
    const { photos } = usePhotos()
    allPhotos.value = photos.value
  } catch (error) {
    console.error('Failed to load photos:', error)
  } finally {
    isLoadingPhotos.value = false
  }
}

const openCreateSlideover = () => {
  currentAlbum.value = null
  formData.title = ''
  formData.description = ''
  selectedPhotoIds.value = []
  coverPhotoId.value = ''
  formRef.value?.clear()
  isAlbumSlideoverOpen.value = true
}

const openEditSlideover = async (album: AlbumItem) => {
  currentAlbum.value = album
  try {
    const albumDetail = (await $fetch(`/api/albums/${album.id}`)) as any
    formData.title = album.title
    formData.description = album.description || ''
    selectedPhotoIds.value = (albumDetail.photos || []).map((p: Photo) => p.id)
    coverPhotoId.value = album.coverPhotoId || ''
    formRef.value?.clear()
  } catch (error) {
    console.error('Failed to load album details:', error)
    useToast().add({
      title: '加载相簿详情失败',
      color: 'error',
    })
  }
  isAlbumSlideoverOpen.value = true
}

const openDeleteConfirm = (album: AlbumItem) => {
  currentAlbum.value = album
  isDeleteConfirmOpen.value = true
}

const onFormSubmit = async (event: FormSubmitEvent<AlbumFormState>) => {
  isSubmittingForm.value = true
  try {
    if (currentAlbum.value) {
      await $fetch(`/api/albums/${currentAlbum.value.id}`, {
        method: 'PUT',
        body: {
          title: event.data.title,
          description: event.data.description || undefined,
          coverPhotoId: coverPhotoId.value || undefined,
          photoIds: selectedPhotoIds.value,
        },
      })

      useToast().add({
        title: '相簿更新成功',
        color: 'success',
      })

      isAlbumSlideoverOpen.value = false
    } else {
      await $fetch('/api/albums', {
        method: 'POST',
        body: {
          title: event.data.title,
          description: event.data.description || undefined,
          coverPhotoId: coverPhotoId.value || undefined,
          photoIds: selectedPhotoIds.value,
        },
      })

      useToast().add({
        title: '相簿创建成功',
        color: 'success',
      })

      isAlbumSlideoverOpen.value = false
    }

    await loadAlbums()
  } catch (error) {
    console.error('Failed to save album:', error)
    useToast().add({
      title: currentAlbum.value ? '更新相簿失败' : '创建相簿失败',
      color: 'error',
    })
  } finally {
    isSubmittingForm.value = false
  }
}

const deleteAlbum = async () => {
  if (!currentAlbum.value) return

  try {
    await $fetch(`/api/albums/${currentAlbum.value.id}`, {
      method: 'DELETE',
    })

    useToast().add({
      title: '相簿删除成功',
      color: 'success',
    })

    isDeleteConfirmOpen.value = false
    await loadAlbums()
  } catch (error) {
    console.error('Failed to delete album:', error)
    useToast().add({
      title: '删除相簿失败',
      color: 'error',
    })
  }
}

// Move an album one step up (-1) or down (+1) and persist the new order.
// Optimistic update: revert and toast on failure. Only one reorder request
// runs at a time so a failed revert cannot clobber a later move.
const isReorderingAlbums = ref(false)
const moveAlbum = async (index: number, direction: -1 | 1) => {
  if (isReorderingAlbums.value) return
  const target = index + direction
  if (target < 0 || target >= albums.value.length) return
  isReorderingAlbums.value = true

  const previous = albums.value
  const next = [...albums.value]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  albums.value = next

  try {
    await $fetch('/api/albums/reorder', {
      method: 'PUT',
      body: { albumIds: next.map((album) => album.id) },
    })
  } catch (error) {
    console.error('Failed to reorder albums:', error)
    albums.value = previous
    useToast().add({
      title: '相簿排序失败',
      color: 'error',
    })
  } finally {
    isReorderingAlbums.value = false
  }
}

// Move a selected photo one step up (-1) or down (+1) within the album.
// Persisted on save via PUT /api/albums/:id (order = selectedPhotoIds order).
const movePhoto = (index: number, direction: -1 | 1) => {
  const target = index + direction
  if (target < 0 || target >= selectedPhotoIds.value.length) return

  const next = [...selectedPhotoIds.value]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  selectedPhotoIds.value = next
}

const togglePhotoSelection = (photoId: string) => {
  const index = selectedPhotoIds.value.indexOf(photoId)
  if (index > -1) {
    selectedPhotoIds.value.splice(index, 1)
    if (coverPhotoId.value === photoId) {
      coverPhotoId.value = ''
    }
  } else {
    selectedPhotoIds.value.push(photoId)
  }
}

const selectorRangeSelection = useShiftRangeSelection()

watch(
  () => draftSelectedPhotoIds.value.length === 0,
  (isEmpty) => {
    if (isEmpty) selectorRangeSelection.resetAnchor()
  },
)

const openPhotoSelector = () => {
  draftSelectedPhotoIds.value = [...selectedPhotoIds.value]
  draftCoverPhotoId.value =
    coverPhotoId.value && selectedPhotoIds.value.includes(coverPhotoId.value)
      ? coverPhotoId.value
      : ''
  isSelectorFilterOpen.value = false
  selectorRangeSelection.resetAnchor()
  isPhotoSelectorOpen.value = true
}

const closePhotoSelector = () => {
  isSelectorFilterOpen.value = false
  isPhotoSelectorOpen.value = false
}

const confirmPhotoSelection = () => {
  selectedPhotoIds.value = [...draftSelectedPhotoIds.value]
  coverPhotoId.value = draftSelectedPhotoIds.value.includes(
    draftCoverPhotoId.value,
  )
    ? draftCoverPhotoId.value
    : ''
  isPhotoSelectorOpen.value = false
}

const toggleDraftPhotoSelection = (photoId: string, event: MouseEvent) => {
  const shouldSelect = !draftSelectedPhotoIds.value.includes(photoId)
  const rangeIds = selectorRangeSelection.getRangeIds(
    selectorFilteredPhotos.value.map((photo) => photo.id),
    photoId,
    event.shiftKey,
  )

  if (shouldSelect) {
    const selected = new Set(draftSelectedPhotoIds.value)
    for (const id of rangeIds) {
      if (!selected.has(id)) {
        draftSelectedPhotoIds.value.push(id)
      }
    }
    return
  }

  const removed = new Set(rangeIds)
  draftSelectedPhotoIds.value = draftSelectedPhotoIds.value.filter(
    (id) => !removed.has(id),
  )
  if (removed.has(draftCoverPhotoId.value)) {
    draftCoverPhotoId.value = ''
  }
}

const setDraftCoverPhoto = (photoId: string) => {
  if (!draftSelectedPhotoIds.value.includes(photoId)) {
    draftSelectedPhotoIds.value.push(photoId)
  }
  draftCoverPhotoId.value = photoId
}

const getDraftPhotoOrder = (photoId: string) => {
  const index = draftSelectedPhotoIds.value.indexOf(photoId)
  return index >= 0 ? index + 1 : null
}

const areAllFilteredPhotosSelected = computed(() => {
  return (
    selectorFilteredPhotos.value.length > 0 &&
    selectorFilteredPhotos.value.every((photo) =>
      draftSelectedPhotoIds.value.includes(photo.id),
    )
  )
})

const areSomeFilteredPhotosSelected = computed(() => {
  const selectedInFiltered = selectorFilteredPhotos.value.filter((photo) =>
    draftSelectedPhotoIds.value.includes(photo.id),
  ).length
  return (
    selectedInFiltered > 0 &&
    selectedInFiltered < selectorFilteredPhotos.value.length
  )
})

const toggleAllFilteredPhotos = () => {
  if (areAllFilteredPhotosSelected.value) {
    draftSelectedPhotoIds.value = draftSelectedPhotoIds.value.filter(
      (id) => !selectorFilteredPhotos.value.some((photo) => photo.id === id),
    )
    if (
      draftCoverPhotoId.value &&
      !draftSelectedPhotoIds.value.includes(draftCoverPhotoId.value)
    ) {
      draftCoverPhotoId.value = ''
    }
    return
  }

  const merged = new Set(draftSelectedPhotoIds.value)
  for (const photo of selectorFilteredPhotos.value) {
    merged.add(photo.id)
  }
  draftSelectedPhotoIds.value = [...merged]
}

const selectorFilteredPhotos = computed(() => {
  if (allPhotos.value.length === 0) return []

  const ids = new Set(allPhotos.value.map((photo) => photo.id))
  return unifiedFilteredPhotos.value.filter((photo) => ids.has(photo.id))
})

const selectedPhotosPreview = computed(() => {
  return draftSelectedPhotoIds.value
    .map((id) => allPhotos.value.find((photo) => photo.id === id))
    .filter((photo): photo is Photo => Boolean(photo))
    .slice(0, 8)
})

const selectedPhotosOverflowCount = computed(() => {
  return Math.max(
    draftSelectedPhotoIds.value.length - selectedPhotosPreview.value.length,
    0,
  )
})

onMounted(async () => {
  await Promise.all([loadPhotos(), loadAlbums()])
})

const dayjs = useDayjs()

const slideoverTitle = computed(() => {
  return currentAlbum.value ? '编辑相簿' : '创建相簿'
})

const slideoverDescription = computed(() => {
  return currentAlbum.value
    ? '修改相簿的信息和照片'
    : '创建一个新的相簿来组织您的照片'
})

const submitButtonLabel = computed(() => {
  return currentAlbum.value ? '保存' : '创建'
})

const columns = computed<any[]>(() => [
  {
    id: 'coverPhoto',
    accessorKey: 'coverPhoto',
    header: '封面',
  },
  {
    id: 'title',
    accessorKey: 'title',
    header: '标题',
  },
  {
    id: 'description',
    accessorKey: 'description',
    header: '描述',
  },
  {
    id: 'photoCount',
    accessorKey: 'photoCount',
    header: '照片数',
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: '创建时间',
  },
  {
    id: 'actions',
    header: '操作',
  },
])
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="相簿">
        <template #right>
          <UButton
            icon="tabler:plus"
            variant="soft"
            @click="openCreateSlideover"
          >
            创建相簿
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-6">
        <div
          v-if="albums.length > 0"
          class="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800"
        >
          <UTable
            :data="albums"
            :columns="columns"
          >
            <template #coverPhoto-cell="{ row }">
              <div
                class="w-16 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-800 shrink-0"
              >
                <img
                  v-if="(row.original as unknown as AlbumItem).coverPhoto"
                  :src="
                    (row.original as unknown as AlbumItem).coverPhoto
                      ?.thumbnailUrl || ''
                  "
                  :alt="(row.original as unknown as AlbumItem).title"
                  class="w-full h-full object-cover"
                />
                <div
                  v-else
                  class="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-600"
                >
                  <Icon
                    name="tabler:photo"
                    size="20"
                  />
                </div>
              </div>
            </template>

            <template #title-cell="{ row }">
              <NuxtLink
                :to="`/albums/${(row.original as unknown as AlbumItem).id}`"
                target="_blank"
                class="font-medium text-primary-600 dark:text-primary-400 hover:underline cursor-pointer inline-flex items-center gap-2"
              >
                {{ (row.original as unknown as AlbumItem).title }}
                <Icon
                  name="tabler:external-link"
                  size="16"
                  class="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                />
              </NuxtLink>
            </template>

            <template #description-cell="{ row }">
              <div
                v-if="(row.original as unknown as AlbumItem).description"
                class="text-sm text-gray-600 dark:text-gray-400 line-clamp-1"
              >
                {{ (row.original as unknown as AlbumItem).description }}
              </div>
              <div
                v-else
                class="text-sm text-gray-400 dark:text-gray-600"
              >
                -
              </div>
            </template>

            <template #photoCount-cell="{ row }">
              <UBadge
                variant="soft"
                color="neutral"
              >
                {{
                  `${(row.original as unknown as AlbumItem).photoCount || 0} 张`
                }}
              </UBadge>
            </template>

            <template #createdAt-cell="{ row }">
              <div class="text-sm text-gray-600 dark:text-gray-400">
                {{
                  dayjs(
                    (row.original as unknown as AlbumItem).createdAt,
                  ).format('YYYY-MM-DD')
                }}
              </div>
            </template>

            <template #actions-cell="{ row }">
              <div class="flex gap-1">
                <UButton
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  icon="tabler:chevron-up"
                  :disabled="row.index === 0 || isReorderingAlbums"
                  aria-label="上移"
                  @click="moveAlbum(row.index, -1)"
                />
                <UButton
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  icon="tabler:chevron-down"
                  :disabled="
                    row.index === albums.length - 1 || isReorderingAlbums
                  "
                  aria-label="下移"
                  @click="moveAlbum(row.index, 1)"
                />
                <UButton
                  variant="ghost"
                  color="primary"
                  size="xs"
                  icon="tabler:edit"
                  @click="
                    openEditSlideover(row.original as unknown as AlbumItem)
                  "
                />
                <UButton
                  variant="ghost"
                  color="error"
                  size="xs"
                  icon="tabler:trash"
                  @click="
                    openDeleteConfirm(row.original as unknown as AlbumItem)
                  "
                />
              </div>
            </template>
          </UTable>
        </div>

        <div
          v-else-if="!isLoadingAlbums"
          class="flex flex-col items-center justify-center py-12 text-center"
        >
          <Icon
            name="tabler:album"
            size="48"
            class="text-gray-400 dark:text-gray-600 mb-4"
          />
          <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">
            还没有相簿
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-4">
            创建您的第一个相簿来组织您的照片
          </p>
          <UButton
            icon="tabler:plus"
            @click="openCreateSlideover"
          >
            创建相簿
          </UButton>
        </div>
        <div
          v-else
          class="flex items-center justify-center py-12"
        >
          <Icon
            name="tabler:loader"
            size="32"
            class="animate-spin text-primary-500"
          />
        </div>

        <USlideover
          v-model:open="isAlbumSlideoverOpen"
          :title="slideoverTitle"
          :description="slideoverDescription"
          :ui="{ footer: 'justify-end', body: 'p-0 sm:p-0 space-y-4' }"
        >
          <template #body>
            <div
              v-if="coverPhotoId"
              class="relative w-full aspect-video bg-gray-100 dark:bg-neutral-800 overflow-hidden"
            >
              <ThumbImage
                :src="
                  allPhotos.find((p) => p.id === coverPhotoId)?.thumbnailUrl ||
                  ''
                "
                :alt="coverPhotoId"
                class="absolute inset-0 w-full h-full object-cover"
              />
              <button
                class="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                @click="coverPhotoId = ''"
              >
                <Icon
                  name="tabler:x"
                  class="text-white"
                />
              </button>
            </div>
            <button
              v-else
              class="w-full h-48 bg-gray-100 dark:bg-neutral-800 flex flex-col items-center justify-center text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
              @click="openPhotoSelector"
            >
              <Icon
                name="tabler:photo"
                size="40"
                class="mb-2"
              />
              <p class="text-sm font-medium">添加封面照片</p>
            </button>
            <div class="space-y-4 px-4">
              <UForm
                ref="formRef"
                :state="formData"
                :validate="validateForm"
                class="space-y-4"
                @submit="onFormSubmit"
              >
                <UFormField
                  label="标题"
                  name="title"
                  required
                >
                  <UInput
                    v-model="formData.title"
                    class="w-full"
                    placeholder="输入相簿标题"
                  />
                </UFormField>

                <UFormField
                  label="描述"
                  name="description"
                >
                  <UTextarea
                    v-model="formData.description"
                    class="w-full"
                    placeholder="输入相簿描述（可选）"
                    :rows="3"
                  />
                </UFormField>
              </UForm>

              <!-- 照片选择部分 -->
              <div class="space-y-3">
                <UButton
                  variant="outline"
                  color="primary"
                  icon="tabler:photo-plus"
                  size="lg"
                  class="w-full"
                  @click="openPhotoSelector"
                >
                  {{
                    selectedPhotoIds.length > 0 ? '修改照片选择' : '选择照片'
                  }}
                </UButton>

                <div
                  v-if="selectedPhotoIds.length > 0"
                  class="space-y-2"
                >
                  <div class="flex items-center justify-between">
                    <label
                      class="text-sm font-medium text-gray-700 dark:text-gray-300"
                      >{{ `已选择 ${selectedPhotoIds.length} 张照片` }}</label
                    >
                    <UButton
                      variant="ghost"
                      color="neutral"
                      size="xs"
                      icon="tabler:trash"
                      @click="selectedPhotoIds = []"
                    >
                      全部清除
                    </UButton>
                  </div>

                  <div
                    class="grid grid-cols-4 gap-2 p-3 bg-gray-50 dark:bg-neutral-800/50 rounded-lg border border-gray-200 dark:border-neutral-700"
                  >
                    <div
                      v-for="(photoId, index) in selectedPhotoIds"
                      :key="photoId"
                      class="relative group aspect-square rounded-lg overflow-hidden bg-gray-200 dark:bg-neutral-700"
                    >
                      <img
                        :src="
                          allPhotos.find((p) => p.id === photoId)
                            ?.thumbnailUrl || ''
                        "
                        :alt="photoId"
                        class="w-full h-full object-cover"
                      />

                      <div
                        v-if="coverPhotoId === photoId"
                        class="absolute top-1 left-1 bg-primary-500 text-white px-1.5 py-0.5 rounded text-xs font-medium"
                      >
                        设为封面
                      </div>

                      <div
                        class="absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/60 px-1 text-[10px] font-semibold text-white"
                      >
                        {{ index + 1 }}
                      </div>

                      <div
                        class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-wrap items-center justify-center gap-1"
                      >
                        <UButton
                          size="xs"
                          color="neutral"
                          variant="solid"
                          icon="tabler:chevron-up"
                          :disabled="index === 0"
                          aria-label="上移照片"
                          @click="movePhoto(index, -1)"
                        />
                        <UButton
                          size="xs"
                          color="neutral"
                          variant="solid"
                          icon="tabler:chevron-down"
                          :disabled="index === selectedPhotoIds.length - 1"
                          aria-label="下移照片"
                          @click="movePhoto(index, 1)"
                        />
                        <UButton
                          size="xs"
                          color="error"
                          variant="solid"
                          icon="tabler:x"
                          aria-label="移除照片"
                          @click="togglePhotoSelection(photoId)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template #footer="{ close }">
            <UButton
              variant="ghost"
              color="neutral"
              @click="close"
            >
              取消
            </UButton>
            <UButton
              icon="tabler:check"
              :loading="isSubmittingForm"
              @click="formRef?.submit()"
            >
              {{ submitButtonLabel }}
            </UButton>
          </template>
        </USlideover>

        <UModal
          v-model:open="isPhotoSelectorOpen"
          portal
          scrollable
          :ui="{
            wrapper: 'z-220',
            overlay: 'z-220',
            content: 'z-221 w-full max-w-6xl overflow-hidden',
          }"
        >
          <template #content>
            <div class="flex h-[88vh] max-h-[88vh] flex-col">
              <div
                class="shrink-0 border-b border-gray-200 bg-white/80 p-4 backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/80 sm:p-5"
              >
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <h2 class="text-lg font-semibold sm:text-xl">选择照片</h2>
                  </div>
                  <UButton
                    icon="tabler:x"
                    color="neutral"
                    variant="ghost"
                    @click="closePhotoSelector"
                  />
                </div>

                <div class="mt-4 space-y-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <UPopover
                      v-model:open="isSelectorFilterOpen"
                      :content="{
                        side: 'bottom',
                        align: 'start',
                        sideOffset: 8,
                      }"
                      :ui="{ content: 'z-230' }"
                    >
                      <UButton
                        icon="tabler:filter"
                        :color="hasActiveFilters ? 'info' : 'neutral'"
                        :variant="hasActiveFilters ? 'soft' : 'outline'"
                        size="sm"
                      >
                        筛选照片
                        <UBadge
                          v-if="totalSelectedFilters > 0"
                          size="xs"
                          color="info"
                          variant="solid"
                          class="ml-1"
                        >
                          {{ totalSelectedFilters }}
                        </UBadge>
                      </UButton>

                      <template #content>
                        <UCard variant="glassmorphism">
                          <OverlayFilterPanel />
                        </UCard>
                      </template>
                    </UPopover>

                    <UButton
                      v-if="hasActiveFilters"
                      icon="tabler:filter-x"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      @click="clearAllFilters()"
                    >
                      清除全部
                    </UButton>

                    <UButton
                      color="neutral"
                      variant="soft"
                      size="sm"
                      class="justify-center"
                      :icon="
                        areAllFilteredPhotosSelected
                          ? 'tabler:checkbox'
                          : areSomeFilteredPhotosSelected
                            ? 'tabler:minus'
                            : 'tabler:square'
                      "
                      @click="toggleAllFilteredPhotos"
                    >
                      全选
                    </UButton>

                    <div class="ml-auto flex flex-wrap items-center gap-1.5">
                      <UBadge
                        color="primary"
                        variant="soft"
                      >
                        {{ `已选 ${draftSelectedPhotoIds.length} 张` }}
                      </UBadge>
                      <UBadge
                        v-if="draftCoverPhotoId"
                        color="warning"
                        variant="soft"
                        icon="tabler:star-filled"
                      >
                        已设置封面
                      </UBadge>
                    </div>
                  </div>

                  <p
                    class="hidden items-center gap-1.5 text-xs text-neutral-500 pointer-fine:flex dark:text-neutral-400"
                  >
                    <Icon
                      name="tabler:info-circle"
                      class="size-3.5 shrink-0"
                    />
                    提示：按住 Shift 键并点击，即可选择一个范围内的照片
                  </p>

                  <div class="flex flex-wrap gap-1">
                    <UBadge
                      v-if="selectedCounts.tags"
                      size="xs"
                      color="neutral"
                      variant="outline"
                    >
                      标签:
                      {{ selectedCounts.tags }}
                    </UBadge>
                    <UBadge
                      v-if="selectedCounts.cameras"
                      size="xs"
                      color="neutral"
                      variant="outline"
                    >
                      相机:
                      {{ selectedCounts.cameras }}
                    </UBadge>
                    <UBadge
                      v-if="selectedCounts.lenses"
                      size="xs"
                      color="neutral"
                      variant="outline"
                    >
                      镜头:
                      {{ selectedCounts.lenses }}
                    </UBadge>
                    <UBadge
                      v-if="selectedCounts.cities"
                      size="xs"
                      color="neutral"
                      variant="outline"
                    >
                      城市:
                      {{ selectedCounts.cities }}
                    </UBadge>
                    <UBadge
                      v-if="selectedCounts.ratings"
                      size="xs"
                      color="neutral"
                      variant="outline"
                    >
                      评分
                    </UBadge>
                  </div>

                  <UCard
                    variant="subtle"
                    :ui="{
                      body: 'p-2 sm:p-2',
                    }"
                  >
                    <div>
                      <div
                        v-if="selectedPhotosPreview.length > 0"
                        class="flex h-full items-center gap-2 overflow-x-auto"
                      >
                        <button
                          v-for="photo in selectedPhotosPreview"
                          :key="photo.id"
                          class="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 transition"
                          :class="
                            draftCoverPhotoId === photo.id
                              ? 'border-warning-500'
                              : 'border-transparent hover:border-gray-300 dark:hover:border-neutral-500'
                          "
                          @click="setDraftCoverPhoto(photo.id)"
                        >
                          <ThumbImage
                            :src="photo.thumbnailUrl || ''"
                            :alt="photo.title || '照片'"
                            class="h-full w-full object-cover"
                          />
                          <div
                            v-if="draftCoverPhotoId === photo.id"
                            class="absolute inset-x-0 bottom-0 flex items-center justify-center bg-warning-500/90 py-0.5"
                          >
                            <Icon
                              name="tabler:star-filled"
                              size="12"
                              class="text-white"
                            />
                          </div>
                        </button>

                        <UBadge
                          v-if="selectedPhotosOverflowCount > 0"
                          variant="soft"
                          color="neutral"
                          class="shrink-0"
                        >
                          +{{ selectedPhotosOverflowCount }}
                        </UBadge>
                      </div>
                      <div
                        v-else
                        class="flex h-full items-center"
                      >
                        <div
                          class="flex h-12 w-full items-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50/80 px-3 text-xs text-gray-600 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-gray-300"
                        >
                          <Icon
                            name="tabler:photo-plus"
                            size="14"
                            class="shrink-0 text-gray-500 dark:text-gray-400"
                          />
                          <span class="truncate"> 选择照片 </span>
                        </div>
                      </div>
                    </div>
                  </UCard>
                </div>
              </div>

              <div class="flex-1 overflow-y-auto p-3 sm:p-5">
                <div
                  v-if="selectorFilteredPhotos.length > 0"
                  class="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5 xl:grid-cols-6"
                >
                  <button
                    v-for="photo in selectorFilteredPhotos"
                    :key="photo.id"
                    class="group text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60"
                    @mousedown="
                      selectorRangeSelection.preventShiftTextSelection
                    "
                    @click="toggleDraftPhotoSelection(photo.id, $event)"
                  >
                    <div
                      class="relative aspect-square overflow-hidden rounded-lg border bg-gray-200/90 transition-all duration-200 dark:bg-neutral-700/80"
                      :class="{
                        'border-primary-400 ring-1 ring-primary-300/60 dark:ring-primary-700/50':
                          draftSelectedPhotoIds.includes(photo.id),
                        'border-gray-200/70 hover:border-gray-300/90 dark:border-neutral-700 dark:hover:border-neutral-500':
                          !draftSelectedPhotoIds.includes(photo.id),
                      }"
                    >
                      <ThumbImage
                        :src="photo.thumbnailUrl || ''"
                        :alt="photo.title || '照片'"
                        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />

                      <div
                        class="absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-black/55 via-black/10 to-transparent"
                      />

                      <div
                        class="absolute inset-x-2 bottom-1.5 flex items-end justify-between gap-2"
                      >
                        <div class="min-w-0">
                          <p
                            class="truncate text-[10px] font-medium text-white/92"
                          >
                            {{ photo.title || photo.storageKey || '未命名' }}
                          </p>
                          <p class="truncate text-[9px] text-white/72">
                            {{
                              photo.city
                                ? `${photo.city} · ${dayjs(photo.createdAt).format('MM-DD')}`
                                : dayjs(photo.createdAt).format('YYYY-MM-DD')
                            }}
                          </p>
                        </div>
                      </div>

                      <div
                        v-if="draftSelectedPhotoIds.includes(photo.id)"
                        class="absolute left-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-white/85 bg-primary-500 px-1 text-white shadow-sm"
                      >
                        <span
                          v-if="getDraftPhotoOrder(photo.id)"
                          class="text-[10px] font-semibold"
                        >
                          {{ getDraftPhotoOrder(photo.id) }}
                        </span>
                        <Icon
                          v-else
                          name="tabler:check"
                          size="14"
                        />
                      </div>

                      <UButton
                        v-if="draftCoverPhotoId !== photo.id"
                        size="xs"
                        color="warning"
                        variant="solid"
                        icon="tabler:star"
                        class="absolute right-1.5 top-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
                        @click.stop="setDraftCoverPhoto(photo.id)"
                      />

                      <UBadge
                        v-else
                        color="warning"
                        variant="solid"
                        icon="tabler:star-filled"
                        class="absolute right-1.5 top-1.5"
                      >
                        设为封面
                      </UBadge>
                    </div>
                  </button>
                </div>

                <div
                  v-else
                  class="flex h-64 flex-col items-center justify-center text-gray-500"
                >
                  <Icon
                    name="tabler:image-off"
                    size="48"
                    class="mb-3 opacity-50"
                  />
                  <p class="font-medium">
                    {{ hasActiveFilters ? '未找到匹配的照片' : '暂无照片' }}
                  </p>
                  <p
                    v-if="hasActiveFilters"
                    class="mt-1 text-sm"
                  >
                    尝试使用其他关键词搜索
                  </p>
                </div>
              </div>

              <div
                class="shrink-0 border-t border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900 sm:p-4"
              >
                <div
                  class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end"
                >
                  <UButton
                    variant="outline"
                    color="neutral"
                    class="w-full sm:w-auto"
                    @click="closePhotoSelector"
                  >
                    取消
                  </UButton>
                  <UButton
                    icon="tabler:check"
                    color="primary"
                    class="w-full sm:w-auto"
                    @click="confirmPhotoSelection"
                  >
                    {{ `确认 (${draftSelectedPhotoIds.length})` }}
                  </UButton>
                </div>
              </div>
            </div>
          </template>
        </UModal>

        <UModal v-model:open="isDeleteConfirmOpen">
          <template #content>
            <div class="p-6 space-y-4">
              <div class="flex items-center gap-3">
                <div
                  class="shrink-0 w-10 h-10 bg-error-100 dark:bg-error-900/30 rounded-full flex items-center justify-center"
                >
                  <Icon
                    name="tabler:alert-circle"
                    class="text-error-500"
                  />
                </div>
                <div>
                  <h3 class="text-lg font-semibold">删除相簿</h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {{
                      `确定要删除相簿\u0022${currentAlbum?.title}\u0022吗？删除相簿不会删除其中的照片，仅删除相簿本身。`
                    }}
                  </p>
                </div>
              </div>

              <div class="flex justify-end gap-2 pt-4">
                <UButton
                  variant="ghost"
                  color="neutral"
                  @click="isDeleteConfirmOpen = false"
                >
                  取消
                </UButton>
                <UButton
                  color="error"
                  icon="tabler:trash"
                  @click="deleteAlbum"
                >
                  确认删除
                </UButton>
              </div>
            </div>
          </template>
        </UModal>
      </div>
    </template>
  </UDashboardPanel>
</template>

<style scoped></style>
