<script lang="ts" setup>
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { Photo } from '~~/server/utils/db'
import { h, resolveComponent } from 'vue'
import { Icon, UBadge } from '#components'
import ThumbImage from '~/components/ui/ThumbImage.vue'
import { hasCoordinates } from '~~/shared/utils'

const UCheckbox = resolveComponent('UCheckbox')
const Rating = resolveComponent('Rating')

// 列名显示映射
const columnNameMap = computed<Record<string, string>>(() => ({
  thumbnailUrl: '缩略图',
  id: '照片ID',
  title: '照片标题',
  tags: '关键词',
  rating: '评分',
  isLivePhoto: 'Live Photo',
  location: '位置',
  dateTaken: '拍摄日期',
  lastModified: '最后更新',
  fileSize: '文件大小',
  colorSpace: '颜色空间',
  reactions: '表态',
  actions: '操作',
}))

definePageMeta({
  layout: 'dashboard',
})

useHead({
  title: () => '照片库',
})

const dayjs = useDayjs()

const { status, refresh } = usePhotos()
const { filteredPhotos, selectedCounts, hasActiveFilters } = usePhotoFilters()
const { currentSortIcon, currentSortOption } = usePhotoSort()

const totalSelectedFilters = computed(() => {
  return Object.values(selectedCounts.value).reduce(
    (total, count) => total + count,
    0,
  )
})

const reverseGeocodeLoading = ref<Record<string, boolean>>({})
const eraseLocationLoading = ref<Record<string, boolean>>({})

const setReverseGeocodeLoading = (photoId: string, loading: boolean) => {
  if (loading) {
    reverseGeocodeLoading.value = {
      ...reverseGeocodeLoading.value,
      [photoId]: true,
    }
  } else {
    const { [photoId]: _removed, ...rest } = reverseGeocodeLoading.value
    reverseGeocodeLoading.value = rest
  }
}

const setEraseLocationLoading = (photoId: string, loading: boolean) => {
  if (loading) {
    eraseLocationLoading.value = {
      ...eraseLocationLoading.value,
      [photoId]: true,
    }
  } else {
    const { [photoId]: _removed, ...rest } = eraseLocationLoading.value
    eraseLocationLoading.value = rest
  }
}

// 表态数据
const reactionsData = ref<Record<string, Record<string, number>>>({})
const reactionsLoading = ref(false)

// 获取表态数据
const fetchReactions = async (photoIds: string[]) => {
  if (photoIds.length === 0) return

  reactionsLoading.value = true
  try {
    const data = await $fetch('/api/photos/reactions', {
      query: { ids: photoIds },
    })
    reactionsData.value = data as Record<string, Record<string, number>>
  } catch (error) {
    console.error('获取表态数据失败:', error)
  } finally {
    reactionsLoading.value = false
  }
}

interface EditFormState {
  title: string
  description: string
  tags: string[]
  rating: number | null
}

const editingPhoto = ref<Photo | null>(null)
const isEditModalOpen = ref(false)
const isSavingMetadata = ref(false)

const editFormState = reactive<EditFormState>({
  title: '',
  description: '',
  tags: [],
  rating: null,
})

const originalMetadata = ref<{
  title: string
  description: string
  tags: string[]
  location: { latitude: number; longitude: number } | null
  rating: number | null
}>({
  title: '',
  description: '',
  tags: [],
  location: null,
  rating: null,
})

const locationSelection = ref<{ latitude: number; longitude: number } | null>(
  null,
)
const locationTouched = ref(false)

const normalizeTagList = (tags: string[]): string[] => {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const tag of tags) {
    const trimmed = tag.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(trimmed)
  }
  return normalized
}

const areTagListsEqual = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) {
    return false
  }
  return a.every((tag, index) => tag === b[index])
}

const tagsModel = computed<string[]>({
  get: () => editFormState.tags,
  set: (value) => {
    const next = Array.isArray(value) ? normalizeTagList(value) : []
    if (!areTagListsEqual(editFormState.tags, next)) {
      editFormState.tags = next
    }
  },
})

const normalizedTitle = computed(() => editFormState.title.trim())
const normalizedDescription = computed(() => editFormState.description.trim())

const tagsChanged = computed(() => {
  const current = editFormState.tags
  const original = originalMetadata.value.tags
  return !areTagListsEqual(current, original)
})

const titleChanged = computed(
  () => normalizedTitle.value !== originalMetadata.value.title,
)
const descriptionChanged = computed(
  () => normalizedDescription.value !== originalMetadata.value.description,
)

const locationChanged = computed(() => {
  if (!locationTouched.value) {
    return false
  }
  const current = locationSelection.value
  const original = originalMetadata.value.location
  if (!current && !original) {
    return false
  }
  if (!current || !original) {
    return true
  }
  return (
    Math.abs(current.latitude - original.latitude) > 1e-6 ||
    Math.abs(current.longitude - original.longitude) > 1e-6
  )
})

const ratingChanged = computed(
  () => editFormState.rating !== originalMetadata.value.rating,
)

const isMetadataDirty = computed(
  () =>
    titleChanged.value ||
    descriptionChanged.value ||
    tagsChanged.value ||
    locationChanged.value ||
    ratingChanged.value,
)

const formattedCoordinates = computed(() => {
  if (!locationSelection.value) {
    return null
  }
  return {
    latitude: locationSelection.value.latitude.toFixed(6),
    longitude: locationSelection.value.longitude.toFixed(6),
  }
})

const toast = useToast()
const isImportingLocalPhotos = ref(false)

