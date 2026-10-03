<script setup lang="ts">
import LanguageSwitcher from '../components/ui/LanguageSwitcher.vue';
</script>

<template>
  <div class="min-h-screen bg-[#090d14] flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white relative">
    <div class="absolute top-6 right-6">
      <LanguageSwitcher />
    </div>

    <!-- Centered Card Container -->
    <div class="w-full max-w-md bg-[#121622] border border-slate-800 rounded-2xl p-8 shadow-2xl">
      <div class="text-center mb-8">
        <span class="text-4xl inline-block mb-3">🐙</span>
        <h1 class="text-xl font-bold tracking-tight text-white">OctopusPanel</h1>
        <p class="text-xs text-slate-400 mt-1">High-Performance Game &amp; Cloud Management</p>
      </div>

      <router-view />
    </div>
  </div>
</template>
