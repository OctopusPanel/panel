<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ApiService } from '../../services/api.js';
import { Rocket, Save, Check, RefreshCw, AlertCircle, Terminal, HelpCircle } from 'lucide-vue-next';
import { EggVariable } from '../../services/demo-data.js';

const props = defineProps<{
  serverUuid: string;
}>();

const isLoading = ref(false);
const isSaving = ref(false);
const saveSuccess = ref(false);
const restartNotice = ref(false);

const rawStartupCommand = ref('');
const selectedDockerImage = ref('');
const availableDockerImages = ref<string[]>([]);
const variables = ref<EggVariable[]>([]);

async function loadVariables() {
  isLoading.value = true;
  try {
    const res = await ApiService.get<{
      variables: EggVariable[];
      startupCommand: string;
      dockerImage: string;
      dockerImages: string[];
    }>(`/client/servers/${props.serverUuid}/variables`);

    variables.value = res.variables || [];
    rawStartupCommand.value = res.startupCommand || '';
    selectedDockerImage.value = res.dockerImage || '';
    availableDockerImages.value = res.dockerImages || [res.dockerImage];
  } catch (err) {
    console.error('Failed to load startup config:', err);
  } finally {
    isLoading.value = false;
  }
}

// Live interpolated startup command
const interpolatedCommand = computed(() => {
  let cmd = rawStartupCommand.value;
  for (const v of variables.value) {
    const val = v.currentValue !== undefined && v.currentValue !== null ? String(v.currentValue) : v.defaultValue;
    // Replace all occurrences of {{KEY}} or {{ KEY }}
    const regex = new RegExp(`{{\\s*${v.key}\\s*}}`, 'g');
    cmd = cmd.replace(regex, val);
  }
  return cmd;
});

async function saveVariables() {
  isSaving.value = true;
  try {
    await ApiService.put(`/client/servers/${props.serverUuid}/variables`, {
      variables: variables.value,
      dockerImage: selectedDockerImage.value,
      startupCommand: rawStartupCommand.value,
    });
    saveSuccess.value = true;
    restartNotice.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to save variables:', err);
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  loadVariables();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-sm font-bold text-white flex items-center">
          <Rocket class="w-4 h-4 text-blue-400 mr-2" />
          Startup & Egg Environment Variables
        </h3>
        <p class="text-xs text-slate-400 mt-0.5">
          Tune runtime environment parameters, Java flags, execution binaries, and container runtime image.
        </p>
      </div>

      <button
        @click="saveVariables"
        :disabled="isSaving"
        class="flex items-center px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg shadow-blue-500/10"
      >
        <Check v-if="saveSuccess" class="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
        <Save v-else class="w-3.5 h-3.5 mr-1.5" />
        {{ saveSuccess ? 'Saved & Rehashed!' : 'Save Variables & Rehash' }}
      </button>
    </div>

    <!-- Restart Notice Banner -->
    <div
      v-if="restartNotice"
      class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between text-xs text-amber-300"
    >
      <div class="flex items-center space-x-2.5">
        <AlertCircle class="w-4 h-4 text-amber-400 shrink-0" />
        <span>Configuration updated successfully. A server restart is required for changes to take effect in the container.</span>
      </div>
      <button
        @click="restartNotice = false"
        class="text-amber-400 hover:text-white text-xs font-semibold ml-4"
      >
        Dismiss
      </button>
    </div>

    <!-- Live Startup Command Preview Box -->
    <div class="bg-[#111622] border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center">
          <Terminal class="w-4 h-4 text-blue-400 mr-2" />
          Live Startup Command Preview
        </span>
        <span class="text-[10px] text-slate-500 font-mono">Dynamic Interpolation</span>
      </div>

      <div class="bg-[#0b0f17] border border-slate-800 rounded-lg p-3.5 font-mono text-xs text-amber-300 select-all break-all leading-relaxed">
        {{ interpolatedCommand }}
      </div>

      <p class="text-[11px] text-slate-400">
        Variables highlighted with brackets (e.g. <code class="text-blue-400">{{ '{{SERVER_MEMORY}}' }}</code>) are substituted in real-time when saving.
      </p>
    </div>

    <!-- Container Runtime / Docker Image -->
    <div class="bg-[#111622] border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
      <label class="block text-xs font-semibold text-slate-200 uppercase tracking-wider">
        Container Docker Image
      </label>
      <select
        v-model="selectedDockerImage"
        class="w-full bg-[#0b0f17] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
      >
        <option v-for="img in availableDockerImages" :key="img" :value="img">
          {{ img }}
        </option>
      </select>
      <p class="text-[11px] text-slate-400">
        Specifies the base OCI container image containing runtime tools, JVM packages, or binary dependencies.
      </p>
    </div>

    <!-- Dynamic Variable Form Grid -->
    <div class="bg-[#111622] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      <h4 class="text-xs font-semibold text-slate-200 uppercase tracking-wider">
        Egg Environment Variables
      </h4>

      <div v-if="isLoading" class="p-8 text-center text-xs font-mono text-slate-500">
        Loading egg variable schema...
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="v in variables"
          :key="v.key"
          class="bg-[#0b0f17] border border-slate-800/80 rounded-lg p-3.5 space-y-2"
        >
          <!-- Variable Name & Key -->
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white">{{ v.name }}</span>
            <code class="text-[10px] text-blue-400 font-mono bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
              {{ v.key }}
            </code>
          </div>

          <!-- Description -->
          <p class="text-[11px] text-slate-400 leading-tight">
            {{ v.description }}
          </p>

          <!-- Input Renderers -->
          <!-- 1. Select Dropdown -->
          <div v-if="v.fieldType === 'select'">
            <select
              v-model="v.currentValue"
              :disabled="!v.userEditable"
              class="w-full bg-[#111622] border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              <option v-for="opt in v.options" :key="opt" :value="opt">
                {{ opt }}
              </option>
            </select>
          </div>

          <!-- 2. Boolean Toggle -->
          <div v-else-if="v.fieldType === 'boolean'" class="flex items-center space-x-3 pt-1">
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                :checked="String(v.currentValue).toLowerCase() === 'true'"
                :disabled="!v.userEditable"
                @change="(e: any) => v.currentValue = e.target.checked ? 'true' : 'false'"
                class="sr-only peer"
              />
              <div class="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              <span class="ml-2 text-xs font-mono text-slate-300">
                {{ String(v.currentValue).toLowerCase() === 'true' ? 'Enabled' : 'Disabled' }}
              </span>
            </label>
          </div>

          <!-- 3. Number -->
          <div v-else-if="v.fieldType === 'number'">
            <input
              v-model="v.currentValue"
              type="number"
              :disabled="!v.userEditable"
              class="w-full bg-[#111622] border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          <!-- 4. Default Text -->
          <div v-else>
            <input
              v-model="v.currentValue"
              type="text"
              :disabled="!v.userEditable"
              class="w-full bg-[#111622] border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          <!-- Validation rule footnote -->
          <div class="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
            <span>Rules: {{ v.rules || 'none' }}</span>
            <span v-if="!v.userEditable" class="text-amber-500/80">Read-Only</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