const importLocalPhotos = async () => {
  isImportingLocalPhotos.value = true
  try {
    const result = await $fetch('/api/photos/import-local', {
      method: 'POST',
    })
    toast.add({
      title: '本地目录扫描完成',
      description: `扫描 ${result.scanned} 张，已加入队列 ${result.queued} 张，跳过 ${result.skipped} 张，失败 ${result.failed} 张。`,
      color: result.failed > 0 ? 'warning' : 'success',
    })
  } catch (error) {
    toast.add({
      title: '发生错误',
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  } finally {
    isImportingLocalPhotos.value = false
  }
}

watch(isEditModalOpen, (open) => {
  if (!open) {
    editingPhoto.value = null
    editFormState.title = ''
    editFormState.description = ''
    editFormState.tags = []
    editFormState.rating = null
    originalMetadata.value = {
      title: '',
      description: '',
      tags: [],
      location: null,
      rating: null,
    }
    locationSelection.value = null
    locationTouched.value = false
  }
})

// 表格多选状态
const rowSelection = ref({})
const table: any = useTemplateRef('table')
const getPhotoRowId = (photo: Photo) => photo.id
const rowRangeSelection = useShiftRangeSelection()

watch(
  () => Object.keys(rowSelection.value).length === 0,
  (isEmpty) => {
    if (isEmpty) rowRangeSelection.resetAnchor()
  },
)

// 列可见性状态，选择结果保存在 localStorage，刷新后恢复
const columnVisibility = useDashboardPhotoColumnVisibility()

const selectedRowsCount = computed((): number => {
  return table.value?.tableApi?.getFilteredSelectedRowModel().rows.length || 0
})

const totalRowsCount = computed((): number => {
  return table.value?.tableApi?.getFilteredRowModel().rows.length || 0
})

const livePhotoStats = computed(() => {
  if (!filteredPhotos.value)
    return { total: 0, livePhotos: 0, staticPhotos: 0, videos: 0 }

  const total = filteredPhotos.value.length
  const livePhotos = filteredPhotos.value.filter(
    (photo: Photo) => photo.isLivePhoto,
  ).length
  const videos = filteredPhotos.value.filter(
    (photo: Photo) => photo.mediaType === 'video',
  ).length
  const staticPhotos = total - livePhotos - videos

  return { total, livePhotos, staticPhotos, videos }
})

const photoFilter = ref<'all' | 'livephoto' | 'static' | 'video'>('all')

const filteredData = computed(() => {
  if (!filteredPhotos.value) return []

  switch (photoFilter.value) {
    case 'livephoto':
      return filteredPhotos.value.filter((photo: Photo) => photo.isLivePhoto)
    case 'static':
      return filteredPhotos.value.filter(
        (photo: Photo) => !photo.isLivePhoto && photo.mediaType !== 'video',
      )
    case 'video':
      return filteredPhotos.value.filter(
        (photo: Photo) => photo.mediaType === 'video',
      )
    default:
      return filteredPhotos.value
  }
})

// 监听过滤后的照片变化，自动获取表态数据
watch(
  () => filteredData.value,
  async (photos) => {
    if (photos && photos.length > 0) {
      const photoIds = photos.map((p: Photo) => p.id)
      await fetchReactions(photoIds)
    }
  },
  { immediate: true },
)

const columns = computed<TableColumn<Photo>[]>(() => [
  {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        modelValue: table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!value),
        'aria-label': '全选',
      }),
    cell: ({ row, table }) =>
      h(
        'div',
        {
          class: 'flex',
          onClickCapture: rowRangeSelection.captureModifiers,
          onMousedown: rowRangeSelection.preventShiftTextSelection,
        },
        h(UCheckbox, {
          modelValue: row.getIsSelected(),
          'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
            rowRangeSelection.toggleTableRow(table, row, !!value),
          'aria-label': '选择行',
        }),
      ),
    enableHiding: false,
  },
  {
    id: 'thumbnailUrl',
    accessorKey: 'thumbnailUrl',
    header: '缩略图',
    cell: ({ row }) => {
      const url = row.original.thumbnailUrl
      return h(ThumbImage, {
        src: url || row.original.originalUrl || '',
        alt: row.original.title || '照片缩略图',
        key: row.original.id,
        thumbhash: row.original.thumbnailHash || '',
        class: 'size-16 min-w-[100px] object-cover rounded-md shadow',
        onClick: () => openImagePreview(row.original),
        style: { cursor: url ? 'pointer' : 'default' },
      })
    },
    enableHiding: false,
  },
  {
    id: 'id',
    accessorKey: 'id',
    header: '照片ID',
    enableHiding: false,
  },
  {
    accessorKey: 'title',
    header: '照片标题',
  },
  {
    accessorKey: 'tags',
    header: '关键词',
    cell: ({ row }) => {
      const tags = row.original.tags
      return h('div', { class: 'flex items-center gap-1' }, [
        tags && tags.length
          ? tags.map((tag) =>
              h(
                UBadge,
                {
                  size: 'sm',
                  variant: 'soft',
                  color: 'neutral',
                },
                () => tag,
              ),
            )
          : h('span', { class: 'text-neutral-400 text-xs' }, '无标签'),
      ])
    },
  },
  {
    accessorKey: 'rating',
    header: '评分',
    cell: ({ row }) => {
      const rating = row.original.exif?.Rating
      return h('div', { class: 'flex items-center' }, [
        rating !== undefined && rating !== null
          ? h(Rating, {
              modelValue: rating,
              readonly: true,
              size: 'xs',
            })
          : h('span', { class: 'text-neutral-400 text-xs' }, '未评分'),
      ])
    },
  },
  {
    accessorKey: 'isLivePhoto',
    header: 'Live Photo',
    cell: ({ row }) => {
      const isLivePhoto = row.original.isLivePhoto
      return h('div', { class: 'flex items-center gap-2' }, [
        isLivePhoto
          ? h('div', { class: 'flex items-center gap-1' }, [
              h(Icon, {
                name: 'tabler:live-photo',
                class: 'size-4 text-yellow-600 dark:text-yellow-400',
              }),
              h(
                'span',
                {
                  class:
                    'text-yellow-600 dark:text-yellow-400 text-xs font-medium',
                },
                '实况',
              ),
            ])
          : h(
              'span',
              {
                class: 'text-neutral-400 text-xs',
              },
              '一般照片',
            ),
      ])
    },
    sortingFn: (rowA, rowB) => {
      const valueA = rowA.original.isLivePhoto ? 1 : 0
      const valueB = rowB.original.isLivePhoto ? 1 : 0
      return valueB - valueA // LivePhoto 优先排序
    },
  },
  {
    accessorKey: 'location',
    header: '位置',
    cell: ({ row }) => {
      const { exif, city, country } = row.original

      if (
        !hasCoordinates(row.original) &&
        (exif?.GPSLongitude == null || exif?.GPSLatitude == null)
      ) {
        return h('span', { class: 'text-neutral-400 text-xs' }, '无 GPS 信息')
      }

      const location = [city, country].filter(Boolean).join(', ')
      return h(
        'span',
        {
          class: location ? 'text-xs' : 'text-neutral-400 text-xs',
        },
        location || '未知',
      )
    },
  },
  {
    accessorKey: 'dateTaken',
    header: '拍摄日期',
    cell: (info) => {
      const date = info.getValue() as string
      return h(
        'span',
        { class: 'font-mono text-xs' },
        date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '未知',
      )
    },
  },
  {
    accessorKey: 'lastModified',
    header: '最后更新',
    cell: (info) => {
      const date = info.getValue() as string
      return h(
        'span',
        { class: 'font-mono text-xs' },
        date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '未知',
      )
    },
  },
  {
    accessorKey: 'fileSize',
    header: '文件大小',
    cell: (info) => formatBytes(info.getValue() as number),
  },
  {
    id: 'colorSpace',
    accessorFn: (row) => row.exif?.ColorSpace,
    header: '颜色空间',
  },
  {
    accessorKey: 'reactions',
    header: '表态',
    cell: ({ row }) => {
      const photoId = row.original.id
      const reactions = reactionsData.value[photoId] || {}
      const totalReactions = Object.values(reactions).reduce(
        (sum: number, count) => sum + (count as number),
        0,
      )

      if (totalReactions === 0) {
        return h('span', { class: 'text-neutral-400 text-xs' }, '无表态')
      }

      const reactionIcons: Record<string, string> = {
        like: 'fluent-emoji-flat:thumbs-up',
        love: 'fluent-emoji-flat:red-heart',
        amazing: 'fluent-emoji-flat:smiling-face-with-heart-eyes',
        funny: 'fluent-emoji-flat:face-with-tears-of-joy',
        wow: 'fluent-emoji-flat:face-with-open-mouth',
        sad: 'fluent-emoji-flat:crying-face',
        fire: 'fluent-emoji-flat:fire',
        sparkle: 'fluent-emoji-flat:sparkles',
      }

      // 显示前3个有数据的表态
      const topReactions = Object.entries(reactions)
        .filter(([_, count]) => (count as number) > 0)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 3)

      return h(
        'div',
        { class: 'flex items-center gap-2' },
        [
          ...topReactions.map(([type, count]) =>
            h('div', { class: 'flex items-center gap-0.5' }, [
              h(Icon, {
                name:
                  reactionIcons[type] ||
                  'fluent-emoji-flat:face-with-tears-of-joy',
                class: 'size-4',
                mode: 'svg',
              }),
              h(
                'span',
                {
                  class:
                    'text-xs font-medium text-neutral-700 dark:text-neutral-300',
                },
                count,
              ),
            ]),
          ),
          totalReactions > topReactions.length
            ? h(
                'span',
                { class: 'text-xs text-neutral-400' },
                `+${totalReactions - topReactions.reduce((sum, [_, count]) => sum + (count as number), 0)}`,
              )
            : null,
        ].filter(Boolean),
      )
    },
  },
  {
    id: 'actions',
    accessorKey: 'actions',
    header: '操作',
    enableHiding: false,
  },
])

