// Level 3 · Random mission: the player picks a real crop (radish … chili pepper). The crop sets the
// difficulty: how many sols the mission lasts (6 minimum), how often dangers happen, how fragile the plant is.
// Each sol draws one event from a pool, with different numbers (battery, temperature, real solar event). Each event also teaches a
// "Did you know?" fact that explains the consequence of the choice (an answer can have its own `learn`);
// facts you haven't seen yet are drawn first, so replaying keeps teaching new things.
//
// Event fields (see levels.js for step fields)
//   id, icon, time    time = dawn | day | evening | night
//   max               how many times it can happen in one mission (default 2)
//   hazard            dangerous event: drawn more often for harder crops
//   early             only in the first 2 sols          flowersOnly  only for crops that need pollination
//   speaker, text, hint, enter
//   asks: [a, b]      two ways to ask: with `a`, "Yes" is the right answer; with `b`, "Yes" is the wrong one.
//                     One is drawn at random, so the player can never just answer "Yes" to everything.
//   right / wrong     the two answers (fx, say, card, and optionally `good` as a function)
//   learn             { id, text, src }: the fact taught after the answer. It must explain the choice
//                     (why it was right or wrong), not a random Mars fact. Put it on an answer when
//                     the two answers lead to different topics.
//   steps             (instead of the above) several events played in a row, e.g. the solar flare

import { PLANTS, EQUIPMENT, has, coldDamage, plantName, hurt, heal } from "./rules.js";

let FLARES = [];
/** Real solar events (data/events.json), used for the solar flare event. */
export function setFlares(list) { FLARES = list || []; }

const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const TIME_ORDER = { dawn: 0, day: 1, evening: 2, night: 3 };
const bat = (s, d) => { s.battery = Math.max(0, Math.min(1, s.battery + d)); };
const pct = s => Math.round(s.battery * 100);

/* ---------- Facts learned (saved in the browser) ---------- */
const FKEY = "chili-facts-v1";
export const learned = (() => { try { return JSON.parse(localStorage.getItem(FKEY) || "{}"); } catch (e) { return {}; } })();
export function learn(id) { if (!id || learned[id]) return false; learned[id] = true; try { localStorage.setItem(FKEY, JSON.stringify(learned)); } catch (e) { } return true; }

