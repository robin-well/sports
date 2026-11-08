/* 跃迹 YUEJI — 数据模型、身体指标与运动指引 */

export const SPORTS = {
  running: {
    key: 'running', label: '跑步', en: 'RUNNING', icon: 'run', color: '#CCF56B',
    metric: 'distance', met: 9.8, unit: 'km',
    desc: '最直接的心肺训练，用稳定的节奏积累有氧底子。'
  },
  cycling: {
    key: 'cycling', label: '骑行', en: 'CYCLING', icon: 'bike', color: '#7FB0FF',
    metric: 'distance', met: 7.5, unit: 'km',
    desc: '低冲击有氧，适合拉长训练时间、建立耐力。'
  },
  strength: {
    key: 'strength', label: '力量训练', en: 'STRENGTH', icon: 'dumbbell', color: '#FF8B68',
    metric: 'duration', met: 6.0, unit: '分钟',
    desc: '守住肌肉与基础代谢，让每一次训练更有效率。'
  },
  swimming: {
    key: 'swimming', label: '游泳', en: 'SWIMMING', icon: 'swim', color: '#63E3CE',
    metric: 'distance', met: 8.0, unit: 'km',
    desc: '全身参与、关节友好，是恢复日的优质选择。'
  },
  hiking: {
    key: 'hiking', label: '徒步', en: 'HIKING', icon: 'mountain', color: '#F7C95C',
    metric: 'distance', met: 6.5, unit: 'km',
    desc: '把训练放进自然里，长时间低强度同样有效。'
  },
  yoga: {
    key: 'yoga', label: '瑜伽', en: 'YOGA', icon: 'yoga', color: '#C7ABFF',
    metric: 'duration', met: 3.0, unit: '分钟',
    desc: '拉伸、呼吸与活动度，帮助身体从训练中恢复。'
  },
  other: {
    key: 'other', label: '其他运动', en: 'OTHER', icon: 'spark', color: '#9AA69C',
    metric: 'duration', met: 5.0, unit: '分钟',
    desc: '球类、爬楼、跳绳……任何让身体动起来的记录。'
  }
};

export const SPORT_KEYS = ['running', 'cycling', 'strength', 'swimming', 'hiking', 'yoga'];

export const STRENGTH_PARTS = [
  { key: 'chest', label: '胸' },
  { key: 'back', label: '背' },
  { key: 'shoulders', label: '肩' },
  { key: 'arms', label: '手臂' },
  { key: 'legs', label: '腿' },
  { key: 'glutes', label: '臀' },
  { key: 'core', label: '核心' },
  { key: 'full', label: '全身' }
];
export const STRENGTH_PART_LABELS = Object.fromEntries(STRENGTH_PARTS.map((p) => [p.key, p.label]));
export const ALL_SPORT_KEYS = [...SPORT_KEYS, 'other'];

export const GOALS = {
  loss: {
    key: 'loss', label: '减脂塑形', short: '减脂', icon: 'flame',
    desc: '降低体脂，同时尽可能保留肌肉线条。',
    weeklyMinutes: [180, 240], calorieAdjust: -350, protein: 1.6,
    quotas: { running: 2, strength: 2, cycling: 1, yoga: 1 },
    accent: '#CCF56B'
  },
  muscle: {
    key: 'muscle', label: '增肌增力', short: '增肌', icon: 'dumbbell',
    desc: '以力量训练为主，循序增加负荷与围度。',
    weeklyMinutes: [150, 210], calorieAdjust: 250, protein: 1.8,
    quotas: { strength: 3, running: 1, yoga: 1 },
    accent: '#FF8B68'
  },
  endurance: {
    key: 'endurance', label: '提升耐力', short: '耐力', icon: 'run',
    desc: '扩大有氧引擎，让长距离变得从容。',
    weeklyMinutes: [240, 360], calorieAdjust: 0, protein: 1.5,
    quotas: { running: 3, cycling: 1, strength: 1 },
    accent: '#7FB0FF'
  },
  health: {
    key: 'health', label: '保持健康', short: '健康', icon: 'heart',
    desc: '规律运动、稳定体重，把状态维持在舒适区间。',
    weeklyMinutes: [150, 180], calorieAdjust: 0, protein: 1.3,
    quotas: { strength: 2, running: 1, cycling: 1, yoga: 1 },
    accent: '#63E3CE'
  },
  posture: {
    key: 'posture', label: '改善体态', short: '体态', icon: 'body',
    desc: '强化核心与背部，改善久坐带来的紧张。',
    weeklyMinutes: [120, 180], calorieAdjust: 0, protein: 1.4,
    quotas: { strength: 2, yoga: 2, swimming: 1 },
    accent: '#C7ABFF'
  },
  stress: {
    key: 'stress', label: '缓解压力', short: '减压', icon: 'leaf',
    desc: '用低强度运动与呼吸练习，让身心松下来。',
    weeklyMinutes: [100, 150], calorieAdjust: 0, protein: 1.2,
    quotas: { yoga: 2, swimming: 1, hiking: 1, running: 1 },
    accent: '#F7C95C'
  }
};

