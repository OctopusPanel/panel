import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Server, PowerAction } from '@octopus/shared';
import { ApiService } from '../services/api.js';

export const useServerStore = defineStore('server', () => {
  const servers = ref<Server[]>([]);
  const currentServer = ref<any | null>(null);
  const isLoading = ref(false);

  async function fetchServers() {
    isLoading.value = true;
    try {
      const data = await ApiService.get<Server[]>('/client/servers');
      servers.value = data;
      return data;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchServerDetails(id: string | number) {
    isLoading.value = true;
    try {
      const data = await ApiService.get<any>(`/client/servers/${id}`);
      currentServer.value = data;
      return data;
    } finally {
      isLoading.value = false;
    }
  }

  async function sendPowerAction(id: string | number, action: PowerAction) {
    const res = await ApiService.post<{ message: string }>(`/client/servers/${id}/power`, { action });
    if (currentServer.value && (currentServer.value.id === id || currentServer.value.uuid === id)) {
      if (action === PowerAction.START) currentServer.value.status = 'starting';
      if (action === PowerAction.STOP) currentServer.value.status = 'stopping';
      if (action === PowerAction.KILL) currentServer.value.status = 'offline';
    }
    return res;
  }

  return {
    servers,
    currentServer,
    isLoading,
    fetchServers,
    fetchServerDetails,
    sendPowerAction,
  };
});
