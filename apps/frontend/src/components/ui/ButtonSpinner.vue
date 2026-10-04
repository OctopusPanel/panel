<script setup lang="ts">
import LoadingSpinner from './LoadingSpinner.vue';

interface Props {
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  spinnerColor?: 'primary' | 'white' | 'muted' | 'emerald';
  spinnerSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loadingText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  disabled: false,
  type: 'button',
  spinnerColor: 'white',
  spinnerSize: 'sm',
  loadingText: undefined,
});

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();

function handleClick(event: MouseEvent) {
  if (props.loading || props.disabled) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  emit('click', event);
}
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : undefined"
    @click="handleClick"
    class="relative inline-flex items-center justify-center transition-all select-none focus:outline-none"
    :class="[
      loading ? 'cursor-wait pointer-events-none' : '',
      disabled && !loading ? 'opacity-50 cursor-not-allowed' : '',
    ]"
  >
    <!-- Slot content (hidden but preserving layout dimensions to prevent button width jumping) -->
    <span
      class="inline-flex items-center justify-center gap-1.5 transition-opacity duration-150"
      :class="{ 'opacity-0 invisible': loading }"
    >
      <slot />
    </span>

    <!-- Active Loading Spinner Overlay (Zero layout shift) -->
    <span
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center gap-2 pointer-events-none"
    >
      <LoadingSpinner :size="spinnerSize" :color="spinnerColor" />
      <span v-if="loadingText" class="text-xs font-medium">{{ loadingText }}</span>
    </span>
  </button>
</template>