export const GOAL_KEYS = Object.keys(GOALS);

export const SEX_OPTIONS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' }
];

export const AGE_BANDS = [
  { value: '18-25', label: '18–25 岁', mid: 21.5 },
  { value: '26-35', label: '26–35 岁', mid: 30.5 },
  { value: '36-45', label: '36–45 岁', mid: 40.5 },
  { value: '46-55', label: '46–55 岁', mid: 50.5 },
  { value: '56+', label: '56 岁以上', mid: 60.5 }
];

export const LEVELS = [
  { value: 'beginner', label: '刚开始运动（每周少于 1 次）' },
  { value: 'casual', label: '偶尔运动（每周 1–2 次）' },
  { value: 'regular', label: '规律运动（每周 3–4 次）' },
  { value: 'advanced', label: '长期训练（每周 5 次以上）' }
];

export const FREQUENCIES = [2, 3, 4, 5, 6];

export const SOURCE_LABELS = {
  manual: '手动录入',
  fit: 'FIT 文件',
  gpx: 'GPX 轨迹',
  tcx: 'TCX 文件',
  csv: 'CSV 导入',
  json: 'JSON 导入'
};

export const RPE_OPTIONS = [
  { value: 1, label: '1 · 极轻松' },
  { value: 2, label: '2 · 很轻松' },
  { value: 3, label: '3 · 轻松' },
  { value: 4, label: '4 · 舒适' },
  { value: 5, label: '5 · 适中' },
  { value: 6, label: '6 · 有点吃力' },
  { value: 7, label: '7 · 吃力' },
  { value: 8, label: '8 · 很吃力' },
  { value: 9, label: '9 · 非常吃力' },
  { value: 10, label: '10 · 极限' }
];

export const HEIGHT_OPTIONS = range(140, 210, 1);
export const WEIGHT_OPTIONS = range(35, 150, 0.5);

function range(start, end, step) {
  const out = [];
  for (let v = start; v <= end + 1e-9; v += step) out.push(Math.round(v * 10) / 10);
  return out;
}

/* ---------------- 日期与格式 ---------------- */

export const pad2 = (n) => String(n).padStart(2, '0');
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const parseDate = (key) => {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
};
export const addDays = (d, n) => {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  copy.setDate(copy.getDate() + n);
  return copy;
};
export const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
export const todayKey = () => dateKey(new Date());

export function fmtDate(key, style = 'short') {
  if (!key) return '—';
  const d = parseDate(key);
  if (style === 'long') return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  if (style === 'md') return `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
}

export function weekdayCN(key) {
  return '日一二三四五六'[parseDate(key).getDay()];
}

export function relativeDay(key) {
  if (!key) return '—';
  const diff = Math.round((parseDate(todayKey()) - parseDate(key)) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff === 2) return '前天';
  if (diff > 2 && diff < 7) return `${diff} 天前`;
  return fmtDate(key, 'md');
}

export function fmtDuration(minutes) {
  const m = Math.round(Number(minutes) || 0);
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} 小时 ${rest} 分` : `${h} 小时`;
}