const openMetadataEditor = (photo: Photo) => {
  const initialTitle = photo.title?.trim() ?? ''
  const initialDescription = photo.description?.trim() ?? ''
  const initialTags = normalizeTagList(photo.tags ?? [])
  editingPhoto.value = photo
  editFormState.title = initialTitle
  editFormState.description = initialDescription
  editFormState.tags = [...initialTags]
  editFormState.rating =
    typeof photo.exif?.Rating === 'number' ? photo.exif.Rating : null

  const initialLocation = hasCoordinates(photo)
    ? {
        latitude: photo.latitude,
        longitude: photo.longitude,
      }
    : null

  originalMetadata.value = {
    title: initialTitle,
    description: initialDescription,
    tags: [...initialTags],
    location: initialLocation ? { ...initialLocation } : null,
    rating: typeof photo.exif?.Rating === 'number' ? photo.exif.Rating : null,
  }

  locationSelection.value = initialLocation ? { ...initialLocation } : null
  locationTouched.value = false

  isEditModalOpen.value = true
}

const handleLocationPick = () => {
  locationTouched.value = true
}

const clearSelectedLocation = () => {
  locationSelection.value = null
  locationTouched.value = true
}

const enqueueEraseLocationTask = async (photo: Photo) => {
  if (!photo?.id) {
    throw new Error('找不到照片')
  }

  const result = await $fetch('/api/queue/add-task', {
    method: 'POST',
    body: {
      payload: {
        type: 'photo-erase-location',
        photoId: photo.id,
      },
      priority: 2,
      maxAttempts: 3,
    },
  })

  if (!result.success) {
    throw new Error(result?.message || '抹除位置信息任务添加失败')
  }

  return result.taskId
}

const saveMetadataChanges = async () => {
  if (!editingPhoto.value || !isMetadataDirty.value) {
    return
  }

  isSavingMetadata.value = true
  try {
    const payload: {
      title?: string
      description?: string
      tags?: string[]
      location?: { latitude: number; longitude: number } | null
      rating?: number | null
    } = {}

    if (titleChanged.value) {
      payload.title = normalizedTitle.value
    }

    if (descriptionChanged.value) {
      payload.description = normalizedDescription.value
    }

    if (tagsChanged.value) {
      payload.tags = [...editFormState.tags]
    }

    const shouldQueueLocationErase =
      locationChanged.value && locationSelection.value === null

    if (locationChanged.value && locationSelection.value) {
      payload.location = {
        latitude: locationSelection.value.latitude,
        longitude: locationSelection.value.longitude,
      }
    }

    if (ratingChanged.value) {
      payload.rating = editFormState.rating
    }

    let hasAnySuccessfulAction = false

    if (Object.keys(payload).length > 0) {
      await $fetch(`/api/photos/${editingPhoto.value.id}`, {
        method: 'PUT',
        body: payload,
      })

      toast.add({
        title: '照片信息已更新',
        description: '',
        color: 'success',
      })
      hasAnySuccessfulAction = true
    }

    if (shouldQueueLocationErase) {
      const taskId = await enqueueEraseLocationTask(editingPhoto.value)
      toast.add({
        title: '已加入抹除位置信息任务',
        description: typeof taskId === 'number' ? `任务ID: ${taskId}` : '',
        color: 'success',
      })
      hasAnySuccessfulAction = true
    }

    if (!hasAnySuccessfulAction) {
      isEditModalOpen.value = false
      return
    }

    await refresh()
    isEditModalOpen.value = false
  } catch (error: any) {
    console.error('更新照片信息失败:', error)
    const message =
      error?.data?.statusMessage ||
      error?.statusMessage ||
      error?.message ||
      '更新照片信息失败'

    toast.add({
      title: '更新照片信息失败',
      description: message,
      color: 'error',
    })
  } finally {
    isSavingMetadata.value = false
  }
}

const handleEditSubmit = async (event: FormSubmitEvent<EditFormState>) => {
  event.preventDefault()
  if (!isMetadataDirty.value) {
    return
  }
  await saveMetadataChanges()
}

