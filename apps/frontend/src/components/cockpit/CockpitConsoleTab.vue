<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useI18n } from 'vue-i18n';
import { ApiService } from '../../services/api.js';
import { Terminal as TerminalIcon, Send, RotateCcw, Power, Square, Maximize2, Minimize2, Trash2, Skull, AlertTriangle, X } from 'lucide-vue-next';
import { PowerAction } from '@octopus/shared';
import { useServerStore } from '../../stores/server.js';

const props = defineProps<{
  serverUuid: string;
}>();

const { t } = useI18n();
const serverStore = useServerStore();

const terminalContainer = ref<HTMLDivElement | null>(null);
const commandInput = ref('');
const isConnected = ref(false);
const isFullscreen = ref(false);
const showKillModal = ref(false);

// Command history
const commandHistory = ref<string[]>([]);
const historyIndex = ref(-1);

let term: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let socket: WebSocket | null = null;
let demoTimer: any = null;

async function initTerminal() {
  if (!terminalContainer.value) return;

  term = new Terminal({
    cursorBlink: true,
    fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
    fontSize: 13,
    theme: {
      background: '#0b0f17',
      foreground: '#c9d1d9',
      cursor: '#3b82f6',
      black: '#484f58',
      red: '#ef4444',
      green: '#10b981',
      yellow: '#f59e0b',
      blue: '#3b82f6',
      magenta: '#a855f7',
      cyan: '#06b6d4',
      white: '#f1f5f9',
    },
    convertEol: true,
    scrollback: 2500,
  });

  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(terminalContainer.value);

  await nextTick();
  fitAddon.fit();

  term.writeln('\x1b[38;5;39m[OctopusPanel Operations Deck]\x1b[0m Initializing secure xterm.js TTY session...');

  await connectSocket();
}

async function connectSocket() {
  if (ApiService.isDemoMode()) {
    isConnected.value = true;
    term?.writeln('\x1b[32m[OctopusPanel]\x1b[0m Connected to Tentacle Host Daemon Stream.\r\n');
    term?.writeln('\x1b[90m[18:30:00 INFO]: [Paper] Loading server properties & initializing world...\x1b[0m');
    term?.writeln('\x1b[90m[18:30:01 INFO]: Preparing start region for dimension minecraft:overworld: 100%\x1b[0m');
    term?.writeln('\x1b[32m[18:30:02 INFO]: [Paper] Done (2.41s)! For help, type "help"\x1b[0m');
    term?.writeln('\x1b[38;5;39m[OctopusPanel] Container healthy. Bound to primary allocation 198.51.100.24:25565\x1b[0m\r\n');

    demoTimer = setInterval(() => {
      const tps = (19.96 + Math.random() * 0.04).toFixed(2);
      const mem = Math.floor(1850 + Math.random() * 320);
      term?.writeln(`\x1b[90m[Telemetry Tick] TPS: ${tps} | Heap: ${mem} MB / 4096 MB | Entities: 142 | Chunks: 68\x1b[0m`);
    }, 12000);
    return;
  }

  try {
    const res = await ApiService.get<{ token: string; socketUrl: string }>(
      `/client/servers/${props.serverUuid}/ws-token`,
    );

    const wsUrl = `${res.socketUrl}?token=${res.token}`;
    try {
      socket = new WebSocket(wsUrl);
    } catch (wsErr: any) {
      const wsErrText = wsErr?.message || wsErr?.code || (typeof wsErr === 'object' ? JSON.stringify(wsErr) : String(wsErr));
      term?.writeln(`\r\n\x1b[31m[OctopusPanel] Failed to open WebSocket: ${wsErrText}\x1b[0m`);
      return;
    }

    socket.onopen = () => {
      isConnected.value = true;
      term?.writeln('\x1b[32m[OctopusPanel]\x1b[0m Connected to daemon live terminal.\r\n');
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.event === 'console_output' && parsed.args?.[0] !== undefined) {
          const out = String(parsed.args[0]);
          term?.write(out.endsWith('\n') ? out : out + '\r\n');
        } else if (parsed.event === 'stats' && parsed.args?.[0]) {
          const stats = parsed.args[0] as any;
          if (serverStore.currentServer) {
            serverStore.currentServer.metrics = {
              cpuCurrent: stats.cpu_absolute ?? stats.cpuAbsolute ?? 0,
              memoryCurrentBytes: stats.memory_bytes ?? stats.memoryBytes ?? 0,
              diskCurrentBytes: stats.disk_bytes ?? stats.diskBytes ?? 0,
              networkRxBytes: stats.network?.rx_bytes ?? stats.networkRxBytes ?? 0,
              networkTxBytes: stats.network?.tx_bytes ?? stats.networkTxBytes ?? 0,
              uptimeSeconds: stats.uptime ?? (stats.uptimeMs ? Math.floor(stats.uptimeMs / 1000) : 0),
            };
          }
        } else if (parsed.event === 'status' && parsed.args?.[0]) {
          const newStatus = String(parsed.args[0]);
          if (serverStore.currentServer) {
            serverStore.currentServer.status = newStatus;
          }
        } else if (parsed.event === 'token_expiring' || parsed.event === 'token_expired') {
          // Token heartbeat
        } else if (parsed.event === 'panel_notice' && parsed.data) {
          term?.writeln(`\r\n\x1b[33m[OctopusPanel] ${parsed.data}\x1b[0m\r\n`);
        } else if (!parsed.event) {
          term?.write(event.data + '\r\n');
        }
      } catch {
        term?.write(event.data);
      }
    };

    socket.onclose = () => {
      isConnected.value = false;
      term?.writeln('\r\n\x1b[31m[OctopusPanel]\x1b[0m Stream disconnected.');
    };

    socket.onerror = () => {
      isConnected.value = false;
      term?.writeln('\r\n\x1b[31m[OctopusPanel]\x1b[0m WebSocket connection error.');
    };
  } catch (err: any) {
    const errText = err?.message || err?.code || (typeof err === 'object' ? JSON.stringify(err) : String(err));
    term?.writeln(`\r\n\x1b[31m[OctopusPanel] Failed to establish terminal session: ${errText}\x1b[0m`);
  }
}

