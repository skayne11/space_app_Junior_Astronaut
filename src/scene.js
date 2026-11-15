// The Mars base, drawn on a canvas in a realistic style (Martian sky, layered terrain, metal buildings,
// glass dome, transparent pot, cables, crew). The game only sets a scene *state*; this module animates towards it.
// Some objects are hidden curiosity rewards: tapping them unlocks a space card (even a rover and a helicopter!).

export function newSceneState() {
  return {
    time: "dawn",       // dawn | day | evening | night
    soil: "ok",         // dry | ok | wet
    wilted: false,      // plant not watered
    watering: false,    // Léa waters the plant
    heater: false,
    frost: false,       // freezing night without heater
    flare: false,       // solar flare: radiation + alarm
    astro: "outside",   // Léa: outside | shelter
    dose: false,        // Léa irradiated
    tour: false,        // highlight the main buildings
    grown: false,       // end of level: the seedling has grown
    plantHp: 3,
    seedling: true,     // false = only a seed in the pot
    variety: null,      // fast | balanced | polar (level 2+)
    battery: 0.8,       // 0..1
    dust: false,        // dust storm
    panelsDusty: false,
    shutter: false,     // greenhouse radiation shutter closed
    lab: false,         // research going on in the lab
    lampsOff: false,
    sam: "home",        // home | panels | outside | shelter
    research: null,     // weather | sun | plants
    deepCold: false,    // record cold night (−95 °C)
    nightTemp: null,    // temperature tonight (°C), random in level 3
    mold: false,        // white mold spots on the leaves
    flowers: false,     // the plant is flowering
    pollinated: false,  // small chilies instead of flowers
    recyclerBroken: false,
    crewNote: null,     // extra crew status (tired, out of breath…)
    crop: null,         // level 3 real crop: radish | lettuce | potato | tomato | wheat | chili (null = game chili)
    growth: 0,          // 0..1 progress of the crop over the mission
    builds: {},         // equipment being built: { id: { left, total } }
    installed: {},      // equipment installed on the base: { id: true }
    blackout: 0,        // sols left without contact with Earth (solar conjunction)
  };
}

/* ---------- Layout (logical coordinates, as in the original game) ---------- */
const VIEW_W = 960, GROUND = 446, OFFY = 130, VH = 362;
const POS = { shelter: 70, lab: 175, recycler: 272, thermo: 392, plant: 555, battery: 812 };
const PANEL_X = [858, 900, 942];
/** A small rover exploring the hills (secret card: Perseverance). It drives slowly back and forth. */
const ROVER = { x: 700, y: 381, dir: 1 };
/** Height of the near hills at x (second curve of the hill line: (600,372) → ctrl (820,390) → (960,362)). */
function hillY(x) {
  let lo = 0, hi = 1;
  for (let k = 0; k < 18; k++) { const t = (lo + hi) / 2, xt = (1 - t) * (1 - t) * 600 + 2 * (1 - t) * t * 820 + t * t * 960; if (xt < x) lo = t; else hi = t; }
  const t = (lo + hi) / 2; return (1 - t) * (1 - t) * 372 + 2 * (1 - t) * t * 390 + t * t * 362;
}
/** Where each piece of equipment stands, and the box of its building site. */
const SITE = {
  weather: { x: 330, box: [314, GROUND - 84, 32, 84] },
  telescope: { x: 772, box: [756, GROUND - 60, 32, 60] },
  sensor: { x: 690, box: [672, GROUND - 64, 36, 64] },
  fan: { x: 650, box: [632, GROUND - 170, 36, 36] },
  shield: { x: 745, box: [380, GROUND - 236, 350, 40] },
  reactor: { x: 150, box: [126, 316, 48, 58] },
};
const CREW = [{ name: "Léa", color: "#ff7a59" }, { name: "Sam", color: "#ffd166" }, { name: "Yuki", color: "#6ee7b7" }];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, t)));
const rgb = c => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
const ease = (cur, target, dt, speed = 2) => cur + (target - cur) * (1 - Math.exp(-dt * speed));

const NIGHT = { dawn: 0, day: 0, evening: 0.45, night: 1 };
const SUN_T = { dawn: 0.05, day: 0.5, evening: 0.96, night: 1.25 };
const TEMP = { dawn: -55, day: -20, evening: -50, night: -80 };
const MOIST = { dry: 8, ok: 45, wet: 70, flood: 96 };
const GROWN = { fast: 54, balanced: 46, polar: 38 };
const VARIETY_TINT = { fast: [150, 200, 70], polar: [110, 180, 190] };
const VARIETY_LABEL = { fast: "⚡ LIGHTNING", balanced: "⚖️ CLASSIC", polar: "❄️ POLAR" };

const REAL_SKY = {   // realistic Mars sky: butterscotch by day, dark with a blue glow at dawn and dusk
  dawn: [[52, 46, 66], [176, 132, 108]],
  day: [[168, 122, 88], [222, 184, 142]],
  evening: [[40, 36, 56], [150, 104, 86]],
  night: [[8, 9, 18], [26, 21, 30]],
};

/* ---------- Runtime ---------- */
let cv, ctx, wrap, S = newSceneState(), onHot = () => { }, found = () => false;
let view = { s: 1, ox: 0, oy: 0, w: 0, h: 0, dpr: 1 };
const A = {   // animated values (eased towards the state)
  rtop: REAL_SKY.dawn[0].slice(), rbot: REAL_SKY.dawn[1].slice(), night: 0, sunT: 0.05, temp: -55,
  moist: 45, g: 22, hp: 100, gr: 0, heat: 0, frost: 0, flare: 0, dose: 0, dust: 0, panelDust: 0, bat: 0.8, shutter: 0,
  crew: [{ x: 470, tx: 470, act: null, hidden: false }, { x: 400, tx: 400, act: null, hidden: false }, { x: 430, tx: 430, act: null, hidden: false }],
};
const floats = [];
let last = 0, sunPos = { x: 0, y: 0 };

export function mountScene(el, onHotspot) {
  wrap = el; onHot = onHotspot;
  el.innerHTML = `<canvas aria-label="Your Mars base: shelter, lab, recycler, greenhouse and solar panels. Some things can be tapped."></canvas>`;
  cv = el.querySelector("canvas"); ctx = cv.getContext("2d");
  new ResizeObserver(resize).observe(el); resize();
  cv.addEventListener("click", e => { const p = toLogical(e), h = hitTest(p); if (h) onHot(h.card, null, [p.x, p.y]); });
  cv.addEventListener("mousemove", e => { cv.style.cursor = hitTest(toLogical(e)) ? "pointer" : "default"; });
  requestAnimationFrame(frame);
}
export function updateScene(s) {
  S = { ...s };
  const [lea, sam, yuki] = A.crew;
  // Léa: waters the plant, works by the panels during the flare, or runs to the shelter.
  if (S.watering) { lea.tx = POS.plant - 40; lea.act = "💧"; }
  else if (S.flare && S.astro === "outside") { lea.tx = 760; lea.act = null; }
  else if (S.astro === "shelter") { lea.tx = POS.shelter; lea.act = "🛡️"; }
  else { lea.tx = 470; lea.act = null; }
  if (S.astro !== "shelter") lea.hidden = false;
  // Sam: cleans the panels, stays outside with Léa during the flare (level 2), or shelters.
  if (S.sam === "panels") { sam.tx = PANEL_X[1] - 4; sam.act = "🧹"; }
  else if (S.sam === "recycler") { sam.tx = POS.recycler + 40; sam.act = "🔧"; }
  else if (S.flare && S.sam === "outside") { sam.tx = 700; sam.act = null; }
  else if (S.flare || S.sam === "shelter") { sam.tx = POS.shelter; sam.act = "🛡️"; }
  else if (S.builds && Object.keys(S.builds).length) { const k = Object.keys(S.builds)[0]; sam.tx = k === "fan" || k === "sensor" ? 700 : k === "shield" ? 750 : k === "reactor" ? 120 : SITE[k].x + 22; sam.act = "🛠️"; }
  else { sam.tx = 400; sam.act = null; }
  if (sam.tx !== POS.shelter) sam.hidden = false;
  // Yuki: researches in the lab, shelters during a flare, otherwise near the greenhouse.
  if (S.flare) { yuki.tx = POS.shelter; yuki.act = "🛡️"; }
  else if (S.lab) { yuki.tx = POS.lab + 30; yuki.act = "🔬"; }
  else { yuki.tx = 430; yuki.act = null; }
  if (yuki.tx !== POS.shelter) yuki.hidden = false;
}
export function markFound(has) { found = has; }
export function pop(x, y, text) { floats.push({ x, y, text, t: 0 }); }

function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight || w * VH / VIEW_W, dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + "px"; cv.style.height = h + "px";
  const s = Math.min(w / VIEW_W, h / VH);
  view = { s, ox: (w - VIEW_W * s) / 2, oy: (h - VH * s) / 2, w, h, dpr };
}
function toLogical(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - view.ox) / view.s, y: OFFY + (e.clientY - r.top - view.oy) / view.s }; }