/* ---------- Event pool ---------- */
const EVENTS = [
  {
    id: "water_dry", icon: "💧", advice: "If the soil is dry, give a little water.", time: "day", speaker: "lea",
    enter: s => { s.soil = "dry"; },
    text: "I checked the transparent pot: the soil is <b>dry</b> and the leaves are starting to droop.",
    hint: s => has(s, "sensor") ? "💧 <b>Moisture sensor:</b> soil at <b>12%</b>. Too dry, the plant needs water!" : null,
    asks: ["Water the plant?", "Skip watering today?"],
    right: { card: "water", fx: s => { s.soil = "ok"; s.watering = true; }, say: "💧 You give the plant a small glass of water: the roots drink and the leaves stand up again." },
    wrong: { card: "water", fx: s => { hurt(s, 1); s.wilted = true; }, say: "🥀 Without water the leaves wilt (−1 ♥)." },
    learn: { id: "water90", text: "A fresh green leaf is about <b>80 to 90% water</b>. That's why a thirsty plant wilts so quickly!", src: "Plant biology" },
  },
  {
    id: "overwater", icon: "🌊", advice: "Never water soil that is still wet.", time: "day", speaker: "sam",
    enter: s => { s.soil = "wet"; },
    text: "I'd like to water the plant again. But look at the transparent pot: the soil is still <b>wet</b> from yesterday…",
    hint: s => has(s, "sensor") ? "💧 <b>Moisture sensor:</b> soil at <b>78%</b>. Already wet enough, no water needed today." : null,
    asks: ["Wait until the soil dries a little?", "Water the plant again anyway?"],
    right: { card: "water", say: "👌 Good eye! The soil already has enough water. You'll water again when it's drier." },
    wrong: { card: "water", fx: s => { s.soil = "flood"; s.watering = true; hurt(s, 1); }, say: "🌊 The pot overflows and the roots drown (−1 ♥)." },
    learn: { id: "rootsair", text: "Roots <b>breathe</b>! They take oxygen from tiny air pockets in the soil. Too much water fills those pockets and the roots suffocate.", src: "Plant biology" },
  },
  {
    id: "cold", icon: "🥶", advice: "Below −70 °C, always heat the greenhouse.", hazard: true, time: "night", speaker: "lea",
    enter: s => { s.nightTemp = s.mission.temp; s.deepCold = true; },
    text: s => `Night is falling and it's going to be <b>${s.mission.temp} °C</b> outside! The heater uses electricity: the battery is at <b>${pct(s)}%</b>.`,
    hint: s => has(s, "weather") ? `🌡️ <b>Weather station:</b> ${s.mission.temp} °C tonight. Without heating, your ${plantName(s).toLowerCase()} would lose ${coldDamage(s)} ♥.` : null,
    asks: ["Turn on the heater tonight?", "Leave the heater off to save the battery?"],
    right: {
      card: "temperature",
      fx: s => { if (s.battery >= 0.15) { s.heater = true; bat(s, -0.25); } else { s.frost = true; hurt(s, coldDamage(s)); } },
      good: s => s.heater,
      say: s => s.heater ? "🔥 The heater keeps the greenhouse warm all night (battery −25%)." : `🪫 You flip the switch… the battery is <b>too low</b>! The heater won't start${coldDamage(s) ? ` and the plant freezes (−${coldDamage(s)} ♥)` : ""}. Energy matters!`,
    },
    wrong: {
      card: "temperature",
      fx: s => { s.frost = true; hurt(s, coldDamage(s)); },
      good: s => coldDamage(s) ? false : undefined,
      say: s => coldDamage(s) ? `🥶 Frost covers the dome and the leaves freeze (−${coldDamage(s)} ♥).${coldDamage(s) > 1 ? ` Your ${plantName(s).toLowerCase()} comes from warm countries: it hates the cold!` : ""}` : `❄️ Frost covers the dome… but your <b>${plantName(s).toLowerCase()}</b> is a cool-weather crop: it holds on!`,
    },
    learn: { id: "thinair", text: "Mars's air is about <b>100 times thinner</b> than Earth's. Like a very thin blanket, it can't hold the day's heat, so the temperature drops by tens of degrees after sunset.", src: "NASA · Mars Facts" },
  },
  {
    id: "storm", icon: "🌪️", advice: "During a dust storm, switch off everything you don't need.", hazard: true, time: "day", speaker: "houston",
    enter: s => { s.dust = true; if (has(s, "weather")) bat(s, 0.2); },
    text: s => `A <b>dust storm</b> is coming! The sky will turn dark and the solar panels will make almost no electricity. Battery: <b>${pct(s)}%</b>.`,
    hint: s => [has(s, "weather") && "🌡️ <b>Weather station:</b> you saw it coming and charged the battery before it arrived (+20%).", has(s, "reactor") && "⚛️ <b>Reactor:</b> it keeps making power during the storm, so the battery will drain much less."].filter(Boolean).join("<br>") || null,
    asks: ["Turn off the grow lamps during the storm?", "Keep the grow lamps on during the storm?"],
    right: { card: "sandstorm", fx: s => { s.lampsOff = true; bat(s, -0.1); }, say: "🔋 Smart: with the lamps off, the battery keeps its energy for the important machines." },
    wrong: { card: "sandstorm", fx: s => { bat(s, has(s, "reactor") ? -0.2 : -0.5); }, say: s => `🪫 The lamps drain the battery: only <b>${pct(s)}%</b> left. That's how the Opportunity rover ran out of power in 2018.` },
    learn: { id: "lowpower", text: "During a big dust storm, the sky can stay dark for <b>weeks</b>. Solar-powered rovers switch off everything they don't need and wait in a low-power “sleep” to save their battery.", src: "NASA / JPL · Opportunity" },
  },
  {
    id: "panels", icon: "🧹", advice: "Keep the solar panels clean.", time: "day", speaker: "lea",
    enter: s => { s.panelsDusty = true; },
    text: "A thin layer of <b>red dust</b> has settled on the solar panels. They make a bit less electricity every day.",
    asks: ["Send Sam outside to clean the panels?", "Leave the panels dusty for now?"],
    right: { card: "solar_energy", fx: s => { s.sam = "panels"; s.panelsDusty = false; bat(s, 0.4); }, say: s => `🧹 Sam brushes the panels: they shine again and the battery recharges to <b>${pct(s)}%</b>!` },
    wrong: { card: "solar_energy", fx: s => { bat(s, -0.3); }, say: s => `The dirty panels make less energy: the battery drops to <b>${pct(s)}%</b>. Dust is what ended the InSight lander in 2022.` },
    learn: { id: "dustdevil", text: "Lucky gusts of wind called <b>dust devils</b> sometimes blew the dust off the solar panels of the Spirit and Opportunity rovers!", src: "NASA / JPL" },
  },
  {
    id: "flare", group: "flare", hazard: true, time: "evening",
    steps: [
      {
        id: "shutter", icon: "🛡️", advice: "Solar flare: close the greenhouse shutter.", speaker: "houston",
        enter: s => { s.flare = true; s.astro = "outside"; s.sam = "outside"; },
        text: s => `🚨 <b>${s.mission.flare.kind}!</b> Just like the real event of ${s.mission.flare.date} (${s.mission.flare.src}). Radiation is coming. The greenhouse shutter needs electricity: battery <b>${pct(s)}%</b>.`,
        hint: s => has(s, "telescope") ? "🔭 <b>Solar telescope:</b> Yuki saw it leave the Sun. You have extra time to get ready!" : null,
        asks: ["Close the greenhouse shutter?", "Leave the shutter open to keep the light?"],
        right: {
          card: "solar_flare",
          fx: s => { if (s.battery >= 0.15 || has(s, "telescope")) { s.shutter = true; bat(s, -0.1); } else hurt(s, 1); },
          good: s => s.shutter,
          say: s => !s.shutter ? "🪫 You press the button… <b>nothing happens</b>: the battery is empty! Radiation hits the plant (−1 ♥)." : s.battery < 0.15 ? "No power… but thanks to the telescope warning, Sam had time to close it <b>by hand</b>! 🛡️" : "🛡️ The shutter slides over the dome: the plant is safe.",
        },
        wrong: { card: "solar_flare", fx: s => { hurt(s, 1); }, say: "☢️ Radiation goes right through the glass and damages the leaves (−1 ♥)." },
        learn: { id: "shielding", text: "Glass lets radiation through, but <b>thick materials</b> block it: water, plastic, or even Martian soil. Future Mars bases could be covered with a layer of soil to protect the people inside.", src: "NASA · Space radiation" },
      },
      {
        id: "shelter", icon: "☢️", advice: "Solar flare: everybody goes to the shelter.", speaker: "houston",
        text: "Léa and Sam are still <b>outside</b>, finishing a repair. The radiation is getting stronger!",
        asks: ["Bring Léa and Sam back to the shelter?", "Let them finish their repair outside?"],
        right: { card: s => s.mission.flareCard, fx: s => { s.astro = "shelter"; s.sam = "shelter"; }, say: "🛡️ Everybody runs to the shelter. The repair can wait!" },
        wrong: { card: s => s.mission.flareCard, fx: s => { s.dose = true; }, say: "☢️ Léa and Sam receive a big dose of radiation. Never stay outside during a solar storm!" },
        learn: { id: "dosimeter", text: "Astronauts wear small devices called <b>dosimeters</b> that measure the radiation they receive, so doctors can keep them safe.", src: "NASA · Space radiation" },
      },
    ],
  },
  {
    id: "mold", icon: "🦠", advice: "Cut moldy leaves straight away.", blockedBy: "fan", time: "day", speaker: "yuki",
    enter: s => { s.mold = true; },
    text: "I spotted <b>white fuzzy spots</b> on some leaves: it's <b>mold</b>! The air in the greenhouse is too humid.",
    asks: ["Cut off the moldy leaves?", "Leave them, it will go away on its own?"],
    right: { fx: s => { s.mold = false; }, say: "✂️ You cut the sick leaves and turn on the fan. Astronaut Scott Kelly did the same on the Space Station in 2016!" },
    wrong: { fx: s => { hurt(s, 1); }, say: "🦠 The mold spreads to more leaves (−1 ♥). It won't go away on its own." },
    learn: { id: "fans", text: "On the Space Station, warm air doesn't rise on its own (there's no gravity to pull cold air down), so <b>fans</b> must keep the air moving around plants.", src: "NASA · Veggie" },
  },
  {
    id: "pollen", icon: "🌸", advice: "No insects on Mars: pollinate the flowers by hand.", flowersOnly: true, max: 1, time: "day", speaker: "lea",
    enter: s => { s.flowers = true; },
    text: s => `Your ${plantName(s).toLowerCase()} has <b>flowers</b>! 🌸 To make fruit, pollen has to travel from flower to flower.`,
    asks: ["Pollinate the flowers with a small brush?", "Wait for insects to do it?"],
    right: { fx: s => { s.pollinated = true; }, say: "🖌️ You gently brush each flower: tiny fruits will start to grow!" },
    wrong: { fx: s => { s.flowers = false; hurt(s, 1); }, say: "⏳ You wait… but there are no bees and no wind on Mars. The flowers fall off without making fruit (−1 ♥)." },
    learn: { id: "selfpollen", text: "Tomato and chili flowers have both <b>male and female parts</b>. On Earth, wind and insects shake the pollen around. Indoors, a gentle brush or a little shake does the same job.", src: "Plant biology" },
  },
  {
    id: "recycler", icon: "🔧", advice: "Repair the water machines right away.", time: "day", speaker: "sam",
    enter: s => { s.recyclerBroken = true; },
    text: "Strange noises… grey smoke is coming out of the <b>water recycler</b>! It cleans all the water of the base.",
    asks: ["Repair the recycler right away?", "Wait until tomorrow to repair it?"],
    right: { card: "water", fx: s => { s.recyclerBroken = false; s.sam = "recycler"; }, say: "🔧 Sam unclogs a filter: clean water flows again." },
    wrong: { card: "water", fx: s => { hurt(s, 1); s.soil = "dry"; }, say: "Without clean water, nobody can water the plant today. It gets thirsty (−1 ♥)." },
    learn: { id: "filters", text: "Water recyclers use <b>filters</b> that slowly clog with dirt. On the Space Station, astronauts regularly change them to keep clean water flowing: sending fresh water from Earth would be far too heavy.", src: "NASA · International Space Station" },
  },
  {
    id: "oxygen", icon: "🫧", advice: "Oxygen for the crew always comes first.", time: "day", speaker: "houston",
    text: s => `The sensors show that <b>oxygen</b> is getting low in the habitat. The oxygen machine splits water to make oxygen, but it uses electricity (battery <b>${pct(s)}%</b>).`,
    asks: ["Turn on the oxygen machine?", "Keep the oxygen machine off to save the battery?"],
    right: { card: "oxygen", fx: s => { bat(s, -0.15); s.crewNote = null; }, say: "🫧 Fresh oxygen fills the habitat. The crew breathes easily." },
    wrong: { card: "oxygen", fx: s => { s.crewNote = "😮‍💨 Out of breath"; }, say: "😮‍💨 The crew gets tired and out of breath. Oxygen comes first: energy can be made again tomorrow!" },
    learn: { id: "moxie", text: "<b>MOXIE</b>, a toaster-sized instrument on the Perseverance rover, made oxygen out of the Martian air (mostly carbon dioxide) between 2021 and 2023.", src: "NASA / JPL · Perseverance" },
  },
  {
    id: "lamps", icon: "💡", advice: "If the battery allows it, give the plant some lamp light at night.", time: "night", speaker: "yuki",
    enter: s => { s.lampsOff = true; },
    text: s => `Night has fallen. Plants need light to grow, and Mars gets less sunlight than Earth. The lamps use a little energy (battery <b>${pct(s)}%</b>).`,
    asks: ["Turn on the pink grow lamps for a few hours?", "Leave the greenhouse dark all night?"],
    right: {
      card: "energy",
      fx: s => { if (s.battery >= 0.1) { s.lampsOff = false; bat(s, -0.1); heal(s); } },
      good: s => !s.lampsOff,
      say: s => s.lampsOff ? "🪫 The battery is too low to light the lamps… the plant waits in the dark." : "💡 The red and blue lamps give the plant extra energy: it grows a little more (+1 ♥ if it was hurt).",
    },
    wrong: { card: "energy", say: "🌑 The plant waits in the dark and doesn't grow tonight." },
    learn: { id: "sunlight43", text: "Mars is farther from the Sun than Earth, so its sunlight is only about <b>43%</b> as strong as ours.", src: "NASA · Mars Facts" },
  },
  {
    id: "suit", icon: "🧑‍🚀", advice: "Always brush spacesuits before entering the greenhouse.", time: "evening", speaker: "lea",
    text: "I'm back from a walk outside. My spacesuit is covered in fine <b>red dust</b>, and I'd love to check on the plant…",
    asks: ["Brush the dust off the suit first?", "Go straight into the greenhouse?"],
    right: { say: "🧹 Good habit! Martian dust must stay away from the plants and the crew." },
    wrong: { fx: s => { hurt(s, 1); }, say: "The dust falls on the leaves and in the pot (−1 ♥)." },
    learn: { id: "perchlorate", text: "Martian soil contains <b>perchlorates</b>, salts that are toxic for people and plants. The Phoenix lander discovered them in 2008.", src: "NASA / JPL · Phoenix" },
  },
  {
    id: "workout", icon: "🏋️", advice: "Exercise every sol, even during a blackout.", time: "dawn", speaker: "houston",
    text: "The crew has been working at the computers for days. In low gravity, muscles and bones get weaker if you don't use them.",
    asks: ["Make the crew do their daily workout?", "Skip the workout today?"],
    right: { card: "astronaut", fx: s => { s.crewNote = null; }, say: "🏋️ Everybody exercises: strong muscles and bones for the mission! On the Space Station, astronauts exercise about 2 hours a day." },
    wrong: { card: "astronaut", fx: s => { s.crewNote = "😩 Weak muscles"; }, say: "😩 The crew feels weak and slow… Exercise is part of an astronaut's job!" },
    learn: { id: "gravity38", text: "Gravity on Mars is only about <b>38%</b> of Earth's: you could jump almost three times higher there!", src: "NASA · Mars Facts" },
  },
];
const learnIds = x => [x.learn && x.learn.id, ...(x.options || []).map(o => o.learn && o.learn.id), ...(x.steps || []).flatMap(learnIds)].filter(Boolean);
export const LEARNABLE = ["conjunction", ...Object.values(PLANTS).map(p => p.learn.id), ...Object.values(EQUIPMENT).map(e => e.learn.id), ...EVENTS.flatMap(learnIds)];

