/* 跃迹 YUEJI — 单页应用主逻辑 */

import {
  SPORTS, SPORT_KEYS, ALL_SPORT_KEYS, GOALS, GOAL_KEYS, SEX_OPTIONS, AGE_BANDS, LEVELS,
  FREQUENCIES, HEIGHT_OPTIONS, WEIGHT_OPTIONS, SOURCE_LABELS, RPE_OPTIONS, todayKey, dateKey, parseDate,
  addDays, fmtDate, weekdayCN, relativeDay, fmtDuration, fmtNumber, fmtDistance, esc,
  clamp, bmiOf, bmiInfo, estimateCalories, activityCalories, activityDistance, sortActivities,
  latestWeight, weightTrend, caloriePlan, hrZones, weeklySnapshot, weekRange, currentStreak,
  weeklyTargetMinutes, computeGuidance, buildWeekPlan, personalBests, trainingBalance,
  activityRpe, sessionLoad, trainingLoad, heatmapData, computeAchievements, streamZoneStats,
  STRENGTH_PARTS, STRENGTH_PART_LABELS
} from './data.js';
import { icon, logoMark } from './icons.js';
import { sparkline, progressRing, barChart, lineChart, conicGradient, hexToRgba, miniBars, streamChart, trackChart } from './charts.js';
import { parseFile, downloadCsvTemplate } from './parsers.js';
import { api } from './api.js';

const DEMO_CODE = '123456';

const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
const toastRoot = document.getElementById('toast-root');

const state = {
  booting: true,
  serverError: null,
  phone: null,
  user: null,
  activities: [],
  weights: [],
  route: 'overview',
  recordSport: 'all',
  recordSource: 'all',
  recordsLimit: 20,
  analyticsWeeks: 8,
  onboarding: null,
  authTab: 'login',
  importData: null,
  mapInstance: null,
  codeTimer: null,
  devCode: '123456'
};

const ROUTE_META = {
  overview: { label: '总览', en: 'OVERVIEW' },
  records: { label: '运动记录', en: 'TRAINING LOG' },
  analytics: { label: '数据分析', en: 'ANALYTICS' },
  guidance: { label: '运动指引', en: 'COACHING' },
  profile: { label: '我的', en: 'PROFILE' }
};

/* ---------------- 启动 ---------------- */

async function init() {
  bindGlobalEvents();
  renderBoot();
  try {
    const data = await api.bootstrap();
    applyBootstrap(data);
    const hashRoute = location.hash.replace('#/', '');
    state.route = ROUTE_META[hashRoute] ? hashRoute : 'overview';
    if (state.user?.profile) history.replaceState(null, '', `#/${state.route}`);
    render();
  } catch (error) {
    state.booting = false;
    state.serverError = error.status === 401 ? null : error.message;
    render();
  }
}

function applyBootstrap(data) {
  state.phone = data.user?.phone || null;
  state.user = normalizeUser(data.user);
  state.activities = sortActivities(Array.isArray(data.activities) ? data.activities : []);
  state.weights = (Array.isArray(data.weights) ? data.weights : []).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  state.serverError = null;
  state.booting = false;
}

async function refreshBootstrap() {
  const data = await api.bootstrap();
  applyBootstrap(data);
  return state.user;
}

function renderBoot() {
  app.innerHTML = `
    <div class="boot-screen">
      <div class="boot-brand">
        <span class="brand-mark">${logoMark(42)}</span>
        <span class="brand-text"><strong>跃迹</strong><em>YUEJI</em></span>
      </div>
      <div class="boot-spinner"></div>
      <p>正在连接你的运动空间…</p>
    </div>`;
}

function normalizeUser(user) {
  if (!user || typeof user !== 'object') return user;
  const profile = user.profile && typeof user.profile === 'object' ? user.profile : null;
  return { ...user, ...(profile || {}), profile };
}

/* ---------------- 全局事件 ---------------- */

function bindGlobalEvents() {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('submit', onDocumentSubmit);
  document.addEventListener('change', onDocumentChange);
  document.addEventListener('input', onDocumentInput);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
  window.addEventListener('popstate', () => {
    if (!state.user?.profile) return;
    const route = location.hash.replace('#/', '');
    if (ROUTE_META[route] && route !== state.route) {
      state.route = route;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
  let lastFocusRefresh = 0;
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || !state.user?.profile || state.booting) return;
    if (modalRoot.innerHTML.trim()) return; // 不打断正在编辑的弹窗
    if (Date.now() - lastFocusRefresh < 15000) return;
    lastFocusRefresh = Date.now();
    try {
      await refreshBootstrap();
      render();
    } catch {
      // 网络波动时保留当前页面，下一次聚焦再试
    }
  });

  document.addEventListener('dragover', (e) => {
    if (modalRoot.querySelector('#dropzone')) {
      e.preventDefault();
      modalRoot.querySelector('#dropzone').classList.add('is-dragging');
    }
  });
  document.addEventListener('dragleave', (e) => {
    const zone = modalRoot.querySelector('#dropzone');
    if (zone && e.target === zone) zone.classList.remove('is-dragging');
  });
  document.addEventListener('drop', (e) => {
    const zone = modalRoot.querySelector('#dropzone');
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove('is-dragging');
    const file = e.dataTransfer?.files?.[0];
    if (file) handleImportFile(file);
  });
}

async function onDocumentClick(e) {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) {
    if (e.target.classList.contains('modal-backdrop')) closeModal();
    return;
  }
  const action = actionEl.dataset.action;
  const id = actionEl.dataset.id;

  switch (action) {
    case 'send-code': {
      e.preventDefault();
      sendCode(actionEl);
      break;
    }
    case 'fill-code': {
      e.preventDefault();
      const input = document.querySelector('input[name="code"]');
      if (input) { input.value = state.devCode || DEMO_CODE; input.focus(); }
      break;
    }
    case 'demo-login': {
      e.preventDefault();
      loginDemo();
      break;
    }
    case 'onboarding-next': {
      e.preventDefault();
      nextOnboardingStep();
      break;
    }
    case 'onboarding-back': {
      e.preventDefault();
      state.onboarding.step = Math.max(1, state.onboarding.step - 1);
      renderOnboarding();
      break;
    }
    case 'navigate': {
      e.preventDefault();
      navigate(actionEl.dataset.route);
      break;
    }
    case 'add-record': {
      e.preventDefault();
      openAddModal();
      break;
    }
    case 'auth-tab': {
      e.preventDefault();
      state.authTab = actionEl.dataset.tab === 'register' ? 'register' : 'login';
      renderAuth();
      break;
    }
    case 'add-weight': {
      e.preventDefault();
      openWeightModal();
      break;
    }
    case 'change-password': {
      e.preventDefault();
      openPasswordModal();
      break;
    }
    case 'add-strength-exercise': {
      e.preventDefault();
      addStrengthRow();
      break;
    }
    case 'remove-strength-exercise': {
      e.preventDefault();
      actionEl.closest('[data-strength-row]')?.remove();
      updateStrengthTotal();
      break;
    }
    case 'quick-add': {
      e.preventDefault();
      openAddModal({
        type: actionEl.dataset.type || 'running',
        duration: Number(actionEl.dataset.duration) || 40
      });
      break;
    }
    case 'open-import': {
      e.preventDefault();
      state.importData = null;
      openImportModal();
      break;
    }
    case 'pick-file': {
      e.preventDefault();
      document.getElementById('import-file')?.click();
      break;
    }
    case 'download-template': {
      e.preventDefault();
      downloadCsvTemplate();
      toast('CSV 模板已下载', 'success');
      break;
    }
    case 'import-confirm': {
      e.preventDefault();
      confirmImport();
      break;
    }
    case 'import-retry': {
      e.preventDefault();
      state.importData = null;
      openImportModal();
      break;
    }
    case 'close-modal': {
      e.preventDefault();
      closeModal();
      break;
    }
    case 'open-sport': {
      e.preventDefault();
      openSportModal(actionEl.dataset.sport);
      break;
    }
    case 'view-sport-records': {
      e.preventDefault();
      state.recordSport = actionEl.dataset.sport;
      state.recordSource = 'all';
      state.recordsLimit = 20;
      closeModal();
      navigate('records');
      break;
    }
    case 'open-record': {
      e.preventDefault();
      openRecordModal(id);
      break;
    }
    case 'edit-record': {
      e.preventDefault();
      closeModal();
      openAddModal({}, id);
      break;
    }
    case 'edit-nickname': {
      e.preventDefault();
      const input = document.getElementById('nickname-input');
      if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus();
        input.select();
      }
      break;
    }
    case 'open-day': {
      e.preventDefault();
      openDayModal(actionEl.dataset.date);
      break;
    }
    case 'add-day': {
      e.preventDefault();
      closeModal();
      openAddModal({ date: actionEl.dataset.date });
      break;
    }
    case 'delete-record': {
      e.preventDefault();
      e.stopPropagation();
      openConfirm({
        title: '删除这条记录？',
        message: '删除后无法恢复，统计数据会立即更新。',
        confirmLabel: '删除记录',
        confirmAction: 'do-delete-record',
        id
      });
      break;
    }
    case 'do-delete-record': {
      e.preventDefault();
      try {
        await api.deleteActivity(id);
        await refreshBootstrap();
        closeModal();
        render();
        toast('记录已删除', 'success');
      } catch (error) {
        toast(error.message || '删除失败，请稍后重试', 'error');
      }
      break;
    }
    case 'filter-sport': {
      e.preventDefault();
      state.recordSport = actionEl.dataset.sport;
      state.recordsLimit = 20;
      render();
      break;
    }
    case 'load-more-records': {
      e.preventDefault();
      state.recordsLimit += 20;
      render();
      break;
    }
    case 'load-sample': {
      e.preventDefault();
      try {
        actionEl.disabled = true;
        const result = await api.loadSample();
        await refreshBootstrap();
        render();
        toast(`已载入 ${result.added || 0} 条示例记录，可随时清空`, 'success');
      } catch (error) {
        actionEl.disabled = false;
        toast(error.message || '示例数据载入失败', 'error');
      }
      break;
    }
    case 'export-data': {
      e.preventDefault();
      exportData();
      break;
    }
    case 'export-gpx': {
      e.preventDefault();
      exportActivityGpx(id);
      break;
    }
    case 'load-basemap': {
      e.preventDefault();
      loadTrackBasemap(id, actionEl);
      break;
    }
    case 'hide-basemap': {
      e.preventDefault();
      hideTrackBasemap();
      break;
    }
    case 'clear-data': {
      e.preventDefault();
      openConfirm({
        title: '清空全部运动数据？',
        message: '运动记录与体重记录都会被删除，身体档案与账号会保留。此操作无法撤回。',
        confirmLabel: '确认清空',
        confirmAction: 'do-clear-data',
        danger: true
      });
      break;
    }
    case 'do-clear-data': {
      e.preventDefault();
      try {
        await api.clearData();
        await refreshBootstrap();
        closeModal();
        render();
        toast('运动数据已清空', 'success');
      } catch (error) {
        toast(error.message || '清空失败，请稍后重试', 'error');
      }
      break;
    }
    case 'logout': {
      e.preventDefault();
      await logout();
      break;
    }
    case 'notification': {
      e.preventDefault();
      toast('暂无新通知，保持训练就有好消息', 'info');
      break;
    }
    default:
      break;
  }
}

function onDocumentSubmit(e) {
  const form = e.target;
  if (form.id === 'login-form') {
    e.preventDefault();
    handleLogin(form);
  } else if (form.id === 'password-auth-form') {
    e.preventDefault();
    handlePasswordAuth(form);
  } else if (form.id === 'onboarding-form') {
    e.preventDefault();
    finishOnboarding(form);
  } else if (form.id === 'add-record-form') {
    e.preventDefault();
    handleAddRecord(form);
  } else if (form.id === 'profile-form') {
    e.preventDefault();
    handleProfileSave(form);
  } else if (form.id === 'weight-form') {
    e.preventDefault();
    handleWeightSave(form);
  } else if (form.id === 'password-form') {
    e.preventDefault();
    handlePasswordChange(form);
  }
}

function onDocumentInput(e) {
  if (e.target.id === 'record-duration' || e.target.id === 'record-rpe') updateLoadPreview();
  if (e.target.closest('#strength-rows')) updateStrengthTotal();
}

function onDocumentChange(e) {
  const t = e.target;
  if (t.id === 'import-file') {
    const file = t.files?.[0];
    t.value = '';
    if (file) handleImportFile(file);
    return;
  }
  if (t.name === 'type' && t.form?.id === 'add-record-form') {
    syncStrengthEditor(t.form);
    return;
  }
  if (t.closest('#strength-rows')) updateStrengthTotal();
  if (t.matches('[data-onboarding-field]')) {
    const field = t.dataset.onboardingField;
    state.onboarding[field] = t.value;
    refreshOnboardingPreview();
    return;
  }
  if (t.id === 'analytics-range') {
    state.analyticsWeeks = Number(t.value) || 8;
    render();
    return;
  }
  if (t.id === 'source-filter') {
    state.recordSource = t.value;
    state.recordsLimit = 20;
    render();
  }
}

/* ---------------- 登录 ---------------- */

let countdownTimer = null;

function startCountdown(button, seconds = 60) {
  if (countdownTimer) clearInterval(countdownTimer);
  let left = seconds;
  button.disabled = true;
  button.textContent = `${left}s 后重发`;
  countdownTimer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = '重新获取';
      }
      return;
    }
    if (button.isConnected) button.textContent = `${left}s 后重发`;
  }, 1000);
}

async function sendCode(button) {
  const form = document.getElementById('login-form');
  const phone = digits(form?.elements?.phone?.value || '');
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    authError('请先输入 11 位有效手机号');
    form?.elements?.phone?.focus();
    return;
  }
  authError('');
  const original = button.textContent;
  button.disabled = true;
  button.textContent = '发送中…';
  try {
    const result = await api.sendCode(phone);
    state.devCode = result.devCode || DEMO_CODE;
    const hint = document.getElementById('code-hint');
    if (hint) {
      hint.innerHTML = `本地开发验证码 <button type="button" data-action="fill-code">${state.devCode}</button>，点击自动填入`;
      hint.classList.add('show');
    }
    startCountdown(button);
    toast(`验证码已发送，本地开发验证码 ${state.devCode}`, 'info');
  } catch (error) {
    button.disabled = false;
    button.textContent = original;
    authError(error.message || '验证码发送失败');
  }
}

function authError(message) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('show', Boolean(message));
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function setBusy(button, label) {
  if (!button) return () => {};
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = label;
  return () => {
    if (button.isConnected) {
      button.disabled = false;
      button.innerHTML = original;
    }
  };
}

async function finishLogin(data, welcome = true) {
  applyBootstrap(data);
  closeModal();
  if (state.user?.profile) {
    state.route = 'overview';
    history.replaceState(null, '', '#/overview');
    render();
    if (welcome) toast(`欢迎回来，${state.user.nickname}`, 'success');
  } else {
    state.onboarding = {
      step: 1, sex: 'male', ageBand: '26-35', height: '', weight: '', goal: '', freq: '4', level: 'casual', nickname: state.user?.nickname || ''
    };
    render();
  }
}

async function handlePasswordAuth(form) {
  const phone = digits(form.elements.phone.value);
  const password = String(form.elements.password.value || '');
  const confirm = String(form.elements.passwordConfirm?.value || '');
  const terms = form.elements.terms.checked;
  const register = state.authTab === 'register';
  if (!/^1[3-9]\d{9}$/.test(phone)) return authError('请输入 11 位有效手机号');
  if (password.length < 8) return authError('密码至少需要 8 位');
  if (register && password !== confirm) return authError('两次输入的密码不一致');
  if (!terms) return authError('请先阅读并同意服务条款与隐私政策');
  authError('');
  const restore = setBusy(form.querySelector('button[type="submit"]'), register ? '创建中…' : '登录中…');
  try {
    const data = register ? await api.register(phone, password) : await api.login(phone, password);
    await finishLogin(data);
  } catch (error) {
    authError(error.message || (register ? '注册失败，请稍后重试' : '登录失败，请稍后重试'));
    restore();
  }
}

async function handleLogin(form) {
  const phone = digits(form.elements.phone.value);
  const code = digits(form.elements.code.value);
  const terms = form.elements.terms.checked;
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    authError('请输入 11 位有效手机号');
    return;
  }
  if (code.length !== 6) {
    authError('请输入 6 位验证码');
    return;
  }
  if (!terms) {
    authError('请先阅读并同意服务条款与隐私政策');
    return;
  }
  authError('');
  const restore = setBusy(form.querySelector('button[type="submit"]'), '登录中…');
  try {
    if (countdownTimer) clearInterval(countdownTimer);
    const data = await api.login(phone, code);
    await finishLogin(data);
  } catch (error) {
    authError(error.message || '登录失败，请稍后重试');
    restore();
  }
}

async function loginDemo() {
  if (countdownTimer) clearInterval(countdownTimer);
  try {
    const data = await api.demoLogin();
    await finishLogin(data, false);
    toast('已进入体验账号，数据均为示例', 'info');
  } catch (error) {
    toast(error.message || '体验账号登录失败', 'error');
  }
}

