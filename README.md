## Le Piment de Mars (The Martian Chili Pepper)

### What exactly does it do?

*Le Piment de Mars* is a browser game for kids aged 7 to 12. The player runs a small greenhouse on a Martian outpost and has one mission: grow a chili pepper from seed to ripe fruit in 7 sols (Martian days), while keeping a crew of three astronauts alive.

To succeed, the player must balance the same competing demands NASA mission planners deal with:
- **Life support:** oxygen and water for the crew and the plant.
- **Limited power:** the energy must be shared between grow lights, heating and the oxygen machine.
- **Radiation protection:** during solar flares, the crew goes to the shelter and the greenhouse shutter is closed, which also blocks the sunlight the plant needs.
- **Food production:** the plant itself.

Every choice has a cost, and the plant visibly grows, thrives, wilts or dies depending on what the player decides.

### How does it work?

- **Plan, then act.** Each sol starts with a paused "dawn" phase. The player reads the forecasts, assigns astronauts to tasks and switches systems on or off. Then the sol plays out in real time for one minute: needs appear, machines break down, dust covers the solar panels, and real solar events strike.
- **Information is earned.** Working in the lab produces science points, used to build instruments: a weather station, a solar telescope and a soil moisture sensor. Once installed, they reveal information directly in the scene. The telescope shows sunspots before a flare, the giant thermometer turns blue before a freezing night, and a green "ideal zone" appears on the transparent pot. The instruments collect dust and must be cleaned, so gathering information is itself a trade-off.
- **Visual feedback instead of text.** Glowing power cables show where the energy goes. The transparent pot shows the water level and the roots. Icons, highlights and sounds (a water drop, an alarm siren, radio static from Houston) guide the player without long sentences.
- **Real events, real science.** Solar events in the game are real events recorded in NASA's DONKI database, such as the X9.0 flare of 3 October 2024 and the CMEs of May 2024. When one happens, an event card briefly pauses the game, shows the real date and the source, and adds a fact to a collectible logbook.
- **Learning that sticks.** The logbook (*Carnet de bord*) collects verified NASA facts across five themes: the Sun and radiation, Martian weather, plants in space, water and air, and energy. Each theme levels up from Bronze to Silver, Gold and Platinum.
- **A new mechanic each sol** (water, then dust, night and cold, solar storms, breakdowns and mold), so the game teaches itself step by step.
- **Replayability.** The player chooses a pepper variety (fast but fragile, balanced, or cold-resistant), and events are randomized from one game to the next.

### What benefits does it have?

- **It makes real engineering trade-offs tangible.** Kids feel why closing the shutter protects the plant but slows its growth, or why lighting the greenhouse at night drains the battery.
- **It is grounded in real NASA data**, not invented statistics, and every source is cited inside the game and in the repository's `SOURCES.md`.
- **No barrier to entry.** It runs in any modern browser, on a computer or a tablet, with no download, no account and no install.
- **It teaches failure without punishment.** When the plant dies, the game explains the main cause (thirst, too much water, cold, mold or radiation) and how to avoid it next time.
- **It is easy to use in a classroom.** A game lasts about 7 minutes and the interface relies on icons rather than reading.

### What do you hope to achieve?

We want children to leave the game understanding at least one real constraint of deep-space survival. For example: on Mars, energy, water and safety are always shared; there are no bees, so astronauts pollinate plants by hand; and solar storms can arrive with almost no warning.

We also want to show how space scientists work: they observe, forecast and prepare. The game rewards a player who gathers information before acting, which is exactly how NASA uses space weather data to protect missions. Finally, we hope it sparks curiosity about the real missions and experiments behind each fact: Veggie, Plant Habitat-04, Curiosity, Perseverance and DONKI.

### What tools, coding languages, hardware, or software did you use?

- **Languages:** HTML5, CSS3 and JavaScript (ES modules, no framework). Data is stored as JSON.
- **Browser technologies:** Canvas 2D for the animated scene, the Web Audio API for sounds generated in code (no audio files), and localStorage to keep the logbook between games.
- **NASA data:**
  - DONKI (Space Weather Database), through the NASA Open APIs at api.nasa.gov.
  - Facts from the Open Science Data Repository (OSDR).
  - Facts from ISS plant experiments (Veggie, Plant Habitat-04, Advanced Plant Habitat).
  - Facts from Mars surface missions: Curiosity RAD, the REMS and MEDA weather stations, Opportunity and InSight.
- **Tooling (Node.js):**
  - A script that fetches recent events from the DONKI API.
  - An automated balance simulator that plays hundreds of games with different strategies to tune the difficulty.
- **Hosting and workflow:** Git and GitHub, with automatic deployment to GitHub Pages through GitHub Actions. An optional daily action refreshes the DONKI data.
- **AI assistance:** Claude (Anthropic) was used for brainstorming, prototyping and code structure.
- **Hardware:** no special hardware. The game runs on any device with a modern web browser.

**Play it:** [https://skayne11.github.io/space_app_Junior_Astronaut/]

---


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
