<script setup lang="ts">
import {
  taskTypeLabels,
  taskStatusLabels,
  taskStageLabels,
} from '~/utils/task-labels'
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'

const UButton = resolveComponent('UButton')

definePageMeta({
  layout: 'dashboard',
})

useHead({
  title: () => '队列管理',
})

const toast = useToast()

// 状态管理
const isLoading = ref(false)
const selectedTasks = ref<number[]>([])
const statusFilter = ref<string>('all')
const typeFilter = ref<string>('all')

// 数据获取
const { data: queueData, refresh: refreshQueue } = await useFetch(
  '/api/queue/task/list',
  {
    query: computed(() => ({
      ...(statusFilter.value !== 'all' && { status: statusFilter.value }),
      ...(typeFilter.value !== 'all' && { type: typeFilter.value }),
    })),
  },
)

// 队列统计数据
const queueStats = computed(() => {
  if (!queueData.value?.data)
    return { pending: 0, processing: 0, completed: 0, failed: 0 }

  const stats = { pending: 0, processing: 0, completed: 0, failed: 0 }
  queueData.value.data.forEach((task) => {
    if (task.status === 'pending') stats.pending++
    else if (task.status === 'in-stages') stats.processing++
    else if (task.status === 'completed') stats.completed++
    else if (task.status === 'failed') stats.failed++
  })
  return stats
})

// 刷新数据
const refreshData = async () => {
  isLoading.value = true
  try {
    await refreshQueue()
    selectedTasks.value = []
  } finally {
    isLoading.value = false
  }
}

// 清理非活跃任务
const clearNonActiveTasks = async () => {
  try {
    isLoading.value = true
    const result = await $fetch('/api/queue/task/clear', {
      method: 'DELETE',
      query: {
        includeCompleted: 'true',
        includeFailed: 'true',
      },
    })

    toast.add({
      title: '清理完成',
      description: `清除了 ${result.deletedCount} 个任务`,
      color: 'success',
    })

    await refreshData()
  } catch (error: any) {
    console.error('Clear tasks failed:', error)
    toast.add({
      title: '操作失败',
      description: error?.message || '清理任务失败',
      color: 'error',
    })
  } finally {
    isLoading.value = false
  }
}

// 重试单个任务
const retryTask = async (taskId: number) => {
  try {
    await $fetch('/api/queue/task/retry', {
      method: 'POST',
      body: { taskId },
    })

    toast.add({
      title: '任务重试成功',
      color: 'success',
    })

    await refreshData()
  } catch (error: any) {
    console.error('Retry task failed:', error)
    toast.add({
      title: '操作失败',
      description: error?.message || '重试任务失败',
      color: 'error',
    })
  }
}

// 批量重试失败任务
const retryAllFailedTasks = async () => {
  try {
    isLoading.value = true
    const result = await $fetch('/api/queue/task/retry-batch', {
      method: 'POST',
      body: { retryAll: true },
    })

    toast.add({
      title: '批量重试成功',
      description: `重试了 ${result.retriedCount} 个任务`,
      color: 'success',
    })

    await refreshData()
  } catch (error: any) {
    console.error('Batch retry failed:', error)
    toast.add({
      title: '操作失败',
      description: error?.message || '批量重试失败',
      color: 'error',
    })
  } finally {
    isLoading.value = false
  }
}

// 删除单个任务（仅适用于失败任务）
const deleteTask = async (taskId: number) => {
  try {
    await $fetch(`/api/queue/failed/${taskId}`, {
      method: 'DELETE',
    })

    toast.add({
      title: '任务删除成功',
      color: 'success',
    })

    await refreshData()
  } catch (error: any) {
    console.error('Delete task failed:', error)
    toast.add({
      title: '操作失败',
      description: error?.message || '删除任务失败',
      color: 'error',
    })
  }
}

// 获取状态颜色
const getStatusColor = (
  status: 'pending' | 'in-stages' | 'completed' | 'failed',
) => {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'in-stages':
      return 'info'
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    default:
      return 'neutral'
  }
}

// 状态选项
const statusOptions = computed(() => [
  { label: '全部', value: 'all' },
  { label: '等待中', value: 'pending' },
  { label: '处理中', value: 'in-stages' },
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' },
])

