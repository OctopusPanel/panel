<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../../stores/auth.js';
import { translateApiError } from '../../i18n/index.js';

const { t, locale } = useI18n();
const authStore = useAuthStore();
const router = useRouter();

const email = ref('');
const username = ref('');
const password = ref('');
const errorMessage = ref('');

async function handleSubmit() {
  errorMessage.value = '';
  try {
    await authStore.register({
      email: email.value,
      username: username.value,
      password: password.value,
      languagePreference: locale.value,
    });
    router.push('/');
  } catch (err: any) {
    errorMessage.value = translateApiError(err);
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <div v-if="errorMessage" class="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
      {{ errorMessage }}
    </div>

    <div>
      <label class="block text-xs font-medium text-slate-300 mb-1.5">{{ t('auth.email') }}</label>
      <input
        v-model="email"
        type="email"
        required
        class="w-full bg-[#0a0d14] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
        placeholder="user@example.com"
      />
    </div>

    <div>
      <label class="block text-xs font-medium text-slate-300 mb-1.5">{{ t('auth.username') }}</label>
      <input
        v-model="username"
        type="text"
        required
        class="w-full bg-[#0a0d14] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
        placeholder="alex_dev"
      />
    </div>

    <div>
      <label class="block text-xs font-medium text-slate-300 mb-1.5">{{ t('auth.password') }}</label>
      <input
        v-model="password"
        type="password"
        required
        class="w-full bg-[#0a0d14] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
        placeholder="••••••••"
      />
    </div>

    <button
      type="submit"
      :disabled="authStore.isLoading"
      class="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
    >
      <span v-if="authStore.isLoading">{{ t('common.loading') }}</span>
      <span v-else>{{ t('auth.registerButton') }}</span>
    </button>

    <div class="text-center pt-3 border-t border-slate-800">
      <router-link to="/auth/login" class="text-xs text-slate-400 hover:text-blue-400 transition-colors">
        {{ t('auth.haveAccount') }} {{ t('auth.loginButton') }}
      </router-link>
    </div>
  </form>
</template>
