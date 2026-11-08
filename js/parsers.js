/* 运动文件解析：FIT / GPX / TCX / CSV / JSON
 * 浏览器内完成，不上传任何文件。
 */

import { dateKey, pad2, uid, SPORTS } from './data.js';

const FIT_EPOCH = Date.UTC(1989, 11, 31, 0, 0, 0);

const FIT_SPORT_MAP = {
  1: 'running', 2: 'cycling', 4: 'strength', 5: 'swimming', 10: 'strength',
  11: 'hiking', 15: 'other', 16: 'hiking', 17: 'hiking', 21: 'cycling',
  30: 'other', 31: 'other', 33: 'other', 35: 'hiking', 37: 'other',
  38: 'other', 39: 'other', 40: 'other', 41: 'other', 42: 'other',
  47: 'other', 48: 'other', 49: 'other', 50: 'other', 51: 'other',
  62: 'yoga'
};

const FIT_SPORT_NAMES = {
  1: '跑步', 2: '骑行', 4: '力量', 5: '游泳', 10: '力量', 11: '步行', 15: '划船',
  16: '登山', 17: '徒步', 21: '电助力骑行', 62: '瑜伽'
};

const FIT_FIELD_META = {
  0: {
    0: ['file_type', 'enum'],
    4: ['time_created', 'date']
  },
  18: {
    253: ['timestamp', 'date'],
    2: ['start_time', 'date'],
    5: ['sport', 'enum'],
    6: ['sub_sport', 'enum'],
    7: ['total_elapsed_time', 'duration'],
    8: ['total_timer_time', 'duration'],
    9: ['total_distance', 'distance'],
    11: ['total_calories', 'uint'],
    14: ['avg_speed', 'speed'],
    15: ['max_speed', 'speed'],
    16: ['avg_heart_rate', 'uint'],
    17: ['max_heart_rate', 'uint'],
    22: ['total_ascent', 'uint'],
    23: ['total_descent', 'uint']
  },
  19: {
    253: ['timestamp', 'date'],
    2: ['start_time', 'date'],
    7: ['total_elapsed_time', 'duration'],
    8: ['total_timer_time', 'duration'],
    9: ['total_distance', 'distance'],
    11: ['total_calories', 'uint'],
    13: ['avg_speed', 'speed'],
    15: ['avg_heart_rate', 'uint'],
    16: ['max_heart_rate', 'uint'],
    25: ['sport', 'enum']
  },
  20: {
    253: ['timestamp', 'date'],
    0: ['position_lat', 'semicircle'],
    1: ['position_long', 'semicircle'],
    2: ['altitude', 'altitude'],
    3: ['heart_rate', 'uint'],
    4: ['cadence', 'uint'],
    5: ['distance', 'distance'],
    6: ['speed', 'speed'],
    7: ['power', 'uint'],
    13: ['temperature', 'sint'],
    73: ['enhanced_speed', 'speed'],
    78: ['enhanced_altitude', 'altitude']
  }
};

/* ---------- 基础工具 ---------- */

function readDate(seconds) {
  if (!seconds || seconds === 0xFFFFFFFF) return null;
  const d = new Date(FIT_EPOCH + Number(seconds) * 1000);
  return Number.isNaN(d.getTime()) ? null : d;
}

function localDateKey(date) {
  return dateKey(date);
}

