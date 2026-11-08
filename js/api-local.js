/* 跃迹 YUEJI — 后端 API 客户端
 * 所有数据以服务端 SQLite 为准，浏览器仅保留内存状态。
 */

async function request(path, options = {}) {
  const opts = { credentials: 'same-origin', ...options };
  if (opts.body !== undefined && typeof opts.body !== 'string') {
    opts.body = JSON.stringify(opts.body);
  }
  opts.headers = {
    ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    ...(opts.headers || {})
  };

  let response;
  try {
    response = await fetch(path, opts);
  } catch {
    const error = new Error('无法连接服务器，请确认后端已启动');
    error.status = 0;
    throw error;
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }
  if (!response.ok) {
    const error = new Error(data?.error || `请求失败（${response.status}）`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export const localApi = {
  mode: 'local',
  authMode: 'otp',
  sendCode(phone) {
    return request('/api/auth/send-code', { method: 'POST', body: { phone } });
  },
  login(phone, code) {
    return request('/api/auth/login', { method: 'POST', body: { phone, code } });
  },
  demoLogin() {
    return request('/api/auth/demo', { method: 'POST', body: {} });
  },
  logout() {
    return request('/api/auth/logout', { method: 'POST', body: {} });
  },
  bootstrap() {
    return request('/api/bootstrap');
  },
  updateProfile(profile, nickname = '') {
    const body = { profile };
    if (nickname) body.nickname = nickname;
    return request('/api/profile', { method: 'PUT', body });
  },
  createActivity(activity) {
    return request('/api/activities', { method: 'POST', body: { activity } });
  },
  updateActivity(id, activity) {
    return request(`/api/activities/${encodeURIComponent(id)}`, { method: 'PATCH', body: { activity } });
  },
  deleteActivity(id) {
    return request(`/api/activities/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  bulkActivities(payload) {
    return request('/api/activities/bulk', { method: 'POST', body: payload });
  },
  addWeight(date, kg) {
    return request('/api/weights', { method: 'POST', body: { date, kg } });
  },
  changePassword() {
    const error = new Error('当前为手机验证码登录模式，没有登录密码');
    error.status = 400;
    return Promise.reject(error);
  },
  loadSample() {
    return request('/api/demo/load', { method: 'POST', body: {} });
  },
  clearData() {
    return request('/api/data', { method: 'DELETE' });
  },
  exportData() {
    return request('/api/export');
  }
};