// 类型选项
const typeOptions = computed(() => [
  { label: '视频导入', value: 'video' },
  { label: '视频裁剪', value: 'video-trim' },
  { label: '全部', value: 'all' },
  { label: '照片处理', value: 'photo' },
  {
    label: 'LivePhoto视频',
    value: 'live-photo-video',
  },
  {
    label: '照片逆地理编码',
    value: 'photo-reverse-geocoding',
  },
  {
    label: '照片位置信息抹除',
    value: 'photo-erase-location',
  },
])

// 展开行状态
const expanded = ref<Record<string, boolean>>({})

// 表格列定义
const columns = computed<TableColumn<any>[]>(() => [
  {
    id: 'expand',
    cell: ({ row }) =>
      h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        icon: 'tabler:chevron-down',
        square: true,
        'aria-label': '展开',
        ui: {
          leadingIcon: [
            'transition-transform',
            row.getIsExpanded() ? 'duration-200 rotate-180' : '',
          ],
        },
        onClick: () => row.toggleExpanded(),
      }),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'id',
    header: '任务ID',
  },
  {
    id: 'type',
    accessorFn: (row) => row.payload.type,
    header: '类型',
  },
  {
    accessorKey: 'status',
    header: '状态',
  },
  {
    accessorKey: 'attempts',
    header: '尝试次数',
  },
  {
    accessorKey: 'priority',
    header: '优先级',
  },
  {
    accessorKey: 'statusStage',
    header: '处理阶段',
  },
  {
    accessorKey: 'createdAt',
    header: '创建时间',
  },
  {
    id: 'actions',
    header: '操作',
  },
])

