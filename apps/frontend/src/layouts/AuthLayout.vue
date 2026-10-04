<script setup lang="ts">
import LanguageSwitcher from '../components/ui/LanguageSwitcher.vue';
</script>

<template>
  <div class="min-h-screen bg-surface-base flex flex-col justify-center items-center p-4 selection:bg-primary selection:text-slate-950 relative">
    <div class="absolute top-6 right-6">
      <LanguageSwitcher />
    </div>

    <!-- Centered Card Container -->
    <div class="w-full max-w-md bg-surface-card border border-surface-border rounded-2xl p-8 shadow-2xl">
      <div class="text-center mb-8">
        <span class="text-4xl inline-block mb-3">🐙</span>
        <h1 class="text-xl font-bold tracking-tight text-white">OctopusPanel</h1>
        <p class="text-xs text-slate-400 mt-1">High-Performance Game &amp; Cloud Management</p>
      </div>

      <router-view />
    </div>
  </div>
</template>
