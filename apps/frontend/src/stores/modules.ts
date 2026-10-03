import { defineStore } from 'pinia';
import { ref } from 'vue';
import { UiSlotItem, UiSlotType, globalUiSlots } from '@octopus/module-sdk';
import { ApiService } from '../services/api.js';

export const useModuleStore = defineStore('modules', () => {
  const registeredSlots = ref<UiSlotItem[]>(globalUiSlots.getAll());
  const installedModules = ref<any[]>([]);
  const isLoading = ref(false);

  function registerSlotItem(item: UiSlotItem) {
    globalUiSlots.register(item);
    registeredSlots.value = globalUiSlots.getAll();
  }

  function getSlotsFor(slot: UiSlotType): UiSlotItem[] {
    return globalUiSlots.getBySlot(slot);
  }

  async function fetchModules() {
    isLoading.value = true;
    try {
      const list = await ApiService.get<any[]>('/admin/modules');
      installedModules.value = list;
      return list;
    } finally {
      isLoading.value = false;
    }
  }

  async function toggleModule(id: string, enabled: boolean) {
    const updated = await ApiService.post<any>(`/admin/modules/${id}/toggle`, { enabled });
    const idx = installedModules.value.findIndex((m) => m.id === id);
    if (idx !== -1) {
      installedModules.value[idx] = updated;
    }
    return updated;
  }

  return {
    registeredSlots,
    installedModules,
    isLoading,
    registerSlotItem,
    getSlotsFor,
    fetchModules,
    toggleModule,
  };
});
