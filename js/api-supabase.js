/* 跃迹 YUEJI — Supabase 云后端适配器
 *
 * 手机号只作为登录名，内部映射为 phone@domain 的登录标识；
 * 密码由 Supabase Auth 哈希保存，不发送短信。
 */

import { todayKey } from './data.js';

function fail(message, status = 0) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function rethrow(error, fallback = '请求 Supabase 失败') {
  const out = fail(error?.message || fallback, error?.status || 400);
  throw out;
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(-11);
}

function assertPhone(phone) {
  if (!/^1[3-9]\d{9}$/.test(phone)) throw fail('请输入 11 位有效手机号', 400);
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapProfile(row) {
  if (!row) return null;
  return {
    sex: row.sex || null,
    ageBand: row.age_band || null,
    height: numberOrNull(row.height),
    weight: numberOrNull(row.weight),
    goal: row.goal || null,
    freq: numberOrNull(row.freq),
    level: row.level || null
  };
}

function mapActivity(row) {
  const data = row?.data && typeof row.data === 'object' ? row.data : {};
  return {
    ...data,
    id: data.id || row.id,
    type: data.type || row.type || 'other',
    date: data.date || row.date,
    source: data.source || row.source || 'manual',
    createdAt: data.createdAt || row.created_at
  };
}

export function createSupabaseApi(config) {
  if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
    throw new Error('缺少 Supabase URL / anon key 配置');
  }
  if (!window.supabase?.createClient) {
    throw new Error('Supabase SDK 未加载（vendor/supabase.js）');
  }
  const supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  const domain = String(config.phoneEmailDomain || 'phone.yueji.app').replace(/^@/, '');
  const emailForPhone = (phone) => `${phone}@${domain}`;
  const phoneFromEmail = (email) => {
    const local = String(email || '').split('@')[0].replace(/\D/g, '');
    return /^1[3-9]\d{9}$/.test(local) ? local : '';
  };

  async function sessionOrThrow() {
    const { data, error } = await supabase.auth.getSession();
    if (error) rethrow(error, '读取登录状态失败');
    if (!data?.session) throw fail('请先登录', 401);
    return data.session;
  }

  async function authMessage(error, mode) {
    const message = String(error?.message || '');
    if (/invalid login credentials/i.test(message)) return '手机号或密码不正确';
    if (/email not confirmed/i.test(message)) return '邮箱确认未关闭。请在 Supabase Authentication → Providers → Email 关闭 Confirm email。';
    if (/user already registered|already been registered/i.test(message)) return '该手机号已注册，请直接登录';
    if (/password should be at least/i.test(message)) return '密码至少需要 8 位';
    if (mode === 'register' && !message) return '注册失败，请稍后重试';
    return message || (mode === 'register' ? '注册失败，请稍后重试' : '登录失败，请稍后重试');
  }

  async function bootstrap() {
    const session = await sessionOrThrow();
    const uid = session.user.id;
    const [profileRes, activityRes, weightRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('activities').select('id,data,date,type,source,created_at').eq('user_id', uid).is('deleted_at', null).order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('weights').select('date,kg').eq('user_id', uid).order('date', { ascending: true })
    ]);
    if (profileRes.error) rethrow(profileRes.error, '读取档案失败');
    if (activityRes.error) rethrow(activityRes.error, '读取运动记录失败');
    if (weightRes.error) rethrow(weightRes.error, '读取体重记录失败');

    const metadata = session.user.user_metadata || {};
    const phone = profileRes.data?.phone || metadata.phone || phoneFromEmail(session.user.email);
    const nickname = profileRes.data?.nickname || metadata.nickname || `运动者 ${phone.slice(-4)}`;
    return {
      user: {
        id: uid,
        phone,
        nickname,
        createdAt: session.user.created_at,
        profile: mapProfile(profileRes.data)
      },
      activities: (activityRes.data || []).map(mapActivity),
      weights: (weightRes.data || []).map((w) => ({ date: w.date, kg: Number(w.kg) })),
      serverTime: new Date().toISOString()
    };
  }

  async function register(phone, password) {
    const normalized = normalizePhone(phone);
    assertPhone(normalized);
    if (String(password || '').length < 8) throw fail('密码至少需要 8 位', 400);
    const nickname = `运动者 ${normalized.slice(-4)}`;
    const { data, error } = await supabase.auth.signUp({
      email: emailForPhone(normalized),
      password,
      options: { data: { phone: normalized, nickname } }
    });
    if (error) throw fail(await authMessage(error, 'register'), error.status || 400);
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw fail('该手机号已注册，请直接登录', 409);
    }
    if (!data?.session) {
      const login = await supabase.auth.signInWithPassword({ email: emailForPhone(normalized), password });
      if (login.error) {
        throw fail('注册成功，但当前 Supabase 开启了邮箱确认。请关闭 Confirm email 后重试。', 400);
      }
    }
    return bootstrap();
  }

  async function login(phone, password) {
    const normalized = normalizePhone(phone);
    assertPhone(normalized);
    if (!password) throw fail('请输入密码', 400);
    const { error } = await supabase.auth.signInWithPassword({ email: emailForPhone(normalized), password });
    if (error) throw fail(await authMessage(error, 'login'), error.status || 401);
    return bootstrap();
  }

  async function updateProfile(profile, nickname = '') {
    const session = await sessionOrThrow();
    const uid = session.user.id;
    const metadata = session.user.user_metadata || {};
    const phone = metadata.phone || phoneFromEmail(session.user.email);
    const name = String(nickname || metadata.nickname || `运动者 ${phone.slice(-4)}`).trim().slice(0, 20);
    if (!name) throw fail('昵称不能为空', 400);
    const row = {
      user_id: uid,
      phone,
      nickname: name,
      sex: profile?.sex || null,
      age_band: profile?.ageBand || null,
      height: numberOrNull(profile?.height),
      weight: numberOrNull(profile?.weight),
      goal: profile?.goal || null,
      freq: numberOrNull(profile?.freq),
      level: profile?.level || null,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'user_id' });
    if (error) rethrow(error, '保存档案失败');
    if (row.weight) {
      const { error: weightError } = await supabase.from('weights').upsert(
        { user_id: uid, date: todayKey(), kg: row.weight },
        { onConflict: 'user_id,date' }
      );
      if (weightError) rethrow(weightError, '保存体重失败');
    }
    await supabase.auth.updateUser({ data: { phone, nickname: name } });
    return { ok: true, nickname: name, profile: mapProfile(row) };
  }

  async function createActivity(activity) {
    const session = await sessionOrThrow();
    const id = activity.id || uuid();
    const data = {
      ...activity,
      id,
      source: activity.source || 'manual',
      createdAt: activity.createdAt || new Date().toISOString()
    };
    const { error } = await supabase.from('activities').insert({
      id,
      user_id: session.user.id,
      date: data.date,
      type: data.type,
      source: data.source,
      data
    });
    if (error) rethrow(error, '保存运动记录失败');
    return { ok: true, activity: data };
  }

  async function updateActivity(id, activity) {
    const session = await sessionOrThrow();
    const { data: current, error: readError } = await supabase
      .from('activities')
      .select('data')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (readError) rethrow(readError, '读取运动记录失败');
    if (!current) throw fail('记录不存在', 404);
    const merged = {
      ...(current.data || {}),
      ...activity,
      id,
      createdAt: current.data?.createdAt || activity.createdAt || new Date().toISOString(),
      revision: (Number(current.data?.revision) || 1) + 1
    };
    const { error } = await supabase.from('activities').update({
      date: merged.date,
      type: merged.type,
      source: merged.source || 'manual',
      data: merged,
      updated_at: new Date().toISOString()
    }).eq('id', id).eq('user_id', session.user.id);
    if (error) rethrow(error, '更新运动记录失败');
    return { ok: true, activity: merged };
  }

  async function deleteActivity(id) {
    const session = await sessionOrThrow();
    const { error } = await supabase.from('activities').update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', id).eq('user_id', session.user.id);
    if (error) rethrow(error, '删除运动记录失败');
    return { ok: true };
  }

  async function bulkActivities(payload) {
    const session = await sessionOrThrow();
    const uid = session.user.id;
    const activities = Array.isArray(payload?.activities) ? payload.activities : [];
    const weights = Array.isArray(payload?.weights) ? payload.weights : [];
    let added = 0;
    let skipped = 0;
    const rows = [];
    const { data: existingRows, error: existingError } = await supabase
      .from('activities')
      .select('data')
      .eq('user_id', uid)
      .is('deleted_at', null);
    if (existingError) rethrow(existingError, '读取已有记录失败');
    const fingerprint = (a) => `${a.date}|${a.type}|${Math.round(Number(a.duration) || 0)}|${Math.round((Number(a.distance) || 0) * 100)}`;
    const seen = new Set((existingRows || []).map((r) => fingerprint(r.data || {})));
    for (const item of activities) {
      if (!item || typeof item !== 'object') { skipped += 1; continue; }
      if (!Number(item.duration) && !Number(item.distance)) { skipped += 1; continue; }
      const key = fingerprint(item);
      if (seen.has(key)) { skipped += 1; continue; }
      seen.add(key);
      const id = item.id || uuid();
      const data = {
        ...item,
        id,
        source: item.source || 'json',
        createdAt: item.createdAt || new Date().toISOString()
      };
      rows.push({
        id,
        user_id: uid,
        date: data.date,
        type: data.type,
        source: data.source,
        data
      });
      added += 1;
    }
    if (rows.length) {
      const { error } = await supabase.from('activities').insert(rows);
      if (error) rethrow(error, '批量导入运动记录失败');
    }
    let weightCount = 0;
    if (weights.length) {
      const weightRows = weights
        .filter((w) => w && w.date && Number.isFinite(Number(w.kg)) && Number(w.kg) >= 25 && Number(w.kg) <= 300)
        .map((w) => ({ user_id: uid, date: String(w.date).slice(0, 10), kg: Number(w.kg) }));
      if (weightRows.length) {
        const { error } = await supabase.from('weights').upsert(weightRows, { onConflict: 'user_id,date' });
        if (error) rethrow(error, '批量导入体重失败');
        weightCount = weightRows.length;
        await syncProfileWeight(uid);
      }
    }
    return { ok: true, added, skipped, weights: weightCount };
  }

  async function syncProfileWeight(uid) {
    const { data, error } = await supabase.from('weights').select('date,kg').eq('user_id', uid).order('date', { ascending: false }).limit(1).maybeSingle();
    if (error) rethrow(error, '读取体重失败');
    if (data) {
      await supabase.from('profiles').update({ weight: Number(data.kg), updated_at: new Date().toISOString() }).eq('user_id', uid);
    }
  }

  async function addWeight(date, kg) {
    const session = await sessionOrThrow();
    const day = String(date || todayKey()).slice(0, 10);
    const value = Number(kg);
    if (!Number.isFinite(value) || value < 25 || value > 300) throw fail('体重需在 25–300 kg 之间', 400);
    const { error } = await supabase.from('weights').upsert(
      { user_id: session.user.id, date: day, kg: value },
      { onConflict: 'user_id,date' }
    );
    if (error) rethrow(error, '保存体重失败');
    const latest = await supabase.from('weights').select('date,kg').eq('user_id', session.user.id).order('date', { ascending: false }).limit(1).maybeSingle();
    if (latest.error) rethrow(latest.error, '读取体重失败');
    const profileUpdated = latest.data?.date === day;
    if (profileUpdated) {
      await supabase.from('profiles').update({ weight: value, updated_at: new Date().toISOString() }).eq('user_id', session.user.id);
    }
    return { ok: true, date: day, kg: value, currentWeight: latest.data ? Number(latest.data.kg) : value, profileUpdated };
  }

  async function changePassword(currentPassword, newPassword) {
    const session = await sessionOrThrow();
    if (!currentPassword) throw fail('请输入当前密码', 400);
    if (String(newPassword || '').length < 8) throw fail('新密码至少需要 8 位', 400);
    const email = session.user.email;
    const verify = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (verify.error) throw fail('当前密码不正确', 401);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw fail(error.message || '修改密码失败', error.status || 400);
    return { ok: true };
  }

  async function clearData() {
    const session = await sessionOrThrow();
    const { error: activityError } = await supabase.from('activities').delete().eq('user_id', session.user.id);
    if (activityError) rethrow(activityError, '清空运动记录失败');
    const { error: weightError } = await supabase.from('weights').delete().eq('user_id', session.user.id);
    if (weightError) rethrow(weightError, '清空体重记录失败');
    return { ok: true };
  }

  return {
    mode: 'supabase',
    authMode: 'password',
    register,
    login,
    sendCode: () => Promise.reject(fail('当前为密码登录模式，不需要短信验证码', 400)),
    demoLogin: () => Promise.reject(fail('Supabase 模式没有体验账号', 400)),
    logout: async () => { await supabase.auth.signOut(); return { ok: true }; },
    bootstrap,
    updateProfile,
    createActivity,
    updateActivity,
    deleteActivity,
    bulkActivities,
    addWeight,
    changePassword,
    loadSample: () => Promise.reject(fail('Supabase 模式请使用 JSON 导入示例数据', 400)),
    clearData,
    exportData: async () => {
      const data = await bootstrap();
      return { ...data, app: '跃迹 YUEJI', version: 2, exportedAt: new Date().toISOString() };
    }
  };
}
