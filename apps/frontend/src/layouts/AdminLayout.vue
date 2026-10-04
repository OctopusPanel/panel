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
  RefreshCw,
  ArrowLeft,
  LogOut,
} from 'lucide-vue-next';

import { ApiService } from '../services/api.js';

const authStore = useAuthStore();
const router = useRouter();
const { t } = useI18n();
const isDemoMode = ApiService.isDemoMode();

function handleLogout() {
  authStore.logout();
  router.push('/auth/login');
}
</script>

<template>
  <div class="h-screen flex bg-surface-base text-slate-100 overflow-hidden">
    <!-- Admin Sidebar -->
    <aside class="w-64 bg-surface-deep border-r border-surface-border flex flex-col shrink-0 h-full overflow-hidden shadow-xl">
      <!-- Logo -->
      <div class="h-14 flex items-center px-5 border-b border-surface-border shrink-0">
        <span class="text-2xl mr-2.5">🐙</span>
        <div>
          <h1 class="text-sm font-bold tracking-tight text-white leading-tight">OctopusPanel</h1>
          <p class="text-[9px] text-primary font-semibold tracking-wider uppercase">ADMIN CONTROL</p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-2.5 py-2.5 space-y-1 overflow-y-auto">
        <div class="px-2.5 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Infrastructure & System
        </div>

        <router-link
          to="/admin/nodes"
          class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-surface-card transition-all"
          active-class="bg-primary/15 text-primary-light font-semibold border border-primary/30 shadow-sm"
        >
          <Cpu class="w-3.5 h-3.5 mr-2.5 shrink-0" />
          {{ t('nav.nodes') }}
        </router-link>

        <router-link
          to="/admin/blueprints"
          class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-surface-card transition-all"
          active-class="bg-primary/15 text-primary-light font-semibold border border-primary/30 shadow-sm"
        >
          <Layers class="w-3.5 h-3.5 mr-2.5 shrink-0" />
          {{ t('nav.blueprints') }}
        </router-link>

        <router-link
          to="/admin/allocations"
          class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-surface-card transition-all"
          active-class="bg-primary/15 text-primary-light font-semibold border border-primary/30 shadow-sm"
        >
          <Network class="w-3.5 h-3.5 mr-2.5 shrink-0" />
          {{ t('nav.allocations') }}
        </router-link>

        <router-link
          to="/admin/servers"
          class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-surface-card transition-all"
          active-class="bg-primary/15 text-primary-light font-semibold border border-primary/30 shadow-sm"
        >
          <Server class="w-3.5 h-3.5 mr-2.5 shrink-0" />
          {{ t('nav.servers') }}
        </router-link>

        <router-link
          to="/admin/users"
          class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-surface-card transition-all"
          active-class="bg-primary/15 text-primary-light font-semibold border border-primary/30 shadow-sm"
        >
          <Users class="w-3.5 h-3.5 mr-2.5 shrink-0" />
          {{ t('nav.users') }}
        </router-link>

        <router-link
          to="/admin/modules"
          class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-surface-card transition-all"
          active-class="bg-primary/15 text-primary-light font-semibold border border-primary/30 shadow-sm"
        >
          <Boxes class="w-3.5 h-3.5 mr-2.5 shrink-0" />
          {{ t('nav.modules') }}
        </router-link>

        <router-link
          to="/admin/system"
          class="flex items-center px-3 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white hover:bg-surface-card transition-all"
          active-class="bg-primary/15 text-primary-light font-semibold border border-primary/30 shadow-sm"
        >
          <RefreshCw class="w-3.5 h-3.5 mr-2.5 shrink-0" />
          {{ t('nav.system') }}
        </router-link>

        <!-- Dynamic Module Slot for Admin Navigation -->
        <div class="pt-1">
          <ModuleSlot slot-name="sidebar:admin:nav" />
        </div>
      </nav>

      <!-- Return to Client Area -->
      <div class="p-2.5 border-t border-surface-border shrink-0">
        <router-link
          to="/"
          class="flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-card text-slate-200 border border-surface-border hover:bg-surface-elevated transition-colors"
        >
          <ArrowLeft class="w-3.5 h-3.5 mr-2 shrink-0 text-primary" />
          {{ t('nav.clientArea') }}
        </router-link>
      </div>

      <!-- User footer -->
      <div class="p-3 border-t border-surface-border flex items-center justify-between bg-surface-deep shrink-0">
        <div class="flex items-center space-x-2.5 overflow-hidden min-w-0">
          <div class="w-7 h-7 rounded-full bg-primary flex items-center justify-center font-bold text-[11px] text-slate-950 uppercase shrink-0">
            {{ authStore.user?.username?.[0] || 'A' }}
          </div>
          <div class="truncate text-xs min-w-0">
            <p class="font-medium text-slate-200 truncate leading-tight">{{ authStore.user?.username }}</p>
            <p class="text-[10px] text-primary-light font-semibold uppercase leading-tight">Administrator</p>
          </div>
        </div>
        <button
          @click="handleLogout"
          class="p-1.5 text-slate-400 hover:text-status-offline rounded-lg hover:bg-surface-elevated transition-colors shrink-0"
          :title="t('nav.logout')"
        >
          <LogOut class="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col min-w-0 bg-surface-base">
      <!-- Top Navbar -->
      <header class="h-14 bg-surface-deep/90 backdrop-blur-md border-b border-surface-border px-6 flex items-center justify-between shrink-0">
        <div class="flex items-center space-x-3">
          <h2 class="text-sm font-semibold text-slate-200">{{ t('nav.adminArea') }}</h2>
          <span v-if="isDemoMode" class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary-light border border-primary/20">
            <span class="w-1.5 h-1.5 rounded-full bg-status-online mr-1.5 animate-pulse"></span>
            Demo Mode Active
          </span>
        </div>
        <div class="flex items-center space-x-4">
          <LanguageSwitcher />
        </div>
      </header>

      <!-- View Slot with Transition -->
      <main class="flex-1 p-6 overflow-y-auto">
        <router-view v-slot="{ Component }">
          <transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>