/* ---------- Solar conjunction: no contact with Earth (forced on sol 2 or 3) ---------- */
const BLACKOUT = 14;   // sols without contact: about two weeks, like the real thing, so it lasts until the end of the mission
const CONJUNCTION = {
  id: "conjunction", icon: "📵", time: "day", speaker: "houston",
  text: `Important message! Very soon, the <b>Sun will be right between Earth and Mars</b>. This is called a <b>solar conjunction</b> and it happens about every 26 months. The Sun's hot gas scrambles radio waves: you'll have <b>no contact with Earth for about two weeks</b> (${BLACKOUT} sols), until the end of your mission. We can still send you one last big message…`,
  asks: ["Download Houston's plan and forecasts before the blackout?", "Skip the download, you'll manage on your own?"],
  right: { card: "communication", fx: s => { s.plan = true; s.blackout = BLACKOUT + 1; }, say: "📦 Download complete! Houston's advice for the rest of the mission is saved in the base computer. Then… the radio goes silent. 📵" },
  wrong: { card: "communication", fx: s => { s.plan = false; s.blackout = BLACKOUT + 1; }, say: "📵 The radio goes silent. Until the end of the mission, the crew will have to decide everything without help from Earth." },
  learn: { id: "conjunction", text: "About every <b>26 months</b>, Mars passes behind the Sun as seen from Earth. The Sun's hot, electrically charged gas scrambles radio signals, so for about <b>two weeks</b> NASA stops sending commands to its Mars rovers and orbiters. The robots wait patiently with a simple to-do list.", src: "NASA / JPL · Mars solar conjunction" },
};
/** During the blackout Houston can't talk: the crew speaks instead, and Houston's plan (if downloaded) gives advice. */
function cutOff(step, s) {
  const text = step.text, hint = step.hint, advice = step.advice;
  return {
    ...step,
    speaker: step.speaker === "houston" ? "lea" : step.speaker,
    text: st => `<span class="nosignal">📵 No signal from Earth: we're on our own.</span> ${typeof text === "function" ? text(st) : text}`,
    hint: st => [hint && hint(st), st.plan && advice && `📦 <b>Houston's plan:</b> “${advice}”`].filter(Boolean).join("<br>") || null,
  };
}

