<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ApiService } from '../../services/api.js';
import { Users, Plus, Trash2, X } from 'lucide-vue-next';
import SkeletonTable from '../../components/ui/SkeletonTable.vue';
import ButtonSpinner from '../../components/ui/ButtonSpinner.vue';

const { t } = useI18n();

const users = ref<any[]>([]);
const isLoading = ref(false);
const isCreating = ref(false);

const showCreateModal = ref(false);
const userForm = ref({
  email: '',
  username: '',
  password: '',
  role: 'user',
  languagePreference: 'en',
});

async function loadUsers() {
  isLoading.value = true;
  try {
    users.value = await ApiService.get<any[]>('/admin/users');
  } finally {
    isLoading.value = false;
  }
}

async function createUser() {
  isCreating.value = true;
  try {
    await ApiService.post('/admin/users', userForm.value);
    showCreateModal.value = false;
    await loadUsers();
  } catch (err) {
    console.error('Failed to create user:', err);
  } finally {
    isCreating.value = false;
  }
}

async function deleteUser(id: number) {
  if (!confirm('Are you sure you want to delete this user?')) return;
  await ApiService.delete(`/admin/users/${id}`);
  loadUsers();
}

onMounted(() => {
  loadUsers();
});
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-white">{{ t('admin.users.title') }}</h1>
        <p class="text-xs text-slate-400 mt-1">{{ t('admin.users.subtitle') }}</p>
      </div>

      <button
        @click="showCreateModal = true"
        class="flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-dark text-slate-950 transition-all shadow-md active:scale-[0.98]"
      >
        <Plus class="w-4 h-4 mr-2" />
        {{ t('admin.users.createUser') }}
      </button>
    </div>

    <!-- Users Table -->
    <div class="bg-surface-card border border-surface-border rounded-xl overflow-hidden shadow-xl">
      <SkeletonTable v-if="isLoading" :columns="5" :rows="5" />

      <table v-else class="w-full text-left text-xs font-mono">
        <thead class="bg-surface-deep text-slate-400 uppercase tracking-wider text-[10px] border-b border-surface-border">
          <tr>
            <th class="py-3 px-4">{{ t('admin.users.username') }}</th>
            <th class="py-3 px-4">{{ t('admin.users.email') }}</th>
            <th class="py-3 px-4">{{ t('admin.users.role') }}</th>
            <th class="py-3 px-4">{{ t('nav.servers') }}</th>
            <th class="py-3 px-4 text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-surface-border/50">
          <tr v-for="u in users" :key="u.id" class="hover:bg-surface-elevated/40 transition-colors">
            <td class="py-3 px-4 font-semibold text-slate-200 flex items-center font-sans">
              <Users class="w-4 h-4 text-primary mr-2" />
              {{ u.username }}
            </td>
            <td class="py-3 px-4 text-slate-400">{{ u.email }}</td>
            <td class="py-3 px-4">
              <span
                class="px-2 py-0.5 rounded text-[10px] uppercase font-semibold border"
                :class="u.role === 'admin' ? 'bg-primary/10 text-primary-light border-primary/25' : 'bg-surface-deep text-slate-300 border-surface-border'"
              >
                {{ u.role }}
              </span>
            </td>
            <td class="py-3 px-4 text-slate-300">{{ u.serversCount || 0 }}</td>
            <td class="py-3 px-4 text-right">
              <button
                @click="deleteUser(u.id)"
                class="p-1.5 text-slate-400 hover:text-status-offline rounded hover:bg-surface-elevated transition-colors"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create User Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
      <div class="bg-surface-card border border-surface-border rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-surface-border">
          <h3 class="text-sm font-semibold text-white">{{ t('admin.users.createUser') }}</h3>
          <button @click="showCreateModal = false" class="text-slate-400 hover:text-white transition-colors">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1 font-medium">{{ t('admin.users.email') }}</label>
            <input v-model="userForm.email" type="email" placeholder="user@example.com" class="w-full bg-surface-deep border border-surface-border rounded-lg p-2.5 text-slate-200 outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label class="block text-slate-400 mb-1 font-medium">{{ t('admin.users.username') }}</label>
            <input v-model="userForm.username" type="text" placeholder="username" class="w-full bg-surface-deep border border-surface-border rounded-lg p-2.5 text-slate-200 outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label class="block text-slate-400 mb-1 font-medium">Password</label>
            <input v-model="userForm.password" type="password" placeholder="••••••••" class="w-full bg-surface-deep border border-surface-border rounded-lg p-2.5 text-slate-200 outline-none focus:border-primary transition-colors" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-400 mb-1 font-medium">{{ t('admin.users.role') }}</label>
              <select v-model="userForm.role" class="w-full bg-surface-deep border border-surface-border rounded-lg p-2.5 text-slate-200 outline-none focus:border-primary transition-colors">
                <option value="user">User</option>
                <option value="support">Support</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label class="block text-slate-400 mb-1 font-medium">{{ t('admin.users.language') }}</label>
              <select v-model="userForm.languagePreference" class="w-full bg-surface-deep border border-surface-border rounded-lg p-2.5 text-slate-200 outline-none focus:border-primary transition-colors">
                <option value="en">English (EN)</option>
                <option value="de">Deutsch (DE)</option>
              </select>
            </div>
          </div>
        </div>

        <div class="flex justify-end space-x-2 pt-3 border-t border-surface-border">
          <button @click="showCreateModal = false" class="px-3.5 py-2 text-xs text-slate-300 hover:bg-surface-elevated rounded-lg transition-colors">
            {{ t('common.cancel') }}
          </button>
          <ButtonSpinner
            @click="createUser"
            :loading="isCreating"
            spinner-color="white"
            class="px-4 py-2 text-xs bg-primary hover:bg-primary-dark text-slate-950 font-semibold rounded-lg transition-colors shadow-md"
          >
            {{ t('common.create') }}
          </ButtonSpinner>
        </div>
      </div>
    </div>
  </div>
</template>
