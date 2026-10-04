<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ApiService } from '../../services/api.js';
import { File, Folder, FolderPlus, FilePlus, Trash2, Edit3, ArrowLeft, Save, X } from 'lucide-vue-next';
import LoadingOverlay from '../ui/LoadingOverlay.vue';
import ButtonSpinner from '../ui/ButtonSpinner.vue';

const props = defineProps<{
  serverUuid: string;
}>();

const { t } = useI18n();

interface FileEntry {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  modifiedAt?: string;
}

const currentDirectory = ref('/');
const files = ref<FileEntry[]>([]);
const isLoading = ref(false);
const isDeleting = ref(false);

// Edit Modal
const editingFile = ref<string | null>(null);
const fileContent = ref('');
const isSaving = ref(false);

// New Folder / File Modals
const showNewFolderModal = ref(false);
const newFolderName = ref('');
const showNewFileModal = ref(false);
const newFileName = ref('');

async function loadFiles(dir = currentDirectory.value) {
  isLoading.value = true;
  try {
    const data = await ApiService.get<FileEntry[]>(
      `/client/servers/${props.serverUuid}/files?directory=${encodeURIComponent(dir)}`,
    );
    files.value = data;
    currentDirectory.value = dir;
  } catch (err) {
    console.error('Failed to load files:', err);
  } finally {
    isLoading.value = false;
  }
}

function navigateTo(folderName: string) {
  const newPath = currentDirectory.value === '/' ? `/${folderName}` : `${currentDirectory.value}/${folderName}`;
  loadFiles(newPath);
}

function navigateUp() {
  if (currentDirectory.value === '/') return;
  const parts = currentDirectory.value.split('/').filter(Boolean);
  parts.pop();
  const parentPath = parts.length === 0 ? '/' : `/${parts.join('/')}`;
  loadFiles(parentPath);
}

async function openFile(fileName: string) {
  const filePath = currentDirectory.value === '/' ? `/${fileName}` : `${currentDirectory.value}/${fileName}`;
  try {
    const res = await ApiService.get<{ content: string }>(
      `/client/servers/${props.serverUuid}/files/contents?file=${encodeURIComponent(filePath)}`,
    );
    editingFile.value = filePath;
    fileContent.value = res.content;
  } catch (err) {
    console.error('Failed to read file:', err);
  }
}

async function saveFile() {
  if (!editingFile.value) return;
  isSaving.value = true;
  try {
    await ApiService.post(`/client/servers/${props.serverUuid}/files/contents`, {
      file: editingFile.value,
      content: fileContent.value,
    });
    editingFile.value = null;
    loadFiles();
  } catch (err) {
    console.error('Failed to save file:', err);
  } finally {
    isSaving.value = false;
  }
}

async function deleteItem(name: string) {
  const path = currentDirectory.value === '/' ? `/${name}` : `${currentDirectory.value}/${name}`;
  if (!confirm(`Are you sure you want to delete ${name}?`)) return;

  isDeleting.value = true;
  try {
    await ApiService.delete(`/client/servers/${props.serverUuid}/files`, {
      paths: [path],
    });
    await loadFiles();
  } catch (err) {
    console.error('Failed to delete item:', err);
  } finally {
    isDeleting.value = false;
  }
}

async function createFolder() {
  if (!newFolderName.value.trim()) return;
  const folderPath = currentDirectory.value === '/' ? `/${newFolderName.value}` : `${currentDirectory.value}/${newFolderName.value}`;
  try {
    await ApiService.post(`/client/servers/${props.serverUuid}/files/directory`, {
      path: folderPath,
    });
    showNewFolderModal.value = false;
    newFolderName.value = '';
    loadFiles();
  } catch (err) {
    console.error('Failed to create directory:', err);
  }
}

