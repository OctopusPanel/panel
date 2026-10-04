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
  <div class="bg-surface-card border border-surface-border rounded-xl p-4 shadow-xl">
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
      <!-- 1. CPU Gauge & Sparkline -->
      <div class="bg-surface-deep border border-surface-border rounded-lg p-3 flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-1.5">
          <span class="text-[11px] font-medium uppercase tracking-wider flex items-center text-primary-light">
            <Cpu class="w-3.5 h-3.5 mr-1.5 text-primary" />
            CPU Load
          </span>
          <span class="text-[10px] font-mono font-semibold" :class="cpuPercent > 85 ? 'text-status-offline' : 'text-primary-light'">
            {{ cpuUsage }}%
          </span>
        </div>
        <div>
          <div class="flex items-baseline justify-between mb-1.5 font-mono">
            <span class="text-xs font-bold text-white">{{ cpuUsage }}%</span>
            <span class="text-[10px] text-slate-400">/ {{ cpuLimit }}% limit</span>
          </div>
          <!-- Mini Progress Bar & Mini Sparkline -->
          <div class="w-full bg-surface-base h-1.5 rounded-full overflow-hidden mb-1.5">
            <div
              class="h-full transition-all duration-500 rounded-full"
              :class="cpuPercent > 85 ? 'bg-status-offline' : cpuPercent > 60 ? 'bg-status-warning' : 'bg-primary'"
              :style="{ width: `${cpuPercent}%` }"
            ></div>
          </div>
          <div class="flex items-end justify-between h-3 gap-0.5 opacity-70">
            <div
              v-for="(val, idx) in cpuHistory"
              :key="idx"
              class="flex-1 bg-primary rounded-t-sm"
              :style="{ height: `${Math.max(15, Math.min(100, (val / cpuLimit) * 100))}%` }"
            ></div>
          </div>
        </div>
      </div>

      <!-- 2. RAM Usage -->
      <div class="bg-surface-deep border border-surface-border rounded-lg p-3 flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-1.5">
          <span class="text-[11px] font-medium uppercase tracking-wider flex items-center text-metric-memory">
            <Database class="w-3.5 h-3.5 mr-1.5 text-metric-memory" />
            Memory
          </span>
          <span class="text-[10px] font-mono text-metric-memory font-semibold">{{ ramPercent }}%</span>
        </div>
        <div>
          <div class="flex items-baseline justify-between mb-1.5 font-mono">
            <span class="text-xs font-bold text-white">{{ formatBytes(ramBytes) }}</span>
            <span class="text-[10px] text-slate-400">/ {{ formatBytes(maxRamBytes) }}</span>
          </div>
          <div class="w-full bg-surface-base h-1.5 rounded-full overflow-hidden">
            <div
              class="h-full transition-all duration-500 rounded-full"
              :class="ramPercent > 90 ? 'bg-status-offline' : ramPercent > 75 ? 'bg-status-warning' : 'bg-metric-memory'"
              :style="{ width: `${ramPercent}%` }"
            ></div>
          </div>
          <span class="text-[10px] text-slate-400 font-mono mt-1.5 block">
            {{ formatBytes(maxRamBytes - ramBytes) }} free
          </span>
        </div>
      </div>

      <!-- 3. Disk Space -->
      <div class="bg-surface-deep border border-surface-border rounded-lg p-3 flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-1.5">
          <span class="text-[11px] font-medium uppercase tracking-wider flex items-center text-status-online">
            <HardDrive class="w-3.5 h-3.5 mr-1.5 text-status-online" />
            Disk Space
          </span>
          <span class="text-[10px] font-mono text-status-online font-semibold">{{ diskPercent }}%</span>
        </div>
        <div>
          <div class="flex items-baseline justify-between mb-1.5 font-mono">
            <span class="text-xs font-bold text-white">{{ formatBytes(diskBytes) }}</span>
            <span class="text-[10px] text-slate-400">/ {{ formatBytes(maxDiskBytes) }}</span>
          </div>
          <div class="w-full bg-surface-base h-1.5 rounded-full overflow-hidden">
            <div
              class="h-full transition-all duration-500 rounded-full bg-status-online"
              :style="{ width: `${diskPercent}%` }"
            ></div>
          </div>
          <span class="text-[10px] text-slate-400 font-mono mt-1.5 block">
            NVMe SSD Pool
          </span>
        </div>
      </div>

      <!-- 4. Network Traffic (RX / TX) -->
      <div class="bg-surface-deep border border-surface-border rounded-lg p-3 flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-1.5">
          <span class="text-[11px] font-medium uppercase tracking-wider flex items-center text-metric-network">
            <Activity class="w-3.5 h-3.5 mr-1.5 text-metric-network" />
            Network I/O
          </span>
          <span class="w-2 h-2 rounded-full bg-metric-network animate-pulse"></span>
        </div>
        <div class="font-mono text-xs space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-slate-400 text-[10px]">RX:</span>
            <span class="text-metric-network font-semibold">{{ formatBytes(rxBytes) }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400 text-[10px]">TX:</span>
            <span class="text-status-online font-semibold">{{ formatBytes(txBytes) }}</span>
          </div>
          <div class="pt-0.5 text-[9px] text-slate-400 truncate">
            {{ server?.allocation?.ipAddress }}:{{ server?.allocation?.port }}
          </div>
        </div>
      </div>

      <!-- 5. Uptime Duration -->
      <div class="bg-surface-deep border border-surface-border rounded-lg p-3 flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-1.5">
          <span class="text-[11px] font-medium uppercase tracking-wider flex items-center text-primary-light">
            <Clock class="w-3.5 h-3.5 mr-1.5 text-primary" />
            Live Uptime
          </span>
          <span
            class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium"
            :class="server?.status === 'running' ? 'bg-status-online/15 text-status-online border border-status-online/30' : 'bg-surface-base text-slate-400 border border-surface-border'"
          >
            {{ server?.status?.toUpperCase() }}
          </span>
        </div>
        <div class="font-mono">
          <span class="text-sm font-bold text-white block">{{ formatUptime(uptimeSecs) }}</span>
          <span class="text-[10px] text-slate-400 mt-1 block">
            Node: {{ server?.node?.name || 'Local Node' }}
          </span>
        </div>
      </div>

      <!-- 6. SFTP Quick Connect CTA -->
      <div class="bg-surface-deep border border-primary/30 rounded-lg p-3 flex flex-col justify-between hover:border-primary/60 transition-all">
        <div class="flex items-center justify-between text-primary-light mb-1.5">
          <span class="text-[11px] font-semibold uppercase tracking-wider flex items-center">
            <Terminal class="w-3.5 h-3.5 mr-1.5 text-primary" />
            SFTP Access
          </span>
          <span class="text-[10px] bg-primary/20 text-primary-light px-1.5 py-0.5 rounded font-mono">Port {{ sftpPort }}</span>
        </div>
        <p class="text-[10px] text-slate-300 line-clamp-1">
          Direct FileZilla / WinSCP credentials
        </p>
        <button
          @click="showSftpModal = true"
          class="mt-2 w-full py-1.5 px-2 bg-primary hover:bg-primary-dark text-slate-950 rounded text-xs font-semibold flex items-center justify-center transition-all shadow-md active:scale-[0.98]"
        >
          <ExternalLink class="w-3.5 h-3.5 mr-1.5" />
          SFTP Quick Connect
        </button>
      </div>
    </div>

    <!-- SFTP Quick Connect Modal -->
    <div v-if="showSftpModal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-surface-card border border-surface-border rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-surface-border">
          <div class="flex items-center space-x-2">
            <Terminal class="w-5 h-5 text-primary" />
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
          <div class="bg-surface-deep border border-surface-border rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <span class="text-[10px] uppercase text-slate-400 block font-sans">Server Host / FQDN</span>
              <span class="text-slate-200 select-all">{{ sftpHost }}</span>
            </div>
            <button
              @click="copyText(sftpHost, 'host')"
              class="p-1.5 text-slate-400 hover:text-white rounded hover:bg-surface-elevated transition-colors"
            >
              <Check v-if="copiedField === 'host'" class="w-4 h-4 text-status-online" />
              <Copy v-else class="w-4 h-4" />
            </button>
          </div>

          <!-- Port -->
          <div class="bg-surface-deep border border-surface-border rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <span class="text-[10px] uppercase text-slate-400 block font-sans">SFTP Port</span>
              <span class="text-slate-200 select-all">{{ sftpPort }}</span>
            </div>
            <button
              @click="copyText(String(sftpPort), 'port')"
              class="p-1.5 text-slate-400 hover:text-white rounded hover:bg-surface-elevated transition-colors"
            >
              <Check v-if="copiedField === 'port'" class="w-4 h-4 text-status-online" />
              <Copy v-else class="w-4 h-4" />
            </button>
          </div>

          <!-- Username -->
          <div class="bg-surface-deep border border-surface-border rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <span class="text-[10px] uppercase text-slate-400 block font-sans">Username</span>
              <span class="text-slate-200 select-all">{{ sftpUser }}</span>
            </div>
            <button
              @click="copyText(sftpUser, 'user')"
              class="p-1.5 text-slate-400 hover:text-white rounded hover:bg-surface-elevated transition-colors"
            >
              <Check v-if="copiedField === 'user'" class="w-4 h-4 text-status-online" />
              <Copy v-else class="w-4 h-4" />
            </button>
          </div>

          <!-- Password -->
          <div class="bg-surface-deep border border-surface-border rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <span class="text-[10px] uppercase text-slate-400 block font-sans">Password</span>
              <span class="text-slate-200 select-all font-mono">
                {{ showPassword ? sftpPass : '••••••••••••••••' }}
              </span>
            </div>
            <div class="flex items-center space-x-1">
              <button
                @click="showPassword = !showPassword"
                class="p-1.5 text-slate-400 hover:text-white rounded hover:bg-surface-elevated transition-colors"
              >
                <EyeOff v-if="showPassword" class="w-4 h-4" />
                <Eye v-else class="w-4 h-4" />
              </button>
              <button
                @click="copyText(sftpPass, 'pass')"
                class="p-1.5 text-slate-400 hover:text-white rounded hover:bg-surface-elevated transition-colors"
              >
                <Check v-if="copiedField === 'pass'" class="w-4 h-4 text-status-online" />
                <Copy v-else class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- 1-Click Connection String -->
          <div class="bg-primary/10 border border-primary/25 rounded-lg p-2.5 flex items-center justify-between mt-3">
            <div class="truncate mr-2">
              <span class="text-[10px] uppercase text-primary-light block font-sans">Full SFTP URI (WinSCP / FileZilla)</span>
              <span class="text-slate-200 text-[11px] truncate block select-all">{{ sftpUri }}</span>
            </div>
            <button
              @click="copyText(sftpUri, 'uri')"
              class="px-2.5 py-1 bg-primary hover:bg-primary-dark text-slate-950 font-semibold rounded text-xs shrink-0 flex items-center transition-all shadow-sm active:scale-[0.98]"
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
            class="px-4 py-1.5 text-xs bg-surface-elevated hover:bg-surface-border text-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
