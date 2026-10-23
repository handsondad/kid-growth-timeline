<script setup lang="ts">
import { taskStatusLabels } from '~/utils/task-labels'
import {
  MIN_TRIM_MS,
  formatVideoTime,
  validateTrimRange,
} from '~~/shared/utils/video'

interface VideoTask {
  id: number
  status: 'pending' | 'in-stages' | 'completed' | 'failed'
  progress: number
  errorMessage: string | null
  payload: { type: string; startMs?: number; endMs?: number; outputId?: string }
}
interface Capability {
  supported: boolean
  available: boolean
  reason: string | null
  durationMs: number | null
  latestTask: VideoTask | null
}

const props = defineProps<{ photo: Photo; open: boolean }>()
const emit = defineEmits<{ close: []; completed: [] }>()
const player = ref<HTMLVideoElement>()
const capability = ref<Capability | null>(null)
const task = ref<VideoTask | null>(null)
const startMs = ref(0)
const endMs = ref(0)
const positionMs = ref(0)
const paused = ref(true)
const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const invalidInput = reactive({ start: false, end: false })
let sequence = 0
let timer: ReturnType<typeof setTimeout> | undefined
const durationMs = computed(
  () => capability.value?.durationMs ?? props.photo.durationMs ?? 0,
)
const active = computed(
  () => task.value?.status === 'pending' || task.value?.status === 'in-stages',
)
const valid = computed(() => {
  if (invalidInput.start || invalidInput.end) return false
  try {
    validateTrimRange(startMs.value, endMs.value, durationMs.value)
    return true
  } catch {
    return false
  }
})
const unavailableMessage = computed(() => {
  if (!capability.value) return ''
  if (!capability.value.supported) return '普通视频导入和裁剪仅支持本地存储。'
  if (!capability.value.available)
    return '视频工具不可用或原片不受支持。请在服务端安装 FFmpeg 和 FFprobe，或配置 NUXT_FFMPEG_PATH 和 NUXT_FFPROBE_PATH。'
  return ''
})
const failureMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data
    if (
      data &&
      typeof data === 'object' &&
      'statusMessage' in data &&
      typeof data.statusMessage === 'string'
    ) {
      return `${fallback}: ${data.statusMessage}`
    }
  }
  return error instanceof Error ? `${fallback}: ${error.message}` : fallback
}
function stopPolling() {
  clearTimeout(timer)
}
async function poll(token: number) {
  const id = task.value?.id
  if (!id || token !== sequence) return
  try {
    const result = await $fetch<VideoTask>(`/api/queue/stats/${id}`)
    if (token !== sequence) return
    const completed =
      result.status === 'completed' && task.value?.status !== 'completed'
    task.value = result
    errorMessage.value = ''
    if (completed) emit('completed')
  } catch (error) {
    if (token !== sequence) return
    errorMessage.value = failureMessage(error, '无法读取视频或任务状态')
  }
  if (token === sequence && active.value) {
    timer = setTimeout(() => poll(token), 1500)
  }
}
async function load() {
  stopPolling()
  const token = ++sequence
  loading.value = true
  errorMessage.value = ''
  capability.value = null
  task.value = null
  invalidInput.start = false
  invalidInput.end = false
  positionMs.value = 0
  paused.value = true
  try {
    const result = await $fetch<Capability>(
      `/api/photos/${props.photo.id}/video`,
    )
    if (token !== sequence) return
    capability.value = result
    task.value = result.latestTask
    startMs.value = result.latestTask?.payload.startMs ?? 0
    endMs.value = result.latestTask?.payload.endMs ?? durationMs.value
    if (result.latestTask?.status === 'completed') emit('completed')
    if (active.value) await poll(token)
  } catch (error) {
    if (token === sequence)
      errorMessage.value = failureMessage(error, '无法读取视频或任务状态')
  } finally {
    if (token === sequence) loading.value = false
  }
}
function seek(milliseconds: number) {
  if (!player.value || !Number.isFinite(milliseconds)) return
  player.value.currentTime =
    Math.min(durationMs.value, Math.max(0, milliseconds)) / 1000
  positionMs.value = Math.round(player.value.currentTime * 1000)
}
function changeRange(event: Event, kind: 'start' | 'end') {
  if (!(event.target instanceof HTMLInputElement)) return
  const value = Math.round(event.target.valueAsNumber * 1000)
  invalidInput[kind] = !Number.isSafeInteger(value)
  if (invalidInput[kind]) return
  if (kind === 'start') {
    startMs.value = Math.max(0, Math.min(endMs.value - MIN_TRIM_MS, value))
    seek(startMs.value)
  } else {
    endMs.value = Math.min(
      durationMs.value,
      Math.max(startMs.value + MIN_TRIM_MS, value),
    )
    seek(endMs.value)
  }
  event.target.value = String(
    (kind === 'start' ? startMs.value : endMs.value) / 1000,
  )
}
function seekFromInput(event: Event) {
  if (event.target instanceof HTMLInputElement)
    seek(event.target.valueAsNumber * 1000)
}
async function togglePlayback() {
  if (!player.value) return
  if (!player.value.paused) player.value.pause()
  else {
    try {
      await player.value.play()
    } catch (error) {
      errorMessage.value = failureMessage(error, '无法播放此视频')
    }
  }
}
async function submit(retry = false) {
  if (
    submitting.value ||
    active.value ||
    (!retry && (!valid.value || !capability.value?.available))
  )
    return
  const token = sequence
  const sourceId = props.photo.id
  submitting.value = true
  errorMessage.value = ''
  try {
    let id: number
    if (retry && task.value) {
      await $fetch('/api/queue/task/retry', {
        method: 'POST',
        body: { taskId: task.value.id },
      })
      id = task.value.id
    } else {
      const result = await $fetch<{ taskId: number; outputId: string }>(
        `/api/photos/${props.photo.id}/trim`,
        {
          method: 'POST',
          body: { startMs: startMs.value, endMs: endMs.value },
        },
      )
      id = result.taskId
    }
    if (token !== sequence) {
      if (props.open && sourceId === props.photo.id) await load()
      return
    }
    const result = await $fetch<VideoTask>(`/api/queue/stats/${id}`)
    if (token !== sequence) return
    task.value = result
    if (result.status === 'completed') emit('completed')
    else await poll(token)
  } catch (error) {
    if (token === sequence)
      errorMessage.value = failureMessage(error, '无法提交视频任务')
  } finally {
    submitting.value = false
  }
}
watch(
  [() => props.open, () => props.photo.id],
  ([open]) => {
    if (open) load()
    else {
      player.value?.pause()
    }
  },
  { immediate: true },
)
const { refresh: refreshPhotos } = usePhotos()
async function openClip() {
  const id = task.value?.payload.outputId
  if (!id) return
  try {
    await refreshPhotos()
    emit('close')
    useViewerState().closeViewer()
    await navigateTo(`/${id}`)
  } catch (error) {
    errorMessage.value = failureMessage(error, '无法读取视频或任务状态')
  }
}
onBeforeUnmount(() => {
  sequence++
  stopPolling()
  player.value?.pause()
})
</script>

