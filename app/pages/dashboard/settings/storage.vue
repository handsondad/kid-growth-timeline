<script lang="ts" setup>
import { UChip, UButton } from '#components'
import type { TableColumn } from '@nuxt/ui'
import {
  s3StorageConfigSchema,
  localStorageConfigSchema,
  openListStorageConfigSchema,
  type StorageConfig,
} from '~~/shared/types/storage'

definePageMeta({
  layout: 'dashboard',
})

useHead({
  title: () => '存储设置',
})

const toast = useToast()

const { data: currentStorageProvider, refresh: refreshCurrentStorageProvider } =
  await useFetch<{
    namespace: string
    key: string
    value: SettingValue
  }>('/api/system/settings/storage/provider')

const {
  data: availableStorage,
  refresh: refreshAvailableStorage,
  status: availableStorageStatus,
} = await useFetch<SettingStorageProvider[]>(
  '/api/system/settings/storage-config',
)

const PROVIDER_ICON = {
  s3: 'tabler:brand-aws',
  local: 'tabler:database',
  openlist: 'tabler:cloud',
}

const availableStorageColumns = computed<TableColumn<SettingStorageProvider>[]>(
  () => [
    {
      accessorKey: 'status',
      header: '',
      meta: {
        class: {
          th: 'w-10',
        },
      },
      cell: (cell) => {
        const isActive =
          currentStorageProvider.value?.value === cell.row.original.id
        return h(UChip, {
          size: 'md',
          inset: true,
          standalone: true,
          color: isActive ? 'success' : undefined,
          ui: {
            base: !isActive ? 'bg-neutral-200 dark:bg-neutral-700' : '',
          },
        })
      },
    },
    { accessorKey: 'name', header: '存储名称' },
    {
      accessorKey: 'provider',
      header: '存储类型',
    },
    {
      accessorKey: 'actions',
      header: '操作',
      cell: (cell) => {
        return h('div', { class: 'flex items-center gap-2' }, [
          h(
            UButton,
            {
              size: 'sm',
              variant: 'soft',
              color: 'error',
              icon: 'tabler:trash',
              disabled:
                currentStorageProvider.value?.value === cell.row.original.id,
              onClick: () => openStorageDeleteConfirm(cell.row.original),
            },
            { default: () => '删除' },
          ),
        ])
      },
    },
  ],
)

const storageSettingsState = reactive<{
  storageConfigId?: number
}>({
  storageConfigId: currentStorageProvider.value
    ? (currentStorageProvider.value.value as number)
    : undefined,
})

const isStorageDefaultDirty = computed(() => {
  return (
    storageSettingsState.storageConfigId !== currentStorageProvider.value?.value
  )
})

const resetStorageDefault = () => {
  storageSettingsState.storageConfigId = currentStorageProvider.value
    ? (currentStorageProvider.value.value as number)
    : undefined
}

const handleStorageSettingsSubmit = async (close?: () => void) => {
  try {
    await $fetch('/api/system/settings/storage/provider', {
      method: 'PUT',
      body: {
        value: storageSettingsState.storageConfigId,
      },
    })
    refreshCurrentStorageProvider()
    close?.()
    toast.add({
      title: '设置已保存',
      color: 'success',
    })
  } catch (error) {
    toast.add({
      title: '保存设置时出错',
      description: (error as Error).message,
      color: 'error',
    })
  }
}

const providerOptions = computed(() => [
  {
    label: 'AWS S3 兼容存储',
    value: 's3',
    icon: PROVIDER_ICON.s3,
  },
  {
    label: '本地存储',
    value: 'local',
    icon: PROVIDER_ICON.local,
  },
  {
    label: 'OpenList',
    value: 'openlist',
    icon: PROVIDER_ICON.openlist,
  },
])

const storageConfigState = reactive<{
  name: string
  provider: string
  config: Partial<StorageConfig>
}>({
  name: '',
  provider: 's3',
  config: {
    provider: 's3',
    region: 'auto',
    prefix: '/photos',
  } as any,
})

// 根据 provider 值动态选择对应的 schema
const currentStorageSchema = computed(() => {
  const provider = storageConfigState.provider
  switch (provider) {
    case 'local':
      return localStorageConfigSchema
    case 'openlist':
      return openListStorageConfigSchema
    case 's3':
    default:
      return s3StorageConfigSchema
  }
})

