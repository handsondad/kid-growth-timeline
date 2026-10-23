<script setup lang="ts">
import { useMapSetupNotice } from '~/composables/useMapSetupNotice'

const { isOpen, dismiss } = useMapSetupNotice()

async function openSettings() {
  dismiss()
  await navigateTo('/dashboard/settings/map')
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    title="地图服务尚未配置"
    :ui="{
      overlay: 'z-[80]',
      content: 'z-[80]',
      title: 'flex items-center gap-2',
      footer: 'justify-end',
    }"
  >
    <template #title>
      <Icon
        name="tabler:map-off"
        class="size-5 shrink-0 text-warning"
      />
      <span>地图服务尚未配置</span>
    </template>
    <template #body>
      <p class="text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
        此地图需要 MapTiler 或 Mapbox
        访问令牌才能加载。管理员可以在“地图和位置”设置中添加令牌。也可以使用自定义
        MapLibre 样式 URL 代替 MapTiler 令牌。
      </p>
    </template>
    <template #footer>
      <UButton
        color="neutral"
        variant="outline"
        @click="dismiss"
      >
        关闭
      </UButton>
      <UButton
        icon="tabler:settings"
        @click="openSettings"
      >
        打开地图设置
      </UButton>
    </template>
  </UModal>
</template>
