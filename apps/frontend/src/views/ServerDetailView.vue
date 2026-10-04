<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ApiService } from '../services/api.js';
import { useServerStore } from '../stores/server.js';
import { mapDaemonStats } from '../utils/telemetry.js';
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
import ButtonSpinner from '../components/ui/ButtonSpinner.vue';
import {
  Power,
  RotateCcw,
  Square,
  Skull,
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
  initTelemetrySocket();
});

let telemetrySocket: WebSocket | null = null;

async function initTelemetrySocket() {
  if (ApiService.isDemoMode()) return;
  try {
    const res = await ApiService.get<{ token: string; socketUrl: string }>(
      `/client/servers/${serverUuid}/ws-token`,
    );
    const wsUrl = `${res.socketUrl}?token=${res.token}`;
    telemetrySocket = new WebSocket(wsUrl);

    telemetrySocket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        const eventName = parsed.event || parsed.type;
        const eventData = parsed.data !== undefined ? parsed.data : (Array.isArray(parsed.args) ? parsed.args[0] : parsed.args);

        if (eventName === 'stats' && (eventData || parsed.args?.[0])) {
          const stats = (eventData || parsed.args?.[0]) as any;
          if (serverStore.currentServer && stats) {
            serverStore.currentServer.metrics = mapDaemonStats(stats, serverStore.currentServer.metrics);
          }
        } else if (eventName === 'status' && (eventData !== undefined || parsed.args?.[0])) {
          const newStatus = String(eventData ?? parsed.args?.[0]);
          if (serverStore.currentServer && newStatus) {
            serverStore.currentServer.status = newStatus.toLowerCase();
          }
        }
      } catch {}
    };

    telemetrySocket.onclose = () => {
      telemetrySocket = null;
    };
  } catch {}
}

onBeforeUnmount(() => {
  if (telemetrySocket) {
    telemetrySocket.close();
    telemetrySocket = null;
  }
});

const activePowerAction = ref<PowerAction | null>(null);

