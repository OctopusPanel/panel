<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useServerStore } from '../stores/server.js';
import TerminalConsole from '../components/terminal/TerminalConsole.vue';
import FileManager from '../components/file-manager/FileManager.vue';
import ModuleSlot from '../components/modules/ModuleSlot.vue';
import { Terminal, Folder, Settings, Power, RotateCcw, Square, ArrowLeft } from 'lucide-vue-next';
import { PowerAction } from '@octopus/shared';

const route = useRoute();
const { t } = useI18n();
const serverStore = useServerStore();

const activeTab = ref<'console' | 'files' | 'settings'>('console');
const serverUuid = String(route.params.id);

onMounted(async () => {
  await serverStore.fetchServerDetails(serverUuid);
});

async function handlePower(action: PowerAction) {
  await serverStore.sendPowerAction(serverUuid, action);
  serverStore.fetchServerDetails(serverUuid);
}
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between pb-4 border-b border-slate-800">
      <div class="flex items-center space-x-3">
        <router-link to="/" class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
          <ArrowLeft class="w-4 h-4" />
        </router-link>
        <div>
          <div class="flex items-center space-x-2.5">
            <h1 class="text-lg font-bold text-white">{{ serverStore.currentServer?.name || 'Server' }}</h1>
            <span class="text-xs font-mono text-slate-400">#{{ serverStore.currentServer?.identifier }}</span>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">
            {{ serverStore.currentServer?.node?.name }} &bull; {{ serverStore.currentServer?.allocation?.ipAddress }}:{{ serverStore.currentServer?.allocation?.port }}
          </p>
        </div>
      </div>

      <!-- Power Controls -->
      <div class="flex items-center space-x-2">
        <button
          @click="handlePower(PowerAction.START)"
          class="flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
        >
          <Power class="w-3.5 h-3.5 mr-1.5" />
          {{ t('servers.start') }}
        </button>
        <button
          @click="handlePower(PowerAction.RESTART)"
          class="flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
        >
          <RotateCcw class="w-3.5 h-3.5 mr-1.5" />
          {{ t('servers.restart') }}
        </button>
        <button
          @click="handlePower(PowerAction.STOP)"
          class="flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-700 hover:bg-rose-600 text-white transition-colors"
        >
          <Square class="w-3.5 h-3.5 mr-1.5" />
          {{ t('servers.stop') }}
        </button>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="flex items-center space-x-1 border-b border-slate-800 pb-px">
      <button
        @click="activeTab = 'console'"
        class="flex items-center px-4 py-2.5 text-xs font-medium border-b-2 transition-colors"
        :class="activeTab === 'console' ? 'border-blue-500 text-blue-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        <Terminal class="w-3.5 h-3.5 mr-2" />
        {{ t('servers.console') }}
      </button>

      <button
        @click="activeTab = 'files'"
        class="flex items-center px-4 py-2.5 text-xs font-medium border-b-2 transition-colors"
        :class="activeTab === 'files' ? 'border-blue-500 text-blue-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        <Folder class="w-3.5 h-3.5 mr-2" />
        {{ t('servers.files') }}
      </button>

      <button
        @click="activeTab = 'settings'"
        class="flex items-center px-4 py-2.5 text-xs font-medium border-b-2 transition-colors"
        :class="activeTab === 'settings' ? 'border-blue-500 text-blue-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        <Settings class="w-3.5 h-3.5 mr-2" />
        {{ t('servers.settings') }}
      </button>

      <!-- Dynamic Module Slot for Extra Server Tabs -->
      <ModuleSlot slot-name="server:tabs" :context="{ serverUuid }" />
    </div>

    <!-- Tab Contents -->
    <div v-if="activeTab === 'console'">
      <TerminalConsole :server-uuid="serverUuid" />
    </div>

    <div v-else-if="activeTab === 'files'">
      <FileManager :server-uuid="serverUuid" />
    </div>

    <div v-else-if="activeTab === 'settings'" class="bg-[#111622] border border-slate-800 rounded-xl p-6">
      <h3 class="text-sm font-semibold text-slate-100 mb-4">{{ t('servers.settings') }}</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        <div class="bg-[#0b0f17] p-3 rounded-lg border border-slate-800">
          <span class="text-slate-500 block mb-1">Docker Image</span>
          <span class="text-slate-200">{{ serverStore.currentServer?.dockerImage }}</span>
        </div>
        <div class="bg-[#0b0f17] p-3 rounded-lg border border-slate-800">
          <span class="text-slate-500 block mb-1">Provider Type</span>
          <span class="text-slate-200">{{ serverStore.currentServer?.providerType }}</span>
        </div>
        <div class="col-span-2 bg-[#0b0f17] p-3 rounded-lg border border-slate-800">
          <span class="text-slate-500 block mb-1">Startup Command</span>
          <span class="text-slate-200">{{ serverStore.currentServer?.startupCommand }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
