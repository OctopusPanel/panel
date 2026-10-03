<script setup lang="ts">
import { computed } from 'vue';
import { UiSlotType } from '@octopus/module-sdk';
import { useModuleStore } from '../../stores/modules.js';

const props = defineProps<{
  slotName: UiSlotType;
  context?: Record<string, unknown>;
}>();

const moduleStore = useModuleStore();

const slotItems = computed(() => {
  return moduleStore.getSlotsFor(props.slotName);
});
</script>

<template>
  <div v-if="slotItems.length > 0" class="module-slot-container space-y-2">
    <div
      v-for="item in slotItems"
      :key="item.id"
      class="module-slot-item"
    >
      <!-- Navigation link slot -->
      <router-link
        v-if="item.route"
        :to="item.route"
        class="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
      >
        <span class="mr-2.5">🔌</span>
        <span>{{ item.title }}</span>
      </router-link>

      <!-- Component slot -->
      <component
        v-else-if="item.component"
        :is="item.component"
        v-bind="item.props"
        :context="context"
      />
    </div>
  </div>
</template>