/* ---------- Research: design a piece of equipment, then build it over a few sols ---------- */
/** Equipment not built yet, that can still be finished before the end of the mission (`solsLeft`). */
const available = (s, solsLeft = 99) => Object.keys(EQUIPMENT).filter(k => !has(s, k) && !(s.builds && s.builds[k]) && EQUIPMENT[k].sols <= solsLeft);
/** The lab event: Yuki offers two projects that aren't built yet. */
function makeLab(s, solsLeft) {
  const two = shuffle(available(s, solsLeft)).slice(0, 2);
  return {
    id: "lab", icon: "🔬", time: "dawn", speaker: "yuki",
    enter: st => { st.lab = true; },
    text: `The lab can design <b>one</b> new piece of equipment. Then Sam will need some time to <b>build and install it</b> on the base. Which one do we start?`,
    ask: "What should the lab work on?",
    options: two.map(k => {
      const E = EQUIPMENT[k];
      return {
        label: E.name, icon: E.icon, sub: `${E.does} Ready in ${E.sols} sol${E.sols > 1 ? "s" : ""}.`, learn: E.learn, card: "laboratory",
        fx: st => { st.builds = { ...(st.builds || {}), [k]: { left: E.sols, total: E.sols } }; },
        say: `🛠️ Yuki draws the plans and Sam starts building the <b>${E.name.toLowerCase()}</b>. Look at the base: it will be ready in <b>${E.sols} sol${E.sols > 1 ? "s" : ""}</b>.`,
      };
    }),
  };
}
/** Start of a new sol: the panels (and the reactor) recharge the battery, building work moves on. */
function advanceSol(s, sol) {
  if (s.sol === sol) return;
  if (s.sol) {
    bat(s, (s.panelsDusty ? 0.05 : 0.15) + (has(s, "reactor") ? 0.25 : 0));
    if (s.blackout > 0 && --s.blackout === 0) s.news = [...(s.news || []), { text: "📡 <b>Contact with Earth is back!</b> The Sun has moved away: Houston can hear you again." }];
    for (const [k, b] of Object.entries(s.builds || {})) {
      b.left--;
      if (b.left <= 0) {
        delete s.builds[k]; s.installed = { ...(s.installed || {}), [k]: true };
        const E = EQUIPMENT[k];
        s.news = [...(s.news || []), { text: `🛠️ <b>The ${E.name.toLowerCase()} is installed!</b> ${E.does}`, card: E.card, built: k }];
      }
    }
  }
  s.sol = sol;
}

