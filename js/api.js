/* API 路由：本地 Python 后端 / Supabase 云后端 */

import { localApi } from './api-local.js';

const config = window.YUEJI_CONFIG || {};
const mode = new URLSearchParams(location.search).get('mode') || config.mode || 'local';
let selectedApi = localApi;

if (mode === 'browser') {
  const { createBrowserApi } = await import('./api-browser.js');
  selectedApi = createBrowserApi();
} else if (mode === 'supabase') {
  try {
    await new Promise((resolve, reject) => {
      if (window.supabase?.createClient) { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'vendor/supabase.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('无法加载 vendor/supabase.js'));
      document.head.appendChild(script);
    });
    const { createSupabaseApi } = await import('./api-supabase.js');
    selectedApi = createSupabaseApi(config);
  } catch (error) {
    console.error('[yueji] Supabase client failed to load', error);
    const failed = (message) => {
      const err = new Error(message);
      err.status = 0;
      return Promise.reject(err);
    };
    selectedApi = {
      mode: 'supabase',
      authMode: 'password',
      bootstrap: () => failed('Supabase 客户端加载失败，请检查网络或配置'),
      login: () => failed('Supabase 客户端加载失败，请检查网络或配置'),
      register: () => failed('Supabase 客户端加载失败，请检查网络或配置'),
      logout: () => Promise.resolve({ ok: true }),
      updateProfile: () => failed('Supabase 客户端加载失败，请检查网络或配置'),
      createActivity: () => failed('Supabase 客户端加载失败，请检查网络或配置'),
      updateActivity: () => failed('Supabase 客户端加载失败，请检查网络或配置'),
      deleteActivity: () => failed('Supabase 客户端加载失败，请检查网络或配置'),
      bulkActivities: () => failed('Supabase 客户端加载失败，请检查网络或配置'),
      addWeight: () => failed('Supabase 客户端加载失败，请检查网络或配置'),
      changePassword: () => failed('Supabase 客户端加载失败，请检查网络或配置'),
      loadSample: () => failed('Supabase 客户端加载失败，请检查网络或配置'),
      clearData: () => failed('Supabase 客户端加载失败，请检查网络或配置'),
      exportData: () => failed('Supabase 客户端加载失败，请检查网络或配置')
    };
  }
}

export const api = selectedApi;
