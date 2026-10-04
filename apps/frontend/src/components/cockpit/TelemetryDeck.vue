<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { Cpu, HardDrive, Database, Activity, Clock, Terminal, Copy, Check, Eye, EyeOff, X, ExternalLink } from 'lucide-vue-next';

const props = defineProps<{
  server: any;
}>();

const showSftpModal = ref(false);
const showPassword = ref(false);
const copiedField = ref<string | null>(null);

// Real reactive metrics from daemon
const cpuUsage = ref(0);
const ramBytes = ref(0);
const diskBytes = ref(0);
const rxBytes = ref(0);
const txBytes = ref(0);
const uptimeSecs = ref(0);

// Trend history for CPU mini sparkline
const cpuHistory = ref<number[]>([0]);

// Uptime anchor: daemon-reported uptime at the moment the sample arrived
let uptimeAnchorSecs = 0;
let uptimeAnchorAt = 0;
let lastSampleAt = 0;

let interval: any = null;

const isAlive = computed(() => props.server?.status === 'running' || props.server?.status === 'starting');

function tickUptime() {
  if (!isAlive.value || uptimeAnchorAt === 0) {
    uptimeSecs.value = isAlive.value ? uptimeSecs.value : 0;
    return;
  }
  uptimeSecs.value = uptimeAnchorSecs + Math.floor((Date.now() - uptimeAnchorAt) / 1000);
}

function applyServerMetrics() {
  const m = props.server?.metrics;

  if (!isAlive.value || !m) {
    cpuUsage.value = 0;
    ramBytes.value = 0;
    diskBytes.value = m?.diskCurrentBytes ?? m?.disk_bytes ?? m?.resources?.diskBytes ?? diskBytes.value;
    rxBytes.value = 0;
    txBytes.value = 0;
    uptimeAnchorAt = 0;
    uptimeSecs.value = 0;
    return;
  }

  const cpu = +(m?.cpuCurrent ?? m?.cpu_usage_pct ?? m?.resources?.cpuAbsolute ?? 0).toFixed(1);
  cpuUsage.value = cpu;

  const sampleAt = m?.receivedAt ?? Date.now();
  if (sampleAt !== lastSampleAt) {
    lastSampleAt = sampleAt;
    if (cpuHistory.value.length === 1 && cpuHistory.value[0] === 0) {
      cpuHistory.value = [cpu];
    } else {
      cpuHistory.value.push(cpu);
      if (cpuHistory.value.length > 20) cpuHistory.value.shift();
    }
  }

  ramBytes.value = m?.memoryCurrentBytes ?? m?.memory_bytes ?? m?.resources?.memoryBytes ?? 0;
  diskBytes.value = m?.diskCurrentBytes ?? m?.disk_bytes ?? m?.resources?.diskBytes ?? diskBytes.value;
  rxBytes.value = m?.networkRxBytes ?? m?.network_rx_bytes ?? m?.resources?.networkRxBytes ?? 0;
  txBytes.value = m?.networkTxBytes ?? m?.network_tx_bytes ?? m?.resources?.networkTxBytes ?? 0;

  const reportedSecs = m?.uptimeSeconds ?? (m?.resources?.uptimeMs ? Math.floor(m.resources.uptimeMs / 1000) : 0);
  if (reportedSecs > 0) {
    uptimeAnchorSecs = reportedSecs;
    uptimeAnchorAt = sampleAt;
  } else if (uptimeAnchorAt === 0) {
    // Older daemons don't report uptime: count from the first live sample
    uptimeAnchorSecs = 0;
    uptimeAnchorAt = sampleAt;
  }
  tickUptime();
}

watch(
  () => [props.server?.status, props.server?.metrics],
  () => applyServerMetrics(),
  { deep: true, immediate: true }
);

onMounted(() => {
  applyServerMetrics();
  interval = setInterval(tickUptime, 1000);
});

onBeforeUnmount(() => {
  if (interval) clearInterval(interval);
});

