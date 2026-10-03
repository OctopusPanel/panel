<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { ApiService } from '../../services/api.js';
import {
  DemoSystemUpdateInfo,
  DemoDatabaseSnapshot,
} from '../../services/demo-data.js';
import {
  Sparkles,
  RefreshCw,
  Server,
  Database,
  ArrowUpCircle,
  CheckCircle2,
  AlertTriangle,
  Download,
  RotateCcw,
  Trash2,
  Terminal,
  ShieldCheck,
  Cpu,
  Layers,
  X,
  Loader2,
  Info,
} from 'lucide-vue-next';

const { t } = useI18n();

// Tabs: 'updates' | 'snapshots'
const activeTab = ref<'updates' | 'snapshots'>('updates');

// Panel Update State
const updateInfo = ref<DemoSystemUpdateInfo | null>(null);
const isLoadingUpdates = ref(false);

// Fleet Matrix State
const nodes = ref<any[]>([]);
const updatingNodeIds = ref<Set<number>>(new Set());
const isUpdatingFleet = ref(false);

// Database Snapshots State
const snapshots = ref<DemoDatabaseSnapshot[]>([]);
const isLoadingSnapshots = ref(false);
const isCreatingSnapshot = ref(false);
const restoringSnapshotId = ref<string | null>(null);

// Modal & Live Stream State
const showUpdateModal = ref(false);
const streamLogs = ref<string[]>([]);
const currentStepNumber = ref(1);
const totalSteps = ref(4);
const currentStepTitle = ref('Safety Pre-Check & Automated DB Snapshot');
const currentProgress = ref(0);
const isUpdateDone = ref(false);
const isUpdateSuccess = ref(false);
const updateStatusMessage = ref('');
const isReconnecting = ref(false);
const terminalContainer = ref<HTMLDivElement | null>(null);

let unsubscribeStream: (() => void) | null = null;

// Outdated Nodes Computation
const outdatedNodes = computed(() => {
  if (!updateInfo.value) return [];
  const targetVer = updateInfo.value.latestVersion.replace(/^v/, '');
  return nodes.value.filter((n) => {
    const nodeVer = (n.daemonVersion || 'v0.1.0').replace(/^v/, '');
    return nodeVer !== targetVer;
  });
});

async function loadSystemUpdates() {
  isLoadingUpdates.value = true;
  try {
    updateInfo.value = await ApiService.getSystemUpdates();
  } catch (err) {
    console.error('Failed to load system update info:', err);
  } finally {
    isLoadingUpdates.value = false;
  }
}

async function loadNodes() {
  try {
    nodes.value = await ApiService.get<any[]>('/admin/nodes');
  } catch (err) {
    console.error('Failed to load nodes fleet:', err);
  }
}

async function loadSnapshots() {
  isLoadingSnapshots.value = true;
  try {
    snapshots.value = await ApiService.getDatabaseSnapshots();
  } catch (err) {
    console.error('Failed to load database snapshots:', err);
  } finally {
    isLoadingSnapshots.value = false;
  }
}

// 1-Click Update Panel
async function startPanelUpdate() {
  if (!updateInfo.value) return;

  showUpdateModal.value = true;
  streamLogs.value = [];
  currentStepNumber.value = 1;
  currentProgress.value = 5;
  isUpdateDone.value = false;
  isUpdateSuccess.value = false;
  isReconnecting.value = false;
  updateStatusMessage.value = '';

  try {
    await ApiService.updatePanel(updateInfo.value.latestVersion);
  } catch (err) {
    console.error('Update request error:', err);
  }

  // Subscribe to live event stream
  unsubscribeStream = ApiService.subscribeUpdateStream((event) => {
    if (event.type === 'step') {
      currentStepNumber.value = event.step || 1;
      totalSteps.value = event.totalSteps || 4;
      currentStepTitle.value = event.title || '';
      currentProgress.value = event.progress || 0;
    } else if (event.type === 'log') {
      if (event.line) {
        streamLogs.value.push(event.line);
        nextTick(() => {
          if (terminalContainer.value) {
            terminalContainer.value.scrollTop = terminalContainer.value.scrollHeight;
          }
        });
      }
    } else if (event.type === 'done') {
      isUpdateDone.value = true;
      isUpdateSuccess.value = !!event.success;
      updateStatusMessage.value = event.message || '';
      if (event.success) {
        currentProgress.value = 100;
        isReconnecting.value = true;
        setTimeout(() => {
          isReconnecting.value = false;
          loadSystemUpdates();
          loadSnapshots();
        }, 3000);
      }
    }
  });
}

