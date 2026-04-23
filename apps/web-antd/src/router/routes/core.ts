import type { RouteRecordRaw } from 'vue-router';

/** 全局404页面 */
const fallbackNotFoundRoute: RouteRecordRaw = {
  component: () => import('#/views/error/NotFound.vue'),
  meta: {
    hideInBreadcrumb: true,
    hideInMenu: true,
    hideInTab: true,
    title: '404',
  },
  name: 'FallbackNotFound',
  path: '/:path(.*)*',
};

/** 基本路由，这些路由是必须存在的 */
const coreRoutes: RouteRecordRaw[] = [
  {
    component: ()=> import('#/views/Main.vue'),
    path:'/',
    name: 'main'
  },
  {
    component: ()=> import('#/views/login/Login.vue'),
    path: '/auth/login',
    name: 'login'
  }
];

export { coreRoutes, fallbackNotFoundRoute };
