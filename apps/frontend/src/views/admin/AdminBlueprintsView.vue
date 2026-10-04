<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ApiService } from '../../services/api.js';
import { Layers, Upload, Plus, X } from 'lucide-vue-next';
import SkeletonTable from '../../components/ui/SkeletonTable.vue';
import ButtonSpinner from '../../components/ui/ButtonSpinner.vue';

const { t } = useI18n();

const blueprints = ref<any[]>([]);
const isLoading = ref(false);
const isImporting = ref(false);

const showImportModal = ref(false);
const eggJson = ref('');
const importError = ref('');

async function loadBlueprints() {
  isLoading.value = true;
  try {
    blueprints.value = await ApiService.get<any[]>('/admin/blueprints');
  } finally {
    isLoading.value = false;
  }
}

async function handleImportEgg() {
  importError.value = '';
  isImporting.value = true;
  try {
    const parsed = JSON.parse(eggJson.value);
    await ApiService.post('/admin/blueprints/import-egg', parsed);
    showImportModal.value = false;
    eggJson.value = '';
    await loadBlueprints();
  } catch (err: any) {
    importError.value = err.message || 'Invalid JSON syntax or egg structure';
  } finally {
    isImporting.value = false;
  }
}

onMounted(() => {
  loadBlueprints();
});
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-white">{{ t('admin.blueprints.title') }}</h1>
        <p class="text-xs text-slate-400 mt-1">{{ t('admin.blueprints.subtitle') }}</p>
      </div>

      <button
        @click="showImportModal = true"
        class="flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-dark text-slate-950 transition-all shadow-md active:scale-[0.98]"
      >
        <Upload class="w-4 h-4 mr-2" />
        {{ t('admin.blueprints.importEgg') }}
      </button>
    </div>

    <!-- Blueprints Table -->
    <div class="bg-surface-card border border-surface-border rounded-xl overflow-hidden shadow-xl">
      <SkeletonTable v-if="isLoading" :columns="5" :rows="5" />

      <table v-else class="w-full text-left text-xs">
        <thead class="bg-surface-deep text-slate-400 uppercase tracking-wider text-[10px] border-b border-surface-border">
          <tr>
            <th class="py-3 px-4">{{ t('servers.name') }}</th>
            <th class="py-3 px-4">Author</th>
            <th class="py-3 px-4">{{ t('admin.blueprints.dockerImage') }}</th>
            <th class="py-3 px-4">{{ t('nav.servers') }}</th>
            <th class="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-border/50 font-mono">
          <tr
            v-for="bp in blueprints"
            :key="bp.id"
            @click="$router.push(`/admin/blueprints/${bp.id}`)"
            class="hover:bg-surface-elevated/40 transition-colors cursor-pointer group"
          >
            <td class="py-3 px-4 font-semibold text-slate-200 flex items-center group-hover:text-primary transition-colors">
              <Layers class="w-4 h-4 text-primary mr-2 shrink-0" />
              <span>{{ bp.name }}</span>
            </td>
            <td class="py-3 px-4 text-slate-400 font-sans">{{ bp.author }}</td>
            <td class="py-3 px-4 text-slate-300 truncate max-w-xs">{{ bp.dockerImage }}</td>
            <td class="py-3 px-4 text-slate-400">{{ bp.serversCount || 0 }}</td>
            <td class="py-3 px-4 text-right" @click.stop>
              <router-link
                :to="`/admin/blueprints/${bp.id}`"
                class="inline-flex items-center px-2.5 py-1 text-[11px] font-sans font-medium rounded bg-surface-deep border border-surface-border text-slate-300 hover:text-white hover:bg-surface-elevated transition-colors"
              >
                Configure Studio
              </router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Import Egg Modal -->
    <div v-if="showImportModal" class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
      <div class="bg-surface-card border border-surface-border rounded-xl p-6 w-full max-w-2xl shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-surface-border">
          <h3 class="text-sm font-semibold text-white">{{ t('admin.blueprints.importEgg') }}</h3>
          <button @click="showImportModal = false" class="text-slate-400 hover:text-white transition-colors">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div v-if="importError" class="p-3 bg-status-offline/10 border border-status-offline/20 text-status-offline rounded-lg text-xs">
          {{ importError }}
        </div>

        <p class="text-xs text-slate-400">
          Paste the contents of any Pterodactyl egg file (<code>egg-*.json</code>). The engine will parse docker images, startup command, environment variables, and config matchers.
        </p>

        <textarea
          v-model="eggJson"
          rows="12"
          placeholder='{"meta": {"version": "PTDL_v1"}, "name": "Minecraft Paper", ...}'
          class="w-full bg-surface-deep border border-surface-border rounded-lg p-3 text-xs font-mono text-slate-200 outline-none focus:border-primary transition-colors"
        ></textarea>

        <div class="flex justify-end space-x-2 pt-3 border-t border-surface-border">
          <button @click="showImportModal = false" class="px-3.5 py-2 text-xs text-slate-300 hover:bg-surface-elevated rounded-lg transition-colors">
            {{ t('common.cancel') }}
          </button>
          <ButtonSpinner
            @click="handleImportEgg"
            :loading="isImporting"
            spinner-color="white"
            class="px-4 py-2 text-xs bg-primary hover:bg-primary-dark text-slate-950 font-semibold rounded-lg transition-colors shadow-md"
          >
            {{ t('common.create') }}
          </ButtonSpinner>
        </div>
      </div>
    </div>
  </div>
</template>