// 获取存储配置的默认值
const getStorageConfigDefaults = (provider: string): Partial<StorageConfig> => {
  switch (provider) {
    case 'local':
      return {
        provider: 'local',
        basePath: '/data/storage',
        baseUrl: '/storage',
      } as any
    case 'openlist':
      return {
        provider: 'openlist',
        uploadEndpoint: '/api/fs/put',
        deleteEndpoint: '/api/fs/remove',
        metaEndpoint: '/api/fs/get',
        pathField: 'path',
      } as any
    case 's3':
    default:
      return {
        provider: 's3',
        region: 'auto',
        prefix: '/photos',
      } as any
  }
}

// 按存储提供商显示对应字段
const storageFieldsConfig = computed<Record<string, any>>(() => {
  const provider = storageConfigState.provider

  switch (provider) {
    case 'local':
      return {
        provider: { hidden: true },
        basePath: {
          label: '存储基础路径',
          description: '用于存储照片的本地文件系统路径',
        },
        baseUrl: {
          label: '基础 URL',
          description: '用于访问存储照片的公开 URL 基础',
        },
        prefix: {
          label: '存储前缀',
          description: '用于在存储中组织照片的前缀路径',
        },
      }
    case 'openlist':
      return {
        provider: { hidden: true },
        baseUrl: {
          label: 'OpenList 基础 URL',
          description: 'OpenList 服务器的基础 URL',
        },
        rootPath: {
          label: '根路径',
          description: '在 OpenList 中存储照片的根路径',
        },
        token: {
          label: '身份验证令牌',
          description: 'OpenList API 身份验证令牌',
        },
        uploadEndpoint: {
          label: '上传端点',
          description: '用于上传文件的 API 端点（默认：/api/fs/put）',
        },
        downloadEndpoint: {
          label: '下载端点',
          description: '用于下载文件的 API 端点（可选）',
        },
        listEndpoint: {
          label: '列表端点',
          description: '用于列出文件的 API 端点（可选）',
        },
        deleteEndpoint: {
          label: '删除端点',
          description: '用于删除文件的 API 端点（默认：/api/fs/remove）',
        },
        metaEndpoint: {
          label: '元数据端点',
          description: '用于检索文件元数据的 API 端点（默认：/api/fs/get）',
        },
        pathField: {
          label: '路径字段名称',
          description: 'API 请求中文件路径的参数名称（默认：path）',
        },
        cdnUrl: {
          label: 'CDN URL',
          description: '用于访问图像的自定义 CDN URL',
        },
      }
    case 's3':
    default:
      return {
        provider: { hidden: true },
        bucket: {
          label: '存储桶名称',
          description: '用于存储照片的 S3 存储桶名称',
        },
        region: {
          label: '区域',
          description: 'S3 存储桶所在的 AWS 区域',
        },
        endpoint: {
          label: 'S3 端点',
          description: '自定义 S3 兼容端点 URL（例如 MinIO）',
        },
        prefix: {
          label: '存储前缀',
          description: '存储桶中对象的前缀路径',
        },
        cdnUrl: {
          label: 'CDN URL',
          description: '用于访问图像的自定义 CDN URL',
        },
        accessKeyId: {
          label: '访问密钥 ID',
          description: 'AWS 访问密钥 ID 或等效项',
        },
        secretAccessKey: {
          label: '秘密访问密钥',
          description: 'AWS 秘密访问密钥或等效项',
        },
        forcePathStyle: {
          label: '强制路径风格',
          description: '使用路径风格 URL 而不是虚拟主机风格',
        },
        maxKeys: {
          label: '最大密钥数',
          description: '每个请求检索的最大密钥数',
        },
      }
  }
})

const onStorageConfigSubmit = async (
  event: { data: Partial<StorageConfig> },
  close?: () => void,
) => {
  try {
    const payload = {
      name: storageConfigState.name,
      provider: storageConfigState.provider,
      config: event.data,
    }

    await $fetch('/api/system/settings/storage-config', {
      method: 'POST',
      body: payload,
    })
    refreshAvailableStorage()
    toast.add({
      title: '存储方案已创建',
      color: 'success',
    })
    // 重置表单
    storageConfigState.name = ''
    storageConfigState.provider = 's3'
    storageConfigState.config = getStorageConfigDefaults('s3')
    close?.()
  } catch (error) {
    toast.add({
      title: '创建存储方案时出错',
      description: (error as Error).message,
      color: 'error',
    })
  }
}

