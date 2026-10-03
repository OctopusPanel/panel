<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ApiService } from '../../services/api.js';
import { EggVariable, ConfigParserRule } from '../../services/demo-data.js';
import {
  Layers,
  ArrowLeft,
  Save,
  Download,
  Copy,
  Check,
  Plus,
  Trash2,
  Terminal,
  FileCode,
  Shield,
  Edit2,
  X,
  Code,
} from 'lucide-vue-next';

const route = useRoute();
const bpId = Number(route.params.id);

const blueprint = ref<any | null>(null);
const isLoading = ref(false);
const isSaving = ref(false);
const saveSuccess = ref(false);
const copiedJson = ref(false);

// Active Tab inside Blueprint Studio
const activeTab = ref<'overview' | 'images' | 'startup' | 'variables' | 'config' | 'install'>('overview');

// Add Variable Modal
const showAddVarModal = ref(false);
const newVar = ref<EggVariable>({
  key: '',
  name: '',
  description: '',
  defaultValue: '',
  currentValue: '',
  userViewable: true,
  userEditable: true,
  rules: 'required|string',
  fieldType: 'text',
});

// New Docker Image input
const newDockerImage = ref('');

// Export JSON Modal
const showExportModal = ref(false);
const exportedJsonString = ref('');

async function loadBlueprint() {
  isLoading.value = true;
  try {
    blueprint.value = await ApiService.get<any>(`/admin/blueprints/${bpId}`);
  } catch (err) {
    console.error('Failed to load blueprint details:', err);
  } finally {
    isLoading.value = false;
  }
}

async function saveBlueprint() {
  isSaving.value = true;
  try {
    await ApiService.put(`/admin/blueprints/${bpId}`, blueprint.value);
    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to save blueprint:', err);
  } finally {
    isSaving.value = false;
  }
}

function addImage() {
  if (!newDockerImage.value.trim()) return;
  if (!blueprint.value.dockerImages) blueprint.value.dockerImages = [];
  blueprint.value.dockerImages.push(newDockerImage.value.trim());
  newDockerImage.value = '';
}

function removeImage(idx: number) {
  blueprint.value.dockerImages.splice(idx, 1);
}

function addVariable() {
  if (!newVar.value.key.trim() || !newVar.value.name.trim()) return;
  if (!blueprint.value.variables) blueprint.value.variables = [];
  blueprint.value.variables.push({ ...newVar.value, currentValue: newVar.value.defaultValue });
  showAddVarModal.value = false;
  newVar.value = {
    key: '',
    name: '',
    description: '',
    defaultValue: '',
    currentValue: '',
    userViewable: true,
    userEditable: true,
    rules: 'required|string',
    fieldType: 'text',
  };
}

function removeVariable(idx: number) {
  blueprint.value.variables.splice(idx, 1);
}

async function openExportModal() {
  try {
    const res = await ApiService.get<any>(`/admin/blueprints/${bpId}/export`);
    exportedJsonString.value = JSON.stringify(res, null, 2);
    showExportModal.value = true;
  } catch (err) {
    console.error('Failed to export blueprint:', err);
  }
}

function copyExportJson() {
  navigator.clipboard.writeText(exportedJsonString.value);
  copiedJson.value = true;
  setTimeout(() => {
    copiedJson.value = false;
  }, 2000);
}

