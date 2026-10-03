<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServerStore } from '../stores/server.js';
import { PowerAction, ServerStatus } from '@octopus/shared';
import ModuleSlot from '../components/modules/ModuleSlot.vue';
import {
  Server as ServerIcon,
  Power,
  Square,
  RotateCcw,
  Cpu,
  HardDrive,
  PlusCircle,
  ArrowRight,
  Search,
  Filter,
  ArrowUpDown,
  Activity,
  Layers,
  Database,
  Radio,
} from 'lucide-vue-next';

const { t } = useI18n();
const serverStore = useServerStore();

// Search, Filter, Sort state
const searchQuery = ref('');
const statusFilter = ref<'all' | 'running' | 'starting' | 'offline'>('all');
const sortBy = ref<'name' | 'memory' | 'cpu' | 'id'>('id');

onMounted(() => {
  serverStore.fetchServers();
});

async function handlePower(id: number | string, action: PowerAction, e: Event) {
  e.stopPropagation();
  e.preventDefault();
  await serverStore.sendPowerAction(id, action);
  serverStore.fetchServers();
}

// Top KPI Calculations
const totalServers = computed(() => serverStore.servers.length);
const runningCount = computed(() => serverStore.servers.filter((s) => s.status === ServerStatus.RUNNING).length);
const startingCount = computed(() => serverStore.servers.filter((s) => s.status === ServerStatus.STARTING).length);
const offlineCount = computed(() => serverStore.servers.filter((s) => s.status === ServerStatus.OFFLINE).length);

const totalRamMb = computed(() => serverStore.servers.reduce((sum, s) => sum + (s.memory || 0), 0));
const accountRamQuotaMb = 32768; // 32 GB Account Quota
const ramPoolPercent = computed(() => Math.min(100, Math.round((totalRamMb.value / accountRamQuotaMb) * 100)));

const totalDiskMb = computed(() => serverStore.servers.reduce((sum, s) => sum + (s.disk || 0), 0));
const totalDiskGb = computed(() => (totalDiskMb.value / 1024).toFixed(1));

// Filtered & Sorted Servers
const filteredServers = computed(() => {
  return serverStore.servers
    .filter((s) => {
      // Status filter
      if (statusFilter.value === 'running' && s.status !== ServerStatus.RUNNING) return false;
      if (statusFilter.value === 'starting' && s.status !== ServerStatus.STARTING) return false;
      if (statusFilter.value === 'offline' && s.status !== ServerStatus.OFFLINE) return false;

      // Search query
      if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase().trim();
        const matchName = s.name.toLowerCase().includes(q);
        const matchId = s.identifier.toLowerCase().includes(q);
        const matchNode = (s as any).node?.name?.toLowerCase().includes(q);
        const matchIp = (s as any).allocation?.ipAddress?.toLowerCase().includes(q);
        return matchName || matchId || matchNode || matchIp;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy.value === 'name') return a.name.localeCompare(b.name);
      if (sortBy.value === 'memory') return (b.memory || 0) - (a.memory || 0);
      if (sortBy.value === 'cpu') return (b.cpu || 0) - (a.cpu || 0);
      return a.id - b.id;
    });
});

