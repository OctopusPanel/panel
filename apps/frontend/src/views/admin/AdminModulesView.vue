<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useModuleStore } from '../../stores/modules.js';
import { Boxes, CheckCircle2, XCircle } from 'lucide-vue-next';

const { t } = useI18n();
const moduleStore = useModuleStore();

onMounted(() => {
  moduleStore.fetchModules();
});

async function toggle(mod: any) {
  await moduleStore.toggleModule(mod.id, !mod.isEnabled);
}
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-white">{{ t('admin.modules.title') }}</h1>
        <p class="text-xs text-slate-400 mt-1">{{ t('admin.modules.subtitle') }}</p>
      </div>
    </div>

    <!-- Modules Grid / Table -->
    <div class="bg-surface-card border border-surface-border rounded-xl overflow-hidden shadow-xl">
      <div v-if="moduleStore.isLoading" class="p-8 text-center text-xs font-mono text-slate-400">
        {{ t('common.loading') }}
      </div>

      <div v-else-if="moduleStore.installedModules.length === 0" class="p-12 text-center text-xs text-slate-400">
        No third-party or official modules currently registered in <code>modules/</code>.
      </div>

      <table v-else class="w-full text-left text-xs font-mono">
        <thead class="bg-surface-deep text-slate-400 uppercase tracking-wider text-[10px] border-b border-surface-border">
          <tr>
            <th class="py-3 px-4">Module Name</th>
            <th class="py-3 px-4">{{ t('admin.modules.version') }}</th>
            <th class="py-3 px-4">Author</th>
            <th class="py-3 px-4">UI Slots</th>
            <th class="py-3 px-4">Compute Drivers</th>
            <th class="py-3 px-4">{{ t('common.status') }}</th>
            <th class="py-3 px-4 text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-border/50">
          <tr v-for="mod in moduleStore.installedModules" :key="mod.id" class="hover:bg-surface-elevated/40 transition-colors">
            <td class="py-3 px-4 font-semibold text-slate-200 flex items-center font-sans">
              <Boxes class="w-4 h-4 text-primary mr-2" />
              {{ mod.name }}
            </td>
            <td class="py-3 px-4 text-slate-400">{{ mod.version }}</td>
            <td class="py-3 px-4 text-slate-400 font-sans">{{ mod.author }}</td>
            <td class="py-3 px-4 text-slate-300">{{ mod.slotsCount || 0 }} slots</td>
            <td class="py-3 px-4 text-slate-300">{{ mod.driversCount || 0 }} drivers</td>
            <td class="py-3 px-4">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border"
                :class="mod.isEnabled ? 'bg-status-online/15 text-status-online border-status-online/30' : 'bg-surface-deep text-slate-400 border-surface-border'"
              >
                <CheckCircle2 v-if="mod.isEnabled" class="w-3 h-3 mr-1 text-status-online" />
                <XCircle v-else class="w-3 h-3 mr-1 text-slate-400" />
                {{ mod.isEnabled ? t('admin.modules.enabled') : t('admin.modules.disabled') }}
              </span>
            </td>
            <td class="py-3 px-4 text-right">
              <button
                @click="toggle(mod)"
                class="px-2.5 py-1 text-[11px] rounded font-medium transition-colors"
                :class="mod.isEnabled ? 'bg-status-offline/10 text-status-offline border border-status-offline/25 hover:bg-status-offline/20' : 'bg-status-online/10 text-status-online border border-status-online/25 hover:bg-status-online/20'"
              >
                {{ mod.isEnabled ? t('admin.modules.disable') : t('admin.modules.enable') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