async function handlePower(action: PowerAction) {
  if (activePowerAction.value !== null) return;
  activePowerAction.value = action;
  try {
    await serverStore.sendPowerAction(serverUuid, action);
    await serverStore.fetchServerDetails(serverUuid);
  } catch (err) {
    console.error('Power action failed:', err);
  } finally {
    activePowerAction.value = null;
  }
}
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto pb-12">
    <!-- Server Top Header Bar Card -->
    <div class="bg-surface-card border border-surface-border rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center space-x-3.5">
        <router-link
          to="/"
          class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-surface-elevated transition-colors"
          title="Back to Dashboard"
        >
          <ArrowLeft class="w-4 h-4" />
        </router-link>
        <div>
          <div class="flex items-center space-x-2.5">
            <h1 class="text-lg font-bold text-white tracking-tight">
              {{ serverStore.currentServer?.name || 'Server Operations Cockpit' }}
            </h1>
            <span class="text-xs font-mono text-primary-light bg-primary/10 px-2 py-0.5 rounded border border-primary/30">
              #{{ serverStore.currentServer?.identifier }}
            </span>
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider"
              :class="serverStore.currentServer?.status === 'running' ? 'bg-status-online/15 text-status-online border border-status-online/30' : 'bg-surface-deep text-slate-400 border border-surface-border'"
            >
              <span
                class="w-1.5 h-1.5 rounded-full mr-1.5"
                :class="serverStore.currentServer?.status === 'running' ? 'bg-status-online animate-pulse' : 'bg-slate-500'"
              ></span>
              {{ serverStore.currentServer?.status?.toUpperCase() || 'OFFLINE' }}
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-1 flex items-center space-x-2 font-mono">
            <span>{{ serverStore.currentServer?.node?.name }}</span>
            <span class="text-surface-border">&bull;</span>
            <span class="text-slate-300">{{ serverStore.currentServer?.allocation?.ipAddress }}:{{ serverStore.currentServer?.allocation?.port }}</span>
            <span v-if="serverStore.currentServer?.allocation?.alias" class="text-primary-light font-sans">
              ({{ serverStore.currentServer?.allocation?.alias }})
            </span>
          </p>
        </div>
      </div>

      <!-- Header Power Controls (Tactile with ButtonSpinner & Click Lock) -->
      <div class="flex items-center space-x-2">
        <ButtonSpinner
          :loading="activePowerAction === PowerAction.START"
          :disabled="activePowerAction !== null"
          spinner-color="white"
          @click="handlePower(PowerAction.START)"
          class="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-status-online hover:bg-emerald-600 text-slate-950 transition-all shadow-md active:scale-[0.98]"
        >
          <Power class="w-3.5 h-3.5 mr-1.5" />
          {{ t('servers.start') }}
        </ButtonSpinner>
        <ButtonSpinner
          :loading="activePowerAction === PowerAction.RESTART"
          :disabled="activePowerAction !== null"
          spinner-color="white"
          @click="handlePower(PowerAction.RESTART)"
          class="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-dark text-slate-950 transition-all shadow-md active:scale-[0.98]"
        >
          <RotateCcw class="w-3.5 h-3.5 mr-1.5" />
          {{ t('servers.restart') }}
        </ButtonSpinner>
        <ButtonSpinner
          :loading="activePowerAction === PowerAction.STOP"
          :disabled="activePowerAction !== null"
          spinner-color="white"
          @click="handlePower(PowerAction.STOP)"
          class="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-status-offline hover:bg-rose-600 text-slate-950 transition-all shadow-md active:scale-[0.98]"
        >
          <Square class="w-3.5 h-3.5 mr-1.5" />
          {{ t('servers.stop') }}
        </ButtonSpinner>
        <ButtonSpinner
          :loading="activePowerAction === PowerAction.KILL"
          :disabled="activePowerAction !== null"
          spinner-color="white"
          @click="handlePower(PowerAction.KILL)"
          class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-elevated hover:bg-rose-950/80 text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-500/60 transition-all shadow-md active:scale-[0.98]"
          title="Force Kill Container"
        >
          <Skull class="w-3.5 h-3.5 mr-1.5" />
          Kill
        </ButtonSpinner>
      </div>
    </div>

    <!-- Persistent Top Telemetry Deck (Always Visible) -->
    <TelemetryDeck v-if="serverStore.currentServer" :server="serverStore.currentServer" />

    <!-- Sub-Nav Tab Pills -->
    <div class="flex items-center space-x-1.5 overflow-x-auto pb-1 border-b border-surface-border/60">
      <button
        v-for="tId in ['console', 'files', 'network', 'startup', 'backups', 'databases', 'schedules', 'subusers', 'settings']"
        :key="tId"
        @click="activeTab = tId as TabType"
        class="px-3.5 py-1.5 text-xs rounded-lg font-medium transition-all shrink-0 capitalize"
        :class="activeTab === tId
          ? 'bg-primary/15 text-primary-light font-semibold border border-primary/30 shadow-sm'
          : 'text-slate-400 hover:text-slate-200 hover:bg-surface-card'"
      >
        {{ tId }}
      </button>
    </div>

    <!-- Active Tab Workspace Container with Fluid Transition -->
    <div class="mt-4">
      <transition name="fade-slide" mode="out-in">
        <component
          :is="activeTab === 'console' ? CockpitConsoleTab
            : activeTab === 'files' ? CockpitFilesTab
            : activeTab === 'network' ? CockpitNetworkTab
            : activeTab === 'startup' ? CockpitStartupTab
            : activeTab === 'backups' ? CockpitBackupsTab
            : activeTab === 'databases' ? CockpitDatabasesTab
            : activeTab === 'schedules' ? CockpitSchedulesTab
            : activeTab === 'subusers' ? CockpitSubusersTab
            : CockpitSettingsTab"
          :key="activeTab"
          :server-uuid="serverUuid"
          :server="serverStore.currentServer"
        />
      </transition>
    </div>

    <!-- Dynamic Module Slot for Extra Server Extensions -->
    <ModuleSlot slot-name="server:tabs" :context="{ serverUuid }" />
  </div>
</template>