function localTime(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function inferType(text = '') {
  const s = String(text).toLowerCase();
  if (/骑行|单车|cycling|bike|biking|ride|cycle/.test(s)) return 'cycling';
  if (/游泳|swim|pool/.test(s)) return 'swimming';
  if (/力量|举铁|strength|weight|gym|training|workout/.test(s)) return 'strength';
  if (/徒步|登山|hiking|hike|mountaineer|trail/.test(s)) return 'hiking';
  if (/瑜伽|yoga|pilates|拉伸|mobility/.test(s)) return 'yoga';
  if (/跑|run|jog|treadmill/.test(s)) return 'running';
  return 'other';
}

function typeFromLabel(label) {
  const s = String(label || '').trim().toLowerCase();
  const map = {
    '跑步': 'running', running: 'running', run: 'running', 慢跑: 'running', 越野跑: 'running',
    '骑行': 'cycling', cycling: 'cycling', bike: 'cycling', biking: 'cycling', 单车: 'cycling',
    '力量训练': 'strength', 力量: 'strength', strength: 'strength', 健身: 'strength', gym: 'strength',
    '游泳': 'swimming', swimming: 'swimming', swim: 'swimming',
    '徒步': 'hiking', hiking: 'hiking', hike: 'hiking', 登山: 'hiking', 步行: 'hiking', walking: 'hiking',
    '瑜伽': 'yoga', yoga: 'yoga', 拉伸: 'yoga',
    '其他': 'other', other: 'other', 其他运动: 'other'
  };
  return map[s] || inferType(s);
}

function activityFrom({ type, date, duration, distance, calories, avgHr, maxHr, elevation, notes, source, startTime, stream, rpe, strength }) {
  return {
    id: uid(),
    type: SPORTS[type] ? type : 'other',
    date: date || dateKey(),
    startTime: startTime || '',
    duration: Math.max(0, Math.round(Number(duration) || 0)),
    distance: distance == null ? null : Math.round(Number(distance) * 100) / 100,
    calories: calories ? Math.round(Number(calories)) : null,
    avgHr: avgHr ? Math.round(Number(avgHr)) : null,
    maxHr: maxHr ? Math.round(Number(maxHr)) : null,
    elevation: elevation ? Math.round(Number(elevation)) : null,
    notes: notes || '',
    source: source || 'manual',
    ...(Number.isFinite(Number(rpe)) ? { rpe: Math.max(1, Math.min(10, Math.round(Number(rpe)))) } : {}),
    ...(Array.isArray(strength) && strength.length ? { strength } : {}),
    ...(Array.isArray(stream) && stream.length ? { stream } : {}),
    createdAt: new Date().toISOString()
  };
}

function downsample(points, max = 240) {
  if (!Array.isArray(points) || points.length <= max) return points || [];
  const out = [];
  for (let i = 0; i < max; i += 1) {
    out.push(points[Math.round((i / (max - 1)) * (points.length - 1))]);
  }
  return out;
}

function fitStream(records, start, durationSec) {
  if (!start || !records?.length) return [];
  const startMs = start.getTime();
  const endMs = startMs + Math.max(durationSec || 0, 1) * 1000 + 5000;
  const points = records
    .filter((r) => r.timestamp && r.timestamp.getTime() >= startMs - 5000 && r.timestamp.getTime() <= endMs)
    .map((r) => ({
      t: Math.max(0, Math.round((r.timestamp.getTime() - startMs) / 60000)),
      hr: r.heart_rate || null,
      lat: Number.isFinite(r.position_lat) ? Math.round(r.position_lat * 1e6) / 1e6 : null,
      lon: Number.isFinite(r.position_long) ? Math.round(r.position_long * 1e6) / 1e6 : null,
      dist: r.distance != null ? Math.round((Number(r.distance) / 1000) * 100) / 100 : null,
      ele: r.enhanced_altitude != null ? Math.round(r.enhanced_altitude) : r.altitude != null ? Math.round(r.altitude) : null,
      speed: r.enhanced_speed != null ? r.enhanced_speed : r.speed != null ? r.speed : null
    }));
  return downsample(points);
}

/* ---------- FIT ---------- */

const FIT_BASE = {
  0x00: { size: 1, get: (v, o) => v.getUint8(o), invalid: 0xFF, signed: false },
  0x01: { size: 1, get: (v, o) => v.getInt8(o), invalid: 0x7F, signed: true },
  0x02: { size: 1, get: (v, o) => v.getUint8(o), invalid: 0xFF, signed: false },
  0x03: { size: 2, get: (v, o, le) => (le ? v.getInt16(o, true) : v.getInt16(o, false)), invalid: 0x7FFF, signed: true },
  0x04: { size: 2, get: (v, o, le) => (le ? v.getUint16(o, true) : v.getUint16(o, false)), invalid: 0xFFFF, signed: false },
  0x05: { size: 4, get: (v, o, le) => (le ? v.getInt32(o, true) : v.getInt32(o, false)), invalid: 0x7FFFFFFF, signed: true },
  0x06: { size: 4, get: (v, o, le) => (le ? v.getUint32(o, true) : v.getUint32(o, false)), invalid: 0xFFFFFFFF, signed: false },
  0x07: { size: 1, get: null, invalid: null, string: true },
  0x08: { size: 4, get: (v, o, le) => (le ? v.getFloat32(o, true) : v.getFloat32(o, false)), invalid: null, signed: true },
  0x09: { size: 8, get: (v, o, le) => (le ? v.getFloat64(o, true) : v.getFloat64(o, false)), invalid: null, signed: true },
  0x0A: { size: 1, get: (v, o) => v.getUint8(o), invalid: 0, signed: false },
  0x0B: { size: 2, get: (v, o, le) => (le ? v.getUint16(o, true) : v.getUint16(o, false)), invalid: 0, signed: false },
  0x0C: { size: 4, get: (v, o, le) => (le ? v.getUint32(o, true) : v.getUint32(o, false)), invalid: 0, signed: false },
  0x0D: { size: 1, get: (v, o) => v.getUint8(o), invalid: null, signed: false },
  0x0E: { size: 8, get: (v, o, le) => Number(le ? v.getBigInt64(o, true) : v.getBigInt64(o, false)), invalid: null, signed: true },
  0x0F: { size: 8, get: (v, o, le) => Number(le ? v.getBigUint64(o, true) : v.getBigUint64(o, false)), invalid: 0, signed: false },
  0x10: { size: 8, get: (v, o, le) => Number(le ? v.getBigUint64(o, true) : v.getBigUint64(o, false)), invalid: 0, signed: false }
};

export function parseFit(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 14) throw new Error('FIT 文件过短，可能已损坏');
  const headerSize = bytes[0];
  if (headerSize < 12 || headerSize > 14) throw new Error('不是有效的 FIT 文件头');
  const signature = String.fromCharCode(...bytes.slice(8, 12));
  if (signature !== '.FIT') throw new Error('文件缺少 .FIT 标识，无法识别');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dataSize = view.getUint32(4, true);
  const end = Math.min(headerSize + dataSize, bytes.length);
  let offset = headerSize;
  const defs = {};
  const messages = [];
  let lastTimestamp = null;
  let guard = 0;

  while (offset < end) {
    if (++guard > 500000) throw new Error('FIT 文件消息数量异常');
    const header = bytes[offset++];
    const compressed = (header & 0x80) !== 0;
    // Bit 6 also belongs to the local-message-type bits in a compressed
    // timestamp header, so compressed must be checked first.
    const isDefinition = !compressed && (header & 0x40) !== 0;
    const localType = compressed ? (header >> 5) & 0x03 : header & 0x0f;

    if (isDefinition) {
      if (offset + 5 > end) break;
      offset += 1; // reserved
      const little = bytes[offset++] === 0;
      const global = little ? view.getUint16(offset, true) : view.getUint16(offset, false);
      offset += 2;
      const fieldCount = bytes[offset++];
      const fields = [];
      for (let i = 0; i < fieldCount; i += 1) {
        if (offset + 3 > end) break;
        fields.push({ num: bytes[offset++], size: bytes[offset++], base: bytes[offset++] });
      }
      const devFieldSizes = [];
      if (header & 0x20) {
        if (offset + 1 > end) break;
        const devCount = bytes[offset++];
        for (let i = 0; i < devCount; i += 1) {
          if (offset + 3 > end) break;
          offset += 1; // developer field number
          devFieldSizes.push(bytes[offset++]); // field size
          offset += 1; // developer data index
        }
      }
      defs[localType] = { global, little, fields, devFieldSizes };
      continue;
    }

    const def = defs[localType];
    if (!def) {
      // 没有定义就遇到数据，跳过当前字节继续尝试
      continue;
    }

    const values = {};
    if (compressed) {
      // FIT compressed timestamps store the low 5 bits of the timestamp,
      // not an incremental offset. Rebuild from the previous full timestamp.
      if (lastTimestamp != null) {
        let stamp = (lastTimestamp & ~0x1f) | (header & 0x1f);
        if (stamp < lastTimestamp) stamp += 0x20;
        lastTimestamp = stamp;
        values.timestamp = readDate(stamp);
      }
    }

    for (const field of def.fields) {
      if (compressed && field.num === 253) continue; // 压缩时间戳不出现在数据区
      // The base type is stored in the low five bits. Bit 7 is the
      // endian-capability flag used by real Garmin files (e.g. 0x84 -> uint16).
      const baseType = field.base & 0x1f;
      const base = FIT_BASE[baseType];
      if (!base || field.size <= 0) {
        // Unknown/custom base types still occupy bytes; skip them instead of
        // losing alignment for the rest of the file.
        if (field.size > 0) offset = Math.min(end, offset + field.size);
        continue;
      }
      if (offset + field.size > end) {
        offset = end;
        break;
      }
      if (base.string) {
        let str = '';
        for (let i = 0; i < field.size; i += 1) {
          const c = bytes[offset + i];
          if (c === 0) break;
          str += String.fromCharCode(c);
        }
        values[`f${field.num}`] = str;
      } else {
        const raw = base.get(view, offset, def.little);
        if (base.invalid !== null && raw === base.invalid) {
          // 无效值直接跳过
        } else if (baseType === 0x08 || baseType === 0x09) {
          if (!Number.isNaN(raw)) values[`f${field.num}`] = raw;
        } else {
          values[`f${field.num}`] = raw;
        }
      }
      offset += field.size;
    }

    for (const size of def.devFieldSizes || []) offset += size;

    const meta = FIT_FIELD_META[def.global];
    const mapped = { __global: def.global, __raw: values };
    if (meta) {
      for (const [num, [name, kind]] of Object.entries(meta)) {
        let raw = values[`f${num}`];
        if (raw === undefined) continue;
        if (kind === 'date') {
          const d = readDate(raw);
          if (d) {
            mapped[name] = d;
            if (name === 'timestamp') lastTimestamp = raw;
          }
        } else if (kind === 'duration') {
          mapped[name] = raw / 1000;
        } else if (kind === 'distance') {
          mapped[name] = raw / 100; // 米
        } else if (kind === 'speed') {
          mapped[name] = raw / 1000;
        } else if (kind === 'altitude') {
          mapped[name] = raw / 5 - 500;
        } else if (kind === 'semicircle') {
          mapped[name] = raw * (180 / Math.pow(2, 31));
        } else {
          mapped[name] = raw;
        }
      }
    }
    if (values.timestamp instanceof Date && !mapped.timestamp) {
      mapped.timestamp = values.timestamp;
      lastTimestamp = Math.floor(values.timestamp.getTime() / 1000) - FIT_EPOCH / 1000;
    }
    if (def.global === 18 || def.global === 19 || def.global === 20) messages.push(mapped);
  }

  const sessions = messages.filter((m) => m.__global === 18);
  const laps = messages.filter((m) => m.__global === 19);
  const records = messages.filter((m) => m.__global === 20);
  const activities = [];
  const fallbackType = 'other';

  const buildOne = (msg, sourceType) => {
    const start = msg.start_time || msg.timestamp || (records[0] && (records[0].timestamp || null));
    if (!start) return null;
    let duration = msg.total_timer_time || msg.total_elapsed_time || 0;
    let distanceM = Number(msg.total_distance) || 0;
    const sport = FIT_SPORT_MAP[msg.sport] || fallbackType;
    if (!duration && records.length) {
      const times = records.map((r) => r.timestamp).filter(Boolean);
      if (times.length >= 2) duration = (times[times.length - 1] - times[0]) / 1000;
    }
    // Some devices omit session totals but keep the record stream.
    const startMs = start.getTime();
    const endMs = startMs + Math.max(duration, 1) * 1000;
    const relevant = records.filter((r) => r.timestamp &&
      r.timestamp.getTime() >= startMs - 5000 && r.timestamp.getTime() <= endMs + 5000);
    if (!distanceM && relevant.length) {
      distanceM = Math.max(...relevant.map((r) => Number(r.distance) || 0), 0);
    }
    const hrValues = relevant.map((r) => r.heart_rate).filter((v) => v && v > 30);
    const avgHr = msg.avg_heart_rate || (hrValues.length ? hrValues.reduce((a, b) => a + b, 0) / hrValues.length : null);
    const maxHr = msg.max_heart_rate || (hrValues.length ? Math.max(...hrValues) : null);
    if (!duration && !distanceM) return null;
    return activityFrom({
      type: sport,
      // Use elapsed time for the stream window: a ride can have long pauses
      // while total_timer_time only counts moving time.
      stream: fitStream(records, start, msg.total_elapsed_time || duration),
      date: localDateKey(start),
      startTime: localTime(start),
      duration: duration / 60,
      distance: distanceM / 1000,
      calories: msg.total_calories,
      avgHr,
      maxHr,
      elevation: msg.total_ascent,
      notes: sourceType === 'session' ? '' : '由 FIT 记录自动汇总',
      source: 'fit'
    });
  };

  if (sessions.length) {
    for (const session of sessions) {
      const a = buildOne(session, 'session');
      if (a) activities.push(a);
    }
  } else if (laps.length) {
    // 没有 session 时聚合 laps
    const sorted = [...laps].sort((a, b) => (a.start_time || a.timestamp || 0) - (b.start_time || b.timestamp || 0));
    const first = sorted[0];
    const total = sorted.reduce((acc, lap) => {
      acc.duration += lap.total_timer_time || lap.total_elapsed_time || 0;
      acc.distance += Number(lap.total_distance) || 0;
      acc.calories += Number(lap.total_calories) || 0;
      acc.hrSum += (lap.avg_heart_rate || 0) * ((lap.total_timer_time || lap.total_elapsed_time || 0));
      acc.hrWeight += (lap.avg_heart_rate ? (lap.total_timer_time || lap.total_elapsed_time || 0) : 0);
      return acc;
    }, { duration: 0, distance: 0, calories: 0, hrSum: 0, hrWeight: 0 });
    const a = activityFrom({
      type: FIT_SPORT_MAP[first.sport] || fallbackType,
      date: localDateKey(first.start_time || first.timestamp),
      startTime: localTime(first.start_time || first.timestamp),
      duration: total.duration / 60,
      distance: total.distance / 1000,
      calories: total.calories,
      avgHr: total.hrWeight ? total.hrSum / total.hrWeight : null,
      source: 'fit',
      stream: fitStream(records, first.start_time || first.timestamp, total.duration),
      notes: '由 FIT 分段数据汇总'
    });
    if (a.duration) activities.push(a);
  } else if (records.length) {
    const times = records.map((r) => r.timestamp).filter(Boolean).sort((a, b) => a - b);
    const hr = records.map((r) => r.heart_rate).filter((v) => v && v > 30);
    const dist = Math.max(...records.map((r) => Number(r.distance) || 0), 0);
    if (!times.length) throw new Error('FIT 文件里没有可用的时间记录');
    const duration = (times[times.length - 1] - times[0]) / 1000;
    const a = activityFrom({
      type: fallbackType,
      date: localDateKey(times[0]),
      startTime: localTime(times[0]),
      duration: duration / 60,
      distance: dist / 1000,
      avgHr: hr.length ? hr.reduce((s, v) => s + v, 0) / hr.length : null,
      maxHr: hr.length ? Math.max(...hr) : null,
      source: 'fit',
      stream: fitStream(records, times[0], duration),
      notes: '由 FIT 轨迹记录自动汇总'
    });
    if (a.duration) activities.push(a);
  }

  if (!activities.length) throw new Error('FIT 文件里没有找到完整的运动记录');
  return { activities, sportLabels: sessions.map((s) => FIT_SPORT_NAMES[s.sport]).filter(Boolean) };
}