/* ---------- Building a mission ---------- */
/** Turns an event into a playable step for a given sol, drawing which way the question is asked. */
function toStep(ev, time, sol, sols) {
  const reset = s => {   // effects from the previous event fade away (a solar flare lasts over its two steps)
    Object.assign(s, { watering: false, dust: false, lab: false, frost: false, heater: false, deepCold: false, tour: false, lampsOff: false });
    if (ev.group !== "flare") Object.assign(s, { flare: false, shutter: false, sam: "home", astro: "outside" });
  };
  const base = {
    id: ev.id, icon: ev.icon, time, sol, sols, speaker: ev.speaker, text: ev.text, hint: ev.hint, learn: ev.learn, advice: ev.advice,
    enter: s => { reset(s); s.growth = (sol - 1) / sols; ev.enter && ev.enter(s); },
  };
  if (ev.options) return { ...base, ask: ev.ask, options: ev.options };
  const flip = Math.random() < 0.5;   // flip: "Yes" means the wrong answer
  const right = { good: true, ...ev.right, isRight: true }, wrong = { good: false, ...ev.wrong };
  return { ...base, ask: ev.asks[flip ? 1 : 0], yes: flip ? wrong : right, no: flip ? right : wrong };
}
function weightedPick(list, weight) {
  const w = list.map(weight), total = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}