const cpuLimit = computed(() => props.server?.cpu || 100);
const cpuPercent = computed(() => {
  if (cpuLimit.value <= 0) return 0;
  return Math.min(100, Math.round((cpuUsage.value / cpuLimit.value) * 100));
});

const maxRamBytes = computed(() => (props.server?.memory || 1024) * 1024 * 1024);
const ramPercent = computed(() => {
  if (maxRamBytes.value <= 0) return 0;
  return Math.min(100, Math.round((ramBytes.value / maxRamBytes.value) * 100));
});

const maxDiskBytes = computed(() => (props.server?.disk || 10240) * 1024 * 1024);
const diskPercent = computed(() => {
  if (maxDiskBytes.value <= 0) return 0;
  return Math.min(100, Math.round((diskBytes.value / maxDiskBytes.value) * 100));
});

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return 'Offline';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${seconds % 60}s`;
}

function copyText(val: string, fieldKey: string) {
  navigator.clipboard.writeText(val);
  copiedField.value = fieldKey;
  setTimeout(() => {
    if (copiedField.value === fieldKey) copiedField.value = null;
  }, 2000);
}

const sftpHost = computed(() => {
  const fqdn = props.server?.node?.fqdn;
  if (fqdn) return fqdn.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return typeof window !== 'undefined' ? window.location.hostname : 'localhost';
});
const sftpPort = computed(() => props.server?.node?.sftpPort || 2022);
const sftpUser = computed(() => props.server?.sftp?.username || `admin.${props.server?.identifier || 'srv'}`);
const sftpPass = computed(() => props.server?.sftp?.passwordPreview || 'Your panel password');
const sftpUri = computed(() => `sftp://${sftpUser.value}:${sftpPass.value}@${sftpHost.value}:${sftpPort.value}`);
</script>