/* ---------- Hotspots: hidden cards ---------- */
export const SECRET_CARDS = ["solar_system", "magnetic_shield", "laboratory", "oxygen", "temperature", "energy", "solar_energy", "communication", "perseverance", "ingenuity"];
let heliPos = { x: 0, y: 0, on: false };
function hotspots() {
  return [
    { card: "solar_system", x: sunPos.x, y: sunPos.y, r: 34, tw: [sunPos.x + 20, sunPos.y - 20], on: A.sunT < 1.05 },
    { card: "magnetic_shield", box: [POS.shelter - 46, GROUND - 56, 92, 56], tw: [POS.shelter + 34, GROUND - 52] },
    { card: "laboratory", box: [POS.lab - 50, GROUND - 72, 100, 72], tw: [POS.lab - 44, GROUND - 72] },
    { card: "communication", box: [POS.lab + 14, GROUND - 104, 34, 32], tw: [POS.lab + 52, GROUND - 100] },
    { card: "oxygen", box: [POS.recycler - 30, GROUND - 56, 60, 56], tw: [POS.recycler + 26, GROUND - 58] },
    { card: "temperature", box: [POS.thermo - 14, GROUND - 180, 28, 172], tw: [POS.thermo + 14, GROUND - 182] },
    { card: "energy", box: [POS.battery - 16, GROUND - 46, 32, 46], tw: [POS.battery + 14, GROUND - 48] },
    { card: "solar_energy", box: [PANEL_X[0] - 22, GROUND - 64, PANEL_X[2] - PANEL_X[0] + 44, 64], tw: [PANEL_X[2] + 8, GROUND - 66] },
    { card: "perseverance", box: [ROVER.x - 22, ROVER.y - 30, 44, 34], tw: [ROVER.x + 18, ROVER.y - 30] },
    { card: "ingenuity", x: heliPos.x, y: heliPos.y, r: 24, tw: [heliPos.x + 18, heliPos.y - 16], on: heliPos.on },
  ];
}
function hitTest(p) {
  return hotspots().find(h => h.on !== false && (h.r ? Math.hypot(p.x - h.x, p.y - h.y) < h.r : p.x >= h.box[0] && p.x <= h.box[0] + h.box[2] && p.y >= h.box[1] && p.y <= h.box[1] + h.box[3]));
}

