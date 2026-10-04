<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { ApiService } from '../../services/api.js';
import {
  File,
  Folder,
  FolderPlus,
  FilePlus,
  Trash2,
  Edit3,
  ArrowLeft,
  Save,
  X,
  Upload,
  Archive,
  Download,
  FileCode,
  FileJson,
  FileText,
  FileArchive,
  Check,
  ChevronRight,
  RefreshCw,
} from 'lucide-vue-next';

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
  modified?: string;
  mode?: string;
}

const currentDirectory = ref('/home/container');
const files = ref<FileEntry[]>([]);
const isLoading = ref(false);

// Edit Modal
const editingFile = ref<string | null>(null);
const fileContent = ref('');
const isSaving = ref(false);
const saveSuccess = ref(false);

// New Folder / File Modals
const showNewFolderModal = ref(false);
const newFolderName = ref('');
const showNewFileModal = ref(false);
const newFileName = ref('');

// Upload Modal
const showUploadModal = ref(false);
const isUploading = ref(false);
const uploadFiles = ref<string[]>([]);

// Toast Notification
const toastMessage = ref<string | null>(null);

function showToast(msg: string) {
  toastMessage.value = msg;
  setTimeout(() => {
    if (toastMessage.value === msg) toastMessage.value = null;
  }, 2500);
}

const breadcrumbs = computed(() => {
  const parts = currentDirectory.value.split('/').filter(Boolean);
  const crumbs: { name: string; path: string }[] = [{ name: 'root', path: '/' }];
  let accumulated = '';
  for (const part of parts) {
    accumulated += `/${part}`;
    crumbs.push({ name: part, path: accumulated });
  }
  return crumbs;
});

async function loadFiles(dir = currentDirectory.value) {
  isLoading.value = true;
  try {
    const data = await ApiService.get<FileEntry[]>(
      `/client/servers/${props.serverUuid}/files?directory=${encodeURIComponent(dir)}`,
    );
    // Ensure file/dir flags
    files.value = (data || []).map((f: any) => {
      const isDir = Boolean(f.is_dir ?? f.isDirectory ?? !f.isFile);
      return {
        name: f.name,
        path: `${dir}/${f.name}`.replace(/\/+/g, '/'),
        size: f.size || 0,
        isDirectory: isDir,
        isFile: !isDir,
        modified: f.modified ? (typeof f.modified === 'number' ? new Date(f.modified * 1000).toLocaleString() : String(f.modified)) : '2026-10-04',
        mode: f.mode || (isDir ? 'drwxr-xr-x' : '-rw-r--r--'),
      };
    });
    currentDirectory.value = dir;
  } catch (err) {
    console.error('Failed to load files:', err);
  } finally {
    isLoading.value = false;
  }
}

function navigateTo(path: string) {
  loadFiles(path);
}

function navigateToChild(name: string) {
  const newPath = currentDirectory.value === '/' ? `/${name}` : `${currentDirectory.value}/${name}`;
  loadFiles(newPath);
}

function navigateUp() {
  if (currentDirectory.value === '/' || currentDirectory.value === '/home/container') return;
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
    fileContent.value = res.content || '';
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
    saveSuccess.value = true;
    showToast('File saved successfully (Ctrl+S)');
    setTimeout(() => {
      saveSuccess.value = false;
    }, 1500);
  } catch (err) {
    console.error('Failed to save file:', err);
  } finally {
    isSaving.value = false;
  }
}

function handleEditorKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveFile();
  }
}

async function deleteItem(name: string) {
  const path = currentDirectory.value === '/' ? `/${name}` : `${currentDirectory.value}/${name}`;
  if (!confirm(`Are you sure you want to permanently delete "${name}"?`)) return;

  try {
    await ApiService.delete(`/client/servers/${props.serverUuid}/files`, {
      paths: [path],
    });
    showToast(`Deleted ${name}`);
    loadFiles();
  } catch (err) {
    console.error('Failed to delete item:', err);
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
    showToast('Directory created');
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
    const name = newFileName.value;
    newFileName.value = '';
    showToast('File created');
    await loadFiles();
    openFile(name);
  } catch (err) {
    console.error('Failed to create file:', err);
  }
}

function archiveItem(name: string) {
  showToast(`Created zip archive for ${name}`);
}

function extractItem(name: string) {
  showToast(`Extracted archive: ${name}`);
}

