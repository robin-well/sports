/* 线性图标集，全部内联，无外部依赖 */

const P = {
  run: `<circle cx="15" cy="4.5" r="2"/><path d="M13.4 8.2 11 13.3l3.6 2.1 1.4 4.9"/><path d="m13.4 8.2 4.2 2.1 2.6-.4"/><path d="M11 13.3 7.1 15 4.2 20"/><path d="m14.6 15.4-3.7 4.9"/>`,
  bike: `<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M5.5 17.5 9 10h5l4.5 7.5"/><path d="M9 10h6"/><path d="M12 10 10 17.5h8.5"/><path d="M16.5 6.5h2.8l-.8 3.5"/>`,
  dumbbell: `<path d="M6.5 6.5v11M3.5 8.5v7M17.5 6.5v11M20.5 8.5v7"/><path d="M6.5 12h11"/>`,
  swim: `<circle cx="16.5" cy="6.5" r="1.7"/><path d="m4 12 3.5 1.5 3-3 3 3 3.5-1"/><path d="M2.5 17.5c1.8 0 1.8-1.2 3.6-1.2s1.8 1.2 3.6 1.2 1.8-1.2 3.6-1.2 1.8 1.2 3.6 1.2 1.8-1.2 3.6-1.2"/><path d="M2.5 21c1.8 0 1.8-1.2 3.6-1.2s1.8 1.2 3.6 1.2 1.8-1.2 3.6-1.2 1.8 1.2 3.6 1.2 1.8-1.2 3.6-1.2"/>`,
  mountain: `<path d="m3 19 6.2-12 3.4 6.2 2.1-3.2L21 19H3Z"/><path d="m7.5 10.6 1.7 1.4 1.6-1.2"/>`,
  yoga: `<circle cx="12" cy="4.8" r="2"/><path d="M12 8.5v5.3"/><path d="m12 10.5-4.2 3.4L4 13M12 10.5l4.2 3.4L20 13"/><path d="M8.2 20.5 12 16l3.8 4.5"/>`,
  refresh: `<path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 3v6h-6"/>`,
  trophy: `<path d="M8 4h8v4.5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4.5v1.5A3.5 3.5 0 0 0 8 11M16 6h3.5v1.5A3.5 3.5 0 0 1 16 11"/><path d="M12 12.5V17M8.5 20.5h7M9.5 17h5"/>`,
  comment: `<path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9h8M8 12h5"/>`,
  share: `<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/>`,
  flame: `<path d="M12 21c4 0 6.5-2.6 6.5-6.1 0-2.7-1.4-4.9-3.3-6.6-.4 1.5-1.2 2.5-2.3 3.1.3-3.3-1-6.1-3.6-8.1.1 3-1.2 4.8-2.5 6.4-1 1.3-1.3 2.9-1.3 4.6C5.5 18 8 21 12 21Z"/><path d="M12 21c-1.7 0-2.8-1.2-2.8-2.8 0-1.4.9-2.4 1.7-3.5.3 1.3.9 2 1.8 2.6.7-.9 1.1-1.9 1.1-3 1 1 1.6 2.3 1.6 3.8 0 1.7-1.4 2.9-3.4 2.9Z"/>`,
  heart: `<path d="M20.2 5.3a5 5 0 0 0-7.1 0L12 6.4l-1.1-1.1a5 5 0 1 0-7.1 7.1L12 21l8.2-8.6a5 5 0 0 0 0-7.1Z"/>`,
  body: `<circle cx="12" cy="4" r="2"/><path d="M12 7v6"/><path d="M8 9h8"/><path d="m12 13-3 7M12 13l3 7"/>`,
  leaf: `<path d="M20.5 3.5C11 3 5 6.5 5 12.5c0 3.6 2.9 6.5 6.5 6.5 6 0 9-6 9-15.5Z"/><path d="M4 21C6 15 10.5 10.5 16.5 8"/>`,
  spark: `<path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>`,
  home: `<path d="M3.5 10.5 12 3l8.5 7.5"/><path d="M5.5 9v11.5h13V9"/><path d="M9.5 20.5v-6h5v6"/>`,
  list: `<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>`,
  chart: `<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>`,
  compass: `<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 5-4.8 2 2.2-5 4.8-2Z"/>`,
  user: `<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20.5c.6-4 3.7-6 7.5-6s6.9 2 7.5 6"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  upload: `<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 15v4.5h16V15"/>`,
  download: `<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 18.5V20h16v-1.5"/>`,
  close: `<path d="m5 5 14 14M19 5 5 19"/>`,
  check: `<path d="m4.5 12.5 5 5 10-11"/>`,
  chevron: `<path d="m9 5 7 7-7 7"/>`,
  down: `<path d="m5 9 7 7 7-7"/>`,
  arrow: `<path d="M4 12h16"/><path d="m14 6 6 6-6 6"/>`,
  calendar: `<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>`,
  distance: `<path d="M12 21s7-6.2 7-12A7 7 0 0 0 5 9c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>`,
  phone: `<rect x="6.5" y="2.5" width="11" height="19" rx="3"/><path d="M10.5 18.5h3"/>`,
  wechat: `<path d="M9.2 4C5.1 4 2 6.6 2 9.9c0 1.9 1 3.5 2.7 4.6l-.7 2.2 2.5-1.2c.9.2 1.7.4 2.7.4.3 0 .5 0 .8-.1a5.5 5.5 0 0 1-.3-1.8c0-3.2 3-5.7 6.8-5.7h.5C15.9 5.7 12.9 4 9.2 4Z"/><path d="M22 13.8c0-2.6-2.5-4.7-5.5-4.7S11 11.2 11 13.8s2.5 4.7 5.5 4.7c.7 0 1.4-.1 2-.4l2 1-.6-1.8c1.3-.9 2.1-2.1 2.1-3.5Z"/><circle cx="7" cy="9" r=".7" fill="currentColor"/><circle cx="11.5" cy="9" r=".7" fill="currentColor"/><circle cx="14.5" cy="13.5" r=".6" fill="currentColor"/><circle cx="17.8" cy="13.5" r=".6" fill="currentColor"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1-2.8 2.8-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2h-4v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1-2.8-2.8.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3v-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1 2.8-2.8.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V3h4v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1 2.8 2.8-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1h.2v4h-.2a1.6 1.6 0 0 0-1.5 1Z"/>`,
  logout: `<path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9"/><path d="M14 8l4 4-4 4M8 12h10"/>`,
  trash: `<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/>`,
  file: `<path d="M6 2.5h8l4.5 4.5v14.5H6V2.5Z"/><path d="M14 2.5V7h4.5"/><path d="M9 13h6M9 17h4"/>`,
  qr: `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M20 17v4h-4"/>`,
  bell: `<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2.4 2.4 0 0 0 4 0"/>`,
  shield: `<path d="M12 2.5 20 6v6c0 5-3.4 8.2-8 9.5-4.6-1.3-8-4.5-8-9.5V6l8-3.5Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>`,
  info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>`,
  edit: `<path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m13.5 6 3 3"/>`,
  target: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>`,
  droplet: `<path d="M12 2.5S5.5 9.2 5.5 14a6.5 6.5 0 0 0 13 0c0-4.8-6.5-11.5-6.5-11.5Z"/>`,
  moon: `<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/>`,
  fire: `<path d="M12 22c4 0 6.5-2.6 6.5-6.1 0-2.7-1.4-4.9-3.3-6.6-.4 1.5-1.2 2.5-2.3 3.1.3-3.3-1-6.1-3.6-8.1.1 3-1.2 4.8-2.5 6.4-1 1.3-1.3 2.9-1.3 4.6C5.5 19 8 22 12 22Z"/>`,
  search: `<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>`,
  more: `<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>`,
  map: `<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20V6.5Z"/><path d="M9 4v13.5M15 6.5V20"/>`,
  cloud: `<path d="M7.5 18.5a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18.7 8.8a4 4 0 0 1-.2 9.7H7.5Z"/><path d="M9 13.2 11.2 15l3.8-4"/>`,
  wave: `<path d="M2 12c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/><path d="M2 17c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/>`
};

export function icon(name, size = 20, extraClass = '') {
  const body = P[name] || P.spark;
  return `<svg class="icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function logoMark(size = 34) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 34 34" fill="none" aria-hidden="true">
    <rect width="34" height="34" rx="10" fill="#CCF56B"/>
    <path d="M6 19h4.2l2.2-6 3.2 11 3.1-8 1.9 3h5.4" stroke="#0B0F0D" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
