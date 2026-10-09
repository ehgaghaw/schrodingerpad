// Box art, rendered with sharp from SVG. Greyscale only (the site is black and white), no text
// (server fonts vary), fully determined by the traits. 1000 x 1000 PNG.
import sharp from 'sharp';
import type { Identity } from './identity';

const S = 1000;
const wrap = (inner: string, bg = '#000') => `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><rect width="${S}" height="${S}" fill="${bg}"/>${inner}</svg>`;
const png = (svg: string) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

/** The sealed box: an isometric wireframe cube with a question mark inside. Same for every box. */
export function sealedSvg(): string {
  const cube = `
  <g fill="none" stroke="#ffffff" stroke-width="6" stroke-linejoin="round">
    <path d="M500 220 L760 360 L760 660 L500 800 L240 660 L240 360 Z"/>
    <path d="M240 360 L500 500 L760 360" />
    <path d="M500 500 L500 800" />
  </g>
  <g fill="none" stroke="#3a3a3a" stroke-width="3" stroke-dasharray="10 12">
    <path d="M500 220 L500 500" /><path d="M240 660 L500 520 L760 660" />
  </g>
  <path d="M455 600 q0-48 40-62 q38-14 38-46 q0-30-33-30 q-30 0-36 32" fill="none" stroke="#ffffff" stroke-width="18" stroke-linecap="round" transform="translate(-6 -40)"/>
  <circle cx="494" cy="640" r="12" fill="#ffffff"/>`;
  const halo = Array.from({ length: 5 }, (_, i) => `<circle cx="500" cy="510" r="${330 + i * 34}" fill="none" stroke="#ffffff" stroke-opacity="${0.12 - i * 0.02}" stroke-width="2"/>`).join('');
  return wrap(halo + cube);
}
export const renderSealed = () => png(sealedSvg());

function field(kind: string, fg: string): string {
  const out: string[] = [];
  switch (kind) {
    case 'grid': for (let i = 50; i < S; i += 50) out.push(`<path d="M${i} 0V${S}M0 ${i}H${S}" stroke="${fg}" stroke-opacity=".08" stroke-width="2"/>`); break;
    case 'rings': for (let r = 60; r < 760; r += 46) out.push(`<circle cx="500" cy="520" r="${r}" fill="none" stroke="${fg}" stroke-opacity=".09" stroke-width="2"/>`); break;
    case 'waves': for (let y = 40; y < S; y += 46) out.push(`<path d="M0 ${y} q125 -30 250 0 t250 0 t250 0 t250 0" fill="none" stroke="${fg}" stroke-opacity=".09" stroke-width="2"/>`); break;
    case 'static': for (let i = 0; i < 900; i++) { const x = (i * 7919) % S, y = (i * 104729) % S; out.push(`<rect x="${x}" y="${y}" width="3" height="3" fill="${fg}" fill-opacity=".14"/>`); } break;
    case 'lattice': for (let x = 0; x < S; x += 80) for (let y = 0; y < S; y += 80) out.push(`<circle cx="${x + 40}" cy="${y + 40}" r="3" fill="${fg}" fill-opacity=".18"/>`); break;
    default: break; // void
  }
  return out.join('');
}

function head(form: string): { rx: number; ry: number; ear: number } {
  switch (form) {
    case 'tall': return { rx: 200, ry: 250, ear: 130 };
    case 'wide': return { rx: 270, ry: 200, ear: 110 };
    case 'angular': return { rx: 230, ry: 220, ear: 160 };
    case 'small': return { rx: 175, ry: 170, ear: 100 };
    default: return { rx: 230, ry: 230, ear: 120 };
  }
}

function eyes(kind: string, dead: boolean, fg: string, bg: string): string {
  const L = 410, R = 590, Y = 520;
  if (dead) {
    const x = (cx: number) => `<path d="M${cx - 34} ${Y - 34} L${cx + 34} ${Y + 34} M${cx + 34} ${Y - 34} L${cx - 34} ${Y + 34}" stroke="${fg}" stroke-width="14" stroke-linecap="round"/>`;
    return x(L) + x(R);
  }
  switch (kind) {
    case 'narrow': return [L, R].map((cx) => `<ellipse cx="${cx}" cy="${Y}" rx="44" ry="14" fill="${fg}"/>`).join('');
    case 'wide': return [L, R].map((cx) => `<circle cx="${cx}" cy="${Y}" r="46" fill="${fg}"/><circle cx="${cx + 10}" cy="${Y - 8}" r="14" fill="${bg}"/>`).join('');
    case 'sleepy': return [L, R].map((cx) => `<path d="M${cx - 40} ${Y} q40 30 80 0" fill="none" stroke="${fg}" stroke-width="12" stroke-linecap="round"/>`).join('');
    case 'spiral': return [L, R].map((cx) => `<path d="M${cx} ${Y} m-6 0 a6 6 0 1 1 12 0 a14 14 0 1 1 -28 0 a22 22 0 1 1 44 0 a30 30 0 1 1 -60 0" fill="none" stroke="${fg}" stroke-width="7"/>`).join('');
    default: return [L, R].map((cx) => `<circle cx="${cx}" cy="${Y}" r="34" fill="${fg}"/><circle cx="${cx + 8}" cy="${Y - 8}" r="9" fill="${bg}"/>`).join('');
  }
}

