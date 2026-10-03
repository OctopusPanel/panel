<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useServerStore } from '../stores/server.js';
import TelemetryDeck from '../components/cockpit/TelemetryDeck.vue';
import CockpitConsoleTab from '../components/cockpit/CockpitConsoleTab.vue';
import CockpitFilesTab from '../components/cockpit/CockpitFilesTab.vue';
import CockpitNetworkTab from '../components/cockpit/CockpitNetworkTab.vue';
import CockpitStartupTab from '../components/cockpit/CockpitStartupTab.vue';
import CockpitBackupsTab from '../components/cockpit/CockpitBackupsTab.vue';
import CockpitDatabasesTab from '../components/cockpit/CockpitDatabasesTab.vue';
import CockpitSchedulesTab from '../components/cockpit/CockpitSchedulesTab.vue';
import CockpitSubusersTab from '../components/cockpit/CockpitSubusersTab.vue';
import CockpitSettingsTab from '../components/cockpit/CockpitSettingsTab.vue';
import ModuleSlot from '../components/modules/ModuleSlot.vue';
import {
  Power,
  RotateCcw,
  Square,
  ArrowLeft,
} from 'lucide-vue-next';
import { PowerAction } from '@octopus/shared';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const serverStore = useServerStore();

type TabType =
  | 'console'
  | 'files'
  | 'network'
  | 'startup'
  | 'backups'
  | 'databases'
  | 'schedules'
  | 'subusers'
  | 'settings';

const activeTab = computed<TabType>({
  get: () => {
    const tab = route.query.tab as TabType;
    const validTabs: TabType[] = [
      'console',
      'files',
      'network',
      'startup',
      'backups',
      'databases',
      'schedules',
      'subusers',
      'settings',
    ];
    return validTabs.includes(tab) ? tab : 'console';
  },
  set: (val: TabType) => {
    router.replace({ query: { ...route.query, tab: val } });
  },
});

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
  <div class="space-y-6 max-w-7xl mx-auto pb-12">
    <!-- Server Top Header Bar -->
    <div class="flex flex-wrap items-center justify-between pb-4 border-b border-slate-800 gap-4">
      <div class="flex items-center space-x-3.5">
        <router-link
          to="/"
          class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Back to Dashboard"
        >
          <ArrowLeft class="w-4 h-4" />
        </router-link>
        <div>
          <div class="flex items-center space-x-2.5">
            <h1 class="text-lg font-bold text-white tracking-tight">
              {{ serverStore.currentServer?.name || 'Server Operations Cockpit' }}
            </h1>
            <span class="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
              #{{ serverStore.currentServer?.identifier }}
            </span>
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
              :class="serverStore.currentServer?.status === 'running' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'"
            >
              <span
                class="w-1.5 h-1.5 rounded-full mr-1.5"
                :class="serverStore.currentServer?.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'"
              ></span>
              {{ serverStore.currentServer?.status?.toUpperCase() || 'OFFLINE' }}
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-1 flex items-center space-x-2 font-mono">
            <span>{{ serverStore.currentServer?.node?.name }}</span>
            <span class="text-slate-600">&bull;</span>
            <span>{{ serverStore.currentServer?.allocation?.ipAddress }}:{{ serverStore.currentServer?.allocation?.port }}</span>
            <span v-if="serverStore.currentServer?.allocation?.alias" class="text-blue-400 font-sans">
              ({{ serverStore.currentServer?.allocation?.alias }})
            </span>
          </p>
        </div>
      </div>

      <!-- Header Power Controls -->
      <div class="flex items-center space-x-2">
        <button
          @click="handlePower(PowerAction.START)"
          class="flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-lg shadow-emerald-600/10"
        >
          <Power class="w-3.5 h-3.5 mr-1.5" />
          {{ t('servers.start') }}
        </button>
        <button
          @click="handlePower(PowerAction.RESTART)"
          class="flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors shadow-lg shadow-amber-600/10"
        >
          <RotateCcw class="w-3.5 h-3.5 mr-1.5" />
          {{ t('servers.restart') }}
        </button>
        <button
          @click="handlePower(PowerAction.STOP)"
          class="flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-700 hover:bg-rose-600 text-white transition-colors shadow-lg shadow-rose-700/10"
        >
          <Square class="w-3.5 h-3.5 mr-1.5" />
          {{ t('servers.stop') }}
        </button>
      </div>
    </div>

    <!-- Persistent Top Telemetry Deck (Always Visible) -->
    <TelemetryDeck v-if="serverStore.currentServer" :server="serverStore.currentServer" />


    <!-- Active Tab Workspace Container -->
    <div class="mt-4">
      <CockpitConsoleTab v-if="activeTab === 'console'" :server-uuid="serverUuid" />
      <CockpitFilesTab v-else-if="activeTab === 'files'" :server-uuid="serverUuid" />
      <CockpitNetworkTab v-else-if="activeTab === 'network'" :server-uuid="serverUuid" />
      <CockpitStartupTab v-else-if="activeTab === 'startup'" :server-uuid="serverUuid" />
      <CockpitBackupsTab v-else-if="activeTab === 'backups'" :server-uuid="serverUuid" />
      <CockpitDatabasesTab v-else-if="activeTab === 'databases'" :server-uuid="serverUuid" />
      <CockpitSchedulesTab v-else-if="activeTab === 'schedules'" :server-uuid="serverUuid" />
      <CockpitSubusersTab v-else-if="activeTab === 'subusers'" :server-uuid="serverUuid" />
      <CockpitSettingsTab v-else-if="activeTab === 'settings'" :server="serverStore.currentServer" />
    </div>

    <!-- Dynamic Module Slot for Extra Server Extensions -->
    <ModuleSlot slot-name="server:tabs" :context="{ serverUuid }" />
  </div>
</template>
