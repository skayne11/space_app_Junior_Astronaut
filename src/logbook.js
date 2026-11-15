// Logbook: the space cards to collect (data/cards.json), grouped in decks, saved in the browser.

export let DECKS = [], CARDS = {};
export function setContent(c) { DECKS = c.decks; CARDS = c.cards; }
export const logbook = loadLogbook();
export function loadLogbook() { try { return JSON.parse(localStorage.getItem("chili-cards-v1") || "{}"); } catch (e) { return {}; } }
export function saveLogbook() { try { localStorage.setItem("chili-cards-v1", JSON.stringify(logbook)); } catch (e) { } }
/** The deck a card belongs to. */
export const deckOf = id => DECKS.find(d => d.cards.includes(id));
/** How many cards of a deck are collected. */
export const countIn = d => d.cards.filter(k => logbook[k]).length;