/* ---------- GPX ---------- */

export function parseGpx(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('GPX 文件格式有误，无法解析');
  const points = Array.from(doc.getElementsByTagNameNS('*', 'trkpt'));
  if (points.length < 2) throw new Error('GPX 中没有足够的轨迹点');
  let distance = 0;
  let elevationGain = 0;
  let prevEle = null;
  let firstTime = null;
  let lastTime = null;
  const hrs = [];
  const rawStream = [];
  points.forEach((pt, i) => {
    const lat = Number(pt.getAttribute('lat'));
    const lon = Number(pt.getAttribute('lon'));
    if (i > 0) {
      const prev = points[i - 1];
      distance += haversine(Number(prev.getAttribute('lat')), Number(prev.getAttribute('lon')), lat, lon);
    }
    const eleNode = pt.getElementsByTagNameNS('*', 'ele')[0];
    if (eleNode) {
      const ele = Number(eleNode.textContent);
      if (prevEle != null && ele > prevEle) elevationGain += ele - prevEle;
      prevEle = ele;
    }
    const timeNode = pt.getElementsByTagNameNS('*', 'time')[0];
    let pointTime = null;
    if (timeNode) {
      const t = new Date(timeNode.textContent);
      if (!Number.isNaN(t.getTime())) {
        if (!firstTime) firstTime = t;
        lastTime = t;
        pointTime = t;
      }
    }
    const hrNode = pt.getElementsByTagNameNS('*', 'hr')[0];
    let hr = null;
    if (hrNode) {
      const value = Number(hrNode.textContent);
      if (value > 30 && value < 240) { hr = value; hrs.push(value); }
    }
    if (pointTime) rawStream.push({
      time: pointTime,
      hr,
      lat: Number.isFinite(lat) ? Math.round(lat * 1e6) / 1e6 : null,
      lon: Number.isFinite(lon) ? Math.round(lon * 1e6) / 1e6 : null,
      dist: distance,
      ele: eleNode ? Number(eleNode.textContent) : null
    });
  });
  if (!firstTime || !lastTime) throw new Error('GPX 轨迹缺少时间信息，无法计算时长');
  const duration = (lastTime - firstTime) / 60000;
  if (duration < 0.5) throw new Error('GPX 轨迹时间过短');
  const typeNode = doc.getElementsByTagNameNS('*', 'type')[0];
  const type = inferType(typeNode?.textContent || '');
  const stream = downsample(rawStream.map((p) => ({
    t: Math.max(0, Math.round((p.time - firstTime) / 60000)),
    hr: p.hr,
    lat: p.lat,
    lon: p.lon,
    dist: Math.round(p.dist * 100) / 100,
    ele: p.ele
  })));
  return {
    activities: [activityFrom({
      type,
      stream,
      date: localDateKey(firstTime),
      startTime: localTime(firstTime),
      duration,
      distance,
      elevation: elevationGain,
      avgHr: hrs.length ? hrs.reduce((s, v) => s + v, 0) / hrs.length : null,
      maxHr: hrs.length ? Math.max(...hrs) : null,
      source: 'gpx',
      notes: '从 GPX 轨迹导入，消耗为估算值'
    })]
  };
}

