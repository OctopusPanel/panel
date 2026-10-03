<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ApiService } from '../../services/api.js';
import { ServerDatabase } from '../../services/demo-data.js';
import { Database, Plus, Copy, Check, Eye, EyeOff, RotateCcw, Trash2, Code2, X } from 'lucide-vue-next';

const props = defineProps<{
  serverUuid: string;
}>();

const databases = ref<ServerDatabase[]>([]);
const isLoading = ref(false);
const visiblePasswords = ref<Record<string, boolean>>({});
const copiedField = ref<string | null>(null);

// Create modal
const showCreateModal = ref(false);
const dbName = ref('');
const dbType = ref<'mysql' | 'postgres'>('mysql');
const isCreating = ref(false);

// JDBC modal
const showJdbcModal = ref(false);
const selectedDb = ref<ServerDatabase | null>(null);

async function loadDatabases() {
  isLoading.value = true;
  try {
    databases.value = await ApiService.get<ServerDatabase[]>(`/client/servers/${props.serverUuid}/databases`);
  } catch (err) {
    console.error('Failed to load databases:', err);
  } finally {
    isLoading.value = false;
  }
}

async function createDatabase() {
  isCreating.value = true;
  try {
    await ApiService.post(`/client/servers/${props.serverUuid}/databases`, {
      name: dbName.value.trim() || undefined,
      databaseType: dbType.value,
    });
    showCreateModal.value = false;
    dbName.value = '';
    loadDatabases();
  } catch (err) {
    console.error('Failed to create database:', err);
  } finally {
    isCreating.value = false;
  }
}

async function resetPassword(db: ServerDatabase) {
  if (!confirm(`Are you sure you want to regenerate the password for database "${db.name}"?`)) return;
  try {
    const res = await ApiService.post<{ success: boolean; database: ServerDatabase }>(
      `/client/servers/${props.serverUuid}/databases/${db.id}/reset-password`,
    );
    if (res.database) {
      db.password = res.database.password;
      visiblePasswords.value[db.id] = true;
    }
  } catch (err) {
    console.error('Failed to reset password:', err);
  }
}

async function deleteDatabase(dbId: string) {
  if (!confirm('Are you sure you want to delete this database? All tables and data will be dropped permanently.')) return;
  try {
    await ApiService.delete(`/client/servers/${props.serverUuid}/databases/${dbId}`);
    loadDatabases();
  } catch (err) {
    console.error('Failed to delete database:', err);
  }
}

function togglePassword(id: string) {
  visiblePasswords.value[id] = !visiblePasswords.value[id];
}

function copyText(val: string, key: string) {
  navigator.clipboard.writeText(val);
  copiedField.value = key;
  setTimeout(() => {
    if (copiedField.value === key) copiedField.value = null;
  }, 2000);
}

function openJdbc(db: ServerDatabase) {
  selectedDb.value = db;
  showJdbcModal.value = true;
}

function getJdbcUrl(db: ServerDatabase): string {
  if (db.databaseType === 'mysql') {
    return `jdbc:mysql://${db.host}:${db.port}/${db.name}?user=${db.username}&password=${db.password}&useSSL=false`;
  }
  return `jdbc:postgresql://${db.host}:${db.port}/${db.name}?user=${db.username}&password=${db.password}&ssl=false`;
}

