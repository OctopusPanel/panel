<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ApiService } from '../../services/api.js';
import { ServerSubuser } from '../../services/demo-data.js';
import { Users, UserPlus, Trash2, Shield, Check, X, Terminal, Folder, Archive, Database, Globe } from 'lucide-vue-next';

const props = defineProps<{
  serverUuid: string;
}>();

const subusers = ref<ServerSubuser[]>([]);
const isLoading = ref(false);

// Invite Modal
const showInviteModal = ref(false);
const inviteEmail = ref('');
const selectedPermissions = ref<string[]>([
  'websocket.connect',
  'control.start',
  'control.stop',
  'control.restart',
  'file.read',
  'file.update',
]);

const permissionCategories = [
  {
    name: 'Control & TTY',
    icon: Terminal,
    permissions: [
      { key: 'websocket.connect', label: 'View Console Stream' },
      { key: 'control.start', label: 'Start Server' },
      { key: 'control.stop', label: 'Stop Server' },
      { key: 'control.restart', label: 'Restart Server' },
    ],
  },
  {
    name: 'Files & Storage',
    icon: Folder,
    permissions: [
      { key: 'file.read', label: 'Read & Download Files' },
      { key: 'file.create', label: 'Create New Files & Folders' },
      { key: 'file.update', label: 'Edit & Save File Contents' },
      { key: 'file.delete', label: 'Delete Files' },
      { key: 'file.archive', label: 'Compress & Extract Archives' },
    ],
  },
  {
    name: 'Backups & Snapshots',
    icon: Archive,
    permissions: [
      { key: 'backup.create', label: 'Create Snapshots' },
      { key: 'backup.restore', label: 'Restore Backups' },
      { key: 'backup.delete', label: 'Delete Backups' },
      { key: 'backup.download', label: 'Download Archives' },
    ],
  },
  {
    name: 'Allocations & Ports',
    icon: Globe,
    permissions: [
      { key: 'allocation.read', label: 'View Port Allocations' },
      { key: 'allocation.create', label: 'Request Additional Ports' },
      { key: 'allocation.update', label: 'Set Alias & Primary Port' },
    ],
  },
  {
    name: 'Databases',
    icon: Database,
    permissions: [
      { key: 'database.read', label: 'View Database Credentials' },
      { key: 'database.create', label: 'Create New Databases' },
      { key: 'database.delete', label: 'Drop Databases' },
    ],
  },
];

async function loadSubusers() {
  isLoading.value = true;
  try {
    subusers.value = await ApiService.get<ServerSubuser[]>(`/client/servers/${props.serverUuid}/subusers`);
  } catch (err) {
    console.error('Failed to load subusers:', err);
  } finally {
    isLoading.value = false;
  }
}

function togglePermission(key: string) {
  const idx = selectedPermissions.value.indexOf(key);
  if (idx > -1) {
    selectedPermissions.value.splice(idx, 1);
  } else {
    selectedPermissions.value.push(key);
  }
}

function toggleCategory(cat: typeof permissionCategories[0]) {
  const allSelected = cat.permissions.every((p) => selectedPermissions.value.includes(p.key));
  if (allSelected) {
    for (const p of cat.permissions) {
      const idx = selectedPermissions.value.indexOf(p.key);
      if (idx > -1) selectedPermissions.value.splice(idx, 1);
    }
  } else {
    for (const p of cat.permissions) {
      if (!selectedPermissions.value.includes(p.key)) selectedPermissions.value.push(p.key);
    }
  }
}

async function inviteSubuser() {
  if (!inviteEmail.value.trim()) return;
  try {
    await ApiService.post(`/client/servers/${props.serverUuid}/subusers`, {
      email: inviteEmail.value,
      permissions: selectedPermissions.value,
    });
    showInviteModal.value = false;
    inviteEmail.value = '';
    loadSubusers();
  } catch (err) {
    console.error('Failed to invite collaborator:', err);
  }
}

async function removeSubuser(id: number) {
  if (!confirm('Are you sure you want to revoke server access for this user?')) return;
  try {
    await ApiService.delete(`/client/servers/${props.serverUuid}/subusers/${id}`);
    loadSubusers();
  } catch (err) {
    console.error('Failed to delete subuser:', err);
  }
}

