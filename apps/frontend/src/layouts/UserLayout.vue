<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useServerStore } from '../stores/server.js';
import { useI18n } from 'vue-i18n';
import LanguageSwitcher from '../components/ui/LanguageSwitcher.vue';
import ModuleSlot from '../components/modules/ModuleSlot.vue';
import {
  LayoutDashboard,
  Server,
  Settings,
  ShieldAlert,
  LogOut,
  Terminal,
  Folder,
  Globe,
  Rocket,
  Archive,
  Database,
  Clock,
  Users,
} from 'lucide-vue-next';

const authStore = useAuthStore();
const serverStore = useServerStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const isServerSelected = computed(() => Boolean(route.params.id));
const currentServerId = computed(() => String(route.params.id || ''));

watch(
  () => route.params.id,
  (newId) => {
    if (newId && (!serverStore.currentServer || (serverStore.currentServer.uuid !== newId && serverStore.currentServer.identifier !== newId))) {
      serverStore.fetchServerDetails(String(newId));
    }
  },
  { immediate: true }
);

const serverTabs = [
  { id: 'console', label: 'Live Console', icon: Terminal },
  { id: 'files', label: 'File Manager', icon: Folder },
  { id: 'network', label: 'Network & Ports', icon: Globe },
  { id: 'startup', label: 'Startup & Variables', icon: Rocket },
  { id: 'backups', label: 'Backups', icon: Archive },
  { id: 'databases', label: 'Databases', icon: Database },
  { id: 'schedules', label: 'Schedules', icon: Clock },
  { id: 'subusers', label: 'Team & Sub-Users', icon: Users },
  { id: 'settings', label: 'Settings & Danger Zone', icon: Settings },
];

function isTabActive(tabId: string) {
  if (!isServerSelected.value) return false;
  const currentTab = (route.query.tab as string) || 'console';
  return currentTab === tabId;
}

function handleLogout() {
  authStore.logout();
  router.push('/auth/login');
}
</script>

<template>
  <div class="min-h-screen flex bg-[#0b0f17] text-slate-100">
    <!-- Sidebar -->
    <aside class="w-64 bg-[#111622] border-r border-slate-800/80 flex flex-col shrink-0">
      <!-- Logo -->
      <div class="h-16 flex items-center px-6 border-b border-slate-800/80">
        <span class="text-2xl mr-2.5">🐙</span>
        <div>
          <h1 class="text-sm font-bold tracking-tight text-white">OctopusPanel</h1>
          <p class="text-[10px] text-blue-400 font-medium">CLOUD &amp; GAME MANAGEMENT</p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <router-link
          to="/"
          class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          :class="{ 'bg-blue-600/10 text-blue-400 font-semibold border border-blue-500/20': !isServerSelected && route.path === '/' }"
        >
          <LayoutDashboard class="w-4 h-4 mr-3" />
          {{ t('nav.dashboard') }}
        </router-link>

        <router-link
          to="/"
          class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
        >
          <Server class="w-4 h-4 mr-3" />
          {{ t('nav.servers') }}
        </router-link>

        <!-- Selected Server Cockpit Navigation -->
        <div v-if="isServerSelected" class="pt-3 mt-2 border-t border-slate-800/80 space-y-1">
          <!-- Server Header in Sidebar -->
          <div class="px-2.5 py-2 rounded-lg bg-[#0b0f17] border border-slate-800/80 mb-2">
            <div class="flex items-center justify-between text-[10px] mb-1">
              <span class="font-mono font-bold text-slate-400">
                #{{ serverStore.currentServer?.identifier || currentServerId.slice(0, 8) }}
              </span>
              <span
                class="w-2 h-2 rounded-full"
                :class="serverStore.currentServer?.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'"
              ></span>
            </div>
            <p class="text-xs font-bold text-white truncate">
              {{ serverStore.currentServer?.name || 'Loading Server...' }}
            </p>
          </div>

          <div class="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Server Controls
          </div>

          <!-- 9 Cockpit Tabs -->
          <router-link
            v-for="tab in serverTabs"
            :key="tab.id"
            :to="{ path: `/server/${currentServerId}`, query: { tab: tab.id } }"
            class="flex items-center px-3 py-2 text-xs rounded-lg transition-colors group"
            :class="isTabActive(tab.id)
              ? 'bg-blue-600/15 text-blue-400 font-semibold border border-blue-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'"
          >
            <component
              :is="tab.icon"
              class="w-4 h-4 mr-3 shrink-0"
              :class="isTabActive(tab.id) ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'"
            />
            <span class="truncate">{{ tab.label }}</span>
          </router-link>

          <!-- Dynamic Module Slot for Server Plugins -->
          <div class="pt-1">
            <ModuleSlot slot-name="server:tabs" :context="{ serverUuid: currentServerId }" />
          </div>
        </div>

        <!-- Dynamic Module Slot for User Navigation -->
        <div v-if="!isServerSelected" class="pt-2">
          <ModuleSlot slot-name="sidebar:user:nav" />
        </div>
      </nav>

      <!-- Admin link if user is admin -->
      <div v-if="authStore.isAdmin" class="p-3 border-t border-slate-800/80">
        <router-link
          to="/admin/nodes"
          class="flex items-center px-3 py-2 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
        >
          <ShieldAlert class="w-4 h-4 mr-2.5" />
          {{ t('nav.adminArea') }}
        </router-link>
      </div>

      <!-- User footer -->
      <div class="p-3.5 border-t border-slate-800/80 flex items-center justify-between bg-[#0e121b]">
        <div class="flex items-center space-x-2.5 overflow-hidden">
          <div class="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs text-white uppercase shrink-0">
            {{ authStore.user?.username?.[0] || 'U' }}
          </div>
          <div class="truncate text-xs">
            <p class="font-medium text-slate-200 truncate">{{ authStore.user?.username }}</p>
            <p class="text-[10px] text-slate-400 truncate">{{ authStore.user?.email }}</p>
          </div>
        </div>
        <button
          @click="handleLogout"
          class="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
          :title="t('nav.logout')"
        >
          <LogOut class="w-4 h-4" />
        </button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Top Navbar -->
      <header class="h-16 bg-[#111622]/60 backdrop-blur-sm border-b border-slate-800/80 px-6 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <h2 class="text-sm font-semibold text-slate-200">{{ t('nav.clientArea') }}</h2>
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
            Demo Mode Active
          </span>
        </div>
        <div class="flex items-center space-x-4">
          <LanguageSwitcher />
        </div>
      </header>

      <!-- View Slot -->
      <main class="flex-1 p-6 overflow-y-auto">
        <router-view />
      </main>
    </div>
  </div>
</template>