<template>
  <div class="bg-[#111622] border border-slate-800 rounded-xl p-4 shadow-xl">
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
      <!-- 1. CPU Gauge & Sparkline -->
      <div class="bg-[#0b0f17] border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-1.5">
          <span class="text-[11px] font-medium uppercase tracking-wider flex items-center">
            <Cpu class="w-3.5 h-3.5 mr-1.5 text-blue-400" />
            CPU Load
          </span>
          <span class="text-[10px] font-mono font-semibold" :class="cpuPercent > 85 ? 'text-rose-400' : 'text-blue-400'">
            {{ cpuUsage }}%
          </span>
        </div>
        <div>
          <div class="flex items-baseline justify-between mb-1.5 font-mono">
            <span class="text-xs font-bold text-white">{{ cpuUsage }}%</span>
            <span class="text-[10px] text-slate-500">/ {{ cpuLimit }}% limit</span>
          </div>
          <!-- Mini Progress Bar & Mini Sparkline -->
          <div class="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden mb-1.5">
            <div
              class="h-full transition-all duration-500 rounded-full"
              :class="cpuPercent > 85 ? 'bg-rose-500' : cpuPercent > 60 ? 'bg-amber-500' : 'bg-blue-500'"
              :style="{ width: `${cpuPercent}%` }"
            ></div>
          </div>
          <div class="flex items-end justify-between h-3 gap-0.5 opacity-60">
            <div
              v-for="(val, idx) in cpuHistory"
              :key="idx"
              class="flex-1 bg-blue-400 rounded-t-sm"
              :style="{ height: `${Math.max(15, Math.min(100, (val / cpuLimit) * 100))}%` }"
            ></div>
          </div>
        </div>
      </div>

      <!-- 2. RAM Usage -->
      <div class="bg-[#0b0f17] border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-1.5">
          <span class="text-[11px] font-medium uppercase tracking-wider flex items-center">
            <Database class="w-3.5 h-3.5 mr-1.5 text-purple-400" />
            Memory
          </span>
          <span class="text-[10px] font-mono text-purple-400 font-semibold">{{ ramPercent }}%</span>
        </div>
        <div>
          <div class="flex items-baseline justify-between mb-1.5 font-mono">
            <span class="text-xs font-bold text-white">{{ formatBytes(ramBytes) }}</span>
            <span class="text-[10px] text-slate-500">/ {{ formatBytes(maxRamBytes) }}</span>
          </div>
          <div class="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
            <div
              class="h-full transition-all duration-500 rounded-full"
              :class="ramPercent > 90 ? 'bg-rose-500' : ramPercent > 75 ? 'bg-amber-500' : 'bg-purple-500'"
              :style="{ width: `${ramPercent}%` }"
            ></div>
          </div>
          <span class="text-[10px] text-slate-500 font-mono mt-1.5 block">
            {{ formatBytes(maxRamBytes - ramBytes) }} free
          </span>
        </div>
      </div>

      <!-- 3. Disk Space -->
      <div class="bg-[#0b0f17] border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-1.5">
          <span class="text-[11px] font-medium uppercase tracking-wider flex items-center">
            <HardDrive class="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
            Disk Space
          </span>
          <span class="text-[10px] font-mono text-emerald-400 font-semibold">{{ diskPercent }}%</span>
        </div>
        <div>
          <div class="flex items-baseline justify-between mb-1.5 font-mono">
            <span class="text-xs font-bold text-white">{{ formatBytes(diskBytes) }}</span>
            <span class="text-[10px] text-slate-500">/ {{ formatBytes(maxDiskBytes) }}</span>
          </div>
          <div class="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
            <div
              class="h-full transition-all duration-500 rounded-full bg-emerald-500"
              :style="{ width: `${diskPercent}%` }"
            ></div>
          </div>
          <span class="text-[10px] text-slate-500 font-mono mt-1.5 block">
            NVMe SSD Pool
          </span>
        </div>
      </div>

      <!-- 4. Network Traffic (RX / TX) -->
      <div class="bg-[#0b0f17] border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-1.5">
          <span class="text-[11px] font-medium uppercase tracking-wider flex items-center">
            <Activity class="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
            Network I/O
          </span>
          <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
        </div>
        <div class="font-mono text-xs space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-slate-400 text-[10px]">RX:</span>
            <span class="text-cyan-300 font-semibold">{{ formatBytes(rxBytes) }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400 text-[10px]">TX:</span>
            <span class="text-emerald-300 font-semibold">{{ formatBytes(txBytes) }}</span>
          </div>
          <div class="pt-0.5 text-[9px] text-slate-500 truncate">
            {{ server?.allocation?.ipAddress }}:{{ server?.allocation?.port }}
          </div>
        </div>
      </div>

      <!-- 5. Uptime Duration -->
      <div class="bg-[#0b0f17] border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-1.5">
          <span class="text-[11px] font-medium uppercase tracking-wider flex items-center">
            <Clock class="w-3.5 h-3.5 mr-1.5 text-amber-400" />
            Live Uptime
          </span>
          <span
            class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium"
            :class="server?.status === 'running' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'"
          >
            {{ server?.status?.toUpperCase() }}
          </span>
        </div>
        <div class="font-mono">
          <span class="text-sm font-bold text-white block">{{ formatUptime(uptimeSecs) }}</span>
          <span class="text-[10px] text-slate-500 mt-1 block">
            Node: {{ server?.node?.name || 'Local Node' }}
          </span>
        </div>
      </div>

      <!-- 6. SFTP Quick Connect CTA -->
      <div class="bg-gradient-to-br from-[#161b22] to-[#121722] border border-blue-500/30 rounded-lg p-3 flex flex-col justify-between hover:border-blue-500/50 transition-all">
        <div class="flex items-center justify-between text-blue-400 mb-1.5">
          <span class="text-[11px] font-semibold uppercase tracking-wider flex items-center">
            <Terminal class="w-3.5 h-3.5 mr-1.5" />
            SFTP Access
          </span>
          <span class="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-mono">Port {{ sftpPort }}</span>
        </div>
        <p class="text-[10px] text-slate-300 line-clamp-1">
          Direct FileZilla / WinSCP credentials
        </p>
        <button
          @click="showSftpModal = true"
          class="mt-2 w-full py-1.5 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold flex items-center justify-center transition-colors shadow-lg shadow-blue-500/10"
        >
          <ExternalLink class="w-3.5 h-3.5 mr-1.5" />
          SFTP Quick Connect
        </button>
      </div>
    </div>

    <!-- SFTP Quick Connect Modal -->
    <div v-if="showSftpModal" class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-[#161b22] border border-slate-800 rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div class="flex items-center space-x-2">
            <Terminal class="w-5 h-5 text-blue-400" />
            <h3 class="text-sm font-bold text-white">SFTP Direct File Transfer</h3>
          </div>
          <button @click="showSftpModal = false" class="text-slate-400 hover:text-white transition-colors">
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="text-xs text-slate-300 leading-relaxed">
          Connect your favorite FTP client (FileZilla, Cyberduck, WinSCP) directly to your server storage:
        </p>

        <div class="space-y-2.5 text-xs font-mono">
          <!-- Host -->
          <div class="bg-[#0b0f17] border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <span class="text-[10px] uppercase text-slate-500 block">Server Host / FQDN</span>
              <span class="text-slate-200 select-all">{{ sftpHost }}</span>
            </div>
            <button
              @click="copyText(sftpHost, 'host')"
              class="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            >
              <Check v-if="copiedField === 'host'" class="w-4 h-4 text-emerald-400" />
              <Copy v-else class="w-4 h-4" />
            </button>
          </div>

          <!-- Port -->
          <div class="bg-[#0b0f17] border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <span class="text-[10px] uppercase text-slate-500 block">SFTP Port</span>
              <span class="text-slate-200 select-all">{{ sftpPort }}</span>
            </div>
            <button
              @click="copyText(String(sftpPort), 'port')"
              class="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            >
              <Check v-if="copiedField === 'port'" class="w-4 h-4 text-emerald-400" />
              <Copy v-else class="w-4 h-4" />
            </button>
          </div>

          <!-- Username -->
          <div class="bg-[#0b0f17] border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <span class="text-[10px] uppercase text-slate-500 block">Username</span>
              <span class="text-slate-200 select-all">{{ sftpUser }}</span>
            </div>
            <button
              @click="copyText(sftpUser, 'user')"
              class="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            >
              <Check v-if="copiedField === 'user'" class="w-4 h-4 text-emerald-400" />
              <Copy v-else class="w-4 h-4" />
            </button>
          </div>

          <!-- Password -->
          <div class="bg-[#0b0f17] border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <span class="text-[10px] uppercase text-slate-500 block">Password</span>
              <span class="text-slate-200 select-all font-mono">
                {{ showPassword ? sftpPass : '••••••••••••••••' }}
              </span>
            </div>
            <div class="flex items-center space-x-1">
              <button
                @click="showPassword = !showPassword"
                class="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              >
                <EyeOff v-if="showPassword" class="w-4 h-4" />
                <Eye v-else class="w-4 h-4" />
              </button>
              <button
                @click="copyText(sftpPass, 'pass')"
                class="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              >
                <Check v-if="copiedField === 'pass'" class="w-4 h-4 text-emerald-400" />
                <Copy v-else class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- 1-Click Connection String -->
          <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 flex items-center justify-between mt-3">
            <div class="truncate mr-2">
              <span class="text-[10px] uppercase text-blue-400 block font-sans">Full SFTP URI (WinSCP / FileZilla)</span>
              <span class="text-blue-200 text-[11px] truncate block select-all">{{ sftpUri }}</span>
            </div>
            <button
              @click="copyText(sftpUri, 'uri')"
              class="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs shrink-0 flex items-center transition-colors"
            >
              <Check v-if="copiedField === 'uri'" class="w-3.5 h-3.5 mr-1" />
              <Copy v-else class="w-3.5 h-3.5 mr-1" />
              Copy URI
            </button>
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button
            @click="showSftpModal = false"
            class="px-4 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
