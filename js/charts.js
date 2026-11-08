/* 轻量 SVG 图表 —— 无第三方图表库 */

let chartId = 0;
const nextId = () => `c${++chartId}`;

export function sparkline(values, color = '#CCF56B', { width = 240, height = 54, fill = true } = {}) {
  const data = values.length ? values : [0, 0, 0, 0, 0, 0];
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const padX = 3;
  const padY = 7;
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = padX + (i / Math.max(1, data.length - 1)) * (width - padX * 2);
    const y = height - padY - ((v - min) / span) * (height - padY * 2);
    return [x, y];
  });
  const path = smoothPath(pts);
  const id = nextId();
  const area = `${path} L ${pts[pts.length - 1][0]} ${height} L ${pts[0][0]} ${height} Z`;
  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".28"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${fill ? `<path d="${area}" fill="url(#${id})"/>` : ''}
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="2.6" fill="${color}" stroke="#0B0F0D" stroke-width="1.5"/>
  </svg>`;
}

export function progressRing({ size = 158, stroke = 11, progress = 0, color = '#CCF56B', track = 'rgba(255,255,255,.08)' } = {}) {
  const radius = (size - stroke) / 2;
  const c = 2 * Math.PI * radius;
  const p = Math.max(0, Math.min(1, progress));
  return `<svg class="ring-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
    <circle class="ring-progress" cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}"
      transform="rotate(-90 ${size / 2} ${size / 2})" style="--ring-length:${c};--ring-offset:${c * (1 - p)}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${radius - stroke * 1.9}" fill="none" stroke="rgba(255,255,255,.035)" stroke-width="1"/>
  </svg>`;
}

export function barChart({ values = [], labels = [], target = null, color = '#CCF56B', height = 230, unit = '分钟', maxLabels = 12 }) {
  const W = 680;
  const H = height;
  const pad = { l: 38, r: 14, t: 22, b: 34 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const peak = Math.max(target || 0, ...values, 1);
  const step = niceStep(peak / 3);
  const top = Math.ceil(peak / step) * step;
  const y = (v) => pad.t + innerH - (v / top) * innerH;
  const slot = innerW / Math.max(1, values.length);
  const barW = Math.min(42, slot * 0.48);
  const grid = [0, 1, 2, 3].map((i) => {
    const val = (top / 3) * i;
    return `<g><line x1="${pad.l}" x2="${W - pad.r}" y1="${y(val)}" y2="${y(val)}" stroke="rgba(255,255,255,.06)" stroke-dasharray="2 5"/>
      <text x="${pad.l - 10}" y="${y(val) + 4}" text-anchor="end" class="axis-text">${Math.round(val)}</text></g>`;
  }).join('');

  const bars = values.map((v, i) => {
    const x = pad.l + slot * i + slot / 2;
    const h = Math.max(v > 0 ? 3 : 0, (v / top) * innerH);
    const isLast = i === values.length - 1;
    return `<g class="bar-group">
      <rect x="${x - barW / 2}" y="${y(v)}" width="${barW}" height="${h}" rx="${Math.min(7, barW / 2)}"
        fill="${isLast ? color : hexToRgba(color, 0.34)}" ${isLast ? '' : `stroke="${hexToRgba(color, 0.24)}"`}>
        <title>${labels[i] || ''} · ${Math.round(v)} ${unit}</title>
      </rect>
      ${isLast ? `<text x="${x}" y="${y(v) - 9}" text-anchor="middle" class="bar-value">${Math.round(v)}</text>` : ''}
      ${i % Math.ceil(values.length / maxLabels) === 0 || isLast
        ? `<text x="${x}" y="${H - 12}" text-anchor="middle" class="axis-text">${labels[i] || ''}</text>` : ''}
    </g>`;
  }).join('');

  const targetLine = target
    ? `<g><line x1="${pad.l}" x2="${W - pad.r}" y1="${y(target)}" y2="${y(target)}" stroke="#F7C95C" stroke-width="1.2" stroke-dasharray="5 6" opacity=".68"/>
       <text x="${pad.l + 5}" y="${y(target) - 7}" text-anchor="start" class="target-text">周目标 ${Math.round(target)}</text></g>`
    : '';

  return `<svg class="bar-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img">
    ${grid}${bars}${targetLine}
  </svg>`;
}

export function lineChart({ values = [], labels = [], color = '#CCF56B', height = 230, unit = '' }) {
  const W = 680;
  const H = height;
  const pad = { l: 42, r: 18, t: 24, b: 34 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  if (values.length < 2) {
    return `<div class="chart-empty">再记录一次体重，就能看到趋势曲线</div>`;
  }
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const margin = Math.max(0.8, (rawMax - rawMin) * 0.25);
  const min = rawMin - margin;
  const max = rawMax + margin;
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    pad.l + (i / (values.length - 1)) * innerW,
    pad.t + innerH - ((v - min) / span) * innerH
  ]);
  const path = smoothPath(pts);
  const id = nextId();
  const yTicks = [0, 0.5, 1].map((f) => {
    const val = min + span * f;
    const yy = pad.t + innerH - f * innerH;
    return `<line x1="${pad.l}" x2="${W - pad.r}" y1="${yy}" y2="${yy}" stroke="rgba(255,255,255,.06)" stroke-dasharray="2 5"/>
      <text x="${pad.l - 10}" y="${yy + 4}" text-anchor="end" class="axis-text">${val.toFixed(1)}</text>`;
  }).join('');
  const dots = pts.map(([x, y], i) => {
    const show = i === pts.length - 1 || i === 0 || (values.length <= 8);
    return `<circle cx="${x}" cy="${y}" r="${i === pts.length - 1 ? 4.5 : 2.6}" fill="${i === pts.length - 1 ? color : '#121814'}" stroke="${color}" stroke-width="2">
      <title>${labels[i] || ''} · ${values[i]} ${unit}</title></circle>`;
  }).join('');
  const xLabels = labels.map((label, i) => {
    if (labels.length > 8 && i % 2 !== 0 && i !== labels.length - 1) return '';
    return `<text x="${pts[i][0]}" y="${H - 12}" text-anchor="middle" class="axis-text">${label}</text>`;
  }).join('');

  return `<svg class="line-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".26"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    ${yTicks}
    <path d="${path} L ${pts[pts.length - 1][0]} ${pad.t + innerH} L ${pts[0][0]} ${pad.t + innerH} Z" fill="url(#${id})"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}${xLabels}
  </svg>`;
}


export function streamChart({ stream = [], color = '#CCF56B', height = 210, unit = 'bpm', zone = null }) {
  const data = stream.filter((p) => Number.isFinite(Number(p.hr)) && Number(p.hr) > 0);
  if (data.length < 2) {
    return `<div class="chart-empty">这份记录没有足够的心率采样点</div>`;
  }
  const W = 680;
  const H = height;
  const pad = { l: 42, r: 16, t: 20, b: 30 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const maxT = Math.max(...stream.map((p) => Number(p.t) || 0), 1);
  const values = data.map((p) => Number(p.hr));
  const min = Math.max(40, Math.floor((Math.min(...values) - 12) / 10) * 10);
  const max = Math.ceil((Math.max(...values) + 10) / 10) * 10;
  const span = max - min || 1;
  const x = (t) => pad.l + (Number(t) / maxT) * innerW;
  const y = (hr) => pad.t + innerH - ((hr - min) / span) * innerH;
  const pts = data.map((p) => [x(p.t), y(p.hr)]);
  const path = smoothPath(pts);
  const id = nextId();
  const ticks = [0, 0.5, 1].map((f) => {
    const val = min + span * f;
    const yy = pad.t + innerH - f * innerH;
    return `<line x1="${pad.l}" x2="${W - pad.r}" y1="${yy}" y2="${yy}" stroke="rgba(255,255,255,.06)" stroke-dasharray="2 5"/>
      <text x="${pad.l - 10}" y="${yy + 4}" text-anchor="end" class="axis-text">${Math.round(val)}</text>`;
  }).join('');
  const zoneBand = zone && zone[1] > zone[0]
    ? `<rect x="${pad.l}" y="${y(zone[1])}" width="${innerW}" height="${Math.max(0, y(zone[0]) - y(zone[1]))}" fill="${color}" opacity=".045"/>
       <line x1="${pad.l}" x2="${W - pad.r}" y1="${y(zone[1])}" y2="${y(zone[1])}" stroke="${color}" opacity=".18" stroke-dasharray="3 5"/>`
    : '';
  const xLabels = [0, 0.5, 1].map((f) => {
    const t = Math.round(maxT * f);
    return `<text x="${pad.l + innerW * f}" y="${H - 10}" text-anchor="${f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}" class="axis-text">${t}′</text>`;
  }).join('');
  return `<svg class="stream-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".24"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    ${zoneBand}${ticks}
    <path d="${path} L ${pts[pts.length - 1][0]} ${pad.t + innerH} L ${pts[0][0]} ${pad.t + innerH} Z" fill="url(#${id})"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="3.4" fill="${color}" stroke="#0B0F0D" stroke-width="1.5"/>
    ${xLabels}
    <text x="${W - pad.r}" y="${pad.t - 6}" text-anchor="end" class="axis-text">${unit}</text>
  </svg>`;
}


function haversineKm(a, b) {
  const R = 6371;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function trackChart(track = [], { color = '#CCF56B', width = 680, height = 300, distance = null } = {}) {
  const points = track.filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon))
    && Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lon)) <= 180
    && !(Number(p.lat) === 0 && Number(p.lon) === 0));
  if (points.length < 2) {
    return `<div class="chart-empty">这份记录没有足够的 GPS 定位点</div>`;
  }
  const W = width;
  const H = height;
  const pad = 34;
  const midLat = points.reduce((sum, p) => sum + Number(p.lat), 0) / points.length;
  const cosLat = Math.cos((midLat * Math.PI) / 180) || 1;
  const xs = points.map((p) => Number(p.lon) * cosLat);
  const ys = points.map((p) => Number(p.lat));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-9;
  const spanY = maxY - minY || 1e-9;
  const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const project = (p) => [
    W / 2 + (Number(p.lon) * cosLat - cx) * scale,
    H / 2 - (Number(p.lat) - cy) * scale
  ];
  const projected = points.map(project);
  const path = projected.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  const id = nextId();

  let totalKm = 0;
  const cumulative = [0];
  for (let i = 1; i < points.length; i += 1) {
    totalKm += haversineKm(points[i - 1], points[i]);
    cumulative.push(totalKm);
  }
  const stepKm = totalKm >= 30 ? 5 : totalKm >= 10 ? 2 : 1;
  const kmMarkers = [];
  let nextKm = stepKm;
  for (let i = 1; i < points.length; i += 1) {
    while (nextKm <= cumulative[i] && nextKm <= totalKm) {
      const [x, y] = projected[i];
      kmMarkers.push(`<g><circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.6" fill="#0B0F0D" stroke="${color}" stroke-width="1.2"/><text x="${(x + 6).toFixed(2)}" y="${(y - 5).toFixed(2)}" class="track-km-label">${nextKm} km</text></g>`);
      nextKm += stepKm;
    }
  }

  const [sx, sy] = projected[0];
  const [ex, ey] = projected[projected.length - 1];
  const grid = [1, 2, 3, 4].map((i) => `<line x1="${(W / 5) * i}" y1="0" x2="${(W / 5) * i}" y2="${H}" stroke="rgba(255,255,255,.035)" stroke-dasharray="2 6"/><line x1="0" y1="${(H / 5) * i}" x2="${W}" y2="${(H / 5) * i}" stroke="rgba(255,255,255,.035)" stroke-dasharray="2 6"/>`).join('');
  const displayKm = distance != null && Number.isFinite(Number(distance)) ? Number(distance) : totalKm;

  return `<svg class="track-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="GPS 轨迹">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="#63E3CE"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="rgba(0,0,0,.16)" rx="12"/>
    ${grid}
    <path d="${path}" fill="none" stroke="${color}" stroke-width="8" opacity=".07" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${path}" fill="none" stroke="url(#${id})" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    ${kmMarkers.join('')}
    <g class="track-marker track-marker--start"><circle cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" r="8" fill="rgba(204,245,107,.14)"/><circle cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" r="4" fill="#CCF56B" stroke="#0B0F0D" stroke-width="2"/></g>
    <g class="track-marker track-marker--end"><circle cx="${ex.toFixed(2)}" cy="${ey.toFixed(2)}" r="8" fill="rgba(255,139,104,.14)"/><circle cx="${ex.toFixed(2)}" cy="${ey.toFixed(2)}" r="4" fill="#FF8B68" stroke="#0B0F0D" stroke-width="2"/></g>
    <g transform="translate(${W - 35} 25)">
      <circle r="13" fill="rgba(0,0,0,.25)" stroke="rgba(255,255,255,.1)"/>
      <path d="M0 -7 3 5 0 3.2 -3 5Z" fill="${color}"/>
      <text x="0" y="-16" text-anchor="middle" class="track-compass">N</text>
    </g>
    <text x="18" y="${H - 14}" class="track-total">${displayKm.toFixed(1)} km</text>
    <text x="${W - 16}" y="${H - 14}" text-anchor="end" class="track-note">GPS TRACK · ${points.length} pts</text>
  </svg>`;
}