function sendCommand(customCmd?: string) {
  const cmd = customCmd || commandInput.value;
  if (!cmd.trim()) return;

  // Add to history
  if (!commandHistory.value.length || commandHistory.value[commandHistory.value.length - 1] !== cmd) {
    commandHistory.value.push(cmd);
  }
  historyIndex.value = -1;

  term?.writeln(`\x1b[34m> ${cmd}\x1b[0m`);

  if (ApiService.isDemoMode()) {
    setTimeout(() => {
      const lower = cmd.toLowerCase().trim();
      if (lower === 'help') {
        term?.writeln('\x1b[33m[Console Help] Available commands: list, tps, version, say <msg>, stop\x1b[0m');
      } else if (lower === 'list') {
        term?.writeln('\x1b[32mOnline Players (4/50): \x1b[37mAlex_Hoster, CraftKing99, Notch, Steve\x1b[0m');
      } else if (lower === 'tps') {
        term?.writeln('\x1b[32mTPS from last 1m, 5m, 15m: \x1b[37m20.0, 20.0, 19.98\x1b[0m');
      } else if (lower === 'version') {
        term?.writeln('\x1b[36mPaperMC 1.21.4 (Build #128) - High Performance Rust Tentacle Engine\x1b[0m');
      } else if (lower.startsWith('say ')) {
        term?.writeln(`\x1b[35m[Broadcast] ${cmd.slice(4)}\x1b[0m`);
      } else {
        term?.writeln(`\x1b[90m[Server thread/INFO]: Executed command '${cmd}' successfully.\x1b[0m`);
      }
    }, 80);
    commandInput.value = '';
    return;
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event: 'send_command', args: [cmd] }));
  } else {
    term?.writeln(`\x1b[33m[Warning] Terminal not connected. Command not dispatched.\x1b[0m`);
  }
  commandInput.value = '';
}

function navigateHistory(direction: 'up' | 'down') {
  if (commandHistory.value.length === 0) return;

  if (direction === 'up') {
    if (historyIndex.value === -1) {
      historyIndex.value = commandHistory.value.length - 1;
    } else if (historyIndex.value > 0) {
      historyIndex.value--;
    }
  } else {
    if (historyIndex.value !== -1) {
      if (historyIndex.value < commandHistory.value.length - 1) {
        historyIndex.value++;
      } else {
        historyIndex.value = -1;
      }
    }
  }

  commandInput.value = historyIndex.value === -1 ? '' : commandHistory.value[historyIndex.value];
}

async function handlePower(action: PowerAction) {
  try {
    await serverStore.sendPowerAction(props.serverUuid, action);
    term?.writeln(`\x1b[33m[OctopusPanel] Power action '${action}' triggered.\x1b[0m`);
  } catch (err: any) {
    const errText = err?.message || err?.code || (typeof err === 'object' ? JSON.stringify(err) : String(err));
    term?.writeln(`\x1b[31m[Power Error] ${errText}\x1b[0m`);
  }
}

function confirmKill() {
  showKillModal.value = false;
  handlePower(PowerAction.KILL);
}

function clearConsole() {
  term?.clear();
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
  nextTick(() => {
    fitAddon?.fit();
  });
}

onMounted(() => {
  initTerminal();
  window.addEventListener('resize', onResize);
});

function onResize() {
  try {
    fitAddon?.fit();
  } catch {}
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  if (demoTimer) {
    clearInterval(demoTimer);
    demoTimer = null;
  }
  if (socket) {
    socket.close();
    socket = null;
  }
  if (term) {
    term.dispose();
    term = null;
  }
});
</script>