/* ---------- TCX ---------- */

export function parseTcx(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('TCX 文件格式有误，无法解析');
  const activities = Array.from(doc.getElementsByTagNameNS('*', 'Activity'));
  if (!activities.length) throw new Error('TCX 中没有找到运动记录');
  const out = [];
  for (const act of activities) {
    const sport = act.getAttribute('Sport') || '';
    const type = inferType(sport);
    const laps = Array.from(act.getElementsByTagNameNS('*', 'Lap'));
    let duration = 0;
    let distanceM = 0;
    let calories = 0;
    let hrSum = 0;
    let hrWeight = 0;
    let maxHr = 0;
    let firstTime = null;
    let lastTime = null;
    const trackpoints = Array.from(act.getElementsByTagNameNS('*', 'Trackpoint'));
    const rawStream = [];
    for (const tp of trackpoints) {
      const timeNode = tp.getElementsByTagNameNS('*', 'Time')[0];
      let pointTime = null;
      if (timeNode) {
        const t = new Date(timeNode.textContent);
        if (!Number.isNaN(t.getTime())) {
          if (!firstTime) firstTime = t;
          lastTime = t;
          pointTime = t;
        }
      }
      if (!pointTime) continue;
      const hrNode = tp.getElementsByTagNameNS('*', 'HeartRateBpm')[0]?.getElementsByTagNameNS('*', 'Value')[0];
      const distNode = tp.getElementsByTagNameNS('*', 'DistanceMeters')[0];
      const eleNode = tp.getElementsByTagNameNS('*', 'AltitudeMeters')[0];
      const posNode = tp.getElementsByTagNameNS('*', 'Position')[0];
      const lat = Number(posNode?.getElementsByTagNameNS('*', 'LatitudeDegrees')[0]?.textContent);
      const lon = Number(posNode?.getElementsByTagNameNS('*', 'LongitudeDegrees')[0]?.textContent);
      rawStream.push({
        time: pointTime,
        hr: Number(hrNode?.textContent) || null,
        lat: Number.isFinite(lat) ? Math.round(lat * 1e6) / 1e6 : null,
        lon: Number.isFinite(lon) ? Math.round(lon * 1e6) / 1e6 : null,
        dist: distNode ? Number(distNode.textContent) / 1000 : null,
        ele: eleNode ? Number(eleNode.textContent) : null
      });
    }
    const stream = downsample(rawStream.filter((p) => p.time).map((p) => ({
      t: Math.max(0, Math.round((p.time - firstTime) / 60000)),
      hr: p.hr,
      lat: p.lat,
      lon: p.lon,
      dist: p.dist,
      ele: p.ele
    })));
    for (const lap of laps) {
      const num = (tag) => Number(lap.getElementsByTagNameNS('*', tag)[0]?.textContent) || 0;
      const lapDuration = num('TotalTimeSeconds');
      const lapDistance = num('DistanceMeters');
      const lapCalories = num('Calories');
      const avgNode = lap.getElementsByTagNameNS('*', 'AverageHeartRateBpm')[0];
      const avgHr = Number(avgNode?.getElementsByTagNameNS('*', 'Value')[0]?.textContent) || 0;
      duration += lapDuration;
      distanceM += lapDistance;
      calories += lapCalories;
      if (avgHr) {
        hrSum += avgHr * (lapDuration || 1);
        hrWeight += lapDuration || 1;
      }
      const maxNode = lap.getElementsByTagNameNS('*', 'MaximumHeartRateBpm')[0];
      const lapMax = Number(maxNode?.getElementsByTagNameNS('*', 'Value')[0]?.textContent) || 0;
      maxHr = Math.max(maxHr, lapMax);
    }
    if (!duration && firstTime && lastTime) duration = (lastTime - firstTime) / 1000;
    if (!duration && !distanceM) continue;
    const start = firstTime || new Date();
    out.push(activityFrom({
      type,
      date: localDateKey(start),
      startTime: localTime(start),
      duration: duration / 60,
      distance: distanceM / 1000,
      calories: calories || null,
      avgHr: hrWeight ? hrSum / hrWeight : null,
      maxHr: maxHr || null,
      source: 'tcx',
      stream,
      notes: '从 TCX 文件导入'
    }));
  }
  if (!out.length) throw new Error('TCX 中没有有效的运动数据');
  return { activities: out };
}