/**
 * One placeholder per sol. Each sol's event is only drawn when the player reaches it (`lazy`), so it can
 * depend on what happened before: installed equipment, building work, events already seen.
 * Harder crops: more sols and more dangers. Unknown facts are drawn more often.
 */
function buildSols(crop) {
  const P = PLANTS[crop], N = P.sols, count = {};
  const pollenSol = P.flowers ? Math.max(4, Math.round(N * 0.6)) : -1;
  const conjSol = 2 + rnd(2);   // the solar conjunction always comes on sol 2 or 3
  let prev = null;
  const resolve = (s, sol) => {
    advanceSol(s, sol);
    let ev;
    if (sol === conjSol) ev = CONJUNCTION;
    else if (sol === pollenSol) ev = EVENTS.find(e => e.id === "pollen");
    else {
      const labOk = available(s, N - sol).length >= 2 && !Object.keys(s.builds || {}).length && (count.lab || 0) < 4 && prev !== "lab";
      const cands = EVENTS.filter(e => !e.flowersOnly && e.id !== prev && (count[e.id] || 0) < (e.max ?? 2) && !(e.blockedBy && has(s, e.blockedBy)) && !(e.id === "flare" && (count.flare || 0) >= (N >= 10 ? 2 : 1)));
      const lab = labOk ? [{ id: "lab", lab: true }] : [];
      // Sol 1 always starts a research project; afterwards the lab comes back often once the building work is done
      const total = cands.reduce((n, e) => n + (learnIds(e).every(id => learned[id]) ? 1 : 3) * (e.hazard ? P.hazard : 1), 0);
      ev = sol === 1 && labOk ? lab[0] : weightedPick([...cands, ...lab], e => e.lab ? total * 0.45 : (learnIds(e).every(id => learned[id]) ? 1 : 3) * (e.hazard ? P.hazard : 1));
      if (ev.lab) ev = makeLab(s, N - sol);
    }
    count[ev.id] = (count[ev.id] || 0) + 1; prev = ev.id;
    let subs = ev.steps ? ev.steps.map(sub => ({ ...sub, group: ev.group })) : [ev];
    if (ev.id === "flare" && has(s, "shield")) subs = subs.filter(x => x.id !== "shutter").map(x => x.id === "shelter" ? { ...x, enter: st => { st.flare = true; st.astro = "outside"; st.sam = "outside"; st.shutter = true; }, text: s2 => `🚨 <b>${s2.mission.flare.kind}!</b> Like the real event of ${s2.mission.flare.date}. Your <b>regolith shield</b> protects the greenhouse 🧱, but Léa and Sam are still <b>outside</b>!` } : x);
    const out = subs.map(sub => toStep(sub, ev.time, sol, N));
    return s.blackout > 0 && ev !== CONJUNCTION ? out.map(st => cutOff(st, s)) : out;
  };
  return Array.from({ length: N }, (_, i) => ({ id: "sol" + (i + 1), icon: "❔", sol: i + 1, sols: N, lazy: s => resolve(s, i + 1) }));
}

