<script lang="ts" setup>
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const settingsStore = useSettingsStore()

const appTitle = computed(() => {
  const value = settingsStore.getSetting('app:title')
  return value ? String(value) : '仪表板'
})

const navItems = computed<NavigationMenuItem[][]>(() => [
  [
    {
      label: '仪表板',
      icon: 'tabler:dashboard',
      to: '/dashboard',
    },
    {
      label: '照片库',
      icon: 'tabler:photo-cog',
      to: '/dashboard/photos',
    },
    {
      label: '相簿',
      icon: 'tabler:album',
      to: '/dashboard/albums',
    },
    {
      label: '队列管理',
      icon: 'tabler:list-check',
      to: '/dashboard/queue',
    },
    {
      label: '系统日志',
      icon: 'tabler:file-text',
      to: '/dashboard/logs',
    },
    {
      label: '站点设置',
      icon: 'tabler:settings',
      defaultOpen: route.path.startsWith('/dashboard/settings'),
      children: [
        {
          label: '基本设置',
          icon: 'tabler:settings-2',
          to: '/dashboard/settings/general',
        },
        {
          label: '存储设置',
          icon: 'tabler:database',
          to: '/dashboard/settings/storage',
        },
        {
          label: '地图和位置',
          icon: 'tabler:map-pin',
          to: '/dashboard/settings/map',
        },
        {
          label: '分析与追踪',
          icon: 'tabler:chart-bar',
          to: '/dashboard/settings/analytics',
        },
      ],
    },
  ],
  [
    {
      label: 'GitHub',
      icon: 'tabler:brand-github',
      to: 'https://github.com/handsondad/kid-growth-timeline',
      target: '_blank',
    },
    {
      label: '文档',
      icon: 'tabler:book',
      to: 'https://github.com/handsondad/kid-growth-timeline',
      target: '_blank',
    },
  ],
])

useHead({
  title: () => '仪表板',
  titleTemplate: (title) => `${title ? `${title} | ` : ''}${appTitle.value}`,
})
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar
      id="kid-growth-timeline-dashboard-sidebar"
      resizable
      collapsible
      mode="drawer"
      :min-size="8"
      :max-size="12"
      :ui="{ footer: 'border-t border-default' }"
      :toggle="{
        color: 'primary',
        variant: 'subtle',
        class: 'rounded-full',
      }"
    >
      <template #toggle>
        <UDashboardSidebarToggle variant="soft" />
      </template>

      <template #header="{ collapsed }">
        <div
          v-if="!collapsed"
          class="flex items-center gap-2"
        >
          <img
            src="/favicon.svg"
            class="h-8 w-auto shrink-0"
          />
          <div class="flex flex-col overflow-hidden">
            <NuxtLink
              to="/"
              class="text-lg font-medium line-clamp-1"
            >
              {{ appTitle }}
            </NuxtLink>
          </div>
        </div>
        <img
          v-else
          src="/favicon.svg"
          class="size-8 mx-auto"
        />
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="navItems[0]"
          orientation="vertical"
        />
        <UNavigationMenu
          :collapsed="collapsed"
          :items="navItems[1]"
          orientation="vertical"
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UButton
          to="/"
          icon="tabler:photo"
          :label="collapsed ? undefined : '查看画廊'"
          aria-label="查看画廊"
          size="lg"
          color="neutral"
          variant="ghost"
          class="w-full"
          :block="collapsed"
        />
      </template>
    </UDashboardSidebar>

    <NuxtPage />
  </UDashboardGroup>
</template>

<style scoped></style>