/* ---------- Drawing helpers ---------- */
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function emoji(x, y, t, size) { ctx.font = `${size || 16}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(t, x, y); ctx.textBaseline = "alphabetic"; }
const label = (x, y, t) => labelReal(x, y, t);
function attention(x, y, now, r = 30) {
  const p = reduce ? 0.5 : (Math.sin(now / 220) + 1) / 2;
  ctx.strokeStyle = `rgba(255,214,102,${0.45 + p * 0.5})`; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, r + p * 5, 0, Math.PI * 2); ctx.stroke();
  const ay = y - r - 20 - p * 6;
  ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.moveTo(x - 9, ay); ctx.lineTo(x + 9, ay); ctx.lineTo(x, ay + 12); ctx.closePath(); ctx.fill(); ctx.fillRect(x - 3, ay - 12, 6, 12);
}


function drawCables(now) {
  const bx = POS.battery, y0 = GROUND + 8, day = (S.time === "day" || S.time === "dawn") && !S.dust, dead = A.bat < 0.12, lamps = !S.lampsOff && (!day || S.dust);
  const lanes = [{ to: POS.plant, on: dead ? 0 : A.heat > 0.3 || lamps ? 1 : 0, dy: 0 }, { to: POS.recycler, on: dead ? 0 : 0.5, dy: 6 }, { to: POS.lab, on: dead ? 0 : S.lab ? 1 : 0.4, dy: 12 }];
  lanes.forEach(l => {
    const y = y0 + l.dy;
    ctx.strokeStyle = "#1c1a2a"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(l.to, y); ctx.lineTo(l.to, GROUND); ctx.stroke();
    if (l.on > 0) {
      ctx.strokeStyle = `rgba(255,209,102,${0.25 + l.on * 0.75})`; ctx.lineWidth = 2 + l.on * 2; ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 6 + l.on * 10;
      ctx.setLineDash([8, 6]); ctx.lineDashOffset = reduce ? 0 : -(now / 30) % 14;   // negative offset: dashes flow from the battery to the buildings
      ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(l.to, y); ctx.lineTo(l.to, GROUND); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
    }
  });
  const prod = day ? 1 - A.panelDust * 0.85 : 0;
  PANEL_X.forEach(px => { ctx.strokeStyle = prod > 0.05 ? `rgba(255,209,102,${0.25 + prod * 0.75})` : "#1c1a2a"; ctx.lineWidth = 2 + prod * 2; ctx.beginPath(); ctx.moveTo(px, GROUND); ctx.lineTo(px, GROUND + 4); ctx.lineTo(bx, GROUND + 4); ctx.stroke(); });
  ctx.fillStyle = "#3b3f55"; rr(bx - 14, GROUND - 40, 28, 40, 5); ctx.fill(); ctx.fillRect(bx - 5, GROUND - 44, 10, 5);
  const lv = Math.max(0.03, A.bat) * 32; ctx.fillStyle = A.bat < 0.2 ? "#ff6b6b" : "#ffd166"; rr(bx - 10, GROUND - 4 - lv, 20, lv, 3); ctx.fill();
  if (A.bat < 0.2 && !reduce && Math.sin(now / 200) > 0) { ctx.fillStyle = "#ff6b6b"; emoji(bx, GROUND - 58, "🪫", 16); }
}

function drawThermo() {
  const x = POS.thermo, top = GROUND - 175, bot = GROUND - 30, temp = A.temp, blue = temp < -40;
  const lvl = (temp + 100) / 100;
  ctx.fillStyle = "#d8e2f4"; rr(x - 7, top, 14, bot - top, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x, bot + 8, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = blue ? "#6aa8ff" : "#ff6a4a"; ctx.beginPath(); ctx.arc(x, bot + 8, 9, 0, Math.PI * 2); ctx.fill();
  const h = (bot - top - 6) * lvl; rr(x - 3, bot - h, 6, h + 4, 3); ctx.fill();
  ctx.font = "700 10px 'Space Mono', monospace"; ctx.textAlign = "left"; ctx.fillStyle = "#eef0fbcc"; ctx.fillText(`${Math.round(temp)}°`, x + 11, bot - h + 4);
}

function drawPot(now) {
  const x0 = POS.plant, bottom = GROUND - 2, top = GROUND - 56, w = 54;
  ctx.fillStyle = "#cfe3ff22"; ctx.strokeStyle = "#cfe3ffaa"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0 - w, top); ctx.lineTo(x0 + w, top); ctx.lineTo(x0 + w - 8, bottom); ctx.lineTo(x0 - w + 8, bottom); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = A.moist < 15 ? "#9a7650" : "#6b4a32"; ctx.fillRect(x0 - w, top + 6, w * 2, bottom - top);
  const wh = (bottom - top - 6) * Math.min(1, A.moist / 100);
  const wg = ctx.createLinearGradient(0, bottom - wh, 0, bottom); wg.addColorStop(0, "#4a7fd0aa"); wg.addColorStop(1, "#2a5fb0dd");
  ctx.fillStyle = wg; ctx.fillRect(x0 - w, bottom - wh, w * 2, wh);
  if (!reduce && wh > 4) { ctx.strokeStyle = "#9cc0ff88"; ctx.lineWidth = 1.5; ctx.beginPath(); for (let k = 0; k <= 20; k++) { const xx = x0 - w + k * w / 10, yy = bottom - wh + Math.sin(now / 400 + k) * 1.5; k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); }
  const depth = Math.min(1, A.g / 50) * (bottom - top - 10);
  ctx.strokeStyle = A.hp > 40 ? "#f0dcb0" : "#b09070"; ctx.lineWidth = 1.6;
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x0, top + 8); ctx.quadraticCurveTo(x0 + k * 10, top + 8 + depth * 0.5, x0 + k * 18, top + 8 + depth * (0.6 + Math.abs(k) * 0.1)); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = "#cfe3ffaa"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 - w, top); ctx.lineTo(x0 + w, top); ctx.lineTo(x0 + w - 8, bottom); ctx.lineTo(x0 - w + 8, bottom); ctx.closePath(); ctx.stroke();
  return top + 6;
}

function drawPlant(now, base) {
  const x0 = POS.plant, g = A.g, hp = A.hp, happy = S.grown && hp > 40;
  if (g < 3) { ctx.fillStyle = "#c49a5a"; ctx.beginPath(); ctx.ellipse(x0, base - 2, 6, 4, 0, 0, Math.PI * 2); ctx.fill(); return; }
  const healthC = lerp([200, 176, 84], VARIETY_TINT[S.variety] || [92, 196, 104], (hp - 15) / 85);
  const leafC = lerp(healthC, [170, 200, 230], A.frost * 0.55);
  const droop = A.moist < 15 ? 0.55 : A.moist < 30 ? 0.25 : 0;
  const sway = reduce ? 0 : Math.sin(now / 1300) * 0.02;
  const H = Math.min(140, 10 + g * 1.45);
  if (happy) { const p = reduce ? 0.6 : (Math.sin(now / 300) + 1) / 2; const hg = ctx.createRadialGradient(x0, base - H / 2, 10, x0, base - H / 2, H * 0.9); hg.addColorStop(0, `rgba(255,240,150,${0.25 + p * 0.2})`); hg.addColorStop(1, "rgba(255,240,150,0)"); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x0, base - H / 2, H, 0, Math.PI * 2); ctx.fill(); }
  let seed = 98; const r = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  ctx.save(); ctx.translate(x0, base); ctx.rotate(sway);
  ctx.strokeStyle = rgb(lerp(leafC, [70, 110, 60], 0.45)); ctx.lineCap = "round"; ctx.lineWidth = 2 + Math.min(6, g / 14);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-4, -H * 0.5, 0, -H); ctx.stroke();
  const nB = Math.min(8, Math.floor(g / 8)), tips = [];
  for (let k = 0; k < nB; k++) {
    const t = 0.22 + k * (0.7 / Math.max(1, nB)), side = k % 2 ? 1 : -1, by = -H * t;
    const L = (16 + Math.min(1, g / 60) * 58) * (1 - t * 0.5) * (0.85 + r() * 0.3);
    const ang = -Math.PI / 2 + side * (1.0 + r() * 0.3) + droop * side * 0.6;
    const ex = Math.cos(ang) * L, ey = by + Math.sin(ang) * L; tips.push([ex, ey]);
    ctx.lineWidth = 1.5 + Math.min(3, g / 25); ctx.beginPath(); ctx.moveTo(0, by); ctx.quadraticCurveTo(Math.cos(ang) * L * 0.5, by + Math.sin(ang) * L * 0.5 - 6, ex, ey); ctx.stroke();
    const nl = 2 + Math.floor(Math.min(1, g / 50) * 3);
    for (let l = 1; l <= nl; l++) {
      const lt = l / (nl + 0.4), lx = ex * lt, ly = by + (ey - by) * lt, la = ang + (l % 2 ? 0.9 : -0.9) + droop * 0.9 * side, size = 7 + Math.min(1, g / 45) * 8;
      ctx.fillStyle = rgb(lerp(leafC, [50, 140, 70], (l % 2) * 0.3));
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(la); ctx.beginPath(); ctx.ellipse(size * 0.8, 0, size, size * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      if (S.mold) { ctx.fillStyle = "#f1f1e8dd"; ctx.beginPath(); ctx.arc(size * 0.6, 1, 2.2, 0, Math.PI * 2); ctx.arc(size * 1.1, -1, 1.6, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
  }
  ctx.fillStyle = rgb(leafC);
  for (let l = 0; l < 3; l++) { ctx.save(); ctx.translate(0, -H); ctx.rotate(-Math.PI / 2 + (l - 1) * 0.8 + droop * (l - 1)); ctx.beginPath(); ctx.ellipse(7, 0, 9, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  // Flowers, then small chilies once pollinated
  if (S.pollinated && S.crop === "tomato") tips.slice(0, 6).forEach(([x, y], k) => { const r = 5 + (S.grown ? 4 : 0); ctx.fillStyle = S.grown && k % 3 !== 2 ? "#e2342a" : "#7cc35a"; ctx.beginPath(); ctx.arc(x, y + r, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#2f7a3a"; ctx.beginPath(); ctx.arc(x, y + 1, 2.5, 0, Math.PI * 2); ctx.fill(); });
  else if (S.pollinated) tips.slice(0, 5).forEach(([x, y], k) => { const len = 12 + (S.grown ? 8 : 0); ctx.fillStyle = S.grown && k % 2 === 0 ? "#e2342a" : "#5caa46"; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.quadraticCurveTo(x - 7, y + len * 0.6, x + 1, y + len); ctx.quadraticCurveTo(x + 7, y + len * 0.5, x + 4, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#3f7a3a"; ctx.fillRect(x - 3, y - 4, 6, 5); });
  else if (S.flowers) tips.slice(0, 5).forEach(([x, y]) => { for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; ctx.fillStyle = S.crop === "tomato" ? "#ffd84a" : "#fbf7ff"; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 4.4, 3.2, a, 0, Math.PI * 2); ctx.fill(); } ctx.fillStyle = "#ffe08a"; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill(); });
  ctx.restore();
  if (happy && !reduce) for (let k = 0; k < 6; k++) { const a = now / 700 + k, r2 = 40 + (k % 3) * 20; ctx.fillStyle = "#fff6b0"; ctx.globalAlpha = 0.5 + Math.sin(now / 200 + k) * 0.4; emoji(x0 + Math.cos(a) * r2, base - H / 2 + Math.sin(a) * r2 * 0.6, "✦", 10); ctx.globalAlpha = 1; }
}

/* ---------- Secret explorers: a rover on the hills, a helicopter in the sky ---------- */
function drawRover(now) {
  // slow back-and-forth drive along the hills (it slows down at both ends, as if stopping to look around)
  const ph = reduce ? 0 : now / 7000, x = 745 + Math.sin(ph) * 115, speed = Math.cos(ph);
  ROVER.x = x; ROVER.y = hillY(x) + 3; ROVER.dir = speed >= 0 ? 1 : -1;
  const y = ROVER.y, s = 0.5, slope = Math.atan2(hillY(x + 6) - hillY(x - 6), 12);
  // a little dust behind the wheels while it moves
  if (!reduce && Math.abs(speed) > 0.3) { ctx.fillStyle = "rgba(200,150,110,.35)"; for (let k = 0; k < 3; k++) { const d = ((now / 120 + k * 4) % 12); ctx.globalAlpha = 0.35 * (1 - d / 12); ctx.beginPath(); ctx.arc(x - ROVER.dir * (16 + d * 1.6), y - 2 - d * 0.6, 2 + d * 0.25, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }
  ctx.save(); ctx.translate(x, y); ctx.rotate(slope); ctx.scale(s * ROVER.dir, s);
  ctx.fillStyle = "#e8dcc4"; rr(-26, -26, 52, 14, 3); ctx.fill();
  ctx.fillRect(-4, -46, 5, 20); rr(-12, -56, 18, 11, 3); ctx.fill();
  ctx.fillStyle = "#2a2f4a"; ctx.beginPath(); ctx.arc(1, -51, 3, 0, Math.PI * 2); ctx.fill();
  const spin = reduce ? 0 : now / 300 * Math.sign(speed);
  [-18, 0, 18].forEach(wx => {
    ctx.fillStyle = "#4a3f55"; ctx.beginPath(); ctx.arc(wx, -6, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#8a8296"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(wx + Math.cos(spin) * 5, -6 + Math.sin(spin) * 5); ctx.lineTo(wx - Math.cos(spin) * 5, -6 - Math.sin(spin) * 5); ctx.stroke();   // spoke
  });
  if (!reduce && Math.sin(now / 400) > 0.6) { ctx.fillStyle = "#7ee08a"; ctx.beginPath(); ctx.arc(-20, -30, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function drawHeli(now) {
  heliPos.on = !S.dust && !S.flare && A.night < 0.6;
  if (!heliPos.on) return;
  const x = 250 + Math.sin(now / 5200) * 70, y = 250 + Math.sin(now / 900) * 8;
  heliPos.x = x; heliPos.y = y;
  ctx.fillStyle = "#3b3f55"; ctx.fillRect(x - 6, y - 5, 12, 10);
  ctx.strokeStyle = "#c9cfe0"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y - 14); ctx.moveTo(x - 5, y + 5); ctx.lineTo(x - 9, y + 12); ctx.moveTo(x + 5, y + 5); ctx.lineTo(x + 9, y + 12); ctx.stroke();
  const b = reduce ? 1 : Math.abs(Math.sin(now / 30));   // spinning blades
  ctx.strokeStyle = "#eef0fb"; ctx.lineWidth = 2;
  [y - 14, y - 10].forEach((by, k) => { const w = 18 * (k ? 1 - b * 0.6 : 0.4 + b * 0.6); ctx.beginPath(); ctx.moveTo(x - w, by); ctx.lineTo(x + w, by); ctx.stroke(); });
}

/* ---------- Radio dish on the lab roof: contact with Earth ---------- */
function drawAntenna(now) {
  const x = POS.lab + 30, y = GROUND - 72, off = S.blackout > 0;
  ctx.strokeStyle = "#c9cfe0"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 14); ctx.stroke();
  ctx.save(); ctx.translate(x, y - 16); ctx.rotate(-0.6);
  ctx.fillStyle = "#e6e9f5"; ctx.beginPath(); ctx.ellipse(0, 0, 13, 5, 0, 0, Math.PI); ctx.fill();
  ctx.strokeStyle = "#c9cfe0"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -8); ctx.stroke();
  ctx.fillStyle = off ? "#ff6b6b" : "#7ee08a"; ctx.beginPath(); ctx.arc(0, -9, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (off) {   // no signal: red cross that blinks
    if (reduce || Math.sin(now / 300) > -0.3) { ctx.strokeStyle = "#ff6b6b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 10, y - 40); ctx.lineTo(x + 22, y - 28); ctx.moveTo(x + 22, y - 40); ctx.lineTo(x + 10, y - 28); ctx.stroke(); }
    ctx.font = "700 9px 'Space Mono', monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#ff8a8a"; ctx.fillText("NO SIGNAL", x + 16, y - 46);
  } else if (!reduce) {   // waves going up towards Earth
    ctx.strokeStyle = "#cfe3ff"; ctx.lineWidth = 1.6;
    for (let k = 0; k < 3; k++) { const r = ((now / 25 + k * 12) % 36) + 6; ctx.globalAlpha = 1 - r / 42; ctx.beginPath(); ctx.arc(x + 6, y - 26, r, -Math.PI * 0.85, -Math.PI * 0.35); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
}

/* ---------- Equipment built from lab research (level 3) ---------- */
const built = k => S.installed && S.installed[k];
function drawSite(k, now) {   // building site: dashed outline, progress bar, tools
  const b = S.builds && S.builds[k]; if (!b) return;
  const [x, y, w, h] = SITE[k].box, p = (b.total - b.left) / b.total, pulse = reduce ? 0.8 : 0.6 + Math.sin(now / 250) * 0.3;
  ctx.strokeStyle = `rgba(242,193,78,${pulse})`; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
  if (k === "shield") { ctx.beginPath(); ctx.ellipse(POS.plant, GROUND, 198, 233, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  else { ctx.strokeRect(x, y, w, h); ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w, y); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.stroke(); }
  ctx.setLineDash([]);
  const bx = k === "shield" ? POS.plant - 30 : x + w / 2 - 22, by = k === "shield" ? GROUND - 252 : y - 14;
  ctx.fillStyle = "#131525cc"; rr(bx - 2, by - 2, 48, 9, 4); ctx.fill(); ctx.fillStyle = "#f2c14e"; rr(bx, by, 44 * Math.max(0.08, p), 5, 2.5); ctx.fill();
  emoji(bx + 54, by + 2, "🛠️", 13);
}
function drawReactor(now) {   // on the hill behind the lab, far from the crew
  if (!built("reactor")) return drawSite("reactor", now);
  const x = 150, y = 372;
  ctx.strokeStyle = "#cfc2a8"; ctx.lineWidth = 3;
  for (let k = 0; k < 6; k++) { const a = Math.PI + (k + 0.5) / 6 * Math.PI; ctx.beginPath(); ctx.moveTo(x, y - 34); ctx.lineTo(x + Math.cos(a) * 34, y - 40 + Math.sin(a) * 18); ctx.stroke(); }
  ctx.fillStyle = "#e8dcc4"; rr(x - 9, y - 50, 18, 50, 4); ctx.fill();
  const p = reduce ? 0.7 : 0.55 + Math.sin(now / 400) * 0.3; ctx.fillStyle = `rgba(110,231,183,${p})`; ctx.beginPath(); ctx.arc(x, y - 20, 5, 0, Math.PI * 2); ctx.fill();
  ctx.font = "700 9px 'Space Mono', monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#eef0fbaa"; ctx.fillText("⚛ REACTOR", x, y + 10);
}
function drawWeather(now) {
  if (!built("weather")) return drawSite("weather", now);
  const x = SITE.weather.x;
  ctx.strokeStyle = "#c9cfe0"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x, GROUND - 70); ctx.stroke();
  const spin = reduce ? 0 : now / 150;
  for (let a = 0; a < 3; a++) { const an = spin + a * 2.09; ctx.fillStyle = "#eef0fb"; ctx.beginPath(); ctx.arc(x + Math.cos(an) * 10, GROUND - 74 + Math.sin(an) * 3, 3.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = "#2a2f4a"; rr(x - 14, GROUND - 46, 28, 22, 4); ctx.fill();
  emoji(x, GROUND - 35, S.dust ? "🌪️" : A.temp < -70 ? "🥶" : "🌤️", 13);
}
function drawTelescope(now) {
  if (!built("telescope")) return drawSite("telescope", now);
  const x = SITE.telescope.x;
  ctx.strokeStyle = "#c9cfe0"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 12, GROUND); ctx.lineTo(x, GROUND - 32); ctx.lineTo(x + 12, GROUND); ctx.moveTo(x, GROUND - 32); ctx.lineTo(x, GROUND); ctx.stroke();
  ctx.save(); ctx.translate(x, GROUND - 36); ctx.rotate(-0.9); ctx.fillStyle = "#e6e9f5"; rr(-6, -26, 12, 34, 4); ctx.fill(); ctx.fillStyle = A.flare > 0.1 ? "#ff6b6b" : "#ffd166"; ctx.fillRect(-6, -28, 12, 4); ctx.restore();
}
function drawSensor(now) {   // inside the dome: probe in the pot + display
  if (!built("sensor")) return drawSite("sensor", now);
  const x = SITE.sensor.x, m = A.moist, ok = m >= 25 && m <= 75;
  ctx.strokeStyle = "#8a90b0"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(POS.plant + 34, GROUND - 30); ctx.quadraticCurveTo(x - 40, GROUND - 80, x, GROUND - 50); ctx.stroke();
  ctx.fillStyle = "#c9cfe0"; ctx.fillRect(POS.plant + 32, GROUND - 46, 3, 30);
  ctx.fillStyle = "#555a7a"; ctx.fillRect(x - 2, GROUND - 34, 4, 34);
  ctx.fillStyle = "#2a2f4a"; rr(x - 17, GROUND - 62, 34, 28, 4); ctx.fill();
  ctx.fillStyle = ok ? "#7ee08a" : "#ff6b6b"; rr(x - 13, GROUND - 58, 26, 20, 3); ctx.fill();
  ctx.font = "700 10px 'Space Mono', monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#131525"; ctx.fillText(`${Math.round(m)}%`, x, GROUND - 44);
}
function drawFan(now) {   // inside the dome, near the top
  if (!built("fan")) return drawSite("fan", now);
  const { x } = SITE.fan, y = GROUND - 152, spin = reduce ? 0 : now / 80;
  ctx.fillStyle = "#3b3f55"; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#c9cfe0"; for (let k = 0; k < 3; k++) { ctx.save(); ctx.translate(x, y); ctx.rotate(spin + k * 2.09); ctx.beginPath(); ctx.ellipse(7, 0, 7, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  if (!reduce) { ctx.strokeStyle = "#cfe3ff55"; ctx.lineWidth = 1.5; for (let k = 0; k < 3; k++) { const o = (now / 12 + k * 20) % 60; ctx.beginPath(); ctx.moveTo(x - 22 - o, y - 6 + k * 6); ctx.lineTo(x - 34 - o, y - 6 + k * 6); ctx.stroke(); } }
}
function drawShield(now) {   // layer of Martian soil covering the top of the dome
  if (!built("shield")) return drawSite("shield", now);
  ctx.strokeStyle = "rgba(122,62,34,.92)"; ctx.lineWidth = 16; ctx.beginPath(); ctx.ellipse(POS.plant, GROUND, 198, 233, 0, Math.PI * 1.13, Math.PI * 1.87); ctx.stroke();
  ctx.fillStyle = "#9b5a34"; for (let k = 0; k < 26; k++) { const a = Math.PI * (1.14 + k / 26 * 0.72); ctx.beginPath(); ctx.arc(POS.plant + Math.cos(a) * 198, GROUND + Math.sin(a) * 233, 2.2, 0, Math.PI * 2); ctx.fill(); }
}

/* ---------- Real crops (level 3) ---------- */
function cropColor(base) {
  const healthC = lerp([200, 176, 84], base, (A.hp - 15) / 85);
  return lerp(healthC, [170, 200, 230], A.frost * 0.55);
}
function moldSpots(x0, base, w, h) {
  if (!S.mold) return; ctx.fillStyle = "#f1f1e8dd";
  for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(x0 - w / 2 + (k * 37 % 100) / 100 * w, base - 6 - (k * 53 % 100) / 100 * h, 2 + k % 2, 0, Math.PI * 2); ctx.fill(); }
}
function glow(x0, base, H) {
  if (!S.grown || A.hp < 40) return;
  const p = reduce ? 0.6 : (Math.sin(performance.now() / 300) + 1) / 2, hg = ctx.createRadialGradient(x0, base - H / 2, 10, x0, base - H / 2, H);
  hg.addColorStop(0, `rgba(255,240,150,${0.22 + p * 0.18})`); hg.addColorStop(1, "rgba(255,240,150,0)"); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x0, base - H / 2, H, 0, Math.PI * 2); ctx.fill();
}
const droopOf = () => A.moist < 15 ? 0.5 : A.moist < 30 ? 0.22 : 0;
const CROPS = {
  chili: null, tomato: null,   // drawn by drawPlant (branching plant with fruit)
  lettuce(now, base) {
    const x0 = POS.plant, gr = A.gr, n = 6 + Math.floor(gr * 8), L = 18 + gr * 58, W = 8 + gr * 17, droop = droopOf();
    glow(x0, base, L);
    for (let k = n - 1; k >= 0; k--) {   // outer leaves first
      const side = k % 2 ? 1 : -1, spread = (k / n) * 1.25 + droop * 0.6, ang = -Math.PI / 2 + side * spread, len = L * (1 - k / n * 0.35);
      const red = k % 3 !== 0; ctx.fillStyle = rgb(cropColor(red ? [150, 50, 70] : [110, 190, 90]));
      ctx.save(); ctx.translate(x0 + side * k * 0.6, base); ctx.rotate(ang + Math.PI / 2); ctx.beginPath(); ctx.ellipse(0, -len / 2, W * (0.75 + (k % 3) * 0.12), len / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -len * 0.9); ctx.stroke(); ctx.restore();
    }
    moldSpots(x0, base, L, L * 0.8);
  },
  radish(now, base) {
    const x0 = POS.plant, gr = A.gr, L = 10 + gr * 34, droop = droopOf(), r = 3 + gr * 12;
    glow(x0, base, L);
    ctx.fillStyle = rgb(cropColor([92, 176, 84]));
    for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * (0.35 + droop * 0.3); ctx.save(); ctx.translate(x0, base - r * 0.6); ctx.rotate(a + Math.PI / 2); ctx.beginPath(); ctx.ellipse(0, -L / 2, 4 + gr * 5, L / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    // the red root, half in the soil (visible through the transparent pot)
    ctx.fillStyle = A.hp > 40 ? "#d8325a" : "#a0566a"; ctx.beginPath(); ctx.ellipse(x0, base + r * 0.25, r, r * 0.95, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fbe8ee"; ctx.beginPath(); ctx.ellipse(x0, base + r * 0.95, r * 0.45, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#f0dcb0"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x0, base + r * 1.2); ctx.lineTo(x0 + 2, base + r * 1.2 + 14); ctx.stroke();
    moldSpots(x0, base, L, L);
  },
  potato(now, base) {
    const x0 = POS.plant, gr = A.gr, H = 16 + gr * 56, droop = droopOf();
    glow(x0, base, H);
    // tubers in the soil, growing over the sols
    const nt = Math.round(gr * 5); ctx.fillStyle = "#c9a06a"; ctx.strokeStyle = "#7a5a30"; ctx.lineWidth = 1.2;
    [[-26, 22], [18, 30], [-6, 38], [32, 16], [-36, 34]].slice(0, nt).forEach(([dx, dy]) => { ctx.beginPath(); ctx.ellipse(x0 + dx, base + dy * 0.9, 5 + gr * 6, 4 + gr * 4, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    const leafC = cropColor([80, 160, 80]);
    for (let st = 0; st < 4; st++) {
      const a = -Math.PI / 2 + (st - 1.5) * (0.35 + droop * 0.4), ex = x0 + Math.cos(a) * H, ey = base + Math.sin(a) * H;
      ctx.strokeStyle = rgb(lerp(leafC, [60, 100, 50], 0.4)); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x0, base); ctx.quadraticCurveTo(x0 + (ex - x0) * 0.3, base + (ey - base) * 0.6, ex, ey); ctx.stroke();
      ctx.fillStyle = rgb(leafC);
      for (let l = 1; l <= 4; l++) { const t = l / 4.3, lx = x0 + (ex - x0) * t, ly = base + (ey - base) * t; ctx.beginPath(); ctx.ellipse(lx + (l % 2 ? 6 : -6), ly, 6 + gr * 4, 3.5 + gr * 2.5, l % 2 ? 0.5 : -0.5, 0, Math.PI * 2); ctx.fill(); }
    }
    moldSpots(x0, base, H, H * 0.8);
  },
  wheat(now, base) {
    const x0 = POS.plant, gr = A.gr, H = 20 + gr * 120, droop = droopOf(), sway = reduce ? 0 : Math.sin(now / 900) * 2;
    glow(x0, base, H * 0.8);
    const ripe = S.grown ? 1 : Math.max(0, (gr - 0.75) / 0.25), stalkC = lerp(cropColor([110, 180, 80]), [220, 180, 90], ripe);
    for (let k = 0; k < 7; k++) {
      const dx = (k - 3) * 6, h = H * (0.82 + (k % 3) * 0.09), tx = x0 + dx + (k - 3) * (2 + droop * 10) + sway, ty = base - h;
      ctx.strokeStyle = rgb(stalkC); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + dx, base); ctx.quadraticCurveTo(x0 + dx, base - h * 0.5, tx, ty); ctx.stroke();
      ctx.fillStyle = rgb(stalkC); ctx.save(); ctx.translate(x0 + dx, base - h * 0.35); ctx.rotate((k % 2 ? 0.7 : -0.7) + droop * (k % 2 ? 0.6 : -0.6)); ctx.beginPath(); ctx.ellipse(0, -10 - gr * 6, 2.2, 10 + gr * 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (gr > 0.45) { ctx.fillStyle = rgb(lerp([140, 190, 90], [232, 190, 80], ripe)); for (let e = 0; e < 6; e++) { ctx.beginPath(); ctx.ellipse(tx + (e % 2 ? 2 : -2), ty + e * 4.2, 2.6, 3.4, e % 2 ? 0.5 : -0.5, 0, Math.PI * 2); ctx.fill(); } }
    }
    moldSpots(x0, base, 40, H * 0.6);
  },
};

function drawAstronaut(c, i, now) {
  if (c.hidden) return;
  softShadow(c.x + 3, GROUND + 4, 12, 3, 0.45);
  const info = CREW[i], walking = Math.abs(c.tx - c.x) > 1, x = c.x, y = GROUND + 4, stepY = walking && !reduce ? Math.sin(now / 90) * 3 : 0;
  const dose = i === 0 || (i === 1 && S.sam === "outside") ? A.dose : 0;
  if (dose > 0.01) { const p = reduce ? 0.6 : (Math.sin(now / 160) + 1) / 2; const hg = ctx.createRadialGradient(x, y - 24, 4, x, y - 24, 46); hg.addColorStop(0, `rgba(210,255,80,${(0.35 + p * 0.3) * dose})`); hg.addColorStop(1, "rgba(210,255,80,0)"); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y - 24, 46, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = "#eef0fb"; ctx.fillRect(x - 6, y - 10, 5, 10 + stepY); ctx.fillRect(x + 1, y - 10, 5, 10 - stepY);
  ctx.beginPath(); ctx.ellipse(x, y - 20, 9, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = info.color; ctx.fillRect(x - 9, y - 22, 18, 4);
  ctx.fillStyle = dose > 0.5 ? "#ff6b6b" : "#7ee08a"; ctx.beginPath(); ctx.arc(x + 5, y - 14, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#eef0fb"; ctx.beginPath(); ctx.arc(x, y - 38, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2a3a6a"; ctx.beginPath(); ctx.ellipse(x + 3, y - 38, 5.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  const tag = (dose > 0.5 ? "☢️ " : c.act && !walking ? c.act + " " : walking ? "🚶 " : "") + info.name;
  ctx.font = "700 11px 'Atkinson Hyperlegible', sans-serif"; const tw = ctx.measureText(tag).width + 14;
  ctx.fillStyle = "#131525dd"; rr(x - tw / 2, y - 66, tw, 17, 8); ctx.fill(); ctx.fillStyle = info.color; ctx.textAlign = "center"; ctx.fillText(tag, x, y - 54);
}

/* ---------- Frame ---------- */
function step(dt) {
  const t = S.time;
  A.rtop = lerp(A.rtop, REAL_SKY[t][0], 1 - Math.exp(-dt * 1.6)); A.rbot = lerp(A.rbot, REAL_SKY[t][1], 1 - Math.exp(-dt * 1.6));
  A.night = ease(A.night, Math.max(NIGHT[t], S.dust ? 0.5 : 0), dt, 1.6); A.sunT = ease(A.sunT, SUN_T[t], dt, 1.4);
  A.temp = ease(A.temp, S.deepCold && t !== "day" ? S.nightTemp ?? -95 : TEMP[t], dt, 1.5);
  A.moist = ease(A.moist, S.wilted ? 4 : MOIST[S.soil] ?? 45, dt, 1.1);
  A.gr = ease(A.gr, S.grown ? 1 : S.growth || 0, dt, 1.2);
  A.g = ease(A.g, !S.seedling ? 1 : S.crop ? 6 + (S.grown ? 1 : S.growth || 0) * 44 : S.grown ? GROWN[S.variety] || 46 : S.flowers || S.pollinated ? 34 : 22, dt, 1.2);
  A.hp = ease(A.hp, [10, 25, 60, 100][Math.max(0, Math.min(3, S.plantHp))], dt, 1.2);
  A.heat = ease(A.heat, S.heater ? 1 : 0, dt, 2); A.frost = ease(A.frost, S.frost ? 1 : 0, dt, 1.2);
  A.flare = ease(A.flare, S.flare ? 1 : 0, dt, 3); A.dose = ease(A.dose, S.dose ? 1 : 0, dt, 1.5);
  A.dust = ease(A.dust, S.dust ? 1 : 0, dt, 1.2); A.panelDust = ease(A.panelDust, S.panelsDusty || S.dust ? 1 : 0, dt, S.panelsDusty || S.dust ? 0.6 : 2);
  A.bat = ease(A.bat, S.battery, dt, 1.2); A.shutter = ease(A.shutter, S.shutter ? 1 : 0, dt, 1.4);
  A.crew.forEach(c => {
    const d = c.tx - c.x, v = 150 * dt;
    c.x = Math.abs(d) <= v ? c.tx : c.x + Math.sign(d) * v;
    if (c.x === c.tx && c.tx === POS.shelter && c.act === "🛡️") c.hidden = true;
  });
  floats.forEach(f => f.t += dt / 1.4); while (floats.length && floats[0].t >= 1) floats.shift();
}

function frame(now) {
  const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
  if (reduce) { for (let k = 0; k < 40; k++) step(0.1); } else step(dt);
  draw(now);
  requestAnimationFrame(frame);
}

/* ---------- Drawing the base (realistic style) ---------- */
let groundPattern = null;
/** Seeded random, so the textures and rocks are the same every frame. */
function rng(seed) { let x = seed; return () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; }; }
function makeGroundPattern() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256; const g = c.getContext("2d"), r = rng(7);
  g.fillStyle = "#8a5638"; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 2600; k++) { const v = r(); g.fillStyle = v < 0.5 ? `rgba(60,30,18,${0.08 + r() * 0.15})` : `rgba(220,160,110,${0.05 + r() * 0.12})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 1.5); }
  for (let k = 0; k < 40; k++) { const x = r() * 256, y = r() * 256, rr2 = 1.5 + r() * 3; g.fillStyle = "rgba(50,26,16,.35)"; g.beginPath(); g.ellipse(x + 1, y + 1, rr2, rr2 * 0.6, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "rgba(180,120,85,.6)"; g.beginPath(); g.ellipse(x, y, rr2, rr2 * 0.6, 0, 0, Math.PI * 2); g.fill(); }
  return ctx.createPattern(c, "repeat");
}
function drawSkyReal(L, R, T, B, now) {
  const top = lerp(A.rtop, [150, 100, 70], A.dust * 0.8), bot = lerp(A.rbot, [205, 150, 105], A.dust * 0.8);
  const sky = ctx.createLinearGradient(0, T, 0, OFFY + VH * 0.75); sky.addColorStop(0, rgb(top)); sky.addColorStop(1, rgb(bot));
  ctx.fillStyle = sky; ctx.fillRect(L, T, R - L, B - T);
  // stars (twinkling a little at night)
  const r = rng(3); for (let k = 0; k < 140; k++) { const x = L + r() * (R - L), y = T + r() * (OFFY + 200 - T), sz = r() < 0.08 ? 1.6 : 0.9, tw = reduce ? 1 : 0.75 + Math.sin(now / 600 + k) * 0.25; ctx.globalAlpha = Math.max(0, A.night - 0.15) * (0.3 + r() * 0.7) * tw; ctx.fillStyle = "#fff"; ctx.fillRect(x, y, sz, sz); }
  ctx.globalAlpha = 1;
  // Martian sunsets are blue: a cold glow around the low Sun
  const low = Math.max(0, 1 - Math.abs(Math.sin(Math.min(1, A.sunT) * Math.PI)) * 1.6);
  if (A.sunT < 1.15 && low > 0.01) { const g = ctx.createRadialGradient(sunPos.x, sunPos.y, 4, sunPos.x, sunPos.y, 190); g.addColorStop(0, `rgba(170,205,240,${0.75 * low})`); g.addColorStop(0.35, `rgba(110,150,200,${0.4 * low})`); g.addColorStop(1, "rgba(110,150,200,0)"); ctx.fillStyle = g; ctx.fillRect(L, T, R - L, B - T); }
}
function drawSunReal(now) {
  const t = A.sunT, sx = 380 + t * 520, sy = OFFY + 80 - Math.sin(t * Math.PI) * 50 + Math.max(0, t - 0.95) * 260;
  sunPos = { x: sx, y: sy };
  if (t > 1.2) return;
  const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, 46); g.addColorStop(0, `rgba(255,250,235,${0.9 - A.dust * 0.6})`); g.addColorStop(0.2, `rgba(255,236,200,${0.45 - A.dust * 0.3})`); g.addColorStop(1, "rgba(255,230,190,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(255,252,242,${1 - A.dust * 0.7})`; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();   // the Sun looks smaller from Mars
  if (A.flare > 0.01) { const p = reduce ? 0.5 : (Math.sin(now / 120) + 1) / 2; const f = ctx.createRadialGradient(sx, sy, 6, sx, sy, 70); f.addColorStop(0, `rgba(255,170,90,${(0.6 + p * 0.3) * A.flare})`); f.addColorStop(1, "rgba(255,170,90,0)"); ctx.fillStyle = f; ctx.beginPath(); ctx.arc(sx, sy, 70, 0, Math.PI * 2); ctx.fill(); }
}
function ridge(L, R, base, amp, seed, step) {   // jagged mountain line
  const r = rng(seed); ctx.beginPath(); ctx.moveTo(L - 10, base + 40);
  for (let x = L - 10; x <= R + 10; x += step) ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x / 140 + seed) * Math.cos(x / 61 + seed * 2)) - r() * amp * 0.25);
  ctx.lineTo(R + 10, base + 400); ctx.lineTo(L - 10, base + 400); ctx.closePath();
}
function drawTerrainReal(L, R, T, B) {
  const haze = lerp(A.rbot, [40, 30, 34], A.night * 0.7);
  // far mountains, faded by the dusty air
  ridge(L, R, 352, 40, 11, 8); ctx.fillStyle = rgb(lerp(haze, [120, 80, 62], 0.35)); ctx.fill();
  ridge(L, R, 368, 26, 23, 6); ctx.fillStyle = rgb(lerp(haze, [128, 78, 52], 0.6)); ctx.fill();
  // near hills (same shape as the original scene, so the rover still sits on them)
  const hg = ctx.createLinearGradient(0, 350, 0, GROUND); hg.addColorStop(0, "#9a603f"); hg.addColorStop(1, "#6e3f27");
  ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(L, 380); ctx.lineTo(0, 380); ctx.quadraticCurveTo(300, 350, 600, 372); ctx.quadraticCurveTo(820, 390, 960, 362); ctx.lineTo(R, 362); ctx.lineTo(R, B); ctx.lineTo(L, B); ctx.fill();
}
function drawGroundReal(L, R, B) {
  if (!groundPattern) groundPattern = makeGroundPattern();
  ctx.fillStyle = groundPattern; ctx.fillRect(L, GROUND, R - L, B - GROUND);
  const sh = ctx.createLinearGradient(0, GROUND, 0, B); sh.addColorStop(0, "rgba(255,190,140,.10)"); sh.addColorStop(0.15, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(30,12,6,.55)");
  ctx.fillStyle = sh; ctx.fillRect(L, GROUND, R - L, B - GROUND);
  // rocks and little craters
  const r = rng(41);
  for (let k = 0; k < 26; k++) {
    const x = L + r() * (R - L), y = GROUND + 30 + r() * (B - GROUND - 34), w = 4 + r() * 12, h = w * (0.45 + r() * 0.2);
    if (r() < 0.25) { ctx.strokeStyle = "rgba(40,18,10,.45)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, w * 1.6, h * 1.1, 0, Math.PI, 0); ctx.stroke(); ctx.strokeStyle = "rgba(230,170,120,.35)"; ctx.beginPath(); ctx.ellipse(x, y, w * 1.6, h * 1.1, 0, 0, Math.PI); ctx.stroke(); continue; }
    ctx.fillStyle = "rgba(25,10,5,.35)"; ctx.beginPath(); ctx.ellipse(x + w * 0.35, y + h * 0.5, w, h * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    const rg = ctx.createLinearGradient(x - w, y - h, x + w, y + h); rg.addColorStop(0, "#b98060"); rg.addColorStop(1, "#4e2c1c");
    ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); ctx.fill();
  }
}
function softShadow(x, y, w, h, a = 0.4) { const g = ctx.createRadialGradient(x, y, 1, x, y, w); g.addColorStop(0, `rgba(20,8,4,${a})`); g.addColorStop(1, "rgba(20,8,4,0)"); ctx.save(); ctx.translate(x, y); ctx.scale(1, h / w); ctx.translate(-x, -y); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, w, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
function metal(x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
function drawShelterReal(now = performance.now()) {
  // A habitat buried under a mound of regolith (Martian soil blocks radiation), with a metal airlock sticking out.
  const x = POS.shelter, G = GROUND, inside = A.crew.some(c => c.hidden);
  softShadow(x + 8, G + 3, 74, 11, 0.45);
  // regolith mound
  const mound = () => { ctx.beginPath(); ctx.moveTo(x - 62, G); ctx.bezierCurveTo(x - 50, G - 30, x - 26, G - 50, x + 2, G - 50); ctx.bezierCurveTo(x + 30, G - 50, x + 50, G - 28, x + 60, G); ctx.closePath(); };
  mound(); ctx.fillStyle = metal(x - 40, G - 50, x + 30, G, [[0, "#b77a55"], [0.45, "#8f5636"], [1, "#5e3420"]]); ctx.fill();
  ctx.strokeStyle = "rgba(255,200,150,.25)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 58, G - 6); ctx.bezierCurveTo(x - 48, G - 32, x - 26, G - 50, x + 2, G - 50); ctx.stroke();   // sunlit edge, so the mound stands out from the hills
  ctx.save(); mound(); ctx.clip();
  const r = rng(77);
  for (let k = 0; k < 140; k++) { ctx.fillStyle = r() < 0.5 ? "rgba(50,24,12,.25)" : "rgba(230,170,120,.18)"; ctx.fillRect(x - 62 + r() * 122, G - 52 + r() * 52, 1.5, 1.2); }
  for (let k = 0; k < 7; k++) { const rx = x - 50 + r() * 100, ry = G - 4 - r() * 36, w = 2 + r() * 4; ctx.fillStyle = "rgba(40,18,8,.35)"; ctx.beginPath(); ctx.ellipse(rx + 1, ry + 1, w, w * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#a8724f"; ctx.beginPath(); ctx.ellipse(rx, ry, w, w * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
  const rim = ctx.createLinearGradient(x - 60, 0, x + 60, 0); rim.addColorStop(0, "rgba(255,210,170,.16)"); rim.addColorStop(0.5, "rgba(0,0,0,0)"); rim.addColorStop(1, "rgba(0,0,0,.28)"); ctx.fillStyle = rim; ctx.fillRect(x - 64, G - 54, 128, 54);
  ctx.restore();
  // sandbags at the foot of the mound
  [[x - 56, 0], [x - 44, 0], [x - 50, 1], [x + 38, 0], [x + 50, 0], [x + 44, 1]].forEach(([bx, row]) => { const by = G - 7 - row * 6; ctx.fillStyle = metal(bx, by, bx, by + 7, [[0, "#c9a682"], [1, "#8a6a4c"]]); rr(bx - 7, by, 14, 7, 3.5); ctx.fill(); ctx.strokeStyle = "rgba(50,30,18,.4)"; ctx.lineWidth = 0.8; ctx.stroke(); });
  // vent pipe and beacon on top
  ctx.fillStyle = metal(x + 16, 0, x + 24, 0, [[0, "#c7cbd2"], [1, "#6c717a"]]); ctx.fillRect(x + 17, G - 60, 6, 14); ctx.fillStyle = "#5d6068"; rr(x + 14, G - 63, 12, 4, 2); ctx.fill();
  ctx.strokeStyle = "#8b9099"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 20, G - 47); ctx.lineTo(x - 20, G - 66); ctx.stroke();
  const blink = reduce || Math.sin(now / 350) > 0;
  ctx.fillStyle = A.flare > 0.1 ? (blink ? "#ff4d3d" : "#7a1f18") : (blink ? "#ffb347" : "#6b4a1f"); ctx.beginPath(); ctx.arc(x - 20, G - 68, 2.6, 0, Math.PI * 2); ctx.fill();
  if (blink) { const bg = ctx.createRadialGradient(x - 20, G - 68, 1, x - 20, G - 68, 14); bg.addColorStop(0, A.flare > 0.1 ? "rgba(255,77,61,.5)" : "rgba(255,179,71,.35)"); bg.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x - 20, G - 68, 14, 0, Math.PI * 2); ctx.fill(); }
  // airlock: metal arch coming out of the mound
  const ax = x - 19, aw = 38, ah = 40;
  ctx.fillStyle = metal(ax, 0, ax + aw, 0, [[0, "#6c717a"], [0.3, "#d5d9df"], [0.7, "#a3a8b1"], [1, "#565a62"]]);
  ctx.beginPath(); ctx.moveTo(ax, G); ctx.lineTo(ax, G - ah + 16); ctx.quadraticCurveTo(ax, G - ah, ax + 16, G - ah); ctx.lineTo(ax + aw - 16, G - ah); ctx.quadraticCurveTo(ax + aw, G - ah, ax + aw, G - ah + 16); ctx.lineTo(ax + aw, G); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(40,44,52,.45)"; ctx.lineWidth = 1; [ax + 5, ax + aw - 5].forEach(rx2 => { ctx.beginPath(); ctx.moveTo(rx2, G); ctx.lineTo(rx2, G - ah + 8); ctx.stroke(); });
  // hazard stripes above the hatch
  ctx.save(); rr(ax + 7, G - ah + 5, aw - 14, 5, 1.5); ctx.clip(); ctx.fillStyle = "#f2c14e"; ctx.fillRect(ax, G - ah, aw, 14); ctx.fillStyle = "#1b1d24"; for (let k = -2; k < 9; k++) { ctx.beginPath(); ctx.moveTo(ax + 7 + k * 5, G - ah + 10); ctx.lineTo(ax + 10 + k * 5, G - ah + 5); ctx.lineTo(ax + 12.5 + k * 5, G - ah + 5); ctx.lineTo(ax + 9.5 + k * 5, G - ah + 10); ctx.fill(); } ctx.restore();
  // hatch with a round porthole
  ctx.fillStyle = "#15171d"; rr(ax + 7, G - ah + 13, aw - 14, ah - 13, 5); ctx.fill();
  ctx.fillStyle = metal(ax + 9, 0, ax + aw - 9, 0, [[0, "#7d828b"], [0.5, "#b5bac2"], [1, "#6a6f78"]]); rr(ax + 9, G - ah + 15, aw - 18, ah - 15, 4); ctx.fill();
  const px = x, py = G - ah + 24;
  ctx.fillStyle = "#3a3e46"; ctx.beginPath(); ctx.arc(px, py, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = inside ? "#ffcf7a" : "#1d2a40"; ctx.beginPath(); ctx.arc(px, py, 4.8, 0, Math.PI * 2); ctx.fill();
  if (inside) { const lg = ctx.createRadialGradient(px, py, 1, px, py, 16); lg.addColorStop(0, "rgba(255,207,122,.45)"); lg.addColorStop(1, "rgba(255,207,122,0)"); ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(px, py, 16, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.beginPath(); ctx.arc(px - 1.6, py - 1.6, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2a2d34"; ctx.fillRect(ax + aw - 15, G - 15, 4, 8);   // handle
  // status light next to the hatch: red during a solar flare
  ctx.fillStyle = A.flare > 0.1 ? "#ff5a4f" : "#7ee08a"; ctx.beginPath(); ctx.arc(ax + aw - 4, G - ah + 20, 1.8, 0, Math.PI * 2); ctx.fill();
}
function drawLabReal(night) {
  const x0 = POS.lab - 52, y0 = GROUND - 70, w = 104, h = 62;
  softShadow(POS.lab + 8, GROUND + 3, 72, 10);
  ctx.fillStyle = "#3a3d44"; ctx.fillRect(x0 + 10, GROUND - 10, 8, 10); ctx.fillRect(x0 + w - 18, GROUND - 10, 8, 10);   // legs
  ctx.fillStyle = metal(0, y0, 0, y0 + h, [[0, "#f3f4f6"], [0.35, "#c9ccd2"], [0.75, "#8d9099"], [1, "#5d6068"]]); rr(x0, y0, w, h, 26); ctx.fill();
  ctx.strokeStyle = "rgba(60,64,72,.45)"; ctx.lineWidth = 1; for (let k = 1; k < 5; k++) { const xx = x0 + k * w / 5; ctx.beginPath(); ctx.moveTo(xx, y0 + 4); ctx.lineTo(xx, y0 + h - 4); ctx.stroke(); }
  ctx.fillStyle = "#fc3d21"; ctx.fillRect(x0 + 12, y0 + h - 14, w - 24, 3);   // NASA-orange stripe
  [POS.lab - 30, POS.lab + 10].forEach(wx => {
    const lit = S.lab ? "#c4a8ff" : night > 0.3 ? "#ffd38a" : null;
    ctx.fillStyle = lit || metal(wx, y0 + 14, wx + 22, y0 + 32, [[0, "#20314f"], [1, "#0b1220"]]); rr(wx, y0 + 14, 22, 18, 6); ctx.fill();
    if (lit) { ctx.save(); ctx.globalAlpha = 0.35; ctx.shadowColor = lit; ctx.shadowBlur = 14; ctx.fillRect(wx, y0 + 14, 22, 18); ctx.restore(); }
    ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.moveTo(wx + 3, y0 + 17); ctx.lineTo(wx + 10, y0 + 17); ctx.lineTo(wx + 4, y0 + 26); ctx.closePath(); ctx.fill();
  });
}
function drawRecyclerReal(now) {
  const x = POS.recycler;
  softShadow(x + 5, GROUND + 2, 44, 8);
  ctx.fillStyle = S.recyclerBroken ? metal(x - 30, 0, x + 30, 0, [[0, "#6f5b57"], [1, "#3d302d"]]) : metal(x - 30, 0, x + 30, 0, [[0, "#d9dde3"], [0.5, "#a3a9b3"], [1, "#666c77"]]);
  rr(x - 30, GROUND - 56, 60, 56, 5); ctx.fill();
  ctx.strokeStyle = "rgba(40,44,52,.5)"; ctx.lineWidth = 1; ctx.strokeRect(x - 26, GROUND - 52, 52, 48);
  // water tank window
  ctx.fillStyle = "#0e1622"; rr(x - 20, GROUND - 47, 16, 36, 3); ctx.fill();
  const wl = 0.7 * 32, wg = ctx.createLinearGradient(0, GROUND - 13 - wl, 0, GROUND - 13); wg.addColorStop(0, "#5aa8e8"); wg.addColorStop(1, "#1d5fa8");
  ctx.fillStyle = wg; rr(x - 18, GROUND - 13 - wl, 12, wl, 2); ctx.fill();
  // oxygen tank
  ctx.fillStyle = metal(x + 4, 0, x + 22, 0, [[0, "#e9eef4"], [0.5, "#b8c4d2"], [1, "#7c8898"]]); rr(x + 4, GROUND - 46, 18, 38, 8); ctx.fill();
  ctx.fillStyle = "#3ccf7a"; ctx.fillRect(x + 8, GROUND - 30, 10, 2);
  ctx.strokeStyle = "#6c727c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 13, GROUND - 46); ctx.lineTo(x + 13, GROUND - 58); ctx.lineTo(x - 8, GROUND - 58); ctx.lineTo(x - 8, GROUND - 47); ctx.stroke();   // pipe
  if (!reduce) { ctx.fillStyle = "rgba(200,230,255,.35)"; for (let k = 0; k < 3; k++) { const yy = GROUND - 62 - ((now / 25 + k * 14) % 36); ctx.beginPath(); ctx.arc(x + 13 + Math.sin(now / 240 + k) * 3, yy, 2.2, 0, Math.PI * 2); ctx.fill(); } }
  if (S.recyclerBroken && !reduce) { ctx.fillStyle = "rgba(70,70,70,.5)"; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x - 12 + k * 6, GROUND - 64 - ((now / 25 + k * 12) % 34), 5 + k % 2 * 2, 0, Math.PI * 2); ctx.fill(); } }
}
function drawDomeGlassReal(cx, rx, ry) {
  // geodesic frame and glass reflections (drawn over the plant)
  ctx.strokeStyle = "rgba(225,235,245,.55)"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(cx, GROUND, rx, ry, 0, Math.PI, 0); ctx.stroke();
  ctx.strokeStyle = "rgba(225,235,245,.16)"; ctx.lineWidth = 1;
  for (let k = 1; k < 7; k++) { ctx.beginPath(); ctx.ellipse(cx, GROUND, rx * k / 7, ry, 0, Math.PI, 0); ctx.stroke(); }
  for (let k = 1; k < 4; k++) { const yy = GROUND - ry * k / 4, half = rx * Math.sqrt(1 - Math.pow(k / 4, 2)); ctx.beginPath(); ctx.moveTo(cx - half, yy); ctx.lineTo(cx + half, yy); ctx.stroke(); }
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx, GROUND, rx, ry, 0, Math.PI, 0); ctx.clip();
  const sp = ctx.createLinearGradient(cx - rx, GROUND - ry, cx, GROUND - ry * 0.3); sp.addColorStop(0, "rgba(255,255,255,.22)"); sp.addColorStop(0.5, "rgba(255,255,255,.04)"); sp.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sp; ctx.beginPath(); ctx.ellipse(cx - rx * 0.35, GROUND - ry * 0.62, rx * 0.35, ry * 0.42, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // metal base ring
  ctx.fillStyle = metal(0, GROUND - 7, 0, GROUND, [[0, "#c9ccd2"], [1, "#5d6068"]]); ctx.fillRect(cx - rx - 4, GROUND - 7, rx * 2 + 8, 7);
}
function drawPanelsReal() {
  PANEL_X.forEach(x => {
    softShadow(x + 12, GROUND + 2, 26, 5, 0.35);
    ctx.strokeStyle = "#8b9099"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x, GROUND - 40); ctx.stroke();
    ctx.save(); ctx.translate(x, GROUND - 46); ctx.rotate(-0.35);
    ctx.fillStyle = "#c3c7ce"; ctx.fillRect(-20, -15, 40, 30);
    ctx.fillStyle = metal(-18, -13, 18, 13, [[0, "#2b4f8f"], [0.5, "#152a52"], [1, "#0b1631"]]); ctx.fillRect(-18, -13, 36, 26);
    ctx.strokeStyle = "rgba(160,190,240,.35)"; ctx.lineWidth = 0.6; for (let k = -12; k <= 12; k += 6) { ctx.beginPath(); ctx.moveTo(k, -13); ctx.lineTo(k, 13); ctx.stroke(); } for (let k = -6.5; k <= 6.5; k += 6.5) { ctx.beginPath(); ctx.moveTo(-18, k); ctx.lineTo(18, k); ctx.stroke(); }
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.beginPath(); ctx.moveTo(-18, -13); ctx.lineTo(-6, -13); ctx.lineTo(-18, 2); ctx.closePath(); ctx.fill();   // reflection
    if (A.panelDust > 0.01) { ctx.fillStyle = `rgba(176,112,72,${A.panelDust * 0.9})`; ctx.fillRect(-18, -13, 36, 26); }
    ctx.restore();
  });
}
function labelReal(x, y, t) {
  t = t.replace(/^[^A-Za-z0-9]+\s*/u, "").replace(/·\s*[^A-Za-z0-9]+\s*/u, "· ");   // no emoji in the HUD labels
  ctx.font = "700 10px 'Space Mono', ui-monospace, monospace"; if ("letterSpacing" in ctx) ctx.letterSpacing = "1px";
  const w = ctx.measureText(t).width + 14; ctx.fillStyle = "rgba(8,10,16,.55)"; rr(x - w / 2, y - 12, w, 16, 3); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.textAlign = "center"; ctx.fillText(t, x, y);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
}
function postReal(L, R, T, B) {
  // night tint (cold blue), then a soft vignette like a camera
  if (A.night > 0) { ctx.fillStyle = `rgba(6,10,28,${A.night * 0.45})`; ctx.fillRect(L, T, R - L, B - T); }
  const cxv = (L + R) / 2, cyv = (T + B) / 2, rad = Math.max(R - L, B - T) * 0.75, v = ctx.createRadialGradient(cxv, cyv, rad * 0.45, cxv, cyv, rad);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.5)"); ctx.fillStyle = v; ctx.fillRect(L, T, R - L, B - T);
}

function draw(now) {
  const { s, ox, oy, w, h, dpr } = view; if (!w) return;
  // Visible logical area: the canvas fills its box, extra room shows more sky and ground.
  const L = -ox / s, R = (w - ox) / s, T = OFFY - oy / s, B = OFFY + (h - oy) / s;
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * (oy - OFFY * s));
  const night = A.night;
  drawSkyReal(L, R, T, B, now); drawSunReal(now); drawTerrainReal(L, R, T, B);
  drawRover(now);
  drawReactor(now);
  drawGroundReal(L, R, B);
  drawCables(now);
  // Shelter
  drawShelterReal(now);
  label(POS.shelter, GROUND + 34, "🛡️ SHELTER");
  // Lab
  drawLabReal(night);
  drawAntenna(now);
  label(POS.lab, GROUND + 34, "🔬 LAB");
  // Recycler + O2 machine
  drawRecyclerReal(now);
  label(POS.recycler, GROUND + 34, "💧 RECYCLER");
  drawWeather(now);
  // Dome
  const cx = POS.plant, rx = 190, ry = 225;
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx, GROUND, rx, ry, 0, Math.PI, 0); ctx.closePath(); ctx.clip();
  softShadow(cx, GROUND + 4, rx + 20, 14, 0.3); const gl = ctx.createLinearGradient(0, GROUND - ry, 0, GROUND); gl.addColorStop(0, "rgba(190,215,240,.10)"); gl.addColorStop(1, "rgba(190,215,240,.18)"); ctx.fillStyle = gl;
  ctx.fillRect(cx - rx, GROUND - ry, rx * 2, ry);
  if (A.heat > 0.01) { const hg = ctx.createRadialGradient(cx, GROUND, 10, cx, GROUND, 200); hg.addColorStop(0, `rgba(255,154,90,${0.45 * A.heat})`); hg.addColorStop(1, "rgba(255,154,90,0)"); ctx.fillStyle = hg; ctx.fillRect(cx - rx, GROUND - ry, rx * 2, ry); }
  // grow lamps (pink light at night)
  ctx.fillStyle = "#c9cfe0"; rr(cx - 84, GROUND - 206, 168, 10, 5); ctx.fill();
  if (night > 0.2 && !S.lampsOff && A.bat >= 0.12) [-70, 70].forEach(dx => { const x = cx + dx, y = GROUND - 196; const gl = ctx.createLinearGradient(0, y, 0, GROUND); gl.addColorStop(0, `rgba(255,127,200,${0.45 * night})`); gl.addColorStop(1, "rgba(255,127,200,0)"); ctx.fillStyle = gl; ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.lineTo(x + 60, GROUND); ctx.lineTo(x - 60, GROUND); ctx.closePath(); ctx.fill(); });
  if (A.frost > 0.01) { ctx.globalAlpha = A.frost; ctx.strokeStyle = "#d7ecffcc"; ctx.lineWidth = 1.4; for (let k = 0; k < 26; k++) { const fx = cx - rx + 20 + (k * 37) % (rx * 2 - 40), fy = GROUND - 30 - (k * 53) % 170; ctx.beginPath(); ctx.moveTo(fx - 5, fy); ctx.lineTo(fx + 5, fy); ctx.moveTo(fx, fy - 5); ctx.lineTo(fx, fy + 5); ctx.moveTo(fx - 3.5, fy - 3.5); ctx.lineTo(fx + 3.5, fy + 3.5); ctx.moveTo(fx + 3.5, fy - 3.5); ctx.lineTo(fx - 3.5, fy + 3.5); ctx.stroke(); } ctx.fillStyle = "rgba(215,236,255,.16)"; ctx.fillRect(cx - rx, GROUND - ry, rx * 2, ry); ctx.globalAlpha = 1; }
  const soil = drawPot(now);
  if (S.seedling && CROPS[S.crop]) CROPS[S.crop](now, soil); else drawPlant(now, soil);
  drawSensor(now); drawFan(now);
  if (A.shutter > 0.01) { ctx.fillStyle = "#7c86a8ee"; const bottomY = GROUND - ry + (ry - 70) * A.shutter; for (let y = GROUND - ry; y < bottomY; y += 16) ctx.fillRect(cx - rx, y, rx * 2, Math.min(12, bottomY - y)); }
  if (S.watering && !reduce) { ctx.fillStyle = "#6f98ff"; for (let k = 0; k < 6; k++) { const yy = GROUND - 120 + ((now / 6 + k * 18) % 64); ctx.beginPath(); ctx.ellipse(cx - 24 + k * 9, yy, 2.4, 4, 0, 0, Math.PI * 2); ctx.fill(); } }
  ctx.restore();
  drawDomeGlassReal(cx, rx, ry);
  drawShield(now);
  drawThermo();
  drawTelescope(now);
  label(cx, GROUND + 34, S.variety ? `🌶️ GREENHOUSE · ${VARIETY_LABEL[S.variety]}` : "🌶️ GREENHOUSE");
  // Panels
  drawPanelsReal();
  label(PANEL_X[1], GROUND + 34, "☀️ PANELS");
  A.crew.forEach((c, i) => drawAstronaut(c, i, now));

  drawHeli(now);
  // Tour: highlight the main places
  if (S.tour) { attention(POS.shelter, GROUND - 30, now, 40); attention(cx, GROUND - 90, now, 60); attention(PANEL_X[1], GROUND - 46, now, 44); }
  // Dust storm particles
  if (A.dust > 0.05 && !reduce) { ctx.fillStyle = "#e2a77a"; ctx.globalAlpha = 0.5 * A.dust; for (let k = 0; k < 160; k++) { const px = L + ((k * 131.7 + now * 0.12 * (1 + k % 3)) % (R - L + 40)) - 20, py = T + (k * 71.3) % (B - T); ctx.fillRect(px, py, 7, 2); }
    ctx.globalAlpha = 0.22 * A.dust; ctx.fillStyle = "#c98a5a"; ctx.fillRect(L, T, R - L, B - T); ctx.globalAlpha = 1; }
  // Night shade
  postReal(L, R, T, B);
  // Solar flare: yellow flicker, red frame, banner
  if (A.flare > 0.01) {
    ctx.fillStyle = `rgba(255,216,74,${(reduce ? 0.18 : 0.14 + Math.sin(now / 80) * 0.06) * A.flare})`; ctx.fillRect(L, T, R - L, B - T);
    const p = reduce ? 0.5 : (Math.sin(now / 120) + 1) / 2; ctx.strokeStyle = `rgba(255,80,80,${(0.4 + p * 0.5) * A.flare})`; ctx.lineWidth = 10; ctx.strokeRect(L + 5, T + 5, R - L - 10, B - T - 10);
    ctx.globalAlpha = A.flare; ctx.fillStyle = "#000b"; rr(VIEW_W / 2 - 170, OFFY + 10, 340, 44, 14); ctx.fill(); ctx.fillStyle = "#ffd166"; ctx.font = "800 20px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.fillText(S.astro === "shelter" ? "☢️ SOLAR FLARE · crew safe" : "☢️ SOLAR FLARE · RADIATION", VIEW_W / 2, OFFY + 39); ctx.globalAlpha = 1;
  }
  // Sparkles on hidden cards not found yet
  hotspots().forEach((hs, i) => { if (hs.on === false || found(hs.card)) return; const a = Math.pow(Math.max(0, Math.sin(now / 700 + i * 1.9)), 10); if (a < 0.02) return; ctx.globalAlpha = a; ctx.fillStyle = "#fff6c8"; emoji(hs.tw[0], hs.tw[1], "✦", 16); ctx.globalAlpha = 1; });
  // "+1 card" floats
  floats.forEach(f => { ctx.globalAlpha = 1 - f.t; ctx.fillStyle = "#ffd166"; ctx.font = "800 18px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.strokeStyle = "#131525"; ctx.lineWidth = 4; ctx.strokeText(f.text, f.x, f.y - f.t * 40); ctx.fillText(f.text, f.x, f.y - f.t * 40); ctx.globalAlpha = 1; });
}