/* ---------- CSV ---------- */

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = false;
      } else field += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field); field = '';
    } else if (ch === '\n') {
      row.push(field); field = '';
      if (row.some((v) => String(v).trim() !== '')) rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((v) => String(v).trim() !== '')) rows.push(row);
  return rows;
}

function normalizeHeader(h) {
  return String(h).replace(/^\uFEFF/, '').trim().toLowerCase()
    .replace(/[（(].*?[)）]/g, '').replace(/[\s_\-/]/g, '');
}

function parseDurationCell(value, header) {
  const s = String(value).trim();
  if (!s) return 0;
  if (s.includes(':')) {
    const parts = s.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
    if (parts.length === 2) return parts[0] + parts[1] / 60;
  }
  const n = Number(s.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n)) return 0;
  if (/秒|sec|s$/.test(s) && !/分钟|min/.test(s)) return n / 60;
  if (/小时|hour|h$/.test(s) && !/分钟|min/.test(s)) return n * 60;
  return n;
}

function parseDistanceCell(value) {
  const s = String(value).trim().toLowerCase();
  if (!s) return null;
  const n = Number(s.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n)) return null;
  if (/米|(?<!k)m$/.test(s) && !/km/.test(s)) return n / 1000;
  return n;
}

function parseDateCell(value) {
  const s = String(value).trim();
  if (!s) return null;
  let m = s.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${pad2(m[1])}-${pad2(m[2])}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return dateKey(d);
  return null;
}

