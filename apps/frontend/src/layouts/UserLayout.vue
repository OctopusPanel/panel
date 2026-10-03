<script setup lang="ts">
import { useAuthStore } from '../stores/auth.js';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import LanguageSwitcher from '../components/ui/LanguageSwitcher.vue';
import ModuleSlot from '../components/modules/ModuleSlot.vue';
import { LayoutDashboard, Server, Settings, ShieldAlert, LogOut } from 'lucide-vue-next';

const authStore = useAuthStore();
const router = useRouter();
const { t } = useI18n();

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
          active-class="bg-blue-600/10 text-blue-400 font-semibold border border-blue-500/20"
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

        <!-- Dynamic Module Slot for User Navigation -->
        <div class="pt-2">
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
        <div class="flex items-center space-x-4">
          <h2 class="text-sm font-semibold text-slate-200">{{ t('nav.clientArea') }}</h2>
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
