<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ApiService } from '../../services/api.js';
import { ServerBackup } from '../../services/demo-data.js';
import { Archive, Plus, Lock, Unlock, Download, RotateCcw, Trash2, AlertTriangle, Check, X, Shield } from 'lucide-vue-next';
import ButtonSpinner from '../ui/ButtonSpinner.vue';

const props = defineProps<{
  serverUuid: string;
}>();

const backups = ref<ServerBackup[]>([]);
const isLoading = ref(false);
const deletingBackupId = ref<string | null>(null);

// Modals
const showCreateModal = ref(false);
const backupName = ref('');
const ignoredFiles = ref('');
const isLocked = ref(false);
const isCreating = ref(false);

const showRestoreModal = ref(false);
const backupToRestore = ref<ServerBackup | null>(null);
const isRestoring = ref(false);

// Toast
const toast = ref<string | null>(null);

function showToast(msg: string) {
  toast.value = msg;
  setTimeout(() => {
    if (toast.value === msg) toast.value = null;
  }, 2500);
}

async function loadBackups() {
  isLoading.value = true;
  try {
    backups.value = await ApiService.get<ServerBackup[]>(`/client/servers/${props.serverUuid}/backups`);
  } catch (err) {
    console.error('Failed to load backups:', err);
  } finally {
    isLoading.value = false;
  }
}

async function createBackup() {
  if (!backupName.value.trim()) return;
  isCreating.value = true;
  try {
    const ignored = ignoredFiles.value.split(',').map((s) => s.trim()).filter(Boolean);
    await ApiService.post(`/client/servers/${props.serverUuid}/backups`, {
      name: backupName.value,
      ignoredFiles: ignored,
      isLocked: isLocked.value,
    });
    showCreateModal.value = false;
    backupName.value = '';
    ignoredFiles.value = '';
    isLocked.value = false;
    showToast('Backup snapshot initiated successfully');
    loadBackups();
  } catch (err) {
    console.error('Failed to create backup:', err);
  } finally {
    isCreating.value = false;
  }
}

async function toggleLock(backup: ServerBackup) {
  try {
    await ApiService.post(`/client/servers/${props.serverUuid}/backups/${backup.id}/lock`);
    backup.isLocked = !backup.isLocked;
    showToast(backup.isLocked ? 'Backup locked from automated rotation' : 'Backup unlocked');
  } catch (err) {
    console.error('Failed to toggle lock:', err);
  }
}

function openRestore(backup: ServerBackup) {
  backupToRestore.value = backup;
  showRestoreModal.value = true;
}

async function confirmRestore() {
  if (!backupToRestore.value) return;
  isRestoring.value = true;
  try {
    await ApiService.post(`/client/servers/${props.serverUuid}/backups/${backupToRestore.value.id}/restore`);
    showRestoreModal.value = false;
    showToast('Backup restore completed successfully');
  } catch (err) {
    console.error('Failed to restore backup:', err);
  } finally {
    isRestoring.value = false;
  }
}

async function deleteBackup(backupId: string) {
  if (!confirm('Are you sure you want to permanently delete this backup archive?')) return;
  deletingBackupId.value = backupId;
  try {
    await ApiService.delete(`/client/servers/${props.serverUuid}/backups/${backupId}`);
    showToast('Backup deleted');
    await loadBackups();
  } catch (err) {
    console.error('Failed to delete backup:', err);
  } finally {
    deletingBackupId.value = null;
  }
}

function downloadBackup(backup: ServerBackup) {
  showToast(`Downloading archive: ${backup.name}.tar.gz`);
}

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

