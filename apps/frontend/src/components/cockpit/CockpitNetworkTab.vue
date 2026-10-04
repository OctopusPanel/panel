<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ApiService } from '../../services/api.js';
import { Globe, Plus, Copy, Check, Star, Trash2, Edit2, Shield, X, Radio } from 'lucide-vue-next';

const props = defineProps<{
  serverUuid: string;
}>();

const allocations = ref<any[]>([]);
const isLoading = ref(false);
const copiedField = ref<string | null>(null);

// Modal states
const showRequestModal = ref(false);
const requestNote = ref('');

const showAliasModal = ref(false);
const selectedAllocation = ref<any | null>(null);
const aliasInput = ref('');
const noteInput = ref('');

async function loadAllocations() {
  isLoading.value = true;
  try {
    allocations.value = await ApiService.get<any[]>(`/client/servers/${props.serverUuid}/allocations`);
  } catch (err) {
    console.error('Failed to load allocations:', err);
  } finally {
    isLoading.value = false;
  }
}

async function requestPort() {
  try {
    await ApiService.post(`/client/servers/${props.serverUuid}/allocations`, {
      note: requestNote.value || 'Additional Port',
    });
    showRequestModal.value = false;
    requestNote.value = '';
    loadAllocations();
  } catch (err) {
    console.error('Failed to request port:', err);
  }
}

async function setPrimary(allocId: number) {
  try {
    await ApiService.post(`/client/servers/${props.serverUuid}/allocations/${allocId}/primary`);
    loadAllocations();
  } catch (err) {
    console.error('Failed to set primary port:', err);
  }
}

function openAliasModal(alloc: any) {
  selectedAllocation.value = alloc;
  aliasInput.value = alloc.alias || '';
  noteInput.value = alloc.note || '';
  showAliasModal.value = true;
}

async function saveAlias() {
  if (!selectedAllocation.value) return;
  try {
    await ApiService.post(`/client/servers/${props.serverUuid}/allocations/${selectedAllocation.value.id}/alias`, {
      alias: aliasInput.value.trim() || null,
      note: noteInput.value.trim() || null,
    });
    showAliasModal.value = false;
    loadAllocations();
  } catch (err) {
    console.error('Failed to update alias:', err);
  }
}

async function deleteAllocation(allocId: number) {
  if (!confirm('Are you sure you want to release this port allocation?')) return;
  try {
    await ApiService.delete(`/client/servers/${props.serverUuid}/allocations/${allocId}`);
    loadAllocations();
  } catch (err) {
    console.error('Failed to delete allocation:', err);
  }
}

function copyText(val: string, key: string) {
  navigator.clipboard.writeText(val);
  copiedField.value = key;
  setTimeout(() => {
    if (copiedField.value === key) copiedField.value = null;
  }, 2000);
}

