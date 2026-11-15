// Game flow: plays a level step by step (question → answer → consequence → next), plus the logbook UI.

import { LEVELS, SPEAKERS } from "./levels.js";
import { mountScene, updateScene, newSceneState, markFound, pop, SECRET_CARDS } from "./scene.js";
import { DECKS, CARDS, logbook, saveLogbook, deckOf, countIn } from "./logbook.js";
import { play, audio, toggleMute } from "./audio.js";
import { learn, learned, LEARNABLE } from "./level3.js";
import { PLANTS, EQUIPMENT } from "./rules.js";

const $ = id => document.getElementById(id);
const wait = ms => new Promise(r => setTimeout(r, ms));
const val = (v, s) => typeof v === "function" ? v(s) : v;

/* ---------- Progress (unlocked levels, best stars), saved in the browser ---------- */
const PKEY = "chili-progress-v1";
const progress = (() => { try { return { unlocked: 1, stars: {}, ...JSON.parse(localStorage.getItem(PKEY) || "{}") }; } catch (e) { return { unlocked: 1, stars: {} }; } })();
const saveProgress = () => { try { localStorage.setItem(PKEY, JSON.stringify(progress)); } catch (e) { } };

let level = null, stepIdx = 0, S = null, results = [], phase = "ask", busy = false, modal = false, chosen = null, outcome = null, newFacts = [];

/** Yes/No questions are stored as two options. */
function optionsOf(st) {
  return st.options || [{ ...st.yes, label: "Yes", icon: "✔", kind: "yes" }, { ...st.no, label: "No", icon: "✘", kind: "no" }];
}

/* ---------- Level flow ---------- */
export function startLevel(n = 1) {
  const def = LEVELS.find(l => l.id === n) || LEVELS[0];
  level = def.generate ? { ...def, steps: def.generate(k => !!logbook[k]) } : def;   // random levels: a new mission each time
  stepIdx = 0; S = newSceneState(); results = []; newFacts = [];
  $("lvlName").textContent = `Level ${level.id} · ${level.name}`;
  renderLevelPicker();
  updateScene(S); enterStep();
}
function enterStep() {
  let st = level.steps[stepIdx];
  if (st.lazy) { level.steps.splice(stepIdx, 1, ...st.lazy(S)); st = level.steps[stepIdx]; }   // random sols are drawn when reached
  S.time = st.time; if (st.enter) st.enter(S); updateScene(S);
  st.news = S.news || []; S.news = [];   // e.g. "the weather station is installed!"
  st.news.forEach(n => { if (n.card) unlock(n.card); });
  if (S.flare) play("siren"); else if (S.dust) play("alert"); else if (st.speaker === "houston") play("radio");
  renderSteps(); renderStatus();
  phase = "ask"; renderTalk();
}
async function choose(i) {
  if (busy || phase !== "ask") return;
  const st = level.steps[stepIdx], opt = optionsOf(st)[i]; if (!opt) return;
  busy = true; audio();
  if (opt.fx) opt.fx(S);
  const good = val(opt.good, S);
  chosen = opt; outcome = { good, say: val(opt.say, S) };
  updateScene(S); renderStatus();
  play(good === false ? "alert" : S.watering ? "drop" : "go");
  if (!opt.retry) results.push({ step: st, opt, good });
  outcome.fact = opt.learn || st.learn;   // the fact that explains this answer
  outcome.learnNew = outcome.fact ? learn(outcome.fact.id) : false;
  if (outcome.learnNew) newFacts.push(outcome.fact);
  phase = "result"; renderTalk();
  await wait(500);
  const card = val(opt.card, S); if (card) unlock(card);
  busy = false;
  $("continueBtn")?.focus({ preventScroll: true });
}
async function next() {
  if (busy) return;
  if (chosen && chosen.retry) { phase = "ask"; S.tour = false; updateScene(S); renderTalk(); return; }   // "No, I'm not ready": ask again
  stepIdx++;
  if (S.plantHp > 0 && stepIdx < level.steps.length) return enterStep();
  // End of level: a new sol rises, the plant grows if it survived.
  busy = true;
  Object.assign(S, { flare: false, dust: false, time: "dawn", heater: false, watering: false, frost: false, shutter: false, lab: false, lampsOff: false });
  if (S.astro === "shelter") S.astro = "outside";
  if (S.sam !== "home") S.sam = "home";
  updateScene(S);
  await wait(900);
  S.grown = S.plantHp >= 2; S.wilted = S.plantHp < 2; updateScene(S); renderStatus();
  busy = false; phase = "end"; renderSteps(); renderTalk();
}