function closeUpdateModal() {
  if (unsubscribeStream) {
    unsubscribeStream();
    unsubscribeStream = null;
  }
  showUpdateModal.value = false;
}

// Node Updates
async function updateNode(node: any) {
  if (updatingNodeIds.value.has(node.id)) return;
  updatingNodeIds.value.add(node.id);

  try {
    await ApiService.updateNode(node.id, {
      targetVersion: updateInfo.value?.latestVersion || 'v0.2.0',
    });
    node.daemonVersion = updateInfo.value?.latestVersion || 'v0.2.0';
  } catch (err) {
    console.error(`Failed to update node ${node.id}:`, err);
  } finally {
    updatingNodeIds.value.delete(node.id);
  }
}

async function updateAllOutdatedNodes() {
  if (isUpdatingFleet.value) return;
  isUpdatingFleet.value = true;

  const toUpdate = [...outdatedNodes.value];
  for (const node of toUpdate) {
    await updateNode(node);
  }

  isUpdatingFleet.value = false;
}

// Snapshots Management
async function triggerCreateSnapshot() {
  if (isCreatingSnapshot.value) return;
  isCreatingSnapshot.value = true;
  try {
    const created = await ApiService.createDatabaseSnapshot();
    snapshots.value.unshift(created);
  } catch (err) {
    console.error('Failed to create manual snapshot:', err);
  } finally {
    isCreatingSnapshot.value = false;
  }
}

async function restoreSnapshot(snap: DemoDatabaseSnapshot) {
  const confirmMsg = t('admin.system.restoreConfirm', { id: snap.filename });
  if (!window.confirm(confirmMsg)) return;

  restoringSnapshotId.value = snap.id;
  try {
    await ApiService.restoreDatabaseSnapshot(snap.id);
    alert(`Snapshot ${snap.filename} restored successfully.`);
  } catch (err) {
    console.error(`Failed to restore snapshot ${snap.id}:`, err);
    alert(`Restore failed: ${err}`);
  } finally {
    restoringSnapshotId.value = null;
  }
}

async function deleteSnapshot(snap: DemoDatabaseSnapshot) {
  const confirmMsg = t('admin.system.deleteConfirm', { id: snap.filename });
  if (!window.confirm(confirmMsg)) return;

  try {
    await ApiService.deleteDatabaseSnapshot(snap.id);
    snapshots.value = snapshots.value.filter((s) => s.id !== snap.id);
  } catch (err) {
    console.error(`Failed to delete snapshot ${snap.id}:`, err);
  }
}

function downloadSnapshot(snap: DemoDatabaseSnapshot) {
  window.open(ApiService.downloadDatabaseSnapshotUrl(snap.id), '_blank');
}

onMounted(() => {
  loadSystemUpdates();
  loadNodes();
  loadSnapshots();
});

