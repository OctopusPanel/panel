import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { SessionUser, UserRole, LoginInput, RegisterInput } from '@octopus/shared';
import { ApiService } from '../services/api.js';
import { setLanguage } from '../i18n/index.js';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('octopus_token'));
  const user = ref<SessionUser | null>(null);
  const isLoading = ref(false);

  const isAuthenticated = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === UserRole.ADMIN);

  async function login(credentials: LoginInput) {
    isLoading.value = true;
    try {
      const res = await ApiService.post<{ token: string; user: SessionUser }>('/auth/login', credentials);
      token.value = res.token;
      user.value = res.user;
      localStorage.setItem('octopus_token', res.token);
      if (res.user.languagePreference) {
        setLanguage(res.user.languagePreference);
      }
      return res;
    } finally {
      isLoading.value = false;
    }
  }

  async function register(data: RegisterInput) {
    isLoading.value = true;
    try {
      const res = await ApiService.post<{ token: string; user: SessionUser }>('/auth/register', data);
      token.value = res.token;
      user.value = res.user;
      localStorage.setItem('octopus_token', res.token);
      if (res.user.languagePreference) {
        setLanguage(res.user.languagePreference);
      }
      return res;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchMe() {
    if (!token.value) return null;
    try {
      const userData = await ApiService.get<SessionUser>('/auth/me');
      user.value = userData;
      if (userData.languagePreference) {
        setLanguage(userData.languagePreference);
      }
      return userData;
    } catch {
      logout();
      return null;
    }
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('octopus_token');
  }

  return {
    token,
    user,
    isLoading,
    isAuthenticated,
    isAdmin,
    login,
    register,
    fetchMe,
    logout,
  };
});