const handleReverseGeocodeRequest = async (photo: Photo) => {
  if (!photo?.id) {
    return
  }

  setReverseGeocodeLoading(photo.id, true)

  try {
    const result = await $fetch('/api/queue/add-task', {
      method: 'POST',
      body: {
        payload: {
          type: 'photo-reverse-geocoding',
          photoId: photo.id,
          latitude:
            typeof photo.latitude === 'number' ? photo.latitude : undefined,
          longitude:
            typeof photo.longitude === 'number' ? photo.longitude : undefined,
        },
        priority: 1,
        maxAttempts: 3,
      },
    })

    if (result.success) {
      toast.add({
        title: '已加入重新获取城市任务',
        description:
          typeof result.taskId === 'number' ? `任务ID: ${result.taskId}` : '',
        color: 'success',
      })
    } else {
      toast.add({
        title: '重新获取城市任务添加失败',
        description: result?.message || '重新获取城市任务添加失败',
        color: 'error',
      })
    }
  } catch (error: any) {
    console.error('Failed to enqueue reverse geocoding task:', error)
    const message =
      error?.data?.statusMessage ||
      error?.statusMessage ||
      error?.message ||
      '重新获取城市任务添加失败'

    toast.add({
      title: '重新获取城市任务添加失败',
      description: message,
      color: 'error',
    })
  } finally {
    setReverseGeocodeLoading(photo.id, false)
  }
}

const handleEraseLocationRequest = async (photo: Photo) => {
  if (!photo?.id) {
    return
  }

  setEraseLocationLoading(photo.id, true)

  try {
    const taskId = await enqueueEraseLocationTask(photo)
    toast.add({
      title: '已加入抹除位置信息任务',
      description: typeof taskId === 'number' ? `任务ID: ${taskId}` : '',
      color: 'success',
    })
  } catch (error: any) {
    console.error('Failed to enqueue erase location task:', error)
    const message =
      error?.data?.statusMessage ||
      error?.statusMessage ||
      error?.message ||
      '抹除位置信息任务添加失败'

    toast.add({
      title: '抹除位置信息任务添加失败',
      description: message,
      color: 'error',
    })
  } finally {
    setEraseLocationLoading(photo.id, false)
  }
}

// 重新处理单张照片
const handleReprocessSingle = async (photo: Photo) => {
  try {
    if (!photo || !photo.storageKey) {
      toast.add({
        title: '发生错误',
        description: '无法处理：缺少存储信息',
        color: 'error',
      })
      return
    }

    const reprocessToast = toast.add({
      title: '已添加重新处理任务',
      description: '',
      color: 'info',
    })

    const result = await $fetch('/api/queue/add-task', {
      method: 'POST',
      body: {
        payload: {
          type: 'photo',
          storageKey: photo.storageKey,
        },
        priority: 0,
        maxAttempts: 3,
      },
    })

    if (result.success) {
      toast.update(reprocessToast.id, {
        title: '已添加重新处理任务',
        description: `任务ID: ${result.taskId}`,
        color: 'success',
      })
    } else {
      toast.update(reprocessToast.id, {
        title: '发生错误',
        description: '提交任务失败',
        color: 'error',
      })
    }
  } catch (error: any) {
    console.error('处理照片失败:', error)
    toast.add({
      title: '重新处理失败',
      description: error.message || '发生错误',
      color: 'error',
    })
  }
}

const getRowActions = (photo: Photo) => {
  const isReverseLoading = !!reverseGeocodeLoading.value[photo.id]
  const isEraseLocationLoading = !!eraseLocationLoading.value[photo.id]

  return [
    [
      {
        label: '编辑信息',
        disabled: photo.mediaType === 'video',
        icon: 'tabler:pencil',
        onSelect() {
          openMetadataEditor(photo)
        },
      },
      {
        label: '重新处理',
        disabled: photo.mediaType === 'video',
        icon: 'tabler:refresh',
        onSelect() {
          handleReprocessSingle(photo)
        },
      },
      {
        label: '重新获取城市',
        icon: isReverseLoading ? 'tabler:loader-2' : 'tabler:map-pin',
        disabled: isReverseLoading,
        onSelect() {
          handleReverseGeocodeRequest(photo)
        },
      },
      {
        label: '抹除位置信息',
        icon: isEraseLocationLoading ? 'tabler:loader-2' : 'tabler:map-off',
        disabled: isEraseLocationLoading || photo.mediaType === 'video',
        onSelect() {
          handleEraseLocationRequest(photo)
        },
      },
      {
        label: '预览照片',
        icon: 'tabler:photo',
        onSelect() {
          openImagePreview(photo)
        },
        ...(photo.mediaType === 'video' && !photo.isLivePhoto
          ? [
              {
                label: '裁剪视频',
                icon: 'tabler:cut',
                onSelect: () => openVideoTrim(photo),
              },
            ]
          : []),
      },
    ],
    [
      {
        color: 'error',
        label: '删除',
        icon: 'tabler:trash',
        onSelect: () => handleSingleDeleteRequest(photo),
      },
    ],
  ]
}

// 图片预览弹窗
const isImagePreviewOpen = ref(false)
const previewingPhoto = ref<Photo | null>(null)
const trimTarget = ref<Photo | null>(null)
const showTrimEditor = ref(false)
const openVideoTrim = (photo: Photo) => {
  trimTarget.value = photo
  isImagePreviewOpen.value = false
  showTrimEditor.value = true
}

const openImagePreview = (photo: Photo) => {
  if (photo) {
    previewingPhoto.value = photo
    isImagePreviewOpen.value = true
  }
}

const openInNewTab = (url: string) => {
  if (typeof window !== 'undefined') {
    window.open(url, '_blank')
  }
}

const isDeleteConfirmOpen = ref(false)
const deleteMode = ref<'single' | 'batch'>('single')
const deleteTargetPhotos = ref<Photo[]>([])
const isDeleting = ref(false)

const openDeleteConfirm = (mode: 'single' | 'batch', photos: Photo[]) => {
  deleteMode.value = mode
  deleteTargetPhotos.value = photos
  isDeleteConfirmOpen.value = true
}

const handleSingleDeleteRequest = (photo: Photo) => {
  openDeleteConfirm('single', [photo])
}

// 批量删除功能
const handleBatchDelete = () => {
  const selectedRowModel = table.value?.tableApi?.getFilteredSelectedRowModel()
  const selectedPhotos =
    selectedRowModel?.rows.map((row: any) => row.original) || []

  if (selectedPhotos.length === 0) {
    toast.add({
      title: `${0} / ${0} 行已选择`,
      description: '请至少选择一张照片进行此操作',
      color: 'warning',
    })
    return
  }

  openDeleteConfirm('batch', selectedPhotos)
}