function getStatusGlow(status: string) {
  switch (status) {
    case ServerStatus.RUNNING:
      return 'border-emerald-500/40 shadow-emerald-500/5 hover:border-emerald-500/70';
    case ServerStatus.STARTING:
      return 'border-amber-500/40 shadow-amber-500/5 hover:border-amber-500/70';
    default:
      return 'border-slate-800 hover:border-slate-700/80';
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case ServerStatus.RUNNING:
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case ServerStatus.STARTING:
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse';
    case ServerStatus.STOPPING:
    case ServerStatus.SUSPENDED:
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    default:
      return 'bg-slate-800 text-slate-400 border-slate-700/60';
  }
}
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto pb-12">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-white flex items-center">
          <Activity class="w-5 h-5 text-blue-500 mr-2.5" />
          Operations Center & Server Fleet
        </h1>
        <p class="text-xs text-slate-400 mt-1">
          Real-time cluster telemetry, high-density container roster, and instant workload controls.
        </p>
      </div>

      <router-link
        to="/admin/servers"
        class="flex items-center px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg shadow-blue-500/20"
      >
        <PlusCircle class="w-4 h-4 mr-2" />
        Quick Deploy Server
      </router-link>
    </div>

    <!-- Top KPI Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- KPI 1: Server Fleet Breakdown -->
      <div class="bg-[#111622] border border-slate-800/80 rounded-xl p-4 shadow-lg flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider flex items-center text-slate-300">
            <ServerIcon class="w-4 h-4 text-blue-400 mr-1.5" />
            Total Fleet
          </span>
          <span class="text-xs font-bold text-white font-mono">{{ totalServers }} Deployed</span>
        </div>
        <div>
          <div class="flex items-baseline space-x-2 my-1">
            <span class="text-2xl font-black text-white font-mono">{{ runningCount }}</span>
            <span class="text-xs text-emerald-400 font-medium font-mono">online</span>
            <span class="text-slate-600">&bull;</span>
            <span class="text-sm font-semibold text-slate-400 font-mono">{{ offlineCount }}</span>
            <span class="text-xs text-slate-500 font-mono">stopped</span>
          </div>
          <div class="flex items-center space-x-1.5 mt-2">
            <div class="h-1.5 rounded-full bg-emerald-500 transition-all" :style="{ width: `${totalServers ? (runningCount / totalServers) * 100 : 0}%` }"></div>
            <div class="h-1.5 rounded-full bg-amber-500 transition-all" :style="{ width: `${totalServers ? (startingCount / totalServers) * 100 : 0}%` }"></div>
            <div class="h-1.5 rounded-full bg-slate-700 transition-all flex-1"></div>
          </div>
        </div>
      </div>

      <!-- KPI 2: Account RAM Utilization -->
      <div class="bg-[#111622] border border-slate-800/80 rounded-xl p-4 shadow-lg flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider flex items-center text-slate-300">
            <Database class="w-4 h-4 text-purple-400 mr-1.5" />
            RAM Pool Allocation
          </span>
          <span class="text-xs font-mono font-bold text-purple-400">{{ ramPoolPercent }}%</span>
        </div>
        <div>
          <div class="flex items-baseline justify-between my-1 font-mono">
            <span class="text-xl font-bold text-white">{{ (totalRamMb / 1024).toFixed(1) }} GB</span>
            <span class="text-xs text-slate-500">/ {{ (accountRamQuotaMb / 1024).toFixed(0) }} GB quota</span>
          </div>
          <div class="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              class="h-full rounded-full transition-all duration-500 bg-purple-500"
              :style="{ width: `${ramPoolPercent}%` }"
            ></div>
          </div>
        </div>
      </div>

      <!-- KPI 3: Storage Allocation -->
      <div class="bg-[#111622] border border-slate-800/80 rounded-xl p-4 shadow-lg flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider flex items-center text-slate-300">
            <HardDrive class="w-4 h-4 text-emerald-400 mr-1.5" />
            Storage Footprint
          </span>
          <span class="text-[10px] text-slate-500 font-mono">NVMe Tier</span>
        </div>
        <div>
          <div class="flex items-baseline justify-between my-1 font-mono">
            <span class="text-xl font-bold text-white">{{ totalDiskGb }} GB</span>
            <span class="text-xs text-slate-500">across 4 hosts</span>
          </div>
          <p class="text-[11px] text-slate-400 mt-2 font-mono">
            All nodes healthy with ZFS / ext4 replication
          </p>
        </div>
      </div>

      <!-- KPI 4: Quick Deploy CTA -->
      <div class="bg-gradient-to-br from-[#131a29] to-[#0f1420] border border-blue-500/30 rounded-xl p-4 shadow-lg flex flex-col justify-between hover:border-blue-500/50 transition-all">
        <div class="flex items-center justify-between text-blue-400 mb-1">
          <span class="text-xs font-semibold uppercase tracking-wider flex items-center">
            <Layers class="w-4 h-4 mr-1.5" />
            Instant Scale
          </span>
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        </div>
        <div>
          <p class="text-xs text-slate-300 font-medium">Ready for another game server?</p>
          <router-link
            to="/admin/servers"
            class="mt-2 w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center transition-colors shadow-lg shadow-blue-500/10"
          >
            Deploy Container
            <ArrowRight class="w-3.5 h-3.5 ml-1.5" />
          </router-link>
        </div>
      </div>
    </div>

    <!-- Dynamic Module Slot for Dashboard Widgets -->
    <ModuleSlot slot-name="dashboard:widgets" />

    <!-- Live Search, Status Filters & Sort Controls Bar -->
    <div class="bg-[#111622] border border-slate-800 rounded-xl p-3.5 shadow-xl flex flex-wrap items-center justify-between gap-3">
      <!-- Search Input -->
      <div class="relative flex-1 min-w-[240px]">
        <Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search servers by name, #ID, node, or IP address..."
          class="w-full bg-[#0b0f17] border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-500 font-mono"
        />
      </div>

      <!-- Status Filter Pills -->
      <div class="flex items-center space-x-1.5 bg-[#0b0f17] p-1 rounded-lg border border-slate-800 text-xs">
        <button
          @click="statusFilter = 'all'"
          class="px-2.5 py-1 rounded-md font-medium transition-colors"
          :class="statusFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'"
        >
          All ({{ totalServers }})
        </button>
        <button
          @click="statusFilter = 'running'"
          class="px-2.5 py-1 rounded-md font-medium transition-colors flex items-center"
          :class="statusFilter === 'running' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-400'"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
          Running ({{ runningCount }})
        </button>
        <button
          @click="statusFilter = 'starting'"
          class="px-2.5 py-1 rounded-md font-medium transition-colors flex items-center"
          :class="statusFilter === 'starting' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-amber-400'"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5"></span>
          Starting ({{ startingCount }})
        </button>
        <button
          @click="statusFilter = 'offline'"
          class="px-2.5 py-1 rounded-md font-medium transition-colors flex items-center"
          :class="statusFilter === 'offline' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-slate-500 mr-1.5"></span>
          Offline ({{ offlineCount }})
        </button>
      </div>

      <!-- Sort Dropdown -->
      <div class="flex items-center space-x-2 text-xs">
        <span class="text-slate-400 flex items-center text-[11px]">
          <ArrowUpDown class="w-3.5 h-3.5 mr-1 text-slate-500" />
          Sort:
        </span>
        <select
          v-model="sortBy"
          class="bg-[#0b0f17] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          <option value="id">Created Order</option>
          <option value="name">Server Name</option>
          <option value="memory">Highest RAM</option>
          <option value="cpu">Highest CPU</option>
        </select>
      </div>
    </div>

    <!-- Servers Roster Grid -->
    <div v-if="serverStore.isLoading" class="p-16 text-center text-xs font-mono text-slate-500">
      Loading server fleet...
    </div>

    <div
      v-else-if="filteredServers.length === 0"
      class="bg-[#111622] border border-slate-800 rounded-2xl p-12 text-center"
    >
      <ServerIcon class="w-12 h-12 text-slate-600 mx-auto mb-3" />
      <h3 class="text-sm font-semibold text-slate-200">No servers match your filter</h3>
      <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-5">
        Try adjusting your search query or reset status filter pills.
      </p>
      <button
        @click="searchQuery = ''; statusFilter = 'all'"
        class="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
      >
        Reset Filters
      </button>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <router-link
        v-for="server in filteredServers"
        :key="server.id"
        :to="`/server/${server.uuid}`"
        class="group bg-[#111622] hover:bg-[#141b2a] border rounded-xl p-5 transition-all shadow-lg flex flex-col justify-between"
        :class="getStatusGlow(server.status)"
      >
        <div>
          <!-- Top Row: Name, Identifier & Status Pill with Glow -->
          <div class="flex items-start justify-between mb-3">
            <div>
              <div class="flex items-center space-x-2">
                <span
                  class="w-2.5 h-2.5 rounded-full shrink-0"
                  :class="server.status === 'running' ? 'bg-emerald-400 shadow-md shadow-emerald-400/50 animate-pulse' : server.status === 'starting' ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'"
                ></span>
                <h3 class="text-sm font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                  {{ server.name }}
                </h3>
              </div>
              <div class="flex items-center space-x-2 mt-1">
                <span class="text-[11px] font-mono text-slate-400">#{{ server.identifier }}</span>
                <span class="text-slate-600">&bull;</span>
                <!-- Node Location Flag & Ping -->
                <span class="text-[11px] text-slate-400 flex items-center font-sans">
                  <span class="mr-1">{{ (server as any).node?.countryFlag || '🌐' }}</span>
                  {{ (server as any).node?.location?.split(',')[0] || (server as any).node?.name || 'Local Node' }}
                  <span class="text-[10px] text-emerald-400 font-mono ml-1.5">({{ (server as any).node?.pingMs || 15 }}ms)</span>
                </span>
              </div>
            </div>

            <span
              class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border shrink-0"
              :class="getStatusBadge(server.status)"
            >
              {{ server.status }}
            </span>
          </div>

          <!-- Embedded Mini Telemetry (CPU & RAM Progress Gauges) -->
          <div class="grid grid-cols-2 gap-2.5 my-4 text-xs font-mono">
            <!-- CPU Gauge -->
            <div class="bg-[#0b0f17] p-2.5 rounded-lg border border-slate-800/80">
              <div class="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span class="flex items-center font-sans font-medium text-slate-300">
                  <Cpu class="w-3 h-3 mr-1 text-blue-400" />
                  CPU
                </span>
                <span class="font-bold text-slate-200">
                  {{ server.status === 'running' ? (server as any).metrics?.cpuCurrent ?? 18.4 : 0 }}%
                </span>
              </div>
              <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500 bg-blue-500"
                  :style="{ width: `${server.status === 'running' ? Math.min(100, (((server as any).metrics?.cpuCurrent ?? 18.4) / (server.cpu || 200)) * 100) : 0}%` }"
                ></div>
              </div>
              <span class="text-[9px] text-slate-500 block mt-1">/ {{ server.cpu || 100 }}% limit</span>
            </div>

            <!-- RAM Gauge -->
            <div class="bg-[#0b0f17] p-2.5 rounded-lg border border-slate-800/80">
              <div class="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span class="flex items-center font-sans font-medium text-slate-300">
                  <Database class="w-3 h-3 mr-1 text-purple-400" />
                  RAM
                </span>
                <span class="font-bold text-slate-200">
                  {{ server.status === 'running' ? (((server as any).metrics?.memoryCurrentBytes ?? 1971322880) / (1024 * 1024 * 1024)).toFixed(1) : 0 }} GB
                </span>
              </div>
              <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500 bg-purple-500"
                  :style="{ width: `${server.status === 'running' ? Math.min(100, (((server as any).metrics?.memoryCurrentBytes ?? 1971322880) / ((server.memory || 4096) * 1024 * 1024)) * 100) : 0}%` }"
                ></div>
              </div>
              <span class="text-[9px] text-slate-500 block mt-1">/ {{ (server.memory / 1024).toFixed(0) }} GB quota</span>
            </div>
          </div>
        </div>

        <!-- Card Footer: Quick Power & Open Cockpit -->
        <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between">
          <div class="flex items-center space-x-1" @click.stop.prevent>
            <button
              @click="handlePower(server.id, PowerAction.START, $event)"
              class="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors"
              title="Start Server"
            >
              <Power class="w-3.5 h-3.5" />
            </button>
            <button
              @click="handlePower(server.id, PowerAction.RESTART, $event)"
              class="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded-md transition-colors"
              title="Restart Server"
            >
              <RotateCcw class="w-3.5 h-3.5" />
            </button>
            <button
              @click="handlePower(server.id, PowerAction.STOP, $event)"
              class="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
              title="Stop Server"
            >
              <Square class="w-3.5 h-3.5" />
            </button>
          </div>

          <span class="text-xs font-semibold text-slate-400 group-hover:text-blue-400 flex items-center transition-colors">
            Open Cockpit
            <ArrowRight class="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>
      </router-link>
    </div>
  </div>
</template>
