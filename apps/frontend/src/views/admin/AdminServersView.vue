<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ApiService } from '../../services/api.js';
import { Server, Plus, Trash2, Ban, Play, X } from 'lucide-vue-next';

const { t } = useI18n();

const allServers = ref<any[]>([]);
const users = ref<any[]>([]);
const nodes = ref<any[]>([]);
const blueprints = ref<any[]>([]);
const isLoading = ref(false);

const showCreateModal = ref(false);
const serverForm = ref({
  name: '',
  userId: 1,
  nodeId: 1,
  blueprintId: 1,
  memory: 1024,
  cpu: 100,
  disk: 10240,
});

async function loadData() {
  isLoading.value = true;
  try {
    const [srvs, usrs, nds, bps] = await Promise.all([
      ApiService.get<any[]>('/admin/servers'),
      ApiService.get<any[]>('/admin/users'),
      ApiService.get<any[]>('/admin/nodes'),
      ApiService.get<any[]>('/admin/blueprints'),
    ]);
    allServers.value = srvs;
    users.value = usrs;
    nodes.value = nds;
    blueprints.value = bps;
    if (usrs.length > 0) serverForm.value.userId = usrs[0].id;
    if (nds.length > 0) serverForm.value.nodeId = nds[0].id;
    if (bps.length > 0) serverForm.value.blueprintId = bps[0].id;
  } finally {
    isLoading.value = false;
  }
}

async function createServer() {
  try {
    await ApiService.post('/admin/servers', serverForm.value);
    showCreateModal.value = false;
    loadData();
  } catch (err) {
    console.error('Failed to provision server:', err);
  }
}

async function toggleSuspend(server: any) {
  const endpoint = server.isSuspended ? `/admin/servers/${server.id}/unsuspend` : `/admin/servers/${server.id}/suspend`;
  await ApiService.post(endpoint);
  loadData();
}

async function deleteServer(id: number) {
  if (!confirm('Are you sure you want to permanently delete this server and container?')) return;
  await ApiService.delete(`/admin/servers/${id}`);
  loadData();
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-white">{{ t('nav.servers') }}</h1>
        <p class="text-xs text-slate-400 mt-1">Manage and orchestrate all deployed server instances across your fleet.</p>
      </div>

      <button
        @click="showCreateModal = true"
        class="flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
      >
        <Plus class="w-4 h-4 mr-2" />
        New Server
      </button>
    </div>

    <!-- Servers Table -->
    <div class="bg-[#111622] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div v-if="isLoading" class="p-8 text-center text-xs font-mono text-slate-500">
        {{ t('common.loading') }}
      </div>

      <table v-else class="w-full text-left text-xs font-mono">
        <thead class="bg-[#0b0f17] text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
          <tr>
            <th class="py-3 px-4">{{ t('servers.name') }}</th>
            <th class="py-3 px-4">Owner</th>
            <th class="py-3 px-4">{{ t('servers.node') }}</th>
            <th class="py-3 px-4">Blueprint</th>
            <th class="py-3 px-4">{{ t('servers.memory') }}</th>
            <th class="py-3 px-4">{{ t('servers.status') }}</th>
            <th class="py-3 px-4 text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60">
          <tr v-for="srv in allServers" :key="srv.id" class="hover:bg-slate-800/30 transition-colors">
            <td class="py-3 px-4 font-semibold text-slate-200 flex items-center">
              <Server class="w-4 h-4 text-blue-400 mr-2" />
              {{ srv.name }}
            </td>
            <td class="py-3 px-4 text-slate-300">{{ srv.user?.username }}</td>
            <td class="py-3 px-4 text-slate-400">{{ srv.node?.name }}</td>
            <td class="py-3 px-4 text-slate-400">{{ srv.blueprint?.name }}</td>
            <td class="py-3 px-4 text-slate-300">{{ srv.memory }} MB</td>
            <td class="py-3 px-4">
              <span
                class="px-2 py-0.5 rounded text-[10px]"
                :class="srv.isSuspended ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-700/40 text-slate-300'"
              >
                {{ srv.isSuspended ? 'Suspended' : srv.status }}
              </span>
            </td>
            <td class="py-3 px-4 text-right space-x-2">
              <button
                @click="toggleSuspend(srv)"
                class="p-1 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800 transition-colors"
                :title="srv.isSuspended ? 'Unsuspend' : 'Suspend'"
              >
                <Play v-if="srv.isSuspended" class="w-3.5 h-3.5" />
                <Ban v-else class="w-3.5 h-3.5" />
              </button>
              <button
                @click="deleteServer(srv.id)"
                class="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create Server Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div class="bg-[#161b22] border border-slate-800 rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 class="text-sm font-semibold text-white">Deploy New Server</h3>
          <button @click="showCreateModal = false" class="text-slate-400 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1">Server Name</label>
            <input v-model="serverForm.name" type="text" placeholder="My Awesome Server" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-400 mb-1">Owner User</label>
              <select v-model="serverForm.userId" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none">
                <option v-for="u in users" :key="u.id" :value="u.id">{{ u.username }} ({{ u.email }})</option>
              </select>
            </div>
            <div>
              <label class="block text-slate-400 mb-1">Target Node</label>
              <select v-model="serverForm.nodeId" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none">
                <option v-for="n in nodes" :key="n.id" :value="n.id">{{ n.name }}</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">Blueprint (Egg)</label>
            <select v-model="serverForm.blueprintId" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none">
              <option v-for="b in blueprints" :key="b.id" :value="b.id">{{ b.name }} ({{ b.author }})</option>
            </select>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-slate-400 mb-1">Memory (MB)</label>
              <input v-model.number="serverForm.memory" type="number" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none" />
            </div>
            <div>
              <label class="block text-slate-400 mb-1">CPU (%)</label>
              <input v-model.number="serverForm.cpu" type="number" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none" />
            </div>
            <div>
              <label class="block text-slate-400 mb-1">Disk (MB)</label>
              <input v-model.number="serverForm.disk" type="number" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none" />
            </div>
          </div>
        </div>

        <div class="flex justify-end space-x-2 pt-3 border-t border-slate-800">
          <button @click="showCreateModal = false" class="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg">
            {{ t('common.cancel') }}
          </button>
          <button @click="createServer" class="px-3.5 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg">
            Deploy Server
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