onMounted(() => {
  loadBackups();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-sm font-bold text-white flex items-center">
          <Archive class="w-4 h-4 text-primary mr-2" />
          Server Backups &amp; Disaster Recovery
        </h3>
        <p class="text-xs text-slate-400 mt-0.5">
          Create container snapshots, restore previous game worlds, and lock critical states against automated purge cycles.
        </p>
      </div>

      <button
        @click="showCreateModal = true"
        class="flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-dark text-slate-950 transition-all shadow-md active:scale-[0.98]"
      >
        <Plus class="w-3.5 h-3.5 mr-1.5" />
        Create Backup
      </button>
    </div>

    <!-- Toast Notification -->
    <div
      v-if="toast"
      class="bg-primary text-slate-950 text-xs px-4 py-2 font-semibold flex items-center justify-between rounded-lg transition-all"
    >
      <span>{{ toast }}</span>
      <Check class="w-3.5 h-3.5 text-slate-950" />
    </div>

    <!-- Backups Table -->
    <div class="bg-surface-card border border-surface-border rounded-xl overflow-hidden shadow-xl">
      <div v-if="isLoading" class="p-8 text-center text-xs font-mono text-slate-400">
        Loading backup manifests...
      </div>

      <div v-else-if="backups.length === 0" class="p-12 text-center text-xs text-slate-400">
        No backups generated for this server yet.
      </div>

      <table v-else class="w-full text-left text-xs">
        <thead class="bg-surface-deep text-slate-400 uppercase tracking-wider text-[10px] border-b border-surface-border">
          <tr>
            <th class="py-3 px-4">Backup Name</th>
            <th class="py-3 px-4">Archive Size</th>
            <th class="py-3 px-4">Created Date</th>
            <th class="py-3 px-4">Lock Status</th>
            <th class="py-3 px-4">Status</th>
            <th class="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-border/50 font-mono">
          <tr v-for="b in backups" :key="b.id" class="hover:bg-surface-elevated/40 transition-colors">
            <!-- Name -->
            <td class="py-3 px-4 text-slate-200 font-sans font-semibold">
              <div class="flex items-center space-x-2">
                <Archive class="w-4 h-4 text-primary shrink-0" />
                <span>{{ b.name }}</span>
              </div>
              <span v-if="b.ignoredFiles?.length" class="text-[10px] text-slate-400 font-mono block mt-0.5">
                Ignored: {{ b.ignoredFiles.join(', ') }}
              </span>
            </td>

            <!-- Size -->
            <td class="py-3 px-4 text-slate-200 font-bold">
              {{ formatBytes(b.sizeBytes) }}
            </td>

            <!-- Created -->
            <td class="py-3 px-4 text-slate-400 text-[11px]">
              {{ new Date(b.createdAt).toLocaleString() }}
            </td>

            <!-- Lock -->
            <td class="py-3 px-4 font-sans">
              <button
                @click="toggleLock(b)"
                class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
                :class="b.isLocked ? 'bg-primary/10 text-primary-light border border-primary/25 hover:bg-primary/20' : 'bg-surface-deep text-slate-400 border border-surface-border hover:text-slate-200'"
              >
                <Lock v-if="b.isLocked" class="w-3 h-3 mr-1" />
                <Unlock v-else class="w-3 h-3 mr-1" />
                {{ b.isLocked ? 'Protected' : 'Unlocked' }}
              </button>
            </td>

            <!-- Status -->
            <td class="py-3 px-4 font-sans">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                :class="b.status === 'completed' ? 'bg-status-online/15 text-status-online border border-status-online/30' : 'bg-status-warning/15 text-status-warning border border-status-warning/30'"
              >
                {{ b.status }}
              </span>
            </td>

            <!-- Actions -->
            <td class="py-3 px-4 text-right space-x-1.5 font-sans">
              <button
                @click="openRestore(b)"
                class="p-1.5 text-slate-400 hover:text-primary-light rounded hover:bg-surface-elevated transition-colors"
                title="Restore to Container"
              >
                <RotateCcw class="w-3.5 h-3.5" />
              </button>
              <button
                @click="downloadBackup(b)"
                class="p-1.5 text-slate-400 hover:text-primary rounded hover:bg-surface-elevated transition-colors"
                title="Download .tar.gz"
              >
                <Download class="w-3.5 h-3.5" />
              </button>
              <ButtonSpinner
                @click="deleteBackup(b.id)"
                :loading="deletingBackupId === b.id"
                spinner-color="muted"
                class="p-1.5 text-slate-400 hover:text-status-offline rounded hover:bg-surface-elevated transition-colors"
                title="Delete Backup"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </ButtonSpinner>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create Backup Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
      <div class="bg-surface-card border border-surface-border rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-surface-border">
          <h3 class="text-sm font-semibold text-white">Create New Backup</h3>
          <button @click="showCreateModal = false" class="text-slate-400 hover:text-white transition-colors">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1 font-medium">Backup Name</label>
            <input
              v-model="backupName"
              type="text"
              placeholder="e.g. World Pre-Boss Fight Snapshot"
              class="w-full bg-surface-deep border border-surface-border rounded-lg p-2.5 text-slate-200 outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label class="block text-slate-400 mb-1 font-medium">Ignored Files & Patterns (comma-separated)</label>
            <input
              v-model="ignoredFiles"
              type="text"
              placeholder="e.g. logs/*, cache/*, world_nether/*"
              class="w-full bg-surface-deep border border-surface-border rounded-lg p-2.5 text-slate-200 font-mono outline-none focus:border-primary transition-colors"
            />
          </div>

          <div class="pt-1">
            <label class="flex items-center space-x-2 cursor-pointer">
              <input v-model="isLocked" type="checkbox" class="rounded bg-surface-deep border-surface-border text-primary focus:ring-0" />
              <span class="text-slate-300">Lock backup (protect against retention policy deletion)</span>
            </label>
          </div>
        </div>

        <div class="flex justify-end space-x-2 pt-2 border-t border-surface-border">
          <button @click="showCreateModal = false" class="px-3.5 py-2 text-xs text-slate-300 hover:bg-surface-elevated rounded-lg transition-colors">
            Cancel
          </button>
          <ButtonSpinner
            @click="createBackup"
            :loading="isCreating"
            :disabled="!backupName.trim()"
            spinner-color="white"
            class="px-4 py-2 text-xs bg-primary hover:bg-primary-dark text-slate-950 font-semibold rounded-lg transition-colors shadow-md"
          >
            Start Backup
          </ButtonSpinner>
        </div>
      </div>
    </div>

    <!-- Restore Warning Confirmation Modal -->
    <div v-if="showRestoreModal" class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
      <div class="bg-surface-card border border-primary/40 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-surface-border">
          <div class="flex items-center space-x-2 text-primary">
            <AlertTriangle class="w-5 h-5" />
            <h3 class="text-sm font-bold text-white">Restore Backup Snapshot</h3>
          </div>
          <button @click="showRestoreModal = false" class="text-slate-400 hover:text-white transition-colors">
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="text-xs text-slate-300 leading-relaxed">
          Restoring <strong class="text-white">"{{ backupToRestore?.name }}"</strong> will overwrite current container files and reload state from this snapshot. Any changes made since this backup was taken will be lost.
        </p>

        <div class="flex justify-end space-x-2 pt-2 border-t border-surface-border">
          <button @click="showRestoreModal = false" class="px-3.5 py-2 text-xs text-slate-300 hover:bg-surface-elevated rounded-lg transition-colors">
            Cancel
          </button>
          <ButtonSpinner
            @click="confirmRestore"
            :loading="isRestoring"
            spinner-color="white"
            class="px-4 py-2 text-xs bg-primary hover:bg-primary-dark text-slate-950 font-semibold rounded-lg flex items-center transition-colors shadow-md"
          >
            <RotateCcw class="w-3.5 h-3.5 mr-1.5" />
            Confirm &amp; Restore
          </ButtonSpinner>
        </div>
      </div>
    </div>
  </div>
</template>
