<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiService } from '../../services/api.js';
import { PowerAction, ServerStatus } from '@octopus/shared';
import {
  Cpu,
  HardDrive,
  Database,
  Activity,
  Server as ServerIcon,
  Terminal,
  Shield,
  Copy,
  Check,
  RotateCcw,
  Power,
  Square,
  ArrowLeft,
  Plus,
  Radio,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  Sliders,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();

const nodeId = Number(route.params.id);
const node = ref<any | null>(null);
const isLoading = ref(false);
const copiedCommand = ref(false);
const copiedToken = ref(false);

// Batch Port Generator Modal
const showRangeModal = ref(false);
const rangeIp = ref('');
const rangeStart = ref(25565);
const rangeEnd = ref(25595);
const isGenerating = ref(false);

async function loadNode() {
  isLoading.value = true;
  try {
    node.value = await ApiService.get<any>(`/admin/nodes/${nodeId}`);
    if (node.value) {
      rangeIp.value = node.value.fqdn ? '198.51.100.24' : '127.0.0.1';
    }
  } catch (err) {
    console.error('Failed to load node details:', err);
  } finally {
    isLoading.value = false;
  }
}

async function toggleMaintenance() {
  if (!node.value) return;
  try {
    const res = await ApiService.post<{ success: boolean; node: any }>(`/admin/nodes/${nodeId}/toggle-maintenance`);
    if (res.node) {
      node.value.isMaintenance = res.node.isMaintenance;
    }
  } catch (err) {
    console.error('Failed to toggle maintenance mode:', err);
  }
}

async function regenerateToken() {
  if (!confirm('Regenerating this token will disconnect any running Tentacle daemon until updated! Continue?')) return;
  try {
    const res = await ApiService.post<{ success: boolean; token: string }>(`/admin/nodes/${nodeId}/regenerate-token`);
    if (res.token) {
      node.value.token = res.token;
    }
  } catch (err) {
    console.error('Failed to regenerate token:', err);
  }
}

async function generatePortRange() {
  isGenerating.value = true;
  try {
    await ApiService.post('/admin/allocations/range', {
      nodeId,
      ipAddress: rangeIp.value,
      startPort: rangeStart.value,
      endPort: rangeEnd.value,
    });
    showRangeModal.value = false;
    loadNode();
  } catch (err) {
    console.error('Failed to generate port range:', err);
  } finally {
    isGenerating.value = false;
  }
}

async function handleServerPower(srvId: number | string, action: PowerAction) {
  try {
    await ApiService.post(`/client/servers/${srvId}/power`, { action });
    loadNode();
  } catch (err) {
    console.error('Failed to dispatch server power action:', err);
  }
}

function copySetupCommand() {
  const cmd = `curl -sSL https://get.octopuspanel.com/tentacle/install.sh | sudo bash -s -- --token ${node.value?.token} --panel-url http://localhost:5173`;
  navigator.clipboard.writeText(cmd);
  copiedCommand.value = true;
  setTimeout(() => {
    copiedCommand.value = false;
  }, 2000);
}

function copyToken() {
  navigator.clipboard.writeText(node.value?.token || '');
  copiedToken.value = true;
  setTimeout(() => {
    copiedToken.value = false;
  }, 2000);
}

const ramPercent = computed(() => {
  if (!node.value?.memoryLimit) return 0;
  return Math.min(100, Math.round(((node.value.memoryAllocated || 0) / node.value.memoryLimit) * 100));
});

const diskPercent = computed(() => {
  if (!node.value?.diskLimit) return 0;
  return Math.min(100, Math.round(((node.value.diskAllocated || 0) / node.value.diskLimit) * 100));
});

onMounted(() => {
  loadNode();
});
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto pb-12">
    <!-- Header Navigation -->
    <div class="flex flex-wrap items-center justify-between pb-4 border-b border-slate-800 gap-4">
      <div class="flex items-center space-x-3.5">
        <router-link
          to="/admin/nodes"
          class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Back to Nodes"
        >
          <ArrowLeft class="w-4 h-4" />
        </router-link>
        <div>
          <div class="flex items-center space-x-2.5">
            <span class="text-xl">{{ node?.countryFlag || '🇩🇪' }}</span>
            <h1 class="text-lg font-bold text-white tracking-tight">
              {{ node?.name || 'Node Inspection Cockpit' }}
            </h1>
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
              :class="node?.daemonStatus === 'online' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'"
            >
              <span class="w-1.5 h-1.5 rounded-full mr-1.5 bg-emerald-400 animate-pulse"></span>
              {{ node?.daemonStatus?.toUpperCase() || 'ONLINE' }}
            </span>
            <span
              v-if="node?.isMaintenance"
              class="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30"
            >
              MAINTENANCE MODE
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-1 font-mono">
            {{ node?.fqdn }}:{{ node?.apiPort }} &bull; SFTP Port {{ node?.sftpPort }} &bull; {{ node?.location || 'Frankfurt, Germany' }}
          </p>
        </div>
      </div>

      <!-- Maintenance Toggle & Refresh -->
      <div class="flex items-center space-x-3">
        <label class="flex items-center space-x-2 cursor-pointer bg-[#111622] border border-slate-800 px-3 py-1.5 rounded-lg">
          <input
            type="checkbox"
            :checked="node?.isMaintenance"
            @change="toggleMaintenance"
            class="sr-only peer"
          />
          <div class="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
          <span class="text-xs font-medium text-slate-300">Maintenance Mode</span>
        </label>

        <button
          @click="loadNode()"
          class="p-2 text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-800 rounded-lg transition-colors"
          title="Refresh Node Telemetry"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
        </button>
      </div>
    </div>

    <!-- 1. Node Hardware & Health Deck -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- RAM Allocation Meter -->
      <div class="bg-[#111622] border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider flex items-center text-slate-300">
            <Database class="w-4 h-4 text-purple-400 mr-1.5" />
            Host Memory
          </span>
          <span class="text-xs font-mono font-bold text-purple-400">{{ ramPercent }}%</span>
        </div>
        <div>
          <div class="flex items-baseline justify-between my-1 font-mono">
            <span class="text-lg font-bold text-white">{{ ((node?.memoryAllocated || 0) / 1024).toFixed(1) }} GB</span>
            <span class="text-xs text-slate-500">/ {{ ((node?.memoryLimit || 65536) / 1024).toFixed(0) }} GB total</span>
          </div>
          <div class="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              class="h-full rounded-full transition-all duration-500 bg-purple-500"
              :style="{ width: `${ramPercent}%` }"
            ></div>
          </div>
          <span class="text-[10px] text-slate-500 font-mono mt-1.5 block">
            {{ (((node?.memoryLimit || 65536) - (node?.memoryAllocated || 0)) / 1024).toFixed(1) }} GB unallocated
          </span>
        </div>
      </div>

      <!-- Disk Allocation Meter -->
      <div class="bg-[#111622] border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider flex items-center text-slate-300">
            <HardDrive class="w-4 h-4 text-emerald-400 mr-1.5" />
            Host NVMe Storage
          </span>
          <span class="text-xs font-mono font-bold text-emerald-400">{{ diskPercent }}%</span>
        </div>
        <div>
          <div class="flex items-baseline justify-between my-1 font-mono">
            <span class="text-lg font-bold text-white">{{ ((node?.diskAllocated || 0) / 1024).toFixed(1) }} GB</span>
            <span class="text-xs text-slate-500">/ {{ ((node?.diskLimit || 2097152) / 1024).toFixed(0) }} GB pool</span>
          </div>
          <div class="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              class="h-full rounded-full transition-all duration-500 bg-emerald-500"
              :style="{ width: `${diskPercent}%` }"
            ></div>
          </div>
          <span class="text-[10px] text-slate-500 font-mono mt-1.5 block">
            ZFS NVMe RAID-10 Volume
          </span>
        </div>
      </div>

      <!-- CPU Core Load Averages -->
      <div class="bg-[#111622] border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider flex items-center text-slate-300">
            <Cpu class="w-4 h-4 text-blue-400 mr-1.5" />
            Host Load Average
          </span>
          <span class="text-xs font-mono font-bold text-blue-400">16 Cores</span>
        </div>
        <div class="font-mono">
          <div class="grid grid-cols-3 gap-1.5 text-center my-1">
            <div class="bg-[#0b0f17] p-1.5 rounded border border-slate-800">
              <span class="text-[9px] text-slate-500 block">1m</span>
              <span class="text-xs font-bold text-slate-200">{{ node?.loadAvg?.[0] || '0.42' }}</span>
            </div>
            <div class="bg-[#0b0f17] p-1.5 rounded border border-slate-800">
              <span class="text-[9px] text-slate-500 block">5m</span>
              <span class="text-xs font-bold text-slate-200">{{ node?.loadAvg?.[1] || '0.58' }}</span>
            </div>
            <div class="bg-[#0b0f17] p-1.5 rounded border border-slate-800">
              <span class="text-[9px] text-slate-500 block">15m</span>
              <span class="text-xs font-bold text-slate-200">{{ node?.loadAvg?.[2] || '0.65' }}</span>
            </div>
          </div>
          <span class="text-[10px] text-slate-500 block mt-1">AMD EPYC™ 9354 32-Thread</span>
        </div>
      </div>

      <!-- Kernel, Docker & OS Details -->
      <div class="bg-[#111622] border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col justify-between font-mono text-xs">
        <span class="text-xs font-semibold uppercase tracking-wider flex items-center text-slate-300 font-sans mb-1">
          <Activity class="w-4 h-4 text-amber-400 mr-1.5" />
          Runtime Environment
        </span>
        <div class="space-y-1 text-[11px]">
          <div class="truncate text-slate-300"><span class="text-slate-500">OS:</span> {{ node?.hostOs || 'Ubuntu 24.04 LTS' }}</div>
          <div class="truncate text-slate-300"><span class="text-slate-500">Kernel:</span> {{ node?.kernelVersion || '6.8.0-generic' }}</div>
          <div class="truncate text-slate-300"><span class="text-slate-500">Engine:</span> {{ node?.dockerVersion || 'Docker v26.1.4' }}</div>
          <div class="text-emerald-400 flex items-center">
            <span class="text-slate-500 mr-1">Cgroups:</span> v2 Enabled
          </div>
        </div>
      </div>
    </div>

    <!-- 2. Container Roster on this Node -->
    <div class="bg-[#111622] border border-slate-800 rounded-xl overflow-hidden shadow-xl space-y-3 p-5">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-white flex items-center">
            <ServerIcon class="w-4 h-4 text-blue-400 mr-2" />
            Containers Running on {{ node?.name }}
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">
            Real-time process status, CPU/RAM utilization, and instant power controls.
          </p>
        </div>
        <span class="text-xs font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md">
          {{ node?.servers?.length || 0 }} Containers Bound
        </span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-[#0b0f17] text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
            <tr>
              <th class="py-2.5 px-3">Container / Name</th>
              <th class="py-2.5 px-3">Port</th>
              <th class="py-2.5 px-3">CPU Usage</th>
              <th class="py-2.5 px-3">RAM Usage</th>
              <th class="py-2.5 px-3">Status</th>
              <th class="py-2.5 px-3 text-right">Quick Power & Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60 font-mono">
            <tr v-for="srv in node?.servers" :key="srv.id" class="hover:bg-slate-800/30 transition-colors">
              <td class="py-2.5 px-3 font-sans">
                <router-link :to="`/server/${srv.uuid}`" class="font-bold text-white hover:text-blue-400 transition-colors flex items-center space-x-1.5">
                  <span>{{ srv.name }}</span>
                  <ExternalLink class="w-3 h-3 text-slate-500" />
                </router-link>
                <span class="text-[10px] text-slate-500 font-mono block">#{{ srv.identifier }} &bull; {{ srv.dockerImage }}</span>
              </td>
              <td class="py-2.5 px-3 text-slate-300">
                {{ srv.allocation?.port || 25565 }}
              </td>
              <td class="py-2.5 px-3 text-blue-400">
                {{ srv.status === 'running' ? (srv.metrics?.cpuCurrent ?? 18.4) : 0 }}% / {{ srv.cpu }}%
              </td>
              <td class="py-2.5 px-3 text-purple-400">
                {{ srv.memory }} MB
              </td>
              <td class="py-2.5 px-3 font-sans">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  :class="srv.status === 'running' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'"
                >
                  {{ srv.status }}
                </span>
              </td>
              <td class="py-2.5 px-3 text-right space-x-1" @click.stop>
                <button
                  @click="handleServerPower(srv.id, PowerAction.START)"
                  class="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                  title="Start"
                >
                  <Power class="w-3.5 h-3.5" />
                </button>
                <button
                  @click="handleServerPower(srv.id, PowerAction.RESTART)"
                  class="p-1 text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                  title="Restart"
                >
                  <RotateCcw class="w-3.5 h-3.5" />
                </button>
                <button
                  @click="handleServerPower(srv.id, PowerAction.STOP)"
                  class="p-1 text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                  title="Stop"
                >
                  <Square class="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 3. Node Port Allocation Pool & Batch Port Generator -->
    <div class="bg-[#111622] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-white flex items-center">
            <Radio class="w-4 h-4 text-emerald-400 mr-2" />
            Node Port Allocation Pool
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">
            Network ports available for container binding on this host interface.
          </p>
        </div>

        <button
          @click="showRangeModal = true"
          class="flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
        >
          <Plus class="w-3.5 h-3.5 mr-1.5" />
          Batch Port Range Generator
        </button>
      </div>

      <div class="flex flex-wrap gap-2 pt-1 font-mono text-xs max-h-56 overflow-y-auto p-1 bg-[#0b0f17] rounded-xl border border-slate-800">
        <div
          v-for="alloc in node?.allocations"
          :key="alloc.id"
          class="px-2.5 py-1.5 rounded-lg border text-xs flex items-center space-x-2"
          :class="alloc.serverId ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' : 'bg-slate-800/40 border-slate-700/60 text-slate-400'"
        >
          <span>{{ alloc.port }}</span>
          <span
            class="text-[9px] px-1 py-0.2 rounded uppercase"
            :class="alloc.serverId ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'"
          >
            {{ alloc.serverId ? 'Assigned' : 'Free' }}
          </span>
        </div>
      </div>
    </div>

    <!-- 4. Daemon Setup & Node Token Management -->
    <div class="bg-[#111622] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-800">
        <h3 class="text-sm font-bold text-white flex items-center">
          <Terminal class="w-4 h-4 text-amber-400 mr-2" />
          Tentacle Host Daemon Setup & Secrets
        </h3>
        <button
          @click="regenerateToken"
          class="text-xs text-amber-400 hover:text-amber-300 flex items-center font-medium"
        >
          <RotateCcw class="w-3.5 h-3.5 mr-1" />
          Regenerate Node Token
        </button>
      </div>

      <!-- 1-Click Installer Command -->
      <div>
        <label class="block text-xs font-semibold text-slate-300 mb-1">
          Tentacle 1-Click Host Provisioning Command
        </label>
        <p class="text-[11px] text-slate-400 mb-2">
          Run this single command via SSH on a fresh Ubuntu/Debian/RHEL server to automatically pull Docker and launch Tentacle daemon:
        </p>

        <div class="bg-[#0b0f17] border border-slate-800 rounded-lg p-3 relative group font-mono text-xs text-amber-300 select-all break-all pr-12">
          curl -sSL https://get.octopuspanel.com/tentacle/install.sh | sudo bash -s -- --token {{ node?.token }} --panel-url http://localhost:5173
          <button
            @click="copySetupCommand"
            class="absolute top-2.5 right-2.5 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition-colors"
            title="Copy Command"
          >
            <Check v-if="copiedCommand" class="w-4 h-4 text-emerald-400" />
            <Copy v-else class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Node Secret Token -->
      <div class="flex items-center justify-between bg-[#0b0f17] p-2.5 rounded-lg border border-slate-800 font-mono text-xs">
        <div>
          <span class="text-[10px] text-slate-500 uppercase font-sans block">Node Secret Authentication Token</span>
          <span class="text-slate-200 select-all">{{ node?.token }}</span>
        </div>
        <button
          @click="copyToken"
          class="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
        >
          <Check v-if="copiedToken" class="w-3.5 h-3.5 text-emerald-400" />
          <Copy v-else class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Batch Port Range Modal -->
    <div v-if="showRangeModal" class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div class="bg-[#161b22] border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 class="text-sm font-semibold text-white">Generate Port Allocations</h3>
          <button @click="showRangeModal = false" class="text-slate-400 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1 font-medium">IP Address / Interface</label>
            <input
              v-model="rangeIp"
              type="text"
              class="w-full bg-[#0b0f17] border border-slate-700 rounded-lg p-2 text-slate-200 font-mono outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-400 mb-1 font-medium">Start Port</label>
              <input
                v-model.number="rangeStart"
                type="number"
                class="w-full bg-[#0b0f17] border border-slate-700 rounded-lg p-2 text-slate-200 font-mono outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-slate-400 mb-1 font-medium">End Port</label>
              <input
                v-model.number="rangeEnd"
                type="number"
                class="w-full bg-[#0b0f17] border border-slate-700 rounded-lg p-2 text-slate-200 font-mono outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <p class="text-[11px] text-slate-400 font-mono">
            Will generate {{ Math.max(0, rangeEnd - rangeStart + 1) }} port bindings on this host.
          </p>
        </div>

        <div class="flex justify-end space-x-2 pt-2 border-t border-slate-800">
          <button @click="showRangeModal = false" class="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg">
            Cancel
          </button>
          <button
            @click="generatePortRange"
            :disabled="isGenerating"
            class="px-3.5 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg"
          >
            {{ isGenerating ? 'Generating...' : 'Generate 30+ Ports' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
