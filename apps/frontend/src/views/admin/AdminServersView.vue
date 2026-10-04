<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
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
  dockerImage: '',
  environment: {} as Record<string, string>,
  memory: 2048,
  cpu: 100,
  disk: 10240,
});

const selectedBlueprint = computed(() => {
  return blueprints.value.find((b) => b.id === serverForm.value.blueprintId);
});

const availableImages = computed(() => {
  const bp = selectedBlueprint.value;
  if (!bp) return [];
  if (bp.dockerImages && typeof bp.dockerImages === 'object') {
    if (Array.isArray(bp.dockerImages)) {
      return bp.dockerImages.map((img: string, i: number) => ({
        label: `Image ${i + 1}`,
        value: img,
      }));
    }
    return Object.entries(bp.dockerImages).map(([label, value]) => ({
      label,
      value: String(value),
    }));
  }
  if (bp.dockerImage) {
    return [{ label: 'Default', value: bp.dockerImage }];
  }
  return [];
});

watch(
  () => serverForm.value.blueprintId,
  () => {
    const bp = selectedBlueprint.value;
    if (!bp) return;

    const imgs = availableImages.value;
    if (imgs.length > 0) {
      serverForm.value.dockerImage = imgs[0].value;
    } else {
      serverForm.value.dockerImage = bp.dockerImage || '';
    }

    const env: Record<string, string> = {};
    if (Array.isArray(bp.variables)) {
      for (const v of bp.variables) {
        const key = v.envVariable || v.env_variable;
        if (key) {
          env[key] = String(v.defaultValue ?? v.default_value ?? '');
        }
      }
    }
    serverForm.value.environment = env;
  },
  { immediate: true },
);

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
    if (bps.length > 0) {
      serverForm.value.blueprintId = bps[0].id;
    }
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
      <div class="bg-[#161b22] border border-slate-800 rounded-xl p-6 w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800 flex-shrink-0">
          <div>
            <h3 class="text-sm font-semibold text-white">Deploy New Server</h3>
            <p class="text-[11px] text-slate-400">Configure resources, runtime image, and egg variables.</p>
          </div>
          <button @click="showCreateModal = false" class="text-slate-400 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-4 text-xs overflow-y-auto py-3 pr-1 flex-1">
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

          <!-- Docker Image / Version Selection -->
          <div>
            <label class="block text-slate-400 mb-1">Docker Image / Runtime Version</label>
            <select
              v-if="availableImages.length > 0"
              v-model="serverForm.dockerImage"
              class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none font-mono"
            >
              <option v-for="img in availableImages" :key="img.value" :value="img.value">
                {{ img.label }} ({{ img.value }})
              </option>
            </select>
            <input
              v-else
              v-model="serverForm.dockerImage"
              type="text"
              placeholder="e.g. ghcr.io/pterodactyl/yolks:java_21"
              class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none font-mono"
            />
          </div>

          <!-- Resource Allocations -->
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-slate-400 mb-1">Memory (MB)</label>
              <input v-model.number="serverForm.memory" type="number" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none font-mono" />
            </div>
            <div>
              <label class="block text-slate-400 mb-1">CPU (%)</label>
              <input v-model.number="serverForm.cpu" type="number" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none font-mono" />
            </div>
            <div>
              <label class="block text-slate-400 mb-1">Disk (MB)</label>
              <input v-model.number="serverForm.disk" type="number" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none font-mono" />
            </div>
          </div>

          <!-- Blueprint / Egg Variables -->
          <div v-if="selectedBlueprint?.variables && selectedBlueprint.variables.length > 0" class="space-y-3 pt-3 border-t border-slate-800">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-semibold text-slate-300 uppercase tracking-wider">Egg Variables</h4>
              <span class="text-[10px] text-slate-500 font-mono">{{ selectedBlueprint.variables.length }} options</span>
            </div>

            <div
              v-for="v in selectedBlueprint.variables"
              :key="v.envVariable || v.env_variable"
              class="bg-[#0d1117]/80 border border-slate-800/80 rounded-lg p-3 space-y-1.5"
            >
              <div class="flex items-center justify-between">
                <label class="text-slate-300 font-medium">{{ v.name || v.envVariable || v.env_variable }}</label>
                <span class="text-[10px] text-amber-500/80 font-mono">{{ v.envVariable || v.env_variable }}</span>
              </div>
              <p v-if="v.description" class="text-[11px] text-slate-400 leading-tight">{{ v.description }}</p>
              <input
                v-model="serverForm.environment[v.envVariable || v.env_variable]"
                type="text"
                :placeholder="String(v.defaultValue ?? v.default_value ?? '')"
                class="w-full bg-[#161b22] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none font-mono text-xs focus:border-amber-500 transition-colors"
              />
            </div>
          </div>
        </div>

        <div class="flex justify-end space-x-2 pt-3 border-t border-slate-800 flex-shrink-0">
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
