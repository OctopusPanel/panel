import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import UserLayout from '../layouts/UserLayout.vue';
import AdminLayout from '../layouts/AdminLayout.vue';
import AuthLayout from '../layouts/AuthLayout.vue';

const routes: RouteRecordRaw[] = [
  // User Space Routes
  {
    path: '/',
    component: UserLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('../views/DashboardView.vue'),
      },
      {
        path: 'server/:id',
        name: 'server-detail',
        component: () => import('../views/ServerDetailView.vue'),
      },
    ],
  },

  // Admin Area Routes
  {
    path: '/admin',
    component: AdminLayout,
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      {
        path: 'nodes',
        name: 'admin-nodes',
        component: () => import('../views/admin/AdminNodesView.vue'),
      },
      {
        path: 'nodes/:id',
        name: 'admin-node-detail',
        component: () => import('../views/admin/AdminNodeDetailView.vue'),
      },
      {
        path: 'blueprints',
        name: 'admin-blueprints',
        component: () => import('../views/admin/AdminBlueprintsView.vue'),
      },
      {
        path: 'blueprints/:id',
        name: 'admin-blueprint-detail',
        component: () => import('../views/admin/AdminBlueprintDetailView.vue'),
      },
      {
        path: 'allocations',
        name: 'admin-allocations',
        component: () => import('../views/admin/AdminAllocationsView.vue'),
      },
      {
        path: 'servers',
        name: 'admin-servers',
        component: () => import('../views/admin/AdminServersView.vue'),
      },
      {
        path: 'users',
        name: 'admin-users',
        component: () => import('../views/admin/AdminUsersView.vue'),
      },
      {
        path: 'modules',
        name: 'admin-modules',
        component: () => import('../views/admin/AdminModulesView.vue'),
      },
      {
        path: 'system',
        name: 'admin-system',
        component: () => import('../views/admin/AdminSystemView.vue'),
      },
    ],
  },

  // Auth Routes
  {
    path: '/auth',
    component: AuthLayout,
    children: [
      {
        path: 'login',
        name: 'login',
        component: () => import('../views/auth/LoginView.vue'),
      },
      {
        path: 'register',
        name: 'register',
        component: () => import('../views/auth/RegisterView.vue'),
      },
    ],
  },

  // Fallback
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();

  if (authStore.token && !authStore.user) {
    await authStore.fetchMe();
  }

  const isAuth = authStore.isAuthenticated;
  const isAdmin = authStore.isAdmin;

  if (to.meta.requiresAuth && !isAuth) {
    return next({ name: 'login' });
  }

  if (to.meta.requiresAdmin && !isAdmin) {
    return next({ name: 'dashboard' });
  }

  if ((to.name === 'login' || to.name === 'register') && isAuth) {
    return next({ name: 'dashboard' });
  }

  next();
});