const confirmDelete = async () => {
  if (deleteTargetPhotos.value.length === 0) {
    isDeleteConfirmOpen.value = false
    return
  }

  const mode = deleteMode.value
  const targetPhotos = [...deleteTargetPhotos.value]

  let deleteToast: ReturnType<typeof toast.add> | null = null

  isDeleting.value = true

  try {
    if (mode === 'batch') {
      deleteToast = toast.add({
        title: '批量删除照片',
        description: '照片删除成功',
        color: 'info',
      })
      await Promise.all(
        targetPhotos.map((photo) =>
          $fetch(`/api/photos/${photo.id}`, {
            method: 'DELETE',
          }),
        ),
      )

      toast.update(deleteToast.id, {
        title: `已成功删除 ${targetPhotos.length} 张照片`,
        description: '',
        color: 'success',
      })

      rowSelection.value = {}
    } else {
      const photo = targetPhotos[0]
      if (!photo) {
        throw new Error('发生错误')
      }

      await $fetch(`/api/photos/${photo.id}`, {
        method: 'DELETE',
      })

      toast.add({
        title: '照片删除成功',
        description: '',
        color: 'success',
      })
    }

    await refresh()
    isDeleteConfirmOpen.value = false
    deleteTargetPhotos.value = []
  } catch (error: any) {
    console.error('删除照片失败:', error)
    const message = error?.message || '发生错误'

    if (mode === 'batch' && deleteToast) {
      toast.update(deleteToast.id, {
        title: '批量删除失败',
        description: message,
        color: 'error',
      })
    } else {
      toast.add({
        title: '删除照片失败',
        description: message,
        color: 'error',
      })
    }
  }

  isDeleting.value = false
}

// 批量重新处理照片功能
const handleBatchReprocess = async () => {
  const selectedRowModel = table.value?.tableApi?.getFilteredSelectedRowModel()
  const selectedPhotos =
    selectedRowModel?.rows.map((row: any) => row.original) || []
  if (selectedPhotos.some((photo: Photo) => photo.mediaType === 'video')) {
    toast.add({
      title: '此操作仅支持照片，请先取消选择视频。',
      color: 'warning',
    })
    return
  }

  if (selectedPhotos.length === 0) {
    toast.add({
      title: '请至少选择一张照片进行此操作',
      description: '',
      color: 'warning',
    })
    return
  }

  // 检查所有选中照片是否都有 storageKey
  const photosWithStorageKey = selectedPhotos.filter(
    (photo: Photo) => photo.storageKey,
  )
  if (photosWithStorageKey.length !== selectedPhotos.length) {
    toast.add({
      title: '发生错误',
      description: `${selectedPhotos.length - photosWithStorageKey.length} 张照片缺少存储信息，无法处理`,
      color: 'error',
    })
    return
  }

  try {
    const reprocessToast = toast.add({
      title: '正在提交重新处理任务...',
      description: '',
      color: 'info',
    })

    const result = await $fetch('/api/queue/add-tasks', {
      method: 'POST',
      body: {
        tasks: photosWithStorageKey.map((photo: Photo) => ({
          payload: {
            type: 'photo',
            storageKey: photo.storageKey,
          },
          priority: 0,
          maxAttempts: 3,
        })),
      },
    })

    if (result.success) {
      toast.update(reprocessToast.id, {
        title: '已添加重新处理任务',
        description: `已成功提交 ${photosWithStorageKey.length} 张照片至重新处理队列`,
        color: 'success',
      })
    } else {
      toast.update(reprocessToast.id, {
        title: '发生错误',
        description: '批量重新处理失败',
        color: 'error',
      })
    }

    // 清空选中状态
    rowSelection.value = {}
  } catch (error: any) {
    console.error('批量处理失败:', error)
    toast.add({
      title: '批量重新处理失败',
      description: error.message || '发生错误',
      color: 'error',
    })
  }
}

// 批量抹除位置信息
const handleBatchEraseLocation = async () => {
  const selectedRowModel = table.value?.tableApi?.getFilteredSelectedRowModel()
  const selectedPhotos =
    selectedRowModel?.rows.map((row: any) => row.original) || []
  if (selectedPhotos.some((photo: Photo) => photo.mediaType === 'video')) {
    toast.add({
      title: '此操作仅支持照片，请先取消选择视频。',
      color: 'warning',
    })
    return
  }

  if (selectedPhotos.length === 0) {
    toast.add({
      title: '请至少选择一张照片进行此操作',
      description: '',
      color: 'warning',
    })
    return
  }

  const targetPhotoIds = selectedPhotos
    .map((photo: Photo) => photo.id)
    .filter((id): id is string => !!id)

  if (targetPhotoIds.length === 0) {
    toast.add({
      title: '找不到照片',
      description: '',
      color: 'error',
    })
    return
  }

  for (const photoId of targetPhotoIds) {
    setEraseLocationLoading(photoId, true)
  }

  try {
    const result = await $fetch('/api/queue/add-tasks', {
      method: 'POST',
      body: {
        tasks: targetPhotoIds.map((photoId) => ({
          payload: {
            type: 'photo-erase-location',
            photoId,
          },
          priority: 2,
          maxAttempts: 3,
        })),
      },
    })

    if (result.success) {
      toast.add({
        title: `已加入 ${targetPhotoIds.length} 条抹除位置信息任务`,
        description: '',
        color: 'success',
      })
      rowSelection.value = {}
    } else {
      toast.add({
        title: '批量抹除位置信息任务添加失败',
        description: result?.message || '批量抹除位置信息任务添加失败',
        color: 'error',
      })
    }
  } catch (error: any) {
    console.error('批量抹除位置信息入队失败:', error)
    const message =
      error?.data?.statusMessage ||
      error?.statusMessage ||
      error?.message ||
      '批量抹除位置信息任务添加失败'

    toast.add({
      title: '批量抹除位置信息任务添加失败',
      description: message,
      color: 'error',
    })
  } finally {
    for (const photoId of targetPhotoIds) {
      setEraseLocationLoading(photoId, false)
    }
  }
}