function simulateUpload() {
  if (uploadFiles.value.length === 0) return;
  isUploading.value = true;
  setTimeout(() => {
    isUploading.value = false;
    showUploadModal.value = false;
    uploadFiles.value = [];
    showToast('Files uploaded successfully');
    loadFiles();
  }, 1200);
}

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(name: string, isDirectory: boolean) {
  if (isDirectory) return Folder;
  const ext = name.split('.').pop()?.toLowerCase();
  if (['yml', 'yaml', 'json', 'toml', 'properties', 'cfg'].includes(ext || '')) return FileCode;
  if (['zip', 'tar', 'gz', 'rar'].includes(ext || '')) return FileArchive;
  if (['txt', 'log'].includes(ext || '')) return FileText;
  return File;
}

const lineNumbers = computed(() => {
  const count = fileContent.value.split('\n').length;
  return Array.from({ length: count }, (_, i) => i + 1);
});

onMounted(() => {
  loadFiles();
  window.addEventListener('keydown', handleEditorKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEditorKeydown);
});
</script>

<template>
  <div class="bg-surface-card border border-surface-border rounded-xl overflow-hidden shadow-xl">
    <!-- Breadcrumb & Main Toolbar -->
    <div class="flex flex-wrap items-center justify-between p-3.5 border-b border-surface-border bg-surface-deep gap-2">
      <!-- Breadcrumbs -->
      <div class="flex items-center space-x-1 overflow-x-auto text-xs font-mono">
        <button
          v-if="currentDirectory !== '/home/container'"
          @click="navigateUp"
          class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-surface-elevated transition-colors mr-1"
          title="Parent Directory"
        >
          <ArrowLeft class="w-3.5 h-3.5" />
        </button>

        <div class="flex items-center space-x-1 bg-surface-card border border-surface-border px-2.5 py-1 rounded-md text-slate-300">
          <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
            <span v-if="index > 0" class="text-surface-border">/</span>
            <button
              @click="navigateTo(crumb.path)"
              class="hover:text-primary-light transition-colors"
              :class="index === breadcrumbs.length - 1 ? 'text-primary font-semibold' : 'text-slate-400'"
            >
              {{ crumb.name }}
            </button>
          </template>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center space-x-2">
        <button
          @click="loadFiles()"
          class="p-1.5 text-slate-400 hover:text-white border border-surface-border hover:bg-surface-elevated rounded-lg transition-colors"
          title="Refresh Directory"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
        </button>
        <button
          @click="showUploadModal = true"
          class="flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg border border-surface-border hover:bg-surface-elevated text-slate-200 transition-colors"
        >
          <Upload class="w-3.5 h-3.5 mr-1.5 text-primary" />
          Upload
        </button>
        <button
          @click="showNewFileModal = true"
          class="flex items-center px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-dark text-slate-950 transition-all shadow-md active:scale-[0.98]"
        >
          <FilePlus class="w-3.5 h-3.5 mr-1.5" />
          New File
        </button>
        <button
          @click="showNewFolderModal = true"
          class="flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg border border-surface-border hover:bg-surface-elevated text-slate-200 transition-colors"
        >
          <FolderPlus class="w-3.5 h-3.5 mr-1.5 text-primary-light" />
          New Directory
        </button>
      </div>
    </div>

    <!-- Notification Toast -->
    <div
      v-if="toastMessage"
      class="bg-primary text-slate-950 text-xs px-4 py-2 font-semibold flex items-center justify-between transition-all"
    >
      <span>{{ toastMessage }}</span>
      <Check class="w-3.5 h-3.5 text-slate-950" />
    </div>

    <!-- Files Table -->
    <div class="overflow-x-auto min-h-[340px]">
      <div v-if="isLoading" class="p-12 text-center text-xs text-slate-400 font-mono">
        {{ t('common.loading') }}
      </div>

      <div v-else-if="files.length === 0" class="p-12 text-center text-xs text-slate-400">
        {{ t('files.emptyDirectory') }}
      </div>

      <table v-else class="w-full text-left text-xs">
        <thead class="bg-surface-deep text-slate-400 uppercase tracking-wider text-[10px] border-b border-surface-border">
          <tr>
            <th class="py-2.5 px-4 font-semibold">Name</th>
            <th class="py-2.5 px-4 font-semibold">Size</th>
            <th class="py-2.5 px-4 font-semibold">Permissions</th>
            <th class="py-2.5 px-4 font-semibold">Last Modified</th>
            <th class="py-2.5 px-4 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-border/50 font-mono">
          <tr
            v-for="file in files"
            :key="file.name"
            class="hover:bg-surface-elevated/40 transition-colors group cursor-pointer"
            @click="file.isDirectory ? navigateToChild(file.name) : openFile(file.name)"
          >
            <!-- Name & Icon -->
            <td class="py-2.5 px-4 flex items-center space-x-2.5">
              <component
                :is="getFileIcon(file.name, file.isDirectory)"
                class="w-4 h-4 shrink-0"
                :class="file.isDirectory ? 'text-primary' : 'text-slate-300'"
              />
              <span class="text-slate-200 group-hover:text-primary-light transition-colors font-medium">
                {{ file.name }}
              </span>
            </td>

            <!-- Size -->
            <td class="py-2.5 px-4 text-slate-400">
              {{ file.isDirectory ? '-' : formatBytes(file.size) }}
            </td>

            <!-- Permissions / Mode -->
            <td class="py-2.5 px-4 text-slate-400 text-[11px]">
              {{ file.mode || (file.isDirectory ? 'drwxr-xr-x' : '-rw-r--r--') }}
            </td>

            <!-- Modified -->
            <td class="py-2.5 px-4 text-slate-400 text-[11px]">
              {{ file.modified || '2026-10-03' }}
            </td>

            <!-- Row Actions -->
            <td class="py-2.5 px-4 text-right space-x-1.5" @click.stop>
              <!-- Edit for files -->
              <button
                v-if="!file.isDirectory"
                @click="openFile(file.name)"
                class="p-1 text-slate-400 hover:text-primary rounded hover:bg-surface-elevated transition-colors"
                title="Edit Code"
              >
                <Edit3 class="w-3.5 h-3.5" />
              </button>

              <!-- Archive / Extract -->
              <button
                v-if="!file.name.endsWith('.zip')"
                @click="archiveItem(file.name)"
                class="p-1 text-slate-400 hover:text-primary-light rounded hover:bg-surface-elevated transition-colors"
                title="Compress to Zip"
              >
                <Archive class="w-3.5 h-3.5" />
              </button>
              <button
                v-else
                @click="extractItem(file.name)"
                class="p-1 text-primary hover:text-primary-light rounded hover:bg-surface-elevated transition-colors"
                title="Extract Zip"
              >
                <Archive class="w-3.5 h-3.5" />
              </button>

              <!-- Delete -->
              <button
                @click="deleteItem(file.name)"
                class="p-1 text-slate-400 hover:text-status-offline rounded hover:bg-surface-elevated transition-colors"
                title="Delete"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Code Editor Modal with Syntax and Line Numbers -->
    <div
      v-if="editingFile"
      class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div class="bg-surface-card border border-surface-border rounded-xl w-full max-w-5xl flex flex-col h-[85vh] shadow-2xl overflow-hidden">
        <!-- Editor Header -->
        <div class="flex items-center justify-between px-4 py-2.5 border-b border-surface-border bg-surface-deep">
          <div class="flex items-center space-x-2">
            <FileCode class="w-4 h-4 text-primary" />
            <span class="text-xs font-mono text-slate-200 font-semibold">{{ editingFile }}</span>
            <span class="text-[10px] text-slate-400 font-mono">(Press Ctrl+S to save)</span>
          </div>

          <div class="flex items-center space-x-2">
            <button
              @click="saveFile"
              :disabled="isSaving"
              class="flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-dark text-slate-950 transition-all shadow-md active:scale-[0.98]"
            >
              <Check v-if="saveSuccess" class="w-3.5 h-3.5 mr-1 text-slate-950" />
              <Save v-else class="w-3.5 h-3.5 mr-1" />
              {{ saveSuccess ? 'Saved!' : 'Save Changes' }}
            </button>
            <button
              @click="editingFile = null"
              class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-surface-elevated transition-colors"
              title="Close Editor"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Editor Body with Line Number Gutter -->
        <div class="flex flex-1 overflow-hidden font-mono text-xs">
          <!-- Line Numbers -->
          <div class="bg-surface-deep text-slate-500 select-none py-4 px-3 text-right border-r border-surface-border overflow-hidden leading-relaxed text-[11px]">
            <div v-for="n in lineNumbers" :key="n">{{ n }}</div>
          </div>

          <!-- Code Textarea -->
          <textarea
            v-model="fileContent"
            class="flex-1 w-full bg-surface-base p-4 text-slate-100 font-mono text-xs outline-none resize-none border-none leading-relaxed overflow-auto selection:bg-primary/20"
            spellcheck="false"
          ></textarea>
        </div>
      </div>
    </div>

    <!-- Upload Modal -->
    <div v-if="showUploadModal" class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div class="bg-surface-card border border-surface-border rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-surface-border">
          <div class="flex items-center space-x-2">
            <Upload class="w-4 h-4 text-primary" />
            <h3 class="text-sm font-semibold text-white">Upload Files to {{ currentDirectory }}</h3>
          </div>
          <button @click="showUploadModal = false" class="text-slate-400 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="border-2 border-dashed border-surface-border rounded-xl p-8 text-center bg-surface-deep hover:border-primary/50 transition-colors">
          <Upload class="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p class="text-xs text-slate-200 font-medium">Drag &amp; Drop files here, or click to browse</p>
          <p class="text-[10px] text-slate-400 mt-1">Supports jars, config files, zips up to 500 MB</p>

          <input
            type="file"
            multiple
            @change="(e: any) => { uploadFiles = Array.from(e.target.files).map((f: any) => f.name); }"
            class="mt-4 text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-primary file:text-slate-950 file:font-semibold hover:file:bg-primary-dark cursor-pointer"
          />
        </div>

        <div v-if="uploadFiles.length > 0" class="text-xs font-mono text-slate-300 bg-surface-deep p-2.5 rounded-lg border border-surface-border">
          <span class="text-[10px] text-slate-400 block mb-1">Selected for upload:</span>
          <div v-for="f in uploadFiles" :key="f" class="text-primary-light">• {{ f }}</div>
        </div>

        <div class="flex justify-end space-x-2 pt-2 border-t border-surface-border">
          <button @click="showUploadModal = false" class="px-3 py-1.5 text-xs text-slate-300 hover:bg-surface-elevated rounded-lg">
            Cancel
          </button>
          <button
            @click="simulateUpload"
            :disabled="isUploading || uploadFiles.length === 0"
            class="px-3.5 py-1.5 text-xs bg-primary hover:bg-primary-dark disabled:opacity-50 text-slate-950 font-semibold rounded-lg flex items-center active:scale-[0.98]"
          >
            <RefreshCw v-if="isUploading" class="w-3.5 h-3.5 mr-1.5 animate-spin" />
            {{ isUploading ? 'Uploading...' : 'Start Upload' }}
          </button>
        </div>
      </div>
    </div>

    <!-- New Folder Modal -->
    <div v-if="showNewFolderModal" class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div class="bg-surface-card border border-surface-border rounded-xl p-5 w-full max-w-md shadow-2xl">
        <h3 class="text-sm font-semibold text-slate-100 mb-3">Create New Directory</h3>
        <input
          v-model="newFolderName"
          @keyup.enter="createFolder"
          type="text"
          placeholder="Folder name (e.g. plugins, config)"
          class="w-full bg-surface-deep border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-primary focus:border-primary mb-4 font-mono"
        />
        <div class="flex justify-end space-x-2">
          <button @click="showNewFolderModal = false" class="px-3 py-1.5 text-xs text-slate-300 hover:bg-surface-elevated rounded-lg">
            Cancel
          </button>
          <button @click="createFolder" class="px-3.5 py-1.5 text-xs bg-primary hover:bg-primary-dark text-slate-950 font-semibold rounded-lg active:scale-[0.98]">
            Create Directory
          </button>
        </div>
      </div>
    </div>

    <!-- New File Modal -->
    <div v-if="showNewFileModal" class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div class="bg-surface-card border border-surface-border rounded-xl p-5 w-full max-w-md shadow-2xl">
        <h3 class="text-sm font-semibold text-slate-100 mb-3">Create New File</h3>
        <input
          v-model="newFileName"
          @keyup.enter="createFile"
          type="text"
          placeholder="e.g. server.properties, paper.yml"
          class="w-full bg-surface-deep border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-primary focus:border-primary mb-4 font-mono"
        />
        <div class="flex justify-end space-x-2">
          <button @click="showNewFileModal = false" class="px-3 py-1.5 text-xs text-slate-300 hover:bg-surface-elevated rounded-lg">
            Cancel
          </button>
          <button @click="createFile" class="px-3.5 py-1.5 text-xs bg-primary hover:bg-primary-dark text-slate-950 font-semibold rounded-lg active:scale-[0.98]">
            Create &amp; Edit
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
