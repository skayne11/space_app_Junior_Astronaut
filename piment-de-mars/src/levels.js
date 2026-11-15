// Levels: a list of steps. Each step sets the scene, asks one question, and each answer has a consequence.
//
// Step fields
//   id        unique name                     icon      shown in the step track (top bar) and the recap
//   time      "dawn" | "day" | "evening" | "night": time of day shown in the scene
//   enter(s)  optional: changes the scene state when the step starts (e.g. a solar flare begins)
//   speaker   who talks: key of SPEAKERS
//   text      what they say (HTML allowed). String, or function(s) for text that depends on earlier choices
//   hint(s)   optional: returns a "lab report" shown above the question when earlier research pays off
//   ask       the question
//   yes / no  a Yes/No question … or `options: [a, b]` for two named answers with `label`, `icon` and `sub`.
//             Vary the questions so that the right answer is not always "Yes".
//
// Answer fields
//   fx(s)     changes the scene state (the scene animates the difference)
//   good      true = right choice, false = wrong choice (counts for the stars), omit = neutral.
//             Can be a function(s), evaluated after fx: the same answer can turn out well or badly.
//   say       feedback shown after the choice (string or function(s), evaluated after fx)
//   card      logbook card unlocked by this answer (passive reward)
//   retry     true = ask the same question again after the feedback
//
// The scene state `s` is described in scene.js (newSceneState). If s.plantHp drops to 0, the level ends.

import { VARIETIES, PLANTS, coldDamage, hurt, heal } from "./rules.js";
import { level3 } from "./level3.js";

export const SPEAKERS = {
  houston: { name: "Houston", role: "Mission control · Earth", icon: "📡" },
  lea: { name: "Commander Léa", role: "Your crewmate", icon: "🧑‍🚀" },
  yuki: { name: "Yuki", role: "Crew scientist", icon: "🔬" },
  sam: { name: "Sam", role: "Crew engineer", icon: "🔧" },
};

export { VARIETIES };