onMounted(() => {
  loadAllocations();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header & Request CTA -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-sm font-bold text-white flex items-center">
          <Globe class="w-4 h-4 text-primary mr-2" />
          Network &amp; Port Allocations
        </h3>
        <p class="text-xs text-slate-400 mt-0.5">
          Manage container port bindings, reverse DNS aliases, and secondary ports for web maps, RCON, or query protocols.
        </p>
      </div>

      <button
        @click="showRequestModal = true"
        class="flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-dark text-slate-950 transition-all shadow-md active:scale-[0.98]"
      >
        <Plus class="w-3.5 h-3.5 mr-1.5" />
        Request Additional Port
      </button>
    </div>

    <!-- Allocations Grid & Table -->
    <div class="bg-surface-card border border-surface-border rounded-xl overflow-hidden shadow-xl">
      <div v-if="isLoading" class="p-8 text-center text-xs font-mono text-slate-400">
        Loading network topology...
      </div>

      <table v-else class="w-full text-left text-xs">
        <thead class="bg-surface-deep text-slate-400 uppercase tracking-wider text-[10px] border-b border-surface-border">
          <tr>
            <th class="py-3 px-4">Connection Endpoint</th>
            <th class="py-3 px-4">Alias / FQDN</th>
            <th class="py-3 px-4">Note / Purpose</th>
            <th class="py-3 px-4">Role</th>
            <th class="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-border/50 font-mono">
          <tr
            v-for="alloc in allocations"
            :key="alloc.id"
            class="hover:bg-surface-elevated/40 transition-colors"
            :class="{ 'bg-primary/5': alloc.isPrimary }"
          >
            <!-- Endpoint -->
            <td class="py-3 px-4 text-slate-200">
              <div class="flex items-center space-x-2">
                <span class="font-bold">{{ alloc.ipAddress }}:{{ alloc.port }}</span>
                <button
                  @click="copyText(`${alloc.ipAddress}:${alloc.port}`, `ep_${alloc.id}`)"
                  class="p-1 text-slate-400 hover:text-white rounded hover:bg-surface-elevated transition-colors"
                  title="Copy IP:Port"
                >
                  <Check v-if="copiedField === `ep_${alloc.id}`" class="w-3.5 h-3.5 text-status-online" />
                  <Copy v-else class="w-3.5 h-3.5" />
                </button>
              </div>
            </td>

            <!-- Alias / FQDN -->
            <td class="py-3 px-4 text-slate-300">
              <span v-if="alloc.alias" class="text-primary-light bg-primary/10 px-2 py-0.5 rounded border border-primary/25 text-[11px]">
                {{ alloc.alias }}:{{ alloc.port }}
              </span>
              <span v-else class="text-slate-500 text-[11px]">—</span>
            </td>

            <!-- Note -->
            <td class="py-3 px-4 text-slate-400 font-sans text-xs">
              {{ alloc.note || 'Default Port' }}
            </td>

            <!-- Role Badge -->
            <td class="py-3 px-4">
              <span
                v-if="alloc.isPrimary"
                class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-status-online/15 text-status-online border border-status-online/30"
              >
                <Star class="w-3 h-3 mr-1 fill-status-online" />
                Primary Port
              </span>
              <span v-else class="text-slate-400 text-[10px]">Secondary</span>
            </td>

            <!-- Actions -->
            <td class="py-3 px-4 text-right space-x-1.5 font-sans">
              <button
                v-if="!alloc.isPrimary"
                @click="setPrimary(alloc.id)"
                class="px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:text-white border border-surface-border hover:bg-surface-elevated rounded transition-colors"
                title="Make Primary Game Port"
              >
                Set Primary
              </button>
              <button
                @click="openAliasModal(alloc)"
                class="p-1 text-slate-400 hover:text-primary rounded hover:bg-surface-elevated transition-colors"
                title="Edit Note / Alias"
              >
                <Edit2 class="w-3.5 h-3.5" />
              </button>
              <button
                v-if="!alloc.isPrimary"
                @click="deleteAllocation(alloc.id)"
                class="p-1 text-slate-400 hover:text-status-offline rounded hover:bg-surface-elevated transition-colors"
                title="Delete Allocation"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Request Port Modal -->
    <div v-if="showRequestModal" class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div class="bg-surface-card border border-surface-border rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-surface-border">
          <h3 class="text-sm font-semibold text-white">Request Secondary Port</h3>
          <button @click="showRequestModal = false" class="text-slate-400 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="text-xs text-slate-300 leading-relaxed">
          An additional port will be bound to this container on the same host node. You can use it for Dynmap, Voice Chat, Query, or RCON.
        </p>

        <div>
          <label class="block text-xs text-slate-400 mb-1 font-medium">Port Note / Description</label>
          <input
            v-model="requestNote"
            type="text"
            placeholder="e.g. Dynmap Web UI, SimpleVoiceChat"
            class="w-full bg-surface-deep border border-surface-border rounded-lg p-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>

        <div class="flex justify-end space-x-2 pt-2 border-t border-surface-border">
          <button @click="showRequestModal = false" class="px-3 py-1.5 text-xs text-slate-300 hover:bg-surface-elevated rounded-lg">
            Cancel
          </button>
          <button @click="requestPort" class="px-3.5 py-1.5 text-xs bg-primary hover:bg-primary-dark text-slate-950 font-semibold rounded-lg active:scale-[0.98]">
            Confirm &amp; Allocate
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Alias / Note Modal -->
    <div v-if="showAliasModal" class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div class="bg-surface-card border border-surface-border rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-surface-border">
          <h3 class="text-sm font-semibold text-white">Configure Port #{{ selectedAllocation?.port }}</h3>
          <button @click="showAliasModal = false" class="text-slate-400 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1 font-medium">FQDN / Domain Alias</label>
            <input
              v-model="aliasInput"
              type="text"
              placeholder="e.g. mc.example.com"
              class="w-full bg-surface-deep border border-surface-border rounded-lg p-2 text-slate-200 font-mono outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label class="block text-slate-400 mb-1 font-medium">Port Note</label>
            <input
              v-model="noteInput"
              type="text"
              placeholder="e.g. Dynmap Web Interface"
              class="w-full bg-surface-deep border border-surface-border rounded-lg p-2 text-slate-200 outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        <div class="flex justify-end space-x-2 pt-2 border-t border-surface-border">
          <button @click="showAliasModal = false" class="px-3 py-1.5 text-xs text-slate-300 hover:bg-surface-elevated rounded-lg">
            Cancel
          </button>
          <button @click="saveAlias" class="px-3.5 py-1.5 text-xs bg-primary hover:bg-primary-dark text-slate-950 font-semibold rounded-lg active:scale-[0.98]">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