onUnmounted(() => {
  if (unsubscribeStream) {
    unsubscribeStream();
  }
});
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto pb-12">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <RefreshCw class="w-5 h-5" />
          </div>
          <div>
            <h1 class="text-xl font-bold tracking-tight text-white">{{ t('admin.system.title') }}</h1>
            <p class="text-xs text-slate-400 mt-0.5">{{ t('admin.system.subtitle') }}</p>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex items-center bg-[#111622] p-1 rounded-xl border border-slate-800">
        <button
          @click="activeTab = 'updates'"
          class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all"
          :class="activeTab === 'updates' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'"
        >
          <Sparkles class="w-3.5 h-3.5" />
          {{ t('admin.system.tabUpdates') }}
          <span
            v-if="updateInfo?.hasUpdate || outdatedNodes.length > 0"
            class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"
          />
        </button>

        <button
          @click="activeTab = 'snapshots'"
          class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all"
          :class="activeTab === 'snapshots' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'"
        >
          <Database class="w-3.5 h-3.5" />
          {{ t('admin.system.tabSnapshots') }}
          <span class="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded-full text-slate-300">
            {{ snapshots.length }}
          </span>
        </button>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- TAB 1: SYSTEM & FLEET UPDATES                                            -->
    <!-- ========================================================================= -->
    <div v-if="activeTab === 'updates'" class="space-y-6">
      <!-- 1. Panel Update Cockpit Card -->
      <div class="bg-[#111622] border border-slate-800 rounded-xl p-5 shadow-sm">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <span class="text-xl">🐙</span>
              <h2 class="text-base font-bold text-white">{{ t('admin.system.panelCardTitle') }}</h2>
              <span
                v-if="updateInfo?.hasUpdate"
                class="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1"
              >
                <ArrowUpCircle class="w-3 h-3" />
                {{ t('admin.system.updateAvailable') }}
              </span>
              <span
                v-else
                class="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1"
              >
                <CheckCircle2 class="w-3 h-3" />
                {{ t('admin.system.upToDate') }}
              </span>
            </div>

            <div class="flex flex-wrap items-center gap-6 text-xs">
              <div>
                <span class="text-slate-400">{{ t('admin.system.currentVersion') }}:</span>
                <span class="ml-1.5 font-mono font-semibold text-slate-200">
                  v{{ updateInfo?.currentVersion || '0.1.0' }}
                </span>
              </div>
              <div>
                <span class="text-slate-400">{{ t('admin.system.latestVersion') }}:</span>
                <span class="ml-1.5 font-mono font-semibold text-cyan-400">
                  v{{ updateInfo?.latestVersion || '0.2.0' }}
                </span>
              </div>
            </div>

            <div v-if="updateInfo?.releaseNotes" class="mt-2 bg-[#0b0f17] border border-slate-800/80 rounded-lg p-3 max-w-3xl">
              <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Info class="w-3.5 h-3.5 text-cyan-400" />
                {{ updateInfo.releaseName }}
              </div>
              <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-line font-mono text-[11px]">
                {{ updateInfo.releaseNotes }}
              </p>
            </div>
          </div>

          <!-- Action Button -->
          <div class="shrink-0 flex flex-col items-start lg:items-end gap-2">
            <button
              v-if="updateInfo?.hasUpdate"
              @click="startPanelUpdate"
              class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20 transition-all active:scale-[0.98]"
            >
              <ArrowUpCircle class="w-4 h-4" />
              {{ t('admin.system.updatePanelNow') }}
            </button>
            <div v-else class="text-xs text-slate-400 flex items-center gap-1.5">
              <ShieldCheck class="w-4 h-4 text-emerald-400" />
              <span>OctopusPanel is running the latest stable release.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Node Fleet Update Matrix -->
      <div class="bg-[#111622] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div class="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <Cpu class="w-4 h-4 text-cyan-400" />
              {{ t('admin.system.fleetTitle') }}
            </h3>
            <p class="text-[11px] text-slate-400 mt-0.5">{{ t('admin.system.fleetSubtitle') }}</p>
          </div>

          <button
            v-if="outdatedNodes.length > 0"
            @click="updateAllOutdatedNodes"
            :disabled="isUpdatingFleet"
            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-all disabled:opacity-50"
          >
            <Loader2 v-if="isUpdatingFleet" class="w-3.5 h-3.5 animate-spin" />
            <ArrowUpCircle v-else class="w-3.5 h-3.5" />
            {{ t('admin.system.updateAllOutdated') }} ({{ outdatedNodes.length }})
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-[#0e131d]">
                <th class="py-2.5 px-4">{{ t('admin.system.nodeName') }}</th>
                <th class="py-2.5 px-4">FQDN / Port</th>
                <th class="py-2.5 px-4">{{ t('admin.system.daemonVersion') }}</th>
                <th class="py-2.5 px-4">{{ t('admin.system.daemonStatus') }}</th>
                <th class="py-2.5 px-4 text-right">{{ t('admin.system.actions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 text-xs">
              <tr
                v-for="node in nodes"
                :key="node.id"
                class="hover:bg-slate-800/30 transition-colors"
              >
                <!-- Node Name & Region -->
                <td class="py-3 px-4">
                  <div class="flex items-center gap-2">
                    <span class="text-base">{{ node.countryFlag || '🌐' }}</span>
                    <div>
                      <div class="font-semibold text-white">{{ node.name }}</div>
                      <div class="text-[10px] text-slate-400">{{ node.location || 'Data Center' }}</div>
                    </div>
                  </div>
                </td>

                <!-- FQDN -->
                <td class="py-3 px-4 font-mono text-[11px] text-slate-300">
                  {{ node.fqdn }}:{{ node.apiPort }}
                </td>

                <!-- Daemon Version -->
                <td class="py-3 px-4">
                  <div class="flex items-center gap-2 font-mono">
                    <span class="text-slate-200">{{ node.daemonVersion || 'v0.1.0' }}</span>
                    <span
                      v-if="(node.daemonVersion || 'v0.1.0').replace(/^v/, '') !== (updateInfo?.latestVersion || '0.2.0').replace(/^v/, '')"
                      class="px-1.5 py-0.5 text-[9px] rounded font-sans font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25"
                    >
                      Update to v{{ updateInfo?.latestVersion || '0.2.0' }}
                    </span>
                    <span
                      v-else
                      class="px-1.5 py-0.5 text-[9px] rounded font-sans font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                    >
                      Latest
                    </span>
                  </div>
                </td>

                <!-- Daemon Status -->
                <td class="py-3 px-4">
                  <span class="inline-flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                </td>

                <!-- Action Button -->
                <td class="py-3 px-4 text-right">
                  <button
                    v-if="(node.daemonVersion || 'v0.1.0').replace(/^v/, '') !== (updateInfo?.latestVersion || '0.2.0').replace(/^v/, '')"
                    @click="updateNode(node)"
                    :disabled="updatingNodeIds.has(node.id)"
                    class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 transition-all disabled:opacity-50"
                  >
                    <Loader2 v-if="updatingNodeIds.has(node.id)" class="w-3 h-3 animate-spin" />
                    <ArrowUpCircle v-else class="w-3 h-3" />
                    <span>{{ updatingNodeIds.has(node.id) ? t('admin.system.updating') : t('admin.system.updateNode') }}</span>
                  </button>
                  <span v-else class="text-[11px] text-slate-500 font-medium">
                    Up to date
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- TAB 2: DATABASE SNAPSHOTS                                                -->
    <!-- ========================================================================= -->
    <div v-else class="space-y-6">
      <div class="bg-[#111622] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div class="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <Database class="w-4 h-4 text-cyan-400" />
              {{ t('admin.system.snapshotsTitle') }}
            </h3>
            <p class="text-[11px] text-slate-400 mt-0.5">{{ t('admin.system.snapshotsSubtitle') }}</p>
          </div>

          <button
            @click="triggerCreateSnapshot"
            :disabled="isCreatingSnapshot"
            class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all disabled:opacity-50"
          >
            <Loader2 v-if="isCreatingSnapshot" class="w-3.5 h-3.5 animate-spin" />
            <Database v-else class="w-3.5 h-3.5" />
            {{ isCreatingSnapshot ? t('admin.system.creatingSnapshot') : t('admin.system.createSnapshot') }}
          </button>
        </div>

        <div v-if="snapshots.length === 0" class="py-12 text-center text-slate-500 text-xs">
          No database snapshots found. Click above to create a manual backup.
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-[#0e131d]">
                <th class="py-2.5 px-4">{{ t('admin.system.filename') }}</th>
                <th class="py-2.5 px-4">{{ t('admin.system.type') }}</th>
                <th class="py-2.5 px-4">{{ t('admin.system.size') }}</th>
                <th class="py-2.5 px-4">{{ t('admin.system.created') }}</th>
                <th class="py-2.5 px-4 text-right">{{ t('admin.system.actions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 text-xs">
              <tr
                v-for="snap in snapshots"
                :key="snap.id"
                class="hover:bg-slate-800/30 transition-colors"
              >
                <!-- Filename -->
                <td class="py-3 px-4 font-mono text-[11px] text-slate-200">
                  {{ snap.filename }}
                </td>

                <!-- Type Badge -->
                <td class="py-3 px-4">
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-medium"
                    :class="{
                      'bg-purple-500/15 text-purple-300 border border-purple-500/25': snap.type === 'pre-migration',
                      'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25': snap.type === 'manual',
                      'bg-slate-500/15 text-slate-300 border border-slate-500/25': snap.type === 'scheduled',
                    }"
                  >
                    {{ snap.type }}
                  </span>
                </td>

                <!-- Size -->
                <td class="py-3 px-4 font-mono text-slate-300">
                  {{ snap.sizeFormatted }}
                </td>

                <!-- Created At -->
                <td class="py-3 px-4 text-slate-400 text-[11px]">
                  {{ new Date(snap.createdAt).toLocaleString() }}
                </td>

                <!-- Actions -->
                <td class="py-3 px-4 text-right">
                  <div class="inline-flex items-center gap-1.5">
                    <button
                      @click="downloadSnapshot(snap)"
                      title="Download SQL Dump (.sql.gz)"
                      class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <Download class="w-3.5 h-3.5" />
                    </button>

                    <button
                      @click="restoreSnapshot(snap)"
                      :disabled="restoringSnapshotId === snap.id"
                      title="Restore Database Snapshot"
                      class="p-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                    >
                      <Loader2 v-if="restoringSnapshotId === snap.id" class="w-3.5 h-3.5 animate-spin" />
                      <RotateCcw v-else class="w-3.5 h-3.5" />
                    </button>

                    <button
                      @click="deleteSnapshot(snap)"
                      title="Delete Snapshot"
                      class="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- LIVE STREAMING UPDATE MODAL                                              -->
    <!-- ========================================================================= -->
    <div
      v-if="showUpdateModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div class="bg-[#111622] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        <!-- Modal Header -->
        <div class="p-4 border-b border-slate-800 flex items-center justify-between bg-[#0e131d]">
          <div class="flex items-center gap-2.5">
            <span class="text-xl">🐙</span>
            <div>
              <h3 class="text-sm font-bold text-white">{{ t('admin.system.updateModalTitle') }}</h3>
              <p class="text-[11px] text-slate-400 font-mono">
                v{{ updateInfo?.currentVersion }} ➔ v{{ updateInfo?.latestVersion }}
              </p>
            </div>
          </div>

          <button
            v-if="isUpdateDone"
            @click="closeUpdateModal"
            class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Progress Section -->
        <div class="p-4 border-b border-slate-800 bg-[#0e131d]/50 space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-300 font-medium">
              {{ t('admin.system.currentStep') }}: [{{ currentStepNumber }}/{{ totalSteps }}] {{ currentStepTitle }}
            </span>
            <span class="font-mono font-bold text-cyan-400">{{ currentProgress }}%</span>
          </div>

          <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              class="h-full bg-cyan-500 transition-all duration-300 ease-out"
              :style="{ width: `${currentProgress}%` }"
            />
          </div>

          <div v-if="isReconnecting" class="pt-1 flex items-center gap-2 text-xs text-amber-400">
            <Loader2 class="w-3.5 h-3.5 animate-spin" />
            <span>{{ t('admin.system.reconnecting') }}</span>
          </div>

          <div v-if="isUpdateDone && isUpdateSuccess" class="pt-1 flex items-center gap-2 text-xs text-emerald-400 font-semibold">
            <CheckCircle2 class="w-4 h-4" />
            <span>{{ t('admin.system.updateSuccess') }}</span>
          </div>
        </div>

        <!-- Real-time Terminal Log Window -->
        <div class="p-4 flex-1 flex flex-col min-h-0 space-y-2">
          <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Terminal class="w-3.5 h-3.5 text-cyan-400" />
            {{ t('admin.system.terminalLog') }}
          </div>

          <div
            ref="terminalContainer"
            class="flex-1 bg-[#070a0f] border border-slate-800/80 rounded-lg p-3 font-mono text-[11px] text-slate-300 overflow-y-auto space-y-1 h-64"
          >
            <div v-for="(line, idx) in streamLogs" :key="idx" class="leading-relaxed">
              <span v-if="line.startsWith('===')" class="text-cyan-400 font-bold">{{ line }}</span>
              <span v-else-if="line.includes('ERROR') || line.includes('FAILED')" class="text-rose-400 font-semibold">{{ line }}</span>
              <span v-else-if="line.includes('successfully') || line.includes('✅')" class="text-emerald-400">{{ line }}</span>
              <span v-else class="text-slate-300">{{ line }}</span>
            </div>
            <div v-if="!isUpdateDone" class="flex items-center gap-2 text-cyan-400 pt-1">
              <Loader2 class="w-3 h-3 animate-spin" />
              <span class="animate-pulse">_</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-slate-800 bg-[#0e131d] flex items-center justify-between text-xs text-slate-400">
          <div class="flex items-center gap-1.5">
            <Info class="w-3.5 h-3.5 text-amber-400" />
            <span>{{ t('admin.system.doNotClose') }}</span>
          </div>

          <button
            v-if="isUpdateDone"
            @click="closeUpdateModal"
            class="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
