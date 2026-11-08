/* 跃迹 YUEJI — 无登录、本机浏览器存储模式
 *
 * 数据只保存在当前浏览器的 localStorage 中，不跨设备同步。
 * 适合直接发布到 GitHub Pages 做个人/朋友版。
 */

import { todayKey } from './data.js';

const STORAGE_KEY = 'yueji.browser.v1';
const USER_ID = 'browser-user';

function fail(message, status = 0) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function now() {
  return new Date().toISOString();
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function emptyState() {
  return {
    version: 1,
    user: {
      id: USER_ID,
      phone: '本机',
      nickname: '运动者',
      createdAt: now(),
      profile: null
    },
    activities: [],
    weights: []
  };
}

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyState();
    return {
      version: 1,
      user: {
        ...emptyState().user,
        ...(parsed.user || {}),
        profile: parsed.user?.profile || null
      },
      activities: Array.isArray(parsed.activities) ? parsed.activities : [],
      weights: Array.isArray(parsed.weights) ? parsed.weights : []
    };
  } catch {
    return emptyState();
  }
}

function writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    throw fail('本机存储空间不足，请先导出数据备份，或清理浏览器存储', 507);
  }
}

function mapProfile(profile) {
  if (!profile) return null;
  return {
    sex: profile.sex || null,
    ageBand: profile.ageBand || null,
    height: Number.isFinite(Number(profile.height)) ? Number(profile.height) : null,
    weight: Number.isFinite(Number(profile.weight)) ? Number(profile.weight) : null,
    goal: profile.goal || null,
    freq: Number.isFinite(Number(profile.freq)) ? Number(profile.freq) : null,
    level: profile.level || null
  };
}

function sortActivities(list) {
  return [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

function latestWeight(state) {
  return [...state.weights].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
}

function fingerprint(a) {
  return `${a.date}|${a.type}|${Math.round(Number(a.duration) || 0)}|${Math.round((Number(a.distance) || 0) * 100)}`;
}

export function createBrowserApi() {
  let state = readState();

  function bootstrap() {
    state = readState();
    return {
      user: { ...state.user, profile: state.user.profile ? mapProfile(state.user.profile) : null },
      activities: sortActivities(state.activities),
      weights: [...state.weights].sort((a, b) => String(a.date).localeCompare(String(b.date))),
      serverTime: now()
    };
  }

  async function updateProfile(profile, nickname = '') {
    const name = String(nickname || state.user.nickname || '运动者').trim().slice(0, 20);
    if (!name) throw fail('昵称不能为空', 400);
    state.user.nickname = name;
    state.user.profile = mapProfile(profile);
    const weight = Number(profile?.weight);
    if (Number.isFinite(weight) && weight > 0) {
      const day = todayKey();
      const existing = state.weights.find((w) => w.date === day);
      if (existing) existing.kg = weight;
      else state.weights.push({ date: day, kg: weight });
    }
    writeState(state);
    return { ok: true, nickname: name, profile: state.user.profile };
  }

  async function createActivity(activity) {
    const data = {
      ...activity,
      id: activity.id || uuid(),
      source: activity.source || 'manual',
      createdAt: activity.createdAt || now()
    };
    state.activities.push(data);
    writeState(state);
    return { ok: true, activity: data };
  }

  async function updateActivity(id, activity) {
    const index = state.activities.findIndex((a) => a.id === id);
    if (index < 0) throw fail('记录不存在', 404);
    state.activities[index] = {
      ...state.activities[index],
      ...activity,
      id,
      createdAt: state.activities[index].createdAt || now(),
      revision: (Number(state.activities[index].revision) || 1) + 1
    };
    writeState(state);
    return { ok: true, activity: state.activities[index] };
  }

  async function deleteActivity(id) {
    state.activities = state.activities.filter((a) => a.id !== id);
    writeState(state);
    return { ok: true };
  }

  async function bulkActivities(payload) {
    const activities = Array.isArray(payload?.activities) ? payload.activities : [];
    const weights = Array.isArray(payload?.weights) ? payload.weights : [];
    const seen = new Set(state.activities.map(fingerprint));
    let added = 0;
    let skipped = 0;
    for (const item of activities) {
      if (!item || typeof item !== 'object' || (!Number(item.duration) && !Number(item.distance))) {
        skipped += 1;
        continue;
      }
      const key = fingerprint(item);
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      state.activities.push({
        ...item,
        id: item.id || uuid(),
        source: item.source || 'json',
        createdAt: item.createdAt || now()
      });
      added += 1;
    }
    let weightCount = 0;
    for (const weight of weights) {
      const kg = Number(weight?.kg);
      const day = String(weight?.date || '').slice(0, 10);
      if (!day || !Number.isFinite(kg) || kg < 25 || kg > 300) continue;
      const existing = state.weights.find((w) => w.date === day);
      if (existing) existing.kg = kg;
      else state.weights.push({ date: day, kg });
      weightCount += 1;
    }
    if (weightCount) {
      const latest = latestWeight(state);
      if (latest) state.user.profile = { ...(state.user.profile || {}), weight: latest.kg };
    }
    writeState(state);
    return { ok: true, added, skipped, weights: weightCount };
  }

  async function addWeight(date, kg) {
    const day = String(date || todayKey()).slice(0, 10);
    const value = Number(kg);
    if (!Number.isFinite(value) || value < 25 || value > 300) throw fail('体重需在 25–300 kg 之间', 400);
    const existing = state.weights.find((w) => w.date === day);
    if (existing) existing.kg = value;
    else state.weights.push({ date: day, kg: value });
    const latest = latestWeight(state);
    const profileUpdated = latest?.date === day;
    if (profileUpdated) state.user.profile = { ...(state.user.profile || {}), weight: value };
    writeState(state);
    return { ok: true, date: day, kg: value, currentWeight: latest?.kg ?? value, profileUpdated };
  }

  async function loadSample() {
    if (state.activities.length) throw fail('当前已有运动记录，示例数据仅可导入空账号', 409);
    const response = await fetch('assets/demo-seed.json');
    if (!response.ok) throw fail('示例数据加载失败', 404);
    const seed = await response.json();
    state.activities = (seed.activities || []).map((a) => ({
      ...a,
      id: a.id || uuid(),
      source: a.source || 'sample'
    }));
    state.weights = (seed.weights || []).map((w) => ({ date: w.date, kg: Number(w.kg) }));
    const latest = latestWeight(state);
    if (latest) state.user.profile = { ...(state.user.profile || {}), weight: latest.kg };
    writeState(state);
    return { ok: true, added: state.activities.length, weights: state.weights.length };
  }

  async function clearData() {
    state.activities = [];
    state.weights = [];
    writeState(state);
    return { ok: true };
  }

  return {
    mode: 'browser',
    authMode: 'none',
    bootstrap,
    updateProfile,
    createActivity,
    updateActivity,
    deleteActivity,
    bulkActivities,
    addWeight,
    loadSample,
    clearData,
    logout: async () => ({ ok: true }),
    login: () => Promise.reject(fail('当前是无登录本机模式', 400)),
    register: () => Promise.reject(fail('当前是无登录本机模式', 400)),
    sendCode: () => Promise.reject(fail('当前是无登录本机模式', 400)),
    demoLogin: () => Promise.reject(fail('当前是无登录本机模式', 400)),
    changePassword: () => Promise.reject(fail('当前是无登录本机模式', 400)),
    exportData: async () => ({
      ...bootstrap(),
      app: '跃迹 YUEJI',
      version: 2,
      exportedAt: now()
    })
  };
}
