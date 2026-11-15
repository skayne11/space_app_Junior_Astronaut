# NASA data used

This file explains which NASA datasets the game uses, why, and where to check them. The game's quantities (oxygen, water, energy, growth speed) are simplified. The **events and facts**, however, are real.

> ⚠️ **To do before submission:** check each line below against its source and tick the box. The texts were written from memory during prototyping.

## 1. DONKI: space weather

**What it is:** NASA's database that records solar flares (FLR), plasma clouds (CME) and particle showers (SEP).
**Why:** it is the "radiation" constraint of the brief. The game's flares are real events, and the difference between an announced event (CME) and a surprise (flare, particles) is real.
**In the game:** `data/events.json` (real solar events used for the solar flares).
**Link:** https://kauai.ccmc.gsfc.nasa.gov/DONKI/

- [ ] May 10, 2024: plasma clouds (CME) that caused auroras visible as far south as France
- [ ] October 3, 2024: X9.0 class solar flare
- [ ] May 20, 2024: particle shower (SEP); Curiosity measures its highest dose on Mars
- [ ] A CME takes 1 to 3 days to cross space

## 2. OSDR: space biology research

**What it is:** the Open Science Data Repository, which collects biology experiments carried out in space (plants, astronaut health).
**Why:** it underpins the choice of plant varieties and the idea that radiation also damages plants.
**Link:** https://osdr.nasa.gov/bio/

- [ ] Studies on the Arabidopsis plant in space (pick 1 or 2 specific studies to cite)

## 3. Plant-growing experiments on the Space Station

- [ ] Veggie: pink light (red and blue LEDs), plant pillows
- [ ] 2016: zinnias attacked by mold, saved by Scott Kelly
- [ ] Plant Habitat-04 (2021): chili peppers grown for about 4 months, then tasted
- [ ] Advanced Plant Habitat: more than 180 sensors

## 4. Mars surface missions

- [ ] Curiosity RAD: measuring radiation on the ground since 2012
- [ ] REMS (Curiosity) and MEDA (Perseverance) weather stations
- [ ] Opportunity: end of mission after the 2018 global dust storm
- [ ] InSight: shut down in 2022, panels covered in dust
- [ ] Martian nights below −80 °C

## 5. Life support and energy

- [ ] Space Station: about 98% of water recycled
- [ ] Space Station: oxygen produced by electrolysis of water
- [ ] Kilopower: test of a small nuclear reactor in 2018

## Images

The event cards currently use illustrations drawn in code. To use real photos, search https://images.nasa.gov (images are generally copyright-free, with a "NASA" credit) and cite each image here.

## 5. Level 3 "Why?" facts (`src/level3.js`)

Each fact explains the consequence of a choice. Written from general knowledge: check each one before submission.

- [ ] Radish "Cherry Belle": Kate Rubins harvested 20 radishes after 27 days, Plant Habitat-02 (Nov–Dec 2020)
- [ ] Red romaine lettuce "Outredgeous": eaten on the ISS on August 10, 2015 (Veggie, VEG-01)
- [ ] Potato: International Potato Center (Peru) + NASA, 2016–2017, potatoes grown in a sealed box copying Mars's air
- [ ] Dwarf tomato "Red Robin": Veggie-05 on the ISS, 2022–2023; a tomato lost by Frank Rubio was found months later
- [ ] Dwarf wheat "USU-Apogee": bred by Utah State University for NASA, grown on the ISS in 2002
- [ ] Chili "Española Improved": Plant Habitat-04 (2021), about 4 months, astronauts made tacos
- [ ] Weather station: Curiosity's REMS has measured temperature, wind, pressure and UV almost daily since 2012
- [ ] Solar telescope: NASA's SDO watches the Sun continuously; flares are spotted as they happen
- [ ] Moisture sensor: many soil sensors measure how easily a small electric current passes through the soil
- [ ] Air fan: plants release water vapour through their leaves (transpiration); air movement prevents mold
- [ ] Regolith shield: NASA 3D-Printed Habitat Challenge (2015–2019), building with local soil
- [ ] Mini reactor: Kilopower / KRUSTY test in Nevada, 2018; works without sunlight
- [ ] Solar conjunction: about every 26 months Mars passes behind the Sun as seen from Earth; NASA pauses commands to Mars missions for about two weeks (last ones: late 2021, late 2023, January 2026)
- [ ] Water: a fresh green leaf is about 80–90% water
- [ ] Overwatering: roots take oxygen from air pockets in the soil
- [ ] Cold night: Mars's air is about 100 times thinner than Earth's (≈ 1% of the pressure)
- [ ] Dust storm: solar rovers go into a low-power sleep during long storms (Opportunity, 2018)
- [ ] Dusty panels: dust devils cleaned the panels of Spirit and Opportunity
- [ ] Shutter: water, plastic and regolith are good radiation shields; regolith-covered habitats are studied
- [ ] Shelter: astronauts wear dosimeters
- [ ] Mold: on the ISS, fans move the air because warm air doesn't rise without gravity
- [ ] Pollination: chili flowers are self-fertile (male and female parts); shaking or brushing helps indoors
- [ ] Recycler: ISS water-recovery filters clog and are replaced regularly
- [ ] Oxygen: MOXIE (Perseverance) made oxygen from the Martian air, 2021–2023
- [ ] Lamps: sunlight on Mars is about 43% as strong as on Earth
- [ ] Dusty suit: 2008, Phoenix discovered perchlorates in Martian soil
- [ ] Workout: gravity on Mars is about 38% of Earth's

## 6. Space cards (`data/cards.json`)

Texts are in `data/cards.json`, photos in `assets/cards/`. Check the facts and the photo credits/licences before publishing (NASA images are generally public domain, other images may not be).

- [ ] Mars: moons Phobos and Deimos; second smallest planet
- [ ] Average temperature: −143 °C to +20 °C (−63 °C average at the equator); 228 vs 150 million km from the Sun
- [ ] Solar energy: "4% of the world's deserts covered in solar cells could supply all the world's electricity"
- [ ] Solar flare: ~11-year solar cycle
- [ ] Space communication: every ~26 months, solar conjunction
- [ ] Perseverance, Curiosity, Ingenuity (72 flights; first flight April 19, 2021)
- [ ] Magnetic shield: Mars had one about 4 billion years ago
- [ ] Photo credits for all 17 pictures in `assets/cards/`
