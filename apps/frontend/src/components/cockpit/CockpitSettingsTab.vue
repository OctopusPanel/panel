<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ApiService } from '../../services/api.js';
import { Settings, Save, AlertTriangle, RefreshCw, Trash2, Check, X, ShieldAlert } from 'lucide-vue-next';

const props = defineProps<{
  server: any;
}>();

const router = useRouter();

const nameInput = ref(props.server?.name || '');
const descInput = ref(props.server?.description || '');
const dockerImageInput = ref(props.server?.dockerImage || '');
const isSaving = ref(false);
const saveSuccess = ref(false);

// Danger Zone modals
const showReinstallModal = ref(false);
const reinstallInput = ref('');
const isReinstalling = ref(false);

const showDeleteModal = ref(false);
const deleteInput = ref('');
const isDeleting = ref(false);

async function saveMetadata() {
  isSaving.value = true;
  try {
    await ApiService.put(`/client/servers/${props.server?.uuid}`, {
      name: nameInput.value,
      description: descInput.value,
      dockerImage: dockerImageInput.value,
    });
    props.server.name = nameInput.value;
    props.server.description = descInput.value;
    props.server.dockerImage = dockerImageInput.value;
    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to update server settings:', err);
  } finally {
    isSaving.value = false;
  }
}

async function triggerReinstall() {
  if (reinstallInput.value !== props.server?.identifier && reinstallInput.value !== 'REINSTALL') return;
  isReinstalling.value = true;
  try {
    await ApiService.post(`/client/servers/${props.server?.uuid}/reinstall`);
    showReinstallModal.value = false;
    reinstallInput.value = '';
    alert('Server reinstallation has been queued and the install script is running.');
  } catch (err) {
    console.error('Failed to reinstall server:', err);
  } finally {
    isReinstalling.value = false;
  }
}