// 批量下载照片
const handleBatchDownload = async () => {
  const selectedRowModel = table.value?.tableApi?.getFilteredSelectedRowModel()
  const selectedPhotos =
    selectedRowModel?.rows.map((row: any) => row.original) || []

  if (selectedPhotos.length === 0) {
    toast.add({
      title: '请至少选择一张照片进行此操作',
      description: '',
      color: 'warning',
    })
    return
  }

  // 检查所有选中照片是否都有 originalUrl
  const photosWithUrl = selectedPhotos.filter(
    (photo: Photo) => photo.originalUrl,
  )
  if (photosWithUrl.length === 0) {
    toast.add({
      title: '发生错误',
      description: '没有可用的下载链接照片',
      color: 'error',
    })
    return
  }

  if (photosWithUrl.length !== selectedPhotos.length) {
    toast.add({
      title: '警告',
      description: `仅有 ${photosWithUrl.length} 张照片（共 ${selectedPhotos.length} 张）具有可用的下载链接`,
      color: 'warning',
    })
  }

  const downloadToast = toast.add({
    title: '开始下载',
    description: `正在下载 ${photosWithUrl.length} 张照片...`,
    color: 'info',
  })

  let successCount = 0
  let failureCount = 0

  try {
    for (const photo of photosWithUrl) {
      try {
        const response = await fetch(photo.originalUrl!)
        if (!response.ok) {
          failureCount++
          continue
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        const extension = photo.originalUrl!.split('.').pop() || 'jpg'
        link.download = `${photo.title || `photo-${photo.id}`}.${extension}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        successCount++

        // 为了避免浏览器限制，每个下载之间加入短延迟
        await new Promise((resolve) => setTimeout(resolve, 200))
      } catch (error) {
        console.error(`Failed to download photo ${photo.id}:`, error)
        failureCount++
      }
    }

    // 更新提示信息
    if (successCount === photosWithUrl.length) {
      toast.update(downloadToast.id, {
        title: '批量下载完成',
        description: `已下载 ${successCount} 张照片`,
        color: 'success',
      })
    } else if (failureCount === photosWithUrl.length) {
      toast.update(downloadToast.id, {
        title: '批量下载失败',
        description: `下载失败 ${failureCount} 张照片`,
        color: 'error',
      })
    } else {
      toast.update(downloadToast.id, {
        title: '批量下载已完成，部分失败',
        description: `已下载 ${successCount} 张照片，${failureCount} 张失败`,
        color: 'warning',
      })
    }
  } catch (error: any) {
    console.error('批量下载出错:', error)
    toast.update(downloadToast.id, {
      title: '发生错误',
      description: error.message || '发生错误',
      color: 'error',
    })
  }
}

watch(isImagePreviewOpen, (open) => {
  if (!open) {
    previewingPhoto.value = null
  }
})
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="照片管理">
        <template #right>
          <div class="flex gap-2 items-center">
            <UButton
              variant="soft"
              color="neutral"
              icon="tabler:list-check"
              @click="$router.push('/dashboard/queue')"
            >
              <span class="hidden sm:inline">任务队列</span>
            </UButton>
            <UButton
              icon="tabler:folder-scan"
              :loading="isImportingLocalPhotos"
              :disabled="isImportingLocalPhotos"
              @click="importLocalPhotos"
            >
              <span class="hidden sm:inline">扫描本地目录</span>
            </UButton>
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 h-full flex-1 min-h-0">
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          服务端会扫描 NUXT_LOCAL_PHOTO_IMPORT_DIR
          配置的目录，不会从浏览器上传照片。
        </p>

        <!-- 统合容器：工具栏 + 照片列表 -->
        <div
          class="relative flex-1 min-h-0 flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 rounded-2xl shadow-sm overflow-hidden"
        >
          <!-- 工具栏 -->
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:px-4 sm:py-3 bg-neutral-50/50 dark:bg-neutral-900/50 backdrop-blur-sm border-b border-neutral-200/80 dark:border-neutral-800/80 z-20"
          >
            <div class="flex items-center gap-3">
              <div
                class="flex size-8 items-center justify-center rounded-[10px] bg-neutral-200/50 dark:bg-neutral-800/50 border border-neutral-200/50 dark:border-neutral-700/50"
              >
                <UIcon
                  name="tabler:photo"
                  class="size-4.5 text-neutral-600 dark:text-neutral-400"
                />
              </div>
              <span
                class="font-semibold text-sm text-neutral-700 dark:text-neutral-300 hidden sm:inline"
              >
                照片管理
              </span>
              <div class="flex items-center gap-1 sm:gap-2 sm:ml-1">
                <UBadge
                  v-if="livePhotoStats.videos > 0"
                  variant="soft"
                  color="info"
                  size="sm"
                >
                  {{ livePhotoStats.videos }} 视频
                </UBadge>
                <UBadge
                  v-if="livePhotoStats.staticPhotos > 0"
                  variant="soft"
                  color="neutral"
                  size="sm"
                >
                  <span class="hidden sm:inline"
                    >{{ livePhotoStats.staticPhotos }} 照片</span
                  >
                  <span class="sm:hidden"
                    >{{ livePhotoStats.staticPhotos }}P</span
                  >
                </UBadge>
                <UBadge
                  v-if="livePhotoStats.livePhotos > 0"
                  variant="soft"
                  color="warning"
                  size="sm"
                >
                  <span class="hidden sm:inline"
                    >{{ livePhotoStats.livePhotos }} Live Photo</span
                  >
                  <span class="sm:hidden"
                    >{{ livePhotoStats.livePhotos }}LP</span
                  >
                </UBadge>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <UPopover>
                <UTooltip text="筛选照片">
                  <UChip
                    inset
                    size="sm"
                    color="info"
                    :show="totalSelectedFilters > 0"
                  >
                    <UButton
                      variant="soft"
                      :color="hasActiveFilters ? 'info' : 'neutral'"
                      class="bg-transparent rounded-full cursor-pointer relative"
                      icon="tabler:filter"
                      size="sm"
                    />
                  </UChip>
                </UTooltip>

                <template #content>
                  <UCard variant="glassmorphism">
                    <OverlayFilterPanel />
                  </UCard>
                </template>
              </UPopover>
              <UPopover>
                <UTooltip text="照片排序">
                  <UButton
                    variant="soft"
                    :color="
                      currentSortOption?.key === 'dateTaken-desc'
                        ? 'neutral'
                        : 'info'
                    "
                    class="bg-transparent rounded-full cursor-pointer"
                    :icon="currentSortIcon"
                    size="sm"
                  />
                </UTooltip>

                <template #content>
                  <OverlaySortPanel />
                </template>
              </UPopover>
              <!-- 过滤器 -->
              <USelectMenu
                v-model="photoFilter"
                class="w-full sm:w-48"
                :items="[
                  {
                    label: '视频',
                    value: 'video',
                    icon: 'tabler:video',
                  },
                  {
                    label: '全部照片',
                    value: 'all',
                    icon: 'tabler:photo-scan',
                  },
                  {
                    label: 'Live Photo',
                    value: 'livephoto',
                    icon: 'tabler:live-photo',
                  },
                  {
                    label: '静态照片',
                    value: 'static',
                    icon: 'tabler:photo',
                  },
                ]"
                value-key="value"
                label-key="label"
                size="sm"
              >
              </USelectMenu>

              <!-- 刷新按钮 -->
              <UButton
                variant="soft"
                color="info"
                size="sm"
                icon="tabler:refresh"
                :loading="reactionsLoading"
                @click="
                  async () => {
                    await refresh()
                    if (filteredData.length > 0) {
                      await fetchReactions(filteredData.map((p: Photo) => p.id))
                    }
                  }
                "
              >
                <span class="hidden sm:inline">刷新</span>
              </UButton>

              <!-- 列可见性按钮 -->
              <UDropdownMenu
                :items="
                  table?.tableApi
                    ?.getAllColumns()
                    .filter((column: any) => column.getCanHide())
                    .map((column: any) => ({
                      label: columnNameMap[column.id] || column.id,
                      type: 'checkbox' as const,
                      checked: column.getIsVisible(),
                      disabled:
                        !column.getCanHide() ||
                        column.id === 'thumbnailUrl' ||
                        column.id === 'id' ||
                        column.id === 'actions',
                      onUpdateChecked(checked: boolean) {
                        table?.tableApi
                          ?.getColumn(column.id)
                          ?.toggleVisibility(!!checked)
                      },
                      onSelect(e: Event) {
                        e.preventDefault()
                      },
                    }))
                "
                :content="{ align: 'end' }"
              >
                <UButton
                  label=""
                  color="neutral"
                  variant="outline"
                  size="sm"
                  icon="tabler:columns-3"
                  title="切换列的显示/隐藏"
                >
                  <span class="hidden sm:inline">列设置</span>
                </UButton>
              </UDropdownMenu>
            </div>
          </div>

          <!-- 照片列表 -->
          <div class="relative flex-1 min-h-0 flex flex-col">
            <UTable
              ref="table"
              v-model:row-selection="rowSelection"
              v-model:column-visibility="columnVisibility"
              :get-row-id="getPhotoRowId"
              :column-pinning="{
                right: ['actions'],
              }"
              :data="filteredData as Photo[]"
              :columns="columns"
              :loading="status === 'pending'"
              sticky
              class="h-full flex-1"
              :ui="{
                wrapper: 'relative scroll-smooth h-full overflow-auto',
                base: 'min-w-full table-fixed',
                divide:
                  'divide-y divide-neutral-200/80 dark:divide-neutral-800/80',
                thead:
                  'bg-neutral-50/80 dark:bg-neutral-900/80 backdrop-blur-md sticky top-0 z-10 whitespace-nowrap',
                tbody:
                  'divide-y divide-neutral-200/80 dark:divide-neutral-800/80 bg-white dark:bg-neutral-900',
                tr: {
                  base: 'hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors',
                  selected: 'bg-primary-50/50 dark:bg-primary-900/20',
                },
                th: {
                  base: 'text-left rtl:text-right ',
                  padding: 'px-4 py-3.5',
                  color: 'text-neutral-500 dark:text-neutral-400',
                  font: 'font-medium text-sm',
                },
                td: {
                  padding: 'px-4 py-3',
                  color: 'text-neutral-700 dark:text-neutral-300 text-sm',
                },
                separator: 'bg-neutral-200/80 dark:bg-neutral-800/80',
              }"
            >
              <template #actions-cell="{ row }">
                <div class="flex justify-end">
                  <UDropdownMenu
                    size="sm"
                    :content="{
                      align: 'end',
                    }"
                    :items="getRowActions(row.original)"
                  >
                    <UButton
                      variant="outline"
                      color="neutral"
                      size="sm"
                      icon="tabler:dots-vertical"
                    />
                  </UDropdownMenu>
                </div>
              </template>
            </UTable>

            <!-- 悬浮版批量操作菜单 -->
            <transition
              enter-active-class="transition-all duration-300 ease-out"
              enter-from-class="translate-y-8 opacity-0 scale-95"
              enter-to-class="translate-y-0 opacity-100 scale-100"
              leave-active-class="transition-all duration-200 ease-in"
              leave-from-class="translate-y-0 opacity-100 scale-100"
              leave-to-class="translate-y-8 opacity-0 scale-95"
            >
              <div
                v-if="selectedRowsCount > 0"
                class="fixed bottom-8 left-1/2 -translate-x-1/2 z-60 w-max flex flex-col items-center gap-2"
              >
                <p
                  class="hidden items-center gap-1.5 max-w-[calc(100vw-2rem)] px-3 py-1 rounded-full bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 text-xs text-neutral-500 dark:text-neutral-400 pointer-fine:flex"
                >
                  <Icon
                    name="tabler:info-circle"
                    class="size-3.5 shrink-0"
                  />
                  提示：按住 Shift 键并点击，即可选择一个范围内的照片
                </p>

                <div
                  class="px-2 py-1.5 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl shadow-xl rounded-full border border-neutral-200/80 dark:border-neutral-800/80 flex items-center gap-3 sm:gap-6 shadow-black/5 dark:shadow-black/20"
                >
                  <div
                    class="pl-4 pr-1 border-r border-neutral-200 dark:border-neutral-800 min-w-max"
                  >
                    <p
                      class="text-sm font-medium tracking-wide text-neutral-700 dark:text-neutral-200"
                    >
                      {{ `${selectedRowsCount} / ${totalRowsCount} 行已选择` }}
                    </p>
                  </div>

                  <div class="flex items-center gap-1 sm:gap-1.5 pr-2">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      class="rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800"
                      icon="tabler:refresh"
                      @click="handleBatchReprocess"
                    >
                      <span class="hidden sm:inline">重新处理</span>
                    </UButton>

                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      class="rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800"
                      icon="tabler:map-off"
                      @click="handleBatchEraseLocation"
                    >
                      <span class="hidden sm:inline">抹除位置信息</span>
                    </UButton>

                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      class="rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800"
                      icon="tabler:download"
                      @click="handleBatchDownload"
                    >
                      <span class="hidden sm:inline">批量下载</span>
                    </UButton>

                    <UButton
                      color="error"
                      variant="ghost"
                      size="sm"
                      class="rounded-full hover:bg-error-50 dark:hover:bg-error-500/20"
                      icon="tabler:trash"
                      @click="handleBatchDelete"
                    >
                      <span class="hidden sm:inline">批量删除</span>
                    </UButton>
                  </div>
                </div>
              </div>
            </transition>
          </div>
        </div>

        <USlideover
          v-model:open="isEditModalOpen"
          title="编辑照片信息"
          description="更新标题、描述、标签和拍摄位置。"
          :ui="{
            content: 'sm:max-w-xl',
            body: 'p-2',
            header:
              'px-6 py-5 border-b border-neutral-200 dark:border-neutral-800',
            footer:
              'px-6 py-5 border-t border-neutral-200 dark:border-neutral-800',
          }"
        >
          <template #body>
            <div class="space-y-6">
              <div
                v-if="editingPhoto"
                class="space-y-1"
              >
                <p class="text-xs text-neutral-500 dark:text-neutral-500">
                  {{ editingPhoto.title || editingPhoto.id }}
                </p>
              </div>

              <UForm
                id="edit-photo-form"
                :state="editFormState"
                class="space-y-5"
                @submit="handleEditSubmit"
              >
                <UFormField
                  label="标题"
                  name="title"
                >
                  <UInput
                    v-model="editFormState.title"
                    class="w-full"
                  />
                </UFormField>

                <UFormField
                  label="描述"
                  name="description"
                >
                  <UTextarea
                    v-model="editFormState.description"
                    :rows="3"
                    class="w-full"
                  />
                </UFormField>

                <div class="space-y-2">
                  <UFormField
                    label="标签"
                    name="tags"
                  >
                    <UInputTags
                      v-model="tagsModel"
                      class="w-full"
                    />
                  </UFormField>
                  <p class="text-xs text-neutral-500 dark:text-neutral-400">
                    按下 Enter 键添加每个标签。
                  </p>
                </div>

                <div class="flex items-center justify-between space-y-2">
                  <label
                    class="text-sm font-medium text-neutral-700 dark:text-neutral-200"
                  >
                    评分
                  </label>
                  <div class="flex items-center gap-3">
                    <span
                      v-if="editFormState.rating"
                      class="text-sm text-neutral-600 dark:text-neutral-400"
                    >
                      {{ editFormState.rating }} / 5
                    </span>
                    <span
                      v-else
                      class="text-sm text-neutral-500 dark:text-neutral-500"
                    >
                      未评分
                    </span>
                    <Rating
                      :model-value="editFormState.rating || 0"
                      :allow-half="false"
                      size="lg"
                      @update:model-value="
                        editFormState.rating = $event || null
                      "
                    />
                  </div>
                </div>

                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <label
                      class="text-sm font-medium text-neutral-700 dark:text-neutral-200"
                    >
                      拍摄位置
                    </label>
                    <UButton
                      v-if="locationSelection"
                      variant="ghost"
                      color="neutral"
                      size="xs"
                      icon="tabler:map-off"
                      @click.prevent="clearSelectedLocation"
                    >
                      抹除位置信息
                    </UButton>
                  </div>

                  <MapLocationPicker
                    v-model="locationSelection"
                    class="border border-neutral-200 dark:border-neutral-800"
                    @pick="handleLocationPick"
                  >
                    <template #empty>
                      <span
                        class="px-3 py-2 rounded-full bg-white/80 text-neutral-600 dark:bg-neutral-900/80 dark:text-neutral-200 shadow"
                      >
                        点击地图选择或更新拍摄位置。
                      </span>
                    </template>
                  </MapLocationPicker>

                  <div
                    class="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-2"
                  >
                    <span>坐标:</span>
                    <span v-if="formattedCoordinates">
                      {{ formattedCoordinates.latitude }},
                      {{ formattedCoordinates.longitude }}
                    </span>
                    <span v-else> 未选择位置 </span>
                  </div>
                </div>
              </UForm>
            </div>
          </template>

          <template #footer>
            <div class="flex items-center justify-end gap-2 w-full">
              <UButton
                variant="ghost"
                color="neutral"
                @click.prevent="isEditModalOpen = false"
              >
                取消
              </UButton>
              <UButton
                type="submit"
                form="edit-photo-form"
                :loading="isSavingMetadata"
                :disabled="!isMetadataDirty || isSavingMetadata"
                icon="tabler:device-floppy"
              >
                保存更改
              </UButton>
            </div>
          </template>
        </USlideover>

        <UModal v-model:open="isDeleteConfirmOpen">
          <template #body>
            <div class="space-y-4">
              <div class="flex items-start gap-4">
                <div
                  class="flex size-10 items-center justify-center rounded-full bg-error-100 dark:bg-error-900/40 text-error-600 dark:text-error-400 shrink-0"
                >
                  <Icon
                    name="tabler:trash"
                    class="size-6"
                  />
                </div>
                <div class="space-y-1.5 pt-1">
                  <h3
                    class="text-lg font-semibold text-neutral-900 dark:text-white leading-5"
                  >
                    {{ deleteMode === 'single' ? '删除照片' : '批量删除照片' }}
                  </h3>
                  <p
                    class="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed"
                  >
                    {{
                      deleteMode === 'single'
                        ? '确定要删除这张照片吗？'
                        : `确定要删除选中的 ${deleteTargetPhotos.length} 张照片吗？`
                    }}
                  </p>
                  <div
                    class="mt-4 p-3 bg-error-50 dark:bg-error-500/10 border border-error-200/50 dark:border-error-500/20 rounded-lg"
                  >
                    <p
                      class="text-sm font-medium text-error-600 dark:text-error-400 flex items-center gap-2"
                    >
                      <Icon
                        name="tabler:alert-triangle-filled"
                        class="size-4"
                      />
                      删除操作会同时移除原图、缩略图和实况视频，且无法恢复。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <template #footer>
            <div class="flex justify-end gap-3 w-full">
              <UButton
                variant="ghost"
                color="neutral"
                :disabled="isDeleting"
                @click="isDeleteConfirmOpen = false"
              >
                取消
              </UButton>
              <UButton
                color="error"
                icon="tabler:trash"
                :loading="isDeleting"
                @click="confirmDelete"
              >
                确认删除
              </UButton>
            </div>
          </template>
        </UModal>

        <!-- 图片预览模态框 -->
        <UModal
          v-model:open="isImagePreviewOpen"
          title="照片预览"
          :description="previewingPhoto?.description || ''"
        >
          <template #body>
            <div
              class="flex items-center justify-center w-full"
              style="max-height: calc(100vh - 12rem)"
            >
              <div class="w-full max-w-2xl rounded-lg overflow-hidden">
                <MasonryItemPhoto
                  v-if="
                    previewingPhoto && previewingPhoto.mediaType !== 'video'
                  "
                  :photo="previewingPhoto"
                  :index="0"
                  @visibility-change="() => {}"
                  @open-viewer="openInNewTab(`/${previewingPhoto.id}`)"
                />
                <div
                  v-else-if="previewingPhoto"
                  class="space-y-3"
                >
                  <video
                    v-if="isImagePreviewOpen"
                    :src="previewingPhoto.originalUrl || undefined"
                    :poster="previewingPhoto.thumbnailUrl || undefined"
                    class="w-full max-h-[65vh] bg-black"
                    controls
                    playsinline
                    preload="metadata"
                  />
                  <UButton
                    icon="tabler:cut"
                    @click="openVideoTrim(previewingPhoto)"
                    >裁剪视频</UButton
                  >
                </div>
              </div>
            </div>
          </template>
        </UModal>
      </div>
    </template>
  </UDashboardPanel>
  <VideoTrimEditor
    v-if="trimTarget"
    :photo="trimTarget"
    :open="showTrimEditor"
    @close="showTrimEditor = false"
    @completed="refresh()"
  />
</template>

<style scoped></style>