export const LEVELS = [
  /* ------------------------------------------------------------------ Level 1: tutorial */
  {
    id: 1,
    name: "First sol",
    goal: "Keep your chili seedling alive for its first sol (Martian day) on Mars.",
    steps: [
      {
        id: "ready", icon: "👋", time: "dawn", speaker: "houston",
        text: "Good morning! The Sun is rising over your Mars base. You are in charge of the <b>greenhouse</b> and its very first chili seed. 🌱",
        ask: "Are you ready?",
        yes: { say: "Great! Let's go. Remember: every choice has a consequence.", card: "mars" },
        no: {
          retry: true, fx: s => { s.tour = true; },
          say: "No problem, here's a quick tour: the <b>greenhouse dome</b> in the middle protects your plant, the <b>shelter</b> on the left protects the crew, the <b>solar panels</b> on the right make electricity. Tip: tap things in the scene, some hide secret cards! 🔍",
        },
      },
      {
        id: "water", icon: "💧", time: "day", speaker: "lea",
        enter: s => { s.tour = false; s.soil = "dry"; },
        text: "The Sun is up. I checked the pot: the soil is <b>completely dry</b> and the little leaves are drooping…",
        ask: "Water the plant?",
        yes: {
          good: true, card: "water", fx: s => { s.soil = "wet"; s.watering = true; },
          say: "Well done! 💧 The roots drink and the leaves stand up again. On Mars, every drop counts: water is recycled again and again.",
        },
        no: {
          good: false, card: "water", fx: s => { hurt(s, 1); s.wilted = true; },
          say: "Oh no… without water, the plant can't feed itself. Its leaves are wilting. 🥀 A plant is mostly made of water!",
        },
      },
      {
        id: "door", icon: "🚪", time: "evening", speaker: "lea",
        enter: s => { s.watering = false; },
        text: "The Sun is setting. Tonight it will be <b>−80 °C</b> outside! Sam says the greenhouse feels stuffy and wants to <b>open the door</b> to let in some fresh air.",
        ask: "Open the greenhouse door tonight?",
        yes: {
          good: false, card: "temperature", fx: s => { hurt(s, 1); s.frost = true; },
          say: "Brrr… 🥶 The freezing Martian air rushes in, frost covers the dome and the leaves freeze. On Mars, the greenhouse must stay closed and heated!",
        },
        no: {
          good: true, card: "temperature", fx: s => { s.heater = true; },
          say: "Good call! 🚪 The door stays shut and the heater keeps the greenhouse warm. The air on Mars is too thin to keep the day's heat.",
        },
      },
      {
        id: "radiation", icon: "☢️", time: "night", speaker: "houston",
        enter: s => { s.flare = true; s.astro = "outside"; },
        text: "🚨 <b>Alert!</b> A huge solar flare has just left the Sun, like the real <b>X9 flare</b> NASA recorded on October 3, 2024. Léa is outside fixing a solar panel. On the radio she says: <i>“I'm almost done, can I stay a few more minutes?”</i>",
        ask: "Let Léa stay outside?",
        yes: {
          good: false, card: "radiation", fx: s => { s.dose = true; },
          say: "Ouch! ☢️ Léa received a big dose of radiation. Mars has no magnetic shield like Earth: the repair can wait, you must always take shelter during a flare.",
        },
        no: {
          good: true, card: "radiation", fx: s => { s.astro = "shelter"; },
          say: "Phew! 🛡️ Léa runs to the shelter. Its thick walls block the radiation until the storm is over. The repair can wait!",
        },
      },
    ],
  },

  /* ------------------------------------------------------------------ Level 2: seed, lab, storms */
  {
    id: 2,
    name: "Storm season",
    goal: "Choose your seed, use the lab, and get your plant through a cold night, a dust storm and a solar flare.",
    energy: true,   // shows the battery in the status bar
    steps: [
      {
        id: "seed", icon: "🌱", time: "dawn", speaker: "houston",
        enter: s => { s.plantHp = 3; s.seedling = false; s.crop = null; s.growth = 0; },
        text: "New mission! The cargo ship brought <b>two easy seeds</b> that astronauts have already grown on the Space Station. They don't react the same way to the cold… Choose carefully: it will matter later!",
        ask: "Which seed do you plant?",
        options: ["radish", "lettuce"].map(k => [k, PLANTS[k]]).map(([k, P]) => ({
          label: P.name, icon: P.icon, sub: `“${P.variety}” · ${k === "radish" ? "Loves cool weather." : "Quick and tasty, a bit fragile in the cold."}`, card: "mars", learn: P.learn,
          fx: s => { s.crop = k; s.seedling = true; s.growth = 0.15; },
          say: { radish: "🌱 The radish seeds are in the pot. Radishes like it cool: cold nights don't scare them much.", lettuce: "🥬 The red lettuce seeds are in the pot. Lettuce grows fast and tastes great… but it doesn't love freezing nights." }[k],
        })),
      },
      {
        id: "water", icon: "💧", time: "day", speaker: "lea",
        enter: s => { s.soil = "dry"; s.growth = 0.25; },
        text: "The seed is planted in the transparent pot and the soil is <b>dry</b>. I have a big bucket of water here: I'm going to <b>fill the pot right to the top</b>, so we won't have to water it again!",
        ask: "Fill the pot to the top?",
        yes: {
          good: false, card: "water", fx: s => { s.soil = "flood"; s.watering = true; hurt(s, 1); },
          say: "Too much! 🌊 The roots are drowning: roots need air too. The plant gets weaker (−1 ♥). In the Veggie experiment, astronauts give each plant just the right amount.",
        },
        no: {
          good: true, card: "water", fx: s => { s.soil = "ok"; s.watering = true; },
          say: "Good thinking! 💧 Léa gives just a small glass instead: the soil is moist and the roots can still breathe.",
        },
      },
      {
        id: "lab", icon: "🔬", time: "day", speaker: "yuki",
        enter: s => { s.watering = false; s.wilted = false; if (s.soil === "flood") s.soil = "wet"; s.lab = true; s.growth = 0.4; },
        text: "Welcome to the <b>lab</b>! 🔬 Here we do research to understand Mars. Research takes time, so we can only study <b>one</b> of these two subjects today. What we learn will help you later…",
        ask: "What should Yuki research?",
        options: [
          {
            label: "Martian weather", icon: "🌡️", sub: "Build a weather station.", card: "laboratory",
            fx: s => { s.research = "weather"; },
            say: "Yuki installs a weather station, like REMS on Curiosity. Now you'll know what weather is coming! 🌡️",
          },
          {
            label: "The Sun", icon: "☀️", sub: "Watch the Sun with a telescope.", card: "laboratory",
            fx: s => { s.research = "sun"; },
            say: "Yuki points a telescope at the Sun and watches its dark spots: now you'll see flares coming! ☀️",
          },
        ],
      },
      {
        id: "cold", icon: "🥶", time: "evening", speaker: "lea",
        enter: s => { s.lab = false; s.deepCold = true; s.growth = 0.5; },
        text: "The Sun is setting and the temperature is dropping fast. Tonight will be <b>very</b> cold.",
        hint: s => s.research === "weather" ? "🌡️ <b>Weather station report:</b> −95 °C tonight, the coldest night of the month!" : null,
        ask: "Turn on the heater?",
        yes: {
          good: true, card: "temperature", fx: s => { s.heater = true; },
          say: "🔥 The greenhouse stays warm all night. Your plant sleeps safely.",
        },
        no: {
          card: "temperature",
          fx: s => { s.frost = true; hurt(s, coldDamage(s)); },
          good: s => coldDamage(s) ? false : undefined,
          say: s => coldDamage(s)
            ? `🥶 Frost covers the dome and the <b>${PLANTS[s.crop].name.toLowerCase()}</b> leaves freeze (−${coldDamage(s)} ♥).`
            : "❄️ Frost covers the dome… but your <b>radish</b> holds on! Radishes are cool-weather plants. Lucky seed choice!",
        },
      },
      {
        id: "storm", icon: "🌪️", time: "day", speaker: "houston",
        enter: s => { s.heater = false; s.frost = false; s.deepCold = false; s.dust = true; s.growth = 0.6; },
        text: "A huge <b>dust storm</b> is coming, like the one that ended the Opportunity rover in 2018! The sky will stay dark for a long time and the solar panels will make almost no electricity. ⚡",
        hint: s => s.research === "weather" ? "🌡️ <b>Weather station:</b> you saw the storm coming. The battery was fully charged before it arrived!" : null,
        ask: "Keep the grow lamps on during the storm?",
        yes: {
          good: false, card: "sandstorm",
          fx: s => { s.battery = s.research === "weather" ? 0.3 : 0.1; },
          say: s => s.battery < 0.2
            ? "The lamps use a lot of energy… the battery is <b>almost empty</b>! 🪫 That's how Opportunity ran out of power."
            : "The lamps drain the battery… luckily it was full before the storm, but it's low now. 🪫",
        },
        no: {
          good: true, card: "sandstorm",
          fx: s => { s.lampsOff = true; s.battery = s.research === "weather" ? 0.8 : 0.6; },
          say: "Smart! 🔋 With the lamps off, the battery keeps enough energy for the important machines. The plant can rest in the dark for a while.",
        },
      },
      {
        id: "clean", icon: "🧹", time: "day", speaker: "lea",
        enter: s => { s.dust = false; s.lampsOff = false; s.panelsDusty = true; s.growth = 0.7; },
        text: "The storm is over! ☀️ But the solar panels are covered in a layer of <b>red dust</b>: they barely make electricity anymore.",
        ask: "Send Sam outside to clean the panels?",
        yes: {
          good: true, card: "solar_energy",
          fx: s => { s.sam = "panels"; s.panelsDusty = false; s.battery = 1; },
          say: "Sam brushes the panels: they shine again and the battery recharges! ⚡ The InSight lander didn't have anyone to do that…",
        },
        no: {
          good: false, card: "solar_energy",
          fx: s => { s.battery = Math.min(s.battery, 0.15); },
          say: "The panels stay dirty and the battery can't recharge. 🪫 That's exactly what stopped the InSight lander in 2022.",
        },
      },
      {
        id: "shutter", icon: "🛡️", time: "evening", speaker: "houston",
        enter: s => { s.sam = "outside"; s.flare = true; s.astro = "outside"; s.growth = 0.8; },
        text: "🚨 <b>Solar flare!</b> Radiation is coming. The glass dome doesn't stop it, but the greenhouse has a protective <b>shutter</b>. It runs on electricity.",
        hint: s => s.research === "sun" ? "☀️ <b>Telescope report:</b> Yuki saw the flare leave the Sun. You have extra time to get ready!" : null,
        ask: "Leave the shutter open to keep the sunlight?",
        yes: {
          good: false, card: "solar_flare", fx: s => { hurt(s, 1); },
          say: "The plant keeps its light… but radiation goes right through the glass and damages the leaves (−1 ♥). Mars has no magnetic shield to protect it.",
        },
        no: {
          card: "solar_flare",
          fx: s => {
            if (s.battery >= 0.2 || s.research === "sun") s.shutter = true;
            else hurt(s, 1);
          },
          good: s => s.shutter,
          say: s => !s.shutter
            ? "You press the button to close it… <b>nothing happens</b>! 🪫 The battery is empty, so the shutter can't move. Radiation hits the plant (−1 ♥). Energy matters!"
            : s.battery < 0.2
              ? "No power… but thanks to the telescope's early warning, Sam had time to close the shutter <b>by hand</b>! 🛡️"
              : "The shutter slides down over the dome: the plant is safe! 🛡️ You can open it again when the flare is over.",
        },
      },
      {
        id: "shelter", icon: "☢️", time: "evening", speaker: "houston",
        text: "Léa and Sam are still <b>outside</b>, and the radiation is getting stronger!",
        ask: "Go back inside the shelter?",
        yes: {
          good: true, card: "astronaut", fx: s => { s.astro = "shelter"; s.sam = "shelter"; },
          say: "Everybody runs to the shelter: the crew is safe! 🛡️ Satellites watching the Sun help astronauts get warned in time.",
        },
        no: {
          good: false, card: "astronaut", fx: s => { s.dose = true; },
          say: "Léa and Sam receive a big dose of radiation. ☢️ Never stay outside during a solar flare!",
        },
      },
    ],
  },
  level3,
];
