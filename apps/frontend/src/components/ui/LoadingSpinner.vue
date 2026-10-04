<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'white' | 'muted' | 'emerald';
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  color: 'primary',
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'w-3.5 h-3.5 border-[2px]';
    case 'sm':
      return 'w-4 h-4 border-2';
    case 'md':
      return 'w-5 h-5 border-2';
    case 'lg':
      return 'w-8 h-8 border-[3px]';
    case 'xl':
      return 'w-12 h-12 border-4';
    default:
      return 'w-5 h-5 border-2';
  }
});

const colorClasses = computed(() => {
  switch (props.color) {
    case 'primary':
      return 'border-[#db982b]/25 border-t-[#db982b] text-[#db982b]';
    case 'white':
      return 'border-white/25 border-t-white text-white';
    case 'muted':
      return 'border-slate-500/25 border-t-slate-400 text-slate-400';
    case 'emerald':
      return 'border-emerald-500/25 border-t-emerald-400 text-emerald-400';
    default:
      return 'border-[#db982b]/25 border-t-[#db982b] text-[#db982b]';
  }
});
</script>

<template>
  <div
    role="status"
    aria-label="Loading"
    class="inline-block shrink-0 rounded-full animate-spin border-solid"
    :class="[sizeClasses, colorClasses]"
  >
    <span class="sr-only">Loading...</span>
  </div>
</template>
