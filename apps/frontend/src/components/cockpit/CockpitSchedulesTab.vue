<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ApiService } from '../../services/api.js';
import { ServerSchedule, ScheduleTask } from '../../services/demo-data.js';
import { Clock, Plus, Trash2, Play, Pause, ChevronRight, Terminal, RotateCcw, Archive, X, Check } from 'lucide-vue-next';

const props = defineProps<{
  serverUuid: string;
}>();

const schedules = ref<ServerSchedule[]>([]);
const isLoading = ref(false);

// Create Modal
const showCreateModal = ref(false);
const scheduleName = ref('');
const scheduleCron = ref('0 4 * * *');
const scheduleTasks = ref<ScheduleTask[]>([
  { id: '1', action: 'command', payload: 'broadcast Server restarting in 60s for daily maintenance!', delaySeconds: 0 },
  { id: '2', action: 'command', payload: 'save-all', delaySeconds: 30 },
  { id: '3', action: 'power', payload: 'restart', delaySeconds: 30 },
]);

// Presets
function applyPreset(type: 'restart' | 'backup' | 'broadcast') {
  if (type === 'restart') {
    scheduleName.value = 'Daily 04:00 AM Graceful Restart';
    scheduleCron.value = '0 4 * * *';
    scheduleTasks.value = [
      { id: '1', action: 'command', payload: 'broadcast Server restarting in 60s!', delaySeconds: 0 },
      { id: '2', action: 'command', payload: 'save-all', delaySeconds: 30 },
      { id: '3', action: 'power', payload: 'restart', delaySeconds: 30 },
    ];
  } else if (type === 'backup') {
    scheduleName.value = 'Hourly World Snapshot';
    scheduleCron.value = '0 * * * *';
    scheduleTasks.value = [
      { id: '1', action: 'command', payload: 'save-all', delaySeconds: 0 },
      { id: '2', action: 'backup', payload: 'Hourly Automated Snapshot', delaySeconds: 5 },
    ];
  } else if (type === 'broadcast') {
    scheduleName.value = 'Every 30m Community Message';
    scheduleCron.value = '*/30 * * * *';
    scheduleTasks.value = [
      { id: '1', action: 'command', payload: 'say Join our Discord community at discord.gg/octopus!', delaySeconds: 0 },
    ];
  }
}

function addTask() {
  scheduleTasks.value.push({
    id: String(Date.now()),
    action: 'command',
    payload: '',
    delaySeconds: 10,
  });
}

function removeTask(idx: number) {
  scheduleTasks.value.splice(idx, 1);
}

async function loadSchedules() {
  isLoading.value = true;
  try {
    schedules.value = await ApiService.get<ServerSchedule[]>(`/client/servers/${props.serverUuid}/schedules`);
  } catch (err) {
    console.error('Failed to load schedules:', err);
  } finally {
    isLoading.value = false;
  }
}

async function createSchedule() {
  if (!scheduleName.value.trim() || !scheduleCron.value.trim()) return;
  try {
    await ApiService.post(`/client/servers/${props.serverUuid}/schedules`, {
      name: scheduleName.value,
      cron: scheduleCron.value,
      tasks: scheduleTasks.value,
      isActive: true,
    });
    showCreateModal.value = false;
    scheduleName.value = '';
    loadSchedules();
  } catch (err) {
    console.error('Failed to create schedule:', err);
  }
}

async function toggleActive(sched: ServerSchedule) {
  try {
    await ApiService.put(`/client/servers/${props.serverUuid}/schedules/${sched.id}`, {
      isActive: !sched.isActive,
    });
    sched.isActive = !sched.isActive;
  } catch (err) {
    console.error('Failed to toggle schedule:', err);
  }
}

async function deleteSchedule(schedId: string) {
  if (!confirm('Are you sure you want to delete this automated schedule?')) return;
  try {
    await ApiService.delete(`/client/servers/${props.serverUuid}/schedules/${schedId}`);
    loadSchedules();
  } catch (err) {
    console.error('Failed to delete schedule:', err);
  }
}