const isDeleteConfirmOpen = ref(false)
const isDeletingStorage = ref(false)
const storagePendingDelete = ref<SettingStorageProvider | null>(null)

const openStorageDeleteConfirm = (storage: SettingStorageProvider) => {
  storagePendingDelete.value = storage
  isDeleteConfirmOpen.value = true
}

const confirmStorageDelete = async () => {
  const storageId = storagePendingDelete.value?.id
  if (storageId == null || isDeletingStorage.value) return

  isDeletingStorage.value = true
  try {
    await $fetch(`/api/system/settings/storage-config/${storageId}`, {
      method: 'DELETE',
    })
    await refreshAvailableStorage()
    isDeleteConfirmOpen.value = false
    storagePendingDelete.value = null
    toast.add({
      title: '存储方案已删除',
      color: 'success',
    })
  } catch (error) {
    toast.add({
      title: '删除存储方案失败',
      description: (error as Error).message,
      color: 'error',
    })
  } finally {
    isDeletingStorage.value = false
  }
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="存储设置" />
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-5xl space-y-6">
        <section
          class="space-y-2 border-b border-neutral-200 pb-4 dark:border-neutral-800"
        >
          <h2
            class="text-xl font-semibold text-neutral-900 dark:text-neutral-100"
          >
            存储设置
          </h2>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            管理默认存储方案与可用存储提供者。此页面的设置仅影响后续上传文件。
          </p>
        </section>

        <section
          class="rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
        >
          <header
            class="border-b border-neutral-200 px-5 py-4 dark:border-neutral-800"
          >
            <h3
              class="text-base font-semibold text-neutral-900 dark:text-neutral-100"
            >
              当前默认存储
            </h3>
          </header>

          <div
            v-if="availableStorageStatus !== 'success' && !availableStorage"
            class="space-y-4 px-5 py-5"
          >
            <USkeleton class="h-4 w-32" />
            <USkeleton class="h-10 w-72" />
          </div>

          <div
            v-else
            class="space-y-4 px-5 py-5"
          >
            <UFormField
              name="storageConfigId"
              label="存储方案"
              required
              :ui="{
                container: 'w-full sm:max-w-sm *:w-full',
              }"
            >
              <USelectMenu
                v-model="storageSettingsState.storageConfigId"
                :icon="
                  PROVIDER_ICON[
                    availableStorage?.find(
                      (item) =>
                        item.id === storageSettingsState.storageConfigId,
                    )?.provider || 'local'
                  ] || 'tabler:database'
                "
                :items="
                  availableStorage?.map((item) => ({
                    icon: PROVIDER_ICON[item.provider] || 'tabler:database',
                    label: item.name,
                    value: item.id,
                  }))
                "
                label-key="label"
                value-key="value"
                placeholder="选择存储方案"
              />
            </UFormField>
          </div>

          <footer
            class="border-t border-neutral-200 px-5 py-4 dark:border-neutral-800"
          >
            <div
              v-if="isStorageDefaultDirty"
              class="mb-3 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-800 dark:border-warning-900/60 dark:bg-warning-950/30 dark:text-warning-200"
            >
              存在未保存的更改。
            </div>

            <div class="flex items-center justify-end gap-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="!isStorageDefaultDirty"
                @click="resetStorageDefault"
              >
                重置
              </UButton>
              <UModal
                title="变更存储方案"
                :ui="{ footer: 'justify-end' }"
              >
                <UButton
                  :disabled="!isStorageDefaultDirty"
                  icon="tabler:device-floppy"
                >
                  保存设置
                </UButton>

                <template #body>
                  <UAlert
                    color="neutral"
                    variant="subtle"
                    title="注意"
                    description="变更存储方案之后上传的文件将会存储到新的存储方案中，原方案中已有文件不会被迁移。"
                    icon="tabler:arrows-exchange"
                  />
                </template>

                <template #footer="{ close }">
                  <UButton
                    label="取消"
                    color="neutral"
                    variant="outline"
                    @click="close"
                  />
                  <UButton
                    label="继续"
                    variant="soft"
                    icon="tabler:arrows-exchange"
                    type="submit"
                    form="storageSettingsForm"
                    @click="handleStorageSettingsSubmit(close)"
                  />
                </template>
              </UModal>
            </div>
          </footer>
        </section>

        <section
          class="rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
        >
          <header
            class="flex w-full items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800"
          >
            <h3
              class="text-base font-semibold text-neutral-900 dark:text-neutral-100"
            >
              存储方案管理
            </h3>
            <div>
              <USlideover
                title="创建存储方案"
                :ui="{ footer: 'justify-end' }"
              >
                <UButton
                  size="sm"
                  variant="soft"
                  icon="tabler:plus"
                >
                  添加存储
                </UButton>

                <template #body="{ close }">
                  <div class="space-y-4">
                    <!-- Provider 选择 -->
                    <UFormField
                      label="存储类型"
                      class="w-full"
                      required
                      :ui="{
                        container: 'sm:max-w-full',
                      }"
                    >
                      <USelectMenu
                        v-model="storageConfigState.provider"
                        :icon="
                          PROVIDER_ICON[
                            storageConfigState.provider as keyof typeof PROVIDER_ICON
                          ] || 'tabler:database'
                        "
                        :items="providerOptions"
                        label-key="label"
                        value-key="value"
                        placeholder="选择存储类型"
                        @update:model-value="
                          (val: string) => {
                            storageConfigState.provider = val
                            storageConfigState.config =
                              getStorageConfigDefaults(val)
                          }
                        "
                      />
                    </UFormField>

                    <UFormField
                      label="存储名称"
                      required
                      :ui="{
                        container: 'sm:max-w-full',
                      }"
                    >
                      <UInput v-model="storageConfigState.name" />
                    </UFormField>

                    <USeparator />

                    <AutoForm
                      id="createStorageForm"
                      :schema="currentStorageSchema"
                      :state="storageConfigState.config"
                      :fields-config="storageFieldsConfig"
                      @submit="onStorageConfigSubmit($event, close)"
                    />
                  </div>
                </template>

                <template #footer="{ close }">
                  <UButton
                    label="取消"
                    color="neutral"
                    variant="outline"
                    @click="close"
                  />
                  <UButton
                    label="创建存储"
                    variant="soft"
                    icon="tabler:check"
                    type="submit"
                    form="createStorageForm"
                  />
                </template>
              </USlideover>
            </div>
          </header>

          <div
            v-if="availableStorageStatus !== 'success' && !availableStorage"
            class="space-y-3 px-5 py-5"
          >
            <USkeleton class="h-10 w-full" />
            <USkeleton class="h-10 w-full" />
            <USkeleton class="h-10 w-full" />
          </div>

          <div
            v-else
            class="px-0 py-0"
          >
            <UTable
              :columns="availableStorageColumns"
              :data="availableStorage"
            />
          </div>
        </section>
      </div>

      <UModal
        v-model:open="isDeleteConfirmOpen"
        title="删除存储方案"
        :ui="{
          title: 'flex items-center gap-2',
          footer: 'justify-end',
        }"
      >
        <template #title>
          <Icon
            name="tabler:trash"
            class="size-5 shrink-0 text-error"
          />
          <span>删除存储方案</span>
        </template>
        <template #body>
          <p
            class="text-sm leading-relaxed text-neutral-500 dark:text-neutral-400"
          >
            {{
              `确定要删除“${storagePendingDelete?.name}”吗？这将从 成长时光轴 中移除该方案。已使用该方案存储的文件不会被删除。`
            }}
          </p>
        </template>
        <template #footer>
          <div class="flex w-full justify-end gap-3">
            <UButton
              variant="ghost"
              color="neutral"
              :disabled="isDeletingStorage"
              @click="isDeleteConfirmOpen = false"
            >
              取消
            </UButton>
            <UButton
              color="error"
              icon="tabler:trash"
              :loading="isDeletingStorage"
              @click="confirmStorageDelete"
            >
              删除
            </UButton>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>

<style scoped></style>