export function miniBars(values = [], color = '#CCF56B', { width = 300, height = 72 } = {}) {
  const max = Math.max(...values, 1);
  const slot = width / Math.max(1, values.length);
  const barW = Math.min(18, slot * 0.5);
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="mini-bars" aria-hidden="true">
    ${values.map((v, i) => {
      const h = Math.max(2, (v / max) * (height - 6));
      return `<rect x="${i * slot + (slot - barW) / 2}" y="${height - h}" width="${barW}" height="${h}" rx="${barW / 2}" fill="${hexToRgba(color, i === values.length - 1 ? 1 : 0.28)}"><title>${Math.round(v)} 分钟</title></rect>`;
    }).join('')}
  </svg>`;
}

export function smoothPath(points) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

export function hexToRgba(hex, alpha = 1) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(full, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

function niceStep(raw) {
  if (!raw || raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  const f = raw / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * base;
}

export function conicGradient(parts) {
  const total = parts.reduce((sum, p) => sum + p.value, 0) || 1;
  let cursor = 0;
  const stops = parts.map((p) => {
    const start = (cursor / total) * 100;
    cursor += p.value;
    const end = (cursor / total) * 100;
    return `${p.color} ${start}% ${end}%`;
  }).join(', ');
  return `conic-gradient(from -90deg, ${stops})`;
}
