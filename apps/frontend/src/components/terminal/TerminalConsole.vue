<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useI18n } from 'vue-i18n';
import { ApiService } from '../../services/api.js';
import { Terminal as TerminalIcon, Send, RotateCcw, Power, Square } from 'lucide-vue-next';
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

let term: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let socket: WebSocket | null = null;
let demoTimer: any = null;

async function initTerminal() {
  if (!terminalContainer.value) return;

  term = new Terminal({
    cursorBlink: true,
    fontFamily: 'Consolas, "Courier New", Courier, monospace',
    fontSize: 13,
    theme: {
      background: '#0d1117',
      foreground: '#c9d1d9',
      cursor: '#58a6ff',
      black: '#484f58',
      red: '#ff7b72',
      green: '#3fb950',
      yellow: '#d29922',
      blue: '#58a6ff',
      magenta: '#bc8cff',
      cyan: '#39c5cf',
      white: '#b1bac4',
    },
    convertEol: true,
  });

  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(terminalContainer.value);

  await nextTick();
  fitAddon.fit();

  term.writeln('\x1b[38;5;39m[OctopusPanel]\x1b[0m Connecting to server daemon stream...');

  await connectSocket();
}

async function connectSocket() {
  if (ApiService.isDemoMode()) {
    isConnected.value = true;
    term?.writeln('\x1b[32m[OctopusPanel]\x1b[0m Connected to daemon live terminal (Simulated Stream).\r\n');
    term?.writeln('\x1b[90m[18:30:00 INFO]: Preparing start region for dimension minecraft:overworld\x1b[0m');
    term?.writeln('\x1b[90m[18:30:01 INFO]: Preparing spawn area: 100%\x1b[0m');
    term?.writeln('\x1b[32m[18:30:02 INFO]: [Paper] Done (3.84s)! For help, type "help"\x1b[0m');
    term?.writeln('\x1b[38;5;39m[OctopusPanel] Node-DE-Frankfurt-01: Container active on port 25565\x1b[0m\r\n');

    demoTimer = setInterval(() => {
      const tps = (19.95 + Math.random() * 0.05).toFixed(2);
      const mem = Math.floor(1800 + Math.random() * 400);
      term?.writeln(`\x1b[90m[Heartbeat] TPS: ${tps} | Memory: ${mem} MB / 4096 MB | Active Threads: 24\x1b[0m`);
    }, 10000);
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
        } else if (parsed.event === 'panel_notice' && parsed.data) {
          term?.writeln(`\r\n\x1b[33m[OctopusPanel] ${parsed.data}\x1b[0m\r\n`);
        } else if (parsed.event === 'stats' || parsed.event === 'token_expiring' || parsed.event === 'token_expired') {
          // Internal daemon metrics and heartbeat, do not print raw JSON
        } else if (!parsed.event) {
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

function sendCommand() {
  if (!commandInput.value.trim()) return;

  const cmd = commandInput.value;
  term?.writeln(`\x1b[34m> ${cmd}\x1b[0m`);

  if (ApiService.isDemoMode()) {
    setTimeout(() => {
      const lower = cmd.toLowerCase().trim();
      if (lower === 'help') {
        term?.writeln('\x1b[33mAvailable commands: list, tps, version, memory, say <msg>, stop\x1b[0m');
      } else if (lower === 'list') {
        term?.writeln('\x1b[32mThere are 4 of a max of 50 players online: Alex, Max, Steve, Notch\x1b[0m');
      } else if (lower === 'tps') {
        term?.writeln('\x1b[32mTPS from last 1m, 5m, 15m: 20.0, 20.0, 19.98\x1b[0m');
      } else if (lower === 'version') {
        term?.writeln('\x1b[36mThis server is running Paper version git-Paper-128 (MC: 1.21.4) (Implementing API version 1.21.4-R0.1-SNAPSHOT)\x1b[0m');
      } else if (lower.startsWith('say ')) {
        term?.writeln(`\x1b[35m[Server] ${cmd.slice(4)}\x1b[0m`);
      } else {
        term?.writeln(`\x1b[90m[Server thread/INFO]: Executed command '${cmd}'\x1b[0m`);
      }
    }, 120);
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

async function handlePower(action: PowerAction) {
  try {
    await serverStore.sendPowerAction(props.serverUuid, action);
    term?.writeln(`\x1b[33m[OctopusPanel] Power action '${action}' triggered.\x1b[0m`);
    if (action === PowerAction.START && (!socket || socket.readyState !== WebSocket.OPEN)) {
      setTimeout(() => {
        connectSocket();
      }, 1200);
    }
  } catch (err: any) {
    const errText = err?.params?.error || err?.message || err?.code || (typeof err === 'object' ? JSON.stringify(err) : String(err));
    term?.writeln(`\x1b[31m[Power Error] ${errText}\x1b[0m`);
  }
}

function clearConsole() {
  term?.clear();
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
  <div class="flex flex-col h-[560px] bg-[#0d1117] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
    <!-- Header Controls -->
    <div class="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-slate-800">
      <div class="flex items-center space-x-3">
        <TerminalIcon class="w-4 h-4 text-blue-400" />
        <span class="text-xs font-mono font-semibold text-slate-200">{{ t('terminal.title') }}</span>
        <span
          class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
          :class="isConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'"
        >
          <span class="w-1.5 h-1.5 rounded-full mr-1.5" :class="isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'"></span>
          {{ isConnected ? t('terminal.statusConnected') : t('terminal.statusDisconnected') }}
        </span>
      </div>

      <!-- Power Quick Buttons -->
      <div class="flex items-center space-x-2">
        <button
          @click="handlePower(PowerAction.START)"
          class="flex items-center px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
        >
          <Power class="w-3 h-3 mr-1" />
          {{ t('servers.start') }}
        </button>
        <button
          @click="handlePower(PowerAction.RESTART)"
          class="flex items-center px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
        >
          <RotateCcw class="w-3 h-3 mr-1" />
          {{ t('servers.restart') }}
        </button>
        <button
          @click="handlePower(PowerAction.STOP)"
          class="flex items-center px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-700 hover:bg-rose-600 text-white transition-colors"
        >
          <Square class="w-3 h-3 mr-1" />
          {{ t('servers.stop') }}
        </button>
        <button
          @click="clearConsole"
          class="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
        >
          {{ t('terminal.clearConsole') }}
        </button>
      </div>
    </div>

    <!-- Terminal Canvas -->
    <div ref="terminalContainer" class="flex-1 p-3 overflow-hidden"></div>

    <!-- Command Input Bar -->
    <div class="flex items-center p-2.5 bg-[#161b22] border-t border-slate-800">
      <span class="text-blue-400 font-mono text-sm px-2 select-none">&gt;</span>
      <input
        v-model="commandInput"
        @keyup.enter="sendCommand"
        type="text"
        :placeholder="t('servers.enterCommand')"
        class="flex-1 bg-transparent border-none text-slate-200 font-mono text-xs focus:outline-none placeholder-slate-500"
      />
      <button
        @click="sendCommand"
        class="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800 transition-colors"
      >
        <Send class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>

<style>
@import '@xterm/xterm/css/xterm.css';
</style>