onMounted(() => {
  loadSubusers();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-sm font-bold text-white flex items-center">
          <Users class="w-4 h-4 text-primary mr-2" />
          Team &amp; Sub-User Access Control
        </h3>
        <p class="text-xs text-slate-400 mt-0.5">
          Delegate server administration with granular capability tags (Console, Files, Power, Backups, Databases).
        </p>
      </div>

      <button
        @click="showInviteModal = true"
        class="flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-dark text-slate-950 transition-all shadow-md active:scale-[0.98]"
      >
        <UserPlus class="w-3.5 h-3.5 mr-1.5" />
        Invite Collaborator
      </button>
    </div>

    <!-- Subusers Table -->
    <div class="bg-surface-card border border-surface-border rounded-xl overflow-hidden shadow-xl">
      <div v-if="isLoading" class="p-8 text-center text-xs font-mono text-slate-400">
        Loading collaborators roster...
      </div>

      <div v-else-if="subusers.length === 0" class="p-12 text-center text-xs text-slate-400">
        No external collaborators granted access yet.
      </div>

      <table v-else class="w-full text-left text-xs">
        <thead class="bg-surface-deep text-slate-400 uppercase tracking-wider text-[10px] border-b border-surface-border">
          <tr>
            <th class="py-3 px-4">User</th>
            <th class="py-3 px-4">Email</th>
            <th class="py-3 px-4">Granted Permissions</th>
            <th class="py-3 px-4">Access Date</th>
            <th class="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-border/50 font-mono">
          <tr v-for="user in subusers" :key="user.id" class="hover:bg-surface-elevated/40 transition-colors">
            <!-- User -->
            <td class="py-3 px-4 text-slate-200 font-sans font-semibold">
              <div class="flex items-center space-x-2.5">
                <img :src="user.avatarUrl" class="w-6 h-6 rounded-full border border-surface-border object-cover" />
                <span>{{ user.username }}</span>
              </div>
            </td>

            <!-- Email -->
            <td class="py-3 px-4 text-slate-400 font-sans">
              {{ user.email }}
            </td>

            <!-- Permissions Tags -->
            <td class="py-3 px-4 font-sans">
              <div class="flex items-center space-x-1 flex-wrap gap-1">
                <span
                  v-for="perm in user.permissions.slice(0, 4)"
                  :key="perm"
                  class="bg-primary/10 text-primary-light border border-primary/25 px-2 py-0.5 rounded text-[10px] font-mono"
                >
                  {{ perm }}
                </span>
                <span
                  v-if="user.permissions.length > 4"
                  class="bg-surface-deep border border-surface-border text-slate-400 px-1.5 py-0.5 rounded text-[10px]"
                >
                  +{{ user.permissions.length - 4 }} more
                </span>
              </div>
            </td>

            <!-- Date -->
            <td class="py-3 px-4 text-slate-400 text-[11px]">
              {{ new Date(user.createdAt).toLocaleDateString() }}
            </td>

            <!-- Actions -->
            <td class="py-3 px-4 text-right space-x-1.5 font-sans">
              <button
                @click="removeSubuser(user.id)"
                class="p-1.5 text-slate-400 hover:text-status-offline rounded hover:bg-surface-elevated transition-colors"
                title="Revoke Access"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Invite Modal with Granular Permission Checkboxes -->
    <div v-if="showInviteModal" class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
      <div class="bg-surface-card border border-surface-border rounded-xl p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between pb-3 border-b border-surface-border">
          <div class="flex items-center space-x-2">
            <UserPlus class="w-4 h-4 text-primary" />
            <h3 class="text-sm font-semibold text-white">Invite Collaborator</h3>
          </div>
          <button @click="showInviteModal = false" class="text-slate-400 hover:text-white transition-colors">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div>
          <label class="block text-slate-400 text-xs mb-1 font-medium">Collaborator Email Address</label>
          <input
            v-model="inviteEmail"
            type="email"
            placeholder="colleague@example.com"
            class="w-full bg-surface-deep border border-surface-border rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-primary transition-colors"
          />
        </div>

        <!-- Permission Categories -->
        <div class="space-y-4 pt-1">
          <label class="block text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Access Permissions Matrix
          </label>

          <div
            v-for="cat in permissionCategories"
            :key="cat.name"
            class="bg-surface-deep border border-surface-border rounded-lg p-3 space-y-2.5"
          >
            <div class="flex items-center justify-between border-b border-surface-border pb-1.5">
              <span class="text-xs font-bold text-white flex items-center">
                <component :is="cat.icon" class="w-3.5 h-3.5 mr-1.5 text-primary" />
                {{ cat.name }}
              </span>
              <button
                type="button"
                @click="toggleCategory(cat)"
                class="text-[10px] text-primary-light hover:underline font-semibold"
              >
                Toggle All
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <label
                v-for="p in cat.permissions"
                :key="p.key"
                class="flex items-center space-x-2 p-1.5 rounded hover:bg-surface-elevated cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  :checked="selectedPermissions.includes(p.key)"
                  @change="togglePermission(p.key)"
                  class="rounded bg-surface-card border-surface-border text-primary focus:ring-0"
                />
                <span class="text-slate-300">{{ p.label }}</span>
              </label>
            </div>
          </div>
        </div>

        <div class="flex justify-end space-x-2 pt-3 border-t border-surface-border">
          <button @click="showInviteModal = false" class="px-3.5 py-2 text-xs text-slate-300 hover:bg-surface-elevated rounded-lg transition-colors">
            Cancel
          </button>
          <button
            @click="inviteSubuser"
            class="px-4 py-2 text-xs bg-primary hover:bg-primary-dark text-slate-950 font-semibold rounded-lg transition-colors shadow-md"
          >
            Send Invitation
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