// 自动刷新
const refreshInterval = setInterval(refreshData, 10000) // 每10秒刷新一次
onBeforeUnmount(() => {
  clearInterval(refreshInterval)
})
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="队列管理">
        <template #right>
          <UButton
            icon="tabler:refresh"
            variant="soft"
            :loading="isLoading"
            @click="refreshData"
          >
            刷新数据
          </UButton>
          <UButton
            icon="tabler:refresh"
            color="warning"
            variant="soft"
            :loading="isLoading"
            @click="retryAllFailedTasks"
          >
            重试全部失败
          </UButton>
          <UButton
            icon="tabler:trash"
            color="error"
            variant="soft"
            :loading="isLoading"
            @click="clearNonActiveTasks"
          >
            清理非活跃任务
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-6">
        <!-- 状态指示器 -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardIndicator
            title="等待处理"
            icon="tabler:clock"
            color="orange"
            :value="queueStats.pending"
          />
          <DashboardIndicator
            title="正在处理"
            icon="tabler:loader"
            color="blue"
            :value="queueStats.processing"
          />
          <DashboardIndicator
            title="已完成"
            icon="tabler:check"
            color="green"
            :value="queueStats.completed"
          />
          <DashboardIndicator
            title="失败任务"
            icon="tabler:alert-triangle"
            color="red"
            :value="queueStats.failed"
          />
        </div>

        <!-- 筛选器和表格 -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between pb-2">
              <h2 class="text-lg font-semibold">队列任务列表</h2>
              <div class="flex items-center gap-2">
                <USelectMenu
                  v-model="statusFilter"
                  :items="statusOptions"
                  value-key="value"
                  size="sm"
                  variant="soft"
                  class="w-32"
                  :search-input="false"
                />
                <USelectMenu
                  v-model="typeFilter"
                  :items="typeOptions"
                  value-key="value"
                  size="sm"
                  variant="soft"
                  class="w-32"
                  :search-input="false"
                />
              </div>
            </div>
          </template>

          <div class="space-y-4">
            <!-- 任务表格 -->
            <UTable
              v-model:expanded="expanded"
              :data="queueData?.data || []"
              :columns="columns"
              :loading="isLoading"
              :empty-state="{
                icon: 'tabler:inbox',
                label: '没有找到任务',
              }"
              class="w-full"
            >
              <!-- 任务类型 -->
              <template #type-cell="{ row }">
                <UBadge
                  :label="taskTypeLabels[row.original.payload.type]"
                  variant="soft"
                  :color="
                    row.original.payload.type === 'photo' ? 'info' : 'secondary'
                  "
                  size="sm"
                />
              </template>

              <!-- 状态 -->
              <template #status-cell="{ row }">
                <UBadge
                  :label="taskStatusLabels[row.original.status]"
                  variant="soft"
                  :color="getStatusColor(row.original.status)"
                  size="sm"
                />
                <span
                  v-if="
                    row.original.payload.type === 'video' ||
                    row.original.payload.type === 'video-trim'
                  "
                  class="ml-1 text-xs"
                >
                  {{ row.original.progress }}%
                </span>
              </template>

              <!-- 尝试次数 -->
              <template #attempts-cell="{ row }">
                <span class="text-sm">
                  {{ row.original.attempts }}/{{ row.original.maxAttempts }}
                </span>
              </template>

              <!-- 处理阶段 -->
              <template #statusStage-cell="{ row }">
                <span
                  v-if="row.original.statusStage"
                  class="text-xs text-gray-500"
                >
                  {{ taskStageLabels[row.original.statusStage] }}
                </span>
                <span
                  v-else
                  class="text-xs text-gray-400"
                  >-</span
                >
              </template>

              <!-- 创建时间 -->
              <template #createdAt-cell="{ row }">
                <span class="text-sm">{{
                  $dayjs(row.original.createdAt).format('MM-DD HH:mm:ss')
                }}</span>
              </template>

              <!-- 操作按钮 -->
              <template #actions-cell="{ row }">
                <div class="flex items-center gap-1">
                  <UButton
                    v-if="row.original.status === 'failed'"
                    icon="tabler:refresh"
                    size="xs"
                    variant="soft"
                    color="warning"
                    @click="retryTask(row.original.id)"
                  >
                    重试
                  </UButton>
                  <UButton
                    v-if="row.original.status !== 'in-stage'"
                    icon="tabler:trash"
                    size="xs"
                    variant="soft"
                    color="error"
                    @click="deleteTask(row.original.id)"
                  >
                    删除
                  </UButton>
                  <span
                    v-if="
                      row.original.status === 'pending' ||
                      row.original.status === 'in-stages'
                    "
                    class="text-xs text-gray-400"
                  >
                    -
                  </span>
                </div>
              </template>

              <!-- 展开行内容 -->
              <template #expanded="{ row }">
                <div class="px-2">
                  <div class="space-y-3">
                    <!-- 任务ID和类型 -->
                    <div class="flex gap-4">
                      <div>
                        <p class="text-xs text-neutral-500">照片 ID</p>
                        <p class="text-sm capitalize">
                          {{
                            row.original.payload.photoId ||
                            row.original.payload.mediaId ||
                            '-'
                          }}
                        </p>
                      </div>
                      <div>
                        <p class="text-xs text-neutral-500">任务ID</p>
                        <p class="font-mono text-sm">{{ row.original.id }}</p>
                      </div>
                      <div>
                        <p class="text-xs text-neutral-500">类型</p>
                        <p class="text-sm capitalize">
                          {{ row.original.payload.type }}
                        </p>
                      </div>
                    </div>

                    <!-- 错误信息（仅在失败状态显示） -->
                    <div
                      v-if="
                        row.original.status === 'failed' &&
                        row.original.errorMessage
                      "
                      class="mt-3"
                    >
                      <p class="text-xs text-neutral-500 mb-1">错误详情</p>
                      <div
                        class="p-3 bg-red-50 dark:bg-red-950/20 rounded border border-red-100 dark:border-red-900/30"
                      >
                        <p
                          class="text-sm text-red-700 dark:text-red-300 wrap-break-word font-mono"
                        >
                          {{ row.original.errorMessage }}
                        </p>
                      </div>
                    </div>

                    <!-- Payload 信息 -->
                    <div
                      v-if="row.original.payload"
                      class="mt-3"
                    >
                      <p class="text-xs text-gray-500 mb-1">负载</p>
                      <pre
                        class="text-xs bg-neutral-100/50 dark:bg-neutral-800/50 p-2 rounded overflow-x-auto text-neutral-700 dark:text-neutral-300"
                        >{{
                          JSON.stringify(row.original.payload, null, 2)
                        }}</pre
                      >
                    </div>
                  </div>
                </div>
              </template>
            </UTable>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
/* 确保表格在小屏幕上正常显示 */
:deep(.table-wrapper) {
  overflow-x: auto;
}
</style>
