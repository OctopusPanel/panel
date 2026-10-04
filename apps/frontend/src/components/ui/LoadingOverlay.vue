<script setup lang="ts">
import LoadingSpinner from './LoadingSpinner.vue';

interface Props {
  active?: boolean;
  text?: string;
  spinnerColor?: 'primary' | 'white' | 'muted' | 'emerald';
  spinnerSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullscreen?: boolean;
}

withDefaults(defineProps<Props>(), {
  active: true,
  text: '',
  spinnerColor: 'primary',
  spinnerSize: 'lg',
  fullscreen: false,
});
</script>

<template>
  <transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="active"
      role="status"
      aria-live="polite"
      :class="[
        fullscreen ? 'fixed inset-0 z-50' : 'absolute inset-0 z-30 rounded-[inherit]',
        'bg-surface-deep/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center select-none shadow-2xl',
      ]"
    >
      <LoadingSpinner :size="spinnerSize" :color="spinnerColor" />
      <p
        v-if="text"
        class="text-xs font-mono text-slate-300 mt-3 animate-pulse tracking-wide select-none"
      >
        {{ text }}
      </p>
      <span class="sr-only">{{ text || 'Loading...' }}</span>
    </div>
  </transition>
</template>
