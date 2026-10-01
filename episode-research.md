# Episode Research — "Somebody Did It First" (Jobs 3 and 4)

Prepared 2026-10-01.

## Read this first: how much of this is actually verified

The research ran in a cloud container, not on your Mac. Direct page fetches were blocked by the container's network policy (Wikipedia, Smithsonian, Britannica, Rutgers, archive.org, loc.gov and the rest all returned "egress blocked"), so every check went through a web-search tool that returns search-engine extracts of pages rather than full reads. Then the session's web-search budget (200 searches, shared by every research agent) ran out partway through. That leaves three tiers, and the table below marks which one each episode is in:

- **Checked** — verified this session against two or more strong sources (journals, museums, universities, Britannica, Smithsonian, Nat Geo and similar) via search extracts. Wikipedia and content-farm blogs were not counted as one of the two.
- **Partly** — the main claim was checked, but one half or one supporting detail rests on background knowledge.
- **Provisional** — searches had run out, so the verdict comes from the researcher's background knowledge of the standard scholarship. The sources listed are the right places to confirm, but nobody opened them this session. **Do not script these as confirmed until two sources are checked.** That is 25 episodes, and they are the obvious first job for the next session (raise the search limit, `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`, or allow-list the source domains in the environment's network settings).

## Summary table

Verdict key: **Confirmed** / **Needs correction** (corrected version in the entry) / **Disputed** (hedge given) / **Wrong** (cut). Fit is 1–5 for the "credited person wasn't first" premise.

| # | Episode | Verdict on planned fun fact | Fit | Checked? |
|---|---|---|---|---|
| 1 | Plumbing | Needs correction: "4,000 BCE" unsupported, say "more than 5,000 years ago"; Minoan flush ~1700–1450 BCE, not 2000 | 3 | Checked |
| 2 | Aqueduct | Needs correction: 1.2bn L/day exceeds scholarly estimates; Rome dropped feet per mile, not inches (inches is Pont du Gard) | 4 | Checked |
| 3 | Water Pressure | Needs correction: cut da Vinci → check valve lineage (check valves go back to Ctesibius); Greek showers were gravity-fed | 4 | Checked |
| 4 | Toilet | Needs correction: Knossos flushed with collected rainwater, not "roof cisterns" | 5 | Checked |
| 5 | Sewers | Confirmed (small wording hedge) | 3 | Partly |
| 6 | Hot Water | Needs correction: "bathing lost for centuries" is a myth; medieval bathhouses thrived | 2 | Provisional |
| 7 | Heating | Disputed: ondol "500+ years before the hypocaust" not safely datable | 3 | Provisional |
| 8 | Air Conditioning | Needs correction: core right (humidity, Sackett-Wilhelms, 1902); wording fixes | 5 | Provisional |
| 9 | Concrete | Needs correction: Nabataeans ~6500 BCE is wrong (they flourished ~300 BCE–100 CE); Roman marine concrete holds | 3 | Provisional |
| 10 | Bridge | Needs correction: Arkadiko "oldest in daily use" overstated; Tacoma = flutter is right | 2 | Provisional |
| 11 | Skyscraper | Needs correction: no "1986 campaign" found; likely the 1931 Marshall Field estate committee | 4 | Provisional |
| 12 | Glass | Needs correction: frame Pliny as legend; glass is Mesopotamian, far earlier | 4 | Provisional |
| 13 | Lighting | Confirmed (see launch episode) | 5 | Checked (launch notes) |
| 14 | Weapons | Needs correction: Kathu Pan ~500k holds; "300k years further back" matches no find (Schöningen redated 2025 to ~200k) | 3 | Checked |
| 15 | Sword | Confirmed | 2 | Checked |
| 16 | Armor | Wrong: no evidence for Egyptian layered linen armor ~3100 BCE; cut | 2 | Checked |
| 17 | Bow | Needs correction: Sri Lanka record superseded by Grotte Mandrin (France) ~54k years | 3 | Checked |
| 18 | Gunpowder | Confirmed (hedge "elixir" framing) | 4 | Checked |
| 19 | Gun | Disputed: fire lance as "first gun" depends on definition; say "China had guns first" | 4 | Checked |
| 20 | Rifle | Disputed: Kollner/Kotter attributions are traditional, poorly documented | 2 | Checked (1 strong source) |
| 21 | Artillery | Needs correction: counterweight version came from the Byzantine/Islamic world (12th c.), then traveled back to China | 4 | Checked |
| 22 | Castle | Needs correction: the hill has been built on ~5,000 years, but fortified only since Hellenistic times (~2,000+ years) | 2 | Checked |
| 23 | Warship | Needs correction: Constitution is oldest commissioned warship *afloat*; HMS Victory older | 3 | Checked |
| 24 | Explosives | Disputed: no copy of the "merchant of death" obituary has been found; hedge it | 4 | Checked |
| 25 | Tank | Confirmed (Little Willie); de Mole angle holds with nuance | 4 | Checked |
| 26 | Military Communication | Confirmed (add an ITU/Smithsonian citation) | 3 | Partly (1 strong source) |
| 27 | Wheel | Needs correction: "300 years" was about chariots; potter's wheels and carts overlap ~3500 BCE | 3 | Checked |
| 28 | Road | Needs correction: say "oldest known paved road", ~4,500 years; "royal sarcophagi" detail weak | 3 | Checked |
| 29 | Ship | Confirmed as "oldest surviving boat" | 3 | Checked |
| 30 | Train | Confirmed | 5 | Provisional |
| 31 | Car | Needs correction (wording): Benz = first practical gasoline car; Olds' line was "early", not "first" | 5 | Provisional |
| 32 | Flight | Needs correction: first flight 120 ft/12 s, 852 ft was 4th; "hometown paper refused" too absolute | 4 | Provisional |
| 33 | Space Travel | Confirmed (109 km, flies recovered alive) | 4 | Provisional |
| 34 | Navigation | Disputed: Polynesian–Native American contact real, direction unknown | 4 | Provisional |
| 35 | Timekeeping | Needs correction: Basel sundial "one of the oldest"; cut 3500 BCE obelisk line | 2 | Provisional |
| 36 | Writing | Needs correction: "3/4" untraceable; ~85–90% of early Uruk tablets administrative | 4 | Provisional |
| 37 | Printing Press | Confirmed | 5 | Provisional |
| 38 | Telephone | Needs correction: Gray filed a caveat, not an application; "by hours" contested; H.Res. 269 doesn't say Meucci invented it | 5 | Provisional |
| 39 | Computer | Needs correction: moth real, but Hopper didn't find it and it isn't the origin of "bug"; lead with ENIAC-wasn't-first | 3 (5 reworked) | Provisional |
| 40 | Medicine | Needs correction: Borneo amputation (31k yrs) may beat trepanation as oldest surgery; hedge | 3 | Checked |
| 41 | Anesthesia | Needs correction: "screams a good sign" unsourced; use the documented "pain was seen as useful" version; Long 1842 holds | 5 | Checked |
| 42 | Vaccines | Confirmed (Phipps; Jesty 1774) | 5 | Checked |
| 43 | Hospital | Wrong: no contemporary evidence for a Gundeshapur hospital in 271 CE; first solid mention 765 CE | 3 | Checked |
| 44 | Refrigeration | Needs correction: Zimri-Lim, king of Mari (Syria), ~1780 BCE, not "Sumerian" | 4 | Checked |
| 45 | Cooking | Confirmed (hedge: "may have" cooked) | 3 | Checked |
| 46 | Farming | Disputed: fig domestication claim challenged in Science; hedge | 3 | Checked |
| 47 | Money | Needs correction: drop "tally sticks 30,000 years" as money | 3 | Provisional |
| 48 | Music | Needs correction: Hohle Fels flute ~35–40k; Divje Babe disputed | 3 | Provisional |
| 49 | Recorded Sound | Confirmed | 5 | Provisional |
| 50 | Clothing | Disputed: "dyed" flax fibers contested | 2 | Provisional |
| 51 | Electricity | Needs correction: Dalibard (May 1752) before Franklin's kite; Thales attribution is late | 5 | Provisional |
| 52 | Internet | Confirmed | 4 | Provisional |
| 53 | Bread | Confirmed | 3 | Checked |
| 54 | Salt and Spices | Confirmed (as a myth-bust) | 2 | Checked |
| 55 | Sugar | Needs correction: "Gupta era" too precise; "India, by the start of the common era or earlier" | 4 | Checked |
| 56 | Coffee | Needs correction (minor): Nairon's 1671 herder is unnamed; "Kaldi" came later | 4 | Checked |
| 57 | Chocolate | Confirmed | 4 | Checked |
| 58 | Cheese | Needs correction: Xiaohe kefir cheese (~3,600 yrs) older than Ptahmes (~3,200) | 2 | Checked |
| 59 | Beer and Wine | Confirmed (Raqefet stays hedged) | 4 | Checked |
| 60 | Pizza | Needs correction: earlier description is Emmanuele Rocco, 1858; the royal letter is likely forged | 5 | Checked |
| 61 | Ice Cream | Needs correction (minor): Ibn Abi Usaybi'a recorded chilling water, not freezing food | 4 | Checked |
| 62 | Food Preservation | Disputed: no formal open "prize"; Appert paid 12,000 francs (1810) on condition he publish | 4 | Checked |
| 63 | Restaurant | Confirmed (Paris part); Song China part provisional | 4 | Partly |
| 64 | Diner | Confirmed | 2 | Provisional |
| 65 | Fast Food | Needs correction: "first drive-through" contested; hedge | 5 | Provisional |

**Tally of the 65 planned fun facts:** 20 Confirmed · 35 Needs correction · 8 Disputed · 2 Wrong (cut). Of the 20 "Confirmed", 6 are provisional (13 is covered by the launch notes; 30, 33, 37, 49, 52 and 64 still need their two sources opened). By check status: 37 Checked, 3 Partly, 25 Provisional.


---

# Job 3: Episode-by-episode detail

Each entry gives the planned fun fact, the verdict, the corrected on-air line, what is confirmed vs. inferred vs. unknown, sources, the best "Somebody Did It First" angle, and the fit score. Each quarter opens with its own method note saying exactly what was and wasn't checked.

## Quarter 1: Water, Shelter and Comfort — fact-check

**Method note (read first):** WebFetch was blocked (EGRESS_BLOCKED on en.wikipedia.org, the one test fetch allowed), so everything here comes from search-engine extracts, not full page reads. Partway through this batch the **session-wide WebSearch budget ran out (200/200)**. As a result:
- **Items 1–4** were checked against search extracts from institutional sources gathered this session. The tags below show which.
- **Items 5–13** were checked only partly or not at all this session. Item 5 uses some sources from items 1–4. Items 6–13 rest on my own background knowledge. Every source tagged **[not verified this session]** is a lead I'm fairly confident exists, but someone has to open it before the line goes on air. These items should not be called "Confirmed" until that check is done. Their verdicts are my best judgment of which way the facts point.

---

### 1. Plumbing — Fit 3/5
- **Planned fun fact:** Indus Valley (Mohenjo-daro) had indoor drainage long before Rome; Minoans had flush systems ~2000 BCE; "plumbing" comes from Latin plumbum (lead). (Check the "4,000 BCE" date.)
- **Verdict:** Needs correction
- **Corrected / on-air version:** "More than 5,000 years ago, Mesopotamian cities were already running wastewater through fired-clay pipes. By around 2600 BCE, Mohenjo-daro in the Indus Valley had bathrooms in most homes, and those bathrooms drained into covered street drains. That's more than 2,000 years before Rome. Minoan Crete followed with water-flushed drains in its palaces, from roughly 1700 BCE. And the word 'plumbing' comes from the Latin *plumbum*, meaning lead, because Roman pipes were made of it."
- **Confirmed vs. inferred vs. unknown:**
  - *Confirmed:* Mohenjo-daro c. 2600 BCE (Mature Harappan) had house bathrooms, wall chutes and street drains. *Plumbum* is the origin of the word.
  - *Inferred:* "4,000 BCE" comes from popular plumbing-history pages that cite clay pipes at Nippur and Eshnunna. A peer-reviewed review gives only the broad range "Mesopotamia ca. 4000–2500 BC". Uruk's brick latrines over clay sewer pipes (c. 3200 BCE) are the more defensible early date. Say "more than 5,000 years ago," not "6,000."
  - *Needs correction:* "Minoan flush systems ~2000 BCE" is too early. The first Knossos palace dates to c. 1900 BCE. The water-flushed latrines and drains belong to the later (Neopalatial) palace, c. 1700–1450 BCE.