export function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/)[0] || '';
  const delimiter = (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? '\t'
    : (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = parseDelimited(clean, delimiter);
  if (rows.length < 2) throw new Error('CSV 至少需要表头和一行数据');
  const headers = rows[0].map(normalizeHeader);
  const find = (...names) => headers.findIndex((h) => names.some((n) => h === normalizeHeader(n) || h.includes(normalizeHeader(n))));
  const idx = {
    date: find('日期', 'date', '时间', 'time'),
    type: find('运动类型', '类型', 'sport', 'type', '运动'),
    duration: find('时长', 'duration', '时间分钟', 'minutes', '分钟'),
    distance: find('距离', 'distance', 'km', '公里'),
    calories: find('消耗', '卡路里', 'calories', 'kcal'),
    avgHr: find('平均心率', 'avgheartrate', 'heartrate', '心率'),
    notes: find('备注', 'notes', 'note', '说明')
  };
  if (idx.date < 0) throw new Error('CSV 缺少“日期”列');
  if (idx.duration < 0 && idx.distance < 0) throw new Error('CSV 至少需要“时长”或“距离”列');
  const out = [];
  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row.some((v) => String(v).trim())) continue;
    const date = parseDateCell(row[idx.date]);
    if (!date) continue;
    const type = typeFromLabel(idx.type >= 0 ? row[idx.type] : '');
    const duration = idx.duration >= 0 ? parseDurationCell(row[idx.duration], headers[idx.duration]) : 0;
    const distance = idx.distance >= 0 ? parseDistanceCell(row[idx.distance]) : null;
    if (!duration && !distance) continue;
    out.push(activityFrom({
      type,
      date,
      duration: duration || (distance ? distance / 8 * 60 : 30),
      distance,
      calories: idx.calories >= 0 ? Number(String(row[idx.calories]).replace(/[^\d.]/g, '')) || null : null,
      avgHr: idx.avgHr >= 0 ? Number(String(row[idx.avgHr]).replace(/[^\d.]/g, '')) || null : null,
      notes: idx.notes >= 0 ? String(row[idx.notes] || '').trim() : '',
      source: 'csv'
    }));
  }
  if (!out.length) throw new Error('CSV 中没有可导入的有效记录，请检查日期与时长格式');
  return { activities: out };
}