<template>
  <UModal
    :open="open"
    title="裁剪视频"
    description="生成新的媒体条目，原视频文件保持不变。"
    :ui="{ content: 'sm:max-w-3xl' }"
    @update:open="!$event && emit('close')"
  >
    <template #body>
      <div
        class="space-y-4"
        @keydown.stop
      >
        <p class="text-sm break-all">来源视频: {{ photo.title || photo.id }}</p>
        <video
          v-if="open"
          ref="player"
          :src="photo.originalUrl || undefined"
          :poster="photo.thumbnailUrl || undefined"
          class="w-full max-h-[40vh] bg-black rounded-lg"
          controls
          playsinline
          preload="metadata"
          @play="paused = false"
          @pause="paused = true"
          @timeupdate="
            positionMs = Math.round((player?.currentTime || 0) * 1000)
          "
          @error="errorMessage = '无法播放此视频'"
        />
        <div class="flex items-center gap-3">
          <UButton
            :icon="paused ? 'tabler:player-play' : 'tabler:player-pause'"
            :aria-label="paused ? '播放' : '暂停'"
            @click="togglePlayback"
          />
          <span class="text-sm"
            >当前播放位置: {{ formatVideoTime(positionMs, true) }} /
            {{ formatVideoTime(durationMs, true) }}</span
          >
        </div>
        <input
          type="range"
          min="0"
          :max="durationMs / 1000"
          step="0.001"
          :value="positionMs / 1000"
          aria-label="拖动预览"
          class="w-full"
          @input="seekFromInput"
        />
        <fieldset
          :disabled="active || submitting || loading"
          class="space-y-3"
        >
          <div
            v-for="kind in ['start', 'end'] as const"
            :key="kind"
            class="space-y-2"
          >
            <label
              :for="`trim-${kind}`"
              class="flex items-center justify-between gap-3 text-sm"
            >
              {{ kind === 'start' ? '开始时间' : '结束时间' }} (秒)
              <input
                :id="`trim-${kind}`"
                type="number"
                :min="kind === 'start' ? 0 : (startMs + MIN_TRIM_MS) / 1000"
                :max="
                  kind === 'start'
                    ? Math.max(0, endMs - MIN_TRIM_MS) / 1000
                    : durationMs / 1000
                "
                step="0.001"
                :value="(kind === 'start' ? startMs : endMs) / 1000"
                class="w-36 rounded border border-current/20 bg-transparent p-2"
                @input="changeRange($event, kind)"
              />
            </label>
            <input
              type="range"
              :min="kind === 'start' ? 0 : (startMs + MIN_TRIM_MS) / 1000"
              :max="
                kind === 'start'
                  ? Math.max(0, endMs - MIN_TRIM_MS) / 1000
                  : durationMs / 1000
              "
              step="0.001"
              :value="(kind === 'start' ? startMs : endMs) / 1000"
              :aria-label="kind === 'start' ? '开始时间' : '结束时间'"
              class="w-full"
              @input="changeRange($event, kind)"
            />
          </div>
        </fieldset>
        <p class="text-sm">
          选区长度:
          {{ formatVideoTime(endMs - startMs, true) }}
        </p>
        <p
          v-if="loading"
          role="status"
        >
          正在检查视频工具与原片…
        </p>
        <p
          v-else-if="!valid"
          class="text-error"
        >
          请选择片长范围内至少 0.25 秒的有效区间。
        </p>
        <div
          v-if="unavailableMessage"
          class="text-warning"
          role="alert"
        >
          <p>{{ unavailableMessage }}</p>
          <p class="text-xs break-words">{{ capability?.reason }}</p>
        </div>
        <p
          v-if="errorMessage"
          role="alert"
          class="text-error break-words"
        >
          {{ errorMessage }}
        </p>
        <div
          v-if="task"
          class="space-y-2 rounded-lg border border-current/15 p-3"
          aria-live="polite"
        >
          <p>{{ taskStatusLabels[task.status] }} · {{ task.progress }}%</p>
          <progress
            v-if="active"
            :value="task.progress"
            max="100"
            class="w-full"
          />
          <p
            v-if="active"
            class="text-sm"
          >
            任务将在后台继续。可以关闭此窗口，稍后返回或在处理队列中查看。
          </p>
          <p
            v-if="task.errorMessage"
            role="alert"
            class="text-error break-words"
          >
            {{ task.errorMessage }}
          </p>
          <UButton
            v-if="task.status === 'failed'"
            :loading="submitting"
            :disabled="!capability?.available"
            @click="submit(true)"
            >重试任务</UButton
          >
          <UButton
            v-if="task.status === 'completed' && task.payload.outputId"
            @click="openClip"
            >打开生成的片段</UButton
          >
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex flex-wrap justify-end gap-2 w-full">
        <UButton
          variant="ghost"
          color="neutral"
          :disabled="loading || submitting"
          @click="load"
          >刷新状态</UButton
        >
        <UButton
          variant="ghost"
          color="neutral"
          @click="emit('close')"
          >关闭</UButton
        >
        <UButton
          :loading="submitting"
          :disabled="!valid || !capability?.available || loading || active"
          @click="submit()"
          >生成片段</UButton
        >
      </div>
    </template>
  </UModal>
</template>
