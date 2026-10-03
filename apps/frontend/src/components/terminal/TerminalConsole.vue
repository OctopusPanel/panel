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
  try {
    const res = await ApiService.get<{ token: string; socketUrl: string }>(
      `/client/servers/${props.serverUuid}/ws-token`,
    );

    const wsUrl = `${res.socketUrl}?token=${res.token}`;
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      isConnected.value = true;
      term?.writeln('\x1b[32m[OctopusPanel]\x1b[0m Connected to daemon live terminal.\r\n');
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.event === 'console_output' && parsed.args?.[0]) {
          term?.write(parsed.args[0] + '\r\n');
        } else {
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
    term?.writeln(`\r\n\x1b[31m[OctopusPanel] Failed to establish terminal session: ${err.message || err}\x1b[0m`);
  }
}

function sendCommand() {
  if (!commandInput.value.trim()) return;

  const cmd = commandInput.value;
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event: 'send_command', args: [cmd] }));
    term?.writeln(`\x1b[34m> ${cmd}\x1b[0m`);
  } else {
    term?.writeln(`\x1b[33m[Warning] Terminal not connected. Command not dispatched.\x1b[0m`);
  }
  commandInput.value = '';
}

async function handlePower(action: PowerAction) {
  try {
    await serverStore.sendPowerAction(props.serverUuid, action);
  } catch (err: any) {
    term?.writeln(`\x1b[31m[Power Error] ${err.message || 'Action failed'}\x1b[0m`);
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
