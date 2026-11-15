// Entry point: loads the space cards and the real solar events, then starts.
import { setContent } from "./logbook.js";
import { setFlares } from "./level3.js";
import { init } from "./game.js";

const load = path => fetch(path).then(r => { if (!r.ok) throw new Error(path); return r.json(); });
const [cards, events] = await Promise.all([load("data/cards.json"), load("data/events.json").catch(() => [])]);
setContent(cards);
setFlares(events);
init();