onMounted(() => {
  loadDatabases();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-sm font-bold text-white flex items-center">
          <Database class="w-4 h-4 text-blue-400 mr-2" />
          Databases (Self-Service)
        </h3>
        <p class="text-xs text-slate-400 mt-0.5">
          Provision isolated MySQL and PostgreSQL database instances for plugins, store statistics, and inventory sync.
        </p>
      </div>

      <button
        @click="showCreateModal = true"
        class="flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg shadow-blue-500/10"
      >
        <Plus class="w-3.5 h-3.5 mr-1.5" />
        New Database
      </button>
    </div>

    <!-- Databases Cards -->
    <div v-if="isLoading" class="p-8 text-center text-xs font-mono text-slate-500">
      Loading database instances...
    </div>

    <div v-else-if="databases.length === 0" class="bg-[#111622] border border-slate-800 rounded-xl p-12 text-center">
      <Database class="w-8 h-8 text-slate-600 mx-auto mb-2" />
      <h4 class="text-xs font-semibold text-slate-300">No Databases Assigned</h4>
      <p class="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto mb-4">
        Need a database for CoreProtect, LuckPerms, or your custom plugin? Create one in 1 click.
      </p>
      <button
        @click="showCreateModal = true"
        class="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white"
      >
        <Plus class="w-3.5 h-3.5 mr-1.5" />
        Create Database
      </button>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="db in databases"
        :key="db.id"
        class="bg-[#111622] border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between"
      >
        <div>
          <!-- Top Row: Name & Engine badge -->
          <div class="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
            <div class="flex items-center space-x-2">
              <Database class="w-4 h-4 text-blue-400" />
              <h4 class="text-sm font-bold text-white font-mono">{{ db.name }}</h4>
            </div>
            <span
              class="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider border"
              :class="db.databaseType === 'mysql' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'"
            >
              {{ db.databaseType }}
            </span>
          </div>

          <!-- Credentials Grid -->
          <div class="space-y-2 text-xs font-mono">
            <!-- Host / Endpoint -->
            <div class="bg-[#0b0f17] p-2 rounded-lg border border-slate-800/80 flex items-center justify-between">
              <div>
                <span class="text-[10px] text-slate-500 uppercase font-sans block">Endpoint</span>
                <span class="text-slate-200 select-all">{{ db.host }}:{{ db.port }}</span>
              </div>
              <button
                @click="copyText(`${db.host}:${db.port}`, `host_${db.id}`)"
                class="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
              >
                <Check v-if="copiedField === `host_${db.id}`" class="w-3.5 h-3.5 text-emerald-400" />
                <Copy v-else class="w-3.5 h-3.5" />
              </button>
            </div>

            <!-- Username -->
            <div class="bg-[#0b0f17] p-2 rounded-lg border border-slate-800/80 flex items-center justify-between">
              <div>
                <span class="text-[10px] text-slate-500 uppercase font-sans block">User</span>
                <span class="text-slate-200 select-all">{{ db.username }}</span>
              </div>
              <button
                @click="copyText(db.username, `user_${db.id}`)"
                class="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
              >
                <Check v-if="copiedField === `user_${db.id}`" class="w-3.5 h-3.5 text-emerald-400" />
                <Copy v-else class="w-3.5 h-3.5" />
              </button>
            </div>

            <!-- Password -->
            <div class="bg-[#0b0f17] p-2 rounded-lg border border-slate-800/80 flex items-center justify-between">
              <div>
                <span class="text-[10px] text-slate-500 uppercase font-sans block">Password</span>
                <span class="text-slate-200 select-all font-mono">
                  {{ visiblePasswords[db.id] ? db.password : '••••••••••••••••' }}
                </span>
              </div>
              <div class="flex items-center space-x-1">
                <button
                  @click="togglePassword(db.id)"
                  class="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                >
                  <EyeOff v-if="visiblePasswords[db.id]" class="w-3.5 h-3.5" />
                  <Eye v-else class="w-3.5 h-3.5" />
                </button>
                <button
                  @click="copyText(db.password, `pass_${db.id}`)"
                  class="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                >
                  <Check v-if="copiedField === `pass_${db.id}`" class="w-3.5 h-3.5 text-emerald-400" />
                  <Copy v-else class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="pt-4 mt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
          <button
            @click="openJdbc(db)"
            class="flex items-center text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            <Code2 class="w-3.5 h-3.5 mr-1" />
            JDBC / Connection String
          </button>

          <div class="flex items-center space-x-2">
            <button
              @click="resetPassword(db)"
              class="p-1.5 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800 transition-colors"
              title="Reset Password"
            >
              <RotateCcw class="w-3.5 h-3.5" />
            </button>
            <button
              @click="deleteDatabase(db.id)"
              class="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
              title="Drop Database"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Database Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div class="bg-[#161b22] border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 class="text-sm font-semibold text-white">Create New Database</h3>
          <button @click="showCreateModal = false" class="text-slate-400 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1 font-medium">Database Name (optional)</label>
            <input
              v-model="dbName"
              type="text"
              placeholder="e.g. luckperms, dynmap_db"
              class="w-full bg-[#0b0f17] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none font-mono focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="block text-slate-400 mb-1 font-medium">Database Engine</label>
            <div class="grid grid-cols-2 gap-3">
              <button
                type="button"
                @click="dbType = 'mysql'"
                class="p-3 rounded-lg border text-left transition-colors font-mono"
                :class="dbType === 'mysql' ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-slate-700 bg-[#0b0f17] text-slate-400 hover:border-slate-600'"
              >
                <span class="block font-bold">MySQL / MariaDB</span>
                <span class="text-[10px] text-slate-400 font-sans">Default for Spigot/Paper</span>
              </button>
              <button
                type="button"
                @click="dbType = 'postgres'"
                class="p-3 rounded-lg border text-left transition-colors font-mono"
                :class="dbType === 'postgres' ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-slate-700 bg-[#0b0f17] text-slate-400 hover:border-slate-600'"
              >
                <span class="block font-bold">PostgreSQL</span>
                <span class="text-[10px] text-slate-400 font-sans">High concurrency ACID</span>
              </button>
            </div>
          </div>
        </div>

        <div class="flex justify-end space-x-2 pt-2 border-t border-slate-800">
          <button @click="showCreateModal = false" class="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg">
            Cancel
          </button>
          <button
            @click="createDatabase"
            :disabled="isCreating"
            class="px-3.5 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg"
          >
            {{ isCreating ? 'Provisioning...' : 'Provision Database' }}
          </button>
        </div>
      </div>
    </div>

    <!-- JDBC Connection String Modal -->
    <div v-if="showJdbcModal && selectedDb" class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div class="bg-[#161b22] border border-slate-800 rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div class="flex items-center space-x-2">
            <Code2 class="w-4 h-4 text-blue-400" />
            <h3 class="text-sm font-semibold text-white">JDBC & Connection String Generator</h3>
          </div>
          <button @click="showJdbcModal = false" class="text-slate-400 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="text-xs text-slate-300">
          Copy and paste this direct JDBC string into your plugin's <code class="text-amber-400">config.yml</code>:
        </p>

        <div class="bg-[#0b0f17] border border-slate-800 rounded-lg p-3 relative font-mono text-xs text-blue-300 break-all select-all">
          {{ getJdbcUrl(selectedDb) }}
        </div>

        <div class="flex justify-end space-x-2 pt-2 border-t border-slate-800">
          <button
            @click="copyText(getJdbcUrl(selectedDb), 'jdbc')"
            class="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg flex items-center"
          >
            <Check v-if="copiedField === 'jdbc'" class="w-3.5 h-3.5 mr-1" />
            <Copy v-else class="w-3.5 h-3.5 mr-1" />
            Copy Connection String
          </button>
          <button @click="showJdbcModal = false" class="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
