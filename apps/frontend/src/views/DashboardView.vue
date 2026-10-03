<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServerStore } from '../stores/server.js';
import { PowerAction, ServerStatus } from '@octopus/shared';
import ModuleSlot from '../components/modules/ModuleSlot.vue';
import { Server as ServerIcon, Power, Square, RotateCcw, Cpu, HardDrive, PlusCircle, ArrowRight } from 'lucide-vue-next';

const { t } = useI18n();
const serverStore = useServerStore();

onMounted(() => {
  serverStore.fetchServers();
});

async function handlePower(id: number | string, action: PowerAction, e: Event) {
  e.stopPropagation();
  e.preventDefault();
  await serverStore.sendPowerAction(id, action);
  serverStore.fetchServers();
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case ServerStatus.RUNNING:
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case ServerStatus.STARTING:
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse';
    case ServerStatus.STOPPING:
    case ServerStatus.SUSPENDED:
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  }
}
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-white">{{ t('dashboard.title') }}</h1>
        <p class="text-xs text-slate-400 mt-1">{{ t('dashboard.subtitle') }}</p>
      </div>

      <router-link
        to="/admin/servers"
        class="flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg shadow-blue-500/10"
      >
        <PlusCircle class="w-4 h-4 mr-2" />
        {{ t('dashboard.createFirstServer') }}
      </router-link>
    </div>

    <!-- Dynamic Module Slot for Dashboard Widgets -->
    <ModuleSlot slot-name="dashboard:widgets" />

    <!-- Servers List / Grid -->
    <div v-if="serverStore.isLoading" class="p-12 text-center text-sm font-mono text-slate-500">
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="serverStore.servers.length === 0"
      class="bg-[#111622] border border-slate-800 rounded-2xl p-12 text-center"
    >
      <ServerIcon class="w-12 h-12 text-slate-600 mx-auto mb-4" />
      <h3 class="text-sm font-semibold text-slate-200">{{ t('dashboard.noServers') }}</h3>
      <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto mb-6">
        You don't have any server instances deployed yet. Create your first server now.
      </p>
      <router-link
        to="/admin/servers"
        class="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
      >
        <PlusCircle class="w-4 h-4 mr-2" />
        {{ t('dashboard.createFirstServer') }}
      </router-link>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <router-link
        v-for="server in serverStore.servers"
        :key="server.id"
        :to="`/server/${server.uuid}`"
        class="group bg-[#111622] hover:bg-[#141b2a] border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 transition-all shadow-lg flex flex-col justify-between"
      >
        <div>
          <!-- Top Row: Name & Status -->
          <div class="flex items-start justify-between mb-3">
            <div>
              <h3 class="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                {{ server.name }}
              </h3>
              <span class="text-[10px] font-mono text-slate-400">#{{ server.identifier }}</span>
            </div>
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border"
              :class="getStatusBadgeClass(server.status)"
            >
              {{ server.status }}
            </span>
          </div>

          <!-- Specs -->
          <div class="grid grid-cols-2 gap-2 my-4 text-xs font-mono">
            <div class="bg-[#0b0f17] p-2.5 rounded-lg border border-slate-800/80">
              <span class="text-[10px] text-slate-500 block mb-0.5 flex items-center">
                <Cpu class="w-3 h-3 mr-1 text-slate-400" />
                {{ t('servers.memory') }}
              </span>
              <span class="text-slate-200 font-semibold">{{ server.memory }} MB</span>
            </div>

            <div class="bg-[#0b0f17] p-2.5 rounded-lg border border-slate-800/80">
              <span class="text-[10px] text-slate-500 block mb-0.5 flex items-center">
                <HardDrive class="w-3 h-3 mr-1 text-slate-400" />
                {{ t('servers.disk') }}
              </span>
              <span class="text-slate-200 font-semibold">{{ Math.round(server.disk / 1024) }} GB</span>
            </div>
          </div>
        </div>

        <!-- Card Footer: Quick Power & Open -->
        <div class="pt-3 border-t border-slate-800/60 flex items-center justify-between">
          <div class="flex items-center space-x-1.5" @click.stop>
            <button
              @click="handlePower(server.id, PowerAction.START, $event)"
              class="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors"
              :title="t('servers.start')"
            >
              <Power class="w-3.5 h-3.5" />
            </button>
            <button
              @click="handlePower(server.id, PowerAction.RESTART, $event)"
              class="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded-md transition-colors"
              :title="t('servers.restart')"
            >
              <RotateCcw class="w-3.5 h-3.5" />
            </button>
            <button
              @click="handlePower(server.id, PowerAction.STOP, $event)"
              class="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
              :title="t('servers.stop')"
            >
              <Square class="w-3.5 h-3.5" />
            </button>
          </div>

          <span class="text-xs text-slate-400 group-hover:text-blue-400 flex items-center transition-colors">
            Manage
            <ArrowRight class="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </router-link>
    </div>
  </div>
</template>