async function logout() {
  if (countdownTimer) clearInterval(countdownTimer);
  try {
    await api.logout();
  } catch (error) {
    toast(error.message || '退出登录失败，请检查服务端', 'error');
    return;
  }
  state.phone = null;
  state.user = null;
  state.activities = [];
  state.weights = [];
  state.route = 'overview';
  state.onboarding = null;
  history.replaceState(null, '', '#/');
  render();
  toast('已退出登录', 'success');
}

/* ---------------- 渲染入口 ---------------- */

function render() {
  closeModal();
  if (!state.phone) {
    renderAuth();
    return;
  }
  if (!state.user?.profile) {
    renderOnboarding();
    return;
  }
  renderShell();
}

function renderAuth() {
  const visual = `
    <section class="auth-visual">
      <div class="auth-grid"></div>
      <a class="brand brand--light" href="#" aria-label="跃迹首页">
        <span class="brand-mark">${logoMark(36)}</span>
        <span class="brand-text"><strong>跃迹</strong><em>YUEJI</em></span>
      </a>
      <div class="auth-copy">
        <span class="eyebrow"><span class="eyebrow-dot"></span> TRAIN WITH CLARITY</span>
        <h1>把每一次<br>运动，变成<br><span class="hl">看得见</span>的进步。</h1>
        <p>记录训练、读懂身体、获得下一练的清晰指引。<br>你的运动数据，只属于你。</p>
      </div>
      <div class="auth-stage" aria-hidden="true">
        <div class="stage-ring ring-1"></div>
        <div class="stage-ring ring-2"></div>
        <div class="stage-ring ring-3"></div>
        <div class="stage-card card-a">
          <span class="stage-label">WEEKLY LOAD</span>
          <strong>3h 12m</strong>
          <div class="stage-bars"><i style="height:32%"></i><i style="height:55%"></i><i style="height:44%"></i><i style="height:78%"></i><i style="height:62%"></i><i style="height:92%"></i><i style="height:70%"></i></div>
        </div>
        <div class="stage-card card-b">
          <span class="stage-icon">${icon('flame', 22)}</span>
          <div><strong>1,860</strong><span>kcal 本周消耗</span></div>
        </div>
        <div class="stage-card card-c">
          <div class="stage-mini-ring">${progressRing({ size: 74, stroke: 7, progress: 0.82, color: '#CCF56B' })}</div>
          <div><strong>82%</strong><span>周目标进度</span></div>
        </div>
        <div class="stage-pill"><span class="pulse-dot"></span> 连续训练 5 天</div>
      </div>
      <footer class="auth-foot">
        <span>© 2026 跃迹 YUEJI</span>
        <span>为长期主义者设计的运动看板</span>
      </footer>
    </section>`;

  const passwordMode = api.authMode === 'password';
  const otpPanel = `
    <section class="auth-panel">
      <div class="auth-card">
        <div class="auth-mobile-brand">
          <span class="brand-mark">${logoMark(32)}</span>
          <span class="brand-text"><strong>跃迹</strong><em>YUEJI</em></span>
        </div>
        <div class="auth-heading">
          <span class="eyebrow">WELCOME BACK</span>
          <h2>登录你的运动空间</h2>
          <p>首次使用手机号将自动创建账号，登录后数据保存在你的专属账号中。</p>
        </div>
        ${state.serverError ? `<div class="server-error">${icon('info', 15)} <span>${esc(state.serverError)}</span></div>` : ''}
        <form id="login-form" novalidate>
          <div class="field">
            <label for="phone">手机号</label>
            <div class="phone-field">
              <span class="prefix">+86</span>
              <input id="phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="11" placeholder="请输入手机号" aria-label="手机号">
            </div>
          </div>
          <div class="field">
            <label for="code">验证码</label>
            <div class="code-row">
              <input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 位验证码" aria-label="验证码">
              <button type="button" class="code-btn" data-action="send-code">获取验证码</button>
            </div>
            <p class="code-hint" id="code-hint">本地开发验证码 <button type="button" data-action="fill-code">${DEMO_CODE}</button>，点击自动填入</p>
          </div>
          <label class="check-line">
            <input type="checkbox" name="terms">
            <span class="check-box">${icon('check', 12)}</span>
            <span>我已阅读并同意 <a href="#" onclick="return false">服务条款</a> 与 <a href="#" onclick="return false">隐私政策</a></span>
          </label>
          <p class="form-error" id="auth-error" role="alert"></p>
          <button type="submit" class="btn btn-primary btn-block">登录 / 注册 ${icon('arrow', 18)}</button>
        </form>
        <button type="button" class="demo-login" data-action="demo-login">
          不想注册？<strong>使用体验账号直接查看</strong> ${icon('arrow', 15)}
        </button>
        <p class="auth-note">${icon('shield', 14)} 账号数据保存于本地服务端 SQLite · 开发环境验证码 123456</p>
      </div>
    </section>`;
  const panel = passwordMode ? passwordAuthPanel() : otpPanel;

  app.innerHTML = `<main class="auth-page">${visual}${panel}</main>`;
}

function passwordAuthPanel() {
  const register = state.authTab === 'register';
  return `
    <section class="auth-panel">
      <div class="auth-card">
        <div class="auth-mobile-brand">
          <span class="brand-mark">${logoMark(32)}</span>
          <span class="brand-text"><strong>跃迹</strong><em>YUEJI</em></span>
        </div>
        <div class="auth-heading">
          <span class="eyebrow">${register ? 'CREATE ACCOUNT' : 'WELCOME BACK'}</span>
          <h2>${register ? '创建你的运动空间' : '登录你的运动空间'}</h2>
          <p>${register ? '手机号只作为登录名，密码由 Supabase 安全保存，不需要短信验证码。' : '用手机号和密码登录，数据保存在你的 Supabase 账号中。'}</p>
        </div>
        ${state.serverError ? `<div class="server-error">${icon('info', 15)} <span>${esc(state.serverError)}</span></div>` : ''}
        <form id="password-auth-form" novalidate>
          <div class="field">
            <label for="phone">手机号</label>
            <div class="phone-field">
              <span class="prefix">+86</span>
              <input id="phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="11" placeholder="请输入手机号" aria-label="手机号">
            </div>
          </div>
          <div class="field">
            <label for="password">密码<span class="optional">至少 8 位</span></label>
            <input id="password" name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" minlength="8" placeholder="请输入密码" aria-label="密码">
          </div>
          ${register ? `<div class="field">
            <label for="password-confirm">确认密码</label>
            <input id="password-confirm" name="passwordConfirm" type="password" autocomplete="new-password" minlength="8" placeholder="再次输入密码" aria-label="确认密码">
          </div>` : ''}
          <label class="check-line">
            <input type="checkbox" name="terms">
            <span class="check-box">${icon('check', 12)}</span>
            <span>我已阅读并同意 <a href="#" onclick="return false">服务条款</a> 与 <a href="#" onclick="return false">隐私政策</a></span>
          </label>
          <p class="form-error" id="auth-error" role="alert"></p>
          <button type="submit" class="btn btn-primary btn-block">${register ? '创建账号' : '登录'} ${icon('arrow', 18)}</button>
        </form>
        <div class="auth-switch">
          ${register ? '已经有账号？' : '还没有账号？'}
          <button type="button" class="text-link" data-action="auth-tab" data-tab="${register ? 'login' : 'register'}">${register ? '去登录' : '创建账号'}</button>
        </div>
        <p class="auth-note">${icon('shield', 14)} 密码由 Supabase Auth 加密保存 · 手机号仅作为登录名，不做短信验证</p>
      </div>
    </section>`;
}

/* ---------------- 首次引导 ---------------- */