export function generateMission(knownCard) {
  const flare = FLARES.length ? pick(FLARES) : { kind: "Solar flare", date: "October 3, 2024", src: "NASA DONKI" };
  const mission = {
    temp: pick([-78, -84, -90, -97, -105]),
    battery: pick([0.5, 0.6, 0.7, 0.8, 0.9]),
    flare,
    flareCard: ["radiation", "astronaut"].find(c => !knownCard(c)) || pick(["radiation", "astronaut"]),
  };
  const steps = [];
  steps.push({
    id: "crop", icon: "🌱", time: "dawn", speaker: "houston",
    enter: s => { s.mission = mission; s.battery = mission.battery; s.plantHp = 3; s.seedling = false; s.crop = null; s.growth = 0; s.sol = 0; s.builds = {}; s.installed = {}; s.news = []; s.blackout = 0; s.plan = false; },
    text: `A new mission begins, and it will <b>never be the same twice</b>! Choose what to grow. All these plants have really been grown in space or in Mars-like conditions. <b>Easy</b> crops take 6 sols; <b>harder</b> ones take longer and face more dangers. Battery: <b>${Math.round(mission.battery * 100)}%</b>.`,
    ask: "What do you grow?",
    grid: true,
    options: Object.entries(PLANTS).map(([k, P]) => ({
      label: P.name, icon: P.icon, stars: P.level,
      sub: `${P.sols} sols${P.variety ? ` · “${P.variety}”` : ""}`,
      card: "mars", learn: P.learn,
      fx: s => { s.crop = k; s.seedling = true; steps.push(...buildSols(k)); },
      say: `${P.icon} You plant <b>${P.name.toLowerCase()}</b>${P.variety ? ` (“${P.variety}”)` : ""}. Harvest in <b>${P.sols} sols</b>. ${["", "An easy mission to start!", "A medium mission: stay focused!", "A hard mission: good luck, commander!"][P.level]}`,
    })),
  });
  return steps;
}

export const level3 = {
  id: 3,
  name: "Random mission",
  goal: "Pick a real crop, then survive a different mission every time: random events, real solar storms, new facts to learn.",
  energy: true,
  random: true,
  generate: generateMission,
  steps: [],
};