async function triggerDelete() {
  if (deleteInput.value !== props.server?.identifier && deleteInput.value !== 'DELETE') return;
  isDeleting.value = true;
  try {
    await ApiService.delete(`/client/servers/${props.server?.uuid}`);
    showDeleteModal.value = false;
    router.push('/');
  } catch (err) {
    console.error('Failed to delete server:', err);
  } finally {
    isDeleting.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Server General Settings -->
    <div class="bg-surface-card border border-surface-border rounded-xl p-6 shadow-xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-surface-border">
        <div class="flex items-center space-x-2">
          <Settings class="w-4 h-4 text-primary" />
          <h3 class="text-sm font-bold text-white">General Server Configuration</h3>
        </div>

        <button
          @click="saveMetadata"
          :disabled="isSaving"
          class="flex items-center px-4 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-dark text-slate-950 transition-all shadow-md active:scale-[0.98]"
        >
          <Check v-if="saveSuccess" class="w-3.5 h-3.5 mr-1 text-slate-950" />
          <Save v-else class="w-3.5 h-3.5 mr-1" />
          {{ saveSuccess ? 'Saved!' : 'Save Changes' }}
        </button>
      </div>

      <div class="space-y-3 text-xs">
        <div>
          <label class="block text-slate-400 mb-1 font-medium">Server Display Name</label>
          <input
            v-model="nameInput"
            type="text"
            class="w-full bg-surface-deep border border-surface-border rounded-lg p-2.5 text-slate-200 outline-none focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label class="block text-slate-400 mb-1 font-medium">Server Description</label>
          <textarea
            v-model="descInput"
            rows="3"
            placeholder="Add internal notes or customer notes..."
            class="w-full bg-surface-deep border border-surface-border rounded-lg p-2.5 text-slate-200 outline-none focus:border-primary transition-colors leading-relaxed resize-none"
          ></textarea>
        </div>

        <div>
          <label class="block text-slate-400 mb-1 font-medium">OCI Docker Image</label>
          <input
            v-model="dockerImageInput"
            type="text"
            placeholder="e.g. ghcr.io/ptero-eggs/yolks:java_25"
            class="w-full bg-surface-deep border border-surface-border rounded-lg p-2.5 text-slate-200 font-mono outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>
    </div>

    <!-- Container Runtime & Node Metadata -->
    <div class="bg-surface-card border border-surface-border rounded-xl p-6 shadow-xl space-y-4">
      <h3 class="text-xs font-bold text-slate-300 uppercase tracking-wider">
        Container Architecture &amp; Identifiers
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        <div class="bg-surface-deep p-3 rounded-lg border border-surface-border">
          <span class="text-[10px] text-slate-400 block mb-1 font-sans">Instance UUID</span>
          <span class="text-slate-200 select-all">{{ server?.uuid }}</span>
        </div>

        <div class="bg-surface-deep p-3 rounded-lg border border-surface-border">
          <span class="text-[10px] text-slate-400 block mb-1 font-sans">Short Identifier</span>
          <span class="text-primary font-bold">#{{ server?.identifier }}</span>
        </div>

        <div class="bg-surface-deep p-3 rounded-lg border border-surface-border">
          <span class="text-[10px] text-slate-400 block mb-1 font-sans">OCI Docker Image</span>
          <span class="text-slate-300 truncate block">{{ server?.dockerImage }}</span>
        </div>

        <div class="bg-surface-deep p-3 rounded-lg border border-surface-border">
          <span class="text-[10px] text-slate-400 block mb-1 font-sans">Assigned Host Node</span>
          <span class="text-slate-300">{{ server?.node?.name }} ({{ server?.node?.fqdn }})</span>
        </div>
      </div>
    </div>

    <!-- Danger Zone (Red Bordered) -->
    <div class="bg-surface-card border-2 border-status-offline/50 rounded-xl p-6 shadow-xl space-y-5">
      <div class="flex items-center space-x-2 text-status-offline pb-3 border-b border-status-offline/30">
        <ShieldAlert class="w-5 h-5" />
        <h3 class="text-sm font-bold text-white uppercase tracking-wider">Danger Zone</h3>
      </div>

      <!-- Action 1: Reinstall Server -->
      <div class="flex items-center justify-between p-3.5 bg-surface-deep border border-status-offline/30 rounded-lg">
        <div>
          <h4 class="text-xs font-bold text-white">Reinstall Server</h4>
          <p class="text-[11px] text-slate-400 mt-0.5">
            Wipes all application files and reruns the blueprint installation script. Preserves port allocations.
          </p>
        </div>

        <button
          @click="showReinstallModal = true"
          class="px-4 py-2 text-xs font-semibold rounded-lg bg-status-offline hover:bg-rose-600 text-white transition-colors shrink-0 ml-4 shadow-md active:scale-[0.98]"
        >
          Reinstall Server
        </button>
      </div>

      <!-- Action 2: Delete Server -->
      <div class="flex items-center justify-between p-3.5 bg-surface-deep border border-status-offline/30 rounded-lg">
        <div>
          <h4 class="text-xs font-bold text-white">Delete Server Instance</h4>
          <p class="text-[11px] text-slate-400 mt-0.5">
            Permanently destroys the container, deallocates bound IP ports, and removes all associated data.
          </p>
        </div>

        <button
          @click="showDeleteModal = true"
          class="px-4 py-2 text-xs font-semibold rounded-lg border border-status-offline/80 text-status-offline hover:bg-status-offline hover:text-white transition-colors shrink-0 ml-4 shadow-md active:scale-[0.98]"
        >
          Delete Server
        </button>
      </div>
    </div>

    <!-- Reinstall Double-Confirmation Modal -->
    <div v-if="showReinstallModal" class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div class="bg-surface-card border border-status-offline/50 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-surface-border text-status-offline">
          <div class="flex items-center space-x-2">
            <AlertTriangle class="w-5 h-5" />
            <h3 class="text-sm font-bold text-white">Confirm Server Reinstallation</h3>
          </div>
          <button @click="showReinstallModal = false" class="text-slate-400 hover:text-white transition-colors">
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="text-xs text-slate-300 leading-relaxed">
          This operation is <strong class="text-status-offline">destructive</strong>. All server files in <code class="text-primary-light">/home/container</code> will be deleted and the original Blueprint install script will be re-executed.
        </p>

        <div>
          <label class="block text-xs text-slate-400 mb-1 font-medium">
            Type <strong class="text-white">{{ server?.identifier }}</strong> to confirm:
          </label>
          <input
            v-model="reinstallInput"
            type="text"
            :placeholder="server?.identifier"
            class="w-full bg-surface-deep border border-status-offline/50 rounded-lg p-2.5 text-xs font-mono text-slate-200 outline-none focus:border-status-offline transition-colors"
          />
        </div>

        <div class="flex justify-end space-x-2 pt-2 border-t border-surface-border">
          <button @click="showReinstallModal = false" class="px-3.5 py-2 text-xs text-slate-300 hover:bg-surface-elevated rounded-lg transition-colors">
            Cancel
          </button>
          <button
            @click="triggerReinstall"
            :disabled="reinstallInput !== server?.identifier && reinstallInput !== 'REINSTALL'"
            class="px-4 py-2 text-xs bg-status-offline hover:bg-rose-600 disabled:opacity-40 text-white font-semibold rounded-lg transition-colors shadow-md"
          >
            I Understand, Reinstall
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div class="bg-surface-card border border-status-offline/50 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-surface-border text-status-offline">
          <div class="flex items-center space-x-2">
            <Trash2 class="w-5 h-5" />
            <h3 class="text-sm font-bold text-white">Delete Server Instance</h3>
          </div>
          <button @click="showDeleteModal = false" class="text-slate-400 hover:text-white transition-colors">
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="text-xs text-slate-300 leading-relaxed">
          You are about to permanently delete <strong class="text-white">{{ server?.name }}</strong> (#{{ server?.identifier }}). All disk contents, port bindings, and database records will be eradicated.
        </p>

        <div>
          <label class="block text-xs text-slate-400 mb-1 font-medium">
            Type <strong class="text-white">{{ server?.identifier }}</strong> to confirm deletion:
          </label>
          <input
            v-model="deleteInput"
            type="text"
            :placeholder="server?.identifier"
            class="w-full bg-surface-deep border border-status-offline/50 rounded-lg p-2.5 text-xs font-mono text-slate-200 outline-none focus:border-status-offline transition-colors"
          />
        </div>

        <div class="flex justify-end space-x-2 pt-2 border-t border-surface-border">
          <button @click="showDeleteModal = false" class="px-3.5 py-2 text-xs text-slate-300 hover:bg-surface-elevated rounded-lg transition-colors">
            Cancel
          </button>
          <button
            @click="triggerDelete"
            :disabled="deleteInput !== server?.identifier && deleteInput !== 'DELETE'"
            class="px-4 py-2 text-xs bg-status-offline hover:bg-rose-600 disabled:opacity-40 text-white font-semibold rounded-lg transition-colors shadow-md"
          >
            Permanently Terminate
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
