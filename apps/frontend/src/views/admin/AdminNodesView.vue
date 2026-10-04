<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ApiService } from '../../services/api.js';
import { Cpu, Terminal, Copy, Plus, X } from 'lucide-vue-next';
import SkeletonTable from '../../components/ui/SkeletonTable.vue';
import ButtonSpinner from '../../components/ui/ButtonSpinner.vue';

const { t } = useI18n();

const nodes = ref<any[]>([]);
const isLoading = ref(false);
const isCreating = ref(false);

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
  isCreating.value = true;
  try {
    const res = await ApiService.post<{ node: any; setupCommand: string }>('/admin/nodes', form.value);
    showCreateModal.value = false;
    activeSetupCommand.value = res.setupCommand;
    showSetupModal.value = true;
    await loadNodes();
  } catch (err) {
    console.error('Failed to create node:', err);
  } finally {
    isCreating.value = false;
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
        class="flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-dark text-slate-950 transition-all shadow-md active:scale-[0.98]"
      >
        <Plus class="w-4 h-4 mr-2" />
        {{ t('admin.nodes.createNode') }}
      </button>
    </div>

    <!-- Nodes Table -->
    <div class="bg-surface-card border border-surface-border rounded-xl overflow-hidden shadow-xl">
      <SkeletonTable v-if="isLoading" :columns="6" :rows="5" />

      <table v-else class="w-full text-left text-xs">
        <thead class="bg-surface-deep text-slate-400 uppercase tracking-wider text-[10px] border-b border-surface-border">
          <tr>
            <th class="py-3 px-4">{{ t('servers.name') }}</th>
            <th class="py-3 px-4">{{ t('admin.nodes.fqdn') }}</th>
            <th class="py-3 px-4">{{ t('servers.memory') }}</th>
            <th class="py-3 px-4">{{ t('servers.disk') }}</th>
            <th class="py-3 px-4">{{ t('nav.servers') }}</th>
            <th class="py-3 px-4 text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-border/50 font-mono">
          <tr
            v-for="node in nodes"
            :key="node.id"
            @click="$router.push(`/admin/nodes/${node.id}`)"
            class="hover:bg-surface-elevated/40 transition-colors cursor-pointer group"
          >
            <td class="py-3 px-4 font-semibold text-slate-200 flex items-center group-hover:text-primary transition-colors">
              <Cpu class="w-4 h-4 text-primary mr-2 shrink-0" />
              <span>{{ node.name }}</span>
            </td>
            <td class="py-3 px-4 text-slate-400">{{ node.fqdn }}:{{ node.apiPort }}</td>
            <td class="py-3 px-4 text-slate-300">{{ node.memoryLimit }} MB</td>
            <td class="py-3 px-4 text-slate-300">{{ Math.round(node.diskLimit / 1024) }} GB</td>
            <td class="py-3 px-4 text-slate-400">{{ node.serversCount || 0 }}</td>
            <td class="py-3 px-4 text-right space-x-2" @click.stop>
              <button
                @click="fetchSetupCommand(node.id)"
                class="inline-flex items-center px-2.5 py-1 text-[11px] rounded bg-primary/10 text-primary-light border border-primary/25 hover:bg-primary/20 transition-colors"
              >
                <Terminal class="w-3 h-3 mr-1" />
                {{ t('admin.nodes.installerCommand') }}
              </button>
              <router-link
                :to="`/admin/nodes/${node.id}`"
                class="inline-flex items-center px-2.5 py-1 text-[11px] font-sans font-medium rounded bg-surface-deep border border-surface-border text-slate-300 hover:text-white hover:bg-surface-elevated transition-colors"
              >
                Manage
              </router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create Node Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
      <div class="bg-surface-card border border-surface-border rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-surface-border">
          <h3 class="text-sm font-semibold text-white">{{ t('admin.nodes.createNode') }}</h3>
          <button @click="showCreateModal = false" class="text-slate-400 hover:text-white transition-colors">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1 font-medium">Node Name</label>
            <input v-model="form.name" type="text" placeholder="e.g. Node-Frankfurt-01" class="w-full bg-surface-deep border border-surface-border rounded-lg p-2.5 text-slate-200 outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label class="block text-slate-400 mb-1 font-medium">FQDN / Host IP</label>
            <input v-model="form.fqdn" type="text" placeholder="e.g. node01.example.com" class="w-full bg-surface-deep border border-surface-border rounded-lg p-2.5 text-slate-200 outline-none focus:border-primary transition-colors" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-400 mb-1 font-medium">API Port (Tentacle)</label>
              <input v-model.number="form.apiPort" type="number" class="w-full bg-surface-deep border border-surface-border rounded-lg p-2.5 text-slate-200 outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label class="block text-slate-400 mb-1 font-medium">SFTP Port</label>
              <input v-model.number="form.sftpPort" type="number" class="w-full bg-surface-deep border border-surface-border rounded-lg p-2.5 text-slate-200 outline-none focus:border-primary transition-colors" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-400 mb-1 font-medium">Memory Limit (MB)</label>
              <input v-model.number="form.memoryLimit" type="number" class="w-full bg-surface-deep border border-surface-border rounded-lg p-2.5 text-slate-200 outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label class="block text-slate-400 mb-1 font-medium">Disk Limit (MB)</label>
              <input v-model.number="form.diskLimit" type="number" class="w-full bg-surface-deep border border-surface-border rounded-lg p-2.5 text-slate-200 outline-none focus:border-primary transition-colors" />
            </div>
          </div>
        </div>

        <div class="flex justify-end space-x-2 pt-3 border-t border-surface-border">
          <button @click="showCreateModal = false" class="px-3.5 py-2 text-xs text-slate-300 hover:bg-surface-elevated rounded-lg transition-colors">
            {{ t('common.cancel') }}
          </button>
          <ButtonSpinner
            @click="createNode"
            :loading="isCreating"
            spinner-color="white"
            class="px-4 py-2 text-xs bg-primary hover:bg-primary-dark text-slate-950 font-semibold rounded-lg transition-colors shadow-md"
          >
            {{ t('common.create') }}
          </ButtonSpinner>
        </div>
      </div>
    </div>

    <!-- 1-Click Setup Command Modal -->
    <div v-if="showSetupModal" class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
      <div class="bg-surface-card border border-surface-border rounded-xl p-6 w-full max-w-2xl shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-surface-border">
          <h3 class="text-sm font-semibold text-white flex items-center">
            <Terminal class="w-4 h-4 text-primary mr-2" />
            {{ t('admin.nodes.installerCommand') }}
          </h3>
          <button @click="showSetupModal = false" class="text-slate-400 hover:text-white transition-colors">
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="text-xs text-slate-300">
          Run this single command on your target host to automatically install Docker, pull the Tentacle daemon, and connect it with your panel:
        </p>

        <div class="bg-surface-deep border border-surface-border rounded-lg p-3 relative group">
          <code class="text-xs font-mono text-primary-light break-all select-all block pr-12">
            {{ activeSetupCommand }}
          </code>
          <button
            @click="copyCommand"
            class="absolute top-2.5 right-2.5 p-1.5 bg-surface-card hover:bg-surface-elevated text-slate-300 hover:text-white rounded border border-surface-border transition-colors"
          >
            <Copy class="w-4 h-4" />
          </button>
        </div>

        <div v-if="copied" class="text-xs text-status-online text-right">
          {{ t('common.copied') }}
        </div>
      </div>
    </div>
  </div>
</template>