- **Sources:**
  - Harappa.com — "Ancient Indus City Drains" / "Mohenjo-daro Street with Drains" (https://www.harappa.com/blog/ancient-indus-city-drains) — street drains, house bathrooms, wall chutes (search extract).
  - UNESCO World Heritage Centre — Archaeological Ruins at Moenjodaro (https://whc.unesco.org/en/list/138/) — site dating and urban planning (search extract).
  - Britannica — Great Bath, Mohenjo-daro (https://www.britannica.com/place/Great-Bath-Mohenjo-daro) — bathrooms and drains in most houses (search extract).
  - MDPI *Sustainability* 2016 — "Evolution of Toilets Worldwide through the Millennia" (https://www.mdpi.com/2071-1050/8/8/779), plus MDPI *Water* 2023, "Wastewater Management: From Ancient Greece to Modern Times" (https://www.mdpi.com/2073-4441/15/1/43) — peer-reviewed: Indus c. 2600–1900 BC sewerage, Mesopotamia "ca. 4000–2500 BC" (search extract).
  - Etymonline — "plumber" (https://www.etymonline.com/word/plumber) and Merriam-Webster "plumbum" — Latin *plumbarius* / *plumbum* (search extract).
- **Best "Somebody Did It First" angle:** "Roman plumbing" is the default image, and Rome even gave us the word. But the Indus Valley and Mesopotamia had city-wide drainage 2,000+ years earlier. The evidence is strong. The catch is that no single person gets the credit.
- **Fit score:** 3/5 — a clean "earlier than you think" story that Rome loses, but there's no wrongly credited individual.

### 2. Aqueduct — Fit 4/5
- **Planned fun fact:** Rome's eleven aqueducts moved ~1.2 billion liters a day across up to 57 miles, dropping only inches per mile.
- **Verdict:** Needs correction
- **Corrected / on-air version:** "At its peak, Rome was fed by eleven aqueducts. The longest, the Aqua Marcia, ran about 57 miles (91 km). Estimates of the total flow vary widely, from roughly half a billion to about a billion liters a day. Rome's channels typically dropped about 8 to 16 feet per mile. For a truly absurd gradient, look at the aqueduct that crosses the Pont du Gard in France. Over about 31 miles it falls only around 15 to 20 inches per mile."
- **Confirmed vs. inferred vs. unknown:**
  - *Confirmed:* 11 aqueducts. The Aqua Marcia is the longest at ~91 km (Britannica) or 58 mi/93 km (Nat Geo), so "57 miles" is fine.
  - *Wrong:* "1.2 billion liters/day" is above even the high scholarly estimate. Bruun (1991) gives about 1,000,000 m³/day, roughly 1 billion L. Bruun (2013) revised that to 520,000–635,000 m³/day. A Smithsonian-reported study found the aqueducts carried less than once thought.
  - *Wrong for Rome:* "inches per mile." The typical Roman gradient is 0.15–0.30%, or 1.5–3 m/km, which is roughly 8–16 ft per mile. "Inches per mile" fits the Nîmes aqueduct (Pont du Gard): about 24–34 cm/km, roughly 15–22 inches per mile.
- **Sources:**
  - National Geographic — "Aqueducts: Quenching Rome's Thirst" (https://www.nationalgeographic.com/history/history-magazine/article/roman-aqueducts-engineering-innovation) — 11 systems, Aqua Appia 312 BC, Aqua Marcia 58 mi, typical gradient 0.15–0.30% (search extract).
  - Britannica — Aqua Marcia (https://www.britannica.com/topic/Aqua-Marcia) — length ~91 km, built 144–140 BCE (search extract).
  - PMC / NIH — "The Aqueducts and Water Supply of Ancient Rome" (https://pmc.ncbi.nlm.nih.gov/articles/PMC7004096/) — Bruun 1991 ~1,000,000 m³/day; Bruun 2013 520,000–635,000 m³/day (search extract).
  - Smithsonian — "How Much Water Did Rome's Aqueducts Really Carry?" (https://www.smithsonianmag.com/smart-news/how-much-water-did-romes-aqueducts-really-carry-180955568/) — lower-than-thought flow; Anio Novus ~370 gal/s (search extract).
  - MDPI *Water* 2021 — "Roman Hydraulic Engineering: The Pont du Gard Aqueduct and Nemausus Castellum" (https://www.mdpi.com/2073-4441/13/1/54) — very shallow ~50 km gradient. Livius.org gives ~24 cm/km (search extract).
- **Best "Somebody Did It First" angle:** Romans get credit for "the aqueduct." But around 703–690 BCE, the Assyrian king Sennacherib built the stone-arched Jerwan aqueduct, using more than 2 million dressed stones, to bring water to Nineveh. That's about 400 years before Rome's first aqueduct, the Aqua Appia, in 312 BCE. A royal inscription on the structure names him as builder. Lead sources: World History Encyclopedia "Jerwan Aqueduct" (https://www.worldhistory.org/image/3022/jerwan-aqueduct/), and Jacobsen & Lloyd, *Sennacherib's Aqueduct at Jerwan* (Oriental Institute Publications 24, Univ. of Chicago, 1935) **[not verified this session]**. Greek Samos (the Eupalinos tunnel, c. 530 BCE) also predates Rome.
- **Fit score:** 4/5 — "the Assyrians beat Rome by four centuries, and signed it" is a strong, well-documented hook.

### 3. Water Pressure — Fit 4/5
- **Planned fun fact:** Ancient Greeks ran pressurized showers; da Vinci's ~1512 aortic valve studies (including a glass model) influenced valve design, including the modern check valve.
- **Verdict:** Needs correction
- **Corrected / on-air version:** "Greek athletes had showers. A 4th-century-BC Athenian vase shows women showering under spouts, and Pergamon had a whole shower complex by the 2nd century BC. Those showers ran on gravity, though. Pergamon's real pressure feat was a pipeline. Around 200 BC its engineers ran a lead-pipe siphon across a valley roughly 600 feet deep, so it held pressure of about 20 atmospheres. Then, around 1513, Leonardo da Vinci built a glass model of the aorta. He pumped water and grass seeds through it and saw swirling eddies that help the aortic valve snap shut. Heart researchers didn't publish the same finding until the late 1960s."
- **Confirmed vs. inferred vs. unknown:**
  - *Confirmed:* Leonardo injected wax into an ox heart, built a glass model of the aortic root, and used grass seeds in water to watch vortices. Bellhouse confirmed the mechanism in 1968–69, about 450 years later. Royal Collection drawing RCIN 919082, c. 1512–13.
  - *Confirmed:* Pergamon (Madradağ) inverted siphon c. 200 BC: >3 km of lead pipe, ~180–200 m head, ~20 atm.
  - *Wrong — cut:* "influenced the modern check valve." Non-return (flap) valves are far older than Leonardo. Ctesibius of Alexandria's force pump (3rd c. BC) depended on them, and Roman water systems used them. Leonardo sketched check valves, but he didn't originate them. His aortic work has influenced *prosthetic heart valve and aortic-root surgery* design, which recognizes the role of the sinuses of Valsalva. It has not influenced plumbing valves.
  - *Inferred:* the Greek showers were gravity-fed from raised tanks, not "pressurized" in the modern sense.
- **Sources:**
  - Royal Collection Trust — "The aortic valve," RCIN 919082 (https://www.rct.uk/collection/exhibitions/leonardo-da-vinci/the-queens-gallery-palace-of-holyroodhouse/the-aortic-valve) — wax cast, glass model, grass seeds, eddies (search extract).
  - *Circulation Research* (AHA) — "Cardiovascular Research by Leonardo da Vinci (1452–1519)" (https://www.ahajournals.org/doi/10.1161/CIRCRESAHA.118.314253) and PMC "Leonardo da Vinci on atherosclerosis and the function of the sinuses of Valsalva" (https://pmc.ncbi.nlm.nih.gov/articles/PMC2804084/) — 450 years before Bellhouse (search extract).
  - Gharib et al., "Leonardo's vision of flow visualization," *Experiments in Fluids* 33 (2002) (https://link.springer.com/article/10.1007/s00348-002-0478-8) and Caltech EAS news (https://www.eas.caltech.edu/news/professor-gharib-constructs-leonardo-da-vinci-s-model-of-flow) — modern rebuild of the model (search extract).
  - MDPI *Water* 2013 — "Historical and Technical Notes on Aqueducts from Prehistoric to Medieval Times" (https://www.mdpi.com/2073-4441/5/4/1996) and NTUA ITIA "Madradag aqueduct" (https://www.itia.ntua.gr/ahw/work/111/) — Pergamon siphon, ~180 m head, lead pipe (search extract).
  - Britannica — Ctesibius of Alexandria (https://www.britannica.com/biography/Ctesibius-of-Alexandria) — force pump c. 270 BC (search extract; the valve detail comes from Vitruvius, *De architectura* 10.7 **[not verified this session]**).
- **Best "Somebody Did It First" angle:** The aortic-valve mechanism is usually credited to Bellhouse & Bellhouse (*Nature*, 1968) and later flow-imaging work. Leonardo saw it about 450 years earlier with a glass model and grass seeds. Strong evidence (RCT drawings, AHA review, Caltech rebuild). Keep it about the *heart*, not plumbing.
- **Fit score:** 4/5 — Leonardo beating modern cardiology is a strong, documented hook. The check-valve claim has to go.

### 4. Toilet — Fit 5/5
- **Planned fun fact:** Minoans at Knossos had a flush toilet ~1700 BCE using roof cisterns and gravity. (Plus the Harington / Cumming / Crapper angle.)
- **Verdict:** Needs correction
- **Corrected / on-air version:** "Thomas Crapper did not invent the flush toilet. The palace at Knossos on Crete had water-flushed latrines draining into stone sewers about 3,500 years ago, and Indus Valley homes had drained latrines even earlier. In England, Sir John Harington built a flushing toilet with a cistern for Queen Elizabeth I in 1596. Alexander Cumming patented the S-bend in 1775. Crapper came along in the late 1800s and patented improvements such as the ballcock. And 'crap' as a word is older than he is."
- **Confirmed vs. inferred vs. unknown:**
  - *Confirmed:* Harington 1596, *The Metamorphosis of Ajax*, a cistern-fed bowl, a working model for Elizabeth I. Cumming 1775 S-bend patent. Crapper held ballcock and fitting patents and didn't invent the toilet. "Crap" predates him (etymonline). The "crapper" usage may come from US troops seeing "T. Crapper" cisterns in 1917. Wallace Reyburn's 1969 *Flushed with Pride* (partly tongue-in-cheek) spread the myth.
  - *Needs hedge:* the Knossos "flush toilet" was a latrine flushed by rainwater from the roof and drainage, or by poured water, into a sewer. It didn't use a cistern and valve. "Roof cisterns" is overstated; say "rainwater channelled from the roof." Date it "about 1700–1450 BCE," not a hard 1700.
  - *Inferred:* the Indus Valley (c. 2600 BCE) predates Knossos for drained latrines (MDPI review: "almost every habitation... had its own bathroom including a lavatory").
- **Sources:**
  - History.com — "Who Invented the Flush Toilet?" (https://www.history.com/articles/who-invented-the-flush-toilet) — Harington 1596, Ajax pamphlet, Richmond Palace (search extract).
  - Britannica — Sir John Harington (https://www.britannica.com/biography/John-Harington) and "Toilet" (https://www.britannica.com/technology/water-closet) (search extract).
  - Smithsonian — "Three True Things About Sanitary Engineer Thomas Crapper" (https://www.smithsonianmag.com/smart-news/three-true-things-about-sanitary-engineer-thomas-crapper-180965008/) — ballcock improvements; not the inventor (search extract).
  - Snopes — "Thomas Crapper: Inventor of the Flush Toilet?" (https://www.snopes.com/fact-check/thomas-crapper/) — Cumming 1775 and the Reyburn myth origin (search extract; secondary).
  - Etymonline — "crap" / "crapper" (https://www.etymonline.com/word/crap) — the word predates Crapper (search extract).
  - World History Encyclopedia — Minoan Architecture (https://www.worldhistory.org/Minoan_Architecture/) and Britannica Knossos (https://www.britannica.com/place/Knossos) — Minoan water-flushed toilets into sewers, palace c. 1700–1400 BC (search extract).
- **Best "Somebody Did It First" angle:** Crapper gets the credit through his name and the myth. Harington did the cistern flush toilet 280 years earlier, Cumming invented the key S-trap, and the Minoans and the Indus Valley flushed waste with water millennia earlier. The evidence is strong.
- **Fit score:** 5/5 — a famous wrongly credited name, a documented earlier inventor, and a built-in punchline.

### 5. Sewers — Fit 3/5
- **Planned fun fact:** Indus Valley brick-lined sewers ~2500 BCE, ~2,000 years before Rome's Cloaca Maxima.
- **Verdict:** Confirmed (with a small wording hedge). The Indus half is supported by sources gathered this session. The Cloaca Maxima date comes from background knowledge.
- **Corrected / on-air version:** "By around 2600 to 2500 BCE, cities like Mohenjo-daro had covered, brick-lined street drains that took wastewater from nearly every house. Rome's famous Cloaca Maxima was begun around 600 BCE, roughly 2,000 years later. It started out as an open channel and was only vaulted over later."
- **Confirmed vs. inferred vs. unknown:**
  - *Confirmed:* Indus brick drains c. 2600 BCE, with nearly every house connected (Harappa.com, the MDPI review, UNESCO, from item 1).
  - *Background knowledge [not verified this session]:* Ancient tradition (Livy) dates the Cloaca Maxima to the Tarquin kings, around the 6th c. BCE. It was originally an open drainage canal, covered later. So "~2,000 years before" holds.
  - *Caveat:* Mesopotamia (Uruk, c. 3200 BCE latrines on clay sewer pipes) may be earlier still, so don't say "first sewers ever."
- **Sources:**
  - Harappa.com — "Ancient Indus City Drains" (https://www.harappa.com/blog/ancient-indus-city-drains) (search extract).
  - MDPI *Water* 2023 — "Wastewater Management: From Ancient Greece to Modern Times and Future" (https://www.mdpi.com/2073-4441/15/1/43) — Indus sewerage c. 2600–1900 BC (search extract).
  - Britannica — "Cloaca Maxima" (https://www.britannica.com/topic/Cloaca-Maxima) — 6th c. BCE date **[not verified this session]**.
- **Best "Somebody Did It First" angle:** Rome's Cloaca Maxima is the famous "first great sewer," and the Indus Valley beat it by about two millennia. No individual is credited.
- **Fit score:** 3/5 — solid "earlier than you think," but it overlaps heavily with Plumbing (#1). Consider merging 1 and 5 into one episode.

### 6. Hot Water / Bathing — Fit 2/5
- **Planned fun fact:** After Rome fell, heated communal bathing was lost in Europe for centuries, replaced by fear that open pores let in disease.
- **Verdict:** Needs correction (as written it's essentially a myth). Based on background knowledge; **not verified this session**.
- **Corrected / on-air version:** "The idea that Europe stopped bathing when Rome fell is a myth. Medieval towns were full of public bathhouses, called 'stews,' with hot water and steam. Paris had dozens of them by the late 1200s. The great retreat from bathing came much later, in the 1400s to 1600s. Plague doctors warned that hot water opened the pores to disease, bathhouses picked up a reputation for vice and syphilis, and firewood got expensive. Meanwhile, Roman-style hot bathing never stopped in Byzantium or in the Islamic world's hammams."
- **Confirmed vs. inferred vs. unknown:**
  - *Background knowledge:* Bathhouse guilds (étuveurs) are regulated in Étienne Boileau's *Livre des métiers* (c. 1268). The Paris tax roll of 1292 lists roughly two to three dozen étuves. Southwark "stews" are well documented. Fears about bathing tied to plague and pores, and closures, run 14th–17th c. The hammam continued from Roman/Byzantine baths.
  - *Unknown here:* the exact Paris bathhouse count (26 vs. 32 vary by source). Say "dozens."
- **Sources (leads):**
  - Virginia Smith, *Clean: A History of Personal Hygiene and Purity* (Oxford Univ. Press, 2007) **[not verified this session]**.
  - Katherine Ashenburg, *The Dirt on Clean* (2007) **[not verified this session]**.
  - Smithsonian Magazine has run "medieval people bathed more than you think" pieces. Search smithsonianmag.com for "medieval bathhouses" **[not verified this session]**.
- **Best "Somebody Did It First" angle:** It's a myth-bust, not a did-it-first story. The only "first" angle is that the hammam kept Roman bathing alive while Europe let it go, which is weak. Stronger replacement: **"The Shower."** William Feetham's 1767 English hand-pump shower is often credited as the first modern shower, but Greek gymnasium showers (4th–2nd c. BC) came first. This links neatly to #3.
- **Fit score:** 2/5 — a good myth-bust but no credited inventor. Recommend reframing or replacing.

### 7. Heating (Ondol vs. Hypocaust) — Fit 3/5
- **Planned fun fact:** Korea's Ondol underfloor heating predates Rome's hypocaust by 500+ years.
- **Verdict:** Disputed. Based on background knowledge; **not verified this session**.
- **Corrected / on-air version:** "Korea's ondol, which runs smoke from a kitchen fire through channels under a stone floor, goes back more than 2,000 years. Some archaeologists trace it, or something like it, much further. It's roughly as old as Rome's hypocaust, possibly older. And the Roman hypocaust itself wasn't a Roman original: Greek bathhouses were heating their floors before the Romans popularized it."
- **Confirmed vs. inferred vs. unknown:**
  - *Background knowledge:* Partial-floor heated flues ("gudeul," "kang"-type heated platforms) appear in the Korean peninsula, Manchuria and the Russian Far East (Krounovka/Okjeo-related cultures) around the late 1st millennium BCE. Full-floor ondol is much later (Goryeo/Joseon). One often-repeated claim, a Neolithic ondol at Seopohang (Unggi) c. 5000 BCE, comes from a single site, is contested, and is what feeds the "500+ years earlier" line.
  - Pliny credits Sergius Orata (c. 90s BCE) with "hanging baths" (*balneae pensiles*). Greek precursor heated floors (e.g., Olympia, Gortys in Arcadia) are generally dated to the 3rd–2nd c. BCE.
  - *Unknown:* a secure date for the earliest true ondol. Don't put a "500 years" margin on air.
- **Sources (leads):**
  - Pliny the Elder, *Natural History* 9.168 (Sergius Orata) **[not verified this session]**.
  - Fikret Yegül, *Bathing in the Roman World* (Cambridge UP, 2010) — Greek precursors to the hypocaust **[not verified this session]**.
  - Korean Heritage Service (heritage.go.kr) entry on ondol, inscribed as National Intangible Cultural Heritage in 2018 **[not verified this session]**.
- **Best "Somebody Did It First" angle:** Sergius Orata is the named Roman "inventor" of the hypocaust. Greek bath-builders had heated floors before him, and East Asian heated-floor systems are of comparable or greater age. It's a decent story with fuzzy dates.
- **Fit score:** 3/5 — a named credited person (Orata), but weak dating on both sides, so heavy hedging is needed.

### 8. Air Conditioning — Fit 5/5
- **Planned fun fact:** Willis Carrier built it in 1902 to stop humidity wrinkling paper at a Brooklyn printing plant (Sackett-Wilhelms), not to cool people.
- **Verdict:** Needs correction (small wording issue; the core is correct). Based on background knowledge; **not verified this session**.
- **Corrected / on-air version:** "Willis Carrier's 1902 system at the Sackett-Wilhelms printing plant in Brooklyn wasn't built for comfort. It controlled humidity so paper stopped swelling and shrinking, which was throwing multicolor printing out of alignment. But Carrier wasn't the first to cool a room with a machine. In the 1840s, Florida doctor John Gorrie was blowing air over ice to cool his yellow-fever and malaria patients, and in 1851 he patented an ice-making machine. Even the phrase 'air conditioning' wasn't Carrier's. A textile-mill engineer, Stuart Cramer, coined it in 1906."
- **Confirmed vs. inferred vs. unknown:**
  - *Background knowledge:* Sackett-Wilhelms Lithographing & Publishing Co., Brooklyn, 1902. The problem was paper dimensional change causing misregistered color printing; "wrinkling" isn't the right description. Gorrie: Apalachicola, cooled sickrooms in the 1840s, US Patent 8,080 (1851) for an ice machine. Cramer coined "air conditioning" in 1906; Carrier's 1906 patent was "Apparatus for Treating Air."
  - *Unknown:* whether Gorrie's apparatus ever ran continuously as "air conditioning." Frame it as "mechanically cooled a room."
- **Sources (leads):**
  - Carrier Corporation history page, "Willis Carrier" (carrier.com/carrier/en/worldwide/about/history) **[not verified this session]**.
  - US Patent 8,080, J. Gorrie, "Improved process for the artificial production of ice" (1851) **[not verified this session]**.
  - Smithsonian Magazine / Smithsonian National Museum of American History on Gorrie and early cooling **[not verified this session]**.
  - Florida State Parks — John Gorrie Museum State Park (floridastateparks.org) **[not verified this session]**.
- **Best "Somebody Did It First" angle:** Carrier is the "father of air conditioning." Gorrie was mechanically cooling hospital rooms 60 years earlier, and someone else named the field. Well documented, and Gorrie died broke and obscure, which helps the story.
- **Fit score:** 5/5 — a famous credited name and a documented earlier doer with a sympathetic underdog story.

### 9. Concrete — Fit 3/5
- **Planned fun fact:** Nabataeans built concrete structures ~6500 BCE. Roman seawater concrete still standing after 2,000 years (MIT/Utah studies).
- **Verdict:** Needs correction (the Nabataean date is wrong; the Roman part is correct). Based on background knowledge; **not verified this session**.
- **Corrected / on-air version:** "Romans get the credit for concrete, but people were burning limestone into lime plaster about 9,000 years ago. Neolithic villages in the Near East poured lime-plaster floors. The Nabataeans, the builders of Petra, later used waterproof lime mortars in their cisterns, but that was in the last few centuries BC, not 6500 BC. What Rome really mastered was underwater concrete. A University of Utah-led study found that seawater slowly grows new minerals inside Roman harbor concrete, making it stronger. An MIT-led study found that lumps of lime mixed in hot let it heal its own cracks."
- **Confirmed vs. inferred vs. unknown:**
  - *Wrong:* "Nabataeans ~6500 BCE." The Nabataeans flourished around the 4th c. BCE to 106 CE. The 6500 BCE figure is a widely copied web claim with no archaeological basis that I know of. It probably conflates Neolithic lime plaster with the Nabataeans.
  - *Background knowledge:* PPNB lime-plaster floors (e.g., Yiftahel, Israel; terrazzo floors at Çayönü, Turkey) date c. 7000 BCE. That is lime plaster, not true concrete, so hedge.
  - *Roman studies:* Jackson et al., *American Mineralogist* 2017 (Univ. of Utah; aluminous tobermorite and phillipsite growing in seawater). Seymour, Masic et al., *Science Advances* 2023 (MIT; lime clasts, hot mixing, self-healing).
- **Sources (leads):**
  - Jackson, M.D. et al. (2017), "Phillipsite and Al-tobermorite mineral cements produced through low-temperature water-rock reactions in Roman marine concrete," *American Mineralogist* 102(7) **[not verified this session]**.
  - Seymour, L.M. et al. (2023), "Hot mixing: Mechanistic insights into the durability of ancient Roman concrete," *Science Advances* 9(1) **[not verified this session]**.
  - Smithsonian — "How Has Roman Concrete Lasted for Millennia? A 1,900-Year-Old Latrine Offers New Clues" (https://www.smithsonianmag.com/smart-news/how-has-roman-concrete-lasted-for-millennia-a-1900-year-old-latrine-offers-new-clues-about-the-materials-impressive-durability-180989115/). Its URL surfaced in a search this session, but its content was not checked.
- **Best "Somebody Did It First" angle:** "Romans invented concrete" is the credited myth. Lime binders go back to the Neolithic, and Greek and Hellenistic builders used lime mortars before Rome. The Roman edge was pozzolana and marine concrete. Moderately solid, though "lime plaster vs. concrete" needs careful wording.
- **Fit score:** 3/5 — myth-bust with no single credited person. The Nabataean hook has to go.

### 10. Bridge — Fit 2/5
- **Planned fun fact:** Greece's Arkadiko Bridge (~1300 BCE) is the oldest in daily use; Tacoma Narrows (1940) was torsional flutter, not simple resonance.
- **Verdict:** Needs correction (the Arkadiko claim is overstated; the Tacoma claim is correct). Based on background knowledge; **not verified this session**.
- **Corrected / on-air version:** "Greece's Arkadiko Bridge, a Mycenaean stone bridge from around 1300 to 1200 BCE, is among the oldest bridges in the world still used. Locals still walk across it. And the famous Tacoma Narrows collapse of 1940 wasn't simple resonance, like a singer shattering a glass, despite what generations of physics textbooks said. It was aeroelastic flutter: the wind and the twisting deck fed each other's motion until the deck tore itself apart."
- **Confirmed vs. inferred vs. unknown:**
  - *Background knowledge:* Arkadiko (Kazarma) Bridge, Argolis, Late Helladic IIIB, corbelled arch. It is used by locals as a footpath and track, so "daily use" is unproven. Say "still in use."
  - Tacoma: K.Y. Billah & R.H. Scanlan, "Resonance, Tacoma Narrows bridge failure, and undergraduate physics textbooks," *Am. J. Phys.* 59(2), 1991. This is the standard debunk of the resonance story.
- **Sources (leads):**
  - Billah & Scanlan (1991), *American Journal of Physics* 59:118–124 **[not verified this session]**.
  - Washington State DOT — "Tacoma Narrows Bridge history" (wsdot.wa.gov) **[not verified this session]**.
  - Greek Ministry of Culture "Odysseus" portal / Britannica entry on Mycenaean roads for Arkadiko **[not verified this session]**.
- **Best "Somebody Did It First" angle:** Weak. "Oldest bridge" is a superlative fact, and Tacoma is a myth-bust. Possible did-it-first replacement: the **suspension bridge.** James Finley's 1801 Jacob's Creek chain bridge is often called the first modern suspension bridge, but Tibetan engineer Thangtong Gyalpo built iron-chain suspension bridges in the 1400s. That has a named early builder, but **verify before using**.
- **Fit score:** 2/5 — interesting facts but no credited-person story. Consider pivoting to Thangtong Gyalpo.

### 11. Skyscraper — Fit 4/5
- **Planned fun fact:** Chicago's Home Insurance Building (1885) as "first skyscraper" is largely a myth; Bessemer steel made skyscrapers possible. (Check the "1986 publicity campaign" detail.)
- **Verdict:** Needs correction. Based on background knowledge; **not verified this session**.
- **Corrected / on-air version:** "Chicago's 10-story Home Insurance Building, finished in 1885, is often called the first skyscraper. That title came mostly from a committee set up by the Marshall Field estate when the building was demolished in 1931. It decided the building was the first to use skeleton-frame construction. But iron-framed buildings existed long before. A flax mill in Shrewsbury, England had an all-iron internal frame in 1797, and New York had elevator-served office towers in the 1870s. And the Home Insurance Building was mostly iron. Steel beams only went into its upper floors."
- **Confirmed vs. inferred vs. unknown:**
  - *Background knowledge:* William Le Baron Jenney, 1884–85. Demolished 1931. The Marshall Field Estate investigating committee (1931) affirmed its "first skeleton construction" status. Bessemer steel beams (Carnegie-Phipps) were used above the 6th floor; the rest was cast and wrought iron. Ditherington Flax Mill (1797) is the "grandfather of skyscrapers." Earlier elevator buildings include the Equitable Life Building, NYC (1870).
  - *Unknown / likely wrong:* the "1986 publicity campaign." I know of no such event. It is probably a garbled version of the **1931 Marshall Field Estate committee**, which really did produce the "first skyscraper" label. Cut "1986."
  - *Hedge:* "Bessemer steel made skyscrapers possible" is too strong as a single cause. Cheap structural steel (Bessemer, then open-hearth), the safety elevator (Otis, 1850s) and fireproofing together did it.
- **Sources (leads):**
  - Chicago Architecture Center — Home Insurance Building entry (architecture.org) **[not verified this session]**.
  - Britannica — "Home Insurance Building" and "skyscraper" (britannica.com) **[not verified this session]**.
  - Historic England — Ditherington Flax Mill, "grandfather of skyscrapers" (historicengland.org.uk) **[not verified this session]**.
  - Carol Willis, *Form Follows Finance* (1995), on the contested "first skyscraper" debate **[not verified this session]**.
- **Best "Somebody Did It First" angle:** William Le Baron Jenney and the Home Insurance Building get the credit. Iron skeleton framing (Ditherington, 1797) and tall elevator buildings (NYC, 1870s) came first. The "first" label was itself handed out by a committee 46 years later. Moderately solid; architectural historians debate the definition.
- **Fit score:** 4/5 — a famous "first" with a named architect and a manufactured-credit backstory. The fuzzy definition of "skyscraper" holds it back from a 5.

### 12. Glass — Fit 4/5
- **Planned fun fact:** Pliny's story of Phoenician sailors melting sand under a cooking pot on natron blocks.
- **Verdict:** Needs correction (frame it as legend). Based on background knowledge; **not verified this session**.
- **Corrected / on-air version:** "The Roman writer Pliny the Elder said glass was discovered by accident. Phoenician merchants carrying natron set their cooking pots on blocks of it on a beach, and the heat fused the sand into glass. It's a great story and almost certainly untrue: a campfire on a beach doesn't get anywhere near hot enough. The real first glassmakers were in Mesopotamia, making glass beads by around 2500 BCE and the first glass vessels around 1500 BCE. That's more than a thousand years before the Phoenicians supposedly stumbled on it."
- **Confirmed vs. inferred vs. unknown:**
  - *Background knowledge:* Pliny, *Natural History* 36.190–191 (the Belus river, Syria-Phoenicia). The Corning Museum of Glass treats the story as legend. Earliest glass beads date to the mid-3rd millennium BCE in Mesopotamia and Syria. Core-formed vessels appear c. 1500 BCE in Mesopotamia, then Egypt (Thutmose III era).
  - *Unknown:* the exact first-glass date. Say "around 4,500 years ago," not a hard year.
- **Sources (leads):**
  - Corning Museum of Glass — "All About Glass," origins of glassmaking (cmog.org) **[not verified this session]**.
  - Pliny the Elder, *Natural History* 36.65 (190–191), LacusCurtius/Perseus translation **[not verified this session]**.
  - Metropolitan Museum of Art Heilbrunn Timeline — "Glass in Antiquity" / Mesopotamian glass (metmuseum.org) **[not verified this session]**.
- **Best "Somebody Did It First" angle:** Pliny's Phoenicians get the legendary credit. The Mesopotamians actually did it, 1,000+ years before the setting the legend implies. Strong institutional backing (Corning, the Met).
- **Fit score:** 4/5 — a classic credited origin myth with a documented earlier reality. No famous person, but Pliny's tale is the hook.

### 13. Lighting — Fit 5/5
- **Planned fun fact:** Edison didn't invent the bulb. (Covered in the launch episode; brief entry only.)
- **Verdict:** Confirmed (see the launch episode research; not re-researched here).
- **Corrected / on-air version:** "See the launch episode. If it's mentioned here, keep it to one line: 'Edison didn't invent the light bulb. Humphry Davy, Joseph Swan and others got there first. Edison made it practical and sellable.'"
- **Confirmed vs. inferred vs. unknown:** Defer to the launch-episode fact-check. Avoid re-stating its specific dates without that file.
- **Sources:** See the launch episode fact-check.
- **Best "Somebody Did It First" angle:** The channel's flagship example: Edison credited; Davy, Swan and Woodward & Evans earlier.
- **Fit score:** 5/5 — the textbook case, already covered. Only cross-reference it in this quarter.

---

#### Batch notes

\* Indus half supported by sources found this session; the Cloaca Maxima date comes from background knowledge.
**Items 6–12 are background-knowledge verdicts, not checked this session (search budget exhausted). Each needs its two sources confirmed before scripting.**

**Suggested restructures:** Merge #1 Plumbing and #5 Sewers. Replace or reframe #6 (e.g., "The Shower": Feetham 1767 vs. Greek gymnasium showers). Pivot #10 to Thangtong Gyalpo's 15th-c. iron-chain suspension bridges vs. Finley 1801 (verify first).

---

## Quarter 2: Weapons, Warfare and Power (Episodes 14–26)

**How this was checked.** WebFetch was blocked (EGRESS_BLOCKED on the one test fetch), so everything below comes from search-engine extracts of the cited pages, not full reads. The session's shared WebSearch budget ran out partway through Ep. 26, so a few supporting details (marked **[prior knowledge, not re-verified]**) need a quick human check before air. Wikipedia and blogs were used only for leads, never as one of the two required sources.

---

### 14. Weapons — Fit 3/5
- **Planned fun fact:** Stone-tipped spears ~500,000 years old (Kathu Pan, Wilkins et al. 2012 Science); possible projectile evidence 300,000 years further back.
- **Verdict:** Needs correction
- **Corrected / on-air version:** "In 2012, researchers reported that stone points from Kathu Pan in South Africa, about half a million years old, were probably hafted onto spears. That would put stone-tipped spears in the hands of Homo heidelbergensis, around 200,000 years earlier than anyone had thought. Not everyone is convinced, and the damage-pattern evidence is still debated. The oldest actual wooden spear we have, from Clacton in England, is about 400,000 years old."
- **Confirmed vs. inferred vs. unknown:**
  - *Confirmed:* the Kathu Pan 1 study (Wilkins et al., *Science*, 16 Nov 2012), the ~500,000-year date, and the "200,000 years earlier" framing.
  - *Disputed:* that the points were spear tips at all. Rots & Plisson (2014, *J. Archaeological Science*) called the use-wear reading an "abuse of the use-wear method," and Wilkins et al. published a rebuttal. Say "probably" or "researchers argue."
  - *Wrong:* "possible projectile evidence 300,000 years further back." I found nothing about 800,000-year-old projectiles. This looks like a garbled reference to the Schöningen spears (Germany). Those were long quoted as ~300,000 years old (earlier ~400,000), but a 2025 *Science Advances* study (Leder et al., Mainz/LEIZA) redated them to ~200,000 years, which points to Neanderthal makers. Cut the line, or replace it with the Clacton spear (~400,000 years, oldest worked wooden weapon).
- **Sources:**
  - Phys.org / ScienceDaily — "Archaeologists identify spear tips used in hunting a half-million years ago" (https://phys.org/news/2012-11-archaeologists-spear-half-million-years.html; https://www.sciencedaily.com/releases/2012/11/121115141542.htm) — the Wilkins 2012 *Science* result, H. heidelbergensis, 200k years earlier
  - Arizona State Univ. news — "Oldest spear points date to 500,000 years" (https://news.asu.edu/content/oldest-spear-points-date-500000-years) — same, from the study's own institution
  - Wilkins et al. response to Rots & Plisson, *J. Archaeological Science* (https://www.sciencedirect.com/science/article/abs/pii/S0305440314004567) — documents the dispute
  - Leder et al. 2025, *Science Advances* — "Revised age for Schöningen hunting spears…" (https://www.science.org/doi/10.1126/sciadv.adv0752) plus Mainz Univ. press release (https://press.uni-mainz.de/age-of-schoningen-spears-revised-to-200000-years/) — the Schöningen redate to ~200k
- **Best "Somebody Did It First" angle:** "Spears were a modern-human invention" gives way to "pre-sapiens humans may have been making stone-tipped spears half a million years ago." Also: "the 'world's oldest spears' at Schöningen turned out 100,000 years younger, and Neanderthal-made." There is no single wrongly credited person.
- **Fit score:** 3/5 — "earlier than you think," with a good myth-bust (the Schöningen redate), but nobody famous got the credit.

### 15. Sword — Fit 2/5
- **Planned fun fact:** Oldest swords are arsenic-copper blades from Arslantepe, Turkey, ~3300 BCE. (Also 2020 San Lazzaro monastery Venice discovery.)
- **Verdict:** Confirmed
- **Corrected / on-air version:** "The oldest known swords come from the palace at Arslantepe in eastern Turkey, around 3300 BCE. They're made of arsenical copper, before true tin bronze existed, and are up to about 60 cm long, some inlaid with silver. In 2020, researchers announced a 'twin' of those blades. It had been sitting in a display case of medieval objects at the Armenian monastery of San Lazzaro in Venice. A PhD student spotted it in 2017, and metal analysis matched it to Anatolian swords about 5,000 years old."
- **Confirmed vs. inferred vs. unknown:**
  - *Confirmed:* the Arslantepe cache of 9 swords/daggers from the 1980s Frangipane (Sapienza, Rome) excavations, dated ~3300 BCE, arsenical copper.
  - *Confirmed:* the Venice sword. Vittoria Dall'Armellina (Ca' Foscari) spotted it in 2017, announced in 2020; arsenical copper; reached Venice from Trabzon in the late 19th century.
  - *Unknown:* the Venice sword's exact findspot. Its date is by comparison, not stratigraphy, so say "about 5,000 years old."
- **Sources:**
  - Ca' Foscari University of Venice — "5000 year-old sword discovered in an Armenian Monastery in Venice" (https://www.unive.it/pag/16584/?tx_news_pi1%5Bnews%5D=8707) — Venice sword; comparison to Arslantepe
  - Archaeology Magazine (AIA) — "Rare 5,000-Year-Old Sword Identified in Venice" (https://archaeology.org/news/2020/03/02/200303-venice-anatolia-sword/) — same
  - Live Science — "Student discovers 5,000-year-old sword hidden in Venetian monastery" (https://www.livescience.com/ancient-anatolian-sword-in-venetian-monastery.html) — arsenical copper; Trabzon provenance
  - Arslantepe ~3300 BCE: I found only secondary extracts this session (Ancient Origins; Wikipedia's "Sword" page). The Ca' Foscari and AIA pieces both anchor the Arslantepe comparison, which gives two institutional mentions. UNESCO's Arslantepe Mound inscription (2021) would be a good third citation (not fetched).
- **Best "Somebody Did It First" angle:** Weak. The best hook is the mislabeled sword: a monastery had one of the world's oldest swords filed as "medieval" for 100+ years. A softer version: the sword is usually pictured as Bronze Age Greek or Iron Age, but it starts in an Anatolian palace before bronze.
- **Fit score:** 2/5 — mostly an "oldest X" fact. The Venice twist adds charm but no wrongly credited inventor.

### 16. Armor — Fit 2/5
- **Planned fun fact:** Egyptian soldiers ~3100 BCE wore layered linen armor.
- **Verdict:** Wrong (cut the Egypt-3100-BCE line)
- **Corrected / on-air version:** "The earliest body armor we can see is from Sumer. The Standard of Ur, around 2500 BCE, shows spearmen in cloaks studded with metal discs, and soldiers buried in Ur's royal tombs wore copper helmets. The oldest complete suit of armor ever found is the Dendra panoply from Greece, about 1450–1400 BCE: 15 bronze plates laced together, neck to knees. In Egypt, real body armor shows up much later, in the New Kingdom, as bronze scale coats for charioteers."
- **Confirmed vs. inferred vs. unknown:**
  - *Not supported:* Egyptian layered linen armor in 3100 BCE. I found no evidence for it.
  - *Confirmed:* the Metropolitan Museum and History.com say body armor in Egypt is a New Kingdom development (scale armor shown in Amenhotep II's era, ~1430s BCE). Ordinary New Kingdom foot soldiers may have worn stiffened textile at most.
  - *Likely source of the confusion* **[prior knowledge, not re-verified]:* Herodotus says Pharaoh Amasis II (6th century BCE) sent famous linen corslets as gifts to Lindos and Sparta. That gives "Egyptian linen armor," but ~2,500 years later than claimed.
  - *Confirmed:* Dendra panoply ~1450–1400 BCE, oldest intact full set.
  - *Inferred:* Standard of Ur "studded cloaks" as the first depiction of body armor. This is the standard reading, but I only saw it in secondary extracts.
- **Sources:**
  - Metropolitan Museum of Art — Scale from Armor, New Kingdom (https://www.metmuseum.org/art/collection/search/577195) — Egyptian armor is New Kingdom, scale type
  - History.com — "9 Ancient Egyptian Weapons and Tools…" (https://www.history.com/articles/ancient-egyptian-weapons) — common soldiers barely armored; charioteers in bronze scale
  - ScienceDaily / PLOS ONE (2024) — Dendra armour combat study (https://www.sciencedaily.com/releases/2024/05/240522225154.htm; https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11111059/) — Dendra ~3,500 years old, full-body bronze
  - Standard of Ur: only secondary/Wikipedia extracts found; cite the British Museum object page before air (not fetched).
- **Best "Somebody Did It First" angle:** Weak. The best framing: "You picture a medieval knight in plate armor. Bronze Age Greeks had full-body plate about 2,800 years before him." That is an "earlier than you think" story, not a stolen-credit one.
- **Fit score:** 2/5 — the original fact is wrong, and the corrected story has no wrongly credited person. Consider swapping this slot.

### 17. Bow — Fit 3/5
- **Planned fun fact:** Arrowheads 70,000+ years old (Sibudu, Lombard); Sri Lanka bone arrow points ~48,000 years ago (Fa-Hien Lena, Langley et al. 2020), oldest confirmed outside Africa.
- **Verdict:** Needs correction
- **Corrected / on-air version:** "The earliest likely arrowheads come from Sibudu Cave in South Africa, about 64,000 years old, and some carry traces suggesting poison. Outside Africa, the record moved in 2023. Tiny stone points from Grotte Mandrin in France, about 54,000 years old, look like arrowheads shot by some of the first modern humans in Europe. That beats the 48,000-year-old bone arrow points from Fa-Hien Lena in Sri Lanka, which held the title in 2020."
- **Confirmed vs. inferred vs. unknown:**
  - *Correct "70,000+" to ~64,000 years* for Sibudu stone points (bone point ~61,000).
  - *Why "70,000+" turns up:* the ~71,000-year-old heat-treated bladelets at Pinnacle Point (Brown et al. 2012, *Nature*). Those suggest advanced projectiles (spear-thrower *or* bow), not confirmed arrows.
  - *Fa-Hien Lena:* the 48,000-year date was correct as "earliest outside Africa" in June 2020, but it is now **superseded** by Grotte Mandrin, ~54,000 years (Metz et al., *Science Advances*, 22 Feb 2023).
  - *Inferred:* every pre-Holocene "bow" claim rests on point size and impact damage. No bows survive that old. Say "likely" or "evidence suggests."
  - *Also out there:* a 2025/26 *Science Advances* paper reports direct chemical evidence of poison on ~60,000-year-old microlithic arrowheads in southern Africa. I saw only the title, so verify it before citing.
- **Sources:**
  - Metz et al. 2023, *Science Advances* — "Bow-and-arrow, technology of the first modern humans in Europe 54,000 years ago at Mandrin, France" (https://www.science.org/doi/10.1126/sciadv.add4675) — Mandrin, 54k
  - Smithsonian — "Archery May Have Arrived in Europe Thousands of Years Earlier Than Thought" (https://www.smithsonianmag.com/smart-news/archery-may-have-arrived-in-europe-thousands-of-years-earlier-than-thought-180981690/) — same
  - Langley et al. 2020, *Science Advances* (https://www.science.org/doi/10.1126/sciadv.aba3831) and Phys.org (https://phys.org/news/2020-06-year-old-arrowheads-reveal-early-human.html) — Fa-Hien Lena, 48k
  - Brown et al. 2012, *Nature* — "An early and enduring advanced technology originating 71,000 years ago" (https://www.nature.com/articles/nature11660) — Pinnacle Point
  - Sibudu 64k: Lombard's work; I saw only Wikipedia/ResearchGate extracts this session. Cite Lombard & Phillipson 2010, *Antiquity* (not fetched).
- **Best "Somebody Did It First" angle:** "Archery came to Europe with the Neolithic/Mesolithic." In fact the first Homo sapiens in Europe may have brought bows about 40,000 years earlier, and some argue that helped them over Neanderthals. The Sri Lanka record falling to France is a nice twist of its own.
- **Fit score:** 3/5 — strong "earlier than you think," with a record that changed hands, but no wrongly credited person.

### 18. Gunpowder — Fit 4/5
- **Planned fun fact:** Tang Dynasty alchemists discovered it while seeking an immortality elixir.
- **Verdict:** Confirmed (with a hedge)
- **Corrected / on-air version:** "Gunpowder was almost certainly discovered by Chinese alchemists, probably in the 9th century under the late Tang, while they experimented with elixir ingredients like saltpeter and sulfur. One mid-800s Daoist text even warns that mixing these has burned people's faces and burned down houses. The first actual written recipe comes in a Song military manual, the Wujing Zongyao, in 1044."
- **Confirmed vs. inferred vs. unknown:**
  - *Confirmed:* Chinese alchemists, ~9th century (Britannica; History.com gives ~850 CE).
  - *Confirmed:* the Wujing Zongyao (1044) holds the earliest known formula.
  - *Inferred:* "While seeking an elixir of immortality" is the consensus and is plausible, since saltpeter and sulfur were elixir-lab staples. But no text records anyone looking for immortality and finding gunpowder. The mid-9th-century *Zhenyuan miaodao yaolüe* is a warning about dangerous mixtures, not a discovery account. Use "while experimenting with elixir ingredients," not a dramatic eureka scene.
  - *Note:* History.com's quote calls the early writer "a Chinese Buddhist alchemist," but the *Zhenyuan* text is Daoist, so don't repeat "Buddhist."
- **Sources:**
  - Britannica — "Gunpowder" (https://www.britannica.com/technology/gunpowder) — 9th-century Chinese alchemists; ~75:15:10 composition; early use in fireworks and signals
  - History.com — "Firearms" / fireworks history (https://www.history.com/articles/firearms; https://www.history.com/articles/fireworks-vibrant-history) — ~850 CE, alchemists seeking an elixir of life
  - Smithsonian — "14 Fun Facts About Fireworks" (https://www.smithsonianmag.com/arts-culture/14-fun-facts-about-fireworks-180951957/) — elixir framing (extract only)
  - Wujing Zongyao 1044: Clemson open textbook (https://opentextbooks.clemson.edu/sciencetechnologyandsociety/chapter/gunpowder-in-medieval-china/) plus Wikipedia leads. Needham, *Science and Civilisation in China* vol. 5 pt. 7, is the canonical citation (not fetched).
- **Best "Somebody Did It First" angle:** European tradition credited gunpowder to Roger Bacon (who recorded a recipe ~1267) or the legendary German monk "Black Berthold" (Berthold Schwarz, 14th c.) **[prior knowledge, not re-verified]**. China had it roughly 400 years earlier, with a printed recipe by 1044. Bacon is famous and Berthold is a fun myth, so this is hooky.
- **Fit score:** 4/5 — a real wrongly credited European name (Bacon or Berthold) against a documented earlier origin. Check the Bacon/Berthold details before scripting.

### 19. Gun — Fit 4/5
- **Planned fun fact:** China's 10th-century fire lance was the first gun.
- **Verdict:** Disputed
- **Corrected / on-air version:** "The first gunpowder weapon we can actually see is on a Chinese silk banner from Dunhuang, around 950 CE: a demon pointing a flaming tube on a pole at the Buddha. That's a fire lance, basically a gunpowder flamethrower on a spear. Historians call it the ancestor of the gun, a 'proto-gun,' but not a true gun, because it didn't fire a bullet that fit the barrel. The oldest surviving metal guns are Chinese too: the Heilongjiang hand cannon, no later than 1288, and the Xanadu gun, inscribed with the year 1298."
- **Confirmed vs. inferred vs. unknown:**
  - *Confirmed:* the Dunhuang banner, c. 950, is the earliest depiction of a gunpowder weapon. The next mention of fire lances is the 1132 siege of De'an.
  - *Disputed:* "first gun." Tonio Andrade (*The Gunpowder Age*, Princeton 2016) defines a "true gun" as firing a bore-fitting projectile, which excludes the fire lance. Britannica calls the early tube weapons a "proto-gun."
  - *Confirmed:* Xanadu gun, 1298, is the oldest gun with a dated inscription.
  - *Inferred:* Heilongjiang "no later than 1288" rests on its archaeological context (no inscription). Wuwei bronze cannon, c. 1214–1227, is also contextual and debated; Chen Bingying argues for no guns before 1259.
- **Sources:**
  - Britannica — "Gunpowder" (https://www.britannica.com/technology/gunpowder) — "proto-gun" channeling gunpowder through a cylinder; 13th-century bamboo tubes firing projectiles
  - Archaeology Magazine (AIA) — "Weapons of the Ancient World – Fire Lances and Cannons" (https://archaeology.org/issues/may-june-2020/collection/fire-lances-cannons/weapons-of-the-ancient-world/) — fire lance as a proto-gun by ~1150
  - Andrade, *The Gunpowder Age* (Princeton UP, 2016), via extracts — "true gun" definition
  - Dunhuang banner c. 950 and the Heilongjiang/Xanadu/Wuwei details: only Wikipedia and secondary extracts this session. The banner is in the Musée Guimet, Paris **[prior knowledge, not re-verified]**. Needham vol. 5 pt. 7 is the scholarly anchor (not fetched).
- **Best "Somebody Did It First" angle:** "Guns are a European invention," with the hand cannons and arquebuses of the 1300s–1400s. China had metal guns by the late 1200s, and Europe's first gun illustration (Walter de Milemete manuscript, 1326) is about 28 years after the dated Xanadu gun **[prior knowledge, not re-verified]**. That's strong if hedged as "China had metal guns first," not "the fire lance was the first gun."
- **Fit score:** 4/5 — a clear, well-documented "China first" story. The "first gun" wording must be hedged.

### 20. Rifle — Fit 2/5
- **Planned fun fact:** Rifling likely from German gunsmiths Kollner and Kotter ~1500, originally "soot grooves."
- **Verdict:** Disputed
- **Corrected / on-air version:** "Rifling, the spiral grooves that spin a bullet, appeared in German-speaking Europe around 1500. The oldest rifled guns that can be dated with confidence belonged to Emperor Maximilian I, used between 1493 and 1508. Gun histories often credit Gaspard Kollner of Vienna, around 1498, and August Kotter of Nuremberg, around 1520. Honestly, though, nobody knows who really invented it, and the stories about those two men don't agree."
- **Confirmed vs. inferred vs. unknown:**
  - *Confirmed (roughly):* rifling arose in Germany/Austria in the late 1400s. Datable early examples bear Maximilian I's arms (1493–1508); I found this in a search extract that seems to come from Britannica's rifling entry, so verify the attribution.
  - *Unknown:* whether "Kotter" and "Kollner" are reliably documented individuals. The names come from 19th- and 20th-century firearms literature, and I found no primary documents. Sources contradict each other: American Rifleman says "1498, August Kotter, Augsburg," while others say "Kollner, Vienna, 1498" and "Kotter, Nuremberg, 1520," and some say Kollner's grooves were straight. Don't present either man as established fact.
  - *Unverified:* "soot grooves." The idea that early straight grooves collected powder fouling is a common explanation, but I couldn't source it to an institution. Cut it, or hedge it as "one theory is…"
- **Sources:**
  - Britannica — "Rifling" (https://www.britannica.com/technology/rifling) — German/Austrian origin ~1450–1500; Maximilian I examples (attribution via search extract)
  - NRA American Rifleman — "Back To Basics: Rifling" (https://www.americanrifleman.org/content/back-to-basics-rifling/) — Augsburg 1498, Kotter (shows how inconsistent the story is)
  - NRA Museum — "A Brief History of Firearms" (https://www.nramuseum.org/gun-info-research/a-brief-history-of-firearms.aspx) — general context
  - Only one strong institutional source (Britannica). Kollner/Kotter are not independently confirmed.
- **Best "Somebody Did It First" angle:** Weak. The honest version is "nobody knows who invented it," plus a myth-bust of the rifle as an American frontier invention: the "Kentucky rifle" descends from German Jäger rifles, and rifling is ~250 years older than the American Revolution. That could support an "earlier than you think" episode.
- **Fit score:** 2/5 — no solidly documented first inventor. Consider replacing, or folding it into Ep. 19 (Gun).

### 21. Artillery — Fit 4/5
- **Planned fun fact:** Traction trebuchet in China 5th–3rd century BCE; counterweight version ~1,500 years later.
- **Verdict:** Needs correction (minor, but it adds the best twist)
- **Corrected / on-air version:** "The trebuchet, that icon of medieval European sieges, started in China between the 5th and 3rd centuries BCE as a 'traction' machine hauled by teams of people pulling ropes. It spread across Eurasia and reached the Mediterranean by the 6th century CE. The counterweight trebuchet came about 1,500 years after the first one, in the 12th century, and it came from the Byzantine and Islamic world, not China. China only got it in the 1270s, when Muslim engineers built them for Kublai Khan's siege of Xiangyang."
- **Confirmed vs. inferred vs. unknown:**
  - *Confirmed:* China, 5th–3rd century BCE; spread to the Mediterranean by the 6th century CE (Britannica).
  - *Confirmed:* the counterweight type is 12th century, eastern Mediterranean/Middle East. Paul Chevedden's "The Invention of the Counterweight Trebuchet: A Study in Cultural Diffusion" (*Dumbarton Oaks Papers*); the earliest written record is Byzantine historian Niketas Choniates.
  - *Confirmed (secondary):* the counterweight type was introduced to China ~1272–73 at Xiangyang. The Muslim engineers Ismail and Ala al-Din are in Chinese sources **[names from prior knowledge, not re-verified]**.
  - The "~1,500 years later" figure works arithmetically (4th c. BCE to 12th c. CE).
- **Sources:**
  - Britannica — "Trebuchet" (https://www.britannica.com/technology/trebuchet) — Chinese origin 5th–3rd c. BCE; traction vs. counterweight; 6th-c. spread
  - Chevedden, "The Invention of the Counterweight Trebuchet: A Study in Cultural Diffusion," *Dumbarton Oaks Papers* (https://www.jstor.org/stable/1291833) — 12th-century Byzantine/Islamic origin of the counterweight
  - Journal of Medieval Military History (Cambridge) — "Hybrid or Counterpoise? A Study of Transitional Trebuchets" (https://www.cambridge.org/core/books/abs/journal-of-medieval-military-history/hybrid-or-counterpoise-a-study-of-transitional-trebuchets/C0C7B696549B0D972CA09E6D0715F5B2) — transitional forms
- **Best "Somebody Did It First" angle:** The trebuchet is "medieval European," but China had it about 1,500 years before the castles of Monty Python fame. The boomerang twist: the souped-up counterweight version went *back* to China via Islamic engineers. It's well documented, with a two-way credit story.
- **Fit score:** 4/5 — a strong popular misconception (European) against a solid earlier origin (China), plus the reverse-credit twist.

### 22. Castle — Fit 2/5
- **Planned fun fact:** Citadel of Aleppo fortified for ~5,000 years.
- **Verdict:** Needs correction
- **Corrected / on-air version:** "People have been building on the Citadel hill in Aleppo for nearly 5,000 years. A temple to the storm god stood there in the third millennium BCE. It became a fortified acropolis by Hellenistic times, around 300 BCE, so it's been a fortress for over 2,000 years. Most of the castle you see today was built by Saladin's son, al-Zahir Ghazi, around 1200, and by the Mamluks after him."
- **Confirmed vs. inferred vs. unknown:**
  - *Confirmed:* use of the hill dates to the 3rd millennium BCE (Storm-god Hadad temple, mentioned in the Ebla archives). Britannica and Archnet/Aga Khan Trust both say so.
  - *Not supported:* "fortified for 5,000 years." The early evidence is a temple, not fortifications. Medieval Arab historians date the fortified acropolis to Seleucus I (c. 300 BCE), which is traditional and uncertain.
  - *Confirmed:* the current fabric is mostly Ayyubid (al-Zahir Ghazi, r. 1193–1215) and Mamluk.
  - *Unknown:* whether Bronze Age fortifications existed on the hill.
- **Sources:**
  - Britannica — "Aleppo" (https://www.britannica.com/place/Aleppo) — Ebla mention, Storm-god temple on the citadel hill, 3rd millennium BCE
  - Archnet / Aga Khan Trust for Culture — Aleppo Citadel Restoration; AKTC Citadel guide (https://www.archnet.org/sites/6414; https://akdn.org/publication/aga-khan-trust-culture-citadel-aleppo-description-history-site-plan-visitor-tour-syria) — "usage of the hill dates back at least to the middle of the 3rd millennium BC"; Ayyubid fabric
  - UNESCO WHC — Ancient City of Aleppo (https://whc.unesco.org/en/soc/4007/) — World Heritage status, 1986
- **Best "Somebody Did It First" angle:** The "first castle" story is weak and contested. In Europe, the keep at Doué-la-Fontaine in France (c. 950) is often cited as the oldest surviving stone castle keep (I found only Wikipedia-level sources). Another possible angle, "the Normans brought castles to England in 1066, but Norman favorites of Edward the Confessor built some in the 1050s" **[prior knowledge, not re-verified]**, needs real sourcing.
- **Fit score:** 2/5 — mostly an "oldest X" fact, with no clean credited-vs-first story. Consider replacing.

### 23. Warship — Fit 3/5
- **Planned fun fact:** Phoenician rowing warships ~850 BCE; USS Constitution (1797) oldest warship afloat.
- **Verdict:** Needs correction
- **Corrected / on-air version:** "The Phoenicians developed the bireme, a two-banked oared warship with a ram, around 800 BCE. Assyrian palace reliefs from about 700 BCE show them in action. USS Constitution, launched in 1797, is the oldest commissioned warship afloat. That word 'afloat' matters. Britain's HMS Victory, launched in 1765, is older and still in commission, but it has sat in dry dock since 1922. Even Constitution's own crew jokes about the technicality."
- **Confirmed vs. inferred vs. unknown:**
  - *Confirmed:* Constitution was launched 21 Oct 1797 and is the oldest commissioned warship afloat (Britannica, USNI). Victory was launched 1765, is still commissioned, and has been in dry dock since 1922.
  - *Confirmed (secondary):* the Phoenician bireme dates to c. 800 BCE and appears in Sennacherib-era reliefs (c. 700–692 BCE; World History Encyclopedia image entry).
  - *Needs care:* Phoenicians were not the first warships. Egypt's Medinet Habu reliefs show a naval battle against the Sea Peoples c. 1175 BCE **[prior knowledge, not re-verified]**, so "~850 BCE" only works for the bireme. Don't imply first warships.
- **Sources:**
  - Britannica — "Constitution (ship)" (https://www.britannica.com/topic/Constitution-ship) — launched 1797; oldest commissioned warship afloat
  - USNI News — "Onboard America's Oldest Warship" (https://news.usni.org/2014/07/21/photo-essay-onboard-americas-oldest-warship) — same
  - Washington Post opinion — "Oldest commissioned warship? Try again" (https://www.washingtonpost.com/opinions/oldest-commissioned-warship-try-again/2017/08/04/2fb29502-7708-11e7-8c17-533c52b2f014_story.html) — Victory vs. Constitution
  - USS Constitution official Facebook post acknowledging Victory (https://m.facebook.com/ussconstitutionofficial/photos/a.165972651740/10158098996386741/) — a primary self-statement, good on-air color
  - World History Encyclopedia — Phoenician-Assyrian Warship (https://www.worldhistory.org/image/6990/phoenician-assyrian-warship/) — bireme relief. Only one decent source for the Phoenician date; British Museum Nineveh relief pages would firm it up.
- **Best "Somebody Did It First" angle:** "America's Old Ironsides is the world's oldest warship," but HMS Victory is 32 years older and still commissioned. Constitution wins only on "afloat." It's a fun pedantry hook, though it's oldest-surviving rather than invention.
- **Fit score:** 3/5 — a decent framed myth-bust (Victory vs. Constitution), but not a did-it-first invention story.

### 24. Explosives — Fit 4/5
- **Planned fun fact:** Nobel's premature obituary ("merchant of death") led to the Nobel Prize.
- **Verdict:** Disputed
- **Corrected / on-air version:** "Here's the story everyone tells. In 1888, Alfred Nobel's brother Ludvig died in Cannes, a French paper thought it was Alfred, and it ran an obituary calling him 'the merchant of death.' Shaken, Alfred rewrote his will and created the Nobel Prizes. It's a great story. The problem is that historians have never found a copy of that obituary. Ludvig really did die in 1888, and newspapers did confuse the brothers, but the 'merchant of death' headline, and the claim that it inspired the prizes, can't be confirmed. And Nobel didn't discover nitroglycerin. An Italian chemist, Ascanio Sobrero, did in 1847. He thought it was too dangerous to use and was horrified by what came next."
- **Confirmed vs. inferred vs. unknown:**
  - *Confirmed:* Ludvig Nobel died in 1888.
  - *Confirmed:* Sobrero discovered nitroglycerin in 1847 in Turin (some sources say 1846) and judged it too dangerous for practical use.
  - *Confirmed:* Nobel patented dynamite in 1867 (nitroglycerin plus kieselguhr) and publicly credited Sobrero.
  - *Disputed:* the "merchant of death" obituary. History.com and Britannica both say no original copy has been found. Nobel biographer Kenne Fant reportedly said so too (via secondary extract). Some writers say a real notice existed with milder wording, but I couldn't verify that from a strong source.
  - *Unknown:* whether any such obituary influenced the 1895 will. Nobelprize.org's own Nobel biography pages turned up nothing about the obituary in searches, which is telling.
- **Sources:**
  - History.com — "Did a Premature Obituary Inspire the Nobel Prize?" (https://www.history.com/articles/did-a-premature-obituary-inspire-the-nobel-prize) — tells the story and notes no original copy found; some historians call it myth
  - Britannica — "Why was Alfred Nobel called 'the merchant of death'?" (https://www.britannica.com/question/Why-was-Alfred-Nobel-called-the-merchant-of-death) — addresses the legend
  - NobelPrize.org — "Ascanio Sobrero" (https://www.nobelprize.org/alfred-nobel/ascanio-sobrero/) — Sobrero discovered nitroglycerin in 1847; Nobel credited him
  - Smithsonian — "The Man Who Invented Nitroglycerin Was Horrified By Dynamite" (https://www.smithsonianmag.com/smart-news/man-who-invented-nitroglycerin-was-horrified-dynamite-180965192/) — Sobrero's reaction
  - ACS — "Nitroglycerin" Molecule of the Week (https://www.acs.org/molecule-of-the-week/archive/n/nitroglycerin.html) — Sobrero 1847
  - Caution: Smithsonian's older piece "Blame Sloppy Journalism for the Nobel Prizes" (https://www.smithsonianmag.com/smart-news/blame-sloppy-journalism-for-the-nobel-prizes-1172688/) repeats the legend uncritically. Don't treat it as confirmation.
- **Best "Somebody Did It First" angle:** Two layers. (1) Nobel gets the credit for the explosive, but Sobrero discovered nitroglycerin 20 years before dynamite. Well documented, and NobelPrize.org itself says so. (2) A myth-bust of the famous "merchant of death" origin story. Both are strong.
- **Fit score:** 4/5 — a famous name, a documented earlier discoverer (Sobrero), and a bonus myth-bust. It falls short of 5 only because Nobel never claimed to discover nitroglycerin.

### 25. Tank — Fit 4/5
- **Planned fun fact:** Britain's Little Willie (1915), never saw combat, oldest surviving tank. (Also: Lancelot de Mole, da Vinci.)
- **Verdict:** Confirmed (Little Willie). The de Mole angle checks out, with nuance.
- **Corrected / on-air version:** "Little Willie, built in 1915 by William Tritton and Walter Wilson, was the first tank prototype ever completed. It never saw combat, and it's the oldest surviving tank, now at the Tank Museum in Bovington. But three years earlier, in 1912, a South Australian engineer named Lancelot de Mole sent the British War Office plans for a tracked armored vehicle that could cross trenches. They shelved it. After the war, a Royal Commission on inventors said that if his design had been taken up, Britain might have had a better tank, sooner. It also found his design had no influence on the tanks Britain actually built. He got about £965 for his expenses and a CBE."
- **Confirmed vs. inferred vs. unknown:**
  - *Confirmed:* Little Willie was built in 1915, was the first completed tank prototype, never fought, and survives at Bovington.
  - *Confirmed:* de Mole conceived it in 1911, sent his design to the War Office in 1912 where it was rejected, and resubmitted in 1915.
  - *Confirmed:* in 1917 a model was built in Melbourne; it went to England, was misplaced for about six weeks, and is now at the Australian War Memorial.
  - *Confirmed:* the 1919 Royal Commission on Awards to Inventors found **no evidence** his work influenced British tanks, and awarded £965 for expenses (ADB figure; one secondary source says £987, so use £965). He was appointed CBE in 1920.
  - *Correct a secondary-source error:* one extract dates the Commission to "1929." It was 1919.
  - *Inferred:* the "far better tank, much earlier" praise is widely quoted from the Commission's findings. Quote it carefully, ideally from the Commission text.
  - *Da Vinci (prior knowledge):* his c. 1487 armored-vehicle sketch was wheeled and hand-cranked, never built, and is unrelated to tracks. It works as a fun aside, not a "first."
- **Sources:**
  - Australian Dictionary of Biography (ANU) — "de Mole, Lancelot Eldin" (https://adb.anu.edu.au/biography/de-mole-lancelot-eldin-5950) — 1911 idea, 1912 submission, 1915 resubmission, 1917 model, Commission findings, £965, CBE
  - Australian War Memorial — "Model prototype De Mole Tank" (https://www.awm.gov.au/collection/RELAWM01900) — the surviving 1917 model
  - State Library of South Australia — letter about de Mole's claim (https://digital.collections.slsa.sa.gov.au/nodes/view/2461) — primary archival item
  - Little Willie: the Tank Museum, Bovington, is the authority, but I saw only Wikipedia and secondary extracts this session. Cite tankmuseum.org before air.
- **Best "Somebody Did It First" angle:** "Britain invented the tank (Tritton, Wilson, Swinton, Churchill's Landships Committee)." Lancelot de Mole designed one in 1912, was rejected, and was later officially praised. The evidence is solid, with the honest caveat that his design didn't feed into the real tank. Austrian officer Gunther Burstyn's 1911 *Motorgeschütz* design, also rejected, is a second "did it first" candidate **[prior knowledge, not re-verified]**.
- **Fit score:** 4/5 — a classic ignored-inventor story with archival backing. Not a 5 because the British designers aren't household names, and the Commission found no influence.

### 26. Military Communication — Fit 3/5
- **Planned fun fact:** SOS doesn't stand for anything, chosen for its simple Morse pattern; adopted by Germany 1905 (internationally 1906 Berlin convention, effective 1908).
- **Verdict:** Confirmed
- **Corrected / on-air version:** "SOS doesn't stand for 'Save Our Souls' or anything else. It was chosen because three dots, three dashes, three dots is impossible to mistake. Germany put it into its radio regulations on April 1, 1905. The 1906 International Radiotelegraph Convention in Berlin adopted it worldwide, effective July 1, 1908. Even so, Marconi operators kept using their company's own call, CQD, for years. On the Titanic in 1912, the operators sent CQD first and then switched to SOS."
- **Confirmed vs. inferred vs. unknown:**
  - *Confirmed:* German regulations effective 1 Apr 1905; Berlin convention signed 3 Nov 1906, effective 1 Jul 1908.
  - *Confirmed:* both texts specify a continuous 3-dot/3-dash/3-dot signal with no letter meaning. "Save Our Souls" and similar are later folk backronyms.
  - *Unverified this session:* the Titanic CQD-then-SOS sequence, and "first SOS used in 1909 (Slavonia/Arapahoe)." Both are **[prior knowledge, not re-verified]**; the search budget ran out. The Titanic detail is very widely documented, but get an institutional cite (e.g., Library of Congress or Smithsonian) before air.
- **Sources:**
  - Thomas H. White, "Distress Signalling (1913)," Early Radio History (https://www.earlyradiohistory.us/1913dist.htm) — a well-regarded specialist history (WebFetch blocked; seen in the search listing only)
  - 1906 International Radiotelegraph Convention text: dates and signal spec via Wikipedia extracts that quote the convention. The ITU's historical collection holds the official text (not fetched).
  - **Only one strong source could be confirmed this session.** Add ITU/Smithsonian/LoC before marking it final.
- **Best "Somebody Did It First" angle:** Marconi's CQD was the famous British/Marconi distress call, but Germany's SOS was the official international standard four years before Titanic. Marconi's operators clung to CQD anyway. The "SOS = Save Our Souls" myth-bust adds a second hook.
- **Fit score:** 3/5 — a good myth-bust and a Germany-vs-Marconi rivalry, but no single wrongly credited inventor. (Who chose SOS is itself obscure.)

---

#### Batch notes

**Weak slots to consider replacing:** 15 (Sword), 16 (Armor), 20 (Rifle), 22 (Castle). Possible stronger did-it-first substitutes in this quarter's theme:
- Sobrero vs. Nobel as its own episode
- Burstyn and de Mole vs. the British tank
- Bacon/"Black Berthold" vs. China on gunpowder
- Fold Rifle into Gun

---

## Quarter 3: Moving, Making and Communicating (episodes 27–39)

> **READ FIRST: how much of this was checked.**
> - **Episodes 27–29 were web-checked**, but only through search-engine extracts of the pages, not full reads. WebFetch and curl were blocked: asce.org, wikipedia.org, si.edu and britannica.com all returned EGRESS_BLOCKED or a proxy 403.
> - **Episodes 30–39 were NOT web-checked in this pass.** Partway through episode 29, every WebSearch call came back "session has used its web search budget (200 of 200)". That budget is shared across the whole session, and nothing else could reach the web.
> - The 30–39 entries are written from my own knowledge of the history. Each one says exactly what still has to be checked before the script locks.
> - The verdicts for 30–39 are my best call, but treat them as **provisional**. Nothing in 30–39 counts as "Confirmed" under the two-source rule until someone re-runs the checks.
> - Source URLs in 30–39 are written from memory. Most are stable institutional pages, but check each link before citing it.
> - If more searches are needed, the user can raise `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`, or 30–39 can be re-run in a fresh session.

---

### 27. Wheel — Fit 3/5
- **Planned fun fact:** The first wheels were potter's wheels in Mesopotamia around 3500 BCE, about 300 years before cart wheels.
- **Verdict:** Needs correction
- **Corrected / on-air version:** "The wheel's first known job wasn't moving things. It was spinning clay. Mesopotamian potters were working on turntables by about 3500 BCE, and slow 'tournette' wheels go back even earlier. Wheeled carts show up around the same time, around 3500–3300 BCE, from Poland to Iraq. And the oldest actual wheel-and-axle ever found isn't from Mesopotamia at all. It came out of a bog in Slovenia and is about 5,150 years old."
- **Confirmed vs. inferred vs. unknown:**
  - **Confirmed:** Potter's wheels or turntables were in use in Mesopotamia by about 3500 BCE (Britannica, Live Science).
  - **Confirmed:** Wheeled-vehicle images are dated to about 3500–3350 BCE. These are the Bronocice pot from Poland and a Sumerian pictograph of a sledge on wheels from about 3500 BCE.
  - **Confirmed:** The Ljubljana Marshes wheel and axle date to about 3340–3030 BCE, roughly 5,150–5,200 years ago. It is held by the City Museum of Ljubljana.
  - **The "300 years" figure is the problem.** It traces to one Smithsonian Magazine line: potter's wheels came "300 years before they were used for chariots." Chariots (spoked, horse-drawn) arrive around 2000 BCE, so that line is muddled, and it does not support "300 years before cart wheels." The dates for potter's wheels and the first carts overlap.
  - **Inferred:** The slow tournette goes back to about 4500 BCE (Ubaid period). That date came only from Wikipedia and blogs in my searches, so hedge it as "even earlier."
  - **Unknown:** Where the wheeled vehicle was first invented (Mesopotamia, the steppe, or Central Europe) is still debated. A 2024 modeling study argues for copper-mine carts in the Carpathians around 3900 BCE. That is a hypothesis, not a find.
- **Sources:**
  - Smithsonian Magazine — "A Salute to the Wheel" (https://www.smithsonianmag.com/science-nature/a-salute-to-the-wheel-31805121/). Where the "3500 B.C. … 300 years before chariots" line comes from. Note that it says *chariots*, not carts.
  - Live Science — "Why It Took So Long to Invent the Wheel" (https://www.livescience.com/18808-invention-wheel.html). Wheel-and-axle around 3500 BCE, and the wheel as an "all-or-nothing" invention (Richard Bulliet's argument).
  - Britannica / Britannica Students — "Potter's wheel"; "wheel" (https://www.britannica.com/art/potters-wheel ; https://kids.britannica.com/students/article/wheel/277721). Pottery turntable in Mesopotamia by 3500 BC, and the Sumerian pictograph of a wheeled sledge from about 3500 BC.
  - City Museum of Ljubljana (MGML) — "The Wheel: 5,200 years" (https://mgml.si/en/city-museum/exhibitions/211/the-wheel-5200-years/). Oldest wooden wheel with an axle: ash wheel, oak axle, found in 2002 by ZRC SAZU.
  - Live Science / Royal Society Open Science (Alacoque, James & Bulliet 2024) (https://www.livescience.com/archaeology/1st-wheel-was-invented-6-000-years-ago-in-the-carpathian-mountains-modeling-study-suggests ; https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11529624/). The Carpathian copper-miner hypothesis, about 3900 BCE.
- **Best "Somebody Did It First" angle:**
  - Myth: "Mesopotamia invented the wheel for carts."
  - Reality: the wheel's first job was making pots, and the oldest surviving wheel-and-axle is European (Slovenia).
  - There is no single wrongly credited person. It works best as an "earlier and weirder than you think" episode.
- **Fit score:** 3/5 — A good myth-bust, but there is no famous name to dethrone. Drop the "300 years" line.

### 28. Road — Fit 3/5
- **Planned fun fact:** The oldest paved road is in Egypt, from 2600–2200 BCE, built to haul basalt from a quarry (Widan el-Faras, near Lake Moeris in the Faiyum) for royal sarcophagi.
- **Verdict:** Needs correction
- **Corrected / on-air version:** "The oldest known paved road is in Egypt's Faiyum desert, about 4,500 years old, from the age of the pyramids. It ran about 11–12 km from a basalt quarry to a dock on ancient Lake Moeris. Workers paved it with slabs of sandstone and limestone so the sledges hauling basalt blocks wouldn't sink into the sand. Most of that basalt went into the floors of pyramid temples, including Khufu's at Giza. That's more than 2,000 years before the Romans built the Appian Way."
- **Confirmed vs. inferred vs. unknown:**
  - **Confirmed:** The road connects the Widan el-Faras basalt quarry to a quay near Qasr el-Sagha on Lake Moeris and is about 11–12 km long. Geologists James Harrell and Thomas Bown found it in 1994. It was paved with sandstone and limestone slabs plus basalt and petrified wood. ASCE calls it the "oldest surviving paved road in the world."
  - **Date:** ASCE gives 2500–2100 BC. Secondary reports of Harrell and Bown give about 2600–2200 BCE, based on pottery. Say "about 4,500 years old" or "Old Kingdom" on air rather than a precise range.
  - **"Royal sarcophagi" is weak.** ASCE's write-up mentions "royal sarcophagi and pavements for the mortuary temples" (IFLScience repeats it). Quarry specialists (Harrell; Per Storemyr's site report) say the basalt was used *mainly to pave mortuary-temple floors* in the Khufu, Userkaf, Sahure and Nyuserre pyramid complexes. Lead with temple floors and drop sarcophagi, or hedge it as "and possibly sarcophagi."
  - **"Oldest paved road":** Keep the qualifier "oldest known" or "oldest surviving." The Sweet Track in Somerset, England (timber felled in 3807/6 BC) is older, but it is a raised plank walkway, not a paved road. It makes a fun aside, not a contradiction.
- **Sources:**
  - ASCE — "Lake Moeris Quarry Road" (https://www.asce.org/about-civil-engineering/history-and-heritage/historic-landmarks/lake-moeris-quarry-road). "Oldest surviving paved road," 2500–2100 BC, about 6.5 ft wide, sandstone and limestone slabs, the "royal sarcophagi and pavements" wording.
  - Harrell & Bown 1995, *Journal of the American Research Center in Egypt* 32:71–91, "An Old Kingdom basalt quarry at Widan el-Faras and the quarry road to Lake Moeris"; plus Bown & Harrell 1995, "The oldest paved road," *The Ostracon* 6(3). Cited via Harrell's University of Toledo publication list (http://www.eeescience.utoledo.edu/faculty/harrell/egypt/quarries/pubs_list.html). The primary study, which I saw only as a citation, not the text.
  - Per Storemyr — Widan el-Faras site report (https://per-storemyr.net/wp-content/uploads/2010/07/2003_062_widan_el_faras_print.pdf). Basalt used mainly for temple floors in 4th–5th Dynasty pyramid complexes, including Khufu.
  - Historic England — Sweet Track listings (https://historicengland.org.uk/listing/the-list/list-entry/1014438). Felled in 3807/6 BC (dendrochronology); the oldest timber trackway in Britain.
  - Lead only, not one of the two sources: IFLScience, "The Oldest Paved Road In The World Transported Volcanic Rock For Royal Sarcophagi." Reports the 2600–2200 BCE date from pottery.
- **Best "Somebody Did It First" angle:**
  - Who gets the credit: Rome, the road-builders of popular memory.
  - Who did it first: Old Kingdom Egyptian quarry crews paved a road more than 2,000 years before the Appian Way (312 BCE).
  - The evidence is solid: a peer-reviewed survey plus an ASCE landmark designation.
- **Fit score:** 3/5 — A clean "Romans weren't first" myth-bust, but there is no named person and the episode is mostly an "oldest X" fact.

### 29. Ship — Fit 3/5
- **Planned fun fact:** The Pesse canoe from the Netherlands is about 10,000 years old and is the oldest known boat.
- **Verdict:** Confirmed (with the wording fix below)
- **Corrected / on-air version:** "The oldest boat anyone has actually dug up is the Pesse canoe from the Netherlands: a hollowed-out pine log, about 3 metres long, made roughly 10,000 years ago. But it was nowhere near the first boat. People had already crossed open sea to reach Australia by about 60,000 years ago or earlier. Those boats just didn't survive."
- **Confirmed vs. inferred vs. unknown:**
  - **Confirmed:** The Pesse canoe is a dugout made from a Scots pine log, 298 × 44 cm, found in 1955. Radiocarbon dates put it at about 8040–7510 BCE. It is in the Drents Museum in Assen, which calls it "the oldest boat in the world."
  - **Confirmed:** The Dufuna canoe from Nigeria (found 1987, excavated 1994) is about 8,000–8,500 years old and is usually called the second-oldest. Its date comes from charcoal *near* the canoe, not the canoe itself, so it is a bit less secure. It does not beat Pesse.
  - **Confirmed:** Humans were in northern Australia by about 65,000 years ago (Madjedbebe, *Nature* 2017; genetic estimates say about 60,000). Getting there needed several sea crossings, the last one about 100 km of open water. So watercraft are tens of thousands of years older than Pesse.
  - **Inferred:** What those early craft looked like (rafts or canoes) is unknown.
  - **Caveat:** Only one strong institutional source (the Drents Museum) confirms the Pesse superlative directly. The exact 8040–7510 BCE range came from Wikipedia. Use "about 10,000 years old" on air.
- **Sources:**
  - Drents Museum — collection and "Step into the canoe of Pesse" pages (https://drentsmuseum.nl/en/activities/step-into-the-canoe-of-pesse ; https://drentsmuseum.nl/en/subcollections/archeologie). Pesse canoe as "the oldest boat in the world," held in Assen.
  - Clarkson et al. 2017, *Nature* 547:306–310, "Human occupation of northern Australia by 65,000 years ago" (https://www.nature.com/articles/nature22968). Human arrival by about 65,000 years ago.
  - The Conversation / Australian Museum (https://theconversation.com/island-hopping-study-shows-the-most-likely-route-the-first-people-took-to-australia-93120). Island hops plus a final open-water crossing of about 100 km. The earliest uncontested evidence of boat travel.
  - Lead only: Wikipedia's Pesse canoe and Dufuna canoe articles, for the 8040–7510 BCE range and the Dufuna details.
- **Best "Somebody Did It First" angle:**
  - What gets the credit: the Pesse canoe, as the "oldest boat."
  - Who did it first: the unnamed seafarers who reached Australia (and islands like Flores) tens of thousands of years earlier.
  - The evidence is solid but indirect: we have their arrival, not their boats.
- **Fit score:** 3/5 — "Oldest surviving ≠ first" frames well, but there is no wrongly credited person.

---

> **Episodes 30–39: NOT web-verified (search budget exhausted).** Everything below is from my own knowledge of the history. Verdicts are provisional, and each entry lists what to check.

### 30. Train — Fit 5/5
- **Planned fun fact:** Trevithick's 1804 locomotive at Pen-y-darren came more than two decades before Stephenson's Rocket (1829).
- **Verdict:** Confirmed (provisional, not web-verified this pass)
- **Corrected / on-air version:** "On 21 February 1804, at the Pen-y-darren ironworks in south Wales, Richard Trevithick's steam locomotive pulled about 10 tons of iron, five wagons and roughly 70 people along about 9¾ miles of tramway. That's the first steam locomotive known to haul a load on rails, 25 years before Stephenson's Rocket. The catch: it was so heavy it kept cracking the cast-iron rails, so it went back to being a stationary engine. Trevithick proved it could work. George Stephenson made it pay."
- **Confirmed vs. inferred vs. unknown:**
  - **High confidence, from my own knowledge:**
    - Pen-y-darren run on 21 Feb 1804, from Merthyr Tydfil to Abercynon.
    - Locomotion No. 1 opened the Stockton & Darlington Railway on 27 Sept 1825.
    - Rocket won the Rainhill Trials in Oct 1829.
    - Other earlier locomotives: Blenkinsop and Murray's *Salamanca* (Middleton Railway, 1812) was the first commercially successful steam locomotive. Hedley's *Puffing Billy* (about 1813–14) is the oldest surviving locomotive and is at the Science Museum. Stephenson's own first engine was *Blücher* (1814).
    - Trevithick also ran the "Puffing Devil" steam road carriage in 1801.
  - **Check:** The load figures (10 tons, 70 men, 9¾ miles, about 4 hours) vary a little between sources.
  - **Unknown:** Whether Trevithick's Coalbrookdale engine (around 1802–03) ever ran on rails.
- **Sources (to verify, URLs from memory):**
  - Science Museum Group — Richard Trevithick and Puffing Billy collection pages (https://collection.sciencemuseumgroup.org.uk). Search "Trevithick" and "Puffing Billy".
  - Amgueddfa Cymru – Museum Wales — Trevithick locomotive replica and Pen-y-darren history (https://museum.wales). The replica is at the National Waterfront Museum, Swansea.
  - National Railway Museum — Rocket, Locomotion No. 1 (https://www.railwaymuseum.org.uk).
  - Britannica — "Richard Trevithick" (https://www.britannica.com/biography/Richard-Trevithick).
- **Best "Somebody Did It First" angle:**
  - Who gets the credit: George Stephenson, "Father of the Railways," and *Rocket* in popular memory.
  - Who did it first: Trevithick ran a rail locomotive 25 years earlier, and Murray, Blenkinsop and Hedley all ran working engines before Locomotion. Trevithick died broke in 1833.
  - Strong, well-documented, with a clear emotional hook.
- **Fit score:** 5/5 — Famous credited name plus a well-documented earlier inventor who died poor.

### 31. Car — Fit 5/5
- **Planned fun fact:** Karl Benz patented the first true automobile in 1886, not Ford. Ford's breakthrough was the moving assembly line (1913).
- **Verdict:** Needs correction (small wording fixes only; not web-verified this pass)
- **Corrected / on-air version:** "Henry Ford didn't invent the car. Karl Benz patented his three-wheeled, gasoline-powered Motorwagen in January 1886, when Ford was 22. Nicolas-Joseph Cugnot had a steam-powered vehicle crawling around Paris in 1769. Ford didn't invent the assembly line either. Ransom Olds was building cars on a stationary line by 1901, and Chicago meatpackers were running moving 'disassembly' lines decades earlier. What Ford's team did in 1913 was make the line move for whole cars, cutting the time to build a Model T chassis from about 12 hours to about 90 minutes."
- **Confirmed vs. inferred vs. unknown:**
  - **High confidence, from my own knowledge:**
    - Benz's German patent DRP 37435 was filed 29 Jan 1886.
    - Cugnot's *fardier à vapeur* dates to 1769–70; one survives at the Musée des Arts et Métiers, Paris.
    - Daimler and Maybach built a motorized carriage in 1886 independently.
    - Ford's Highland Park moving line was phased in during 1913, with chassis assembly by late 1913. Ford engineers themselves cited the meatpacking lines as inspiration.
  - **Hedge — Olds:** That Ransom Olds' line for the Curved Dash Olds (1901) was the "first assembly line" is mostly repeated from automotive-industry sources. Say "an early stationary assembly line," not "the first."
  - **Hedge — "true automobile":** Phrase it as "the first practical gasoline-powered automobile."
  - **Disputed — Siegfried Marcus:** Vienna, petrol-engine handcarts and cars. The "second Marcus car" was once dated to 1875, but later research suggests about 1888–89. Nazi-era censorship (Marcus was of Jewish descent) muddied the record. Treat him as a disputed side note only.
  - **Check:** The 12½-hours-to-93-minutes figure is the commonly cited Ford one. Check the exact numbers.
- **Sources (to verify, URLs from memory):**
  - Mercedes-Benz Group / Mercedes-Benz Classic — "Benz Patent Motor Car," DRP 37435 (https://group.mercedes-benz.com). Search "Patent Motor Car 1886".
  - The Henry Ford museum — Model T and moving assembly line (https://www.thehenryford.org); Ford Motor Company, "100 Years of the Moving Assembly Line" (https://corporate.ford.com).
  - Musée des Arts et Métiers — Cugnot fardier (https://www.arts-et-metiers.net).
  - Britannica — "automobile: history" (https://www.britannica.com/technology/automobile/History-of-the-automobile).
- **Best "Somebody Did It First" angle:**
  - Who gets the credit: Ford, for both the car and the assembly line.
  - Who did it first: Benz (the car), Cugnot (a self-propelled vehicle), and Olds plus the meatpackers (the line).
  - Very solid evidence. Classic "Ford perfected it" structure, like Heinz and ketchup.
- **Fit score:** 5/5 — A famous wrong credit, with two well-documented layers of earlier inventors.

### 32. Flight — Fit 4/5
- **Planned fun fact:** The Wright brothers' 1903 flight covered 852 feet, and their hometown paper refused to report it.
- **Verdict:** Needs correction (not web-verified this pass)
- **Corrected / on-air version:**
  - "On 17 December 1903 the Wrights made four flights. The first, with Orville at the controls, lasted 12 seconds and covered 120 feet. Shorter than the wingspan of a 747. The longest, with Wilbur in the last attempt of the day, went 852 feet in 59 seconds."
  - "Orville wired home: 'Success four flights… longest 57 seconds… inform press.' The telegraph office garbled 59 into 57. According to the family's account, the Dayton Journal's man, Frank Tunison, shrugged it off: 57 seconds? If it had been 57 minutes, that might be news."
  - "Hedge: another Dayton paper, the Daily News, did run a short item the next day, and the Norfolk Virginian-Pilot ran a wildly inaccurate scoop."
- **Confirmed vs. inferred vs. unknown:**
  - **High confidence, from my own knowledge:**
    - The four flights: 120 ft / 12 s (Orville), then roughly 175 ft and 200 ft, then 852 ft / 59 s (Wilbur).
    - The telegram's "57 seconds" error. The original telegram is in the Library of Congress Wright papers.
  - **Inferred, family account only:** The Tunison quote comes from the Wright family's account, as told in Fred C. Kelly's authorized biography *The Wright Brothers* (1943). It is a family recollection, not a contemporaneous record, so attribute it.
  - **Fix needed:** "Their hometown paper refused" is too absolute. My understanding is that the *Dayton Daily News* ran a short piece on 18 Dec 1903 (headline along the lines of "Dayton Boys Emulate Great Santos-Dumont"). **Verify this before airing.**
  - **Disputed — Whitehead:** Gustave Whitehead's claimed flight on 14 Aug 1901 in Bridgeport, CT rests mainly on a *Bridgeport Herald* article. There are no photographs.
    - In 2013, *Jane's All the World's Aircraft* (an editorial by Paul Jackson) backed Whitehead, and Connecticut passed a law crediting him.
    - Smithsonian senior curator Tom Crouch rejected the claim.
    - The 1948 Smithsonian–Wright estate agreement says the Smithsonian may not state that any earlier aircraft was capable of carrying a man under its own power in controlled flight, or the Flyer could be reclaimed. Whitehead supporters cite this as a conflict of interest.
    - On air: "a disputed claim the Smithsonian rejects, and the Smithsonian is contractually barred from endorsing."
- **Sources (to verify, URLs from memory):**
  - Smithsonian National Air and Space Museum — 1903 Wright Flyer; "The Wright Brothers & The Invention of the Aerial Age" (https://airandspace.si.edu). The four flights, distances and times.
  - Library of Congress — Wilbur and Orville Wright Papers, including the 17 Dec 1903 telegram (https://www.loc.gov/collections/wilbur-and-orville-wright-papers/).
  - National Park Service — Wright Brothers National Memorial (https://www.nps.gov/wrbr/).
  - Fred C. Kelly, *The Wright Brothers* (1943). Source of the Tunison anecdote; a family-authorized account.
  - Smithsonian Magazine / NASM — Tom Crouch's rebuttal of the Whitehead claim (2013); the text of the 1948 Smithsonian–Wright estate agreement.
- **Best "Somebody Did It First" angle:**
  - The Wrights *are* first by mainstream consensus, so the twist runs the other way.
  - The Smithsonian itself spent decades claiming *Langley's* Aerodrome was "the first man-carrying aeroplane capable of sustained free flight." That claim rested on Glenn Curtiss's modified 1914 tests of the Aerodrome.
  - In protest, Orville sent the Flyer to London's Science Museum in 1928. It only came back in 1948 under the contract that still bars the Smithsonian from crediting anyone earlier.
  - Whitehead works as a disputed coda.
- **Fit score:** 4/5 — A strong "credit fight" story, but the famous names are probably genuinely first. Frame it as a fight over credit, not a dethroning.

### 33. Space Travel — Fit 4/5
- **Planned fun fact:** Fruit flies on a captured V-2 in 1947 were the first animals in space (20 Feb 1947, White Sands; NASA source).
- **Verdict:** Confirmed (provisional, not web-verified this pass)
- **Corrected / on-air version:** "Before Laika, before the monkeys, the first animals known to reach space were fruit flies. On 20 February 1947, the US launched a captured German V-2 rocket from White Sands, New Mexico, carrying fruit flies and some seeds. It reached about 109 km (68 miles), past the 100 km Kármán line, in a little over three minutes. The capsule parachuted back down, and the flies came home alive. That's more than ten years before Laika."
- **Confirmed vs. inferred vs. unknown:**
  - **High confidence, from my own knowledge:**
    - NASA's "A Brief History of Animals in Space" gives 20 Feb 1947, a V-2, fruit flies, 109 km in 3 min 10 s, the "Blossom" capsule parachute ejection, and the flies recovered alive.
    - 109 km is above the Kármán line (100 km).
    - Laika (Sputnik 2, 3 Nov 1957) was the first animal to *orbit*. She did not survive.
    - Albert II (14 June 1949) was the first monkey or primate in space. He died on impact.
  - **Hedge:** Say "first animals *known* to reach space." Earlier V-2 flights in 1946 carried seeds and fungal spores, which are not animals.
- **Sources (to verify, URLs from memory):**
  - NASA History — "A Brief History of Animals in Space" (https://history.nasa.gov/animals.html; possibly moved under nasa.gov/history).
  - White Sands Missile Range Museum — V-2 program history (https://www.wsmr-history.org).
  - A second institutional confirmation is still needed: NASM or a peer-reviewed space-biology history.
- **Best "Somebody Did It First" angle:**
  - Who gets the credit: Laika, as "the first animal in space."
  - Who did it first: US fruit flies on a captured Nazi V-2, a decade earlier.
  - Well documented, assuming the NASA page holds up on re-check.
- **Fit score:** 4/5 — A famous myth (Laika) and a hooky correction, though the "doer" is a bug, not a person.

### 34. Navigation — Fit 4/5
- **Planned fun fact:** Polynesian navigators crossed the Pacific by stars, waves and birds, and Marshall Islands stick charts (mattang, rebbelib, meddo) mapped ocean swells. The planned angle: Polynesians reached the Americas before Columbus (sweet potato; the 2020 *Nature* genomics study by Ioannidis et al., contact around 1200 CE).
- **Verdict:** Disputed (the Americas claim). The wayfinding and stick-chart parts hold up.
- **Corrected / on-air version:**
  - "Polynesian navigators settled a triangle of ocean bigger than Russia (Hawai'i, Aotearoa/New Zealand, Rapa Nui) without compass or chart. They steered by stars, swell patterns, clouds and birds. Marshall Islanders even built 'maps' of ocean swells out of sticks and shells."
  - "And around 1200 CE, Polynesians and Native Americans met. Their DNA shows it. A 2020 study in *Nature* found Native American ancestry in Eastern Polynesian islanders dating to about that time, centuries before Columbus. What the genes can't tell us is who sailed to whom."
- **Confirmed vs. inferred vs. unknown:**
  - **Stick charts:** *Mattang* (abstract teaching charts of swell patterns), *meddo* (part of an island chain) and *rebbelib* (the whole Ratak or Ralik chain). High confidence; widely documented by museums.
  - **The 2020 study:** Ioannidis et al. 2020, *Nature* 583:572–577, "Native American gene flow into Polynesia predating Easter Island settlement." It found a Native American component most similar to the Zenú of Colombia, with the earliest contact signal dated to about 1150–1230 CE.
    - **The planned angle overstates it.** The study's own title says gene flow *into* Polynesia. The authors say the data fit either Polynesians reaching South America and returning, or South Americans drifting west. Do NOT say "Polynesians reached the Americas" as fact.
  - **Sweet potato:** It was in Polynesia before Columbus (carbonized remains in the Cook Islands from about 1000 CE). The Quechua *cumal* / Polynesian *kumara* word link is suggestive but debated. A 2018 *Current Biology* paper (Muñoz-Rodríguez et al.) argued for natural dispersal; this is contested.
  - **Strong, well-supported story:** Andrew Sharp's 1950s–60s theory said Polynesian settlement was accidental drift. The Hōkūle'a refuted it in 1976 by sailing Hawai'i–Tahiti with Mau Piailug navigating without instruments.
- **Sources (to verify, URLs from memory):**
  - Ioannidis, A.G. et al. 2020, *Nature* 583:572–577, doi:10.1038/s41586-020-2487-2 (https://www.nature.com/articles/s41586-020-2487-2).
  - Polynesian Voyaging Society — Hōkūle'a 1976 voyage (https://www.hokulea.com).
  - Smithsonian NMNH or British Museum — Marshall Islands stick charts (https://www.britishmuseum.org/collection; search "stick chart").
  - Smithsonian Magazine coverage of Ioannidis 2020, for the plain-language hedging on direction.
- **Best "Somebody Did It First" angle:**
  - Who gets the credit: European "Age of Discovery" navigators, as the first true open-ocean navigators.
  - Who did it first: Polynesian wayfinders, centuries earlier, without instruments.
  - The contact-with-the-Americas part is genetic and real but has no direction.
  - Norse Vinland (L'Anse aux Meadows, tree-ring dated to 1021 CE in *Nature* 2021) is an alternative, firmer "before Columbus" peg.
- **Fit score:** 4/5 — Strong "before Columbus" and "before European navigators" framing, but the headline Americas claim must be hedged.

### 35. Timekeeping — Fit 2/5
- **Planned fun fact:** The oldest sundial dates to about 1200 BCE in the Valley of the Kings (found in 2013, University of Basel), and obelisks served as shadow clocks around 3500 BCE.
- **Verdict:** Needs correction
- **Corrected / on-air version:** "In 2013, a University of Basel team working in the Valley of the Kings found a sundial painted on a flat limestone flake, from around the 13th century BCE. It was probably used to time the workers cutting royal tombs. It's *one of* the oldest Egyptian sundials ever found, not the oldest. A shadow clock from Thutmose III's reign, around 1450 BCE, is older still."
- **Confirmed vs. inferred vs. unknown:**
  - **Basel find:** As I recall it: a limestone ostracon with a half-circle divided into 12 sections, Ramesside era (about 13th century BCE), with Egyptologist Susanne Bickel's team. The Basel press release said "one of the oldest," not "the oldest." **Verify the wording.**
  - **Older shadow clock:** One from the reign of Thutmose III (about 1479–1425 BCE) is commonly cited as the oldest known (Berlin collection).
  - **The "obelisks around 3500 BCE" line is weak.** It appears in the popular NIST/Smithsonian "A Walk Through Time" timeline, but 3500 BCE is before the unified Egyptian state. The earliest obelisks date to the Old Kingdom, about 2600–2400 BCE. The idea that they were *used* as shadow clocks is speculative. Cut it, or say "some historians think tall obelisks may have doubled as shadow clocks."
- **Sources (to verify, URLs from memory):**
  - University of Basel — 2013 press release on the Valley of the Kings sundial (https://www.unibas.ch; search "sundial Valley of the Kings 2013").
  - NIST — "A Walk Through Time: Early Clocks" (https://www.nist.gov/pml/time-and-frequency-division/popular-links/walk-through-time). Origin of the 3500 BCE obelisk claim; flag it as popular, not scholarly.
  - Live Science / Science coverage of the 2013 find. A second confirmation is still needed.
- **Best "Somebody Did It First" angle:**
  - The current fact has no wrongly credited person.
  - **Suggested stronger angle:** The mechanical clock. Europe is credited with clockwork (late 13th-century tower clocks), but Su Song's water-driven astronomical clock tower at Kaifeng (1088) used an escapement-like mechanism, and Yi Xing's (725 CE) came earlier still.
  - **Alternative:** Huygens gets the credit for the pendulum clock (1656), but Galileo designed one in 1641–42 that his son tried to build.
- **Fit score:** 2/5 for the planned fact. About 4/5 if swapped to Su Song versus European clockmakers, or to Galileo versus Huygens.

### 36. Writing — Fit 4/5
- **Planned fun fact:** The earliest cuneiform was mostly receipts and inventories; "about 3/4 of deciphered tablets are administrative."
- **Verdict:** Needs correction
- **Corrected / on-air version:** "Writing wasn't invented for poetry. It was invented for accounting. In the oldest tablets from Uruk in Iraq, about 5,000 years old, roughly 85 to 90 percent are bookkeeping: rations, livestock, grain, labor. Nearly all the rest are word lists used to train scribes. And the Sumerians may not even have been first. Inscribed labels from a royal tomb at Abydos, Egypt, may be just as old or older."
- **Confirmed vs. inferred vs. unknown:**
  - **"3/4" has no traceable source.** I could not tie it to any scholar, so cut it.
  - **The usable figure:** Robert Englund's work (CDLI, UCLA; *Texts from the Late Uruk Period*, 1998) puts proto-cuneiform from Uruk IV/III (about 3300–3000 BCE) at about 85–90% administrative, with nearly all the rest being lexical lists. **Verify the exact figure Englund gives before quoting a number.** Safer on air: "the vast majority."
  - **Independent inventions of writing:** Mesopotamia, Egypt, China and Mesoamerica is the standard scholarly list.
  - **Egypt's priority:** The Abydos tomb U-j bone and ivory labels (excavated by Günter Dreyer; published 1998) are dated to about 3320–3150 BCE. That puts Egypt's earliest writing roughly as early as Uruk, so the priority is disputed and the dates overlap.
  - **China:** Oracle bones date to about 1250 BCE.
  - **Mesoamerica:** About 900–300 BCE. The Cascajal block (about 900 BCE) is debated.
- **Sources (to verify, URLs from memory):**
  - CDLI (Cuneiform Digital Library Initiative) — Englund's proto-cuneiform overview (https://cdli.mpiwg-berlin.mpg.de).
  - Englund, R.K. 1998, "Texts from the Late Uruk Period," in *Mesopotamien: Späturuk-Zeit und Frühdynastische Zeit* (OBO 160/1).
  - The British Museum — early writing / proto-cuneiform tablets (https://www.britishmuseum.org).
  - Penn Museum / Oriental Institute (ISAC, Chicago), *Visible Language* exhibition catalogue (2010, ed. Christopher Woods). Independent inventions, and Abydos U-j versus Uruk. Free PDF from ISAC.
- **Best "Somebody Did It First" angle:**
  - Who gets the credit: the Sumerians, as "the inventors of writing."
  - Who might have been first: Egypt's Abydos labels, which are as early or earlier. Writing was also invented independently at least three more times.
  - A properly scholarly priority dispute. Hedge it as "neck and neck."
- **Fit score:** 4/5 — A famous credit (Sumer) with a credible contender (Egypt), plus the hooky "invented for accounting" fact.

### 37. Printing Press — Fit 5/5
- **Planned fun fact:** Bi Sheng invented clay movable type around 1040 (recorded in Shen Kuo's *Dream Pool Essays*), and Korea's *Jikji* (1377) predates Gutenberg (1450s). The Diamond Sutra (868, woodblock, British Library) is also in scope.
- **Verdict:** Confirmed (provisional, not web-verified this pass)
- **Corrected / on-air version:**
  - "Gutenberg's press in the 1450s changed Europe, but movable type was 400 years old by then. Around the 1040s, a Chinese commoner named Bi Sheng was printing with fired clay characters. We only know because the scholar Shen Kuo wrote it down in his *Dream Pool Essays*."
  - "In 1377, Buddhist monks in Cheongju, Korea, printed the *Jikji* with movable *metal* type. That's about 78 years before the Gutenberg Bible, and it's the oldest surviving book of its kind."
  - "Woodblock printing is older still. The British Library's Diamond Sutra is dated 868 CE. It's the oldest dated printed book in the world."
- **Confirmed vs. inferred vs. unknown:**
  - **High confidence, from my own knowledge:**
    - Bi Sheng's clay type is from the Qingli reign (1041–48), described in Shen Kuo's *Mengxi Bitan* (about 1088).
    - The *Jikji* (full title *Baegun hwasang chorok buljo jikji simche yojeol*, vol. 2) was printed at Heungdeok Temple, Cheongju, in 1377. It is on UNESCO's Memory of the World register (2001) and held by the Bibliothèque nationale de France.
    - The Diamond Sutra is dated 11 May 868 (Xiantong 9). Aurel Stein brought it from Dunhuang in 1907.
    - The Gutenberg Bible dates to about 1454–55.
  - **Nuance — older metal type:** Korean records (Yi Gyu-bo) describe metal-type printing of a ritual text around 1234, but no copy survives. Say "oldest *surviving*."
  - **Fairness to Gutenberg:** His real advances were the hand mould for casting type, oil-based ink, and the screw press. There is no evidence he knew of Asian printing.
- **Sources (to verify, URLs from memory):**
  - British Library — "The Diamond Sutra" (https://www.bl.uk/collection-items/the-diamond-sutra).
  - UNESCO Memory of the World — *Jikji* entry (https://www.unesco.org/en/memory-world; search "Jikji").
  - Bibliothèque nationale de France — *Jikji* catalogue record (https://gallica.bnf.fr).
  - Britannica — "Bi Sheng" and "printing: history" (https://www.britannica.com/biography/Bi-Sheng).
- **Best "Somebody Did It First" angle:**
  - Who gets the credit: Gutenberg, as "inventor of the printing press and movable type."
  - Who did it first: Bi Sheng (ceramic type, about 1040), the Korean monks (metal type, 1377), and Chinese woodblock printers (868 and earlier).
  - Very solid evidence: physical artifacts in the British Library and the BnF.
- **Fit score:** 5/5 — A famous credited name with multiple well-documented earlier inventors.

### 38. Telephone — Fit 5/5
- **Planned fun fact:** Bell and Elisha Gray filed on the same day (14 Feb 1876), and Bell's was processed first by hours. Also in scope: the caveat-versus-patent-application nuance, Antonio Meucci (2002 House Resolution 269: what it actually says and its limits), and Johann Philipp Reis (1861).
- **Verdict:** Needs correction (not web-verified this pass)
- **Corrected / on-air version:**
  - "On Valentine's Day 1876, two filings about transmitting speech reached the US Patent Office on the same day. Bell's lawyer filed a full patent application. Elisha Gray filed a *caveat*, which is basically a notice saying 'I'm working on this, don't patent it out from under me.' Bell's filing was logged earlier in the day's list. Gray's came later. Whether that was really hours apart, and whether a patent examiner later leaked Gray's idea to Bell, has been argued over for 150 years."
  - "Bell wasn't the only rival. In Germany, Johann Philipp Reis built a device he called the 'Telephon' in 1861 that could carry music and fragments of speech. In New York, Italian immigrant Antonio Meucci filed his own caveat in 1871 but couldn't afford to renew it after 1874. In 2002 the US House passed a resolution honoring Meucci's 'work in the invention of the telephone.' Careful: it doesn't say he invented it."
- **Confirmed vs. inferred vs. unknown:**
  - **High confidence:**
    - Both filings were dated 14 Feb 1876. Bell's was an application; Gray's was a caveat.
    - Bell's patent, No. 174,465, was issued 7 March 1876.
    - Bell's first intelligible speech ("Mr. Watson, come here…") was on 10 March 1876, using a liquid (variable-resistance) transmitter like the one in Gray's caveat.
    - In 1886, examiner Zenas Wilber gave an affidavit saying he had shown Bell Gray's caveat. His affidavits were contradictory.
  - **Contested:** The "by hours" claim. My understanding is that it rests on the order of entries in the Patent Office cash book (Bell's listed about 5th that day, Gray's about 39th). Exact arrival times are not documented. Use "earlier that day" or "reportedly hours earlier."
  - **H.Res. 269 (107th Congress), passed 11 June 2002:** It resolves that Meucci's "life and achievements… should be recognized, and his work in the invention of the telephone should be acknowledged." It is non-binding and House-only. It does **not** declare him the inventor, though many outlets reported that it did.
  - **Canada:** Its House of Commons passed a counter-motion days later affirming Bell. **Verify.**
  - **Reis:** 1861 device, demonstrated to the Physical Society of Frankfurt on 26 Oct 1861. It transmitted tones reliably and speech only intermittently ("Das Pferd frisst keinen Gurkensalat").
- **Sources (to verify, URLs from memory):**
  - Congress.gov — H.Res.269, 107th Congress (https://www.congress.gov/bill/107th-congress/house-resolution/269). Exact text.
  - Library of Congress — Alexander Graham Bell Family Papers (https://www.loc.gov/collections/alexander-graham-bell-papers/). Patent 174,465 and notebooks.
  - Smithsonian NMAH — Elisha Gray and Bell telephone collections (https://americanhistory.si.edu).
  - Britannica — "telephone: history"; "Johann Philipp Reis"; "Antonio Meucci".
  - A. Edward Evenson, *The Telephone Patent Conspiracy of 1876* (McFarland, 2000). Detailed account of the filing-order and Wilber controversy; one author's argument.
- **Best "Somebody Did It First" angle:**
  - Who gets the credit: Bell.
  - Who arguably did it first or at the same time: Gray (the same day; the liquid transmitter), Meucci (an 1871 caveat), and Reis (a working device in 1861 that carried partial speech).
  - Famous, well documented, and genuinely contested.
- **Fit score:** 5/5 — The textbook case for the channel premise.

### 39. Computer — Fit 3/5 as planned (5/5 with the suggested angle)
- **Planned fun fact:** In 1947 a moth was found in the Harvard Mark II, logged as the "first actual case of bug being found." The logbook is at the Smithsonian NMAH (9 Sept 1947). Also in scope: Hopper didn't find it herself; the word "bug" predates it (Edison, 1878); and the stronger first-computer angles (Babbage and Lovelace, Zuse's Z3 in 1941, the Atanasoff-Berry Computer with the 1973 *Honeywell v. Sperry Rand* ruling, Colossus in 1943–44).
- **Verdict:** Needs correction (the moth is real but its common framing is wrong; not web-verified this pass)
- **Corrected / on-air version (moth):** "On 9 September 1947, operators of Harvard's Mark II computer pulled a moth out of Relay #70 and taped it into the logbook: 'First actual case of bug being found.' The joke only works because engineers already called glitches 'bugs.' Thomas Edison was using the word in letters back in 1878. Grace Hopper didn't find the moth, but she loved telling the story, which is why it stuck to her."
- **Confirmed vs. inferred vs. unknown:**
  - **The moth, high confidence:** The logbook page reads "1545 Relay #70 Panel F (moth) in relay. First actual case of bug being found." NMAH holds it; it was transferred in 1994. Hopper was on the team but didn't make the find. Edison wrote "bugs" in letters in 1878, for example to Theodore Puskas. Some older retellings date the moth to 1945; NMAH says 1947.
  - **The stronger angle, high confidence on the facts:**
    - **ENIAC** (1945–46) is popularly called "the first computer."
    - **Zuse's Z3** (Berlin, demonstrated 12 May 1941) was a working programmable, automatic digital computer. It was electromechanical and was destroyed in 1943.
    - **Atanasoff-Berry Computer** (Iowa State, about 1939–42) was electronic and digital but not programmable.
    - **Honeywell v. Sperry Rand** (D. Minn., Judge Earl Larson, decided 19 Oct 1973) invalidated the ENIAC patent. Larson found that Eckert and Mauchly "did not themselves first invent the automatic electronic digital computer, but instead derived that subject matter from one Dr. John Vincent Atanasoff." Mauchly had visited Atanasoff in June 1941.
    - **Colossus** (Bletchley Park; operational early 1944) was the first programmable electronic digital computer. It was kept secret until the 1970s.
    - **Babbage and Lovelace:** The Analytical Engine was designed from 1837 but never built. Lovelace's Note G (1843) is often called the first published program.
  - **Check:** The exact quote from the Larson ruling is from my own knowledge. Verify it against the published opinion (180 USPQ 673).
- **Sources (to verify, URLs from memory):**
  - Smithsonian NMAH — "Log Book With Computer Bug" (https://americanhistory.si.edu/collections/search/object/nmah_334663).
  - Naval History and Heritage Command — the bug logbook / Grace Hopper (https://www.history.navy.mil).
  - Iowa State University — Atanasoff-Berry Computer history and the *Honeywell v. Sperry Rand* decision (https://jva.cs.iastate.edu ; https://www.cs.iastate.edu).
  - The National Museum of Computing (Bletchley Park) — Colossus (https://www.tnmoc.org).
  - Deutsches Museum / Konrad Zuse Internet Archive — Z3 (https://www.deutsches-museum.de).
  - Computer History Museum — timeline of computer history (https://www.computerhistory.org/timeline/computers/).
- **Best "Somebody Did It First" angle:** Swap the lead to "ENIAC wasn't first."
  - A US federal judge ruled in 1973 that ENIAC's inventors had derived their key ideas from Iowa State's John Atanasoff, which invalidated the patent.
  - Konrad Zuse had a programmable computer running in Berlin in 1941.
  - Britain's Colossus was cracking Nazi codes in 1944 but stayed secret for 30 years.
  - Use the moth as the cold open.
  - Legally documented and very hooky.
- **Fit score:** 3/5 for the moth alone, which is a myth-bust about a word, not a person. **5/5** if the episode leads with ENIAC versus Atanasoff, Zuse and Colossus.

---

#### Batch notes

\* Episodes 30–39 are from model knowledge only. They were NOT web-verified because the session WebSearch budget was used up (200/200). Re-check before the scripts lock.

---

## Quarter 4 — Health, Food, Music and Everyday Life (episodes 40–52)

**Method note (read first):** All checks came from search-engine extracts of the listed pages, not full reads. WebFetch is EGRESS_BLOCKED (tested on britishmuseum.org). **The session-wide WebSearch budget (200 calls) ran out partway through this batch.** Episodes 40–46 were checked against sources. **Episodes 47–52 could NOT be searched.** For those, the verdicts and sources come from the researcher's background knowledge, and each is marked **UNVERIFIED THIS SESSION**. None of them may be treated as Confirmed under the two-source rule until someone checks them. The sources listed for 47–52 are the right places to look, but they were not opened or searched here.

---

### 40. Medicine (Trepanation) — Fit 3/5
- **Planned fun fact:** Trepanation is the oldest known surgery; many patients survived.
- **Verdict:** Needs correction
- **Corrected / on-air version:** "Drilling or scraping a hole in a living person's skull is one of the oldest surgeries we know of. Skulls from Neolithic France, about 7,000 years old, show bone that healed afterward, so patients lived. In Peru, a study of more than 800 trepanned skulls found that by Inca times about 75–83% of patients survived long-term. That beats the 46–56% death rate for skull surgery in the American Civil War. But trepanation may no longer be the oldest surgery: in 2022 researchers reported a child in Borneo whose lower leg was surgically amputated about 31,000 years ago, and who lived another 6–9 years."
- **Confirmed vs. inferred vs. unknown:**
  - **Confirmed:** Peru survival figures and the Civil War comparison (Kushner, Verano and Titelbaum, *World Neurosurgery*, 2018; reported by Smithsonian and Nat Geo). The Liang Tebo amputation, ≥31,000 years ago, survived 6–9 years (*Nature*, 7 Sept 2022).
  - **Needs care:** The Ensisheim (Alsace) case is dated about 5100 BCE, roughly 7,000 years ago. Some sources wrongly say "7000 BC." Write "about 7,000 years ago," not "7000 BC."
  - **Disputed:** A 2023 *Nature* "Matters Arising" argued the Borneo case could be ordinary trauma rather than surgery, and the authors replied. Hedge with "researchers argue."
  - **Unknown:** Why trepanation was done (medical, ritual, or both).
- **Sources:**
  - PubMed — Kushner, Verano & Titelbaum 2018, "Trepanation Procedures/Outcomes…" (https://pubmed.ncbi.nlm.nih.gov/29604358/) — 800+ skulls; survival about 40% (400–200 BC) rising to 91%, and 75–83% in the Inca period.
  - Smithsonian — "Inca Skull Surgeons Had Better Success Rates Than American Civil War Doctors" (https://www.smithsonianmag.com/smart-news/inca-head-crackers-had-better-success-rates-civil-war-surgeons-180969324/) — the Civil War comparison.
  - National Geographic — "Inca Skull Surgeons Were 'Highly Skilled'" (https://www.nationalgeographic.com/science/article/news-trepanation-inca-medicine-archaeology) — corroborates.
  - Nature — Maloney et al. 2022, "Surgical amputation of a limb 31,000 years ago in Borneo" (https://www.nature.com/articles/s41586-022-05160-8), plus news piece (https://www.nature.com/articles/d41586-022-02854-x) — predates the previous oldest amputation (about 7,000 years ago) by about 24,000 years.
  - Nature 2023 — "Common orthopaedic trauma may explain 31,000-year-old remains" (https://www.nature.com/articles/s41586-023-05756-8), and Reply (https://www.nature.com/articles/s41586-023-05757-7) — the dispute.
  - PMC — "Ancient Legacy of Cranial Surgery" (https://pmc.ncbi.nlm.nih.gov/articles/PMC3876527/) — Ensisheim as the earliest unequivocal Neolithic case.
- **Best "Somebody Did It First" angle:** "Hippocrates wrote the textbook on head surgery (*On Wounds in the Head*), but Stone Age healers were drilling skulls thousands of years earlier. Incan surgeons out-survived Civil War doctors, and a Borneo forager had a leg amputated 31,000 years ago." This is solid. No single famous person is wrongly credited.
- **Fit score:** 3/5 — a strong "earlier than you think" story, and the Inca-beats-Civil-War stat is a great hook, but nobody famous is wrongly credited.

### 41. Anesthesia — Fit 5/5
- **Planned fun fact:** "Before 1846 doctors believed screams were a good sign the patient was alive."
- **Verdict:** Needs correction
- **Corrected / on-air version:** "Before anesthesia, many doctors didn't think pain was purely bad. Some saw it as a sign the body was still fighting, and some opposed anesthesia because they thought removing pain could be dangerous. The great French physiologist François Magendie argued that pain 'has always its usefulness.'" Then the main story: "Everyone remembers William Morton's ether demonstration in Boston on October 16, 1846. But on March 30, 1842, a Georgia country doctor named Crawford Long had already removed a tumor from James Venable's neck under ether. Long didn't publish until 1849. And 38 years before Long, in 1804, Japanese surgeon Hanaoka Seishū removed a breast tumor from Kan Aiya under full general anesthesia, using an herbal mix (mafutsusan/tsūsensan)."
- **Confirmed vs. inferred vs. unknown:**
  - **Confirmed:** Long, 30 March 1842, Venable, neck tumor, published 1849 (Britannica, NLM/PMC, Wood Library-Museum, UGA). Hanaoka, 13 Oct 1804, Kan Aiya, mafutsusan (PubMed/ScienceDirect, *Journal of Anesthesia History*). The general belief that pain was useful or vital, and Magendie's opposition ("Accepting Pain Over Comfort," PubMed 26828088). A peer-reviewed PMC review also describes the "erroneous yet pervasive Western view" that the patient's anguish kept them alive.
  - **Not confirmed:** The specific line "screams were a good sign the patient was alive." No primary source was found. It looks like a simplified popular version of the "pain is vital" belief. Don't say "screams" as fact.
  - **From memory, not searched this session:** Horace Wells's nitrous-oxide work (self-extraction Dec 1844; failed public demo Jan 1845) and Charles Jackson's priority fight with Morton. These are widely documented and low risk, but check them in the next pass.
- **Sources:**
  - Britannica (Students) — Crawford W. Long (https://kids.britannica.com/students/article/Crawford-W-Long/275532) — 30 March 1842, Venable, the delay to 1849.
  - Wood Library-Museum of Anesthesiology — History of Anesthesia (https://www.woodlibrarymuseum.org/history-of-anesthesia/) and Long gavel page (https://www.woodlibrarymuseum.org/museum/long-mulberry-gavel/) — corroborates Long.
  - UGA Psychology — "Crawford W. Long's Discovery of Anesthetic Ether" (https://www.psychology.uga.edu/sites/default/files/inline-files/LongEther16March2016.pdf) — corroborates the details.
  - PubMed — "Mafutsuto-Ron: The First Anesthesia Textbook in the World" (https://pubmed.ncbi.nlm.nih.gov/26828086/), and ScienceDirect "Two Japanese Pioneers in Anesthesiology" (https://www.sciencedirect.com/science/article/abs/pii/S2352452916300834) — Hanaoka 1804.
  - PubMed — "Accepting Pain Over Comfort: Resistance to the Use of Anesthesia in the Mid-19th Century" (https://pubmed.ncbi.nlm.nih.gov/26828088/) — Magendie quote; pain seen as a sign of health and life.
  - PMC — "The Astonishingly Slow Progress Towards Surgical Anesthesia: Part I" (https://pmc.ncbi.nlm.nih.gov/articles/PMC8672962/) — the "anguish kept them alive" view.
- **Best "Somebody Did It First" angle:** Morton gets the credit (the Ether Dome; "Ether Day"). Long did it four years earlier and documented it. Today's US National Doctors' Day falls on March 30 because of Long's operation. Hanaoka did it 42 years before Morton, with a full general anesthetic. Wells and Jackson add the priority war. The evidence is solid.
- **Fit score:** 5/5 — the textbook example the channel brief itself names. A famous credited name, a documented earlier doer, and a bonus Japanese pioneer.

### 42. Vaccines — Fit 5/5
- **Planned fun fact:** Jenner's 1796 cowpox vaccine; tested on his gardener's 8-year-old son.
- **Verdict:** Confirmed
- **Corrected / on-air version:** "On May 14, 1796, Edward Jenner scratched cowpox matter from milkmaid Sarah Nelmes's hand into 8-year-old James Phipps, the son of Jenner's gardener. Weeks later he exposed the boy to smallpox, and Phipps didn't get sick. But Jenner wasn't first. In 1774, 22 years earlier, a Dorset farmer named Benjamin Jesty gave cowpox from his cows to his wife and two sons during a smallpox outbreak. And 'inoculation' itself was much older: people in China and India were deliberately giving mild smallpox (variolation) by the 1500s. An enslaved West African man named Onesimus taught it to Boston's Cotton Mather, and it was used during the 1721 epidemic."
- **Confirmed vs. inferred vs. unknown:**
  - **Confirmed:** The 14 May 1796 date, Nelmes, Phipps aged 8, son of Jenner's gardener (NLM exhibition, Jenner Museum, History of Vaccines). Jesty 1774, wife and two sons, Yetminster (*The Lancet*; PMC "The origins of vaccination"). Variolation in China and India in the 16th century, with Chinese practice dated by 1465–1572 (Britannica, CDC *EID* 2026, WHO). Onesimus, Mather and Boylston in 1721: 248 inoculated, 6 died (Britannica, NLM).
  - **Minor caution:** Some biographies call Phipps's father a labourer who worked for Jenner. "Gardener's son" is the standard museum wording and is fine on air.
- **Sources:**
  - US National Library of Medicine — "Smallpox: Vaccination" (https://www.nlm.nih.gov/exhibition/smallpox/sp_vaccination.html) — Phipps, Nelmes, 1796.
  - Jenner Museum — James Phipps' Cottage (https://jennermuseum.com/phipps-cottage) — son of Jenner's gardener; Jenner later gave him a cottage.
  - The Lancet — "Benjamin Jesty: the first vaccinator revealed" (https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(06)69878-4/fulltext) — 1774, 22 years before Jenner.
  - PMC — "The origins of vaccination: history is what you remember" (https://pmc.ncbi.nlm.nih.gov/articles/PMC3883152/) — Jesty corroboration.
  - Britannica — Variolation (https://www.britannica.com/science/variolation), and Zabdiel Boylston (https://www.britannica.com/biography/Zabdiel-Boylston) — China/India; Boston 1721.
  - NLM — "Smallpox: Variolation" (https://www.nlm.nih.gov/exhibition/smallpox/sp_variolation.html), and CDC *EID* on Ming-era variolation (https://wwwnc.cdc.gov/eid/article/32/10/26-0729_article).
- **Best "Somebody Did It First" angle:** Jenner is "the father of vaccination." Jesty did cowpox immunization first, in 1774, and in 1805 the Original Vaccine Pock Institution in London formally recognized him. The deeper layer is that Chinese, Indian, Ottoman and West African practitioners had inoculation centuries earlier, and Onesimus brought it to America. The evidence is excellent.
- **Fit score:** 5/5 — a famous credited name, a well-documented earlier doer, and a powerful Onesimus subplot.

### 43. Hospital — Fit 3/5
- **Planned fun fact:** First true hospital at Gundeshapur, Persia, 271 CE under Shapur I.
- **Verdict:** Wrong (cut as written; reframe as a myth-bust)
- **Corrected / on-air version:** "You'll often read that the world's first teaching hospital opened in Gundeshapur, Persia, in the 200s. Historians now say there's no evidence for it. Shapur I did found the city, settling Roman captives there. But Christian writers from that period say nothing about a medical school, and the first solid mention of 'the hospital of Gundeshapur' comes from 765 CE, centuries later. What we can document: Bishop Basil of Caesarea built a huge care complex in 369 CE; Sri Lanka had monastic hospitals; and Baghdad's first great public hospital (bimaristan) dates to around 805 CE under Harun al-Rashid."
- **Confirmed vs. inferred vs. unknown:**
  - **Confirmed:** Shapur I founded Gundeshapur and settled captives there (Britannica). Contemporary sources are silent about any medical establishment, and the first authentic evidence of a hospital dates to 765 CE (*Encyclopaedia Iranica*). Pormann and Savage-Smith argue there's no pre-Islamic evidence of a medical school or teaching hospital. Note that this attribution came from a search-engine summary, not their book itself. Basil's complex in 369 CE (PubMed/PMC).
  - **Shaky:** The "271 CE" date. It is the date some medical papers give for the city's founding, not for a hospital. Valerian was captured in 260, so the city's founding date varies by source.
  - **Disputed:** Basil's Basileias may have been a leprosarium or poorhouse rather than a "hospital" (JSTOR article). Sri Lanka's "hospitals by the 4th century BCE" rests on chronicle tradition. The excavated Mihintale hospital ruins are much later (medieval). Hedge both.
  - **Unknown:** Whether there was any real Sasanian-era hospital at all.
- **Sources:**
  - Encyclopaedia Iranica — Gondēšāpur and related entries (https://www.iranicaonline.org/articles/bimarestan-hospital-/; search extract) — contemporary silence; first evidence 765 CE; "no evidence… of a 'teaching hospital.'"
  - Britannica — Academy of Gondēshāpūr (https://www.britannica.com/place/Academy-of-Gondeshapur), and Shāpūr I (https://www.britannica.com/biography/Shapur-I) — city founded by Shapur with captives.
  - PubMed — "The evolution of the hospital from antiquity to the end of the middle ages" (https://pubmed.ncbi.nlm.nih.gov/14509111/), and PMC "The Church Has Always Built Hospitals" (https://pmc.ncbi.nlm.nih.gov/articles/PMC8935424/) — Basil, 369 CE.
  - JSTOR — "Not a Hospital but a Leprosarium: Basil's Basilias…" (https://www.jstor.org/stable/26892563) — the counter-view.
  - UNESCO Silk Roads — "Ancient Monastic Hospital System in Sri Lanka" (https://en.unesco.org/silkroad/content/did-you-know-ancient-monastic-hospital-system-sri-lanka) — Sri Lankan monastic hospitals.
  - PMC — "Jundi-Shapur, bimaristans, and the rise of academic medical centres" (https://pmc.ncbi.nlm.nih.gov/articles/PMC1676324/) — the Baghdad bimaristan, about 805, under Harun al-Rashid. This paper also repeats the Gundeshapur legend, so use it only for the Baghdad date.
- **Best "Somebody Did It First" angle:** The weak point is that it's a "the famous first never existed" myth-bust rather than a credited-person story. Possible framing: "Persia gets credit for the first hospital, but the record shows Basil in 369 and Baghdad in 805, and the Gundeshapur hospital story was mostly written centuries later." It's honest, but murky. **Suggested replacement:** fold this into a broader "who invented the hospital" piece, or swap in a stronger medicine story such as Ignaz Semmelweis and handwashing (vs. Lister, or vs. Oliver Wendell Holmes, 1843). That would need its own verification.
- **Fit score:** 3/5 — a decent myth-bust, but no clean earlier-doer, and the "first hospital" label depends on definitions.

### 44. Refrigeration — Fit 4/5
- **Planned fun fact:** Ice house at Terqa ~1775 BCE.
- **Verdict:** Needs correction
- **Corrected / on-air version:** "Around 1780 BCE, Zimri-Lim, king of Mari on the Euphrates in today's Syria (not a Sumerian king), had a clay tablet inscribed to celebrate the icehouse he built at Terqa. He bragged it was something 'which never before had any king built.' You can see that tablet in the Louvre. Mechanical cooling came much later. William Cullen made artificial cold in a Glasgow lab in 1748. Oliver Evans designed a vapor-compression fridge in 1805 but never built it. Jacob Perkins patented a working machine in London in 1834. John Gorrie, a Florida doctor now in the US Capitol's statue collection, patented an ice machine in 1851."
- **Confirmed vs. inferred vs. unknown:**
  - **Confirmed:** Louvre AO 20161 is a clay tablet, about 1780 BC, in Old Babylonian cuneiform, recording the founding of an icehouse at Terqa by Zimri-Lim of Mari (Louvre collections, RMN-Grand Palais, Lapham's Quarterly citing Sasson 1984). Governor Kibri-Dagan complained to the king about ice melting. Cullen 1748, Evans 1805 (designed only), Perkins 1834, Gorrie 1851 Patent 8080 (ASHRAE, ASME, Architect of the Capitol, Britannica, Glasgow).
  - **Correction:** "~1775 BCE" fits Zimri-Lim's reign under the middle chronology (about 1775–1761 BCE), but the Louvre says "c. 1780 BC." Use "about 3,800 years ago." Terqa was a Mari-kingdom town in Syria, not Sumerian.
  - **Caution:** Cullen's demonstration is usually dated 1748 (ASHRAE), with his paper published in 1755–56. Saying "in the 1750s… first shown in 1748" is safe.
  - **Unknown:** Whether this was really the world's first icehouse. That claim is the king's own boast. Earlier ice storage isn't attested in what was found here.
- **Sources:**
  - Louvre collections — tablet AO 20161 (https://collections.louvre.fr/en/ark:/53355/cl010144876) — the object, its date, and the icehouse at Terqa.
  - RMN-Grand Palais photo agency — "Tablette de Zimri-Lim de Mari : fondation d'une glacière à Terqa" (https://art.rmngp.fr/en/library/artworks/tablette-de-zimri-lim-de-mari-fondation-d-une-glaciere-a-terqa) — corroborates.
  - Lapham's Quarterly — "Do You Want to Build an Icehouse?" (https://www.laphamsquarterly.org/roundtable/do-you-want-build-icehouse) — the "never before had any king built" translation (Sasson 1984) and the Kibri-Dagan letter.
  - ASHRAE — Air Conditioning and Refrigeration Timeline (https://www.ashrae.org/about/mission-and-vision/ashrae-industry-history/air-conditioning-and-refrigeration-timeline) — Cullen 1748, Evans 1805, Perkins 1834, Gorrie.
  - ASME — Perkins Vapor-Compression Cycle landmark (https://www.asme.org/about-asme/engineering-history/landmarks/274-perkins-vapor-compression-cycle-for-refrigeration) — Perkins 1834.
  - Architect of the Capitol — John Gorrie statue (https://www.aoc.gov/explore-capitol-campus/art/john-gorrie-statue) — Gorrie's patent.
- **Best "Somebody Did It First" angle:** A two-part story. (1) A king stamped "I did it first" into clay 3,800 years ago, and the receipt survives. (2) The mechanical fridge: Gorrie (in the Capitol) or Carrier (the AC brand) gets the popular credit, but Cullen made artificial cold in 1748, Evans designed the cycle in 1805, and Perkins patented a working machine in 1834. Strong documentation throughout.
- **Fit score:** 4/5 — a good chain of "they weren't first" with an amazing ancient bragging tablet. The credited names are only moderately famous.

### 45. Cooking — Fit 3/5
- **Planned fun fact:** Controlled cooking fire 780,000 years ago (cooked carp, Gesher Benot Ya'aqov, Israel).
- **Verdict:** Confirmed (with a hedge)
- **Corrected / on-air version:** "At Gesher Benot Ya'aqov in Israel, about 780,000 years ago, early humans (not *Homo sapiens*; our species didn't exist yet) appear to have cooked huge carp, some about 2 meters long. Scientists found that the fish teeth had been heated gently, below about 500°C, which points to cooking rather than burning. It's the oldest evidence of cooking specifically. Evidence of fire itself goes back even further, to about a million years ago in South Africa's Wonderwerk Cave."
- **Confirmed vs. inferred vs. unknown:**
  - **Confirmed:** Zohar et al., *Nature Ecology & Evolution*, Nov 2022. About 0.78 million years ago; carp pharyngeal teeth show low-temperature heating, interpreted as cooking. It pushed cooking evidence back by more than 600,000 years (Nature, Tel Aviv University, Smithsonian, phys.org). Wonderwerk fire about 1 million years ago (Berna et al., *PNAS* 2012; U of Toronto).
  - **Inferred:** "Cooking" is the authors' interpretation of the heating signature. Hedge with "appear to have" or "evidence suggests." Which hominin species did it is unknown.
  - **Note:** An Author Correction was issued for the 2022 paper (TAU record). Its content was not checked; it's probably minor.
  - **Unknown:** A 2026 phys.org report says Wonderwerk burnt bones may push fire use to 1.07–1.79 million years ago. That is a single recent report. Don't use it on air without checking.
- **Sources:**
  - Nature Ecology & Evolution — Zohar et al. 2022, "Evidence for the cooking of fish 780,000 years ago at Gesher Benot Ya'aqov, Israel" (https://www.nature.com/articles/s41559-022-01910-z).
  - Tel Aviv University — "The World's Oldest Grilled Fish Recipe" (https://english.tau.ac.il/ancient_big_fish_cooking) — press release; corroborates.
  - Smithsonian — "Early Humans May Have Cooked Fish 780,000 Years Ago" (https://www.smithsonianmag.com/smart-news/early-humans-may-have-cooked-fish-780000-years-ago-study-suggests-180981134/) — note the hedged "may have."
  - PNAS — Berna et al. 2012, Wonderwerk Cave (https://www.pnas.org/doi/pdf/10.1073/pnas.1117620109), and U of Toronto news (https://www.utoronto.ca/news/humans-used-fire-million-years-ago) — fire about 1 million years ago.
- **Best "Somebody Did It First" angle:** "Humans didn't invent cooking; an earlier human species did, at least 780,000 years ago, and they were grilling fish." That's a species-level "someone did it first," not a wrongly credited person. Could tie to the popular cooking hypothesis (Richard Wrangham).
- **Fit score:** 3/5 — a strong "earlier than you think" story with good peer-reviewed backing, but no famous person to topple.

### 46. Farming (Figs) — Fit 3/5
- **Planned fun fact:** Figs domesticated ~11,400 years ago, before wheat and barley.
- **Verdict:** Disputed
- **Corrected / on-air version:** "In 2006, archaeologists reported nine charred figs from Gilgal I, a village in the Jordan Valley, dated to about 11,400–11,200 years ago. The figs were a seedless type that can't spread without human help, so the team argued people were planting fig cuttings, maybe a thousand years before wheat and barley were domesticated. Other botanists pushed back: seedless-type figs can still set seed, so the finds may just be wild figs that people gathered. So figs *might* be the first crop. It's still debated."
- **Confirmed vs. inferred vs. unknown:**
  - **Confirmed:** The find, the dates, and the Kislev, Hartmann and Bar-Yosef paper in *Science* (2006, 312:1372). The published *Science* comment by Lev-Yadun, Ne'eman, Abbo and Flaishman (Dec 2006) says the finds "cannot serve as an unambiguous sign of cultivation." The authors replied. There's a further critical paper in *Antiquity*: "Early fig domestication, or gathering of wild parthenocarpic figs?"
  - **Inferred:** "Planting branches = domestication" is the original authors' interpretation.
  - **Unknown:** Whether figs truly came before cereals. Cereal cultivation had also begun by then, so "before wheat and barley" depends on what you count as domestication.
- **Sources:**
  - Science — Kislev et al. 2006, "Early Domesticated Fig in the Jordan Valley" (https://www.science.org/doi/10.1126/science.1125910).
  - Science — Lev-Yadun et al. 2006, Comment (https://www.science.org/doi/10.1126/science.1132636), and authors' Response (https://www.science.org/doi/10.1126/science.1133748).
  - Harvard Gazette — "Figs likely first domesticated crop" (https://news.harvard.edu/gazette/story/2006/06/figs-likely-first-domesticated-crop/) — the institution's framing (Bar-Yosef was at Harvard).
  - Cambridge / Antiquity — "Early fig domestication, or gathering of wild parthenocarpic figs?" (https://www.cambridge.org/core/journals/antiquity/article/abs/early-fig-domestication-or-gathering-of-wild-parthenocarpic-figs/F393E9BD44AEF08E0FA2621346AB5E23) — a further critique.
- **Best "Somebody Did It First" angle:** "Wheat gets credit as the first crop, but figs may have beaten it." It's a crop-versus-crop story, with an on-air scientific fight that can be fun to show. It must be hedged.
- **Fit score:** 3/5 — a good "earlier than you think" story with a live debate, but no wrongly credited person.

---

> **Episodes 47–52 below: UNVERIFIED THIS SESSION** (search budget exhausted, fetch blocked). The verdicts are the researcher's provisional calls from background knowledge. Sources are named as the places to verify; they were **not opened or searched**. Run a verification pass before scripting.

### 47. Money — Fit 3/5
- **Planned fun fact:** Lydian electrum coins ~600 BCE; tally sticks ~30,000 years.
- **Verdict:** Needs correction (provisional — UNVERIFIED THIS SESSION)
- **Corrected / on-air version (provisional):** "The first coins were lumps of electrum, a natural gold-silver mix, stamped in Lydia (in today's Turkey) in the late 600s BCE, before the famously rich King Croesus. But money is older than coins. Mesopotamians were paying in silver measured by weight, the shekel, more than a thousand years earlier, and Hammurabi's laws set fines in silver. Notched 'tally' bones like the Lebombo bone (about 40,000+ years) or the Ishango bone (about 20,000 years) are counting tools, not money."
- **Confirmed vs. inferred vs. unknown:** Not checked this session. From background knowledge:
  - Lydian or Ionian electrum coinage starts around 630–600 BCE (Artemision deposit at Ephesus). Croesus (reigned about 560–546 BCE) is usually credited with the first separate gold and silver coins.
  - "Tally sticks ~30,000 years" probably refers to the Dolní Věstonice wolf bone (about 30,000 years, 55 notches, found 1937). The Ishango bone is about 20,000 years old (it was once dated about 9,000). The Lebombo bone is about 43,000–44,000 years old (d'Errico et al., *PNAS* 2012, Border Cave).
  - None of these are money. Calling a tally bone "money" is wrong. Silver by weight as money in Mesopotamia, from the 3rd millennium BCE, is well established in the literature.
- **Sources (to verify — not checked):**
  - British Museum — early Lydian/Ionian electrum coins (britishmuseum.org collection pages) — dates.
  - Britannica — "coin" / "money" entries — Lydia; Croesus.
  - Royal Belgian Institute of Natural Sciences — Ishango bone (naturalsciences.be) — age.
  - d'Errico et al. 2012, *PNAS*, "Early evidence of San material culture represented by organic artifacts from Border Cave" — Lebombo bone date.
  - Penn Museum or Metropolitan Museum essays on Mesopotamian silver as currency.
- **Best "Somebody Did It First" angle:** "Croesus is the byword for coin wealth ('rich as Croesus'), but Lydian coins predate him, and Mesopotamian silver money predates coins by more than a thousand years." Moderate. Drop the tally-stick claim or reframe it as "counting before money."
- **Fit score:** 3/5 — "rich as Croesus" gives a famous hook, but the real story is "money before coins," not a single wrongly credited inventor.

### 48. Music — Fit 3/5
- **Planned fun fact:** Vulture-bone flute ~40,000 years (Hohle Fels); disputed Divje Babe "flute" ~50,000+.
- **Verdict:** Needs correction (provisional — UNVERIFIED THIS SESSION)
- **Corrected / on-air version (provisional):** "The oldest undisputed musical instruments are bird-bone and mammoth-ivory flutes from caves in southwest Germany. The Hohle Fels vulture-bone flute was published in 2009 as at least 35,000 years old, and flutes from the nearby Geissenklösterle cave have been dated to about 40,000+ years. Then there's the 'Neanderthal flute' from Divje Babe in Slovenia, a cave-bear bone with holes, around 50,000–60,000 years old. Some researchers say Neanderthals made it; others say the holes were bitten by a carnivore. If it's a flute, Neanderthals made music first."
- **Confirmed vs. inferred vs. unknown:** Not checked this session. From background knowledge:
  - Conard, Malina and Münzel, *Nature* 2009: the Hohle Fels flute is ">35,000 years."
  - Higham et al., *Journal of Human Evolution* 2012: Geissenklösterle dated about 42,000–43,000 years.
  - Divje Babe: Ivan Turk (excavator) argues it's Neanderthal-made. d'Errico and others argue the holes are carnivore damage. The dispute is unresolved.
  - "~40,000 years" for Hohle Fels specifically is a slight overstatement. Say "around 40,000 years" for the Swabian flutes as a group.
- **Sources (to verify — not checked):**
  - Nature — Conard et al. 2009, "New flutes document the earliest musical tradition in southwestern Germany."
  - *Journal of Human Evolution* — Higham et al. 2012 (Geissenklösterle dating).
  - Smithsonian / Nat Geo coverage of the Divje Babe debate; d'Errico et al. critiques.
- **Best "Somebody Did It First" angle:** "*Homo sapiens* gets credit for inventing music, but Neanderthals may have done it first." It is genuinely disputed and must be hedged.
- **Fit score:** 3/5 — the Neanderthal-vs-us angle is hooky but contested, and there's no single wrongly credited person.

### 49. Recorded Sound — Fit 5/5
- **Planned fun fact:** Scott de Martinville's phonautograph (1857 patent) recorded sound before Edison but couldn't play it back; 2008 First Sounds playback by LBNL (Au Clair de la Lune, 1860).
- **Verdict:** Confirmed (PROVISIONAL — UNVERIFIED THIS SESSION; do not script as confirmed until two sources are checked)
- **Corrected / on-air version (provisional):** "Everyone says Thomas Edison invented sound recording in 1877. But 20 years earlier, Parisian printer Édouard-Léon Scott de Martinville patented the phonautograph (1857). It traced sound waves as squiggles on soot-blackened paper. He never meant for them to be played back. In 2008, the First Sounds group worked with Lawrence Berkeley National Laboratory scientists to scan those squiggles and turn them into sound. Out came a voice singing 'Au Clair de la Lune,' recorded on April 9, 1860, 17 years before Edison. It was first thought to be a young woman. Played at the corrected speed, it's probably Scott himself, singing slowly."
- **Confirmed vs. inferred vs. unknown:** Not checked this session. From background knowledge:
  - French patent dated 25 March 1857.
  - First Sounds (David Giovannoni, Patrick Feaster and others) and LBNL's Carl Haber and Earl Cornell announced the playback in March 2008.
  - The recording is dated 9 April 1860.
  - The singer was first presented as a woman or child, then re-identified in 2009 (after the speed correction) as likely a man, probably Scott.
  - Also check: Charles Cros proposed a playback device (the "paleophone") in April 1877, months before Edison, but never built it. That's a bonus "did it first."
- **Sources (to verify — not checked):**
  - firstsounds.org — the original announcement and the 1860 recording.
  - Lawrence Berkeley National Laboratory (lbl.gov) news on the Haber/Cornell playback, 2008.
  - Library of Congress / National Recording Registry or Smithsonian coverage.
  - *New York Times*, 27 March 2008, "Researchers Play Tune Recorded Before Edison" (lead only).
- **Best "Somebody Did It First" angle:** Edison is credited, but Scott recorded human voice about 17–20 years earlier, and modern scientists finally "played" it 150 years later. This is one of the strongest hooks in the batch, if it checks out (expected).
- **Fit score:** 5/5 — a famous credited name, a documented earlier inventor, and a dramatic 2008 reveal.

### 50. Clothing — Fit 2/5
- **Planned fun fact:** Dyed wild flax fibers ~30,000 years old, Dzudzuana Cave, Georgia.
- **Verdict:** Disputed (provisional — UNVERIFIED THIS SESSION)
- **Corrected / on-air version (provisional):** "In a cave in the country of Georgia, researchers found microscopic flax fibers about 30,000 years old. Some were twisted, and some looked colored, which the team took as signs of thread and dye. Critics argue the fibers might not be worked flax at all, and the colors could have other explanations. So treat '30,000-year-old dyed thread' as a possibility, not a fact."
- **Confirmed vs. inferred vs. unknown:** Not checked this session. From background knowledge:
  - Kvavadze et al., *Science* 2009 ("30,000-Year-Old Wild Flax Fibers"): fibers dated about 30,000–36,000 years ago; some described as twisted or knotted and colored (black, grey, turquoise, pink).
  - A *Science* technical comment (Bergfjord et al., 2010) questioned the identification and interpretation, and the authors responded.
  - "Dyed" is the weakest part of the claim.
  - Separately, louse-genetics studies (e.g., Toups et al., *Molecular Biology and Evolution* 2011) estimate clothing use at about 170,000 years ago (inferred, indirect).
- **Sources (to verify — not checked):**
  - Science — Kvavadze et al. 2009; Bergfjord et al. 2010 Comment and Response.
  - Harvard Gazette / Harvard Peabody coverage (Ofer Bar-Yosef was a co-author).
  - Toups et al. 2011, *Molecular Biology and Evolution* (lice and clothing origins).
- **Best "Somebody Did It First" angle:** Weak. "Clothing is far older than you think" is a "first found" fact. There's no credited person. **Suggested replacement:** "Levi Strauss didn't invent riveted jeans; tailor Jacob Davis came up with the rivets and partnered with Strauss on the 1873 patent." Or "Charles Goodyear vs. Thomas Hancock" on vulcanized rubber. Either needs verification.
- **Fit score:** 2/5 — mostly an "oldest X found" fact, and the key detail ("dyed") is contested.

### 51. Electricity — Fit 5/5
- **Planned fun fact:** Greeks knew static from amber (Thales via later sources); Franklin's 1752 kite tested whether lightning was electrical.
- **Verdict:** Needs correction (provisional — UNVERIFIED THIS SESSION)
- **Corrected / on-air version (provisional):** "Ancient Greeks noticed rubbed amber attracts light objects. Our word 'electric' comes from *elektron*, Greek for amber. Later writers credit Thales with the observation, but nothing he wrote survives. Benjamin Franklin is famous for proving lightning is electricity with a kite in June 1752. But it was his idea that someone else tested first. On May 10, 1752, at Marly-la-Ville near Paris, following Franklin's published proposal, Thomas-François Dalibard's team drew sparks from a tall iron rod during a storm. The man who actually drew the sparks was Coiffier, an ex-soldier, while Dalibard was away. That was about a month before Franklin's kite. Franklin's own account of the kite wasn't published until that October."
- **Confirmed vs. inferred vs. unknown:** Not checked this session. From background knowledge:
  - Dalibard's Marly experiment on 10 May 1752 is well documented.
  - Delor repeated it in Paris around 18 May.
  - Franklin's kite took place in June 1752 (exact date unknown). He reported it in the *Pennsylvania Gazette* on 19 October 1752; Priestley gave a fuller account in 1767.
  - Some historians (e.g., Tom Tucker, *Bolt of Fate*, 2003) question whether the kite experiment happened as described. Hedge with "according to Franklin."
  - The Thales attribution comes through later authors (Aristotle on magnets; Diogenes Laertius). The amber attribution is later still.
- **Sources (to verify — not checked):**
  - Franklin Institute (fi.edu) — "Ben Franklin's Famous Kite Experiment" (lead).
  - Britannica — Thomas-François Dalibard; Benjamin Franklin; "electricity" history.
  - Library of Congress / Founders Online (founders.archives.gov) — Franklin's 19 Oct 1752 *Pennsylvania Gazette* letter.
  - Smithsonian Magazine coverage of the kite and Dalibard.
- **Best "Somebody Did It First" angle:** Franklin is credited. The French ran his experiment first and succeeded, with a forgotten ex-dragoon at the rod, and Franklin's own kite proof was reported months later. Very hooky.
- **Fit score:** 5/5 — a famous American icon, a documented earlier success, and a nice twist that it was Franklin's own idea.

### 52. Internet — Fit 4/5
- **Planned fun fact:** ARPANET's first message (Oct 29, 1969, UCLA to SRI) was "lo" after a crash on "login."
- **Verdict:** Confirmed (PROVISIONAL — UNVERIFIED THIS SESSION; do not script as confirmed until two sources are checked)
- **Corrected / on-air version (provisional):** "On the night of October 29, 1969, UCLA student programmer Charley Kline, working in Leonard Kleinrock's lab, tried to log in to a computer at the Stanford Research Institute. He typed 'L,' then 'O,' and the system crashed. The first message ever sent over the ARPANET was 'lo.' But ARPANET's key idea, chopping data into 'packets,' wasn't American-first only. Paul Baran at RAND and Donald Davies at Britain's National Physical Laboratory came up with it independently in the early-to-mid 1960s. Davies coined the word 'packet,' and NPL built its own packet network. France's CYCLADES network, led by Louis Pouzin, pioneered ideas that shaped TCP/IP. And the 'web' (Tim Berners-Lee, 1989–91) is a different thing from the internet."
- **Confirmed vs. inferred vs. unknown:** Not checked this session. From background knowledge:
  - The "lo" story, the 29 Oct 1969 date, Kline at UCLA and Bill Duvall at SRI are well documented (UCLA, Computer History Museum, Kleinrock's own accounts).
  - Baran's "On Distributed Communications" was published 1962–64.
  - Davies proposed packet switching in 1965–66 and coined "packet." The NPL local network ran from about 1969–70.
  - CYCLADES dates from 1972–73.
  - Cerf and Kahn published TCP in 1974.
  - Priority in packet-switching theory (Kleinrock's queuing work vs. Baran/Davies) is a historically contested claim. Hedge it.
- **Sources (to verify — not checked):**
  - Computer History Museum (computerhistory.org) — Internet history timeline; packet switching.
  - UCLA Samueli / Kleinrock Internet Heritage Site — the "lo" message.
  - Britannica — Paul Baran; Donald Davies; ARPANET.
  - National Physical Laboratory (npl.co.uk) — Davies and the NPL network.
  - IEEE (ieee.org / ETHW) — milestones for packet switching and CYCLADES.
- **Best "Somebody Did It First" angle:** "America's ARPANET is called the first internet, but Brits (Davies) and a RAND engineer (Baran) invented packet switching independently, and the French (Pouzin) pioneered the end-to-end design TCP/IP used. And Berners-Lee invented the web, not the internet." Strong. The "lo" crash is the cold open.
- **Fit score:** 4/5 — a strong multi-claimant story with a great cold open, but no single famous wrongly credited person; the priority fights are nuanced.

---

#### Batch notes

---

## Quarter 5: Food, Drink and the Table (episodes 53–65)

**Method note:** All checks came from search-engine extracts of the pages listed. No page was read in full: WebFetch is blocked (EGRESS_BLOCKED on a test fetch). The session's shared WebSearch budget (200 calls) ran out partway through episode 63. So **episodes 64 (Diner) and 65 (Fast Food), and the Song-dynasty half of 63, were NOT checked against sources this session.** Those entries come from background knowledge and are marked PROVISIONAL. They need a source pass before scripting.

---

### 53. Bread — Fit 3/5
- **Planned fun fact:** Charred flatbread in Jordan (Shubayqa 1, Natufian) ~14,400 years ago, ~4,000 years before farming (Arranz-Otaegui et al. 2018 PNAS).
- **Verdict:** Confirmed
- **Corrected / on-air version:** "At a hunter-gatherer camp in northeastern Jordan called Shubayqa 1, archaeologists found 24 charred crumbs of bread, flat and unleavened, baked about 14,400 years ago. The people who made it weren't farmers. They ground, sieved and kneaded *wild* barley, einkorn and oats, roughly 4,000 years before anyone farmed those grains." Optional hedge: "The team suggests bread may even have helped *push* people toward farming. That's a hypothesis, not a finding."
- **Confirmed vs. inferred vs. unknown:** Confirmed: 24 charred remains; fireplaces radiocarbon-dated to 14.4–14.2 ka cal BP; early Natufian; wild cereals ground, sieved and kneaded; ~4,000 yrs before the Neolithic. Inferred: that bread production encouraged cereal cultivation (the authors' suggestion). Note: it was flatbread, so say nothing about leavening.
- **Sources:**
  - Arranz-Otaegui et al., PNAS 2018, "Archaeobotanical evidence reveals the origins of bread 14,400 years ago in northeastern Jordan" (https://www.pnas.org/doi/10.1073/pnas.1801071115). Supports dates, site, 24 remains, ingredients.
  - EurekAlert (Univ. of Copenhagen release), "Archaeologists discover bread that predates agriculture by 4,000 years" (https://www.eurekalert.org/news-releases/825504). Supports the 4,000-years-before-farming framing.
  - Sci.News (lead only), "Flatbread Baked 14,400 Years Ago Found in Jordan" (https://www.sci.news/archaeology/natufian-flatbread-jordan-06210.html).
- **Best "Somebody Did It First" angle:** Popular credit goes to ancient Egyptians ("they invented bread") or, more broadly, to the first farmers. Natufian hunter-gatherers were baking 4,000 years before farming, and many millennia before Egypt. The evidence is solid (peer-reviewed, dated, 24 samples). The weak spot is that no famous person is wrongly credited.
- **Fit score:** 3/5. Strong "earlier than you think" story; the credited party is a vague "Egyptians/farmers".

### 54. Salt and Spices — Fit 2/5
- **Planned fun fact:** Roman soldiers paid in salt is mostly myth; "salary" from Latin salarium (salt), exact link unclear (Peter Gainsford's analysis; Pliny Natural History 31.89 is the main ancient source).
- **Verdict:** Confirmed
- **Corrected / on-air version:** "You've heard Roman soldiers were paid in salt, which is where we get 'salary.' Half of that is true. 'Salary' really does come from Latin *salarium*, which is linked to *sal*, salt. But no ancient source says soldiers were paid in salt. They were paid in coin, mostly silver, three times a year, with deductions for food and clothing. The 'paid in salt' story seems to be a much later invention. It grew out of one line in Pliny the Elder, who said only that the word for pay came from salt. Nobody knows exactly why. One guess is an allowance for buying salt."
- **Confirmed vs. inferred vs. unknown:** Confirmed: the etymology salarium < sal; Roman soldiers paid in coin (stipendium, three installments, deductions); no ancient source says pay in salt. Inferred: Gainsford traces the myth to a 19th-century embellishment, and a widely quoted "Pliny says soldiers were paid in salt" line isn't in Pliny. Unknown: the actual mechanism behind *salarium* (salt allowance? Via Salaria? something else).
- **Sources:**
  - Peter Gainsford (classicist), The Conversation, "Our pay is called a 'salary', but were Roman soldiers really paid in salt?" (https://theconversation.com/our-pay-is-called-a-salary-but-were-roman-soldiers-really-paid-in-salt-290057). Republished by phys.org Sept 2026 (https://phys.org/news/2026-09-pay-salary-roman-soldiers-paid.html). Supports all core points.
  - Gainsford's own longer analysis, Kiwi Hellenist, "Salt and salary: were Roman soldiers paid in salt?" (https://kiwihellenist.blogspot.com/2017/01/salt-and-salary.html). Same author, so not fully independent.
  - Wordorigins.org, "salary" (https://www.wordorigins.org/big-list-entries/salary). An independent etymology source; Dave Wilton's site is reputable but not peer-reviewed.
  - Primary: Pliny, *Natural History* 31.89. It ties *salaria* to salt "in honours and military service" but does not say soldiers were paid in salt.
- **Best "Somebody Did It First" angle:** Weak. This is a myth-bust, not a "who was first" story. Two possible stronger reframes: (a) a "the Romans didn't start the salt economy" angle on prehistoric salt production (e.g., early Neolithic brine-boiling sites in Romania, ~6000 BCE); (b) spices: black peppercorns found in the nostrils of Ramesses II's mummy (~1213 BCE) show Indian pepper reached Egypt long before the Roman or Venetian spice trade gets the credit. Both are leads only; neither was checked this session.
- **Fit score:** 2/5. Good myth-bust, no wrongly credited "first". Consider rebuilding the episode around the Ramesses-pepper angle.

### 55. Sugar — Fit 4/5
- **Planned fun fact:** Reached Europe as an apothecary medicine (Sidney Mintz, "Sweetness and Power", 1985). Also the did-it-first angle: sugar crystallisation in India (Gupta era, khanda/"candy"), New Guinea domestication.
- **Verdict:** Needs correction
- **Corrected / on-air version:** "When sugar first reached medieval Europe it was a luxury sold by apothecaries. It sat on the shelf beside pepper and cinnamon and was prescribed for coughs and fevers. Long before that, people in New Guinea had domesticated sugarcane, thousands of years ago. And Indians worked out how to boil cane juice into solid crystals, which is where words like 'sugar' (from Sanskrit *śarkarā*, 'grit') and probably 'candy' (from *khanda*) come from. Greek and Roman writers already knew about Indian sugar by the 1st century AD." Drop "Gupta era" as *the* date of the invention, or say "by the Gupta period at the latest".
- **Confirmed vs. inferred vs. unknown:** Confirmed: sugar was used as medicine and spice in medieval Europe and sold in apothecary shops (Mintz lists five uses: spice, medicine, decoration, sweetener, preservative); New Guinea is the region of sugarcane domestication. Needs correction: the specific "Gupta dynasty, ~5th c. AD, invented crystallisation" claim comes mostly from popular sites. Better sources (The Conversation / phys.org 2026) put crystallised sugar in India at least by the start of the common era, and possibly ~500 BCE. Inferred: the Sanskrit khanda → Persian qand → Arabic qandi → "candy" chain is standard etymology but was not checked this session. Unknown: the exact date of first crystallisation. The New Guinea date of "8,000–10,000 years ago" appears only in secondary sources.
- **Sources:**
  - Sidney Mintz, *Sweetness and Power* (1985), via Penguin Random House (https://www.penguinrandomhouse.com/books/322123/sweetness-and-power-by-sidney-w-mintz/) and a Mintz chapter PDF hosted at Vanderbilt (https://cdn.vanderbilt.edu/vu-my/wp-content/uploads/sites/1414/2014/04/14122105/Session_04_Mintz.pdf). Support sugar as medicine/spice and the five uses.
  - The Conversation, "A brief history of sugar" (https://theconversation.com/a-brief-history-of-sugar-266189), also on phys.org (https://phys.org/news/2026-01-history-sugar.html). Supports Indian crystallisation ~500 BCE to the start of the common era.
  - PMC review, "A short review on sugarcane: its domestication, molecular manipulations and future perspectives" (https://pmc.ncbi.nlm.nih.gov/articles/PMC9483297/). Supports New Guinea domestication.
  - Only one strong source each for the crystallisation date and the New Guinea date. Add Christian Daniels in Needham, *Science and Civilisation in China* Vol. 6 Pt 3 (1996, "Sugarcane Technology"), for a scholarly anchor.
- **Best "Somebody Did It First" angle:** Europeans (and Caribbean plantations) get the credit as the "sugar" story. In fact New Guinea farmers domesticated the cane, Indian craftsmen invented crystal sugar many centuries earlier, and Persians and Arabs spread the refining technique before Europe saw it. The evidence is solid in outline; specific dates are fuzzy.
- **Fit score:** 4/5. Clear "the West gets the credit, others did it first" arc, but no single famous credited name.

### 56. Coffee — Fit 4/5
- **Planned fun fact:** Kaldi and the goats has no evidence (first appears in Antoine Faustus Nairon 1671); earliest credible coffee drinking in 15th-century Sufi monasteries in Yemen (Ralph Hattox, "Coffee and Coffeehouses"; al-Jaziri's 1587 account).
- **Verdict:** Needs correction (minor)
- **Corrected / on-air version:** "Every coffee shop tells you about Kaldi, the Ethiopian goatherd whose goats got the jitters from coffee cherries. There's no evidence for it. The goat story first shows up in print in 1671, in a Latin treatise by Antoine Faustus Nairon in Rome. That's roughly 800 years after it supposedly happened. And in Nairon's version the herder has no name and lives in Yemen ('Arabia Felix'), not Ethiopia. The name 'Kaldi' comes from much later retellings. The earliest solid evidence of people actually drinking coffee is from the 1400s, in Sufi monasteries in Yemen, where it kept worshippers awake through night-time devotions." Hedge: "The coffee *plant* is native to Ethiopia; it's the *drink* that's first documented in Yemen."
- **Confirmed vs. inferred vs. unknown:** Confirmed: the earliest substantiated evidence of coffee drinking is 15th-century Yemeni Sufi circles (Britannica, NCA); the Kaldi tale first appears in Nairon 1671 (multiple sources, but none institutional in my extracts). Correction: Nairon's herder is unnamed and set in Yemen. The name "Kaldi" seems to have been popularised (perhaps introduced) by later European retellings, notably Ukers' *All About Coffee* (1922). Whether Ukers invented the name is Unknown. Not checked this session: Hattox's discussion of al-Jaziri's 1587 *ʿUmdat al-ṣafwa* (the standard source for the Yemen Sufi narrative and figures such as al-Dhabhani). It's standard scholarship, so cite Hattox (Univ. of Washington Press, 1985) directly.
- **Sources:**
  - Britannica, "History of coffee" (https://www.britannica.com/topic/history-of-coffee). Supports 15th-century Yemen Sufi monasteries as the earliest substantiated evidence.
  - National Coffee Association, "History of coffee" (https://www.ncausa.org/about-coffee/history-of-coffee). Supports the Yemen/Mocha spread. Industry body; adequate for this.
  - JSTOR Daily, "How Coffee Went from a Mystical Sacrament to an Everyday Drink" (https://daily.jstor.org/how-coffee-went-from-a-mystical-sacrament-to-an-everyday-drink/). Supports the Sufi context.
  - Nairon 1671 and the unnamed herder: lead sources only (Wikipedia "Kaldi" https://en.wikipedia.org/wiki/Kaldi; a Substack essay https://davidtsirekas.substack.com/p/the-bean-is-not-a-bean-the-goat-had). Only lead-grade sources for the Nairon/Ukers detail. Before airing, confirm from Nairon's *De saluberrima potione cahue* (1671, digitised) or Ukers 1922 (public domain).
- **Best "Somebody Did It First" angle:** The legend credits Kaldi and Ethiopia; the historical record credits Yemeni Sufis. Bonus twist: the legend itself was first written by a Lebanese Maronite scholar in Rome as coffee PR, 800 years after the fact. The evidence for the Yemen origin is solid; the Kaldi details need one more check.
- **Fit score:** 4/5. Famous credited figure (Kaldi) plus a documented earlier group; a tiny bit less hooky than a named inventor.

### 57. Chocolate — Fit 4/5
- **Planned fun fact:** Cacao residue from Ecuador's Amazon (Santa Ana-La Florida, Mayo-Chinchipe culture) ~5,300 years ago (Zarrillo et al. 2018 Nature Ecology & Evolution). Angle: chocolate is credited to Mesoamerica (Olmec/Maya/Aztec) but domestication started in South America ~1,500 years earlier.
- **Verdict:** Confirmed
- **Corrected / on-air version:** "Everyone credits chocolate to the Aztecs and Maya. But cacao starch, theobromine and even cacao DNA turn up inside pottery from Santa Ana-La Florida, in the Ecuadorian Amazon, about 5,300 years old. That makes the Mayo-Chinchipe people of South America at least 1,500 years earlier than the first known cacao use in Central America. A 2024 study of 352 vessels backed this up: cacao was domesticated in the upper Amazon and spread from there." Hedge: "We know they *used* cacao. We don't know whether it was a drink, a food, or something else, and nobody's calling it a chocolate bar."
- **Confirmed vs. inferred vs. unknown:** Confirmed: three independent lines of evidence (cacao-specific starch grains, theobromine, ancient DNA) from Mayo-Chinchipe ceramics, dated ~5,300–2,100 years ago; ≥1,500 years before Mesoamerican use. The 2024 Lanaud et al. study (Scientific Reports) independently supports domestication in the Ecuadorian Amazon by ≥5,300 years ago, with spread along the Pacific coast by ~5,000 years ago. Inferred: "domestication" (as opposed to wild harvesting) rests partly on genetics. Unknown: how it was consumed.
- **Sources:**
  - Zarrillo et al., Nature Ecology & Evolution 2018, via Science News (https://www.sciencenews.org/article/ancient-south-americans-tasted-chocolate-1500-years-anyone-else). Supports 5,300 yrs, three lines of evidence, ≥1,500 yrs earlier.
  - UBC News, "Sweet discovery: New UBC study pushes back the origins of chocolate" (https://news.ubc.ca/2018/10/sweet-discovery-new-ubc-study-pushes-back-the-origins-of-chocolate/). Lead author's institution.
  - Lanaud et al., Scientific Reports 2024, "A revisited history of cacao domestication in pre-Columbian times revealed by archaeogenomic approaches" (https://www.nature.com/articles/s41598-024-53010-6). Independent confirmation.
  - ABC News (Australia) coverage (https://www.abc.net.au/news/science/2018-10-30/origins-of-chocolate-rewritten-by-archaeology-find-in-ecuador/10434798).
- **Best "Somebody Did It First" angle:** The Aztecs, Maya and Olmec get the credit (and Cortés gets credit for bringing it to Europe). The Amazonian Mayo-Chinchipe used cacao about 1,500 years earlier. Evidence: two peer-reviewed studies with chemical and DNA lines. Very solid.
- **Fit score:** 4/5. Famous credited civilisations, solid earlier evidence; no single named person.

### 58. Cheese — Fit 2/5
- **Planned fun fact:** Oldest solid cheese ~3,200 years old in an Egyptian tomb (Ptahmes, Saqqara; Greco et al. 2018 Analytical Chemistry), with Brucella bacteria; cheesemaking ~7,000 years in Poland (Salque et al. 2013 Nature, sieve residues ~7,200-6,800 yrs). Also check 2024 Xiaohe (China) kefir cheese ~3,600 years (Cell 2024) which may be older than Ptahmes as "oldest cheese".
- **Verdict:** Needs correction
- **Corrected / on-air version:** "The title of world's oldest *actual* cheese now goes to China. Lumps of kefir cheese found on Bronze Age mummies at the Xiaohe cemetery in the Tarim Basin are about 3,600 years old, and in 2024 scientists sequenced its DNA. A 3,200-year-old cheese from the Egyptian tomb of Ptahmes at Saqqara, a mayor of Memphis, was hailed as the oldest solid cheese in 2018. It was also probably laced with *Brucella*, the bacterium behind brucellosis. But cheesemaking itself is far older than either. Pottery sieves from Neolithic Poland still carry milk-fat residues from around 7,000 years ago, and a separate study found cheese residues in Croatia from about 7,200 years ago."
- **Confirmed vs. inferred vs. unknown:** Confirmed: Ptahmes cheese (19th Dynasty, ~3,200 yrs; sheep/goat + cow milk; *Brucella melitensis* peptide; Greco et al. 2018); Xiaohe kefir cheese ~3,600 yrs (Cell 2024, Qiaomei Fu's team; goat and cattle DNA; kefir microbes), which is older than Ptahmes, so drop "oldest" from Ptahmes; Salque et al. 2013 Nature, milk residues in Kuyavia (Poland) sieves, "sixth millennium BC". Note: some 2012 press headlines said "7,500 years"; use "about 7,000 years" to match the paper's ~5200–4800 BC range. Inferred: the *Brucella* finding implies infection risk; it's a peptide marker, not a live culture. Also note that Xiaohe cheese was already identified as cheese in 2014 (Yang et al.), so the Ptahmes "oldest" headline was contestable even in 2018.
- **Sources:**
  - Greco et al. 2018, Analytical Chemistry, via phys.org (https://phys.org/news/2018-08-world-oldest-cheese-egyptian-tomb.html) and C&EN/ACS (https://cen.acs.org/biological-chemistry/proteomics/Original-deli-delights-discovered/96/i34). Supports Ptahmes, ~3,200 yrs, Brucella.
  - Cell 2024 (Fu et al.), via CNN (https://www.cnn.com/2024/09/25/science/oldest-cheese-ancient-dna-china-mummies), Science News (https://www.sciencenews.org/article/oldest-ancient-cheese-origins) and ScienceDaily (https://www.sciencedaily.com/releases/2024/09/240925122859.htm). Supports Xiaohe ~3,600 yrs, oldest cheese.
  - Salque et al. 2013, Nature, "Earliest evidence for cheese making in the sixth millennium BC in northern Europe" (https://www.nature.com/articles/nature11698). Supports Polish sieves.
  - McClure et al. 2018, PLOS ONE, "Fatty acid specific δ13C values reveal earliest Mediterranean cheese production 7,200 years ago" (https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6124750/). Croatia, ~7,200 yrs.
- **Best "Somebody Did It First" angle:** Weak. There's no famous wrongly credited cheesemaker. The only "credit" is the folk assumption that cheese belongs to France, Switzerland or Rome, or the old "Arab traveller carried milk in a stomach pouch" legend. You could frame "Europe's famous cheeses vs. Neolithic Polish farmers and Bronze Age Chinese kefir", but it's an "oldest X" story at heart.
- **Fit score:** 2/5. A great "oldest cheese" fact plus a correction, but a poor fit for the premise. Pair it with Beer and Wine, or recast it as "the 2018 'oldest cheese' was dethroned".

### 59. Beer and Wine — Fit 4/5
- **Planned fun fact:** Raqefet Cave brewing ~13,000 years ago (Liu et al. 2018, J. Archaeological Science: Reports — contested); earliest grape wine ~6000 BC in Georgia (McGovern et al. 2017 PNAS, Gadachrili Gora / Shulaveris Gora). Also Jiahu, China ~7000 BCE mixed fermented beverage (McGovern 2004 PNAS) as earliest alcoholic drink.
- **Verdict:** Confirmed (Raqefet must stay hedged)
- **Corrected / on-air version:** "We credit beer to the Egyptians and Sumerians, and wine to France, Greece or Rome. But the oldest chemically confirmed alcoholic drink comes from Jiahu in China, around 7000 BC: a brew of rice, honey and hawthorn fruit or grape. The oldest grape wine comes from Neolithic Georgia, about 6000 to 5800 BC, at two villages south of Tbilisi. That's 600 to 1,000 years before the previous record from Iran. And one team argues Natufian people in Israel's Raqefet Cave were brewing a beer-like gruel 13,000 years ago, before farming. Other archaeologists aren't convinced, so treat that one as 'possibly'."
- **Confirmed vs. inferred vs. unknown:** Confirmed: Jiahu fermented beverage ~7000–6600 BC (McGovern 2004 PNAS; Penn Museum). Georgian wine ~6000–5800 BC, identified by tartaric acid (McGovern 2017 PNAS), earlier than Hajji Firuz (~5400–5000 BC). Disputed: Raqefet Cave. Liu et al. 2018 rest on starch-granule damage patterns matching experimental malting. Eitam published a critique and Liu et al. replied (2019), so frame it as a claim. Inferred: "fermented"/"alcoholic" at Jiahu and Georgia is inferred from residue chemistry, which is standard practice, but say "chemical traces of".
- **Sources:**
  - McGovern et al. 2004, PNAS, "Fermented beverages of pre- and proto-historic China" (https://www.pnas.org/doi/pdf/10.1073/pnas.0407921102) and Penn Museum, "The Earliest Alcoholic Beverage in the World" (https://www.penn.museum/research/project.php?pid=12). Jiahu.
  - McGovern et al. 2017, PNAS, "Early Neolithic wine of Georgia in the South Caucasus" (https://www.pnas.org/doi/pdf/10.1073/pnas.1714728114) and Univ. of York research database (https://pure.york.ac.uk/portal/en/publications/early-neolithic-wine-of-georgia-in-the-south-caucasus/). Georgian wine.
  - Liu et al. 2018 via ScienceDaily (Stanford release) (https://www.sciencedaily.com/releases/2018/09/180912111907.htm), plus the authors' "Response to comments on archaeological reconstruction of 13,000-y old Natufian beer making at Raqefet Cave" (https://www.academia.edu/41517273/). Raqefet, and the fact that it's contested.
- **Best "Somebody Did It First" angle:** Egypt and Mesopotamia get credit for beer, and France or the classical Mediterranean for wine. China (Jiahu) beat the Near East to fermented drink by 500+ years, Georgia holds the grape-wine record, and the Natufians may predate everyone. The evidence is strong for Jiahu and Georgia (PNAS, chemistry) and contested for Raqefet.
- **Fit score:** 4/5. Famous credited cultures with clear chemically documented earlier makers; no single named person.

### 60. Pizza — Fit 5/5
- **Planned fun fact:** Margherita-for-the-queen (1889) story is shaky (Zachary Nowak 2014 "Folklore, Fakelore, and Food" re: Brandi's letter of authenticity being likely forged; earlier 1830s/1866 references to tomato-mozzarella-basil pizza, e.g. Francesco de Bourcard).
- **Verdict:** Needs correction
- **Corrected / on-air version:** "The legend: in 1889, Naples pizzaiolo Raffaele Esposito invents a tomato, mozzarella and basil pizza in the colours of the Italian flag for Queen Margherita, and gets a thank-you letter from the palace. The problem: historian Zachary Nowak looked hard at that letter. The seal is in the wrong place, the handwriting doesn't match the official who supposedly signed it, and it's addressed using his wife's surname, 'Brandi'. Nowak thinks it was probably made up later, likely by the Brandi family, who ran the pizzeria from the 1930s, as marketing. And the pizza itself was already around. In 1858 a Neapolitan writer, Emmanuele Rocco, described pizzas topped with basil, thin slices of mozzarella, and sometimes tomato, three decades before the queen's supposed visit."
- **Confirmed vs. inferred vs. unknown:** Confirmed: Nowak 2014 (title is "Folklore, Fakelore, History: Invented Tradition and the Origins of the Pizza Margherita", published in *Food, Culture & Society*; the journal name comes from memory, not this session's search) identifies the letter's problems. The Rocco description appears in de Bourcard's *Usi e costumi di Napoli e contorni*. Corrections: (1) the pizza passage is by **Emmanuele Rocco**, in a volume *edited* by Francesco de Bourcard; (2) the date is **1858** (vol. 2), with 1866 being a later edition; (3) Rocco lists tomato as one *optional* topping among combinations, and **does not name it "Margherita"**. One search extract claims de Bourcard "specifically names the Margherita"; that is wrong, so don't repeat it. Inferred: forgery by the Brandi family is Nowak's hypothesis, not proven. Unknown: whether Esposito served the queen anything at all. The "1830s" reference wasn't checked.
- **Sources:**
  - Zachary Nowak 2014, "Folklore, Fakelore, History: Invented Tradition and the Origins of the Pizza Margherita" (https://www.researchgate.net/publication/263340437_Folklore_Fakelore_History_Invented_Tradition_and_the_Origins_of_the_Pizza_Margherita). Letter analysis.
  - Scott's Pizza Tours, "Today is the 125th Anniversary of the Pizza Margherita Myth" (https://www.scottspizzatours.com/blog/today-is-the-125th-anniversary-of-the-pizza/). Secondary; summarises Nowak.
  - Rocco / de Bourcard, 1858: storienapoli.it (https://storienapoli.it/2020/09/27/la-vera-storia-pizza-margherita/) and angeloforgione.com (https://angeloforgione.com/2022/03/16/inesattezze_pizza_pomodoro_mozzarella/). Italian secondary sources only. **Only one strong source (Nowak) was found.** Before airing, cite the primary *Usi e costumi* text (digitised on Google Books / Internet Archive) and the published Nowak article.
- **Best "Somebody Did It First" angle:** Raffaele Esposito gets credit for inventing the Margherita for the queen. Neapolitan pizzaioli were already selling tomato-mozzarella-basil pizza decades earlier, and the documentary proof of the royal story looks forged. Evidence: good for the earlier pizzas, fairly strong (but argued) for the forgery.
- **Fit score:** 5/5. Famous named credited inventor, famous story, documented earlier versions, plus a forged-letter twist.

### 61. Ice Cream — Fit 4/5
- **Planned fun fact:** Marco Polo bringing ice cream is a myth (Oxford Companion to Food / Alan Davidson; Jeri Quinzio "Of Sugar and Snow"). Also the Catherine de' Medici myth; real angle: Arab/Persian sherbets, Naples sorbetti (Antonio Latini 1690s), the endothermic salt-ice freezing technique documented in 13th-c Arabic (Ibn Abi Usaybi'a) / 16th c Italy (Zimara? Giambattista della Porta).
- **Verdict:** Needs correction (minor)
- **Corrected / on-air version:** "Marco Polo didn't bring ice cream back from China, and Catherine de' Medici didn't carry it to France. Food historians find no evidence for either story. The real breakthrough was a trick: mix salt or saltpetre into ice or snow and it gets colder than ice alone, cold enough to freeze things. A 13th-century Arab physician, Ibn Abi Usaybi'a, recorded that saltpetre chills water, crediting an earlier physician from 1029. In 1530 a Padua professor, Zimara, wrote it up as a 'new discovery'. By 1558 Giambattista della Porta was describing how to freeze wine to slush in snow and saltpetre. A century later, in the 1690s, Antonio Latini, steward to the Spanish viceroy in Naples, printed some of the first sorbetto recipes, including chocolate and even aubergine."
- **Confirmed vs. inferred vs. unknown:** Confirmed: the Marco Polo and Catherine stories are myths (PBS, and History.com noting European ices only appear in early-1600s Italy, a century after Catherine). Della Porta's snow-plus-saltpetre wine chilling is in *Magia Naturalis* (Chemistry World). Correction: Ibn Abi Usaybi'a documented saltpetre *chilling water*, not freezing food. Dissolving saltpetre in water alone won't freeze sorbet; the freezing method is salt/saltpetre *mixed with ice or snow*. So "the freezing technique was documented in 13th-c. Arabic" overstates it. Say "the cooling power of saltpetre". Inferred: Latini's 1692/1694 *Lo scalco alla moderna* is "the first" sorbetto recipes; sources say "among the first published". Unknown: who first froze a sweetened dairy mixture. History.com notes claims about Tang-dynasty frozen milk dishes, which are poorly sourced. The Oxford Companion to Food wording wasn't checked directly.
- **Sources:**
  - PBS Food, "Explore The Delicious History of Ice Cream" (https://www.pbs.org/food/stories/explore-the-delicious-history-of-ice-cream). Both myths "not likely true".
  - History.com, "Who Invented Ice Cream?" (https://www.history.com/articles/where-do-ice-cream-sorbet-frozen-desserts-come-from). Marco Polo contested; European ices early 1600s, after Catherine.
  - Jeri Quinzio, *Of Sugar and Snow* (UC Press 2009), JSTOR record (https://www.jstor.org/stable/10.1525/j.ctt7zw39d). Myth-busting history; the specific passages weren't read.
  - Chemistry World, "Della Porta's salt bath" (https://www.chemistryworld.com/opinion/della-portas-salt-bath/4012036.article). Della Porta.
  - Dan Jurafsky, *The Language of Food* blog, "Ice cream" (http://languageoffood.blogspot.com/2011/07/ice-cream.html). Ibn Abi Usaybi'a, Ibn Bakhtawayh 1029, Zimara 1530. A Stanford linguist's blog that became his 2014 book; decent but single-source.
- **Best "Somebody Did It First" angle:** Marco Polo and Catherine de' Medici get the credit. The cooling science came from the medieval Arab world and was rediscovered by 16th-century Italian scholars, and the first sorbetto recipes were printed in Spanish-ruled Naples. The myth-bust is solid; the chain of transmission is plausible but partly inferred.
- **Fit score:** 4/5. Two famous wrongly credited names, with documented earlier contributors.

### 62. Food Preservation — Fit 4/5
- **Planned fun fact:** Napoleon-era prize won by Nicolas Appert for canning (1810); Pasteur later explained why (1860s). Check the 12,000-franc figure and whether a prize was formally offered (historians say there was no formal open prize; Appert got an award from the Bureau of Arts and Manufactures in exchange for publishing his method). Also: Peter Durand's 1810 tin-can patent (British) — Appert used glass; Bryan Donkin & John Hall commercialised tin cans.
- **Verdict:** Disputed (on the "prize" framing). The rest is confirmed.
- **Corrected / on-air version:** "The story goes that Napoleon offered a prize for preserving army food and a Paris confectioner, Nicolas Appert, won it. What's documented is this. In 1810 France's Ministry of the Interior paid Appert 12,000 francs, on condition that he publish his method. He did, that same year, in *The Art of Preserving All Kinds of Animal and Vegetable Substances*. Whether there was ever a formal, pre-announced government contest that he 'won' is shakier. It's often dated to 1795, before Napoleon was in power. Appert sealed food in corked glass bottles and boiled them. He had no idea why it worked. Louis Pasteur explained microbes about fifty years later. Meanwhile in London, also in 1810, Peter Durand patented the same idea using tin cans. He sold the patent to Bryan Donkin and John Hall, whose firm opened the world's first canning factory in 1813."
- **Confirmed vs. inferred vs. unknown:** Confirmed: 12,000 francs paid in 1810, conditional on publication (Britannica, Smithsonian); 1810 book; corked glass bottles boiled; House of Appert cannery at Massy from 1812; Durand's patent of 25 Aug 1810 for tin, sold 1811 to Donkin & Hall, factory 1813 (Graces Guide, Can Manufacturers Institute); Pasteur explained the mechanism later (Smithsonian). Disputed: the 1795 "prize offered by the Directory/army". Britannica accepts it ("inspired by the French Directory's offer of a prize"). Other accounts say the 1810 payment was an ex gratia award, not a contest win, and that the 1795 pre-announced prize is poorly documented (Nesta's historical-prizes guide treats it as a prize; Wikipedia's account describes an ex gratia payment). On air: "French authorities paid him", not "he won Napoleon's prize". Unknown: whether any 1795 decree exists (no primary text was found).
- **Sources:**
  - Britannica, "Nicolas Appert" (https://www.britannica.com/biography/Nicolas-Appert). 1810 award of 12,000 francs conditional on publication; glass bottles; Massy cannery; mentions the Directory prize.
  - Smithsonian, "The Father of Canning Knew His Process Worked, But Not Why It Worked" (https://www.smithsonianmag.com/smart-news/father-canning-knew-his-process-worked-not-why-it-worked-180961960/). Appert, and Pasteur explaining it later.
  - Graces Guide, "Peter Durand" (https://www.gracesguide.co.uk/Peter_Durand) and Can Manufacturers Institute, "Invention" (https://www.cancentral.com/invention/). Durand's 1810 tin patent, Donkin & Hall, 1813 factory.
  - Nesta, "The French Food Preservation Prize" (https://www.nesta.org.uk/feature/guide-historical-challenge-prizes/the-french-food-preservation-prize/). Prize framing; consult it for the dispute.
  - IFT, "More Light on the Dawn of Canning" (https://www.ift.org/news-and-publications/food-technology-magazine/issues/2007/may/features/more-light-on-the-dawn-of-canning). Likely detail on the prize question; not read.
- **Best "Somebody Did It First" angle:** Two strong options. (a) **Pasteur vs. Appert**: Pasteur is the household name for killing food microbes with heat ("pasteurisation"), but Appert was heat-sterilising sealed food about 50 years earlier, without knowing why it worked. (b) **Durand vs. Appert**: the Englishman holds the tin-can patent, but the Frenchman developed the method first, in glass. Both are well documented.
- **Fit score:** 4/5. Pasteur is a famous credited name and the earlier doer is well documented. It loses a point because Pasteur is credited with *explaining* spoilage, not inventing canning, so the framing needs care.

### 63. Restaurant — Fit 4/5
- **Planned fun fact:** "Restaurant" meant a restorative broth; Boulanger 1765 origin disputed (Rebecca Spang, "The Invention of the Restaurant", 2000 — Mathurin Roze de Chantoiseau ~1766 as the real founder). Also the older angle: Song dynasty Kaifeng/Hangzhou restaurants with menus (~11th-12th c.), which arguably did it first.
- **Verdict:** Confirmed (Paris part). The Song part is PROVISIONAL and was not checked against strong sources.
- **Corrected / on-air version:** "In 18th-century Paris, a *restaurant* wasn't a place. It was a restorative broth, a concentrated meat bouillon for people with weak constitutions. The usual story says a soup-seller named Boulanger opened the first restaurant in 1765. Historian Rebecca Spang went looking and found no contemporary evidence for Boulanger's shop. The first documented 'restaurateur' was Mathurin Roze de Chantoiseau, around 1766. He sold restorative broths at individual tables and listed his business in his own trade directory. But Paris was hundreds of years late. In 12th-century China, the Song-dynasty capitals Kaifeng and Hangzhou had restaurants with long lists of dishes, waiters taking orders, and places catering to different budgets and regional cuisines." Hedge for China: "Historians argue these were restaurants in every way that matters."
- **Confirmed vs. inferred vs. unknown:** Confirmed: "restaurant" originally meant a restorative bouillon; Spang's book (Harvard UP, 2000) debunks the Boulanger story and puts Roze de Chantoiseau first (HUP page; Paris Food History blog). Date: sources give 1766 or 1767, so say "around 1766". Spang's argument is about Boulanger *lacking documentation*, not that he definitely never existed. Phrase it as "no evidence". PROVISIONAL: Song restaurants with menus, waiters and specialised eateries. Search extracts only reached Wikipedia, a Wikipedia mirror and China Daily, none of which count. Strong sources to cite: Meng Yuanlao's *Dongjing meng Hua lu* (1147), a memoir of Kaifeng; Wu Zimu's *Mengliang lu* (1274), on Hangzhou; Jacques Gernet, *Daily Life in China on the Eve of the Mongol Invasion* (1962); Michael Freeman, "Sung", in K.C. Chang (ed.), *Food in Chinese Culture* (Yale 1977); Nicholas Kiefer, "Economics and the Origin of the Restaurant", *Cornell HRA Quarterly* (2002). Check them before airing.
- **Sources:**
  - Harvard University Press, Rebecca Spang, *The Invention of the Restaurant* (https://www.hup.harvard.edu/books/9780674241770). Book description: broth origin, Roze de Chantoiseau.
  - Paris Food History blog (Jim Chevallier, food historian), "Boulanger and the restaurant: the snowballing of a myth" (http://parisfoodhistory.blogspot.com/2018/07/boulanger-and-restaurant-snowballing-of.html) and "The inventor of the restaurant" (https://parisfoodhistory.blogspot.com/2018/05/the-inventor-of-restaurant-eighteenth.html). Independent support. A blog by a published food historian; medium strength.
  - Song China: **no strong source verified this session.** See the list above.
- **Best "Somebody Did It First" angle:** Boulanger (and Paris) gets the credit. Roze de Chantoiseau is the documented Paris pioneer, and Song China had full-service restaurants with menus about 600 years before Paris. The Paris correction is strong; the China priority is widely accepted by food historians but needs source confirmation here.
- **Fit score:** 4/5. A named, credited "inventor" who may not have existed, a documented replacement, and a much earlier civilisation.

### 64. Diner — Fit 2/5
- **Planned fun fact:** Walter Scott's night lunch wagon in Providence, 1872 (American Diner Museum, Smithsonian); Greek-owned diners came later. Verify.
- **Verdict:** Confirmed, PROVISIONAL. Not checked this session (search budget exhausted, WebFetch blocked). Re-check before scripting.
- **Corrected / on-air version (provisional):** "The American diner didn't start as a railroad car. It started in 1872 in Providence, Rhode Island, when Walter Scott turned a horse-drawn freight wagon into a night-time food cart. He parked it outside the *Providence Journal* offices and sold sandwiches, pie and coffee to newspapermen and night-shift workers after the restaurants closed. Lunch wagons spread across New England. Then came prefabricated 'lunch cars' from builders like the Worcester Lunch Car Company (1906), and only later the name 'diner', borrowed from railroad dining cars. Greek immigrant owners became the face of the diner much later, especially in the post-war New York and New Jersey area."
- **Confirmed vs. inferred vs. unknown:** From background knowledge (not checked this session): Walter Scott, Providence, 1872, horse-drawn wagon serving night workers outside the Providence Journal. This is the standard account from diner historian Richard J.S. Gutman (*American Diner Then and Now*), echoed by the Smithsonian NMAH and Johnson & Wales University's culinary museum, which holds Gutman's collection. The Smithsonian/Gutman detail that Scott had sold food from a basket since the 1850s is also from memory. Samuel Jones's walk-in lunch wagon (Worcester, 1880s) and Charles Palmer's 1891 lunch-wagon patent are also from memory. The Greek-owned-diner era (mid-20th century, NY/NJ) is inferred from general knowledge. Note that the "American Diner Museum" is a small Providence nonprofit, not a major institution.
- **Sources (to verify; NOT accessed this session):**
  - Richard J.S. Gutman, *American Diner Then and Now* (Johns Hopkins University Press, 2000).
  - Smithsonian National Museum of American History, diner/lunch wagon collections (americanhistory.si.edu). Exact page URL not verified.
  - Johnson & Wales University Culinary Arts Museum (Gutman diner collection). URL not verified.
  - **No sources checked this session. Do not air until two of these are confirmed.**
- **Best "Somebody Did It First" angle:** Weak. Possible framings: "the diner is credited to the railroad dining car, but it began as a horse-drawn lunch wagon", or "Greek families are synonymous with diners, but a Providence Yankee started it". Neither involves a famous wrongly credited person. Consider folding this into Fast Food (#65) as one segment, or replacing it with a stronger topic. One option is the sandwich: the Earl of Sandwich gets credit, but bread-wrapped meals are ancient (e.g., Hillel's matzo sandwich). That would need its own check.
- **Fit score:** 2/5. A good origin story with no did-it-first conflict.

### 65. Fast Food — Fit 5/5
- **Planned fun fact:** White Castle (1921, Wichita) standardized fast food; Yoshinoya (1899, Tokyo fish market); Red's Giant Hamburg (1947, Springfield, MO, Route 66) as first drive-through. Drive-through "first" is contested (Pig Stand Texas 1921 drive-in / 1931 drive-through window claims, In-N-Out 1948 two-way speaker), verify. Also the did-it-first angle: Automats (Horn & Hardart 1902), Roman thermopolia (Pompeii, 2020 excavation), McDonald's credited with fast food but White Castle did it first.
- **Verdict:** Needs correction. PROVISIONAL: not checked this session.
- **Corrected / on-air version (provisional):** "McDonald's gets the credit for fast food. Its 'Speedee Service System' launched in 1948, and Ray Kroc franchised it from 1955. But White Castle opened in Wichita, Kansas, in 1921 with a cheap, identical burger, a standardised kitchen, and a chain built to look the same everywhere. It's usually called the first fast-food hamburger chain. Tokyo's Yoshinoya was dishing out quick beef bowls to fish-market workers from 1899. Horn & Hardart's coin-operated Automat opened in Philadelphia in 1902. And the drive-through? Red's Giant Hamburg on Route 66 in Springfield, Missouri, is often called the first in 1947, but Texas's Pig Stand chain claims a drive-through window in the 1930s, so call Red's 'one of the first'. Two thousand years earlier, the people of Pompeii were grabbing hot food from street-counter snack bars called *thermopolia*. One beautifully painted example was unearthed in 2020."
- **Confirmed vs. inferred vs. unknown:** From background knowledge (not checked this session): White Castle founded 1921 in Wichita by Walt Anderson and Billy Ingram, widely described as the first fast-food hamburger chain; Yoshinoya founded 1899 at the Nihonbashi fish market (company history); Horn & Hardart's first Automat in Philadelphia, 1902 (the Smithsonian NMAH holds an Automat section; the technology came from Germany's Quisisana company, Berlin ~1895); McDonald's brothers' Speedee system 1948 and Kroc 1955; Pompeii Regio V thermopolium announced by the Archaeological Park of Pompeii, late December 2020. Disputed: "first drive-through". Red's Giant Hamburg (1947) vs. Pig Stand's claimed 1931 California window vs. In-N-Out (1948, first two-way speaker). Drive-*in* (Pig Stand, Dallas 1921) is a different thing from drive-*through*; don't conflate them. Also, Yoshinoya (1899) predates White Castle as a quick-service eatery, but it was a single shop at the time, not a chain. Keep the claims distinct: "first fast-food *chain*" (White Castle) vs. "quick food" (ancient).
- **Sources (to verify; NOT accessed this session):**
  - David Gerard Hogan, *Selling 'em by the Sack: White Castle and the Creation of American Food* (NYU Press, 1997). White Castle as the first fast-food chain.
  - Smithsonian NMAH, Horn & Hardart Automat collection (americanhistory.si.edu). URL not verified.
  - Parco Archeologico di Pompei, Dec 2020 thermopolium announcement (pompeiisites.org), and Smithsonian or Nat Geo coverage of it. URLs not verified.
  - Yoshinoya Holdings corporate history (yoshinoya-holdings.com). Company source only.
  - Red's Giant Hamburg: Route 66 histories (e.g., NPS Route 66 Corridor Preservation, nps.gov). URL not verified; the "first" claim comes mainly from local and Route 66 lore.
  - **No sources checked this session. Do not air until each claim has two sources.**
- **Best "Somebody Did It First" angle:** McDonald's and Ray Kroc get the credit for fast food. White Castle did the standardised burger chain 27 years earlier, and Pompeii's thermopolia did street fast food 2,000 years earlier. This is one of the strongest premise fits in the batch. The White Castle priority is well established in food history; the drive-through "first" must be hedged.
- **Fit score:** 5/5. Famous credited brand and person, a well-documented earlier chain, and a spectacular ancient visual (the 2020 Pompeii counter).

---

#### Batch notes

---

# Job 4: Ranking the lineup for "Somebody Did It First"

The old plan was built as "Evolution of [Thing]", so about a third of it is "oldest X ever found" facts with nobody wrongly credited. The ranking below favors a famous credited name, a well-documented earlier person, and a clean story you can say without hedging half of it. Where an episode is still **Provisional** (sources not opened this session), it's marked, and its two sources need checking before it gets scripted.

## The 15 strongest candidates for episodes 2–16

| Order | Episode | Credited → Actually first | Why it's strong | Status |
|---|---|---|---|---|
| 1 | #49 Recorded Sound | Edison → Scott de Martinville (1857 phonautograph) | Direct sequel to the launch: Edison again, and the 1860 recording was played back in 2008 by Berkeley Lab scientists, so you have audio for the video. | Provisional |
| 2 | #41 Anesthesia | Morton (1846 Ether Dome) → Crawford Long (1842), Hanaoka Seishū (1804) | Famous public credit, documented earlier surgery, a bitter priority war, and US Doctors' Day is March 30 because of Long. | Checked |
| 3 | #38 Telephone | Bell → Elisha Gray, Antonio Meucci, Philipp Reis | The textbook case for the channel, as long as it's told carefully: Gray filed a caveat, and H.Res. 269 honors Meucci without saying he invented the telephone. | Provisional |
| 4 | #42 Vaccines | Jenner → Benjamin Jesty (1774), plus centuries of variolation in China, India, the Ottoman world and West Africa (Onesimus) | Huge name, excellent evidence, several layers of "first". | Checked |
| 5 | #37 Printing Press | Gutenberg → Bi Sheng (~1040), Korea's Jikji (1377) | Artifacts you can show (Jikji is at the BnF), and a hard date gap of 70+ years for metal type. | Provisional |
| 6 | #51 Electricity | Franklin's kite → Dalibard at Marly-la-Ville, May 1752 | Franklin's own idea was tested first in France, weeks before the kite, and the man at the rod was a forgotten ex-dragoon. | Provisional |
| 7 | #30 Train | George Stephenson / Rocket → Richard Trevithick (1804) | A 25-year gap, a famous name, and Trevithick died broke. | Provisional |
| 8 | #31 Car | Ford → Karl Benz (1886); Ransom Olds and the meatpackers on the assembly line | Classic "he perfected it" Heinz-style structure, with two layers. | Provisional |
| 9 | #8 Air Conditioning | Willis Carrier → John Gorrie (1840s ice machine for patients) | Carrier's first system wasn't even for people; Gorrie got there first and died obscure. | Provisional |
| 10 | #4 Toilet | Thomas Crapper → John Harington (1596), Alexander Cumming (S-trap, 1775), Minoans | A myth everyone half-knows, a funny name, and solid evidence. | Checked |
| 11 | #39 Computer (reworked) | ENIAC → Atanasoff-Berry Computer, Zuse's Z3 (1941), Colossus (1943–44) | A 1973 federal court ruling (Honeywell v. Sperry Rand) actually voided the ENIAC patent on these grounds. Drop the moth lead. | Provisional |
| 12 | #65 Fast Food | McDonald's / Ray Kroc → White Castle (1921), Pompeii's thermopolia | Famous credit, clear earlier chain; keep the drive-through "first" hedged. | Provisional |
| 13 | #60 Pizza | Raffaele Esposito / Margherita for the queen (1889) → Neapolitan pizzaioli described in 1858 | The royal letter behind the legend looks forged (Zachary Nowak). That's a rare documented fake. | Checked |
| 14 | #24 Explosives | Alfred Nobel → Ascanio Sobrero (nitroglycerin, 1847) | NobelPrize.org itself credits Sobrero, and the "merchant of death" obituary is its own myth-bust (no copy has ever been found). | Checked |
| 15 | #44 Refrigeration | Carrier / Gorrie → William Cullen (1748), Oliver Evans (1805), Jacob Perkins (1834) | Cold open: a Mari king, Zimri-Lim, inscribed that he built an icehouse "which never before had any king built", so it's a 3,800-year-old "I did it first" claim with the receipt still around. | Checked |

**Strong alternates if any of the above fail verification:** #25 Tank (Lancelot de Mole's rejected 1912 design), #62 Canning (Appert heat-sterilized food ~50 years before Pasteur; Durand's tin-can patent), #18 Gunpowder (Roger Bacon and "Black Berthold" vs. a printed Chinese formula by 1044), #57 Chocolate (Amazonian cacao ~1,500 years before Mesoamerica), #12 Glass (Pliny's legend vs. Mesopotamia), #11 Skyscraper (the "first" label was handed out by a committee in 1931), #32 Flight, framed as a fight over credit: the Smithsonian's Langley claim and the contract that still binds it. Don't frame Flight as "the Wrights weren't first."

**Spacing tip:** #49, #38, #51 and #31 all involve famous inventors in the same 1850–1913 window as the launch. Alternate them with the ancient/food ones (#42, #60, #44, #65) so the channel doesn't read as "the Edison channel".

## Weakest topics: cut or rework

These have no "credited person wasn't first" story as planned:

| # | Topic | Problem | Rework or cut |
|---|---|---|---|
| 6 | Hot Water | Myth-bust only, and the planned fact is itself a myth | Rework as "The Shower": Feetham's 1767 pump shower vs. Greek gymnasium showers (needs checking), or cut |
| 10 | Bridge | "Oldest bridge" superlative | Rework: Thangtong Gyalpo's 1400s iron-chain suspension bridges vs. James Finley 1801 (needs checking) |
| 15 | Sword | Oldest-artifact fact | Cut, or fold the Venice monastery mislabeled-sword story into a "museum mistakes" episode |
| 16 | Armor | Planned fact is wrong; no credit story | Cut |
| 20 | Rifle | Inventor unknown; attributions are traditional | Fold into #19 Gun |
| 22 | Castle | Superlative fact, contested | Cut |
| 35 | Timekeeping | Planned facts shaky; no credited person | Rework: Su Song's 1088 astronomical clock vs. European clockmakers, or Galileo vs. Huygens on the pendulum clock |
| 50 | Clothing | Contested "dyed" claim; no credited person | Rework: Jacob Davis vs. Levi Strauss on riveted jeans (needs checking) |
| 54 | Salt and Spices | Myth-bust only | Cut, or rework around Ramesses II's peppercorns (needs checking) |
| 58 | Cheese | "Oldest cheese" record story | Cut, or fold into a food-records compilation |
| 64 | Diner | No famous wrong credit | Fold into #65 Fast Food |
| 43 | Hospital | Planned fact is wrong | Reframe as a myth-bust ("the famous first hospital may never have existed"), or cut |

**Middle tier (fit 3), which works as "earlier than you think" but not as "someone else did it":** #1 Plumbing and #5 Sewers (merge them), #7 Heating, #9 Concrete, #14 Weapons, #17 Bow, #23 Warship, #27 Wheel, #28 Road, #29 Ship, #40 Medicine, #45 Cooking, #46 Farming, #47 Money, #48 Music, #53 Bread. These are good Shorts material or compilation segments ("5 things older than you think").

## Up to 10 new topics: strong "credited person wasn't first" stories

These are new, not on the list, and ranked strongest first. Full detail and sources are at the bottom of this file. Each was checked against two or more strong sources via search extracts. A few supporting details ran past the search budget and are tagged *(not re-verified this session)* in the detail.

1. **Vikings in America, 1021 CE vs. Columbus.** A 2021 *Nature* tree-ring study dates metal-cut wood at L'Anse aux Meadows to exactly 1021, 471 years before Columbus. Say "Norse" and "first known Europeans."
2. **Thomas Newcomen vs. James Watt.** Newcomen's steam engine was pumping water in 1712; Watt's separate condenser came in 1769. Watt improved it, he didn't invent it.
3. **Hans Lipperhey vs. Galileo.** A Dutch patent application for the telescope on 2 Oct 1608, a year before Galileo. Hedge: "first on record," since others also claimed it.
4. **Lizzie Magie vs. Charles Darrow.** Magie patented The Landlord's Game in 1904, about 30 years before Darrow sold Monopoly to Parker Brothers. Say "sold it as his own", not "stole".
5. **Niépce vs. Daguerre.** The earliest surviving camera photograph (Niépce, 1826/27) still exists at the Harry Ransom Center in Texas.
6. **Patrick Matthew and Alfred Russel Wallace vs. Darwin.** Matthew put natural selection in print in 1831, and Darwin acknowledged it in 1860. Wallace's 1858 essay forced the joint paper. Not plagiarism, so frame it as priority.
7. **Georges Lemaître vs. Edwin Hubble.** Lemaître published the expanding universe in 1927, two years before Hubble. In 2018 the IAU membership voted to recommend renaming it the Hubble–Lemaître law.
8. **The Babylonians vs. Pythagoras.** Plimpton 322 and YBC 7289 show Babylonians using the relationship more than a millennium earlier. Say "used", not "proved".
9. **Marconi vs. Lodge, Stone and Tesla.** A 1943 US Supreme Court ruling (320 U.S. 1) invalidated key Marconi tuning patent claims. Careful: the ruling did not say "Tesla invented radio."
10. **Robin Li's RankDex vs. Google's PageRank.** Link-based ranking in 1996; Google's patents cite Li's. This is the weakest pick. Page's priority date is earlier, so present them as parallel inventors.

Backups the agent couldn't vet before the search limit: Xerox PARC Alto vs. Apple's GUI; Aristarchus vs. Copernicus; Cooke & Wheatstone (1837) vs. Morse; Florey & Chain vs. Fleming (penicillin as a usable drug).

---

## New topic detail (sources and hedges)

Ten new topics, none on the existing list, strongest first. All checks came from **WebSearch result extracts** of the pages cited, not full reads (WebFetch is blocked). Partway through, the session hit its shared WebSearch limit (200/200). Facts marked *(not re-verified this session)* come from background knowledge and need a search before scripting.

Two vetted candidates were not used because the search limit ran out before they could be checked: **Steve Jobs/Apple GUI vs. Xerox PARC Alto (1973)** and **Copernicus vs. Aristarchus of Samos (c. 270 BCE, via Archimedes' *Sand Reckoner*)**. Both are strong backups once they're sourced.

---

### 1. Columbus Was Late: Vikings in America in 1021 — Fit 5/5
- **Credited:** Christopher Columbus (1492), as the European who "discovered" America.
- **Actually first:** Norse settlers at L'Anse aux Meadows, Newfoundland. A 2021 *Nature* paper (Kuitems, Dee et al., University of Groningen) found the 993 CE cosmic-ray carbon-14 spike in wood that was cut with metal blades, then counted the rings outward. All three trees gave the same cutting year: **1021 CE**, which is 471 years before Columbus.
- **Evidence strength:** Solid. This is a peer-reviewed *Nature* paper, and *Science*, Nat Geo and Smithsonian all reported it. *Nature* calls it "the only secure calendar date for the presence of Europeans across the Atlantic before the voyages of Columbus."
- **Hedges needed on air:** Say "first **European**." Indigenous peoples were there thousands of years earlier. 1021 is a year when wood was cut at the site, not the founding date, and the settlement may have been older and short-lived. Linking it to Leif Erikson by name comes from the Icelandic sagas, not from the wood itself, so say "Norse / Viking" for the 1021 date. There's slight overlap with the "navigation/Polynesia" and "ship" episodes. Keep this one about the discovery claim.
- **Sources:**
  - *Nature*, Kuitems et al. 2021, "Evidence for European presence in the Americas in AD 1021" (https://www.nature.com/articles/s41586-021-03972-8): the 1021 date, the method, and the "only secure date before Columbus" line.
  - *Science* news, "First Viking settlement in North America dated to exactly 1000 years ago" (https://www.science.org/content/article/first-viking-settlement-north-america-dated-exactly-1000-years-ago): independent report of the result.
  - National Geographic (https://www.nationalgeographic.com/history/article/ancient-solar-storm-pinpoints-viking-settlement-americas-exactly-1000-years-ago) and Smithsonian (https://www.smithsonianmag.com/science-nature/new-dating-method-shows-vikings-occupied-newfoundland-in-1021-ce-180978903/): the 993 solar-storm method and the metal-tool cut marks.
  - University of Groningen release (https://www.rug.nl/research/centre-for-isotope-research/echoes/media/news/2021/europeans-in-the-americas-1000-years-ago).
- **Why it works for the channel:** The biggest "discoverer" name in history, beaten by about 470 years, and a solar storm proves it.

### 2. James Watt Didn't Invent the Steam Engine — Fit 5/5
- **Credited:** James Watt, whose name is on the unit of power and who is widely called the steam engine's inventor.
- **Actually first:** Thomas Newcomen. His atmospheric engine was working near Dudley Castle (Tipton, West Midlands) in **1712**. Watt was born in 1736. He didn't see the Newcomen engine's waste problem until 1764, conceived the separate condenser in 1765, and patented it in **1769**. Before Newcomen, Thomas Savery patented a steam pump in 1698 *(not re-verified this session)*.
- **Evidence strength:** Solid. Britannica and ASME's landmark dossier both say Watt improved the Newcomen engine rather than inventing the steam engine.
- **Hedges needed on air:** Watt's condenser was a real breakthrough (Britannica: about a 75% cut in fuel), so present him as the improver who made it practical, the same shape as the Heinz/ketchup example. If you mention Hero of Alexandria's aeolipile (1st century CE), call it a toy or demonstration, not a working engine.
- **Sources:**
  - Britannica, "Separate condenser" (https://www.britannica.com/technology/separate-condenser) and "James Watt" (https://www.britannica.com/biography/James-Watt): Watt improved rather than invented; dates 1764/1765/1769; the fuel saving.
  - ASME, Newcomen Memorial Engine landmark brochure (https://www.asme.org/wwwasmeorg/media/resourcefiles/aboutasme/who%20we%20are/engineering%20history/landmarks/70-newcomen-engine.pdf): first successful Newcomen engine, 1712, Dudley Castle.
  - Science Museum blog, "In Pursuit of Power" (https://blog.sciencemuseum.org.uk/a-new-age/): context on Newcomen to Watt.
- **Why it works for the channel:** A household-name inventor, a 57-year head start for someone almost nobody has heard of, and a clean improver-vs-inventor story.

### 3. Galileo Didn't Invent the Telescope — Fit 5/5
- **Credited:** Galileo Galilei, in the popular belief that he invented the telescope.
- **Actually first:** Hans Lipperhey, a spectacle-maker in Middelburg. Zeeland's letter to the Dutch States General is dated **25 September 1608**, and the States General discussed Lipperhey's patent application on **2 October 1608**. His device used a convex and a concave lens and magnified 3–4x. The patent was refused because the device couldn't be kept secret, but he was paid to build binocular versions. Galileo built his improved instruments in 1609.
- **Evidence strength:** Solid for "Lipperhey before Galileo," which rests on dated Dutch government records. NASA, Rice's Galileo Project, AIP and Britannica all agree.
- **Hedges needed on air:** Say "the **first person on record**." Jacob Metius applied for a patent weeks later, and Sacharias Janssen's family claimed it later, so who really built the first one is murky. Galileo deserves full credit for turning it on the sky (Jupiter's moons, 1610).
- **Sources:**
  - Rice University, The Galileo Project, "Hans Lipperhey" (https://galileo.library.rice.edu/sci/lipperhey.html): the dated letters, the patent refusal, payment for binocular instruments.
  - NASA StarChild, "Did Galileo invent the telescope?" (https://starchild.gsfc.nasa.gov/docs/StarChild/questions/question37.html): the plain "no" answer.
  - AIP, "The First Telescopes" (https://history.aip.org/exhibits/cosmology/tools/tools-first-telescopes.htm) and Britannica, "Who invented the first refracting optical telescope?" (https://www.britannica.com/science/Who-invented-the-first-refracting-optical-telescope).
- **Why it works for the channel:** A huge name, a myth almost everyone believes, and a government document that settles it.

### 4. Monopoly Was Invented by a Woman 30 Years Earlier — Fit 5/5
- **Credited:** Charles Darrow, who sold Monopoly to Parker Brothers in 1935 and was long promoted as its sole inventor.
- **Actually first:** Lizzie (Elizabeth) Magie patented **The Landlord's Game** in **1904** (US 748,626) and revised the patent in 1924. It had a square track and a "Go to Jail" corner, and she designed it to teach Georgist ideas about the harm of land monopoly. Darrow got the game through a Quaker friend's folk version and sold it as his own.
- **Evidence strength:** Solid. The patent is primary evidence, and Smithsonian, Britannica, NPR and the Strong National Museum of Play all tell the same story.
- **Hedges needed on air:** The game changed over about 30 years of homemade versions (Atlantic City Quakers and others) before Darrow, so "Darrow copied Magie's board" oversimplifies. Say he sold a folk descendant of her game as his own. "Stole" is NPR's headline word, so attribute it or soften it. Parker Brothers bought Magie's patent, reportedly for $500 *(not re-verified this session)*.
- **Sources:**
  - Smithsonian, "Monopoly Was Designed to Teach the 99% About Income Inequality" (https://www.smithsonianmag.com/arts-culture/monopoly-was-designed-teach-99-about-income-inequality-180953630/): the 1904 patent, board layout, 1924 renewal.
  - Britannica, "Landlord's Game" (https://www.britannica.com/topic/Landlords-Game) and "Lizzie G. Magie" (https://www.britannica.com/biography/Lizzie-G-Magie): Georgist purpose, the Magie-to-Darrow chain.
  - Strong National Museum of Play, "Making Monopoly" (https://museumofplay.org/research-publications/online-exhibits/making-monopoly) and "A Monopoly on Monopoly" blog (https://www.museumofplay.org/blog/a-monopoly-on-monopoly-parker-brothers-pursuit-of-a-game-to-call-their-own/): Parker Brothers' side of the story.
  - NPR, "Ever Cheat At Monopoly? So Did Its Creator" (https://www.npr.org/2015/03/03/382662772/ever-cheat-at-monopoly-so-did-its-creator-he-stole-the-idea-from-a-woman).
- **Why it works for the channel:** The most famous board game in the world, an erased woman inventor, and the irony that it was invented to criticize monopolies.

### 5. Daguerre Didn't Take the First Photograph — Fit 5/5
- **Credited:** Louis Daguerre. The daguerreotype was announced in 1839 and is commonly treated as the invention of photography.
- **Actually first:** Nicéphore Niépce made *View from the Window at Le Gras* in **1826 or 1827**. It is the earliest surviving camera photograph, made on a pewter plate coated with bitumen of Judea and exposed for at least 8 hours. It is held at the Harry Ransom Center, University of Texas at Austin.
- **Evidence strength:** Solid. The physical object survives, and the Ransom Center (its owner) and Britannica both describe it.
- **Hedges needed on air:** Say "earliest **surviving** photograph." Niépce made earlier, lost attempts. Daguerre was Niépce's partner from 1829, and Niépce died in 1833 before the daguerreotype was finished *(the partnership dates are standard in Britannica's Niépce biography, but they did not appear in this session's extracts, so verify them)*. Daguerre's process was faster and practical, so he fits the "perfected it" pattern. Fox Talbot was a separate parallel inventor.
- **Sources:**
  - Harry Ransom Center, UT Austin, press release (https://www.hrc.utexas.edu/press/releases/2012/first-photograph-to-travel.html) and magazine piece (https://sites.utexas.edu/ransomcentermagazine/2010/05/27/the-first-photograph-gets-a-check-up/): what the object is, its date and its process.
  - Britannica, "Nicéphore Niépce" (https://www.britannica.com/biography/Nicephore-Niepce) and "Who invented the photograph and why?" (https://www.britannica.com/question/Who-invented-the-photograph-and-why): first permanent photograph 1826/27, heliography, Daguerre building on it.
  - Getty Museum, window-in-photography exhibition release (https://www.getty.edu/news/getty-museum-presents-window-photography/): supporting.
- **Why it works for the channel:** You can show the actual first photo on screen, and the credited name is literally on the process.

### 6. Darwin Wasn't First to Natural Selection — Fit 5/5
- **Credited:** Charles Darwin, *On the Origin of Species* (1859).
- **Actually first, in print:** Patrick Matthew, a Scottish landowner, described a natural-selection principle in an appendix to his 1831 book *On Naval Timber and Arboriculture*. That was 28 years before *Origin*. Darwin admitted Matthew had "anticipated" him in a letter to the *Gardeners' Chronicle* (7 April 1860), saying he hadn't known the book.
- **The co-discoverer:** Alfred Russel Wallace reached the theory independently. His essay from Ternate reached Darwin on 18 June 1858, which pushed Darwin into the joint Darwin–Wallace paper read at the Linnean Society on 1 July 1858.
- **Evidence strength:** Solid for the facts: Matthew's 1831 text exists, Darwin's 1860 admission is in print, and the 1858 joint paper is on record. The meaning is debated. Matthew's passage was brief, buried in a forestry book, and influenced almost no one.
- **Hedges needed on air:** Don't call it plagiarism. Mike Sutton's plagiarism claim is fringe, and it got a critical review in the journal *Evolution*. Darwin had his own private sketches from 1842–44, so he did develop the idea independently. Frame it as "first in print," not "Darwin stole it." Wallace is the second act ("and then someone else found it the same year").
- **Sources:**
  - Britannica, "Patrick Matthew" (https://www.britannica.com/biography/Patrick-Matthew): the 1831 book and Darwin's 1860 acknowledgement.
  - Darwin Correspondence Project, Cambridge, letter from Patrick Matthew 1864 (https://www.darwinproject.ac.uk/letter?docId=letters%2FDCP-LETT-4522.xml) and Darwin Online's 1831 Matthew text (https://darwin-online.org.uk/converted/Ancillary/1831_Matthew_A154.html): primary documents.
  - Royal Society *Notes and Records*, "Patrick Matthew's synthesis of catastrophism and transformism" (https://royalsocietypublishing.org/rsnr/article/78/1/167/55032/): scholarly assessment.
  - Linnean Society, "Alfred Russel Wallace" (https://www.linnean.org/the-society/history-of-science/alfred-russel-wallace) and Darwin Online's 1858 joint paper (https://darwin-online.org.uk/converted/published/1858_species_F350.html): the 1858 joint reading.
  - *Evolution* (OUP) review (https://academic.oup.com/evolut/article/76/9/2218/6966260): why "plagiarism" goes too far.
- **Why it works for the channel:** Science's most famous idea, an unknown forestry writer who got there first, and Darwin admitting it in print.

### 7. Hubble Didn't Discover the Expanding Universe First — Fit 5/5
- **Credited:** Edwin Hubble (1929), long remembered in "Hubble's Law."
- **Actually first:** Georges Lemaître, a Belgian astronomer and Catholic priest, published in **1927** that the universe is expanding and derived the velocity–distance relation. That was two years before Hubble. In October 2018, the International Astronomical Union's members voted by about 78% to recommend renaming it the **Hubble–Lemaître law**.
- **Evidence strength:** Good. *Nature* and *Science* reported the IAU vote, and the vote itself is an institutional acknowledgement. The priority claim is widely accepted.
- **Hedges needed on air:** Lemaître published in French in a little-read Belgian journal. Hubble's 1929 observations were the convincing data, and Vesto Slipher's redshift measurements (1910s) underpin both. Some historians called the IAU's background materials "bad history" (arXiv 1909.07731). The IAU *recommends* the new name; it can't force it. The often-told story that Lemaître's 1931 English translation left out his expansion-rate estimate is true, but Lemaître made that cut himself (Mario Livio, *Nature* 2011), so avoid any "cover-up" framing *(not re-verified this session)*.
- **Sources:**
  - *Nature* news, "Belgian priest recognized in Hubble-law name change" (https://www.nature.com/articles/d41586-018-07234-y).
  - *Science*, "Move over, Hubble: Discovery of expanding cosmos assigned to little-known Belgian astronomer-priest" (https://www.science.org/content/article/move-over-hubble-discovery-expanding-cosmos-assigned-little-known-belgian-astronomer).
  - Elbaz et al., "Hubble Law or Hubble-Lemaître Law? The IAU Resolution" (https://arxiv.org/pdf/1809.02557): the resolution's own background. The counter-view is "Redshifts versus paradigm shifts; against renaming Hubble's Law" (https://arxiv.org/pdf/1909.07731).
- **Why it works for the channel:** The biggest name in astronomy, a priest who beat him, and a 2018 vote that officially corrected the record.

### 8. Pythagoras' Theorem Was 1,000 Years Old Before Pythagoras — Fit 4/5
- **Credited:** Pythagoras (c. 570–495 BCE).
- **Actually first:** Old Babylonian scribes. **Plimpton 322** (c. 1800–1700 BCE, Columbia University) lists 15 rows of Pythagorean triples. **YBC 7289** (Yale Babylonian Collection, c. 1800–1600 BCE) shows a square's diagonal labelled with √2 accurate to about six decimal places, which is the theorem applied to a right isosceles triangle.
- **Evidence strength:** Good. The tablets exist and the readings (Neugebauer & Sachs, 1945) are standard. What's contested is whether the Babylonians had a general *proof* or statement of the theorem.
- **Hedges needed on air:** Say "they **used** the relationship about 1,000 years earlier," not "they proved the theorem." Pythagoras left no writings, and crediting him with the theorem came centuries after his death. Avoid the 2017 UNSW claim that Plimpton 322 is "the world's first trigonometry"; *Scientific American* called it hype.
- **Sources:**
  - Britannica, "Plimpton 322" (https://www.britannica.com/topic/Plimpton-322): date, the triples, about 1,000 years before Pythagoras.
  - Columbia Magazine, "Babylon Revisited" (https://magazine.columbia.edu/article/babylon-revisited): Columbia owns the tablet; the Neugebauer–Sachs reading.
  - *Historia Mathematica* (ScienceDirect), "How the estimate of √2 on YBC 7289 may have been calculated" (https://www.sciencedirect.com/science/article/pii/S0315086022000477): peer-reviewed source on YBC 7289.
  - *Scientific American* blog, "Don't Fall for Babylonian Trigonometry Hype" (https://blogs.scientificamerican.com/roots-of-unity/dont-fall-for-babylonian-trigonometry-hype/): the hedge.
- **Why it works for the channel:** Everyone learned it in school, and you can put a 3,700-year-old clay tablet on screen.

### 9. Marconi, Tesla, and the Supreme Court Radio Fight — Fit 4/5
- **Credited:** Guglielmo Marconi, called the "inventor of radio" (Nobel Prize 1909).
- **Actually first / prior art:** In *Marconi Wireless Telegraph Co. v. United States*, 320 U.S. 1 (decided **21 June 1943**), the Supreme Court held the broad claims of Marconi's key US tuning patent (No. 763,772) **invalid** because earlier work anticipated them. It cited Oliver Lodge (US 609,154), John Stone Stone (US 714,756) and Nikola Tesla (US 645,576). The Court wrote that Stone showed antenna tuning before Marconi. The ruling came months after Tesla died in January 1943.
- **Evidence strength:** Good for the ruling, which is a primary legal document. Contested for the popular version, "the Supreme Court said Tesla invented radio," which overstates it. The case was about the US government's liability for patent infringement and covered the four-circuit tuning claims. It did not decide who invented radio.
- **Hedges needed on air:** Say "the Court ruled that key parts of Marconi's patent had been done before, by Lodge, Stone and Tesla." Don't say "Tesla officially invented radio." Lodge (1894), Jagadish Chandra Bose (1895) and Alexander Popov (1895) all demonstrated wireless before or alongside Marconi *(not re-verified this session, so verify before scripting)*. Marconi still did make long-distance wireless practical.
- **Sources:**
  - U.S. Reports, 320 U.S. 1 (1943), Library of Congress (https://www.loc.gov/item/usrep320001/; PDF https://tile.loc.gov/storage-services/service/ll/usrep/usrep320/usrep320001/usrep320001.pdf) and Cornell LII text (https://www.law.cornell.edu/supremecourt/text/320/1): the holding and the patent numbers.
  - PBS, "Tesla – Master of Lightning: Who Invented Radio?" (https://www.pbs.org/tesla/ll/ll_whoradio.html): the popular framing of the 1943 ruling and Tesla's patent.
- **Why it works for the channel:** Tesla against Marconi has a huge built-in audience, and a Supreme Court ruling is a great reveal. The hedges are what will set this channel apart from the many Tesla-myth videos.

### 10. Before Google: Robin Li's RankDex — Fit 3/5
- **Credited:** Larry Page and Sergey Brin, PageRank and Google, for ranking web pages by links.
- **Actually first:** Robin (Yanhong) Li built **RankDex** at IDD/Dow Jones in **1996**. It ranked pages using the hyperlinks pointing to them. He filed US patent 5,920,859 ("Hypertext document retrieval system and method") on 5 Feb 1997, and it was granted 6 July 1999. Google's PageRank patent family cites Li's patent. Li later built Baidu on the technology.
- **Evidence strength:** Contested. Both patents exist, and Forbes and TIME report that Li's work came first and is "said to have inspired" Page. However, Page's PageRank patent (US 6,285,999) has a **priority date of 10 Jan 1997**, *earlier* than Li's filing date. BackRub was also running in 1996. The two methods differ too: RankDex summed anchor-text relevance over incoming links, while PageRank's scores are recursive.
- **Hedges needed on air:** Frame it as "a parallel inventor the West forgot," not "Google copied." Ranking by citations goes back to Eugene Garfield's citation indexing (1950s–60s).
- **Sources:**
  - Google Patents, US5920859A (https://patents.google.com/patent/US5920859A/en): inventor, dates, method.
  - USPTO / Google Patents, US6285999 "Method for node ranking in a linked database" (https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/6285999): PageRank's dates, and its family citing US5920859.
  - Forbes, "The Man Who's Beating Google" (https://www.forbes.com/forbes/2009/1005/technology-baidu-robin-li-man-whos-beating-google.html) and TIME 2010 TIME 100 profile (https://content.time.com/time/specials/packages/article/0,28804,1984685_1984864_1985434,00.html): RankDex in 1996 and the claimed influence on Google.
- **Why it works for the channel:** A modern, surprising "did it first" that a tech audience hasn't heard. Its priority is murky, so use it as a mid-video segment or a lower-priority episode.

---

#### Ranking at a glance
| Rank | Topic | Evidence | Fit |
|---|---|---|---|
| 1 | Vikings 1021 vs. Columbus | Solid | 5 |
| 2 | Newcomen vs. Watt (steam engine) | Solid | 5 |
| 3 | Lipperhey vs. Galileo (telescope) | Solid | 5 |
| 4 | Lizzie Magie vs. Darrow (Monopoly) | Solid | 5 |
| 5 | Niépce vs. Daguerre (photography) | Solid | 5 |
| 6 | Matthew/Wallace vs. Darwin (natural selection) | Solid facts, interpretation debated | 5 |
| 7 | Lemaître vs. Hubble (expanding universe) | Good | 5 |
| 8 | Babylonians vs. Pythagoras | Good | 4 |
| 9 | Lodge/Stone/Tesla vs. Marconi (radio) | Good, popular version contested | 4 |
| 10 | RankDex vs. PageRank | Contested | 3 |

Unvetted backups (search limit ran out): Xerox PARC Alto vs. Apple GUI; Aristarchus vs. Copernicus; Cooke & Wheatstone (1837) vs. Morse; Florey & Chain vs. Fleming (penicillin as a drug).