<template>
  <div
    class="flex flex-col bg-[#0b0f17] border border-slate-800 rounded-xl overflow-hidden shadow-2xl transition-all"
    :class="isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen w-screen border-none' : 'h-[580px]'"
  >
    <!-- Top Toolbar -->
    <div class="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#111622] border-b border-slate-800 gap-2">
      <!-- Status & TTY title -->
      <div class="flex items-center space-x-3">
        <TerminalIcon class="w-4 h-4 text-blue-400" />
        <span class="text-xs font-mono font-semibold text-slate-200">Interactive TTY Console</span>
        <span
          class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
          :class="isConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'"
        >
          <span class="w-1.5 h-1.5 rounded-full mr-1.5" :class="isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'"></span>
          {{ isConnected ? 'Connected' : 'Offline' }}
        </span>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center space-x-2">
        <!-- Power Action Bar -->
        <button
          @click="handlePower(PowerAction.START)"
          class="flex items-center px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
        >
          <Power class="w-3.5 h-3.5 mr-1" />
          {{ t('servers.start') }}
        </button>
        <button
          @click="handlePower(PowerAction.RESTART)"
          class="flex items-center px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
        >
          <RotateCcw class="w-3.5 h-3.5 mr-1" />
          {{ t('servers.restart') }}
        </button>
        <button
          @click="handlePower(PowerAction.STOP)"
          class="flex items-center px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-700 hover:bg-rose-600 text-white transition-colors"
        >
          <Square class="w-3.5 h-3.5 mr-1" />
          {{ t('servers.stop') }}
        </button>
        <button
          @click="showKillModal = true"
          class="flex items-center px-2.5 py-1 text-xs font-medium rounded-lg border border-rose-800 text-rose-400 hover:bg-rose-950 transition-colors"
          title="Force Kill (SIGKILL)"
        >
          <Skull class="w-3.5 h-3.5 mr-1" />
          Kill
        </button>

        <div class="h-4 w-px bg-slate-700 mx-1"></div>

        <button
          @click="clearConsole"
          class="p-1.5 text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
          title="Clear Console"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
        <button
          @click="toggleFullscreen"
          class="p-1.5 text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
          :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'"
        >
          <Minimize2 v-if="isFullscreen" class="w-3.5 h-3.5" />
          <Maximize2 v-else class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Terminal Canvas -->
    <div ref="terminalContainer" class="flex-1 p-3 overflow-hidden bg-[#0b0f17]"></div>

    <!-- Quick Command Preset Badges -->
    <div class="flex items-center space-x-2 px-3 py-1.5 bg-[#0f141f] border-t border-slate-800/80 overflow-x-auto text-[11px] font-mono">
      <span class="text-slate-500 text-[10px] uppercase font-sans">Quick Presets:</span>
      <button
        v-for="cmd in ['help', 'list', 'tps', 'version', 'say Hello world!']"
        :key="cmd"
        @click="sendCommand(cmd)"
        class="px-2 py-0.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60 hover:text-blue-400 transition-colors"
      >
        /{{ cmd }}
      </button>
    </div>

    <!-- Command Input Bar -->
    <div class="flex items-center p-2.5 bg-[#111622] border-t border-slate-800">
      <span class="text-blue-400 font-mono text-sm px-2 select-none font-bold">&gt;</span>
      <input
        v-model="commandInput"
        @keyup.enter="sendCommand()"
        @keydown.up.prevent="navigateHistory('up')"
        @keydown.down.prevent="navigateHistory('down')"
        type="text"
        placeholder="Type a console command... (Use ↑/↓ for history)"
        class="flex-1 bg-transparent border-none text-slate-200 font-mono text-xs focus:outline-none placeholder-slate-500"
      />
      <button
        @click="sendCommand()"
        class="flex items-center px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
      >
        <Send class="w-3.5 h-3.5 mr-1" />
        Send
      </button>
    </div>

    <!-- Force Kill Confirmation Modal -->
    <div v-if="showKillModal" class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-[#161b22] border border-rose-600/40 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div class="flex items-center space-x-2 text-rose-500">
            <AlertTriangle class="w-5 h-5" />
            <h3 class="text-sm font-bold text-white">Confirm Force Kill</h3>
          </div>
          <button @click="showKillModal = false" class="text-slate-400 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="text-xs text-slate-300 leading-relaxed">
          Sending a SIGKILL immediately aborts the container process without graceful shutdown. Unsaved world data or database transactions might be lost or corrupted.
        </p>

        <div class="flex justify-end space-x-2 pt-3 border-t border-slate-800">
          <button @click="showKillModal = false" class="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg">
            Cancel
          </button>
          <button @click="confirmKill" class="px-3.5 py-1.5 text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg flex items-center">
            <Skull class="w-3.5 h-3.5 mr-1.5" />
            Force Kill Now
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@import '@xterm/xterm/css/xterm.css';
</style>