/* ---------- Talk panel ---------- */
function renderTalk() {
  if (phase === "end") return renderEnd();
  const st = level.steps[stepIdx], sp = SPEAKERS[st.speaker], t = $("talk"), opts = optionsOf(st);
  const counter = st.sol ? `Sol ${st.sol}/${st.sols}` : level.random ? "Day 0" : `${stepIdx + 1}/${level.steps.length}`;
  const head = `<div class="speaker"><span class="av">${sp.icon}</span><span><b>${sp.name}</b><small>${sp.role}</small></span><span class="stepno">${counter}</span></div>`;
  if (phase === "ask") {
    const hint = st.hint && st.hint(S), yn = !st.options;
    t.className = "box talk";
    t.innerHTML = `${head}${(st.news || []).map(n => `<div class="report built">${n.text}</div>`).join("")}
      <p class="bubble">${val(st.text, S)}</p>
      ${hint ? `<div class="report">${hint}</div>` : ""}
      <h3 class="ask">${st.ask}</h3>
      ${yn ? `<div class="choices">${opts.map((o, i) => `<button class="${o.kind}" type="button" data-opt="${i}"><span>${o.icon}</span>${o.label}</button>`).join("")}</div>`
           : `<div class="opts ${st.grid ? "grid" : ""}">${opts.map((o, i) => `<button type="button" data-opt="${i}"><span class="oi">${o.icon}</span><span class="ot"><b>${o.label}</b>${o.stars ? `<span class="lvlstars" title="Difficulty">${"★".repeat(o.stars)}<i>${"★".repeat(3 - o.stars)}</i></span>` : ""}${o.sub ? `<small>${o.sub}</small>` : ""}</span><kbd>${i + 1}</kbd></button>`).join("")}</div>`}
      <p class="hint">Keyboard: ${yn ? "<kbd>Y</kbd> / <kbd>N</kbd>" : opts.map((_, i) => `<kbd>${i + 1}</kbd>`).join(" ")}</p>`;
    t.querySelectorAll("[data-opt]").forEach(b => { b.onclick = () => choose(+b.dataset.opt); });
    t.querySelector("[data-opt]").focus({ preventScroll: true });
  } else {
    const mood = outcome.good === true ? "good" : outcome.good === false ? "bad" : "neutral";
    const lastStep = stepIdx === level.steps.length - 1 || S.plantHp <= 0;
    t.className = `box talk ${mood}`;
    t.innerHTML = `${head}<p class="bubble muted-q">${st.ask} <b>${chosen.icon} ${chosen.label}</b></p>
      <div class="result ${mood}"><span class="tag">${mood === "good" ? "Good choice!" : mood === "bad" ? "Consequence" : "OK!"}</span><p>${outcome.say}</p></div>
      ${outcome.fact ? `<div class="learn"><span class="tag">📡 Why? ${outcome.learnNew ? "<em>New fact!</em>" : ""}</span><p>${outcome.fact.text}</p>${outcome.fact.src ? `<small>${outcome.fact.src}</small>` : ""}</div>` : ""}
      ${S.plantHp <= 0 ? `<div class="result bad"><span class="tag">Mission failed</span><p>🥀 Your plant didn't survive…</p></div>` : ""}
      <button class="go" type="button" id="continueBtn">${chosen.retry ? "Ask me again" : lastStep ? "Finish the sol" : "Continue"} ▶</button>`;
    $("continueBtn").onclick = next;
  }
}
function renderEnd() {
  const t = $("talk"), judged = results.filter(r => r.good !== undefined), good = judged.filter(r => r.good).length, total = judged.length;
  const alive = S.plantHp > 0, stars = !alive ? 0 : good === total ? 3 : good >= total - 1 ? 2 : 1;
  const nextLv = LEVELS.find(l => l.id === level.id + 1), P = S.crop && PLANTS[S.crop];
  const fruitless = P && P.flowers && !S.pollinated;
  if (alive) { progress.unlocked = Math.max(progress.unlocked, level.id + 1); progress.stars[level.id] = Math.max(progress.stars[level.id] || 0, stars); saveProgress(); renderLevelPicker(); }
  t.className = `box talk end ${alive ? "" : "bad"}`;
  t.innerHTML = `<div class="endhead"><span class="big-ic">${!alive ? "🥀" : S.grown ? "🌱" : "🍂"}</span><span><small>Level ${level.id} ${alive ? "complete" : "failed"}</small><b>${!alive ? "Your plant didn't survive…" : P ? (fruitless ? `Your ${P.name.toLowerCase()} grew, but made no fruit…` : S.grown ? `Harvest time: your ${P.name.toLowerCase()} is ready! ${P.icon}` : `A small harvest of ${P.name.toLowerCase()}… ${P.icon}`) : S.grown ? "Your plant made it!" : "Your plant is weak…"}</b></span></div>
    <div class="stars" aria-label="${stars} out of 3 stars">${"★".repeat(stars)}<span>${"★".repeat(3 - stars)}</span></div>
    <div class="endbtns"><button class="${alive && nextLv ? "ibtn" : "go"}" type="button" id="replayBtn">↻ ${level.random ? "New mission" : alive ? "Play again" : "Try again"}</button>
      ${nextLv && alive ? `<button class="go" type="button" id="nextBtn">Level ${nextLv.id} ▶</button>` : ""}</div>
    <ul class="recap">${results.filter(r => !r.opt.retry).map(r => `<li class="${r.good === true ? "good" : r.good === false ? "bad" : ""}"><span>${r.step.icon}</span>${r.step.ask} <b>${r.opt.label}</b><i>${r.good === true ? "✔" : r.good === false ? "✘" : "•"}</i></li>`).join("")}</ul>
    ${S.blackout > 1 ? `<p class="secrets">📵 Still no contact with Earth: Houston will hear about your harvest in <b>${S.blackout - 1} sols</b>, when the Sun has moved away.</p>` : ""}
    ${level.random ? `<p class="secrets">📚 New facts learned this mission: <b>${newFacts.length}</b> · Total: <b>${LEARNABLE.filter(id => learned[id]).length}/${LEARNABLE.length}</b>${LEARNABLE.some(id => !learned[id]) ? " · play again to discover more!" : " · you know them all, expert!"}</p>` : ""}
    <p class="secrets" id="secretsLine">${secretsText()}</p>`;
  $("replayBtn").onclick = () => startLevel(level.id);
  if ($("nextBtn")) $("nextBtn").onclick = () => startLevel(nextLv.id);
  ($("nextBtn") || $("replayBtn")).focus({ preventScroll: true });
  play(alive ? "ding" : "alert");
}
/** "Secret cards found" line of the end screen; refreshed live when a hidden card is found. */
function secretsText() {
  const found = SECRET_CARDS.filter(c => logbook[c]).length;
  return `🔍 Secret cards found in the scene: <b>${found}/${SECRET_CARDS.length}</b>${found < SECRET_CARDS.length ? " · tap around the base to find more!" : " · well done, explorer!"}`;
}
function renderSteps() {
  $("steps").classList.toggle("many", level.steps.length > 7);
  if (level.random) $("lvlName").textContent = `Level ${level.id} · ${S.crop ? `${PLANTS[S.crop].icon} ${PLANTS[S.crop].name}` : level.name}`;
  $("steps").innerHTML = level.steps.map((st, i) => `<li class="${phase === "end" || i < stepIdx ? "done" : i === stepIdx ? "now" : ""}" title="${st.sol ? `Sol ${st.sol}` : ""}">${st.icon || "•"}</li>`).join("");
}
function renderStatus() {
  const dose = S.dose ? (S.sam === "outside" || S.sam === "shelter" ? "☢️ Léa & Sam irradiated" : "☢️ Irradiated") : S.crewNote || (S.astro === "shelter" ? "🛡️ Sheltered" : "OK");
  $("status").innerHTML = `<span class="chip ${S.plantHp <= 1 ? "bad" : ""}" title="Plant health">🌱 Plant <b>${"♥".repeat(Math.max(0, S.plantHp))}<s>${"♥".repeat(Math.max(0, 3 - S.plantHp))}</s></b></span>
    ${level.energy ? `<span class="chip ${S.battery < 0.2 ? "bad" : ""}" title="Battery">${S.battery < 0.2 ? "🪫" : "🔋"} Battery <b>${Math.round(S.battery * 100)}%</b></span>` : ""}
    <span class="chip ${S.dose || S.crewNote ? "bad" : ""}" title="Crew">🧑‍🚀 Crew <b>${dose}</b></span>
    ${Object.entries(S.builds || {}).map(([k, b]) => `<span class="chip build" title="Being built by Sam">🛠️ ${EQUIPMENT[k].icon} ${EQUIPMENT[k].name} <b>${b.total - b.left}/${b.total}</b></span>`).join("")}
    ${S.blackout > 0 ? `<span class="chip bad" title="Solar conjunction: the Sun is between Earth and Mars">📵 No contact with Earth <b>back in ${S.blackout - 1} sol${S.blackout - 1 > 1 ? "s" : ""}</b></span>` : ""}
    ${Object.keys(S.installed || {}).length ? `<span class="chip" title="Installed equipment">🔧 Equipment <b>${Object.keys(S.installed).map(k => EQUIPMENT[k].icon).join(" ")}</b></span>` : ""}
    ${S.research ? `<span class="chip" title="Lab research">🔬 Research <b>${{ weather: "🌡️ Weather", sun: "☀️ Sun", plants: "🧪 Plants" }[S.research]}</b></span>` : ""}`;
}
function renderLevelPicker() {
  $("lvlPick").innerHTML = LEVELS.map(l => {
    const locked = l.id > progress.unlocked, st = progress.stars[l.id] || 0;
    return `<button type="button" data-level="${l.id}" ${locked ? "disabled" : ""} aria-current="${level && level.id === l.id}" title="${locked ? "Finish the previous level to unlock" : l.goal}">${locked ? "🔒" : l.id}<small>${st ? "★".repeat(st) : ""}</small></button>`;
  }).join("");
}

/* ---------- Logbook: space cards ---------- */
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const countCards = () => Object.keys(CARDS).filter(k => logbook[k]).length;
const maxCards = () => Object.keys(CARDS).length;
let newDeck = null;

export function unlock(id) {
  if (!id || logbook[id] || !CARDS[id]) return false;
  logbook[id] = true; saveLogbook();
  newDeck = deckOf(id)?.id; revealCard(id);
  renderLogbook(); markFound(k => !!logbook[k]);
  if ($("secretsLine")) $("secretsLine").innerHTML = secretsText();
  return true;
}
/** Card photo (img), using the framing chosen for each picture. */
const photo = (c, cls = "") => `<img class="${cls}" src="${esc(c.image)}" alt="" loading="lazy" style="object-fit:${esc(c.fit || "cover")};object-position:${esc(c.position || "50% 50%")};background:${esc(c.bg || "#000")}">`;
/** A full space card (front when collected, back with the unlock hint otherwise). */
function spaceCard(id) {
  const c = CARDS[id], d = deckOf(id), on = !!logbook[id];
  if (!on) return `<div class="scene3d" data-deck="${d.id}"><article class="scard back" id="sc-${id}"><div class="inner">
      <span class="qmark">?</span><b>Undiscovered card</b><span class="deckname">${d.icon} ${esc(d.name)}</span>
      <p class="how"><span>🔒 To unlock</span>${esc(c.how)}</p></div></article></div>`;
  return `<div class="scene3d" data-deck="${d.id}">${cardFront(id, `sc-${id}`)}</div>`;
}
function cardFront(id, domId = "") {
  const c = CARDS[id];
  return `<article class="scard" ${domId ? `id="${domId}"` : ""}><div class="inner">
      <div class="head"><span class="name">${esc(c.name)}</span>${c.type ? `<span class="type">${esc(c.type)}</span>` : ""}</div>
      <div class="art" style="background:${esc(c.bg || "#000")}">${photo(c)}</div>
      ${c.funFact ? `<div class="fun"><b>⭐ Fun fact</b>${esc(c.funFact)}</div>` : ""}
      <div class="def"><b>📖 Definition</b>${esc(c.description)}</div>
      <div class="shine"></div></div></article>`;
}
/** Long texts: shrink the font until it fits inside the card (as in the card designer). */
function fitCards(root) {
  root.querySelectorAll(".scard:not(.back)").forEach(c => {
    const nom = c.querySelector(".name"), def = c.querySelector(".def"), n = nom.textContent.length;
    nom.style.fontSize = (n > 17 ? 0.95 : n > 12 ? 1.1 : 1.25) + "rem";
    const fun = c.querySelector(".fun");
    let fs = 0.74; def.style.fontSize = fs + "rem"; if (fun) fun.style.fontSize = "";
    while (def.scrollHeight > def.clientHeight + 1 && fs > 0.56) { fs -= 0.02; def.style.fontSize = fs + "rem"; }
    let ff = 0.68;   // still too long: make the fun fact smaller too
    while (fun && def.scrollHeight > def.clientHeight + 1 && ff > 0.52) { ff -= 0.02; fun.style.fontSize = ff + "rem"; }
  });
}
/** Tilt + shine following the pointer. */
function tilt(e) {
  const c = e.target.closest && e.target.closest(".scard:not(.back)"); if (!c) return;
  const r = c.getBoundingClientRect(), p = e.touches ? e.touches[0] : e, x = (p.clientX - r.left) / r.width, y = (p.clientY - r.top) / r.height;
  c.style.transform = `rotateY(${(x - 0.5) * 20}deg) rotateX(${(0.5 - y) * 20}deg)`;
  const sh = c.querySelector(".shine"); sh.style.setProperty("--x", x * 100 + "%"); sh.style.setProperty("--y", y * 100 + "%");
}
export function renderLogbook() {
  $("cardCount").textContent = `${countCards()}/${maxCards()}`;
  $("logbook").innerHTML = DECKS.map(d => {
    const n = countIn(d), got = d.cards.filter(k => logbook[k]), top = got[got.length - 1];
    return `<button class="deck ${n === d.cards.length ? "full" : ""} ${n ? "" : "empty"} ${newDeck === d.id ? "new" : ""}" style="--tc:${d.color}" type="button" data-deck="${d.id}" title="${esc(d.name)}: ${n}/${d.cards.length} cards">
      <span class="stack" data-n="${Math.min(n, 3)}"><span class="mini">${top ? photo(CARDS[top]) : `<span class="miniback">?</span>`}</span></span>
      <span class="meta"><b>${d.icon} ${esc(d.name)}</b><span class="pips">${d.cards.map(k => `<i class="${logbook[k] ? "on" : ""}"></i>`).join("")}</span><span class="tier">${n === d.cards.length ? "Complete! ★" : `${n}/${d.cards.length} cards`}</span></span>
    </button>`;
  }).join("");
  newDeck = null;
}
export function showLogbook(focus = "all") {
  modal = true;
  const deckId = focus === "all" ? "all" : DECKS.some(d => d.id === focus) ? focus : (deckOf(focus)?.id || "all");
  $("card").className = "card wide";
  $("card").innerHTML = `<div class="albumhead"><h2>📖 Logbook</h2><span class="count"><b>${countCards()}</b>/${maxCards()} cards</span></div>
    <p class="muted">Collect the space cards! Some come with your choices, others hide in the scene: tap what sparkles ✨. Move your mouse over a card to tilt it.</p>
    <div class="tabs" role="tablist"><button type="button" role="tab" data-tab="all" aria-selected="${deckId === "all"}">All</button>
      ${DECKS.map(d => `<button type="button" role="tab" data-tab="${d.id}" aria-selected="${deckId === d.id}">${d.icon} ${esc(d.name)} <small>${countIn(d)}/${d.cards.length}</small></button>`).join("")}</div>
    <div class="album" id="album">${DECKS.map(d => d.cards.map(spaceCard).join("")).join("")}</div>
    <button class="go" type="button" id="closeModal">Close</button>`;
  filterAlbum(deckId);
  $("overlay").hidden = false;
  fitCards($("album"));
  const el = CARDS[focus] && $("sc-" + focus);
  if (el) { el.classList.add("hl"); el.scrollIntoView({ block: "center" }); } else $("closeModal").focus({ preventScroll: true });
}
function filterAlbum(deckId) { $("album").querySelectorAll("[data-deck]").forEach(c => { c.hidden = deckId !== "all" && c.dataset.deck !== deckId; }); fitCards($("album")); }
function closeModal() { modal = false; $("overlay").hidden = true; if (revealQueue.length) return nextReveal(); ($("continueBtn") || document.querySelector("#talk [data-opt]") || $("nextBtn") || $("replayBtn"))?.focus({ preventScroll: true }); }
/* ---------- New card: big reveal in the middle of the screen (one after the other) ---------- */
const revealQueue = [];
let revealOpen = false;
function revealCard(id) {
  revealQueue.push(id);
  if (!revealOpen && !modal) nextReveal();
}
function nextReveal() {
  const id = revealQueue.shift(); if (!id) return;
  const c = CARDS[id], d = deckOf(id), n = countIn(d), r = $("reveal");
  revealOpen = true;
  r.innerHTML = `<div class="revealbox" role="dialog" aria-modal="true" aria-label="New card: ${esc(c.name)}">
      <div class="revealtag">✨ New card! <span>${d.icon} ${esc(d.name)} · ${n}/${d.cards.length}${n === d.cards.length ? " · Complete! ★" : ""}</span></div>
      <div class="flip"><div class="flip-in">
        <div class="face front">${cardFront(id)}</div>
        <div class="face backface"><div class="scard back"><div class="inner"><span class="qmark">?</span></div></div></div>
      </div></div>
      <button class="go" type="button" id="revealOk">${revealQueue.length ? "Next card ▶" : "Awesome! ▶"}</button>
    </div>`;
  r.hidden = false;
  fitCards(r);
  play("ding"); setTimeout(() => play("sparkle"), 450);
  $("revealOk").onclick = closeReveal;
  $("revealOk").focus({ preventScroll: true });
}
function closeReveal() {
  $("reveal").hidden = true; revealOpen = false;
  if (revealQueue.length) return nextReveal();
  ($("continueBtn") || document.querySelector("#talk [data-opt]") || $("nextBtn") || $("replayBtn"))?.focus({ preventScroll: true });
}
/* ---------- Reset: erase every save of the game (cards, levels and stars, facts learned) ---------- */
const SAVE_KEYS = ["chili-cards-v1", "chili-progress-v1", "chili-facts-v1"];
function showReset() {
  modal = true;
  $("card").className = "card";
  $("card").innerHTML = `<h2>↺ Reset all progress?</h2>
    <p>This will erase <b>everything</b> saved on this device:</p>
    <div class="factlist">
      <div class="f">🃏 Your <b>${countCards()}</b> space card${countCards() > 1 ? "s" : ""}</div>
      <div class="f">🔓 Unlocked levels and stars</div>
      <div class="f">📚 The facts you learned in level 3</div>
    </div>
    <p class="muted">You can't undo this. The game will start again from level 1.</p>
    <div class="endbtns"><button class="go danger" type="button" id="confirmReset">Yes, erase everything</button><button class="ibtn" type="button" id="closeModal">Cancel</button></div>`;
  $("overlay").hidden = false; $("closeModal").focus();
}
function resetAll() {
  for (const k of SAVE_KEYS) { try { localStorage.removeItem(k); } catch (e) { } }
  location.reload();
}
function showHelp() {
  modal = true;
  $("card").className = "card";
  $("card").innerHTML = `<h2>❔ How to play</h2>
    <div class="factlist">
      <div class="f">💬 <b>Read</b> what the crew tells you, then <b>choose</b> an answer.</div>
      <div class="f">🔁 Some choices matter <b>later</b>: your seed, your research, your battery…</div>
      <div class="f">⚖️ <b>Every choice has a consequence</b>: watch the base change!</div>
      <div class="f">🃏 <b>Collect space cards</b>: some come with your choices, others hide in the scene. <b>Tap</b> the things that sparkle ✨ (even in the sky!).</div>
    </div><button class="go" type="button" id="closeModal">Let's go</button>`;
  $("overlay").hidden = false; $("closeModal").focus();
}

/* ---------- Wiring ---------- */
export function init() {
  mountScene($("scene"), (card, el, p) => {
    audio();
    if (unlock(card)) { play("sparkle"); if (p) pop(p[0], p[1], "+1 card!"); }
    else { showLogbook(card); }
  });
  markFound(k => !!logbook[k]);
  renderLogbook();
  $("logbook").addEventListener("click", e => { const d = e.target.closest("[data-deck]"); if (d) showLogbook(d.dataset.deck); });
  $("logbookBtn").addEventListener("click", () => showLogbook());
  $("helpBtn").addEventListener("click", showHelp);
  $("resetBtn").addEventListener("click", showReset);
  $("soundBtn").addEventListener("click", () => { const m = toggleMute(); $("soundBtn").textContent = m ? "🔇" : "🔊"; $("soundBtn").setAttribute("aria-label", m ? "Unmute sound" : "Mute sound"); });
  $("reveal").addEventListener("click", e => { if (e.target.id === "reveal") closeReveal(); });
  $("reveal").addEventListener("mousemove", tilt);
  $("reveal").addEventListener("touchmove", tilt, { passive: true });
  $("reveal").addEventListener("mouseout", e => { const c = e.target.closest && e.target.closest(".scard"); if (c && !c.contains(e.relatedTarget)) c.style.transform = ""; });
  $("card").addEventListener("click", e => {
    if (e.target.id === "closeModal") closeModal();
    if (e.target.id === "confirmReset") resetAll();
    const tab = e.target.closest("[data-tab]");
    if (tab) { filterAlbum(tab.dataset.tab); $("card").querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-selected", b === tab)); }
  });
  $("card").addEventListener("mousemove", tilt);
  $("card").addEventListener("touchmove", tilt, { passive: true });
  $("card").addEventListener("mouseout", e => { const c = e.target.closest && e.target.closest(".scard"); if (c && !c.contains(e.relatedTarget)) c.style.transform = ""; });
  $("overlay").addEventListener("click", e => { if (e.target.id === "overlay") closeModal(); });
  document.addEventListener("keydown", e => {
    if (revealOpen) { if (e.key === "Escape") closeReveal(); return; }
    if (e.key === "Escape" && modal) return closeModal();
    if (modal || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (phase !== "ask") return;
    const st = level.steps[stepIdx];
    if (!st.options && (k === "y" || k === "o")) choose(0);
    else if (!st.options && k === "n") choose(1);
    else if (/^[1-9]$/.test(k)) choose(+k - 1);
  });
  $("lvlPick").addEventListener("click", e => { const b = e.target.closest("[data-level]"); if (b && !b.disabled && !busy) startLevel(+b.dataset.level); });
  startLevel(Math.min(progress.unlocked, LEVELS.length));
}
