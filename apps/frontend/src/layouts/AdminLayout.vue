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
    <aside class="w-64 bg-[#111622] border-r border-slate-800/80 flex flex-col shrink-0 h-full overflow-hidden">
      <!-- Logo -->
      <div class="h-14 flex items-center px-5 border-b border-slate-800/80 shrink-0">
        <span class="text-2xl mr-2.5">🐙</span>
        <div>
          <h1 class="text-sm font-bold tracking-tight text-white leading-tight">OctopusPanel</h1>
          <p class="text-[9px] text-amber-400 font-semibold tracking-wider uppercase">ADMIN CONTROL</p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-2.5 py-2 space-y-0.5 overflow-y-auto">
        <div class="px-2 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Infrastructure & System
        </div>

        <router-link
          to="/admin/nodes"
          class="flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          active-class="bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/30"
        >
          <Cpu class="w-3.5 h-3.5 mr-2.5 shrink-0" />
          {{ t('nav.nodes') }}
        </router-link>

        <router-link
          to="/admin/blueprints"
          class="flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          active-class="bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/30"
        >
          <Layers class="w-3.5 h-3.5 mr-2.5 shrink-0" />
          {{ t('nav.blueprints') }}
        </router-link>

        <router-link
          to="/admin/allocations"
          class="flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          active-class="bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/30"
        >
          <Network class="w-3.5 h-3.5 mr-2.5 shrink-0" />
          {{ t('nav.allocations') }}
        </router-link>

        <router-link
          to="/admin/servers"
          class="flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          active-class="bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/30"
        >
          <Server class="w-3.5 h-3.5 mr-2.5 shrink-0" />
          {{ t('nav.servers') }}
        </router-link>

        <router-link
          to="/admin/users"
          class="flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          active-class="bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/30"
        >
          <Users class="w-3.5 h-3.5 mr-2.5 shrink-0" />
          {{ t('nav.users') }}
        </router-link>

        <router-link
          to="/admin/modules"
          class="flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          active-class="bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/30"
        >
          <Boxes class="w-3.5 h-3.5 mr-2.5 shrink-0" />
          {{ t('nav.modules') }}
        </router-link>

        <!-- Dynamic Module Slot for Admin Navigation -->
        <div class="pt-1">
          <ModuleSlot slot-name="sidebar:admin:nav" />
        </div>
      </nav>

      <!-- Return to Client Area -->
      <div class="p-2 border-t border-slate-800/80 shrink-0">
        <router-link
          to="/"
          class="flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
        >
          <ArrowLeft class="w-3.5 h-3.5 mr-2 shrink-0" />
          {{ t('nav.clientArea') }}
        </router-link>
      </div>

      <!-- User footer -->
      <div class="p-2.5 border-t border-slate-800/80 flex items-center justify-between bg-[#0e121b] shrink-0">
        <div class="flex items-center space-x-2 overflow-hidden min-w-0">
          <div class="w-6 h-6 rounded-full bg-amber-600 flex items-center justify-center font-bold text-[10px] text-white uppercase shrink-0">
            {{ authStore.user?.username?.[0] || 'A' }}
          </div>
          <div class="truncate text-xs min-w-0">
            <p class="font-medium text-slate-200 truncate leading-tight">{{ authStore.user?.username }}</p>
            <p class="text-[10px] text-amber-400 font-semibold uppercase leading-tight">Administrator</p>
          </div>
        </div>
        <button
          @click="handleLogout"
          class="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          :title="t('nav.logout')"
        >
          <LogOut class="w-3.5 h-3.5" />
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