/* ---------- JSON ---------- */

export function parseJson(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('JSON 格式有误'); }
  const list = Array.isArray(data) ? data : data.activities;
  if (!Array.isArray(list)) throw new Error('JSON 中缺少 activities 数组');
  const out = [];
  for (const item of list) {
    const type = typeFromLabel(item.type || item.sport || '');
    const date = parseDateCell(item.date || item.startTime || '') || (item.date ? String(item.date).slice(0, 10) : null);
    if (!date) continue;
    const duration = Number(item.duration ?? item.minutes ?? 0);
    const distance = item.distance == null ? null : Number(item.distance);
    if (!duration && !distance) continue;
    out.push(activityFrom({
      type,
      date,
      duration: duration || (distance ? distance / 8 * 60 : 0),
      distance,
      calories: item.calories || null,
      avgHr: item.avgHr || item.heartRate || null,
      maxHr: item.maxHr || null,
      elevation: item.elevation || null,
      notes: item.notes || '',
      startTime: item.startTime || '',
      stream: Array.isArray(item.stream) ? item.stream : undefined,
      rpe: item.rpe,
      strength: Array.isArray(item.strength) ? item.strength : undefined,
      source: item.source || 'json'
    }));
  }
  if (!out.length) throw new Error('JSON 中没有可导入的运动记录');
  return {
    activities: out,
    weights: Array.isArray(data.weights) ? data.weights.filter((w) => w && w.date && w.kg) : [],
    profile: data.user?.profile && typeof data.user.profile === 'object' ? data.user.profile : null,
    nickname: data.user?.nickname || ''
  };
}