function mark(kind: string, fg: string): string {
  const y = 400;
  switch (kind) {
    case 'dot': return `<circle cx="500" cy="${y}" r="14" fill="${fg}"/>`;
    case 'bar': return `<rect x="470" y="${y - 6}" width="60" height="12" rx="6" fill="${fg}"/>`;
    case 'triangle': return `<path d="M500 ${y - 20} L522 ${y + 16} L478 ${y + 16} Z" fill="${fg}"/>`;
    case 'ring': return `<circle cx="500" cy="${y}" r="18" fill="none" stroke="${fg}" stroke-width="6"/>`;
    case 'double-dot': return `<circle cx="480" cy="${y}" r="10" fill="${fg}"/><circle cx="520" cy="${y}" r="10" fill="${fg}"/>`;
    default: return '';
  }
}

/** The collapsed identity as a minimal geometric cat. Dead cats have crossed-out eyes. */
export function collapsedSvg(id: Pick<Identity, 'traits' | 'fate'>): string {
  const t = id.traits;
  const bg = t.inverted ? '#ffffff' : '#000000';
  const fg = t.inverted ? '#000000' : '#ffffff';
  const body = t.inverted ? '#ededed' : '#0d0d0d';
  const h = head(t.form);
  const cx = 500, cy = 540;
  const earL = `M${cx - h.rx * 0.82} ${cy - h.ry * 0.45} L${cx - h.rx * 0.6} ${cy - h.ry - h.ear} L${cx - h.rx * 0.15} ${cy - h.ry * 0.86} Z`;
  const earR = `M${cx + h.rx * 0.82} ${cy - h.ry * 0.45} L${cx + h.rx * 0.6} ${cy - h.ry - h.ear} L${cx + h.rx * 0.15} ${cy - h.ry * 0.86} Z`;
  const orbits = Array.from({ length: t.orbit }, (_, i) => `<ellipse cx="500" cy="520" rx="${370 + i * 45}" ry="${120 + i * 26}" fill="none" stroke="${fg}" stroke-opacity="${0.55 - i * 0.12}" stroke-width="3" transform="rotate(${-18 + i * 24} 500 520)"/>`).join('');
  const whiskers = [-1, 1].map((s) => [0, 26].map((d) => `<path d="M${cx + s * 90} ${cy + 70 + d} L${cx + s * (h.rx + 90)} ${cy + 50 + d * 1.6}" stroke="${fg}" stroke-opacity=".7" stroke-width="5" stroke-linecap="round"/>`).join('')).join('');
  const mouth = id.fate === 'DEAD'
    ? `<path d="M${cx - 30} ${cy + 96} L${cx + 30} ${cy + 96}" stroke="${fg}" stroke-width="8" stroke-linecap="round"/>`
    : `<path d="M${cx - 34} ${cy + 86} q17 22 34 0 q17 22 34 0" fill="none" stroke="${fg}" stroke-width="8" stroke-linecap="round"/>`;
  const inner = `${field(t.field, fg)}${orbits}
    <path d="${earL}" fill="${body}" stroke="${fg}" stroke-width="8" stroke-linejoin="round"/>
    <path d="${earR}" fill="${body}" stroke="${fg}" stroke-width="8" stroke-linejoin="round"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${h.rx}" ry="${h.ry}" fill="${body}" stroke="${fg}" stroke-width="8"/>
    ${mark(t.mark, fg)}${eyes(t.eyes, id.fate === 'DEAD', fg, body)}
    <path d="M${cx - 16} ${cy + 52} L${cx + 16} ${cy + 52} L${cx} ${cy + 70} Z" fill="${fg}"/>
    ${mouth}${whiskers}`;
  return wrap(inner, bg);
}
export const renderCollapsed = (id: Pick<Identity, 'traits' | 'fate'>) => png(collapsedSvg(id));
