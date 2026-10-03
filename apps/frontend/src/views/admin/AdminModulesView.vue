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
    <div class="bg-[#111622] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div v-if="moduleStore.isLoading" class="p-8 text-center text-xs font-mono text-slate-500">
        {{ t('common.loading') }}
      </div>

      <div v-else-if="moduleStore.installedModules.length === 0" class="p-12 text-center text-xs text-slate-500">
        No third-party or official modules currently registered in <code>modules/</code>.
      </div>

      <table v-else class="w-full text-left text-xs font-mono">
        <thead class="bg-[#0b0f17] text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
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
        <tbody class="divide-y divide-slate-800/60">
          <tr v-for="mod in moduleStore.installedModules" :key="mod.id" class="hover:bg-slate-800/30 transition-colors">
            <td class="py-3 px-4 font-semibold text-slate-200 flex items-center">
              <Boxes class="w-4 h-4 text-amber-400 mr-2" />
              {{ mod.name }}
            </td>
            <td class="py-3 px-4 text-slate-400">{{ mod.version }}</td>
            <td class="py-3 px-4 text-slate-400">{{ mod.author }}</td>
            <td class="py-3 px-4 text-slate-300">{{ mod.slotsCount || 0 }} slots</td>
            <td class="py-3 px-4 text-slate-300">{{ mod.driversCount || 0 }} drivers</td>
            <td class="py-3 px-4">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-[10px]"
                :class="mod.isEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-700/40 text-slate-400'"
              >
                <CheckCircle2 v-if="mod.isEnabled" class="w-3 h-3 mr-1 text-emerald-400" />
                <XCircle v-else class="w-3 h-3 mr-1 text-slate-400" />
                {{ mod.isEnabled ? t('admin.modules.enabled') : t('admin.modules.disabled') }}
              </span>
            </td>
            <td class="py-3 px-4 text-right">
              <button
                @click="toggle(mod)"
                class="px-2.5 py-1 text-[11px] rounded font-medium transition-colors"
                :class="mod.isEnabled ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'"
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