export function fmtNumber(n, digits = 0) {
  const value = Number(n) || 0;
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

export function fmtDistance(km) {
  if (km == null || Number(km) === 0) return '—';
  const n = Number(km);
  return n >= 100 ? `${fmtNumber(n, 0)} km` : `${fmtNumber(n, n < 10 ? 2 : 1)} km`;
}

export function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/* ---------------- 身体指标 ---------------- */

export function ageMidOf(band) {
  return (AGE_BANDS.find((x) => x.value === band) || AGE_BANDS[1]).mid;
}

export function bmiOf(user) {
  if (!user?.height || !user?.weight) return null;
  return Number(user.weight) / Math.pow(Number(user.height) / 100, 2);
}

export function bmiInfo(bmi) {
  if (bmi == null) return { label: '待完善', tone: 'muted', index: 0 };
  if (bmi < 18.5) return { label: '偏瘦', tone: 'blue', index: 1 };
  if (bmi < 24) return { label: '标准', tone: 'lime', index: 2 };
  if (bmi < 28) return { label: '偏胖', tone: 'amber', index: 3 };
  return { label: '肥胖', tone: 'coral', index: 4 };
}

export function estimateCalories(typeKey, minutes, weightKg = 70) {
  const sport = SPORTS[typeKey] || SPORTS.other;
  return Math.max(1, Math.round((sport.met * 3.5 * Number(weightKg || 70) / 200) * Number(minutes || 0)));
}

export function activityCalories(activity, user) {
  if (activity?.calories) return Math.round(activity.calories);
  return estimateCalories(activity?.type, activity?.duration, user?.weight);
}

export function activityDistance(activity) {
  return Number(activity?.distance) || 0;
}

export function sortActivities(list) {
  return [...list].sort((a, b) => {
    const dateCmp = String(b.date).localeCompare(String(a.date));
    if (dateCmp) return dateCmp;
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
}

export function latestWeight(user, weights = []) {
  const logs = [...weights].filter((w) => w && w.kg).sort((a, b) => a.date.localeCompare(b.date));
  return logs.length ? Number(logs[logs.length - 1].kg) : Number(user?.weight) || null;
}

export function weightTrend(user, weights = []) {
  const logs = [...weights].filter((w) => w && w.kg).sort((a, b) => a.date.localeCompare(b.date));
  if (logs.length < 2) return null;
  const last = logs[logs.length - 1];
  const cutoff = addDays(parseDate(last.date), -30);
  let base = logs[0];
  for (const log of logs) {
    if (parseDate(log.date) <= cutoff) base = log;
  }
  return Number(last.kg) - Number(base.kg);
}

export function caloriePlan(user) {
  if (!user) return null;
  const age = ageMidOf(user.ageBand);
  const male = user.sex !== 'female';
  const weight = Number(user.weight) || 70;
  const height = Number(user.height) || 170;
  const bmr = male
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;
  const factor = user.freq >= 5 ? 1.6 : user.freq >= 3 ? 1.45 : 1.3;
  const tdee = Math.round(bmr * factor);
  const goal = GOALS[user.goal] || GOALS.health;
  const target = Math.round(tdee + goal.calorieAdjust);
  return {
    bmr: Math.round(bmr),
    tdee,
    target,
    protein: Math.round(weight * goal.protein),
    carbs: Math.round((target * 0.45) / 4),
    fat: Math.round((target * 0.28) / 9)
  };
}

export function hrZones(user) {
  const max = Math.round(208 - 0.7 * ageMidOf(user?.ageBand));
  return {
    max,
    z1: `${Math.round(max * 0.5)}–${Math.round(max * 0.6)}`,
    z2: `${Math.round(max * 0.6)}–${Math.round(max * 0.7)}`,
    z3: `${Math.round(max * 0.7)}–${Math.round(max * 0.8)}`,
    z4: `${Math.round(max * 0.8)}–${Math.round(max * 0.9)}`
  };
}

/* ---------------- 周统计 ---------------- */

export function weekRange(offset = 0) {
  const start = addDays(mondayOf(new Date()), offset * 7);
  const end = addDays(start, 6);
  return { start: dateKey(start), end: dateKey(end), startDate: start, endDate: end };
}

export function activitiesInRange(activities, startKey, endKey) {
  return activities.filter((a) => a.date >= startKey && a.date <= endKey);
}

export function weeklySnapshot(activities, user, offset = 0) {
  const range = weekRange(offset);
  const list = activitiesInRange(activities, range.start, range.end);
  const minutes = list.reduce((sum, a) => sum + (Number(a.duration) || 0), 0);
  const calories = list.reduce((sum, a) => sum + activityCalories(a, user), 0);
  const distance = list.reduce((sum, a) => sum + activityDistance(a), 0);
  return {
    ...range, list, minutes, calories, distance,
    sessions: list.length,
    days: new Set(list.map((a) => a.date)).size
  };
}

export function currentStreak(activities) {
  const days = new Set(activities.map((a) => a.date));
  if (!days.size) return 0;
  let cursor = new Date();
  if (!days.has(dateKey(cursor))) {
    cursor = addDays(cursor, -1);
    if (!days.has(dateKey(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(dateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function longestStreak(activities) {
  const days = [...new Set(activities.map((a) => a.date))].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const key of days) {
    if (!prev) {
      run = 1;
    } else {
      const diff = Math.round((parseDate(key) - parseDate(prev)) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    }
    best = Math.max(best, run);
    prev = key;
  }
  return best;
}

export function weeklyTargetMinutes(user) {
  const goal = GOALS[user?.goal] || GOALS.health;
  const base = (goal.weeklyMinutes[0] + goal.weeklyMinutes[1]) / 2;
  const freq = Number(user?.freq) || 4;
  return Math.round(base * (0.55 + freq * 0.11) / 5) * 5;
}

/* ---------------- 运动指引 ---------------- */

const SESSION_LIBRARY = {
  running: {
    title: '轻松跑 · Zone 2',
    short: '轻松跑',
    desc: '用可以正常对话的配速完成有氧，把心率稳定在二区，不追求速度。',
    intensity: '低–中强度',
    tips: ['前 8 分钟慢走 + 动态热身', '全程鼻吸口呼，能说完整句子', '结束后慢走 5 分钟再拉伸']
  },
  cycling: {
    title: '周末骑行 · 有氧耐力',
    short: '骑行',
    desc: '保持踏频 85–95 rpm，选择平缓路线，把时间拉够比冲刺更重要。',
    intensity: '中强度',
    tips: ['检查胎压与刹车，戴好头盔', '每 20 分钟补水 100–150ml', '逆风路段降低齿比，别硬顶']
  },
  strength: {
    title: '全身力量 · 复合动作',
    short: '力量',
    desc: '深蹲、硬拉、推举、划船各 3 组，专注动作质量，最后一组保留 2 次余力。',
    intensity: '中–高强度',
    tips: ['先做 5 分钟关节活动', '组间休息 90–120 秒', '训练后 30 分钟内补充蛋白质']
  },
  swimming: {
    title: '技术游泳 · 轻松划水',
    short: '游泳',
    desc: '以技术练习为主，4×100 米分组，组间充分休息，保持呼吸节奏。',
    intensity: '低–中强度',
    tips: ['下水前活动肩颈与脚踝', '每 50 米关注一次划水次数', '避免空腹下水']
  },
  hiking: {
    title: '徒步 · 低强度长时间',
    short: '徒步',
    desc: '选择 300–500 米爬升的路线，用稳定节奏走完，把它当作主动恢复。',
    intensity: '低强度',
    tips: ['穿抓地好的鞋，带够水', '上坡小步幅，下坡控速度', '回来做小腿与髋部放松']
  },
  yoga: {
    title: '恢复瑜伽 · 髋与肩',
    short: '瑜伽',
    desc: '用 30 分钟流瑜伽或阴瑜伽放松髋、肩与下背，呼吸比幅度更重要。',
    intensity: '低强度',
    tips: ['每个体式停留 5 个呼吸', '不追求疼痛感，只到舒适边缘', '睡前练习效果更好']
  },
  other: {
    title: '自由活动 · 让身体动起来',
    short: '运动',
    desc: '选择你喜欢的项目，保持 30 分钟以上中等强度活动即可。',
    intensity: '中强度',
    tips: ['提前 5 分钟热身', '中途少量多次补水', '以微微出汗、能说话为准']
  }
};

function sessionFor(type, user, extra = {}) {
  const base = SESSION_LIBRARY[type] || SESSION_LIBRARY.other;
  const sport = SPORTS[type] || SPORTS.other;
  const zones = hrZones(user);
  const duration = extra.duration || (type === 'cycling' ? 60 : type === 'running' ? 40 : type === 'strength' ? 45 : type === 'hiking' ? 120 : type === 'swimming' ? 40 : 30);
  return {
    type, ...base, duration,
    color: sport.color,
    hr: type === 'strength' ? '以动作质量为准' : `目标心率 ${zones.z2} bpm`,
    ...extra
  };
}

export function computeGuidance(user, activities) {
  if (!user) return null;
  const goal = GOALS[user.goal] || GOALS.health;
  const target = weeklyTargetMinutes(user);
  const snapshot = weeklySnapshot(activities, user);
  const prev = weeklySnapshot(activities, user, -1);
  const sorted = sortActivities(activities);
  const last = sorted[0] || null;
  const daysSinceLast = last ? Math.round((parseDate(todayKey()) - parseDate(last.date)) / 86400000) : null;
  const streak = currentStreak(activities);
  const progress = target ? clamp(snapshot.minutes / target, 0, 1) : 0;
  const zones = hrZones(user);
  const load = trainingLoad(activities, user);

  let mode = 'train';
  let reason = '';

  if (!last) {
    mode = 'start';
    reason = '还没有运动记录，从一次轻量训练开始，先让身体动起来。';
  } else if (daysSinceLast === 0 && snapshot.minutes >= 30) {
    mode = 'recover';
    reason = '今天已经完成训练，恢复也是计划的一部分。';
  } else if (snapshot.minutes >= target && snapshot.sessions >= (user.freq || 4)) {
    mode = 'recover';
    reason = '本周目标已经达成，给身体留出修复和生长的时间。';
  } else if (daysSinceLast >= 5) {
    mode = 'restart';
    reason = `已经 ${daysSinceLast} 天没有训练，先以低强度找回节奏，不建议直接上强度。`;
  } else if (load.ratio > 1.5) {
    mode = 'recover';
    reason = `近 7 天训练负荷是 4 周平均的 ${load.ratio.toFixed(2)} 倍，增长过快，今天优先恢复。`;
  }

  let session;
  if (mode === 'recover' || mode === 'start' || mode === 'restart') {
    session = mode === 'start'
      ? sessionFor('running', user, {
          title: '第一次 · 走跑结合',
          short: '走跑结合',
          duration: 25,
          desc: '快走 3 分钟 + 慢跑 2 分钟，循环 4 组。重点不是距离，而是完成。',
          intensity: '低强度',
          tips: ['穿一双合脚的缓震跑鞋', '用能聊天的速度慢跑', '结束后记录感受，不追求配速']
        })
      : mode === 'restart'
        ? sessionFor('running', user, {
            title: '找回节奏 · 轻松跑',
            short: '轻松跑',
            duration: 25,
            desc: '用比平时慢 30–60 秒的配速跑 25 分钟，心率不超过二区上限。',
            intensity: '低强度',
            tips: ['先快走 5 分钟唤醒身体', '感觉吃力就改为走跑结合', '这次训练只求恢复习惯']
          })
        : sessionFor('yoga', user, {
            title: '主动恢复 · 拉伸与呼吸',
            short: '主动恢复',
            duration: 25,
            desc: '用低强度活动促进血液循环：散步 15 分钟 + 髋肩拉伸 10 分钟。',
            intensity: '恢复',
            tips: ['不安排力量与高强度有氧', '补充水分与电解质', '保证 7–9 小时睡眠']
          });
  } else {
    const counts = {};
    for (const key of Object.keys(goal.quotas)) {
      counts[key] = snapshot.list.filter((a) => a.type === key).length;
    }
    const quotaKeys = Object.keys(goal.quotas);
    const remaining = quotaKeys
      .filter((key) => counts[key] < goal.quotas[key])
      .sort((a, b) => {
        const deficitA = goal.quotas[a] - counts[a];
        const deficitB = goal.quotas[b] - counts[b];
        if (deficitB !== deficitA) return deficitB - deficitA;
        return quotaKeys.indexOf(a) - quotaKeys.indexOf(b);
      });
    const pick = remaining[0] || 'yoga';
    session = sessionFor(pick, user);
    if (goal.key === 'endurance' && pick === 'running' && snapshot.list.filter((a) => a.type === 'running').length >= 2) {
      session = sessionFor('running', user, {
        title: '长距离慢跑 · 耐力',
        short: '长距离慢跑',
        duration: 70,
        desc: '用 Zone 2 配速完成一次 70 分钟长距离，节奏均匀，最后 10 分钟可略提速。',
        intensity: '中强度'
      });
    }
    const left = Math.max(0, target - snapshot.minutes);
    reason = left > 0
      ? `本周已训练 ${Math.round(snapshot.minutes)} 分钟，距离目标还差 ${Math.round(left)} 分钟。`
      : '本周训练量已达标，可以补一次低强度活动保持节奏。';
  }

  return {
    goal, target, snapshot, prev, progress, streak, last, daysSinceLast,
    mode, reason, session, zones, load,
    remaining: Math.max(0, target - snapshot.minutes),
    calorie: caloriePlan(user),
    weight: latestWeight(user)
  };
}

/* 7 天训练安排 */
const WEEK_TEMPLATES = {
  loss: [
    ['strength', '全身力量'], ['running', '轻松跑'], ['yoga', '恢复瑜伽'], ['strength', '下肢力量'],
    ['running', '节奏跑'], ['cycling', '周末骑行'], [null, '完全休息']
  ],
  muscle: [
    ['strength', '推 · 胸肩三头'], ['running', '轻松跑'], [null, '休息'], ['strength', '拉 · 背二头'],
    ['strength', '腿 · 深蹲硬拉'], ['yoga', '活动度'], [null, '完全休息']
  ],
  endurance: [
    ['running', '轻松跑'], ['strength', '核心与力量'], ['running', '间歇跑'], [null, '休息'],
    ['cycling', '有氧骑行'], [null, '休息'], ['running', '长距离慢跑']
  ],
  health: [
    ['strength', '全身力量'], ['running', '轻松跑'], ['yoga', '拉伸'], ['strength', '核心训练'],
    [null, '休息'], ['cycling', '户外骑行'], ['yoga', '恢复']
  ],
  posture: [
    ['strength', '核心与臀'], ['yoga', '肩颈放松'], ['swimming', '技术游泳'], ['strength', '背部强化'],
    ['yoga', '髋部打开'], [null, '散步'], [null, '休息']
  ],
  stress: [
    ['yoga', '舒缓瑜伽'], ['hiking', '公园快走'], ['swimming', '轻松游泳'], ['yoga', '呼吸练习'],
    [null, '休息'], ['hiking', '自然徒步'], [null, '休息']
  ]
};

export function buildWeekPlan(user) {
  const goal = GOALS[user?.goal] || GOALS.health;
  const template = WEEK_TEMPLATES[goal.key] || WEEK_TEMPLATES.health;
  const today = new Date();
  const monday = mondayOf(today);
  const todayIndex = (today.getDay() + 6) % 7;
  const durations = { strength: 45, running: 45, cycling: 60, yoga: 35, swimming: 40, hiking: 90, other: 30 };
  return template.map(([type, title], i) => {
    const date = addDays(monday, i);
    return {
      type,
      title,
      date: dateKey(date),
      dayLabel: '周' + '一二三四五六日'[i],
      dayNum: date.getDate(),
      isToday: i === todayIndex,
      isPast: i < todayIndex,
      duration: type ? durations[type] : 0,
      color: type ? SPORTS[type].color : '#55605A'
    };
  });
}

export function personalBests(activities, user) {
  const distanceList = activities.filter((a) => activityDistance(a) > 0);
  const longest = [...distanceList].sort((a, b) => activityDistance(b) - activityDistance(a))[0];
  const longestTime = [...activities].sort((a, b) => (b.duration || 0) - (a.duration || 0))[0];
  const burn = [...activities].sort((a, b) => activityCalories(b, user) - activityCalories(a, user))[0];
  const types = new Set(activities.map((a) => a.type));
  return { longest, longestTime, burn, typeCount: types.size };
}

export function trainingBalance(activities, user) {
  const aerobic = activities.filter((a) => ['running', 'cycling', 'swimming', 'hiking'].includes(a.type))
    .reduce((sum, a) => sum + (a.duration || 0), 0);
  const strength = activities.filter((a) => a.type === 'strength').reduce((sum, a) => sum + (a.duration || 0), 0);
  const mobility = activities.filter((a) => a.type === 'yoga').reduce((sum, a) => sum + (a.duration || 0), 0);
  const total = aerobic + strength + mobility || 1;
  return {
    aerobic, strength, mobility,
    aerobicPct: Math.round((aerobic / total) * 100),
    strengthPct: Math.round((strength / total) * 100),
    mobilityPct: Math.round((mobility / total) * 100)
  };
}

/* ---------------- 训练负荷 / 日历 / 成就 ---------------- */

export function activityRpe(activity) {
  if (activity?.rpe) return clamp(Math.round(Number(activity.rpe)), 1, 10);
  const base = { running: 6, cycling: 5, strength: 7, swimming: 6, hiking: 4, yoga: 2, other: 5 };
  let rpe = base[activity?.type] ?? 5;
  if (activity?.avgHr) {
    rpe += (Number(activity.avgHr) - 135) / 18;
  }
  return clamp(Math.round(rpe), 1, 10);
}

export function sessionLoad(activity) {
  return Math.round((Number(activity?.duration) || 0) * activityRpe(activity));
}

export function trainingLoad(activities, user) {
  const today = new Date();
  const range = (daysBack) => {
    const start = dateKey(addDays(today, -daysBack + 1));
    const end = dateKey(today);
    return activities.filter((a) => a.date >= start && a.date <= end);
  };
  const acuteList = range(7);
  const chronicList = range(28);
  const acute = acuteList.reduce((sum, a) => sum + sessionLoad(a), 0);
  const chronicTotal = chronicList.reduce((sum, a) => sum + sessionLoad(a), 0);
  const chronic = chronicTotal / 4;
  const ratio = chronic > 0 ? acute / chronic : 0;
  const weeklyLoads = Array.from({ length: 8 }).map((_, i) => {
    const snap = weeklySnapshot(activities, user, i - 7);
    return snap.list.reduce((sum, a) => sum + sessionLoad(a), 0);
  });

  let status;
  if (!acute && !chronic) {
    status = { label: '暂无数据', tone: 'muted', desc: '完成几次训练后，这里会评估你的负荷与恢复状态。' };
  } else if (!chronic) {
    status = { label: '负荷建立中', tone: 'blue', desc: '还处于训练负荷建立阶段，先保持规律，再逐步增加训练量。' };
  } else if (ratio > 1.5) {
    status = { label: '负荷过高', tone: 'coral', desc: '近 7 天负荷明显高于 4 周平均，建议安排低强度恢复。' };
  } else if (ratio > 1.3) {
    status = { label: '负荷偏高', tone: 'amber', desc: '负荷上升较快，注意睡眠与营养，下一练降低强度。' };
  } else if (ratio < 0.8) {
    status = { label: '负荷偏低', tone: 'blue', desc: '训练量低于近期平均，可以逐步增加有氧或力量训练。' };
  } else {
    status = { label: '负荷合理', tone: 'lime', desc: '负荷变化平稳，保持当前节奏，继续积累。' };
  }
  return {
    acute: Math.round(acute),
    chronic: Math.round(chronic),
    ratio: Math.round(ratio * 100) / 100,
    status,
    weeklyLoads,
    acuteSessions: acuteList.length
  };
}

export function heatmapData(activities, user, weeks = 12) {
  const today = new Date();
  const lastMonday = mondayOf(today);
  const start = addDays(lastMonday, -7 * (weeks - 1));
  const result = [];
  let activeDays = 0;
  let totalMinutes = 0;
  let lastMonth = -1;

  for (let w = 0; w < weeks; w += 1) {
    const weekStart = addDays(start, w * 7);
    const days = [];
    for (let d = 0; d < 7; d += 1) {
      const date = addDays(weekStart, d);
      const key = dateKey(date);
      const list = activities.filter((a) => a.date === key);
      const minutes = list.reduce((sum, a) => sum + (a.duration || 0), 0);
      const types = {};
      list.forEach((a) => { types[a.type] = (types[a.type] || 0) + (a.duration || 0); });
      const dominant = Object.entries(types).sort((a, b) => b[1] - a[1])[0]?.[0];
      let level = 0;
      if (minutes > 0) level = minutes < 25 ? 1 : minutes < 50 ? 2 : minutes < 80 ? 3 : 4;
      if (minutes > 0) { activeDays += 1; totalMinutes += minutes; }
      days.push({
        key,
        day: date.getDate(),
        minutes,
        sessions: list.length,
        color: dominant ? (SPORTS[dominant] || SPORTS.other).color : null,
        level,
        future: date > today,
        isToday: key === todayKey()
      });
    }
    const month = weekStart.getMonth();
    const label = month !== lastMonth ? `${month + 1}月` : '';
    if (month !== lastMonth) lastMonth = month;
    result.push({ days, label });
  }
  return { weeks: result, start: dateKey(start), end: todayKey(), activeDays, totalMinutes };
}

export function computeAchievements(user, activities) {
  const totalDistance = activities.reduce((sum, a) => sum + activityDistance(a), 0);
  const strengthCount = activities.filter((a) => a.type === 'strength').length;
  const types = new Set(activities.map((a) => a.type)).size;
  const maxSingle = Math.max(0, ...activities.map((a) => activityDistance(a)));
  const streak = longestStreak(activities);
  const target = weeklyTargetMinutes(user);
  const weekMinutes = weeklySnapshot(activities, user).minutes;
  const items = [
    { id: 'first', icon: 'spark', title: '第一步', desc: '完成第一次运动记录', current: activities.length, target: 1 },
    { id: 'streak3', icon: 'flame', title: '连续 3 天', desc: '连续三天保持训练', current: streak, target: 3 },
    { id: 'distance100', icon: 'distance', title: '百公里', desc: '累计运动距离达到 100 km', current: totalDistance, target: 100, unit: 'km' },
    { id: 'strength10', icon: 'dumbbell', title: '力量常客', desc: '累计完成 10 次力量训练', current: strengthCount, target: 10 },
    { id: 'weekgoal', icon: 'target', title: '本周达标', desc: `单周训练达到 ${target} 分钟`, current: weekMinutes, target },
    { id: 'explorer', icon: 'compass', title: '运动探索者', desc: '尝试 4 种不同的运动', current: types, target: 4, unit: '种' },
    { id: 'single10', icon: 'run', title: '十公里俱乐部', desc: '单次运动距离达到 10 km', current: maxSingle, target: 10, unit: 'km' }
  ].map((item) => ({
    ...item,
    earned: item.current >= item.target,
    progress: clamp(item.current / item.target, 0, 1),
    current: Math.round(item.current * 10) / 10
  }));
  return { items, earned: items.filter((i) => i.earned).length, total: items.length };
}

export function streamZoneStats(stream, user) {
  if (!Array.isArray(stream) || !stream.length) return null;
  const zones = hrZones(user);
  const bounds = [0, Number(zones.z2.split('–')[0]), Number(zones.z3.split('–')[0]), Number(zones.z4.split('–')[0])];
  const counts = [0, 0, 0, 0];
  let hrCount = 0;
  let maxHr = 0;
  let sumHr = 0;
  for (const point of stream) {
    const hr = Number(point.hr);
    if (!hr) continue;
    hrCount += 1;
    sumHr += hr;
    maxHr = Math.max(maxHr, hr);
    let zone = 0;
    for (let i = 1; i < bounds.length; i += 1) {
      if (hr >= bounds[i]) zone = i;
    }
    counts[zone] += 1;
  }
  if (!hrCount) return null;
  return {
    avgHr: Math.round(sumHr / hrCount),
    maxHr,
    counts,
    pcts: counts.map((c) => Math.round((c / hrCount) * 100))
  };
}

function demoStream(type, duration, distance, avgHr) {
  const points = clamp(Math.round(duration / 2.5), 12, 36);
  const out = [];
  for (let i = 0; i < points; i += 1) {
    const p = i / (points - 1);
    const t = Math.round(p * duration);
    const warm = i < 3 ? -14 + i * 4 : 0;
    const wave = Math.sin(i * 0.75) * 6 + Math.sin(i * 0.28) * 4;
    out.push({
      t,
      hr: Math.max(70, Math.round(avgHr + warm + wave)),
      dist: distance ? Math.round(distance * p * 100) / 100 : null
    });
  }
  return out;
}

/* ---------------- 示例数据 ---------------- */

export function buildDemoUser() {
  return {
    phone: '13800008888',
    nickname: '林一',
    createdAt: new Date().toISOString(),
    wechat: { bound: true, nickname: '林一', boundAt: new Date().toISOString() },
    profile: {
      sex: 'male',
      ageBand: '26-35',
      height: 176,
      weight: 72.4,
      goal: 'loss',
      freq: 4,
      level: 'regular',
      targetWeight: 68
    }
  };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDemoActivities(weeks = 12) {
  const rand = mulberry32(20261108);
  const out = [];
  const today = new Date();
  const thisMonday = mondayOf(today);
  const todayIndex = (today.getDay() + 6) % 7;
  const weight = 73.2;
  const sources = ['fit', 'fit', 'manual', 'gpx'];
  let seq = 0;

  const push = (date, type, duration, distance, avgHr, extra = {}) => {
    if (date > today) return;
    seq += 1;
    out.push({
      id: `demo-${seq}`,
      type,
      date: dateKey(date),
      duration: Math.round(duration),
      distance: distance == null ? null : Math.round(distance * 100) / 100,
      calories: estimateCalories(type, duration, weight),
      avgHr: Math.round(avgHr),
      rpe: activityRpe({ type, avgHr }),
      stream: demoStream(type, duration, distance, avgHr),
      source: extra.source || sources[seq % sources.length],
      notes: extra.notes || '',
      createdAt: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 7 + (seq % 10), 10).toISOString()
    });
  };

  for (let w = weeks - 1; w >= 0; w -= 1) {
    const monday = addDays(thisMonday, -7 * w);
    const factor = 1 - w * 0.012;
    const add = (dayOffset, fn) => {
      const date = addDays(monday, dayOffset);
      if (w === 0 && dayOffset > todayIndex) return;
      fn(date);
    };

    // 每周固定：一次力量、一次轻松跑、一次力量、一次长距离/骑行
    add(0, (d) => push(d, 'strength', 38 + rand() * 7, null, 116 + rand() * 14));
    add(1, (d) => {
      const mins = (32 + rand() * 6) * factor;
      push(d, 'running', mins, mins / (5.8 + rand() * 0.6), 145 + rand() * 10);
    });
    add(3, (d) => push(d, 'strength', 38 + rand() * 8, null, 120 + rand() * 13));
    add(5, (d) => {
      if (w % 2 === 0) {
        const mins = 46 + rand() * 15;
        push(d, 'cycling', mins, mins / 60 * (23 + rand() * 4), 130 + rand() * 13);
      } else {
        const mins = (44 + rand() * 12) * factor;
        push(d, 'running', mins, mins / (5.5 + rand() * 0.5), 150 + rand() * 11, {
          notes: w % 4 === 1 ? '沿江慢跑，最后 2 公里稍微提速。' : ''
        });
      }
    });

    // 偶尔增加恢复瑜伽、第二次短跑、游泳与徒步
    if (w % 3 === 1) add(2, (d) => push(d, 'yoga', 26 + rand() * 10, null, 90 + rand() * 8));
    if (w % 2 === 1) {
      add(2, (d) => {
        const mins = (27 + rand() * 7) * factor;
        push(d, 'running', mins, mins / (6.1 + rand() * 0.4), 138 + rand() * 9);
      });
    }
    if (w % 4 === 2) add(4, (d) => push(d, 'swimming', 34 + rand() * 10, 1.1 + rand() * 0.6, 130 + rand() * 9));
    if (w === 9 || w === 4) {
      add(6, (d) => push(d, 'hiking', 120 + rand() * 45, 7 + rand() * 4, 116 + rand() * 10, {
        notes: '山里信号一般，轨迹由手表记录。'
      }));
    }
  }
  return sortActivities(out);
}

export function generateDemoWeights(weeks = 12) {
  const rand = mulberry32(88991);
  const out = [];
  const start = addDays(new Date(), -weeks * 7);
  const totalDays = weeks * 7;
  for (let i = 0; i <= totalDays; i += 3) {
    const d = addDays(start, i);
    if (d > new Date()) break;
    const t = i / totalDays;
    const kg = 76.9 - t * 4.5 + (rand() - 0.5) * 0.5;
    out.push({ date: dateKey(d), kg: Math.round(kg * 10) / 10 });
  }
  const last = out[out.length - 1];
  if (last && last.date === todayKey()) last.kg = 72.4;
  else out.push({ date: todayKey(), kg: 72.4 });
  return out;
}

export function demoDataset() {
  return {
    user: buildDemoUser(),
    activities: generateDemoActivities(),
    weights: generateDemoWeights()
  };
}