function downloadExportJson() {
  const blob = new Blob([exportedJsonString.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `egg-${blueprint.value?.name?.toLowerCase().replace(/\s+/g, '-') || 'export'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(() => {
  loadBlueprint();
});
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto pb-12">
    <!-- Header Navigation -->
    <div class="flex flex-wrap items-center justify-between pb-4 border-b border-slate-800 gap-4">
      <div class="flex items-center space-x-3.5">
        <router-link
          to="/admin/blueprints"
          class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Back to Blueprints"
        >
          <ArrowLeft class="w-4 h-4" />
        </router-link>
        <div>
          <div class="flex items-center space-x-2.5">
            <Layers class="w-5 h-5 text-amber-500" />
            <h1 class="text-lg font-bold text-white tracking-tight">
              {{ blueprint?.name || 'Egg Configuration Studio' }}
            </h1>
            <span class="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {{ blueprint?.category || 'Minecraft' }}
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-1 font-mono">
            Author: {{ blueprint?.author }} &bull; {{ blueprint?.serversCount || 0 }} Containers Provisioned
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center space-x-2">
        <button
          @click="openExportModal"
          class="flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors"
        >
          <Download class="w-3.5 h-3.5 mr-1.5" />
          Export Pterodactyl Egg (JSON)
        </button>
        <button
          @click="saveBlueprint"
          :disabled="isSaving"
          class="flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          <Check v-if="saveSuccess" class="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
          <Save v-else class="w-3.5 h-3.5 mr-1.5" />
          {{ saveSuccess ? 'Saved Studio!' : 'Save Egg Definition' }}
        </button>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="flex items-center space-x-1 border-b border-slate-800 pb-px overflow-x-auto text-xs font-medium">
      <button
        @click="activeTab = 'overview'"
        class="px-3.5 py-2.5 border-b-2 transition-colors"
        :class="activeTab === 'overview' ? 'border-amber-500 text-amber-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        Overview & Metadata
      </button>
      <button
        @click="activeTab = 'images'"
        class="px-3.5 py-2.5 border-b-2 transition-colors"
        :class="activeTab === 'images' ? 'border-amber-500 text-amber-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        Docker Containers & Images
      </button>
      <button
        @click="activeTab = 'startup'"
        class="px-3.5 py-2.5 border-b-2 transition-colors"
        :class="activeTab === 'startup' ? 'border-amber-500 text-amber-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        Startup & Stop Rules
      </button>
      <button
        @click="activeTab = 'variables'"
        class="px-3.5 py-2.5 border-b-2 transition-colors"
        :class="activeTab === 'variables' ? 'border-amber-500 text-amber-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        Environment Variables ({{ blueprint?.variables?.length || 0 }})
      </button>
      <button
        @click="activeTab = 'install'"
        class="px-3.5 py-2.5 border-b-2 transition-colors"
        :class="activeTab === 'install' ? 'border-amber-500 text-amber-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        Install Container Script
      </button>
    </div>

    <!-- Tab 1: Overview & Metadata -->
    <div v-if="activeTab === 'overview'" class="bg-[#111622] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
      <h3 class="text-xs font-bold text-slate-200 uppercase tracking-wider">
        Blueprint Metadata & Identifiers
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label class="block text-slate-400 mb-1 font-medium">Blueprint / Egg Name</label>
          <input
            v-model="blueprint.name"
            type="text"
            class="w-full bg-[#0b0f17] border border-slate-700 rounded-lg p-2.5 text-slate-200 outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div>
          <label class="block text-slate-400 mb-1 font-medium">Author / Maintainer</label>
          <input
            v-model="blueprint.author"
            type="text"
            class="w-full bg-[#0b0f17] border border-slate-700 rounded-lg p-2.5 text-slate-200 outline-none focus:ring-1 focus:ring-amber-500 font-mono"
          />
        </div>

        <div>
          <label class="block text-slate-400 mb-1 font-medium">Category</label>
          <input
            v-model="blueprint.category"
            type="text"
            class="w-full bg-[#0b0f17] border border-slate-700 rounded-lg p-2.5 text-slate-200 outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div>
          <label class="block text-slate-400 mb-1 font-medium">Blueprint UUID</label>
          <input
            :value="blueprint.uuid"
            readonly
            class="w-full bg-[#0b0f17] border border-slate-800 rounded-lg p-2.5 text-slate-500 outline-none font-mono cursor-not-allowed"
          />
        </div>

        <div class="col-span-2">
          <label class="block text-slate-400 mb-1 font-medium">Description</label>
          <textarea
            v-model="blueprint.description"
            rows="3"
            class="w-full bg-[#0b0f17] border border-slate-700 rounded-lg p-2.5 text-slate-200 outline-none focus:ring-1 focus:ring-amber-500 resize-none leading-relaxed"
          ></textarea>
        </div>
      </div>
    </div>

    <!-- Tab 2: Docker Containers & Images -->
    <div v-if="activeTab === 'images'" class="bg-[#111622] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
      <h3 class="text-xs font-bold text-slate-200 uppercase tracking-wider">
        Docker OCI Container Images
      </h3>
      <p class="text-xs text-slate-400">
        Define default and fallback container images that users can select in the Server Startup tab.
      </p>

      <div class="space-y-2">
        <div
          v-for="(img, idx) in blueprint.dockerImages"
          :key="img"
          class="flex items-center justify-between p-3 bg-[#0b0f17] rounded-lg border border-slate-800 font-mono text-xs"
        >
          <div class="flex items-center space-x-2">
            <span v-if="idx === 0" class="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded uppercase font-sans font-bold">
              Default
            </span>
            <span class="text-slate-200">{{ img }}</span>
          </div>

          <button
            v-if="blueprint.dockerImages.length > 1"
            @click="removeImage(idx)"
            class="p-1 text-slate-500 hover:text-rose-400"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div class="flex items-center space-x-2 pt-2">
        <input
          v-model="newDockerImage"
          type="text"
          placeholder="ghcr.io/pterodactyl/yolks:java_17"
          class="flex-1 bg-[#0b0f17] border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono outline-none focus:ring-1 focus:ring-amber-500"
        />
        <button
          @click="addImage"
          class="px-3.5 py-2 text-xs bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg shrink-0 flex items-center"
        >
          <Plus class="w-3.5 h-3.5 mr-1" />
          Add Image
        </button>
      </div>
    </div>

    <!-- Tab 3: Startup & Stop Rules -->
    <div v-if="activeTab === 'startup'" class="bg-[#111622] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
      <h3 class="text-xs font-bold text-slate-200 uppercase tracking-wider">
        Process Execution & Termination Signals
      </h3>

      <div class="space-y-4 text-xs">
        <div>
          <label class="block text-slate-400 mb-1 font-medium">Default Startup Command</label>
          <textarea
            v-model="blueprint.startupCommand"
            rows="3"
            class="w-full bg-[#0b0f17] border border-slate-700 rounded-lg p-3 text-amber-300 font-mono text-xs outline-none focus:ring-1 focus:ring-amber-500 leading-relaxed"
          ></textarea>
        </div>

        <div>
          <label class="block text-slate-400 mb-1 font-medium">Container Stop Command / Signal</label>
          <input
            v-model="blueprint.stopCommand"
            type="text"
            placeholder="e.g. stop, quit, SIGTERM"
            class="w-full bg-[#0b0f17] border border-slate-700 rounded-lg p-2.5 text-slate-200 font-mono text-xs outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>
    </div>

    <!-- Tab 4: Environment Variables Editor -->
    <div v-if="activeTab === 'variables'" class="bg-[#111622] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Egg Environment Variables Schema
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">
            Variables mapped to container environment or interpolated into the startup command.
          </p>
        </div>

        <button
          @click="showAddVarModal = true"
          class="flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
        >
          <Plus class="w-3.5 h-3.5 mr-1" />
          Add Variable
        </button>
      </div>

      <div class="space-y-3">
        <div
          v-for="(v, idx) in blueprint.variables"
          :key="v.key"
          class="bg-[#0b0f17] border border-slate-800 rounded-lg p-4 space-y-3"
        >
          <div class="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <div class="flex items-center space-x-2">
              <span class="text-xs font-bold text-white">{{ v.name }}</span>
              <code class="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                {{ v.key }}
              </code>
            </div>

            <button
              @click="removeVariable(idx)"
              class="p-1 text-slate-500 hover:text-rose-400 transition-colors"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label class="block text-[10px] text-slate-500 mb-0.5">Default Value</label>
              <input
                v-model="v.defaultValue"
                type="text"
                class="w-full bg-[#111622] border border-slate-700 rounded p-1.5 text-slate-200 font-mono text-xs"
              />
            </div>
            <div>
              <label class="block text-[10px] text-slate-500 mb-0.5">Validation Rules</label>
              <input
                v-model="v.rules"
                type="text"
                class="w-full bg-[#111622] border border-slate-700 rounded p-1.5 text-slate-200 font-mono text-xs"
              />
            </div>
            <div>
              <label class="block text-[10px] text-slate-500 mb-0.5">Field Type</label>
              <select
                v-model="v.fieldType"
                class="w-full bg-[#111622] border border-slate-700 rounded p-1.5 text-slate-200 font-mono text-xs"
              >
                <option value="text">Text Input</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean Toggle</option>
                <option value="select">Select Dropdown</option>
              </select>
            </div>
          </div>

          <div class="flex items-center space-x-6 text-xs text-slate-300">
            <label class="flex items-center space-x-2 cursor-pointer">
              <input v-model="v.userViewable" type="checkbox" class="rounded bg-[#111622] border-slate-700 text-amber-600 focus:ring-0" />
              <span>User Viewable in Cockpit</span>
            </label>
            <label class="flex items-center space-x-2 cursor-pointer">
              <input v-model="v.userEditable" type="checkbox" class="rounded bg-[#111622] border-slate-700 text-amber-600 focus:ring-0" />
              <span>User Editable</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 5: Install Container Script -->
    <div v-if="activeTab === 'install'" class="bg-[#111622] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
      <h3 class="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center">
        <Terminal class="w-4 h-4 text-amber-400 mr-2" />
        Installation Bash Script (Executed on First Deploy)
      </h3>
      <p class="text-xs text-slate-400">
        This Bash script is run inside an ephemeral Alpine installer container with the server volume mounted to <code>/mnt/server</code>.
      </p>

      <textarea
        v-model="blueprint.installScript"
        rows="14"
        class="w-full bg-[#0b0f17] border border-slate-700 rounded-xl p-4 font-mono text-xs text-emerald-300 outline-none focus:ring-1 focus:ring-amber-500 leading-relaxed resize-none"
        spellcheck="false"
      ></textarea>
    </div>

    <!-- Add Variable Modal -->
    <div v-if="showAddVarModal" class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div class="bg-[#161b22] border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 class="text-sm font-semibold text-white">Add Egg Variable</h3>
          <button @click="showAddVarModal = false" class="text-slate-400 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1 font-medium">Variable Key (ENV)</label>
            <input
              v-model="newVar.key"
              type="text"
              placeholder="e.g. SERVER_JARFILE"
              class="w-full bg-[#0b0f17] border border-slate-700 rounded-lg p-2 text-slate-200 font-mono outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div>
            <label class="block text-slate-400 mb-1 font-medium">Human Display Name</label>
            <input
              v-model="newVar.name"
              type="text"
              placeholder="e.g. Server Executable JAR"
              class="w-full bg-[#0b0f17] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div>
            <label class="block text-slate-400 mb-1 font-medium">Default Value</label>
            <input
              v-model="newVar.defaultValue"
              type="text"
              placeholder="server.jar"
              class="w-full bg-[#0b0f17] border border-slate-700 rounded-lg p-2 text-slate-200 font-mono outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div>
            <label class="block text-slate-400 mb-1 font-medium">Field Type</label>
            <select
              v-model="newVar.fieldType"
              class="w-full bg-[#0b0f17] border border-slate-700 rounded-lg p-2 text-slate-200 font-mono outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
            </select>
          </div>
        </div>

        <div class="flex justify-end space-x-2 pt-2 border-t border-slate-800">
          <button @click="showAddVarModal = false" class="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg">
            Cancel
          </button>
          <button @click="addVariable" class="px-3.5 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg">
            Add Variable
          </button>
        </div>
      </div>
    </div>

    <!-- Export JSON Modal -->
    <div v-if="showExportModal" class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div class="bg-[#161b22] border border-slate-800 rounded-xl p-6 w-full max-w-3xl shadow-2xl space-y-4 flex flex-col h-[80vh]">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div class="flex items-center space-x-2">
            <Download class="w-4 h-4 text-amber-400" />
            <h3 class="text-sm font-semibold text-white">Exported Pterodactyl Egg Format (JSON)</h3>
          </div>
          <button @click="showExportModal = false" class="text-slate-400 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <textarea
          v-model="exportedJsonString"
          readonly
          class="flex-1 w-full bg-[#0b0f17] border border-slate-800 rounded-xl p-4 font-mono text-xs text-amber-300 select-all outline-none resize-none leading-relaxed"
        ></textarea>

        <div class="flex justify-end space-x-2 pt-2 border-t border-slate-800">
          <button
            @click="copyExportJson"
            class="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center"
          >
            <Check v-if="copiedJson" class="w-3.5 h-3.5 mr-1 text-emerald-400" />
            <Copy v-else class="w-3.5 h-3.5 mr-1" />
            Copy JSON
          </button>
          <button
            @click="downloadExportJson"
            class="px-3.5 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg flex items-center"
          >
            <Download class="w-3.5 h-3.5 mr-1" />
            Download .json
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
