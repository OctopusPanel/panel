<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { ApiService } from '../../services/api.js';
import { Terminal as TerminalIcon, Send, Maximize2, Minimize2, Trash2 } from 'lucide-vue-next';
import { useServerStore } from '../../stores/server.js';
import { mapDaemonStats } from '../../utils/telemetry.js';

const props = defineProps<{
  serverUuid: string;
}>();

const serverStore = useServerStore();

const terminalContainer = ref<HTMLDivElement | null>(null);
const commandInput = ref('');
const isConnected = ref(false);
const isFullscreen = ref(false);

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
      background: '#08090d',
      foreground: '#f3f4f6',
      cursor: '#db982b',
      black: '#1a1d2b',
      red: '#f87171',
      green: '#3ecf8e',
      yellow: '#f59e0b',
      blue: '#60a5fa',
      magenta: '#a78bfa',
      cyan: '#38bdf8',
      white: '#f3f4f6',
    },
    convertEol: true,
    scrollback: 2500,
  });

  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(terminalContainer.value);

  await nextTick();
  fitAddon.fit();

  term.writeln('\x1b[38;2;219;152;43m[OctopusPanel Operations Deck]\x1b[0m Initializing secure xterm.js TTY session...');

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
        const eventName = parsed.event || parsed.type;
        const eventData = parsed.data !== undefined ? parsed.data : (Array.isArray(parsed.args) ? parsed.args[0] : parsed.args);

        if ((eventName === 'console_output' || eventName === 'console') && eventData !== undefined) {
          const out = String(eventData);
          term?.write(out.endsWith('\n') ? out : out + '\r\n');
        } else if (eventName === 'stats' && (eventData || parsed.args?.[0])) {
          const stats = (eventData || parsed.args?.[0]) as any;
          if (serverStore.currentServer && stats) {
            serverStore.currentServer.metrics = mapDaemonStats(stats, serverStore.currentServer.metrics);
          }
        } else if (eventName === 'status' && (eventData !== undefined || parsed.args?.[0])) {
          const newStatus = String(eventData ?? parsed.args?.[0]);
          if (serverStore.currentServer) {
            serverStore.currentServer.status = newStatus.toLowerCase();
          }
        } else if (eventName === 'token_expiring' || eventName === 'token_expired') {
          // Token heartbeat
        } else if (eventName === 'panel_notice' && (eventData || parsed.data)) {
          term?.writeln(`\r\n\x1b[33m[OctopusPanel] ${eventData || parsed.data}\x1b[0m\r\n`);
        } else if (!eventName) {
          term?.write(event.data + '\r\n');
        }
      } catch {
        term?.write(event.data);
      }
    };

    socket.onclose = () => {
      isConnected.value = false;
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
    class="flex flex-col bg-surface-deep border border-surface-border rounded-xl overflow-hidden shadow-2xl transition-all"
    :class="isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen w-screen border-none' : 'h-[580px]'"
  >
    <!-- Top Toolbar -->
    <div class="flex flex-wrap items-center justify-between px-4 py-2.5 bg-surface-card border-b border-surface-border gap-2">
      <!-- Status & TTY title -->
      <div class="flex items-center space-x-3">
        <TerminalIcon class="w-4 h-4 text-primary" />
        <span class="text-xs font-mono font-semibold text-slate-200">Interactive TTY Console</span>
        <span
          class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
          :class="isConnected ? 'bg-status-online/15 text-status-online border border-status-online/30' : 'bg-status-offline/15 text-status-offline border border-status-offline/30'"
        >
          <span class="w-1.5 h-1.5 rounded-full mr-1.5" :class="isConnected ? 'bg-status-online animate-pulse' : 'bg-status-offline'"></span>
          {{ isConnected ? 'Connected' : 'Offline' }}
        </span>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center space-x-2">

        <button
          @click="clearConsole"
          class="p-1.5 text-slate-400 hover:text-slate-200 border border-surface-border rounded-lg hover:bg-surface-elevated transition-colors"
          title="Clear Console"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
        <button
          @click="toggleFullscreen"
          class="p-1.5 text-slate-400 hover:text-white border border-surface-border rounded-lg hover:bg-surface-elevated transition-colors"
          :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'"
        >
          <Minimize2 v-if="isFullscreen" class="w-3.5 h-3.5" />
          <Maximize2 v-else class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Terminal Canvas -->
    <div ref="terminalContainer" class="flex-1 p-3 overflow-hidden bg-surface-deep"></div>

    <!-- Quick Command Preset Badges -->
    <div class="flex items-center space-x-2 px-3 py-1.5 bg-surface-deep border-t border-surface-border/60 overflow-x-auto text-[11px] font-mono">
      <span class="text-slate-400 text-[10px] uppercase font-sans">Quick Presets:</span>
      <button
        v-for="cmd in ['help', 'list', 'tps', 'version', 'say Hello world!']"
        :key="cmd"
        @click="sendCommand(cmd)"
        class="px-2 py-0.5 bg-surface-card hover:bg-surface-elevated text-slate-300 rounded border border-surface-border hover:text-primary-light transition-colors"
      >
        /{{ cmd }}
      </button>
    </div>

    <!-- Command Input Bar -->
    <div class="flex items-center p-2.5 bg-surface-card border-t border-surface-border">
      <span class="text-primary font-mono text-sm px-2 select-none font-bold">&gt;</span>
      <input
        v-model="commandInput"
        @keyup.enter="sendCommand()"
        @keydown.up.prevent="navigateHistory('up')"
        @keydown.down.prevent="navigateHistory('down')"
        type="text"
        placeholder="Type a console command... (Use ↑/↓ for history)"
        class="flex-1 bg-surface-deep border border-surface-border rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder-slate-500 mr-2"
      />
      <button
        @click="sendCommand()"
        class="flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-dark text-slate-950 transition-all shadow-md active:scale-[0.98]"
      >
        <Send class="w-3.5 h-3.5 mr-1" />
        Send
      </button>
    </div>


  </div>
</template>

<style>
@import '@xterm/xterm/css/xterm.css';
</style>
