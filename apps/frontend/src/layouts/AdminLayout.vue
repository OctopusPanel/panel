<script setup lang="ts">
import { useAuthStore } from '../stores/auth.js';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import LanguageSwitcher from '../components/ui/LanguageSwitcher.vue';
import ModuleSlot from '../components/modules/ModuleSlot.vue';
import {
  Server,
  Network,
  Cpu,
  Layers,
  Users,
  Boxes,
  ArrowLeft,
  LogOut,
} from 'lucide-vue-next';

const authStore = useAuthStore();
const router = useRouter();
const { t } = useI18n();

function handleLogout() {
  authStore.logout();
  router.push('/auth/login');
}
</script>

<template>
  <div class="h-screen flex bg-[#0b0f17] text-slate-100 overflow-hidden">
    <!-- Admin Sidebar -->
    <aside class="w-64 bg-[#0e121d] border-r border-slate-800/80 flex flex-col shrink-0 h-full overflow-hidden">
      <!-- Logo -->
      <div class="h-14 flex items-center px-6 border-b border-slate-800/80 shrink-0">
        <span class="text-2xl mr-2.5">🛡️</span>
        <div>
          <h1 class="text-sm font-bold tracking-tight text-white">OctopusPanel</h1>
          <p class="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">ADMIN CONTROL</p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <router-link
          to="/admin/nodes"
          class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          active-class="bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20"
        >
          <Cpu class="w-4 h-4 mr-3" />
          {{ t('nav.nodes') }}
        </router-link>

        <router-link
          to="/admin/blueprints"
          class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          active-class="bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20"
        >
          <Layers class="w-4 h-4 mr-3" />
          {{ t('nav.blueprints') }}
        </router-link>

        <router-link
          to="/admin/allocations"
          class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          active-class="bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20"
        >
          <Network class="w-4 h-4 mr-3" />
          {{ t('nav.allocations') }}
        </router-link>

        <router-link
          to="/admin/servers"
          class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          active-class="bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20"
        >
          <Server class="w-4 h-4 mr-3" />
          {{ t('nav.servers') }}
        </router-link>

        <router-link
          to="/admin/users"
          class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          active-class="bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20"
        >
          <Users class="w-4 h-4 mr-3" />
          {{ t('nav.users') }}
        </router-link>

        <router-link
          to="/admin/modules"
          class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          active-class="bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20"
        >
          <Boxes class="w-4 h-4 mr-3" />
          {{ t('nav.modules') }}
        </router-link>

        <!-- Dynamic Module Slot for Admin Navigation -->
        <div class="pt-2">
          <ModuleSlot slot-name="sidebar:admin:nav" />
        </div>
      </nav>

      <!-- Return to Client Area -->
      <div class="p-3 border-t border-slate-800/80">
        <router-link
          to="/"
          class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft class="w-4 h-4 mr-2.5" />
          {{ t('nav.clientArea') }}
        </router-link>
      </div>

      <!-- User footer -->
      <div class="p-3.5 border-t border-slate-800/80 flex items-center justify-between bg-[#0b0e16]">
        <div class="flex items-center space-x-2.5 overflow-hidden">
          <div class="w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center font-bold text-xs text-white uppercase shrink-0">
            {{ authStore.user?.username?.[0] || 'A' }}
          </div>
          <div class="truncate text-xs">
            <p class="font-medium text-slate-200 truncate">{{ authStore.user?.username }}</p>
            <p class="text-[10px] text-amber-400 font-semibold uppercase">Administrator</p>
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
      <header class="h-14 bg-[#0e121d]/70 backdrop-blur-sm border-b border-slate-800/80 px-6 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <h2 class="text-sm font-semibold text-slate-200">{{ t('nav.adminArea') }}</h2>
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
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