async function createFile() {
  if (!newFileName.value.trim()) return;
  const filePath = currentDirectory.value === '/' ? `/${newFileName.value}` : `${currentDirectory.value}/${newFileName.value}`;
  try {
    await ApiService.post(`/client/servers/${props.serverUuid}/files/contents`, {
      file: filePath,
      content: '',
    });
    showNewFileModal.value = false;
    newFileName.value = '';
    loadFiles();
  } catch (err) {
    console.error('Failed to create file:', err);
  }
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

onMounted(() => {
  loadFiles();
});
</script>

<template>
  <div class="bg-surface-card border border-surface-border rounded-xl overflow-hidden shadow-xl relative">
    <LoadingOverlay :active="isLoading" text="Loading files..." />
    <LoadingOverlay :active="isDeleting" text="Deleting file..." />

    <!-- Toolbar -->
    <div class="flex items-center justify-between p-3.5 border-b border-surface-border bg-surface-deep">
      <div class="flex items-center space-x-2">
        <button
          v-if="currentDirectory !== '/'"
          @click="navigateUp"
          class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-surface-elevated transition-colors"
        >
          <ArrowLeft class="w-4 h-4" />
        </button>
        <span class="text-xs font-mono text-slate-300 bg-surface-elevated px-2.5 py-1 rounded-md">
          {{ currentDirectory }}
        </span>
      </div>

      <div class="flex items-center space-x-2">
        <button
          @click="showNewFileModal = true"
          class="flex items-center px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-dark text-black transition-colors"
        >
          <FilePlus class="w-3.5 h-3.5 mr-1.5" />
          {{ t('files.newFile') }}
        </button>
        <button
          @click="showNewFolderModal = true"
          class="flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg border border-surface-border hover:bg-surface-elevated text-slate-300 transition-colors"
        >
          <FolderPlus class="w-3.5 h-3.5 mr-1.5" />
          {{ t('files.newDirectory') }}
        </button>
      </div>
    </div>

    <!-- Files Table -->
    <div class="overflow-x-auto min-h-[300px]">
      <div v-if="isLoading" class="p-8 text-center text-sm text-slate-400 font-mono">
        {{ t('common.loading') }}
      </div>

      <div v-else-if="files.length === 0" class="p-8 text-center text-sm text-slate-500">
        {{ t('files.emptyDirectory') }}
      </div>

      <table v-else class="w-full text-left text-xs">
        <thead class="bg-surface-deep text-slate-400 uppercase tracking-wider text-[10px] border-b border-surface-border">
          <tr>
            <th class="py-2.5 px-4 font-semibold">{{ t('servers.name') }}</th>
            <th class="py-2.5 px-4 font-semibold">{{ t('files.size') }}</th>
            <th class="py-2.5 px-4 font-semibold text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60 font-mono">
          <tr
            v-for="file in files"
            :key="file.name"
            class="hover:bg-slate-800/30 transition-colors group"
          >
            <td class="py-2.5 px-4 flex items-center space-x-2.5 cursor-pointer" @click="file.isDirectory ? navigateTo(file.name) : openFile(file.name)">
              <Folder v-if="file.isDirectory" class="w-4 h-4 text-blue-400 shrink-0" />
              <File v-else class="w-4 h-4 text-slate-400 shrink-0" />
              <span class="text-slate-200 group-hover:text-blue-400 transition-colors">{{ file.name }}</span>
            </td>
            <td class="py-2.5 px-4 text-slate-400">
              {{ file.isDirectory ? '-' : formatBytes(file.size) }}
            </td>
            <td class="py-2.5 px-4 text-right space-x-2">
              <button
                v-if="!file.isDirectory"
                @click="openFile(file.name)"
                class="p-1 text-slate-400 hover:text-blue-400 rounded hover:bg-slate-800 transition-colors"
              >
                <Edit3 class="w-3.5 h-3.5" />
              </button>
              <button
                @click="deleteItem(file.name)"
                class="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit File Modal -->
    <div
      v-if="editingFile"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div class="bg-surface-card border border-surface-border rounded-xl w-full max-w-4xl flex flex-col h-[80vh] shadow-2xl overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-surface-deep">
          <span class="text-xs font-mono text-slate-200 font-medium">{{ editingFile }}</span>
          <div class="flex items-center space-x-2">
            <button
              @click="saveFile"
              :disabled="isSaving"
              class="flex items-center px-3 py-1 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-dark text-black transition-colors"
            >
              <Save class="w-3.5 h-3.5 mr-1.5" />
              {{ t('files.save') }}
            </button>
            <button
              @click="editingFile = null"
              class="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-surface-elevated transition-colors"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>
        <textarea
          v-model="fileContent"
          class="flex-1 w-full bg-surface-deep p-4 text-slate-200 font-mono text-xs outline-none resize-none border-none leading-relaxed"
          spellcheck="false"
        ></textarea>
      </div>
    </div>

    <!-- New Folder Modal -->
    <div v-if="showNewFolderModal" class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div class="bg-surface-card border border-surface-border rounded-xl p-5 w-full max-w-md shadow-2xl">
        <h3 class="text-sm font-semibold text-slate-100 mb-3">{{ t('files.newDirectory') }}</h3>
        <input
          v-model="newFolderName"
          type="text"
          placeholder="Folder name"
          class="w-full bg-surface-deep border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-primary mb-4"
        />
        <div class="flex justify-end space-x-2">
          <button @click="showNewFolderModal = false" class="px-3 py-1.5 text-xs text-slate-300 hover:bg-surface-elevated rounded-lg">
            {{ t('common.cancel') }}
          </button>
          <ButtonSpinner
            @click="createFolder"
            :disabled="!newFolderName.trim()"
            spinner-color="white"
            class="px-3.5 py-1.5 text-xs bg-primary hover:bg-primary-dark text-slate-950 font-semibold rounded-lg"
          >
            {{ t('common.create') }}
          </ButtonSpinner>
        </div>
      </div>
    </div>

    <!-- New File Modal -->
    <div v-if="showNewFileModal" class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div class="bg-surface-card border border-surface-border rounded-xl p-5 w-full max-w-md shadow-2xl">
        <h3 class="text-sm font-semibold text-slate-100 mb-3">{{ t('files.newFile') }}</h3>
        <input
          v-model="newFileName"
          type="text"
          placeholder="e.g. server.properties"
          class="w-full bg-surface-deep border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-primary mb-4"
        />
        <div class="flex justify-end space-x-2">
          <button @click="showNewFileModal = false" class="px-3 py-1.5 text-xs text-slate-300 hover:bg-surface-elevated rounded-lg">
            {{ t('common.cancel') }}
          </button>
          <ButtonSpinner
            @click="createFile"
            :disabled="!newFileName.trim()"
            spinner-color="white"
            class="px-3.5 py-1.5 text-xs bg-primary hover:bg-primary-dark text-slate-950 font-semibold rounded-lg"
          >
            {{ t('common.create') }}
          </ButtonSpinner>
        </div>
      </div>
    </div>
  </div>
</template>
