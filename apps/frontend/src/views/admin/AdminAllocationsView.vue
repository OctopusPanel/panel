<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ApiService } from '../../services/api.js';
import { Network, Plus, Trash2, X } from 'lucide-vue-next';

const { t } = useI18n();

const allocations = ref<any[]>([]);
const nodes = ref<any[]>([]);
const isLoading = ref(false);

const showRangeModal = ref(false);
const rangeForm = ref({
  nodeId: 1,
  ipAddress: '127.0.0.1',
  startPort: 25565,
  endPort: 25575,
  alias: '',
});

async function loadData() {
  isLoading.value = true;
  try {
    const [allocsData, nodesData] = await Promise.all([
      ApiService.get<any[]>('/admin/allocations'),
      ApiService.get<any[]>('/admin/nodes'),
    ]);
    allocations.value = allocsData;
    nodes.value = nodesData;
    if (nodesData.length > 0) {
      rangeForm.value.nodeId = nodesData[0].id;
    }
  } finally {
    isLoading.value = false;
  }
}

async function createRange() {
  try {
    await ApiService.post('/admin/allocations/range', rangeForm.value);
    showRangeModal.value = false;
    loadData();
  } catch (err) {
    console.error('Failed to create range:', err);
  }
}

async function deleteAlloc(id: number) {
  if (!confirm('Are you sure you want to delete this allocation?')) return;
  try {
    await ApiService.delete(`/admin/allocations/${id}`);
    loadData();
  } catch (err) {
    console.error('Failed to delete allocation:', err);
  }
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-white">{{ t('admin.allocations.title') }}</h1>
        <p class="text-xs text-slate-400 mt-1">{{ t('admin.allocations.subtitle') }}</p>
      </div>

      <button
        @click="showRangeModal = true"
        class="flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
      >
        <Plus class="w-4 h-4 mr-2" />
        {{ t('admin.allocations.createRange') }}
      </button>
    </div>

    <!-- Table -->
    <div class="bg-[#111622] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div v-if="isLoading" class="p-8 text-center text-xs font-mono text-slate-500">
        {{ t('common.loading') }}
      </div>

      <table v-else class="w-full text-left text-xs font-mono">
        <thead class="bg-[#0b0f17] text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
          <tr>
            <th class="py-3 px-4">{{ t('admin.allocations.ipAddress') }}</th>
            <th class="py-3 px-4">{{ t('servers.port') }}</th>
            <th class="py-3 px-4">{{ t('servers.node') }}</th>
            <th class="py-3 px-4">{{ t('admin.allocations.assigned') }}</th>
            <th class="py-3 px-4 text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60">
          <tr v-for="alloc in allocations" :key="alloc.id" class="hover:bg-slate-800/30 transition-colors">
            <td class="py-3 px-4 text-slate-200 flex items-center">
              <Network class="w-4 h-4 text-amber-400 mr-2" />
              {{ alloc.ipAddress }}
            </td>
            <td class="py-3 px-4 text-slate-300 font-semibold">{{ alloc.port }}</td>
            <td class="py-3 px-4 text-slate-400">{{ alloc.node?.name }}</td>
            <td class="py-3 px-4">
              <span
                class="px-2 py-0.5 rounded text-[10px]"
                :class="alloc.serverId ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-slate-700/40 text-slate-400'"
              >
                {{ alloc.server?.name || 'Unassigned' }}
              </span>
            </td>
            <td class="py-3 px-4 text-right">
              <button
                v-if="!alloc.serverId"
                @click="deleteAlloc(alloc.id)"
                class="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Range Modal -->
    <div v-if="showRangeModal" class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div class="bg-[#161b22] border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 class="text-sm font-semibold text-white">{{ t('admin.allocations.createRange') }}</h3>
          <button @click="showRangeModal = false" class="text-slate-400 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1">Target Node</label>
            <select v-model="rangeForm.nodeId" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none">
              <option v-for="node in nodes" :key="node.id" :value="node.id">{{ node.name }} ({{ node.fqdn }})</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-400 mb-1">{{ t('admin.allocations.ipAddress') }}</label>
            <input v-model="rangeForm.ipAddress" type="text" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-400 mb-1">{{ t('admin.allocations.startPort') }}</label>
              <input v-model.number="rangeForm.startPort" type="number" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none" />
            </div>
            <div>
              <label class="block text-slate-400 mb-1">{{ t('admin.allocations.endPort') }}</label>
              <input v-model.number="rangeForm.endPort" type="number" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none" />
            </div>
          </div>
        </div>

        <div class="flex justify-end space-x-2 pt-3 border-t border-slate-800">
          <button @click="showRangeModal = false" class="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg">
            {{ t('common.cancel') }}
          </button>
          <button @click="createRange" class="px-3.5 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg">
            {{ t('common.create') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
