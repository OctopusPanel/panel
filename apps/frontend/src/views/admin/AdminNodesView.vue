<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ApiService } from '../../services/api.js';
import { Cpu, Terminal, Copy, Plus, X } from 'lucide-vue-next';

const { t } = useI18n();

const nodes = ref<any[]>([]);
const isLoading = ref(false);

// New Node Modal
const showCreateModal = ref(false);
const form = ref({
  name: '',
  fqdn: '',
  apiPort: 8080,
  sftpPort: 2022,
  memoryLimit: 16384,
  diskLimit: 500000,
});

// Setup Command Modal
const showSetupModal = ref(false);
const activeSetupCommand = ref('');
const copied = ref(false);

async function loadNodes() {
  isLoading.value = true;
  try {
    nodes.value = await ApiService.get<any[]>('/admin/nodes');
  } finally {
    isLoading.value = false;
  }
}

async function createNode() {
  try {
    const res = await ApiService.post<{ node: any; setupCommand: string }>('/admin/nodes', form.value);
    showCreateModal.value = false;
    activeSetupCommand.value = res.setupCommand;
    showSetupModal.value = true;
    loadNodes();
  } catch (err) {
    console.error('Failed to create node:', err);
  }
}

async function fetchSetupCommand(nodeId: number) {
  try {
    const res = await ApiService.get<{ command: string }>(`/admin/nodes/${nodeId}/setup-command`);
    activeSetupCommand.value = res.command;
    showSetupModal.value = true;
  } catch (err) {
    console.error('Failed to get setup command:', err);
  }
}

function copyCommand() {
  navigator.clipboard.writeText(activeSetupCommand.value);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}

onMounted(() => {
  loadNodes();
});
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-white">{{ t('admin.nodes.title') }}</h1>
        <p class="text-xs text-slate-400 mt-1">{{ t('admin.nodes.subtitle') }}</p>
      </div>

      <button
        @click="showCreateModal = true"
        class="flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
      >
        <Plus class="w-4 h-4 mr-2" />
        {{ t('admin.nodes.createNode') }}
      </button>
    </div>

    <!-- Nodes Table -->
    <div class="bg-[#111622] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div v-if="isLoading" class="p-8 text-center text-xs font-mono text-slate-500">
        {{ t('common.loading') }}
      </div>

      <table v-else class="w-full text-left text-xs">
        <thead class="bg-[#0b0f17] text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
          <tr>
            <th class="py-3 px-4">{{ t('servers.name') }}</th>
            <th class="py-3 px-4">{{ t('admin.nodes.fqdn') }}</th>
            <th class="py-3 px-4">{{ t('servers.memory') }}</th>
            <th class="py-3 px-4">{{ t('servers.disk') }}</th>
            <th class="py-3 px-4">{{ t('nav.servers') }}</th>
            <th class="py-3 px-4 text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60 font-mono">
          <tr
            v-for="node in nodes"
            :key="node.id"
            @click="$router.push(`/admin/nodes/${node.id}`)"
            class="hover:bg-slate-800/40 transition-colors cursor-pointer group"
          >
            <td class="py-3 px-4 font-semibold text-slate-200 flex items-center group-hover:text-amber-400 transition-colors">
              <Cpu class="w-4 h-4 text-amber-400 mr-2 shrink-0" />
              <span>{{ node.name }}</span>
            </td>
            <td class="py-3 px-4 text-slate-400">{{ node.fqdn }}:{{ node.apiPort }}</td>
            <td class="py-3 px-4 text-slate-300">{{ node.memoryLimit }} MB</td>
            <td class="py-3 px-4 text-slate-300">{{ Math.round(node.diskLimit / 1024) }} GB</td>
            <td class="py-3 px-4 text-slate-400">{{ node.serversCount || 0 }}</td>
            <td class="py-3 px-4 text-right space-x-2" @click.stop>
              <button
                @click="fetchSetupCommand(node.id)"
                class="inline-flex items-center px-2 py-1 text-[11px] rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
              >
                <Terminal class="w-3 h-3 mr-1" />
                {{ t('admin.nodes.installerCommand') }}
              </button>
              <router-link
                :to="`/admin/nodes/${node.id}`"
                class="inline-flex items-center px-2.5 py-1 text-[11px] font-sans font-medium rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              >
                Manage
              </router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create Node Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div class="bg-[#161b22] border border-slate-800 rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 class="text-sm font-semibold text-white">{{ t('admin.nodes.createNode') }}</h3>
          <button @click="showCreateModal = false" class="text-slate-400 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1">Node Name</label>
            <input v-model="form.name" type="text" placeholder="e.g. Node-Frankfurt-01" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none" />
          </div>
          <div>
            <label class="block text-slate-400 mb-1">FQDN / Host IP</label>
            <input v-model="form.fqdn" type="text" placeholder="e.g. node01.example.com" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-400 mb-1">API Port (Tentacle)</label>
              <input v-model.number="form.apiPort" type="number" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none" />
            </div>
            <div>
              <label class="block text-slate-400 mb-1">SFTP Port</label>
              <input v-model.number="form.sftpPort" type="number" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-400 mb-1">Memory Limit (MB)</label>
              <input v-model.number="form.memoryLimit" type="number" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none" />
            </div>
            <div>
              <label class="block text-slate-400 mb-1">Disk Limit (MB)</label>
              <input v-model.number="form.diskLimit" type="number" class="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none" />
            </div>
          </div>
        </div>

        <div class="flex justify-end space-x-2 pt-3 border-t border-slate-800">
          <button @click="showCreateModal = false" class="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg">
            {{ t('common.cancel') }}
          </button>
          <button @click="createNode" class="px-3.5 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg">
            {{ t('common.create') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 1-Click Setup Command Modal -->
    <div v-if="showSetupModal" class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div class="bg-[#161b22] border border-slate-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 class="text-sm font-semibold text-white flex items-center">
            <Terminal class="w-4 h-4 text-amber-400 mr-2" />
            {{ t('admin.nodes.installerCommand') }}
          </h3>
          <button @click="showSetupModal = false" class="text-slate-400 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="text-xs text-slate-300">
          Run this single command on your target host to automatically install Docker, pull the Tentacle daemon, and connect it with your panel:
        </p>

        <div class="bg-[#0b0f17] border border-slate-800 rounded-lg p-3 relative group">
          <code class="text-xs font-mono text-amber-300 break-all select-all block pr-12">
            {{ activeSetupCommand }}
          </code>
          <button
            @click="copyCommand"
            class="absolute top-2.5 right-2.5 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition-colors"
          >
            <Copy class="w-4 h-4" />
          </button>
        </div>

        <div v-if="copied" class="text-xs text-emerald-400 text-right">
          {{ t('common.copied') }}
        </div>
      </div>
    </div>
  </div>
</template>
