<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { setLanguage } from '../../i18n/index.js';
import { Globe } from 'lucide-vue-next';

const { locale } = useI18n();

function onChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  setLanguage(target.value);
}
</script>

<template>
  <div class="relative inline-flex items-center text-xs">
    <Globe class="w-3.5 h-3.5 text-slate-400 mr-1.5" />
    <select
      :value="locale"
      @change="onChange"
      class="bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 rounded-md px-2 py-1 outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 transition-colors"
    >
      <option value="en">English (EN)</option>
      <option value="de">Deutsch (DE)</option>
    </select>
  </div>
</template>