function renderOnboarding() {
  if (!state.onboarding) {
    state.onboarding = {
      step: 1, sex: 'male', ageBand: '26-35', height: '', weight: '', goal: '', freq: '4', level: 'casual', nickname: state.user?.nickname || ''
    };
  }
  const ob = state.onboarding;
  const step = ob.step;
  const steps = `
    <div class="steps">
      <div class="step ${step >= 1 ? 'active' : ''}"><span>01</span>身体数据</div>
      <div class="step-line ${step >= 2 ? 'active' : ''}"></div>
      <div class="step ${step >= 2 ? 'active' : ''}"><span>02</span>运动目标</div>
    </div>`;

  const bodyFields = `
    <div class="field-grid">
      <div class="field">
        <label>性别</label>
        <div class="select-wrap"><select name="sex" data-onboarding-field="sex">
          ${SEX_OPTIONS.map((o) => `<option value="${o.value}" ${ob.sex === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>${icon('down', 16)}</div>
      </div>
      <div class="field">
        <label>年龄段</label>
        <div class="select-wrap"><select name="ageBand" data-onboarding-field="ageBand">
          ${AGE_BANDS.map((o) => `<option value="${o.value}" ${ob.ageBand === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>${icon('down', 16)}</div>
      </div>
      <div class="field">
        <label>身高</label>
        <div class="select-wrap"><select name="height" data-onboarding-field="height">
          <option value="">请选择身高</option>
          ${HEIGHT_OPTIONS.map((n) => `<option value="${n}" ${String(ob.height) === String(n) ? 'selected' : ''}>${n} cm</option>`).join('')}
        </select>${icon('down', 16)}</div>
      </div>
      <div class="field">
        <label>体重</label>
        <div class="select-wrap"><select name="weight" data-onboarding-field="weight">
          <option value="">请选择体重</option>
          ${WEIGHT_OPTIONS.map((n) => `<option value="${n}" ${String(ob.weight) === String(n) ? 'selected' : ''}>${n} kg</option>`).join('')}
        </select>${icon('down', 16)}</div>
      </div>
    </div>
    <div class="form-tip">${icon('info', 16)} 身高体重将用于计算 BMI、基础代谢与训练消耗，后续可随时修改。</div>`;

  const goalFields = `
    <div class="field">
      <label>怎么称呼你<span class="optional">1–20 个字符</span></label>
      <input type="text" name="nickname" data-onboarding-field="nickname" maxlength="20" autocomplete="nickname" value="${esc(ob.nickname || '')}" placeholder="例如 林一">
    </div>
    <div class="field">
      <label>你的主要运动目标</label>
      <div class="select-wrap select-wrap--lg"><select name="goal" data-onboarding-field="goal" required>
        <option value="">请选择目标</option>
        ${GOAL_KEYS.map((key) => `<option value="${key}" ${ob.goal === key ? 'selected' : ''}>${GOALS[key].label}</option>`).join('')}
      </select>${icon('down', 18)}</div>
    </div>
    <div class="field-grid">
      <div class="field">
        <label>每周可训练</label>
        <div class="select-wrap"><select name="freq" data-onboarding-field="freq">
          ${FREQUENCIES.map((n) => `<option value="${n}" ${String(ob.freq) === String(n) ? 'selected' : ''}>${n} 次 / 周</option>`).join('')}
        </select>${icon('down', 16)}</div>
      </div>
      <div class="field">
        <label>当前运动基础</label>
        <div class="select-wrap"><select name="level" data-onboarding-field="level">
          ${LEVELS.map((o) => `<option value="${o.value}" ${ob.level === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>${icon('down', 16)}</div>
      </div>
    </div>
    <div class="form-tip">${icon('spark', 16)} 我们会根据目标、训练频率与当前基础，生成每周训练量、心率区间与饮食建议。</div>`;

  app.innerHTML = `
    <main class="onboarding-page">
      <header class="onboarding-head">
        <a class="brand brand--light" href="#" aria-label="跃迹">
          <span class="brand-mark">${logoMark(34)}</span>
          <span class="brand-text"><strong>跃迹</strong><em>YUEJI</em></span>
        </a>
        <span class="onboarding-step">STEP ${step} / 2</span>
      </header>
      <div class="onboarding-shell">
        <section class="onboarding-form-panel">
          ${steps}
          <div class="onboarding-copy">
            <span class="eyebrow">${step === 1 ? 'BUILD YOUR BASELINE' : 'SET YOUR DIRECTION'}</span>
            <h1>${step === 1 ? '先认识你，<br>再制定计划。' : '你想成为<br>怎样的自己？'}</h1>
            <p>${step === 1
              ? (api.mode === 'browser' ? '只需要四个基础数据，我们就能算出你的起点。信息只保存在当前浏览器。' : '只需要四个基础数据，我们就能算出你的起点。信息会保存到你的跃迹账号。')
              : '目标没有好坏，只有是否适合当下的你。选择最想先实现的那一个。'}</p>
          </div>
          <form id="onboarding-form" novalidate>
            ${step === 1 ? bodyFields : goalFields}
            <p class="form-error" id="onboarding-error" role="alert"></p>
            <div class="onboarding-actions">
              ${step === 2 ? `<button type="button" class="btn btn-ghost" data-action="onboarding-back">${icon('arrow', 17)} 上一步</button>` : '<span></span>'}
              ${step === 1
                ? `<button type="button" class="btn btn-primary" data-action="onboarding-next">继续 ${icon('arrow', 18)}</button>`
                : `<button type="submit" class="btn btn-primary">生成我的运动指引 ${icon('spark', 17)}</button>`}
            </div>
          </form>
        </section>
        <aside class="onboarding-preview" id="on-preview">${onboardingPreviewHTML()}</aside>
      </div>
    </main>`;
}

function onboardingPreviewHTML() {
  const ob = state.onboarding || {};
  const h = Number(ob.height);
  const w = Number(ob.weight);
  const bmi = h && w ? w / Math.pow(h / 100, 2) : null;
  const info = bmiInfo(bmi);
  const goal = GOALS[ob.goal];
  const freq = Number(ob.freq) || 4;
  const tempUser = { height: h, weight: w, sex: ob.sex, ageBand: ob.ageBand, goal: ob.goal || 'health', freq };
  const target = goal ? weeklyTargetMinutes(tempUser) : null;
  const calorie = goal ? caloriePlan(tempUser) : null;
  return `
    <div class="preview-head">
      <span class="eyebrow">YOUR PROFILE</span>
      <span class="preview-badge">实时预览</span>
    </div>
    <div class="bmi-block">
      <div class="bmi-orbit">
        ${progressRing({ size: 178, stroke: 9, progress: bmi ? clamp((bmi - 14) / 20, 0.04, 0.96) : 0, color: info.tone === 'lime' ? '#CCF56B' : info.tone === 'amber' ? '#F7C95C' : info.tone === 'coral' ? '#FF8B68' : info.tone === 'blue' ? '#7FB0FF' : '#4A554D' })}
        <div class="bmi-orbit-inner">
          <span>BMI</span>
          <strong id="bmi-number">${bmi ? bmi.toFixed(1) : '—'}</strong>
          <em id="bmi-label" class="tone-${info.tone}">${bmi ? info.label : '待填写'}</em>
        </div>
      </div>
      <p>${bmi ? '中国成人 BMI 参考区间 18.5 – 23.9' : '选择身高与体重后实时计算'}</p>
    </div>
    <div class="preview-divider"></div>
    <div class="preview-goal">
      <span class="eyebrow">TRAINING GOAL</span>
      <strong>${goal ? goal.label : '尚未选择目标'}</strong>
      <p>${goal ? goal.desc : '不同的目标对应不同的训练结构与热量策略。'}</p>
    </div>
    <div class="preview-metrics">
      <div><span>每周训练目标</span><strong>${target ? `${target} <em>分钟</em>` : '—'}</strong></div>
      <div><span>建议每日摄入</span><strong>${calorie ? `${calorie.target} <em>kcal</em>` : '—'}</strong></div>
      <div><span>蛋白质目标</span><strong>${calorie ? `${calorie.protein} <em>g</em>` : '—'}</strong></div>
      <div><span>训练频率</span><strong>${freq} <em>次 / 周</em></strong></div>
    </div>
    <div class="preview-note">${icon('shield', 16)} <span>数据会保存到你的账号，可在其他设备登录查看。</span></div>`;
}

function refreshOnboardingPreview() {
  const el = document.getElementById('on-preview');
  if (el) el.innerHTML = onboardingPreviewHTML();
}

function nextOnboardingStep() {
  const ob = state.onboarding;
  const err = document.getElementById('onboarding-error');
  if (!ob.height || !ob.weight) {
    if (err) { err.textContent = '请选择身高与体重，继续下一步'; err.classList.add('show'); }
    return;
  }
  ob.step = 2;
  renderOnboarding();
}

async function finishOnboarding(form) {
  const ob = state.onboarding;
  if (ob.step !== 2) {
    nextOnboardingStep();
    return;
  }
  const err = document.getElementById('onboarding-error');
  const fail = (message) => {
    if (err) { err.textContent = message; err.classList.add('show'); }
  };
  if (!ob.goal) {
    fail('请选择一个主要运动目标');
    return;
  }
  const profile = {
    sex: ob.sex,
    ageBand: ob.ageBand,
    height: Number(ob.height),
    weight: Number(ob.weight),
    goal: ob.goal,
    freq: Number(ob.freq),
    level: ob.level
  };
  const nickname = String(form.querySelector('[name="nickname"]')?.value || '').trim() || state.user?.nickname || '运动者';
  if (nickname.length > 20) {
    fail('昵称不能超过 20 个字符');
    return;
  }
  const restore = setBusy(form.querySelector('button[type="submit"]'), '保存中…');
  try {
    await api.updateProfile(profile, nickname);
    await refreshBootstrap();
    state.route = 'overview';
    history.replaceState(null, '', '#/overview');
    render();
    toast('身体档案已建立，专属指引已生成', 'success');
  } catch (error) {
    fail(error.message || '保存失败，请稍后重试');
    restore();
  }
}

/* ---------------- 应用外壳 ---------------- */

function navigate(route) {
  if (!ROUTE_META[route]) return;
  state.route = route;
  history.replaceState(null, '', `#/${route}`);
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderShell() {
  const user = state.user;
  const browserMode = api.mode === 'browser';
  const guidance = computeGuidance(user, state.activities, state.weights);
  const snap = guidance.snapshot;
  const meta = ROUTE_META[state.route] || ROUTE_META.overview;
  const initial = (user.nickname || '跃').trim().charAt(0).toUpperCase();
  const goal = GOALS[user.goal] || GOALS.health;

  const navItems = [
    ['overview', 'home', '总览'],
    ['records', 'list', '运动记录'],
    ['analytics', 'chart', '数据分析'],
    ['guidance', 'compass', '运动指引'],
    ['profile', 'user', '我的']
  ];
  const navHTML = navItems.map(([route, ico, label]) => `
    <a href="#/${route}" class="nav-item ${state.route === route ? 'active' : ''}" data-action="navigate" data-route="${route}">
      ${icon(ico, 20)}<span>${label}</span><i class="nav-dot"></i>
    </a>`).join('');

  const sideCard = browserMode ? `
    <div class="side-card side-card--sync">
      <div class="side-card-icon">${icon('shield', 19)}</div>
      <div><strong>本机已保存</strong><span>仅保存在当前浏览器</span></div>
      ${icon('check', 15)}
    </div>` : `
    <div class="side-card side-card--sync">
      <div class="side-card-icon">${icon('cloud', 19)}</div>
      <div><strong>云端已同步</strong><span>数据保存于账号服务端</span></div>
      ${icon('check', 15)}
    </div>`;

  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <a class="brand" href="#/overview" data-action="navigate" data-route="overview">
          <span class="brand-mark">${logoMark(34)}</span>
          <span class="brand-text"><strong>跃迹</strong><em>YUEJI</em></span>
        </a>
        <nav class="side-nav" aria-label="主导航">${navHTML}</nav>
        <div class="side-focus">
          <div class="side-focus-head"><span>本周目标</span><em>${Math.round(guidance.progress * 100)}%</em></div>
          <div class="side-focus-ring">
            ${progressRing({ size: 88, stroke: 7, progress: guidance.progress, color: goal.accent })}
            <div><strong>${Math.round(snap.minutes)}</strong><span>/ ${guidance.target} 分钟</span></div>
          </div>
          <p>${guidance.remaining > 0 ? `再练 ${Math.round(guidance.remaining)} 分钟达成目标` : '本周目标已达成，做得很好'}</p>
          <a href="#/guidance" class="side-focus-link" data-action="navigate" data-route="guidance">查看训练指引 ${icon('arrow', 14)}</a>
        </div>
        <div class="side-bottom">
          ${sideCard}
          <a class="side-user" href="#/profile" data-action="navigate" data-route="profile">
            <span class="avatar">${esc(initial)}</span>
            <span class="side-user-text"><strong>${esc(user.nickname)}</strong><em>${esc(goal.label)}</em></span>
            ${icon('chevron', 15)}
          </a>
        </div>
      </aside>

      <div class="app-main">
        <header class="topbar">
          <div class="topbar-mobile-brand">
            <span class="brand-mark">${logoMark(28)}</span>
            <span>跃迹</span>
          </div>
          <div class="topbar-title">
            <span class="topbar-date">${fmtDate(todayKey(), 'long')} · 周${weekdayCN(todayKey())}</span>
            <strong>${meta.en}</strong>
          </div>
          <div class="topbar-actions">
            <button class="icon-btn hide-sm" data-action="notification" aria-label="通知">${icon('bell', 19)}<i class="dot"></i></button>
            <button class="icon-btn mobile-only" data-action="open-import" aria-label="导入数据">${icon('upload', 18)}</button>
            <button class="btn btn-ghost hide-sm" data-action="open-import">${icon('upload', 17)} 导入数据</button>
            <button class="btn btn-primary" data-action="add-record">${icon('plus', 17)} <span>记录运动</span></button>
            <a class="avatar avatar--top" href="#/profile" data-action="navigate" data-route="profile" aria-label="个人中心">${esc(initial)}</a>
          </div>
        </header>
        <main class="content" id="content">${renderView(guidance)}</main>
      </div>

      <nav class="mobile-nav" aria-label="移动端导航">
        ${navItems.map(([route, ico, label]) => `
          <a href="#/${route}" class="mobile-nav-item ${state.route === route ? 'active' : ''}" data-action="navigate" data-route="${route}">
            ${icon(ico, 21)}<span>${({ overview: '总览', records: '记录', analytics: '数据', guidance: '指引', profile: '我的' })[route]}</span>
          </a>`).join('')}
        <button class="mobile-add" data-action="add-record" aria-label="记录运动">${icon('plus', 24)}</button>
      </nav>
    </div>`;
}

function renderView(guidance) {
  switch (state.route) {
    case 'records': return renderRecords();
    case 'analytics': return renderAnalytics();
    case 'guidance': return renderGuidance(guidance);
    case 'profile': return renderProfile();
    default: return renderOverview(guidance);
  }
}

/* ---------------- 总览 ---------------- */

function renderOverview(guidance) {
  const user = state.user;
  const snap = guidance.snapshot;
  const prev = guidance.prev;
  const goal = guidance.goal;
  const session = guidance.session;
  const sport = SPORTS[session.type] || SPORTS.other;
  const currentWeight = latestWeight(user, state.weights);
  const trend = weightTrend(user, state.weights);
  const bmi = bmiOf({ ...user, weight: currentWeight });
  const bmiMeta = bmiInfo(bmi);
  const sessionsToday = state.activities.filter((a) => a.date === todayKey()).length;
  const calorieDelta = prev.calories ? Math.round(((snap.calories - prev.calories) / prev.calories) * 100) : null;

  const weightSeries = state.weights.slice(-12).map((w) => Number(w.kg));
  const hour = new Date().getHours();
  const greeting = hour < 5 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

  const canLoadSample = api.mode !== 'supabase';
  const emptyBanner = state.activities.length === 0 ? `
    <div class="empty-banner">
      <div class="empty-banner-icon">${icon('spark', 24)}</div>
      <div>
        <strong>你的运动故事还没开始</strong>
        <p>手动记录一次，或导入手表里的 FIT 文件${canLoadSample ? '；也可以先载入示例数据看看完整效果' : ''}。</p>
      </div>
      <div class="empty-banner-actions">
        <button class="btn btn-primary btn-sm" data-action="add-record">${icon('plus', 15)} 记录第一次</button>
        ${canLoadSample ? '<button class="btn btn-ghost btn-sm" data-action="load-sample">载入示例数据</button>' : ''}
      </div>
    </div>` : '';

  return `
    <div class="overview">
      <div class="page-head">
        <div>
          <span class="eyebrow">${greeting.toUpperCase()} · ${fmtDate(todayKey(), 'md')} 周${weekdayCN(todayKey())}</span>
          <h1>${esc(user.nickname)}，今天想怎么动？</h1>
          <p>${sessionsToday ? `今天已完成 ${sessionsToday} 次训练，记得补充水分与蛋白质。` : '不用追求完美，完成一次就算赢。'}</p>
        </div>
        <div class="head-badges">
          <span class="pill pill--goal">${icon(goal.icon, 14)} ${goal.label}</span>
          <span class="pill">${icon('flame', 14)} 连续 ${guidance.streak} 天</span>
        </div>
      </div>

      ${emptyBanner}

      <div class="hero-grid">
        <article class="coach-card" style="--accent:${sport.color}">
          <div class="coach-head">
            <span class="tag tag--lime">${icon('spark', 13)} 今日指引</span>
            <span class="coach-mode">${guidance.mode === 'recover' ? '恢复优先' : guidance.mode === 'start' ? '从零开始' : guidance.mode === 'restart' ? '找回节奏' : guidance.mode === 'adjust' ? '动态调整' : '按计划推进'}</span>
          </div>
          <div class="coach-main">
            <div class="coach-copy">
              <span class="eyebrow">${sport.en} · ${session.intensity}</span>
              <h2>${session.title}</h2>
              <p>${session.desc}</p>
              <div class="coach-meta">
                <span>${icon('clock', 15)} ${fmtDuration(session.duration)}</span>
                <span>${icon('heart', 15)} ${session.hr}</span>
              </div>
              <div class="coach-actions">
                <button class="btn btn-primary btn-sm" data-action="quick-add" data-type="${session.type}" data-duration="${session.duration}">记录这次训练 ${icon('arrow', 15)}</button>
                <a class="text-link" href="#/guidance" data-action="navigate" data-route="guidance">完整指引 ${icon('chevron', 13)}</a>
              </div>
            </div>
            <div class="coach-orb">
              <div class="orb-ring orb-ring--outer"></div>
              <div class="orb-ring orb-ring--inner"></div>
              <div class="orb-core" style="--accent:${sport.color}">${icon(sport.icon, 48)}</div>
              <span class="orb-tag orb-tag--1">热身 8′</span>
              <span class="orb-tag orb-tag--2">主课 ${session.duration}′</span>
              <span class="orb-tag orb-tag--3">放松 5′</span>
            </div>
          </div>
          <div class="coach-reason">${icon('info', 14)} <span>${guidance.reason}</span></div>
          ${guidance.insights?.length ? `<div class="coach-insights">
            ${guidance.insights.slice(0, 3).map((text) => `<span>${icon('spark', 11)}${esc(text)}</span>`).join('')}
          </div>` : ''}
          <div class="coach-tips">
            ${session.tips.map((tip, i) => `<span><em>0${i + 1}</em>${tip}</span>`).join('')}
          </div>
        </article>

        <aside class="week-card">
          <div class="panel-head">
            <div><span class="eyebrow">THIS WEEK</span><h3>本周训练</h3></div>
            <span class="week-status ${snap.minutes >= guidance.target ? 'done' : ''}">${snap.minutes >= guidance.target ? '已达标' : '进行中'}</span>
          </div>
          <div class="week-ring-wrap">
            ${progressRing({ size: 178, stroke: 10, progress: guidance.progress, color: goal.accent })}
            <div class="week-ring-center">
              <strong>${Math.round(snap.minutes)}</strong>
              <span>/ ${guidance.target} 分钟</span>
            </div>
          </div>
          <div class="week-split">
            <div><span>训练次数</span><strong>${snap.sessions} <em>/ ${user.freq} 次</em></strong></div>
            <div><span>运动天数</span><strong>${snap.days} <em>天</em></strong></div>
          </div>
          <div class="week-foot">
            <span>${guidance.remaining > 0 ? `距离目标还差 ${Math.round(guidance.remaining)} 分钟` : '已达成本周训练目标'}</span>
            <span class="week-pct">${Math.round(guidance.progress * 100)}%</span>
          </div>
        </aside>
      </div>

      <div class="stat-grid">
        <article class="stat-card">
          <div class="stat-head"><span>当前体重</span><div class="stat-head-actions"><button type="button" class="stat-ico stat-ico--button" data-action="add-weight" aria-label="记录体重">${icon('plus', 14)}</button><span class="stat-ico">${icon('body', 17)}</span></div></div>
          <div class="stat-value">${currentWeight ? fmtNumber(currentWeight, 1) : '—'} <em>kg</em></div>
          <div class="stat-foot">
            ${trend == null ? '<span class="muted">再记录一次即可看到变化</span>' : `<span class="delta ${trend <= 0 ? 'good' : 'warn'}">${trend > 0 ? '+' : ''}${trend.toFixed(1)} kg</span><span>较 30 天前</span>`}
          </div>
          <div class="stat-spark">${weightSeries.length >= 2 ? sparkline(weightSeries, '#CCF56B', { width: 240, height: 40 }) : `<div class="spark-empty"></div>`}</div>
        </article>

        <article class="stat-card">
          <div class="stat-head"><span>BMI 指数</span><span class="stat-ico">${icon('target', 17)}</span></div>
          <div class="stat-value">${bmi ? bmi.toFixed(1) : '—'} <em>${bmi ? bmiMeta.label : ''}</em></div>
          <div class="bmi-meter">
            ${[0, 1, 2, 3, 4].map((i) => `<i class="${bmiMeta.index === i ? 'on' : ''} seg-${i}"></i>`).join('')}
          </div>
          <div class="stat-foot"><span>身高 ${user.height} cm</span><span>健康区间 18.5–23.9</span></div>
        </article>

        <article class="stat-card">
          <div class="stat-head"><span>本周消耗</span><span class="stat-ico">${icon('flame', 17)}</span></div>
          <div class="stat-value">${fmtNumber(snap.calories)} <em>kcal</em></div>
          <div class="stat-foot">
            ${calorieDelta == null ? '<span class="muted">暂无上周数据</span>' : `<span class="delta ${calorieDelta >= 0 ? 'good' : 'warn'}">${calorieDelta >= 0 ? '+' : ''}${calorieDelta}%</span><span>较上周</span>`}
          </div>
          <div class="stat-spark">${sparkline(lastWeeks(state.activities, 8).map((w) => w.calories), '#F7C95C', { width: 240, height: 40 })}</div>
        </article>

        <article class="stat-card">
          <div class="stat-head"><span>连续运动</span><span class="stat-ico">${icon('spark', 17)}</span></div>
          <div class="stat-value">${guidance.streak} <em>天</em></div>
          <div class="stat-foot"><span>本周已运动 ${snap.days} 天</span><span>${guidance.streak >= 3 ? '状态正热' : guidance.streak >= 1 ? '保持节奏' : '从今天开始'}</span></div>
          <div class="streak-days">
            ${Array.from({ length: 7 }).map((_, i) => {
              const d = addDays(dateKeyToDate(weekRange().start), i);
              const done = state.activities.some((a) => a.date === dateKey(d));
              return `<span class="${done ? 'done' : ''} ${dateKey(d) === todayKey() ? 'today' : ''}">${'一二三四五六日'[i]}</span>`;
            }).join('')}
          </div>
        </article>
      </div>

      ${renderCalendar(guidance)}

      <section class="section-block">
        <div class="section-head">
          <div><span class="eyebrow">SPORTS LIBRARY</span><h2>运动板块</h2><p>各项目的累计里程、训练次数与最近状态</p></div>
          <a class="text-link" href="#/records" data-action="navigate" data-route="records">全部记录 ${icon('arrow', 15)}</a>
        </div>
        <div class="sport-grid">
          ${SPORT_KEYS.map((key) => renderSportCard(key)).join('')}
        </div>
      </section>

      <div class="dashboard-bottom">
        <article class="panel chart-panel">
          <div class="panel-head">
            <div><span class="eyebrow">TRAINING LOAD</span><h3>周训练量</h3></div>
            <div class="chart-legend"><i class="legend-line"></i> 目标 ${guidance.target} 分钟</div>
          </div>
          <div class="chart-wrap">${state.activities.length ? barChart({
            values: lastWeeks(state.activities, 8).map((w) => w.minutes),
            labels: lastWeeks(state.activities, 8).map((w) => `${parseDate(w.start).getMonth() + 1}/${parseDate(w.start).getDate()}`),
            target: guidance.target,
            color: '#CCF56B',
            height: 240
          }) : `<div class="chart-empty chart-empty--tall">
            <span>${icon('chart', 30)}</span>
            <p>完成第一次运动后，这里会长出你的训练曲线</p>
            <button class="btn btn-ghost btn-sm" data-action="add-record">记录第一笔 ${icon('arrow', 14)}</button>
          </div>`}</div>
        </article>

        <article class="panel recent-panel">
          <div class="panel-head">
            <div><span class="eyebrow">RECENT ACTIVITY</span><h3>最近记录</h3></div>
            <a class="text-link" href="#/records" data-action="navigate" data-route="records">查看全部 ${icon('chevron', 13)}</a>
          </div>
          <div class="recent-list">
            ${state.activities.length
              ? sortActivities(state.activities).slice(0, 4).map((a) => renderRecentRow(a)).join('')
              : `<div class="mini-empty">${icon('list', 26)}<p>还没有运动记录</p><button class="text-link" data-action="add-record">添加第一条 ${icon('arrow', 14)}</button></div>`}
          </div>
        </article>
      </div>
    </div>`;
}


function renderCalendar(guidance) {
  const data = heatmapData(state.activities, state.user, 12);
  const load = guidance.load;
  const ratioPct = clamp((load.ratio / 2) * 100, 0, 100);

  if (!state.activities.length) {
    return `
      <article class="panel calendar-panel calendar-panel--empty">
        <div class="panel-head calendar-head">
          <div><span class="eyebrow">TRAINING CALENDAR</span><h3>训练日历</h3></div>
          <span class="panel-note">过去 12 周</span>
        </div>
        <div class="calendar-empty">
          <span class="calendar-empty-icon">${icon('calendar', 25)}</span>
          <div><strong>训练日历从第一条记录开始</strong><p>记录之后，这里会用颜色显示每天的运动量与主项；点击日期可以回看当天训练。</p></div>
          <button class="btn btn-ghost btn-sm" data-action="add-record">${icon('plus', 15)} 记录第一次</button>
        </div>
      </article>`;
  }
  const cells = data.weeks.map((week) => `
    <div class="heatmap-week">
      ${week.days.map((day) => {
        const bg = day.level
          ? hexToRgba(day.color || '#CCF56B', 0.16 + day.level * 0.19)
          : 'rgba(255, 255, 255, 0.04)';
        const title = day.sessions
          ? `${fmtDate(day.key)} · ${day.sessions} 次 · ${Math.round(day.minutes)} 分钟`
          : `${fmtDate(day.key)} · 休息日`;
        return `<button class="heat-cell ${day.level ? 'has-load' : ''} ${day.isToday ? 'today' : ''} ${day.future ? 'future' : ''}"
          style="background:${bg}" title="${title}" ${day.future ? 'disabled' : ''}
          data-action="open-day" data-date="${day.key}" aria-label="${title}"></button>`;
      }).join('')}
    </div>`).join('');

  return `
    <article class="panel calendar-panel">
      <div class="panel-head calendar-head">
        <div><span class="eyebrow">TRAINING CALENDAR</span><h3>训练日历</h3></div>
        <div class="calendar-head-meta">
          <span class="load-pill tone-${load.status.tone}">${load.status.label}</span>
          <span class="panel-note">过去 12 周 · 颜色为主项</span>
        </div>
      </div>
      <div class="calendar-body">
        <div class="calendar-heat">
          <div class="heatmap-months">${data.weeks.map((w) => `<span>${w.label}</span>`).join('')}</div>
          <div class="heatmap-body">
            <div class="heatmap-weekdays">${['一', '二', '三', '四', '五', '六', '日'].map((d) => `<span>${d}</span>`).join('')}</div>
            <div class="heatmap-grid">${cells}</div>
          </div>
        </div>
        <div class="calendar-side">
          <div class="calendar-stats">
            <div><span>运动天数</span><strong>${data.activeDays}<em> / 84 天</em></strong></div>
            <div><span>累计时长</span><strong>${Math.round(data.totalMinutes / 60)}<em> 小时</em></strong></div>
            <div><span>ACWR</span><strong>${load.ratio ? load.ratio.toFixed(2) : '—'}<em> 负荷比</em></strong></div>
          </div>
          <div class="load-mini">
            <div class="load-mini-head">
              <span>近 7 天负荷</span>
              <strong>${fmtNumber(load.acute)} <em>周均 ${fmtNumber(load.chronic)}</em></strong>
            </div>
            <div class="load-meter"><i style="width:${ratioPct}%"></i><span style="left:${ratioPct}%"></span></div>
            <p>${load.status.desc}</p>
          </div>
          <div class="heat-legend">
            <span>少</span>${[0, 1, 2, 3, 4].map((l) => `<i style="background:${l ? hexToRgba('#CCF56B', 0.16 + l * 0.19) : 'rgba(255,255,255,.04)'}"></i>`).join('')}<span>多</span>
            <em>颜色深浅 = 训练量</em>
          </div>
        </div>
      </div>
    </article>`;
}

function openDayModal(date) {
  const list = sortActivities(state.activities.filter((a) => a.date === date));
  const minutes = list.reduce((sum, a) => sum + (a.duration || 0), 0);
  const calories = list.reduce((sum, a) => sum + activityCalories(a, state.user), 0);
  openModal(`
    ${modalHead('DAY DETAIL', `${fmtDate(date, 'long')}`, `周${weekdayCN(date)} · ${list.length ? `${list.length} 次训练 · ${fmtDuration(minutes)} · ${fmtNumber(calories)} kcal` : '这一天没有训练记录'}`)}
    ${list.length ? `<div class="day-list">
      ${list.map((a) => {
        const sport = SPORTS[a.type] || SPORTS.other;
        return `<button class="day-row" data-action="open-record" data-id="${a.id}">
          <span class="recent-icon" style="--sport:${sport.color}">${icon(sport.icon, 19)}</span>
          <span class="day-row-main"><strong>${sport.label}</strong><em>${fmtDuration(a.duration)}${activityDistance(a) ? ` · ${fmtDistance(a.distance)}` : ''} · RPE ${activityRpe(a)}</em></span>
          <span class="day-row-load">${fmtNumber(sessionLoad(a))}<em>负荷</em></span>
          ${icon('chevron', 14)}
        </button>`;
      }).join('')}
    </div>` : `<div class="day-empty">
      <span>${icon('moon', 24)}</span>
      <p>休息也是训练的一部分。如果这天其实动过，可以补一条记录。</p>
    </div>`}
    <div class="modal-actions">
      <button class="btn btn-ghost" data-action="add-day" data-date="${date}">${icon('plus', 15)} 记录这一天</button>
      <button class="btn btn-primary" data-action="close-modal">完成</button>
    </div>`, 'modal--detail');
}

function dateKeyToDate(key) {
  return parseDate(key);
}

function lastWeeks(activities, n) {
  return Array.from({ length: n }).map((_, i) => weeklySnapshot(activities, state.user, i - (n - 1)));
}

function renderSportCard(key) {
  const sport = SPORTS[key];
  const list = sortActivities(state.activities.filter((a) => a.type === key));
  const totalMinutes = list.reduce((s, a) => s + (a.duration || 0), 0);
  const totalDistance = list.reduce((s, a) => s + activityDistance(a), 0);
  const week = weeklySnapshot(state.activities, state.user);
  const weekList = week.list.filter((a) => a.type === key);
  const series = Array.from({ length: 8 }).map((_, i) => {
    const snap = weeklySnapshot(state.activities, state.user, i - 7);
    return sport.metric === 'distance'
      ? snap.list.filter((a) => a.type === key).reduce((s, a) => s + activityDistance(a), 0)
      : snap.list.filter((a) => a.type === key).reduce((s, a) => s + (a.duration || 0), 0);
  });
  const last = list[0];
  const isDistance = sport.metric === 'distance';
  const mainValue = isDistance
    ? fmtNumber(totalDistance, totalDistance >= 100 ? 0 : 1)
    : fmtNumber(totalMinutes / 60, 1);
  const weekMetric = isDistance
    ? weekList.reduce((s, a) => s + activityDistance(a), 0)
    : weekList.reduce((s, a) => s + (a.duration || 0), 0);

  return `
    <button class="sport-card" style="--sport:${sport.color}" data-action="open-sport" data-sport="${key}">
      <div class="sport-card-top">
        <span class="sport-card-icon">${icon(sport.icon, 24)}</span>
        <span class="sport-count">${list.length} 次</span>
      </div>
      <div class="sport-card-name">
        <h3>${sport.label}</h3>
        <span>${sport.en}</span>
      </div>
      <div class="sport-card-value">
        <strong>${mainValue}</strong>
        <span>${isDistance ? 'km 累计' : '小时 累计'}</span>
      </div>
      <div class="sport-card-spark">
        ${list.length ? sparkline(series, sport.color, { width: 250, height: 46 }) : '<div class="spark-empty spark-empty--card"></div>'}
        <span>近 8 周</span>
      </div>
      <div class="sport-card-foot">
        <span>本周 ${weekList.length} 次${weekMetric ? ` · ${isDistance ? fmtDistance(weekMetric) : fmtDuration(weekMetric)}` : ''}</span>
        <span>${last ? relativeDay(last.date) : '暂无记录'}</span>
      </div>
    </button>`;
}

function strengthStats(activity) {
  const list = Array.isArray(activity?.strength) ? activity.strength : [];
  const sets = list.reduce((sum, ex) => sum + (Number(ex.sets) || 0), 0);
  const volume = list.reduce((sum, ex) => sum + (Number(ex.sets) || 0) * (Number(ex.reps) || 0) * (Number(ex.weight) || 0), 0);
  const parts = [...new Set(list.map((ex) => STRENGTH_PART_LABELS[ex.part] || '全身'))];
  return { list, sets, volume, parts };
}

function renderRecentRow(activity) {
  const sport = SPORTS[activity.type] || SPORTS.other;
  const meta = [fmtDuration(activity.duration)];
  if (activityDistance(activity) > 0) meta.push(fmtDistance(activity.distance));
  const strength = strengthStats(activity);
  if (strength.list.length) {
    meta.push(strength.parts.join('/'));
    if (strength.volume) meta.push(`${fmtNumber(strength.volume)} kg`);
  }
  return `
    <div class="recent-row" data-action="open-record" data-id="${activity.id}">
      <span class="recent-icon" style="--sport:${sport.color}">${icon(sport.icon, 20)}</span>
      <div class="recent-main">
        <strong>${sport.label}</strong>
        <span>${relativeDay(activity.date)} · ${meta.join(' · ')}</span>
      </div>
      <span class="recent-source">${SOURCE_LABELS[activity.source] || '记录'}</span>
      <span class="recent-arrow">${icon('chevron', 14)}</span>
    </div>`;
}

/* ---------------- 运动记录 ---------------- */

function renderRecords() {
  const all = state.activities;
  const filtered = all.filter((a) => {
    if (state.recordSport !== 'all' && a.type !== state.recordSport) return false;
    if (state.recordSource !== 'all' && a.source !== state.recordSource) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));
  const visible = filtered.slice(0, state.recordsLimit);

  const totalMinutes = all.reduce((s, a) => s + (a.duration || 0), 0);
  const totalDistance = all.reduce((s, a) => s + activityDistance(a), 0);
  const totalCalories = all.reduce((s, a) => s + activityCalories(a, state.user), 0);
  const sourceOptions = [
    ['all', '全部来源'], ['manual', '手动录入'], ['fit', 'FIT 文件'], ['gpx', 'GPX 轨迹'],
    ['tcx', 'TCX 文件'], ['csv', 'CSV 导入'], ['json', 'JSON 导入']
  ];

  return `
    <div class="records-view">
      <div class="page-head">
        <div>
          <span class="eyebrow">TRAINING LOG</span>
          <h1>运动记录</h1>
          <p>${all.length ? `累计 ${all.length} 条记录 · 最近更新 ${relativeDay(all[0]?.date)}` : '每一次运动，都值得被记住。'}</p>
        </div>
        <div class="head-actions">
          <button class="btn btn-ghost" data-action="open-import">${icon('upload', 17)} 导入文件</button>
          <button class="btn btn-primary" data-action="add-record">${icon('plus', 17)} 手动录入</button>
        </div>
      </div>

      <div class="summary-strip">
        <div><span>总记录</span><strong>${all.length}<em> 次</em></strong></div>
        <div><span>累计时长</span><strong>${Math.round(totalMinutes / 60)}<em> 小时</em></strong></div>
        <div><span>累计距离</span><strong>${fmtNumber(totalDistance, totalDistance >= 100 ? 0 : 1)}<em> km</em></strong></div>
        <div><span>累计消耗</span><strong>${fmtNumber(totalCalories)}<em> kcal</em></strong></div>
      </div>

      <div class="filter-bar">
        <div class="filter-chips">
          <button class="chip ${state.recordSport === 'all' ? 'active' : ''}" data-action="filter-sport" data-sport="all">全部</button>
          ${SPORT_KEYS.map((key) => `<button class="chip ${state.recordSport === key ? 'active' : ''}" data-action="filter-sport" data-sport="${key}"><i style="background:${SPORTS[key].color}"></i>${SPORTS[key].label}</button>`).join('')}
          <button class="chip ${state.recordSport === 'other' ? 'active' : ''}" data-action="filter-sport" data-sport="other">其他</button>
        </div>
        <div class="select-wrap select-wrap--sm">
          <select id="source-filter" aria-label="按来源筛选">
            ${sourceOptions.map(([value, label]) => `<option value="${value}" ${state.recordSource === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
          ${icon('down', 14)}
        </div>
      </div>

      ${filtered.length ? `
        <div class="records-table">
          <div class="records-head">
            <span>日期</span><span>运动</span><span>时长</span><span>距离</span><span>消耗</span><span>平均心率</span><span>来源</span><span></span>
          </div>
          ${visible.map((a) => renderRecordRow(a)).join('')}
        </div>
        ${filtered.length > visible.length ? `
          <div class="records-more">
            <span>已显示 ${visible.length} / ${filtered.length} 条记录</span>
            <button class="btn btn-ghost btn-sm" data-action="load-more-records">加载更多 ${icon('down', 15)}</button>
          </div>` : ''}
      ` : `
        <div class="empty-state">
          <span class="empty-icon">${icon('list', 32)}</span>
          <h3>${all.length ? '这个筛选下还没有记录' : '开始记录你的第一次运动'}</h3>
          <p>${all.length ? '换一个运动类型或来源看看。' : '手动填写一次训练，或上传手表导出的 FIT / GPX 文件。'}</p>
          <div class="empty-actions">
            <button class="btn btn-primary btn-sm" data-action="add-record">${icon('plus', 15)} 手动录入</button>
            <button class="btn btn-ghost btn-sm" data-action="open-import">${icon('upload', 15)} 导入文件</button>
            ${!all.length && api.mode !== 'supabase' ? `<button class="text-link" data-action="load-sample">载入示例数据</button>` : ''}
          </div>
        </div>
      `}
    </div>`;
}

function renderRecordRow(a) {
  const sport = SPORTS[a.type] || SPORTS.other;
  const strength = strengthStats(a);
  const subline = [a.startTime, strength.list.length ? strength.parts.join('/') : '', a.notes ? `${esc(a.notes.slice(0, 14))}${a.notes.length > 14 ? '…' : ''}` : ''].filter(Boolean).join(' · ') || '—';
  return `
    <div class="record-row" data-action="open-record" data-id="${a.id}">
      <span class="record-date"><strong>${fmtDate(a.date, 'md')}</strong><em>周${weekdayCN(a.date)}</em></span>
      <span class="record-sport">
        <i class="record-sport-icon" style="--sport:${sport.color}">${icon(sport.icon, 18)}</i>
        <span><strong>${sport.label}</strong><em>${subline}</em></span>
      </span>
      <span class="record-cell" data-label="时长">${fmtDuration(a.duration)}</span>
      <span class="record-cell" data-label="距离">${activityDistance(a) ? fmtDistance(a.distance) : '—'}</span>
      <span class="record-cell" data-label="消耗">${fmtNumber(activityCalories(a, state.user))} kcal</span>
      <span class="record-cell" data-label="心率">${a.avgHr ? `${a.avgHr} bpm` : '—'}</span>
      <span class="record-badge">${SOURCE_LABELS[a.source] || '记录'}</span>
      <button class="record-del" data-action="delete-record" data-id="${a.id}" aria-label="删除记录">${icon('trash', 16)}</button>
    </div>`;
}

/* ---------------- 数据分析 ---------------- */

function renderAnalytics() {
  const weeks = state.analyticsWeeks;
  const rangeStart = dateKey(addDays(new Date(), -weeks * 7));
  const list = state.activities.filter((a) => a.date >= rangeStart);
  const weekData = lastWeeks(state.activities, weeks);
  const weightLogs = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const sampled = sampleLogs(weightLogs, 12);
  const currentWeight = latestWeight(state.user, state.weights);
  const bmi = bmiOf({ ...state.user, weight: currentWeight });
  const bmiMeta = bmiInfo(bmi);
  const plan = caloriePlan(state.user);
  const balance = trainingBalance(list, state.user);
  const load = trainingLoad(state.activities, state.user);
  const loadColor = { lime: '#CCF56B', amber: '#F7C95C', coral: '#FF8B68', blue: '#7FB0FF', muted: '#69766d' }[load.status.tone] || '#CCF56B';
  const bests = personalBests(state.activities, state.user);
  const bestWeek = Array.from({ length: 12 }).map((_, i) => weeklySnapshot(state.activities, state.user, i - 11))
    .sort((a, b) => b.minutes - a.minutes)[0];
  const totalMinutes = list.reduce((s, a) => s + (a.duration || 0), 0);
  const totalDistance = list.reduce((s, a) => s + activityDistance(a), 0);
  const avgSessions = (list.length / weeks).toFixed(1);

  const typeStats = ALL_SPORT_KEYS.map((key) => ({
    key,
    label: SPORTS[key].label,
    color: SPORTS[key].color,
    value: list.filter((a) => a.type === key).reduce((s, a) => s + (a.duration || 0), 0)
  })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  const typeTotal = typeStats.reduce((s, x) => s + x.value, 0) || 1;
  const partMap = new Map();
  for (const a of list) {
    for (const ex of (Array.isArray(a.strength) ? a.strength : [])) {
      const part = STRENGTH_PART_LABELS[ex.part] || '全身';
      const cur = partMap.get(part) || { part, sets: 0, volume: 0 };
      cur.sets += Number(ex.sets) || 0;
      cur.volume += (Number(ex.sets) || 0) * (Number(ex.reps) || 0) * (Number(ex.weight) || 0);
      partMap.set(part, cur);
    }
  }
  const partStats = [...partMap.values()].sort((a, b) => b.sets - a.sets);
  const partTotal = partStats.reduce((s, x) => s + x.sets, 0) || 1;
  const strengthPartBlock = partStats.length ? `
    <article class="panel chart-panel span-2">
      <div class="panel-head">
        <div><span class="eyebrow">STRENGTH MAP</span><h3>力量训练部位</h3></div>
        <span class="panel-note">近 ${weeks} 周 · 按组数</span>
      </div>
      <div class="part-bars">
        ${partStats.map((p) => `<div class="part-bar-row">
          <span>${p.part}</span>
          <div class="part-bar"><i style="width:${(p.sets / partTotal) * 100}%"></i></div>
          <strong>${p.sets} 组</strong>
          <em>${p.volume ? `${fmtNumber(p.volume)} kg` : '自重'}</em>
        </div>`).join('')}
      </div>
      <p class="balance-tip">${icon('info', 14)} 按动作所属部位累计训练组数；训练容量 = 组数 × 次数 × 重量。</p>
    </article>` : '';

  return `
    <div class="analytics-view">
      <div class="page-head">
        <div>
          <span class="eyebrow">ANALYTICS</span>
          <h1>读懂你的身体</h1>
          <p>趋势比单次数字更重要，看看最近 ${weeks} 周发生了什么。</p>
        </div>
        <div class="select-wrap select-wrap--range">
          <select id="analytics-range" aria-label="选择统计周期">
            <option value="8" ${weeks === 8 ? 'selected' : ''}>近 8 周</option>
            <option value="12" ${weeks === 12 ? 'selected' : ''}>近 12 周</option>
          </select>
          ${icon('down', 15)}
        </div>
      </div>

      <div class="stat-grid stat-grid--compact">
        <article class="mini-stat"><span>训练次数</span><strong>${list.length}<em> 次</em></strong><small>平均每周 ${avgSessions} 次</small></article>
        <article class="mini-stat"><span>训练时长</span><strong>${Math.round(totalMinutes / 60)}<em> 小时</em></strong><small>共 ${fmtNumber(totalMinutes)} 分钟</small></article>
        <article class="mini-stat"><span>累计距离</span><strong>${fmtNumber(totalDistance, 1)}<em> km</em></strong><small>${bests.longest ? `单次最长 ${fmtDistance(bests.longest.distance)}` : '暂无距离记录'}</small></article>
        <article class="mini-stat"><span>运动类型</span><strong>${bests.typeCount}<em> 种</em></strong><small>${bests.typeCount >= 3 ? '训练结构很丰富' : '可尝试更多项目'}</small></article>
      </div>

      <article class="load-banner">
        <div class="load-banner-main">
          <div class="load-banner-head">
            <span class="eyebrow">LOAD &amp; RECOVERY</span>
            <span class="load-pill tone-${load.status.tone}">${load.status.label}</span>
          </div>
          <h3>训练负荷<span>ACWR ${load.ratio ? load.ratio.toFixed(2) : '—'}</span></h3>
          <p>${load.status.desc}</p>
          <div class="load-metrics">
            <div><span>近 7 天负荷</span><strong>${fmtNumber(load.acute)}</strong><em>${load.acuteSessions} 次训练</em></div>
            <div><span>4 周周均负荷</span><strong>${fmtNumber(load.chronic)}</strong><em>慢性负荷</em></div>
            <div><span>负荷比 ACWR</span><strong style="color:${loadColor}">${load.ratio ? load.ratio.toFixed(2) : '—'}</strong><em>0.8–1.3 为合理</em></div>
          </div>
        </div>
        <div class="load-banner-side">
          <div class="load-bars-head"><span>近 8 周负荷</span><em>本周 ${fmtNumber(load.weeklyLoads[load.weeklyLoads.length - 1] || 0)}</em></div>
          <div class="load-bars">${miniBars(load.weeklyLoads, loadColor, { width: 360, height: 78 })}</div>
          <div class="acwr-scale">
            <div class="acwr-track"><i style="width:40%"></i><i style="width:25%"></i><i style="width:10%"></i><i style="width:25%"></i></div>
            <span class="acwr-marker" style="left:${clamp((load.ratio / 2) * 100, 1, 99)}%"></span>
            <div class="acwr-labels"><span>0.8</span><span>1.3</span><span>1.5</span><span>2.0</span></div>
          </div>
        </div>
      </article>

      <div class="analytics-grid">
        <article class="panel chart-panel span-2">
          <div class="panel-head">
            <div><span class="eyebrow">VOLUME</span><h3>每周训练量</h3></div>
            <span class="panel-note">单位：分钟</span>
          </div>
          <div class="chart-wrap">${barChart({
            values: weekData.map((w) => w.minutes),
            labels: weekData.map((w) => `${parseDate(w.start).getMonth() + 1}/${parseDate(w.start).getDate()}`),
            target: weeklyTargetMinutes(state.user),
            color: '#CCF56B',
            height: 260
          })}</div>
        </article>

        <article class="panel">
          <div class="panel-head">
            <div><span class="eyebrow">DISTRIBUTION</span><h3>运动分布</h3></div>
          </div>
          ${typeStats.length ? `
            <div class="donut-zone">
              <div class="donut" style="background:${conicGradient(typeStats.map((t) => ({ color: t.color, value: t.value })))}">
                <div class="donut-hole"><strong>${Math.round(totalMinutes / 60)}</strong><span>小时</span></div>
              </div>
              <div class="donut-legend">
                ${typeStats.map((t) => `<div><i style="background:${t.color}"></i><span>${t.label}</span><em>${Math.round((t.value / typeTotal) * 100)}%</em></div>`).join('')}
              </div>
            </div>` : `<div class="chart-empty">还没有足够的运动数据</div>`}
        </article>

        <article class="panel chart-panel span-2">
          <div class="panel-head">
            <div><span class="eyebrow">BODY WEIGHT</span><h3>体重趋势</h3></div>
            <div class="weight-now">
              <span>当前</span><strong>${currentWeight ? currentWeight.toFixed(1) : '—'} <em>kg</em></strong>
              <span class="pill pill--sm ${bmiMeta.tone === 'lime' ? 'pill--lime' : ''}">BMI ${bmi ? bmi.toFixed(1) : '—'} · ${bmiMeta.label}</span>
              <button type="button" class="text-link" data-action="add-weight">${icon('plus', 12)} 记录</button>
            </div>
          </div>
          <div class="chart-wrap">${lineChart({
            values: sampled.map((w) => Number(w.kg)),
            labels: sampled.map((w) => `${parseDate(w.date).getMonth() + 1}/${parseDate(w.date).getDate()}`),
            color: '#63E3CE',
            height: 260,
            unit: 'kg'
          })}</div>
        </article>

        <article class="panel">
          <div class="panel-head">
            <div><span class="eyebrow">BALANCE</span><h3>训练结构</h3></div>
          </div>
          <div class="balance-list">
            <div class="balance-item">
              <div><span><i style="background:#CCF56B"></i>有氧训练</span><strong>${balance.aerobicPct}%</strong></div>
              <div class="balance-bar"><i style="width:${balance.aerobicPct}%;background:#CCF56B"></i></div>
              <small>${Math.round(balance.aerobic)} 分钟</small>
            </div>
            <div class="balance-item">
              <div><span><i style="background:#FF8B68"></i>力量训练</span><strong>${balance.strengthPct}%</strong></div>
              <div class="balance-bar"><i style="width:${balance.strengthPct}%;background:#FF8B68"></i></div>
              <small>${Math.round(balance.strength)} 分钟</small>
            </div>
            <div class="balance-item">
              <div><span><i style="background:#C7ABFF"></i>恢复活动</span><strong>${balance.mobilityPct}%</strong></div>
              <div class="balance-bar"><i style="width:${balance.mobilityPct}%;background:#C7ABFF"></i></div>
              <small>${Math.round(balance.mobility)} 分钟</small>
            </div>
          </div>
          <p class="balance-tip">${icon('info', 14)} 建议有氧与力量保持约 6:4，恢复活动占 10% 左右。</p>
        </article>

        ${strengthPartBlock}

        <article class="panel span-2">
          <div class="panel-head">
            <div><span class="eyebrow">PERSONAL BEST</span><h3>个人最佳</h3></div>
            <span class="panel-note">全部时间</span>
          </div>
          <div class="pb-grid">
            <div class="pb-card"><span>${icon('distance', 18)} 单次最长距离</span><strong>${bests.longest ? fmtNumber(bests.longest.distance, 2) : '—'} <em>km</em></strong><small>${bests.longest ? `${SPORTS[bests.longest.type].label} · ${fmtDate(bests.longest.date)}` : '暂无记录'}</small></div>
            <div class="pb-card"><span>${icon('clock', 18)} 单次最长时间</span><strong>${bests.longestTime ? Math.round(bests.longestTime.duration) : '—'} <em>分钟</em></strong><small>${bests.longestTime ? `${SPORTS[bests.longestTime.type].label} · ${fmtDate(bests.longestTime.date)}` : '暂无记录'}</small></div>
            <div class="pb-card"><span>${icon('flame', 18)} 单次最大消耗</span><strong>${bests.burn ? fmtNumber(activityCalories(bests.burn, state.user)) : '—'} <em>kcal</em></strong><small>${bests.burn ? `${SPORTS[bests.burn.type].label} · ${fmtDate(bests.burn.date)}` : '暂无记录'}</small></div>
            <div class="pb-card"><span>${icon('chart', 18)} 最佳周训练量</span><strong>${bestWeek ? Math.round(bestWeek.minutes) : '—'} <em>分钟</em></strong><small>${bestWeek ? `${fmtDate(bestWeek.start, 'md')} – ${fmtDate(bestWeek.end, 'md')}` : '暂无记录'}</small></div>
          </div>
        </article>

        <article class="panel">
          <div class="panel-head">
            <div><span class="eyebrow">NUTRITION</span><h3>每日营养</h3></div>
          </div>
          ${plan ? `
            <div class="nutrition-list">
              <div><span>基础代谢 BMR</span><strong>${fmtNumber(plan.bmr)} <em>kcal</em></strong></div>
              <div><span>每日总消耗 TDEE</span><strong>${fmtNumber(plan.tdee)} <em>kcal</em></strong></div>
              <div class="highlight"><span>目标摄入</span><strong>${fmtNumber(plan.target)} <em>kcal</em></strong></div>
              <div><span>蛋白质</span><strong>${plan.protein} <em>g</em></strong></div>
              <div><span>碳水 / 脂肪</span><strong>${plan.carbs} / ${plan.fat} <em>g</em></strong></div>
            </div>
            <p class="balance-tip">${icon('info', 14)} 数值基于年龄段与训练频率估算，仅作参考。</p>` : ''}
        </article>
      </div>
    </div>`;
}

function sampleLogs(logs, n) {
  if (logs.length <= n) return logs;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push(logs[Math.round((i / (n - 1)) * (logs.length - 1))]);
  }
  return out;
}

/* ---------------- 运动指引 ---------------- */

function renderGuidance(guidance) {
  const user = state.user;
  const goal = guidance.goal;
  const calorie = guidance.calorie;
  const session = guidance.session;
  const sport = SPORTS[session.type] || SPORTS.other;
  const zones = guidance.zones;
  const doneDates = new Set(state.activities.map((a) => a.date));
  const plan = buildWeekPlan(user).map((day) => day.isToday ? {
    ...day,
    type: session.type,
    title: session.short,
    duration: session.duration,
    color: sport.color,
    isRecommendation: true
  } : day);

  const principles = [
    { icon: 'target', title: '80 / 20 强度分配', text: '80% 的训练时间保持轻松有氧，20% 用于高质量强度课。低强度不是偷懒，是让高强度更有效。' },
    { icon: 'dumbbell', title: '力量是长期底牌', text: '每周至少两次力量训练，优先深蹲、硬拉、推举、划船等复合动作。肌肉量决定基础代谢与运动寿命。' },
    { icon: 'moon', title: '恢复发生在训练之外', text: '睡眠 7–9 小时、蛋白质分配到每餐、每周至少 1 个完全休息日。身体是在恢复中变强的。' },
    { icon: 'droplet', title: '补水与电解质', text: '训练前 2 小时补水 400–600ml；超过 60 分钟的训练，注意补充钠与电解质。' }
  ];

  return `
    <div class="guidance-view">
      <div class="page-head">
        <div>
          <span class="eyebrow">COACHING</span>
          <h1>你的运动蓝图</h1>
          <p>围绕「${goal.label}」生成，随着记录持续更新。</p>
        </div>
        <div class="head-actions">
          <span class="pill pill--goal">${icon(goal.icon, 14)} ${goal.label}</span>
          <a class="btn btn-ghost" href="#/profile" data-action="navigate" data-route="profile">调整目标 ${icon('edit', 15)}</a>
        </div>
      </div>

      <section class="blueprint">
        <div class="blueprint-main">
          <span class="eyebrow">YOUR BLUEPRINT</span>
          <h2>每周 ${guidance.target} 分钟，<br>把目标拆成今天的一小步。</h2>
          <p>${guidance.reason}</p>
          ${guidance.insights?.length ? `<div class="guidance-insights">
            ${guidance.insights.slice(0, 3).map((text) => `<span>${icon('spark', 11)}${esc(text)}</span>`).join('')}
          </div>` : ''}
          <div class="blueprint-load">
            <span class="load-pill tone-${guidance.load.status.tone}">${guidance.load.status.label}</span>
            <span>近 7 天负荷 ${fmtNumber(guidance.load.acute)}，4 周周均 ${fmtNumber(guidance.load.chronic)}</span>
          </div>
          <div class="blueprint-stats">
            <div><span>每周训练</span><strong>${guidance.target} <em>分钟</em></strong></div>
            <div><span>训练频率</span><strong>${user.freq} <em>次</em></strong></div>
            <div><span>目标摄入</span><strong>${calorie ? calorie.target : '—'} <em>kcal</em></strong></div>
            <div><span>蛋白质</span><strong>${calorie ? calorie.protein : '—'} <em>g</em></strong></div>
          </div>
        </div>
        <div class="blueprint-side">
          <span class="eyebrow">HEART RATE ZONES</span>
          <div class="zones">
            <div><span><i style="background:#7FB0FF"></i>Z1 恢复</span><strong>${zones.z1}</strong></div>
            <div class="active"><span><i style="background:#CCF56B"></i>Z2 有氧</span><strong>${zones.z2}</strong></div>
            <div><span><i style="background:#F7C95C"></i>Z3 节奏</span><strong>${zones.z3}</strong></div>
            <div><span><i style="background:#FF8B68"></i>Z4 阈值</span><strong>${zones.z4}</strong></div>
          </div>
          <small>最大心率估算 ${zones.max} bpm</small>
        </div>
      </section>

      <div class="guidance-grid">
        <article class="today-session" style="--accent:${sport.color}">
          <div class="panel-head">
            <div><span class="eyebrow">NEXT SESSION</span><h3>今天练什么</h3></div>
            <span class="tag tag--lime">${session.intensity}</span>
          </div>
          <div class="today-body">
            <span class="today-icon">${icon(sport.icon, 32)}</span>
            <div>
              <h2>${session.title}</h2>
              <p>${session.desc}</p>
            </div>
          </div>
          <div class="session-meta">
            <span>${icon('clock', 16)} ${fmtDuration(session.duration)}</span>
            <span>${icon('heart', 16)} ${session.hr}</span>
            <span>${icon('target', 16)} ${goal.label}</span>
          </div>
          <ol class="session-steps">
            ${session.tips.map((tip) => `<li>${tip}</li>`).join('')}
          </ol>
          <button class="btn btn-primary btn-block" data-action="quick-add" data-type="${session.type}" data-duration="${session.duration}">完成并记录 ${icon('arrow', 16)}</button>
        </article>

        <article class="panel week-plan">
          <div class="panel-head">
            <div><span class="eyebrow">WEEKLY PLAN</span><h3>本周安排</h3></div>
            <span class="panel-note">${fmtDate(weekRange().start, 'md')} – ${fmtDate(weekRange().end, 'md')}</span>
          </div>
          <div class="plan-list">
            ${plan.map((day) => {
              const done = doneDates.has(day.date);
              return `
              <div class="plan-row ${day.isToday ? 'today' : ''} ${done && !day.isToday ? 'past' : ''} ${!done && day.isPast && !day.isToday && day.type ? 'missed' : ''}">
                <span class="plan-day"><em>${day.dayLabel}</em><strong>${day.dayNum}</strong></span>
                <i class="plan-dot" style="background:${day.color}"></i>
                <span class="plan-name">
                  <strong>${day.title}</strong>
                  <em>${day.type ? `${SPORTS[day.type].label} · ${day.duration} 分钟` : '恢复与睡眠'}</em>
                </span>
                ${day.isToday ? '<span class="today-tag">今天</span>' : done ? `<span class="done-tag">${icon('check', 12)}</span>` : !day.type ? '<span class="rest-tag">休息</span>' : day.isPast ? '<span class="miss-tag">未记录</span>' : ''}
              </div>`;
            }).join('')}
          </div>
        </article>
      </div>

      <section class="section-block">
        <div class="section-head">
          <div><span class="eyebrow">PRINCIPLES</span><h2>四条训练原则</h2><p>比具体动作更重要的，是长期有效的底层逻辑</p></div>
        </div>
        <div class="principle-grid">
          ${principles.map((p) => `<article class="principle-card"><span>${icon(p.icon, 22)}</span><h3>${p.title}</h3><p>${p.text}</p></article>`).join('')}
        </div>
      </section>

      <section class="goal-banner" style="--accent:${goal.accent}">
        <div>
          <span class="eyebrow">WHY THIS PLAN</span>
          <h3>${goal.label} · ${goal.desc}</h3>
          <p>${calorie ? `按当前数据估算，你的每日总消耗约 ${calorie.tdee} kcal，目标摄入 ${calorie.target} kcal，蛋白质 ${calorie.protein} g。` : ''}</p>
        </div>
        <button class="btn btn-ghost" data-action="navigate" data-route="profile">修改身体数据 ${icon('arrow', 15)}</button>
      </section>
    </div>`;
}

/* ---------------- 我的 ---------------- */

function renderProfile() {
  const user = state.user;
  const goal = GOALS[user.goal] || GOALS.health;
  const currentWeight = latestWeight(user, state.weights);
  const bmi = bmiOf({ ...user, weight: currentWeight });
  const bmiMeta = bmiInfo(bmi);
  const plan = caloriePlan({ ...user, weight: currentWeight });
  const initial = (user.nickname || '跃').charAt(0);
  const weightChoices = [...new Set([...WEIGHT_OPTIONS, Number(currentWeight)])]
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const achievements = computeAchievements(user, state.activities);
  const cloudMode = api.mode === 'supabase';
  const browserMode = api.mode === 'browser';

  return `
    <div class="profile-view">
      <div class="page-head">
        <div>
          <span class="eyebrow">PROFILE</span>
          <h1>我的</h1>
          <p>管理账号、身体档案与数据。</p>
        </div>
        <span class="pill">${icon(browserMode ? 'shield' : 'cloud', 14)} ${browserMode ? '本机账号' : '云端账号'}</span>
      </div>

      <div class="profile-grid">
        <div class="profile-left">
          <article class="account-card">
            <div class="account-bg"></div>
            <div class="account-top">
              <span class="avatar avatar--xl">${esc(initial)}</span>
              <div>
                <div class="account-name-row">
                  <h2>${esc(user.nickname)}</h2>
                  <button type="button" class="name-edit" data-action="edit-nickname" aria-label="修改昵称">${icon('edit', 13)}</button>
                </div>
                <p>${browserMode ? '仅保存在此浏览器' : maskPhone(user.phone)} · 加入于 ${fmtDate(user.createdAt?.slice(0, 10) || todayKey(), 'long')}</p>
              </div>
            </div>
            <div class="account-chips">
              <span class="pill pill--goal">${icon(goal.icon, 14)} ${goal.label}</span>
              <span class="pill">${icon('flame', 14)} 连续 ${currentStreak(state.activities)} 天</span>
              <span class="pill">${icon('body', 14)} ${user.height} cm</span>
              <button type="button" class="pill pill--action" data-action="add-weight">${icon('plus', 13)} 记录体重</button>
            </div>
            <div class="account-snapshot">
              <div><span>当前体重</span><strong>${currentWeight ? currentWeight.toFixed(1) : '—'} <em>kg</em></strong></div>
              <div><span>BMI</span><strong>${bmi ? bmi.toFixed(1) : '—'} <em>${bmiMeta.label}</em></strong></div>
              <div><span>目标摄入</span><strong>${plan ? plan.target : '—'} <em>kcal</em></strong></div>
            </div>
          </article>

          <article class="panel sync-card">
            <div class="sync-head">
              <span class="sync-logo">${icon(browserMode ? 'shield' : 'cloud', 24)}</span>
              <div><h3>${browserMode ? '本机存储' : '云端同步'}</h3><p>${browserMode ? '数据只保存在当前浏览器' : cloudMode ? '账号数据已保存到 Supabase' : '账号数据已保存到本地服务端'}</p></div>
              <span class="sync-badge">${browserMode ? '仅此设备' : '已连接'}</span>
            </div>
            <div class="sync-status">
              <span>${icon(browserMode ? 'body' : 'phone', 14)} ${browserMode ? '本机账号' : maskPhone(user.phone)}</span>
              <span>${browserMode ? '浏览器 localStorage' : cloudMode ? 'Supabase · Postgres' : 'SQLite · 服务端存储'}</span>
            </div>
            <small class="sync-note">${browserMode ? '换设备或清理浏览器数据会丢失，请定期导出 JSON 备份。' : '同一手机号可在不同浏览器登录，数据自动同步。'}</small>
          </article>

          ${cloudMode ? `<article class="panel security-card">
            <div class="panel-head">
              <div><span class="eyebrow">SECURITY</span><h3>账号安全</h3></div>
              <span class="panel-note">Supabase Auth</span>
            </div>
            <div class="security-row">
              <div><strong>登录密码</strong><em>定期更换密码，保护你的训练数据。</em></div>
              <button type="button" class="text-link" data-action="change-password">${icon('shield', 14)} 修改密码</button>
            </div>
          </article>` : ''}

          <article class="panel data-card">
            <div class="panel-head"><div><span class="eyebrow">DATA</span><h3>数据管理</h3></div></div>
            <div class="data-actions">
              <button data-action="export-data"><span>${icon('download', 19)}</span><div><strong>导出数据</strong><em>JSON 备份全部记录</em></div>${icon('chevron', 14)}</button>
              <button data-action="open-import"><span>${icon('upload', 19)}</span><div><strong>导入记录</strong><em>FIT / GPX / TCX / CSV</em></div>${icon('chevron', 14)}</button>
              ${browserMode ? '' : `<button data-action="logout"><span>${icon('logout', 19)}</span><div><strong>退出登录</strong><em>云端数据保留</em></div>${icon('chevron', 14)}</button>`}
              <button class="danger" data-action="clear-data"><span>${icon('trash', 19)}</span><div><strong>清空运动数据</strong><em>不可恢复，请谨慎操作</em></div>${icon('chevron', 14)}</button>
            </div>
          </article>
        </div>

        <div class="profile-right">
          <article class="panel profile-form-card">
            <div class="panel-head">
              <div><span class="eyebrow">BODY & GOAL</span><h3>身体档案与目标</h3></div>
              <span class="panel-note">修改后指引实时重算</span>
            </div>
            <form id="profile-form">
              <div class="field-grid">
                <div class="field field--full">
                  <label>昵称<span class="optional">1–20 个字符</span></label>
                  <input id="nickname-input" type="text" name="nickname" maxlength="20" autocomplete="nickname" value="${esc(user.nickname)}" placeholder="怎么称呼你">
                </div>
                <div class="field">
                  <label>身高</label>
                  <div class="select-wrap"><select name="height">
                    ${HEIGHT_OPTIONS.map((n) => `<option value="${n}" ${Number(user.height) === n ? 'selected' : ''}>${n} cm</option>`).join('')}
                  </select>${icon('down', 16)}</div>
                </div>
                <div class="field">
                  <label>当前体重</label>
                  <div class="select-wrap"><select name="weight">
                    ${weightChoices.map((n) => `<option value="${n}" ${Math.abs(Number(currentWeight) - n) < 0.001 ? 'selected' : ''}>${n} kg</option>`).join('')}
                  </select>${icon('down', 16)}</div>
                </div>
                <div class="field">
                  <label>性别</label>
                  <div class="select-wrap"><select name="sex">
                    ${SEX_OPTIONS.map((o) => `<option value="${o.value}" ${user.sex === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                  </select>${icon('down', 16)}</div>
                </div>
                <div class="field">
                  <label>年龄段</label>
                  <div class="select-wrap"><select name="ageBand">
                    ${AGE_BANDS.map((o) => `<option value="${o.value}" ${user.ageBand === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                  </select>${icon('down', 16)}</div>
                </div>
                <div class="field field--full">
                  <label>主要运动目标</label>
                  <div class="select-wrap select-wrap--lg"><select name="goal">
                    ${GOAL_KEYS.map((key) => `<option value="${key}" ${user.goal === key ? 'selected' : ''}>${GOALS[key].label} · ${GOALS[key].short}</option>`).join('')}
                  </select>${icon('down', 18)}</div>
                </div>
                <div class="field">
                  <label>每周训练频率</label>
                  <div class="select-wrap"><select name="freq">
                    ${FREQUENCIES.map((n) => `<option value="${n}" ${Number(user.freq) === n ? 'selected' : ''}>${n} 次 / 周</option>`).join('')}
                  </select>${icon('down', 16)}</div>
                </div>
                <div class="field">
                  <label>运动基础</label>
                  <div class="select-wrap"><select name="level">
                    ${LEVELS.map((o) => `<option value="${o.value}" ${user.level === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                  </select>${icon('down', 16)}</div>
                </div>
              </div>
              <p class="form-error" id="profile-error" role="alert"></p>
              <div class="profile-form-foot">
                <span>${icon('info', 14)} 体重变更会记录到体重趋势中</span>
                <button type="submit" class="btn btn-primary">保存修改 ${icon('check', 16)}</button>
              </div>
            </form>
          </article>

          <article class="panel body-summary">
            <div class="panel-head"><div><span class="eyebrow">CURRENT STATE</span><h3>身体概览</h3></div></div>
            <div class="body-summary-grid">
              <div><span>BMI</span><strong>${bmi ? bmi.toFixed(1) : '—'}</strong><em class="tone-${bmiMeta.tone}">${bmiMeta.label}</em></div>
              <div><span>基础代谢</span><strong>${plan ? plan.bmr : '—'}</strong><em>kcal / 天</em></div>
              <div><span>每日总消耗</span><strong>${plan ? plan.tdee : '—'}</strong><em>kcal / 天</em></div>
              <div><span>蛋白质目标</span><strong>${plan ? plan.protein : '—'}</strong><em>g / 天</em></div>
            </div>
            <p class="balance-tip">${icon('info', 14)} 基于 Mifflin-St Jeor 公式与训练频率估算。</p>
          </article>


          <article class="about-card">
            <div class="about-mark">${logoMark(30)}</div>
            <div>
              <strong>跃迹 YUEJI · ${browserMode ? '本机版' : cloudMode ? 'Supabase 版本' : '本地版本'}</strong>
              <p>${browserMode ? '无登录，数据保存在当前浏览器；支持 JSON 导入导出，不会上传到服务器。' : cloudMode ? '账号与运动数据保存在 Supabase Auth + Postgres；密码加密存储，不发送短信。' : '账号与运动数据保存在本地服务端 SQLite；验证码为开发环境固定值，正式上线需接入短信服务。'}</p>
            </div>
          </article>
        </div>
      </div>

          <article class="panel achievements-card">
            <div class="panel-head">
              <div><span class="eyebrow">ACHIEVEMENTS</span><h3>成就徽章</h3></div>
              <span class="panel-note">已获得 ${achievements.earned} / ${achievements.total}</span>
            </div>
            <div class="achievement-grid">
              ${achievements.items.map((item) => `
                <div class="achievement ${item.earned ? 'earned' : ''}">
                  <span class="ach-icon">${icon(item.icon, 19)}</span>
                  <div class="ach-main">
                    <strong>${item.title}</strong>
                    <em>${item.desc}</em>
                    ${item.earned
                      ? `<span class="ach-earned">${icon('check', 11)} 已获得</span>`
                      : `<div class="ach-progress"><i style="width:${item.progress * 100}%"></i><span>${fmtNumber(item.current, item.current % 1 ? 1 : 0)} / ${fmtNumber(item.target)}${item.unit || ''}</span></div>`}
                  </div>
                </div>`).join('')}
            </div>
          </article>
    </div>`;
}

function maskPhone(phone) {
  return String(phone || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1 **** $2');
}

/* ---------------- 弹窗 ---------------- */

function openModal(html, className = '') {
  destroyTrackMap();
  modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><div class="modal ${className}" role="dialog" aria-modal="true">${html}</div></div>`;
  document.body.classList.add('modal-open');
  const panel = modalRoot.querySelector('.modal');
  if (panel) panel.scrollTop = 0;
}

function closeModal() {
  destroyTrackMap();
  if (!modalRoot.innerHTML) return;
  modalRoot.innerHTML = '';
  document.body.classList.remove('modal-open');
}

function modalHead(eyebrow, title, subtitle = '') {
  return `
    <div class="modal-head">
      <div><span class="eyebrow">${eyebrow}</span><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>
      <button class="icon-btn modal-close" data-action="close-modal" aria-label="关闭">${icon('close', 19)}</button>
    </div>`;
}

function openPasswordModal() {
  if (api.authMode !== 'password') {
    toast('当前为验证码登录模式，没有登录密码', 'info');
    return;
  }
  openModal(`
    ${modalHead('SECURITY', '修改密码', '需要先验证当前密码；修改成功后继续使用新密码登录。')}
    <form id="password-form" novalidate>
      <div class="field">
        <label>当前密码</label>
        <input type="password" name="currentPassword" autocomplete="current-password" placeholder="输入当前密码" required>
      </div>
      <div class="field">
        <label>新密码<span class="optional">至少 8 位</span></label>
        <input type="password" name="newPassword" autocomplete="new-password" minlength="8" placeholder="输入新密码" required>
      </div>
      <div class="field">
        <label>确认新密码</label>
        <input type="password" name="confirmPassword" autocomplete="new-password" minlength="8" placeholder="再次输入新密码" required>
      </div>
      <p class="form-error" id="password-error" role="alert"></p>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-action="close-modal">取消</button>
        <button type="submit" class="btn btn-primary">保存新密码 ${icon('check', 16)}</button>
      </div>
    </form>`, 'modal--form');
}

async function handlePasswordChange(form) {
  const current = String(form.elements.currentPassword.value || '');
  const next = String(form.elements.newPassword.value || '');
  const confirm = String(form.elements.confirmPassword.value || '');
  const err = document.getElementById('password-error');
  const fail = (message) => {
    if (err) { err.textContent = message; err.classList.add('show'); }
  };
  if (!current) return fail('请输入当前密码');
  if (next.length < 8) return fail('新密码至少需要 8 位');
  if (next === current) return fail('新密码不能与当前密码相同');
  if (next !== confirm) return fail('两次输入的新密码不一致');
  const restore = setBusy(form.querySelector('button[type="submit"]'), '保存中…');
  try {
    await api.changePassword(current, next);
    closeModal();
    toast('密码已修改，请使用新密码登录', 'success');
  } catch (error) {
    fail(error.message || '修改密码失败，请稍后重试');
    restore();
  }
}

function openWeightModal() {
  const current = latestWeight(state.user, state.weights);
  const today = todayKey();
  const recent = [...state.weights].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
  openModal(`
    ${modalHead('WEIGHT LOG', '记录体重', '同一天重复记录会更新当天数据，并写入体重趋势。')}
    <form id="weight-form" novalidate>
      <div class="field-grid">
        <div class="field">
          <label>日期</label>
          <input type="date" name="date" value="${today}" max="${today}">
        </div>
        <div class="field">
          <label>体重（kg）</label>
          <input type="number" name="kg" min="25" max="300" step="0.1" value="${current ?? ''}" placeholder="例如 72.4" required>
        </div>
      </div>
      ${recent.length ? `<div class="weight-history">
        <span class="eyebrow">RECENT WEIGHT</span>
        ${recent.map((w) => {
          const rel = relativeDay(w.date);
          const label = ['今天', '昨天', '前天'].includes(rel) ? `${fmtDate(w.date, 'md')} · ${rel}` : fmtDate(w.date, 'md');
          return `<div class="weight-history-row"><span>${label}</span><strong>${Number(w.kg).toFixed(1)} <em>kg</em></strong></div>`;
        }).join('')}
      </div>` : ''}
      <p class="form-error" id="weight-error" role="alert"></p>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-action="close-modal">取消</button>
        <button type="submit" class="btn btn-primary">保存体重 ${icon('check', 16)}</button>
      </div>
    </form>`, 'modal--form');
}

async function handleWeightSave(form) {
  const fd = new FormData(form);
  const day = String(fd.get('date') || '');
  const kg = Number(fd.get('kg'));
  const err = document.getElementById('weight-error');
  const fail = (message) => {
    if (err) { err.textContent = message; err.classList.add('show'); }
  };
  if (!day || day > todayKey()) return fail('请选择今天或之前的日期');
  if (!Number.isFinite(kg) || kg < 25 || kg > 300) return fail('请输入 25–300 kg 之间的体重');
  const restore = setBusy(form.querySelector('button[type="submit"]'), '保存中…');
  try {
    await api.addWeight(day, Math.round(kg * 10) / 10);
    await refreshBootstrap();
    closeModal();
    render();
    toast(day === todayKey() ? '今日体重已记录' : '体重记录已保存', 'success');
  } catch (error) {
    fail(error.message || '保存失败，请稍后重试');
    restore();
  }
}

function openAddModal(prefill = {}, editId = null) {
  const editing = editId ? state.activities.find((a) => a.id === editId) : null;
  const src = editing || prefill;
  const today = todayKey();
  const type = src.type && SPORTS[src.type] ? src.type : 'running';
  const date = src.date || today;
  const duration = src.duration ?? '';
  const distance = src.distance ?? '';
  const calories = src.calories ?? '';
  const avgHr = src.avgHr ?? '';
  const initialRpe = src.rpe || activityRpe(editing || { type, duration, avgHr });
  const notes = src.notes || '';
  const loadValue = duration ? Math.round(Number(duration) * Number(initialRpe)) : null;
  const strength = type === 'strength' && Array.isArray(src.strength) ? src.strength : [];
  const strengthRows = strength.length ? strength : [{}];

  openModal(`
    ${modalHead(editing ? 'EDIT ENTRY' : 'MANUAL ENTRY', editing ? '编辑运动记录' : '记录一次运动',
      editing ? '修改后，统计与训练负荷会重新计算。' : '手动记录同样会进入看板与指引计算。')}
    <form id="add-record-form" data-edit-id="${editing ? editing.id : ''}" novalidate>
      <div class="field-grid">
        <div class="field">
          <label>运动类型</label>
          <div class="select-wrap"><select name="type">
            ${ALL_SPORT_KEYS.map((key) => `<option value="${key}" ${type === key ? 'selected' : ''}>${SPORTS[key].label}</option>`).join('')}
          </select>${icon('down', 16)}</div>
        </div>
        <div class="field">
          <label>日期</label>
          <input type="date" name="date" value="${date}" max="${today}">
        </div>
        <div class="field">
          <label>时长（分钟）</label>
          <input id="record-duration" type="number" name="duration" min="1" max="1440" step="1" placeholder="例如 45" value="${duration}" required>
        </div>
        <div class="field">
          <label>距离（公里）<span class="optional">选填</span></label>
          <input type="number" name="distance" min="0" max="1000" step="0.01" placeholder="例如 5.20" value="${distance}">
        </div>
        <div class="field">
          <label>消耗（千卡）<span class="optional">留空自动估算</span></label>
          <input type="number" name="calories" min="0" max="20000" step="1" placeholder="自动估算" value="${calories}">
        </div>
        <div class="field">
          <label>平均心率（bpm）<span class="optional">选填</span></label>
          <input type="number" name="avgHr" min="30" max="240" step="1" placeholder="例如 148" value="${avgHr}">
        </div>
        <div class="field">
          <label>主观强度 RPE<span class="optional">1–10</span></label>
          <div class="select-wrap"><select id="record-rpe" name="rpe">
            ${RPE_OPTIONS.map((o) => `<option value="${o.value}" ${Number(initialRpe) === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
          </select>${icon('down', 16)}</div>
        </div>
        <div class="field">
          <label>训练负荷<span class="optional">时长 × RPE</span></label>
          <div class="load-preview" id="load-preview">
            ${loadValue != null ? `<strong>${fmtNumber(loadValue)}</strong><span>负荷点</span>` : '<strong>—</strong><span>填写时长后计算</span>'}
          </div>
        </div>
        <div class="field field--full strength-editor" id="strength-editor" ${type === 'strength' ? '' : 'hidden'}>
          <div class="strength-editor-head">
            <div><label>力量训练明细</label><span class="optional">动作 · 部位 · 组数 · 次数 · 重量</span></div>
            <button type="button" class="text-link" data-action="add-strength-exercise">${icon('plus', 13)} 添加动作</button>
          </div>
          <div class="strength-rows" id="strength-rows">${strengthRows.map(strengthRowHtml).join('')}</div>
          <div class="strength-total" id="strength-total"></div>
          <datalist id="strength-exercise-list">
            ${['深蹲','硬拉','卧推','肩推','划船','引体向上','俯卧撑','弓步蹲','腿举','臀桥','弯举','三头下压','平板支撑','农夫行走'].map((name) => `<option value="${name}"></option>`).join('')}
          </datalist>
        </div>
        <div class="field field--full">
          <label>备注<span class="optional">选填</span></label>
          <textarea name="notes" rows="3" maxlength="200" placeholder="今天的感受、路线或训练重点…">${esc(notes)}</textarea>
        </div>
      </div>
      <p class="form-error" id="record-error" role="alert"></p>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-action="close-modal">取消</button>
        <button type="submit" class="btn btn-primary">${editing ? '保存修改' : '保存记录'} ${icon('check', 16)}</button>
      </div>
    </form>`, 'modal--form');
  if (type === 'strength') updateStrengthTotal();
}

function strengthRowHtml(ex = {}) {
  const part = ex.part || 'full';
  return `<div class="strength-row" data-strength-row>
    <div class="field strength-ex-name">
      <label>动作</label>
      <input name="exerciseName" maxlength="60" list="strength-exercise-list" value="${esc(ex.name || '')}" placeholder="例如 卧推">
    </div>
    <div class="field strength-ex-part">
      <label>部位</label>
      <div class="select-wrap"><select name="exercisePart">${STRENGTH_PARTS.map((p) => `<option value="${p.key}" ${part === p.key ? 'selected' : ''}>${p.label}</option>`).join('')}</select>${icon('down', 14)}</div>
    </div>
    <div class="field">
      <label>组数</label>
      <input type="number" name="exerciseSets" min="1" max="20" step="1" value="${esc(ex.sets ?? 3)}">
    </div>
    <div class="field">
      <label>次数/组</label>
      <input type="number" name="exerciseReps" min="1" max="100" step="1" value="${esc(ex.reps ?? 10)}">
    </div>
    <div class="field">
      <label>重量 kg</label>
      <input type="number" name="exerciseWeight" min="0" max="500" step="0.5" value="${ex.weight != null ? esc(ex.weight) : ''}" placeholder="自重可留空">
    </div>
    <button type="button" class="strength-remove" data-action="remove-strength-exercise" aria-label="删除动作">${icon('close', 14)}</button>
  </div>`;
}

function addStrengthRow() {
  const rows = document.getElementById('strength-rows');
  if (!rows) return;
  rows.insertAdjacentHTML('beforeend', strengthRowHtml());
  updateStrengthTotal();
}

function updateStrengthTotal() {
  const rows = [...document.querySelectorAll('#strength-rows [data-strength-row]')];
  const el = document.getElementById('strength-total');
  if (!el) return;
  let sets = 0;
  let volume = 0;
  let count = 0;
  for (const row of rows) {
    const name = row.querySelector('[name="exerciseName"]')?.value.trim();
    const setCount = Number(row.querySelector('[name="exerciseSets"]')?.value) || 0;
    const reps = Number(row.querySelector('[name="exerciseReps"]')?.value) || 0;
    const weight = Number(row.querySelector('[name="exerciseWeight"]')?.value) || 0;
    if (!name) continue;
    count += 1;
    sets += setCount;
    volume += setCount * reps * weight;
  }
  el.innerHTML = count
    ? `<span>${count} 个动作 · ${sets} 组</span><strong>${volume ? `${fmtNumber(volume)} kg 容量` : '自重 / 未计重量'}</strong>`
    : '<span>补充动作后自动计算训练容量</span>';
}

function syncStrengthEditor(form) {
  const editor = form.querySelector('#strength-editor');
  if (!editor) return;
  const isStrength = form.querySelector('[name="type"]')?.value === 'strength';
  editor.hidden = !isStrength;
  if (isStrength && !form.querySelector('#strength-rows [data-strength-row]')) addStrengthRow();
  updateStrengthTotal();
}

function readStrengthFromForm(form) {
  const rows = [...form.querySelectorAll('#strength-rows [data-strength-row]')];
  const out = [];
  for (const row of rows) {
    const name = row.querySelector('[name="exerciseName"]')?.value.trim() || '';
    const part = row.querySelector('[name="exercisePart"]')?.value || 'full';
    const setsRaw = row.querySelector('[name="exerciseSets"]')?.value;
    const repsRaw = row.querySelector('[name="exerciseReps"]')?.value;
    const weightRaw = row.querySelector('[name="exerciseWeight"]')?.value;
    if (!name) continue;
    const sets = Number(setsRaw);
    const reps = Number(repsRaw);
    const weight = weightRaw === '' ? 0 : Number(weightRaw);
    if (!Number.isFinite(sets) || sets < 1 || sets > 20) throw new Error(`「${name}」的组数需在 1–20 之间`);
    if (!Number.isFinite(reps) || reps < 1 || reps > 100) throw new Error(`「${name}」的次数需在 1–100 之间`);
    if (!Number.isFinite(weight) || weight < 0 || weight > 500) throw new Error(`「${name}」的重量需在 0–500 kg 之间`);
    out.push({
      name: name.slice(0, 60),
      part: STRENGTH_PART_LABELS[part] ? part : 'full',
      sets: Math.round(sets),
      reps: Math.round(reps),
      weight: Math.round(weight * 10) / 10
    });
  }
  return out;
}

function updateLoadPreview() {
  const duration = Number(document.getElementById('record-duration')?.value) || 0;
  const rpe = Number(document.getElementById('record-rpe')?.value) || 0;
  const el = document.getElementById('load-preview');
  if (!el) return;
  el.innerHTML = duration && rpe
    ? `<strong>${fmtNumber(duration * rpe)}</strong><span>负荷点</span>`
    : '<strong>—</strong><span>填写时长后计算</span>';
}

async function handleAddRecord(form) {
  const fd = new FormData(form);
  const err = document.getElementById('record-error');
  const type = String(fd.get('type'));
  const date = String(fd.get('date'));
  const duration = Number(fd.get('duration'));
  const distanceRaw = String(fd.get('distance') || '').trim();
  const distance = distanceRaw ? Number(distanceRaw) : null;
  const caloriesRaw = String(fd.get('calories') || '').trim();
  const hrRaw = String(fd.get('avgHr') || '').trim();
  const rpe = Number(fd.get('rpe')) || activityRpe({ type, duration, avgHr: hrRaw ? Number(hrRaw) : null });
  const editId = form.dataset.editId;

  const fail = (msg) => {
    if (err) { err.textContent = msg; err.classList.add('show'); }
  };
  if (!date || date > todayKey()) return fail('请选择今天或之前的日期');
  if (!duration || duration <= 0) return fail('请填写有效的训练时长');
  if (distanceRaw && (!Number.isFinite(distance) || distance < 0)) return fail('距离格式不正确');
  let strength = [];
  if (type === 'strength') {
    try {
      strength = readStrengthFromForm(form);
    } catch (error) {
      return fail(error.message);
    }
  }

  const base = {
    type: SPORTS[type] ? type : 'other',
    date,
    duration: Math.round(duration),
    distance: distance == null ? null : Math.round(distance * 100) / 100,
    calories: caloriesRaw ? Math.round(Number(caloriesRaw)) : estimateCalories(type, duration, state.user.weight),
    avgHr: hrRaw ? Math.round(Number(hrRaw)) : null,
    rpe: clamp(Math.round(rpe), 1, 10),
    notes: String(fd.get('notes') || '').trim(),
    strength
  };

  const restore = setBusy(form.querySelector('button[type="submit"]'), '保存中…');
  try {
    if (editId) {
      await api.updateActivity(editId, base);
    } else {
      await api.createActivity(base);
    }
    await refreshBootstrap();
    closeModal();
    render();
    toast(editId ? '运动记录已更新' : '运动记录已保存', 'success');
  } catch (error) {
    fail(error.message || '保存失败，请稍后重试');
    restore();
  }
}

function openRecordModal(id) {
  const a = state.activities.find((x) => x.id === id);
  if (!a) return;
  const sport = SPORTS[a.type] || SPORTS.other;
  const rpe = activityRpe(a);
  const load = sessionLoad(a);
  const stream = Array.isArray(a.stream) ? a.stream : [];
  const zoneStats = streamZoneStats(stream, state.user);
  const zonePair = hrZones(state.user).z2.split('–').map(Number);
  const maxHr = a.maxHr || zoneStats?.maxHr || null;
  const avgHr = a.avgHr || zoneStats?.avgHr || null;
  const streamMaxT = stream.length ? Math.max(...stream.map((p) => Number(p.t) || 0)) : 0;
  const hasPause = streamMaxT > Math.round(a.duration) + 1;
  const strength = Array.isArray(a.strength) ? a.strength : [];
  const strengthSets = strength.reduce((sum, ex) => sum + (Number(ex.sets) || 0), 0);
  const strengthVolume = strength.reduce((sum, ex) => sum + (Number(ex.sets) || 0) * (Number(ex.reps) || 0) * (Number(ex.weight) || 0), 0);
  const strengthParts = [...new Set(strength.map((ex) => STRENGTH_PART_LABELS[ex.part] || '全身'))];
  const strengthBlock = a.type === 'strength' ? (strength.length ? `
    <div class="detail-section">
      <div class="detail-section-head">
        <h3>力量明细</h3>
        <span>${strengthParts.join(' · ')} · ${strengthSets} 组${strengthVolume ? ` · ${fmtNumber(strengthVolume)} kg` : ''}</span>
      </div>
      <div class="strength-detail-list">
        ${strength.map((ex) => {
          const volume = (Number(ex.sets) || 0) * (Number(ex.reps) || 0) * (Number(ex.weight) || 0);
          return `<div class="strength-exercise">
            <div class="strength-exercise-main"><strong>${esc(ex.name)}</strong><span class="part-pill">${STRENGTH_PART_LABELS[ex.part] || '全身'}</span></div>
            <div class="strength-exercise-meta"><span>${Number(ex.sets) || 0} 组 × ${Number(ex.reps) || 0} 次</span><strong>${Number(ex.weight) > 0 ? `${Number(ex.weight)} kg` : '自重'}</strong>${volume ? `<em>${fmtNumber(volume)} kg</em>` : ''}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="strength-summary"><span>训练容量 = 组数 × 次数 × 重量</span><strong>${strengthVolume ? `${fmtNumber(strengthVolume)} kg` : `${strengthSets} 组`}</strong></div>
    </div>` : `
    <div class="detail-section">
      <div class="detail-section-head"><h3>力量明细</h3><span>待补充</span></div>
      <div class="strength-empty">
        <p>这份记录来自设备，只有时长和心率。补充动作、部位、组数和重量后，才能统计训练容量。</p>
        <button type="button" class="text-link" data-action="edit-record" data-id="${a.id}">${icon('edit', 13)} 补充动作明细</button>
      </div>
    </div>`) : '';
  const track = activityTrack(a);
  const trackBlock = track.length >= 2 ? `
    <div class="detail-section track-section">
      <div class="detail-section-head">
        <h3>GPS 轨迹</h3>
        <div class="track-head-actions">
          <span>${track.length} 个定位点</span>
          <button type="button" class="text-link" data-action="load-basemap" data-id="${a.id}">${icon('map', 13)} 地图底图</button>
          <button type="button" class="text-link" data-action="export-gpx" data-id="${a.id}">${icon('download', 13)} 导出 GPX</button>
        </div>
      </div>
      <div class="track-wrap">
        <div id="track-static">${trackChart(track, { color: sport.color, distance: a.distance })}</div>
        <div id="track-map" class="track-map" hidden></div>
      </div>
      <div class="track-legend"><span><i class="track-dot track-dot--start"></i>起点</span><span><i class="track-dot track-dot--end"></i>终点</span><em>轨迹在本地生成，不含第三方地图底图</em></div>
      <p class="track-hint">${icon('info', 12)} 导出 GPX 后可在常用地图/运动平台查看完整轨迹。</p>
    </div>` : '';
  const rows = [
    ['日期', `${fmtDate(a.date, 'long')} · 周${weekdayCN(a.date)}`],
    ['时长', fmtDuration(a.duration)],
    ['距离', activityDistance(a) ? fmtDistance(a.distance) : '未记录'],
    ['消耗', `${fmtNumber(activityCalories(a, state.user))} kcal`],
    ['平均心率', avgHr ? `${avgHr} bpm` : '未记录'],
    ['最大心率', maxHr ? `${maxHr} bpm` : '未记录'],
    ['主观强度', `RPE ${rpe} / 10`],
    ['训练负荷', `${fmtNumber(load)} 负荷点`],
    ['累计爬升', a.elevation ? `${a.elevation} m` : '未记录'],
    ...(hasPause ? [['总耗时', `${Math.round(streamMaxT)} 分钟（含暂停）`]] : []),
    ['数据来源', SOURCE_LABELS[a.source] || '手动记录']
  ];
  const zoneColors = ['#7FB0FF', '#CCF56B', '#F7C95C', '#FF8B68'];
  const zoneNames = ['Z1 恢复', 'Z2 有氧', 'Z3 节奏', 'Z4 阈值'];
  const streamBlock = zoneStats && stream.length > 1 ? `
    <div class="detail-section">
      <div class="detail-section-head">
        <h3>运动过程</h3>
        <span>${zoneStats ? `${hasPause ? `总耗时 ${Math.round(streamMaxT)}′ · ` : ''}平均 ${avgHr} · 最高 ${maxHr} bpm` : '心率采样'}</span>
      </div>
      <div class="stream-wrap">${streamChart({ stream, color: sport.color, height: 210, zone: zonePair })}</div>
      ${zoneStats ? `<div class="zone-dist">
        ${zoneStats.pcts.map((pct, i) => `<div class="zone-dist-row">
          <span><i style="background:${zoneColors[i]}"></i>${zoneNames[i]}</span>
          <div class="zone-dist-bar"><i style="width:${pct}%;background:${zoneColors[i]}"></i></div>
          <strong>${pct}%</strong>
        </div>`).join('')}
      </div>` : ''}
    </div>` : '';

  openModal(`
    ${modalHead('ACTIVITY DETAIL', `${sport.label} · ${fmtDate(a.date, 'md')}`, '')}
    <div class="record-detail-hero" style="--sport:${sport.color}">
      <span>${icon(sport.icon, 34)}</span>
      <div><strong>${fmtDuration(a.duration)}</strong><em>${activityDistance(a) ? `${fmtDistance(a.distance)} · ` : ''}${fmtNumber(activityCalories(a, state.user))} kcal</em></div>
      <div class="hero-load"><span>训练负荷</span><strong>${fmtNumber(load)}</strong><em>RPE ${rpe}</em></div>
    </div>
    <div class="detail-rows">
      ${rows.map(([label, value]) => `<div><span>${label}</span><strong>${esc(value)}</strong></div>`).join('')}
    </div>
    ${strengthBlock}
    ${trackBlock}
    ${streamBlock}
    ${a.notes ? `<div class="detail-notes"><span>备注</span><p>${esc(a.notes)}</p></div>` : ''}
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost btn-danger-ghost" data-action="delete-record" data-id="${a.id}">${icon('trash', 15)} 删除</button>
      <button type="button" class="btn btn-ghost" data-action="edit-record" data-id="${a.id}">${icon('edit', 15)} 编辑记录</button>
      <button type="button" class="btn btn-primary" data-action="close-modal">完成</button>
    </div>`, 'modal--detail');
}

function activityTrack(activity) {
  return (activity?.stream || []).filter((p) =>
    Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)) &&
    Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lon)) <= 180 &&
    !(Number(p.lat) === 0 && Number(p.lon) === 0)
  );
}

function exportActivityGpx(id) {
  const a = state.activities.find((x) => x.id === id);
  if (!a) return;
  const track = activityTrack(a);
  if (track.length < 2) {
    toast('这条记录没有足够的 GPS 点', 'error');
    return;
  }
  const sport = SPORTS[a.type] || SPORTS.other;
  let baseMs = null;
  const timeMatch = String(a.startTime || '').match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const d = parseDate(a.date);
    d.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
    baseMs = d.getTime();
  }
  const pts = track.map((p) => {
    const ele = Number.isFinite(Number(p.ele)) ? `<ele>${Number(p.ele)}</ele>` : '';
    const time = baseMs != null ? `<time>${new Date(baseMs + (Number(p.t) || 0) * 60000).toISOString()}</time>` : '';
    const hr = p.hr ? `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${Math.round(Number(p.hr))}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>` : '';
    return `<trkpt lat="${Number(p.lat).toFixed(6)}" lon="${Number(p.lon).toFixed(6)}">${ele}${time}${hr}</trkpt>`;
  }).join('');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="跃迹 YUEJI" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <metadata><name>${sport.label} · ${a.date}</name><time>${new Date(baseMs || Date.now()).toISOString()}</time></metadata>
  <trk><name>${sport.label} · ${a.date}</name><type>${a.type}</type><trkseg>${pts}</trkseg></trk>
</gpx>`;
  const blob = new Blob([gpx], { type: 'application/gpx+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const el = document.createElement('a');
  el.href = url;
  el.download = `yueji-${a.date}-${a.type}.gpx`;
  document.body.appendChild(el);
  el.click();
  el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('GPX 轨迹已导出', 'success');
}

function openSportModal(key) {
  const sport = SPORTS[key];
  if (!sport) return;
  const list = sortActivities(state.activities.filter((a) => a.type === key));
  const totalMinutes = list.reduce((s, a) => s + (a.duration || 0), 0);
  const totalDistance = list.reduce((s, a) => s + activityDistance(a), 0);
  const totalCalories = list.reduce((s, a) => s + activityCalories(a, state.user), 0);
  const isDistance = sport.metric === 'distance';
  const weekly = Array.from({ length: 8 }).map((_, i) => weeklySnapshot(state.activities, state.user, i - 7));
  const series = weekly.map((w) => {
    const items = w.list.filter((a) => a.type === key);
    return isDistance ? items.reduce((s, a) => s + activityDistance(a), 0) : items.reduce((s, a) => s + (a.duration || 0), 0);
  });
  const best = isDistance
    ? [...list].sort((a, b) => activityDistance(b) - activityDistance(a))[0]
    : [...list].sort((a, b) => b.duration - a.duration)[0];

  openModal(`
    ${modalHead('SPORT DETAIL', sport.label, sport.desc)}
    <div class="sport-detail-hero" style="--sport:${sport.color}">
      <div class="sport-detail-icon">${icon(sport.icon, 36)}</div>
      <div class="sport-detail-num">
        <span>累计${isDistance ? '距离' : '时长'}</span>
        <strong>${isDistance ? fmtNumber(totalDistance, 1) : fmtNumber(totalMinutes / 60, 1)}<em>${isDistance ? 'km' : '小时'}</em></strong>
      </div>
      <div class="sport-detail-num"><span>训练次数</span><strong>${list.length}<em>次</em></strong></div>
      <div class="sport-detail-num"><span>累计消耗</span><strong>${fmtNumber(totalCalories)}<em>kcal</em></strong></div>
    </div>
    <div class="detail-section">
      <div class="detail-section-head"><h3>近 8 周趋势</h3><span>${isDistance ? '公里 / 周' : '分钟 / 周'}</span></div>
      <div class="mini-bars-wrap">${miniBars(series, sport.color, { width: 620, height: 90 })}</div>
    </div>
    ${best ? `<div class="best-line">${icon('spark', 16)} 最佳单次：${isDistance ? fmtDistance(best.distance) : fmtDuration(best.duration)} · ${fmtDate(best.date)}</div>` : ''}
    <div class="detail-section">
      <div class="detail-section-head"><h3>历史记录</h3><span>${list.length} 条</span></div>
      <div class="sport-history">
        ${list.length ? list.slice(0, 6).map((a) => `
          <div class="sport-history-row" data-action="open-record" data-id="${a.id}">
            <span>${fmtDate(a.date, 'md')} <em>周${weekdayCN(a.date)}</em></span>
            <strong>${fmtDuration(a.duration)}</strong>
            <span>${activityDistance(a) ? fmtDistance(a.distance) : '—'}</span>
            <span>${fmtNumber(activityCalories(a, state.user))} kcal</span>
            ${icon('chevron', 14)}
          </div>`).join('') : '<div class="mini-empty">还没有这个项目的记录</div>'}
      </div>
      ${list.length > 6 ? `<button class="text-link detail-more" data-action="view-sport-records" data-sport="${key}">查看全部 ${list.length} 条记录 ${icon('arrow', 14)}</button>` : ''}
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-action="close-modal">关闭</button>
      <button type="button" class="btn btn-primary" data-action="quick-add" data-type="${key}" data-duration="${isDistance ? 45 : 45}">记录${sport.label} ${icon('plus', 16)}</button>
    </div>`, 'modal--wide');
}

let leafletPromise = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      leafletPromise = null;
      reject(new Error('地图组件加载超时，请检查网络'));
    }, 10000);
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      clearTimeout(timeout);
      if (window.L) resolve(window.L);
      else { leafletPromise = null; reject(new Error('地图组件加载失败')); }
    };
    script.onerror = () => {
      clearTimeout(timeout);
      leafletPromise = null;
      reject(new Error('无法加载地图组件，请检查网络'));
    };
    document.head.appendChild(script);
  });
  return leafletPromise;
}

function destroyTrackMap() {
  if (state.mapInstance) {
    try { state.mapInstance.remove(); } catch { /* map already detached */ }
    state.mapInstance = null;
  }
}

function hideTrackBasemap() {
  destroyTrackMap();
  const staticEl = document.getElementById('track-static');
  const mapEl = document.getElementById('track-map');
  const btn = document.querySelector('[data-action="hide-basemap"]');
  if (staticEl) staticEl.hidden = false;
  if (mapEl) { mapEl.hidden = true; mapEl.innerHTML = ''; }
  const legend = document.querySelector('.track-legend em');
  if (legend?.dataset.original) legend.textContent = legend.dataset.original;
  if (btn) {
    btn.dataset.action = 'load-basemap';
    btn.innerHTML = `${icon('map', 13)} 地图底图`;
  }
}

async function loadTrackBasemap(activityId, button) {
  const a = state.activities.find((x) => x.id === activityId);
  const track = a ? activityTrack(a) : [];
  const mapEl = document.getElementById('track-map');
  const staticEl = document.getElementById('track-static');
  if (!a || track.length < 2 || !mapEl) return;
  const restore = () => {
    if (button?.isConnected) {
      button.disabled = false;
      button.innerHTML = `${icon('map', 13)} 地图底图`;
    }
  };
  if (button) {
    button.disabled = true;
    button.textContent = '加载中…';
  }
  toast('正在加载 OpenStreetMap 底图，位置范围会发送给瓦片服务', 'info');
  try {
    const L = await loadLeaflet();
    if (!mapEl.isConnected) return;
    mapEl.hidden = false;
    if (staticEl) staticEl.hidden = true;
    const map = L.map(mapEl, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
      preferCanvas: true
    });
    state.mapInstance = map;
    const tiles = L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    });
    let tileErrorShown = false;
    tiles.on('tileerror', () => {
      if (!tileErrorShown) {
        tileErrorShown = true;
        toast('部分地图瓦片加载失败，轨迹仍可查看', 'info');
      }
    });
    tiles.addTo(map);
    const coords = track.map((p) => [Number(p.lat), Number(p.lon)]);
    L.polyline(coords, { color: '#0B0F0D', weight: 8, opacity: 0.28, lineCap: 'round', lineJoin: 'round' }).addTo(map);
    L.polyline(coords, { color: '#CCF56B', weight: 4, opacity: 0.98, lineCap: 'round', lineJoin: 'round' }).addTo(map);
    L.circleMarker(coords[0], { radius: 6, color: '#0B0F0D', weight: 2, fillColor: '#CCF56B', fillOpacity: 1 })
      .addTo(map).bindPopup('起点');
    L.circleMarker(coords[coords.length - 1], { radius: 6, color: '#0B0F0D', weight: 2, fillColor: '#FF8B68', fillOpacity: 1 })
      .addTo(map).bindPopup('终点');
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
    map.fitBounds(coords, { padding: [24, 24] });
    const legend = document.querySelector('.track-legend em');
    if (legend) {
      legend.dataset.original = legend.dataset.original || legend.textContent;
      legend.textContent = '底图 © OpenStreetMap · 位置范围已发送至瓦片服务';
    }
    setTimeout(() => { if (state.mapInstance) state.mapInstance.invalidateSize(); }, 120);
    if (button?.isConnected) {
      button.disabled = false;
      button.dataset.action = 'hide-basemap';
      button.innerHTML = `${icon('close', 13)} 收起底图`;
    }
    toast('地图底图已加载', 'success');
  } catch (error) {
    if (staticEl) staticEl.hidden = false;
    if (mapEl) { mapEl.hidden = true; mapEl.innerHTML = ''; }
    restore();
    toast(error.message || '地图底图加载失败', 'error');
  }
}

function openConfirm({ title, message, confirmLabel, confirmAction, id = '', danger = false }) {
  openModal(`
    ${modalHead('CONFIRM', title, '')}
    <p class="confirm-message">${message}</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-action="close-modal">取消</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="${confirmAction}" ${id ? `data-id="${id}"` : ''}>${confirmLabel}</button>
    </div>`, 'modal--confirm');
}

/* ---------------- 导入 ---------------- */

function openImportModal() {
  const data = state.importData;
  let content = '';

  if (!data) {
    content = `
      <div class="dropzone" id="dropzone" data-action="pick-file">
        <span class="drop-icon">${icon('upload', 30)}</span>
        <h3>把运动文件拖到这里</h3>
        <p>或 <strong>点击选择文件</strong>，文件只在本地解析，不会上传。</p>
        <div class="format-row">
          <span class="format-chip">.FIT</span><span class="format-chip">.GPX</span><span class="format-chip">.TCX</span><span class="format-chip">.CSV</span><span class="format-chip">.JSON</span>
        </div>
      </div>
      <div class="import-help">
        <div><span>${icon('file', 18)}</span><p><strong>手表 / 码表导出</strong><em>Garmin、COROS、Suunto、Wahoo 等设备导出的 FIT 文件可直接导入。</em></p></div>
        <div><span>${icon('list', 18)}</span><p><strong>表格批量导入</strong><em>下载标准 CSV 模板，按列填写后可一次导入多条记录。</em></p></div>
      </div>
      <div class="import-foot">
        <button class="text-link" data-action="download-template">${icon('download', 15)} 下载 CSV 导入模板</button>
        <span>单个文件不超过 25MB</span>
      </div>`;
  } else if (data.status === 'loading') {
    content = `<div class="import-loading"><span class="spinner"></span><h3>正在解析 ${esc(data.fileName)}</h3><p>FIT 轨迹读取中…</p></div>`;
  } else if (data.status === 'error') {
    content = `
      <div class="import-error">
        <span>${icon('info', 28)}</span>
        <h3>文件解析失败</h3>
        <p>${esc(data.error)}</p>
      </div>
      <div class="import-foot">
        <button class="text-link" data-action="import-retry">重新选择文件</button>
        <button class="text-link" data-action="download-template">${icon('download', 15)} 下载 CSV 模板</button>
      </div>`;
  } else {
    const activities = data.activities || [];
    const totalDistance = activities.reduce((s, a) => s + activityDistance(a), 0);
    const totalMinutes = activities.reduce((s, a) => s + (a.duration || 0), 0);
    content = `
      <div class="file-card">
        <span class="file-ico">${icon('file', 22)}</span>
        <div><strong>${esc(data.fileName)}</strong><em>${data.format} · 解析完成 · ${activities.length} 条记录</em></div>
        <span class="file-ok">${icon('check', 14)} 可导入</span>
      </div>
      <div class="import-summary">
        <div><span>记录数</span><strong>${activities.length}</strong></div>
        <div><span>总时长</span><strong>${fmtDuration(totalMinutes)}</strong></div>
        <div><span>总距离</span><strong>${fmtDistance(totalDistance)}</strong></div>
      </div>
      <div class="import-preview">
        ${activities.slice(0, 6).map((a) => {
          const sport = SPORTS[a.type] || SPORTS.other;
          return `<div class="import-preview-row">
            <span class="import-sport" style="--sport:${sport.color}">${icon(sport.icon, 16)}</span>
            <span><strong>${sport.label}</strong><em>${fmtDate(a.date, 'md')} · ${fmtDuration(a.duration)}</em></span>
            <span>${activityDistance(a) ? fmtDistance(a.distance) : '—'}</span>
            <span>${a.avgHr ? `${a.avgHr} bpm` : '—'}</span>
          </div>`;
        }).join('')}
        ${activities.length > 6 ? `<p class="preview-more">还有 ${activities.length - 6} 条记录未展示</p>` : ''}
      </div>
      <p class="import-note">${icon('info', 14)} 与现有记录日期、类型、时长完全相同的条目将自动跳过。</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-action="import-retry">重新选择</button>
        <button class="btn btn-primary" data-action="import-confirm">导入 ${activities.length} 条记录 ${icon('arrow', 16)}</button>
      </div>`;
  }

  openModal(`
    ${modalHead('IMPORT DATA', '导入运动记录', '支持手表文件与表格，解析全程在本地完成。')}
    <input type="file" id="import-file" accept=".fit,.gpx,.tcx,.csv,.json,.txt" hidden>
    ${content}`, 'modal--import');
}

async function handleImportFile(file) {
  state.importData = { status: 'loading', fileName: file.name };
  openImportModal();
  try {
    const result = await parseFile(file);
    state.importData = { status: 'ready', ...result };
    openImportModal();
  } catch (error) {
    state.importData = { status: 'error', fileName: file.name, error: error.message || '无法解析该文件' };
    openImportModal();
  }
}

async function confirmImport() {
  const data = state.importData;
  if (!data || data.status !== 'ready') return;
  const button = document.querySelector('[data-action="import-confirm"]');
  const restore = setBusy(button, '导入中…');
  try {
    const result = await api.bulkActivities({
      activities: data.activities,
      weights: data.weights || []
    });
    let profileRestored = false;
    if (data.profile && typeof data.profile === 'object') {
      try {
        await api.updateProfile(data.profile, data.nickname || state.user?.nickname || '');
        profileRestored = true;
      } catch (profileError) {
        console.warn('[yueji] profile restore failed', profileError);
      }
    }
    await refreshBootstrap();
    state.importData = null;
    closeModal();
    render();
    toast(
      `成功导入 ${result.added || 0} 条记录${result.skipped ? `，跳过 ${result.skipped} 条重复` : ''}${profileRestored ? '，档案已恢复' : ''}`,
      'success'
    );
  } catch (error) {
    toast(error.message || '导入失败，请稍后重试', 'error');
    restore();
  }
}

/* ---------------- 个人资料 ---------------- */

async function handleProfileSave(form) {
  const fd = new FormData(form);
  const height = Number(fd.get('height'));
  const weight = Number(fd.get('weight'));
  const err = document.getElementById('profile-error');
  if (!height || !weight) {
    if (err) { err.textContent = '身高与体重不能为空'; err.classList.add('show'); }
    return;
  }
  const nickname = String(fd.get('nickname') || '').trim();
  if (!nickname) {
    if (err) { err.textContent = '昵称不能为空'; err.classList.add('show'); }
    return;
  }
  if (nickname.length > 20) {
    if (err) { err.textContent = '昵称不能超过 20 个字符'; err.classList.add('show'); }
    return;
  }
  const profile = {
    height,
    weight,
    sex: String(fd.get('sex')),
    ageBand: String(fd.get('ageBand')),
    goal: String(fd.get('goal')),
    freq: Number(fd.get('freq')),
    level: String(fd.get('level'))
  };
  const restore = setBusy(form.querySelector('button[type="submit"]'), '保存中…');
  try {
    await api.updateProfile(profile, nickname);
    await refreshBootstrap();
    render();
    toast('身体档案已更新，指引已重新计算', 'success');
  } catch (error) {
    if (err) { err.textContent = error.message || '保存失败，请稍后重试'; err.classList.add('show'); }
    restore();
  }
}

/* ---------------- 导出 ---------------- */

async function exportData() {
  try {
    const payload = await api.exportData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `跃迹-数据备份-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('数据备份已导出', 'success');
  } catch (error) {
    toast(error.message || '导出失败，请稍后重试', 'error');
  }
}

/* ---------------- 提示 ---------------- */

function toast(message, tone = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast--${tone}`;
  el.innerHTML = `<span class="toast-ico">${icon(tone === 'error' ? 'info' : tone === 'info' ? 'info' : 'check', 16)}</span><span>${esc(message)}</span>`;
  toastRoot.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

init();
