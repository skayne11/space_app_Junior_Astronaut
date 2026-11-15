// Rules shared by all levels: seed varieties, real crops (level 3) and plant health helpers.

/** Levels 1–2: game chili varieties. */
export const VARIETIES = {
  fast: { name: "Lightning Chili", icon: "⚡", sub: "Grows fast, but fragile in the cold." },
  balanced: { name: "Classic Chili", icon: "⚖️", sub: "Not too fast, not too fragile." },
  polar: { name: "Polar Chili", icon: "❄️", sub: "Handles the cold, but grows slowly." },
};

/**
 * Level 3: real crops that have been grown in space or in Mars-like conditions.
 *   level   difficulty (1–3 stars)      sols     mission length (minimum 6)
 *   cold    hearts lost on a freezing night without heating (cool-season crops resist better)
 *   flowers needs pollination to make fruit      hazard  how often dangerous events are drawn
 */
export const PLANTS = {
  radish: {
    name: "Radish", variety: "Cherry Belle", icon: "🌱", level: 1, sols: 6, cold: 0, hazard: 1,
    sub: "Ready in about a month. Loves cool weather.",
    learn: { id: "radish", text: "In 2020, astronaut Kate Rubins harvested <b>20 radishes</b> on the Space Station, grown in the Advanced Plant Habitat in just <b>27 days</b>. Fast growers are perfect for a first space garden!", src: "NASA · Plant Habitat-02" },
  },
  lettuce: {
    name: "Red lettuce", variety: "Outredgeous", icon: "🥬", level: 1, sols: 6, cold: 1, hazard: 1,
    sub: "Easy and quick. Astronauts have eaten it!",
    learn: { id: "lettuce", text: "On August 10, 2015, astronauts on the Space Station ate <b>“Outredgeous” red romaine lettuce</b> they had grown themselves in the Veggie garden.", src: "NASA · Veggie (VEG-01)" },
  },
  potato: {
    name: "Potato", variety: "", icon: "🥔", level: 2, sols: 8, cold: 1, hazard: 1.3,
    sub: "Grows underground. Very nourishing.",
    learn: { id: "potato", text: "In 2016–2017, the International Potato Center in Peru and NASA scientists grew <b>potatoes</b> in a sealed box that copied the thin, CO₂-rich air of Mars.", src: "International Potato Center (CIP) · NASA" },
  },
  tomato: {
    name: "Dwarf tomato", variety: "Red Robin", icon: "🍅", level: 2, sols: 9, cold: 2, hazard: 1.4, flowers: true,
    sub: "Needs warmth and pollination.",
    learn: { id: "tomato", text: "NASA grew <b>“Red Robin” dwarf tomatoes</b> on the Space Station in 2022–2023. One tomato even floated away and was only found months later!", src: "NASA · Veggie-05" },
  },
  wheat: {
    name: "Dwarf wheat", variety: "USU-Apogee", icon: "🌾", level: 3, sols: 10, cold: 0, hazard: 1.6,
    sub: "Makes flour for bread. Long to grow.",
    learn: { id: "wheat", text: "<b>“USU-Apogee”</b> is a tiny wheat created by Utah State University for NASA, to fit in space gardens. It was grown on the Space Station in 2002.", src: "NASA · Utah State University" },
  },
  chili: {
    name: "Chili pepper", variety: "Española Improved", icon: "🌶️", level: 3, sols: 12, cold: 2, hazard: 1.8, flowers: true,
    sub: "The hardest: about 4 months, warmth, pollination.",
    learn: { id: "chili", text: "In 2021, astronauts grew <b>“Española Improved” chili peppers</b> on the Space Station for about 4 months, then made tacos with them. It was one of the hardest plants ever grown in space!", src: "NASA · Plant Habitat-04" },
  },
};

/** Hearts lost on a freezing night without heating. */
export const coldDamage = s => s.crop && PLANTS[s.crop] ? PLANTS[s.crop].cold : ({ polar: 0, balanced: 1, fast: 2 })[s.variety] ?? 1;
export const plantName = s => s.crop && PLANTS[s.crop] ? PLANTS[s.crop].name : s.variety ? VARIETIES[s.variety].name : "chili";
export const hurt = (s, n) => { s.plantHp = Math.max(0, s.plantHp - n); if (s.plantHp === 0) s.wilted = true; };
export const heal = s => { s.plantHp = Math.min(3, s.plantHp + 1); };

/**
 * Level 3: equipment designed in the lab, then built on the base over a few sols.
 *   sols   research + installation time      card   logbook card unlocked when it's installed
 *   does   what it changes once installed (shown to the player)
 */
export const EQUIPMENT = {
  weather: {
    name: "Weather station", icon: "🌡️", sols: 1, card: "curiosity",
    does: "Forecasts freezing nights and dust storms.",
    learn: { id: "rems", text: "Weather stations on Mars are real: <b>REMS</b> on the Curiosity rover has measured temperature, wind, air pressure and UV light almost every day since 2012.", src: "NASA / JPL · Curiosity REMS" },
  },
  telescope: {
    name: "Solar telescope", icon: "🔭", sols: 1, card: "solar_flare",
    does: "Spots solar flares early.",
    learn: { id: "sdo", text: "NASA watches the Sun non-stop with spacecraft like <b>SDO</b> (Solar Dynamics Observatory), so forecasters can spot a flare the moment it happens.", src: "NASA · SDO" },
  },
  sensor: {
    name: "Moisture sensor", icon: "💧", sols: 2, card: "water",
    does: "Measures exactly how wet the soil is.",
    learn: { id: "soilsensor", text: "Many soil sensors send a <b>tiny electric current</b> through the soil: wet soil lets electricity through more easily than dry soil, so the sensor can tell how much water is left.", src: "Soil science · NASA Advanced Plant Habitat" },
  },
  fan: {
    name: "Air fan", icon: "🌀", sols: 1, card: "oxygen",
    does: "Keeps the air moving: no more mold.",
    learn: { id: "transpire", text: "Plants “breathe out” water vapour through tiny holes in their leaves. In a closed greenhouse, that damp air builds up, so <b>fans</b> keep it moving to stop mold.", src: "Plant biology · NASA Veggie" },
  },
  shield: {
    name: "Regolith shield", icon: "🧱", sols: 3, card: "magnetic_shield",
    does: "Covers the dome with Martian soil against radiation.",
    learn: { id: "3dprint", text: "Why bring building materials from Earth? NASA's <b>3D-Printed Habitat Challenge</b> (2015–2019) tested ways to build shelters out of the soil you find on Mars.", src: "NASA Centennial Challenges" },
  },
  reactor: {
    name: "Mini nuclear reactor", icon: "⚛️", sols: 3, card: "energy",
    does: "Makes power day and night, even in dust storms.",
    learn: { id: "kilopower", text: "A small nuclear reactor like NASA's <b>Kilopower</b> (tested in Nevada in 2018) doesn't need sunlight: it keeps making power at night and during dust storms.", src: "NASA · Kilopower / KRUSTY" },
  },
};
/** True if the equipment is installed (level 3), or was the research choice (level 2). */
export const has = (s, id) => !!(s.installed && s.installed[id]) || (!!s.research && s.research === ({ weather: "weather", telescope: "sun" })[id]);