/* ---------- 入口 ---------- */

export async function parseFile(file) {
  const name = file.name || '未命名文件';
  const ext = name.split('.').pop().toLowerCase();
  const sizeMB = file.size / 1024 / 1024;
  if (sizeMB > 25) throw new Error('文件超过 25MB，请先精简后再导入');
  let result;
  if (ext === 'fit') {
    const buffer = await file.arrayBuffer();
    result = parseFit(buffer);
  } else if (ext === 'gpx') {
    result = parseGpx(await file.text());
  } else if (ext === 'tcx') {
    result = parseTcx(await file.text());
  } else if (ext === 'csv' || ext === 'txt') {
    result = parseCsv(await file.text());
  } else if (ext === 'json') {
    result = parseJson(await file.text());
  } else {
    throw new Error('暂不支持该文件格式，请上传 .fit / .gpx / .tcx / .csv / .json');
  }
  const hint = inferType(name);
  if (hint !== 'other') {
    result.activities = result.activities.map((a) => (a.type === 'other' ? { ...a, type: hint } : a));
  }
  return { ...result, fileName: name, format: ext.toUpperCase() };
}

export const CSV_TEMPLATE = '\uFEFF日期,运动类型,时长(分钟),距离(公里),消耗(千卡),平均心率,备注\n2026-11-06,跑步,42,7.2,520,152,沿江轻松跑\n2026-11-05,力量训练,45,,310,128,上肢推拉\n2026-11-03,骑行,65,26.4,560,138,周末有氧\n';

export function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '跃迹-运动记录模板.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