onMounted(() => {
  loadSchedules();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-sm font-bold text-white flex items-center">
          <Clock class="w-4 h-4 text-blue-400 mr-2" />
          Schedules & Automated Cron Tasks
        </h3>
        <p class="text-xs text-slate-400 mt-0.5">
          Configure recurring cron jobs, automated restarts, world save sequences, and scheduled maintenance tasks.
        </p>
      </div>

      <button
        @click="showCreateModal = true"
        class="flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg shadow-blue-500/10"
      >
        <Plus class="w-3.5 h-3.5 mr-1.5" />
        New Schedule
      </button>
    </div>

    <!-- Schedules Table -->
    <div class="bg-[#111622] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div v-if="isLoading" class="p-8 text-center text-xs font-mono text-slate-500">
        Loading cron task sequences...
      </div>

      <div v-else-if="schedules.length === 0" class="p-12 text-center text-xs text-slate-500">
        No active automated schedules configured.
      </div>

      <table v-else class="w-full text-left text-xs">
        <thead class="bg-[#0b0f17] text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
          <tr>
            <th class="py-3 px-4">Schedule Name</th>
            <th class="py-3 px-4">Cron Expression</th>
            <th class="py-3 px-4">Action Pipeline</th>
            <th class="py-3 px-4">Next Execution</th>
            <th class="py-3 px-4">State</th>
            <th class="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60 font-mono">
          <tr v-for="sched in schedules" :key="sched.id" class="hover:bg-slate-800/30 transition-colors">
            <!-- Name -->
            <td class="py-3 px-4 text-slate-200 font-sans font-semibold">
              <div class="flex items-center space-x-2">
                <Clock class="w-4 h-4 text-blue-400 shrink-0" />
                <span>{{ sched.name }}</span>
              </div>
            </td>

            <!-- Cron -->
            <td class="py-3 px-4 text-amber-300">
              <span class="bg-[#0b0f17] px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                {{ sched.cron }}
              </span>
            </td>

            <!-- Steps -->
            <td class="py-3 px-4 text-slate-400 font-sans text-xs">
              <div class="flex items-center space-x-1.5 flex-wrap gap-1">
                <span
                  v-for="(task, i) in sched.tasks"
                  :key="task.id"
                  class="bg-[#0b0f17] text-slate-300 px-2 py-0.5 rounded border border-slate-800 text-[10px] font-mono flex items-center"
                >
                  <span class="text-blue-400 mr-1 font-bold">{{ i + 1 }}.</span>
                  {{ task.action }} ({{ task.delaySeconds }}s)
                </span>
              </div>
            </td>

            <!-- Next Run -->
            <td class="py-3 px-4 text-slate-400 text-[11px]">
              {{ new Date(sched.nextRunAt).toLocaleDateString() }} at {{ new Date(sched.nextRunAt).toLocaleTimeString() }}
            </td>

            <!-- Active Toggle -->
            <td class="py-3 px-4 font-sans">
              <button
                @click="toggleActive(sched)"
                class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
                :class="sched.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'"
              >
                <Play v-if="sched.isActive" class="w-3 h-3 mr-1 fill-emerald-400" />
                <Pause v-else class="w-3 h-3 mr-1" />
                {{ sched.isActive ? 'Active' : 'Paused' }}
              </button>
            </td>

            <!-- Actions -->
            <td class="py-3 px-4 text-right space-x-1.5 font-sans">
              <button
                @click="deleteSchedule(sched.id)"
                class="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                title="Delete Schedule"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create Schedule Modal with Sequence Builder -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div class="bg-[#161b22] border border-slate-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 class="text-sm font-semibold text-white">Create Automated Schedule</h3>
          <button @click="showCreateModal = false" class="text-slate-400 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Presets -->
        <div>
          <label class="block text-slate-400 text-xs mb-1 font-medium">Quick Presets:</label>
          <div class="flex items-center space-x-2">
            <button
              type="button"
              @click="applyPreset('restart')"
              class="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700/60"
            >
              🔄 Daily Restart (04:00 AM)
            </button>
            <button
              type="button"
              @click="applyPreset('backup')"
              class="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700/60"
            >
              💾 Hourly Snapshot
            </button>
            <button
              type="button"
              @click="applyPreset('broadcast')"
              class="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700/60"
            >
              📢 Every 30m Announcement
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1 font-medium">Schedule Name</label>
            <input
              v-model="scheduleName"
              type="text"
              placeholder="e.g. Daily Restart & World Clean"
              class="w-full bg-[#0b0f17] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-slate-400 mb-1 font-medium">Cron Expression (Minute Hour Dom Mon Dow)</label>
            <input
              v-model="scheduleCron"
              type="text"
              placeholder="0 4 * * *"
              class="w-full bg-[#0b0f17] border border-slate-700 rounded-lg p-2 text-slate-200 font-mono outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <!-- Action Sequence Builder -->
        <div class="space-y-3 pt-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Action Pipeline Sequence
            </label>
            <button
              type="button"
              @click="addTask"
              class="text-xs text-blue-400 hover:text-blue-300 flex items-center font-medium"
            >
              <Plus class="w-3.5 h-3.5 mr-1" />
              Add Pipeline Step
            </button>
          </div>

          <div
            v-for="(task, index) in scheduleTasks"
            :key="task.id"
            class="bg-[#0b0f17] border border-slate-800 rounded-lg p-3 space-y-2"
          >
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-slate-300 font-mono">Step {{ index + 1 }}</span>
              <button
                type="button"
                @click="removeTask(index)"
                class="text-slate-500 hover:text-rose-400"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <div>
                <label class="block text-[10px] text-slate-500 mb-0.5">Action Type</label>
                <select
                  v-model="task.action"
                  class="w-full bg-[#111622] border border-slate-700 rounded p-1.5 text-slate-200 font-mono text-xs"
                >
                  <option value="command">Send Console Command</option>
                  <option value="power">Power Action</option>
                  <option value="backup">Trigger Backup</option>
                </select>
              </div>

              <div>
                <label class="block text-[10px] text-slate-500 mb-0.5">Payload / Argument</label>
                <input
                  v-model="task.payload"
                  type="text"
                  placeholder="e.g. say Warning or restart"
                  class="w-full bg-[#111622] border border-slate-700 rounded p-1.5 text-slate-200 font-mono text-xs"
                />
              </div>

              <div>
                <label class="block text-[10px] text-slate-500 mb-0.5">Delay (seconds)</label>
                <input
                  v-model.number="task.delaySeconds"
                  type="number"
                  class="w-full bg-[#111622] border border-slate-700 rounded p-1.5 text-slate-200 font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end space-x-2 pt-3 border-t border-slate-800">
          <button @click="showCreateModal = false" class="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg">
            Cancel
          </button>
          <button
            @click="createSchedule"
            class="px-3.5 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg"
          >
            Save Schedule
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
