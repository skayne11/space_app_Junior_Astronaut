# 🌶️ Chili on Mars

An educational game for ages 7–12: grow a chili pepper in the greenhouse of a Mars base, one choice at a time. The solar flares, the weather and the science facts come from real NASA data.

**Play online:** `https://<your-account>.github.io/<repo-name>/` (replace after the first deployment)

## How it works

- **Levels made of choices.** Houston or Commander Léa describe a situation, you answer **Yes** or **No**, and the base shows the consequence (watered plant, frost, radiation…).
- **Level 1 · First sol** is a short tutorial: *Are you ready? → Water the plant? → Open the door on a freezing night? → Let Léa stay outside during a flare?* No energy or resource management yet.
- **Level 2 · Storm season** (unlocked by finishing level 1): choose a seed (radish or red lettuce, the two easiest real crops: the radish resists the cold, the lettuce loses a heart on a freezing night), avoid overwatering, pick what the lab researches, then get through a freezing night, a dust storm, dirty solar panels and a solar flare (shutter + shelter). Choices chain together: the seed changes how the cold hurts, the research gives reports later, the battery decides if the shutter can close. The plant can die.
- **Level 3 · Random mission** (unlocked by finishing level 2): first pick a **real crop** that has been grown in space or in Mars-like conditions: radish, red lettuce (★, 6 sols), potato (★★, 8 sols), dwarf tomato (★★, 9 sols), dwarf wheat (★★★, 10 sols) or chili pepper (★★★, 12 sols). The crop sets the difficulty: mission length (6 sols minimum, one event per sol), how often dangers happen, cold resistance (cool-weather crops vs. tomato/chili) and whether flowers must be pollinated. Events are drawn at random each sol (water, overwatering, cold night, dust storm, dusty panels, solar flare, mold, pollination, broken recycler, oxygen, grow lamps, dusty spacesuit, workout, lab research), each question is randomly asked one way or the other, and each answer is followed by a "Why?" fact that explains it. Facts not seen yet are drawn first. **Research:** the lab offers two projects out of six pieces of equipment (weather station, solar telescope, moisture sensor, air fan, regolith shield, mini nuclear reactor). Each takes 1 to 3 sols to build: a building site with a progress bar appears on the base and Sam works on it, then the equipment is drawn on the base and changes the rest of the mission (forecasts, flare warnings, soil readings, no more mold, no shutter needed, extra power). Each sol's event is drawn when the player reaches it, so it can depend on what is already built. **Solar conjunction:** on sol 2 or 3, Houston announces that the Sun will be between Earth and Mars (it happens about every 26 months): no contact for about two weeks (14 sols, like the real thing), so it lasts until the end of the mission. If the player downloads Houston's plan before the blackout, every later event shows a piece of advice; otherwise the crew is on its own. The radio dish on the lab roof shows "NO SIGNAL" during the blackout. Simulated: a perfect player never loses the plant; random answers lose it ~13% of the time with a radish and ~80% with a chili.
- **Space cards**: 17 collectible cards with a photo, a fun fact and a definition, in 4 decks (Planet Mars, Sun & space, Life & energy, Explorers). Some are earned with your choices, others hide in the scene (tap what sparkles ✨: the Sun, the shelter, the radio dish, a rover on the hills, a helicopter in the sky…). Cards are saved in the browser.

## Running the game locally

JavaScript modules need a small server (opening `index.html` directly does not work):

```bash
npm start            # opens http://localhost:5173
# or, without Node:
python3 -m http.server 5173
```

No dependencies to install, no build step.

## Structure

```
index.html, style.css     page and styles (scene states are CSS rules on data attributes)
src/
  main.js                 entry point: loads the facts, then starts
  levels.js               THE LEVELS 1 and 2: steps, questions, consequences, cards to unlock
  level3.js               level 3: pool of random events, mission generator, "Did you know?" facts
  rules.js                shared rules: chili varieties (levels 1–2), real crops (level 3), plant health
  game.js                 level flow (question → answer → consequence), talk panel, logbook UI
  scene.js                the Mars base as an SVG + hidden card hotspots
  logbook.js              logbook data and local save
  audio.js                generated sounds (no audio files)
data/
  cards.json              the 17 space cards (name, type, fun fact, definition, photo, how to unlock) and their 4 decks
assets/cards/             photos of the 17 space cards
  events.json             real solar events (kept for future levels)
```

**Adding a level:** add an entry to `LEVELS` in `src/levels.js` (the comment at the top of the file lists every field). Each step has a `time` of day, a speaker, a question, and either `yes` / `no` or two named `options`. Keep two choices per question, and vary the wording so that the right answer is sometimes "No" (Yes and No buttons share the same neutral colour). Answers have `fx` (scene change), `say` (feedback), `good` (counts for the stars) and `card` (logbook reward); `say` and `good` can be functions of the state, for consequences that depend on earlier choices. Progress (unlocked levels, best stars) is saved in the browser.

## Useful commands

| Command | Purpose |
|---|---|
| `npm start` | Local server |

## Publishing to GitHub Pages

1. Push the repository to GitHub (`main` branch).
2. In **Settings → Pages**, choose **Source: GitHub Actions**.
3. Every push republishes the game automatically.

## Next steps

- [ ] Check every date and every fact (see [SOURCES.md](SOURCES.md)).
- [ ] Level 2 and beyond (energy, more events).
- [ ] Have kids play level 1 and adjust the texts.
