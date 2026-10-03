# Somebody Did It First - memory

The channel's standing rules. The youtube-pipeline skill reads this before any build. Created 2026-10-02.

## Channel
- **Premise:** someone gets the credit, but someone else did it first. Credibility is the main asset and the defense against being lumped in with AI slop.
- **Format:** faceless. Archive-documentary visuals.
- **Narrator (decided by Gus, 2026-10-02):** AI voice **Holden** (Higgsfield preset `3c9d6053-6334-592c-8997-4e325286af3f`) on **text2speech_v2 / Seed Speech**. That's about 9.5 credits per ~830-word episode. Send the text in pieces of under 2,048 characters, split at sentence breaks, and join the audio in the timeline.
- **Disclosure (required on every upload):** in YouTube Studio, answer **Yes** to "altered or synthetic content", because the narration is a synthetic voice. Never skip it.
- **Persona:** Gus's own spoken cadence, per `script-final-read`. No character persona.
- **Scripts:** `scripts/` (2–114; 101–114 are the History Channel-inspired additions) and `launch-episode-script.md` (1). Index and runtimes: `scripts/README.md`. Research: `episode-research.md`, `100-episode-lineup.md`, and each script's `scripts/notes/`.

## Standing rules
- **Fact-check record:** all 99 scripts went through review, Re-check A (live sources), Re-check B (blind adversarial), then Re-check C and D on everything B changed. The last pass (D) found no high or medium issues.
- **Facts:** every factual line traces to two strong sources in the research or notes. Wikipedia, Grokipedia and content farms never count. Keep every hedge as written ("reportedly", "as X told it", "about", "one of the oldest", "widely considered").
- **Leave out** anything marked unverified, single-source keep-off-air, or cut.
- **Fair credit:** the credited person always gets their real due ("he perfected it", not "he was a fraud") unless the research documents a fraud.
- **Banned in spoken text:** "genuinely", "dive in", "game changer", "unpack", "in today's video", "level up". No em dashes.
- **Visual system (pilot, 2026-10-02):** archive-paper palette: paper #EFE7D6, ink #1D1B18, red #A8261B, brass #9A7B3C, blue #2F5D7C. Fonts: Libre Baskerville (headlines), Inter (labels). Templates: the pilot's own copy is in `production/ep001-the-man-who-invented-nothing/templates/`. Episodes 2 and up use the shared kit in `production/_shared/` (card.html with generic flow, pinmap (Natural Earth coastlines), timeline (can space by year), stat and compare templates; render.mjs; build.py --ep; sheets.py; thumbs.mjs; readme.py). Diagrams build step by step with the narration. Lower-thirds name every person and caption any modern photo. No more than 2 text cards in a row, and no stretch longer than 12 seconds without a picture.
- **Visuals:**
  - Real archival material first: Library of Congress, Smithsonian Open Access (CC0), the Met (CC0), NASA (no logos), US patents, and public-domain film and print (US-published 1930 or earlier).
  - AI only for scenes with no surviving image, in one illustrated channel style tagged "Illustration".
  - Never a realistic AI "photo" of a real person or event.
- **Sensitive beats:** no animal-cruelty, execution or gore imagery. Use documents and text cards instead.
- **Credits:** every image credited in the description; Wikimedia and Science Museum Group licenses checked per file.
- **Thumbnails:** famous name/object + red "NOT FIRST" stamp + the real first-doer. Two versions to A/B test.
- **Voice (Gus, 2026-10-03):**
  - Plain talk, the way a person tells a story.
  - No "right?" tags.
  - No narrator asides or self-commentary: "to be fair", "I want to be careful", "the way I see it", "this channel is about", "that's how I'm going to say it".
  - No slogan lines like "someone made it work and someone made it pay".
  - Hedges stay, said plainly ("a big reason", "probably", "the story goes").
- **Hooks (Gus, 2026-10-03):** open on the name an American viewer would actually guess (for railways, Vanderbilt), then turn it. Any term a viewer may not know is explained the first time it comes up (Rainhill Trials, what "Rocket" meant).
- **Pictures (Gus, 2026-10-03):**
  - Show what the people and the machines really looked like, using real portraits, real engines and period prints, credited per file in the episode's `images.json`.
  - No cartoon or "stop-motion" reconstructions of historical technology. Where no picture survives, use a period print, a museum replica photo or a map instead.
  - A running time bar along the top shows where in time each beat sits (`timebar` in episode.json).
  - **On-screen honesty (blind review of the v3 cuts, 2026-10-03):**
    - Map pins and captions name only places the narration names (no Jefferson, Capodimonte, Bond Street, Wylam, Kelston).
    - The time bar never parks a beat on a date the narration doesn't give. Use `year_label` for hedged times ("1860s", "late 1800s", "about 1700–1450 BC"). An undated claim, such as "made up later", sits on the year of the source that makes it, not on a nearby event.
    - Lower-thirds describe the picture plainly. Don't put a narration slogan over an unrelated photo, and don't imply that a later print or painting was made at the time.
    - No image more than about 3 times per episode. No run of more than 3 cards without a real picture.
- **Length (decided 2026-10-03):** ship at about 5 minutes. Holden on Seed Speech reads about 168 wpm, so an 830-word script runs about 5 minutes. No mid-roll ads under 8 minutes. That's accepted for launch. Extending means more research, never padding.

## Open items waiting on Gus
1. ~~Narrator decision~~: decided 2026-10-02. Holden on Seed Speech (see Channel).
2. ~~Length decision~~: decided 2026-10-03. Ship at natural length, about 5 minutes (episode 1 runs 9:37). No padding. Extend later only with new verified research, for the episodes that perform.
3. ~~Pilot~~: built 2026-10-02 in `production/ep001-the-man-who-invented-nothing/` (116 beats, 9:37, Holden narration, validated FCPXML, five blind reviews). **Still open:** 53 archival/stock beats from 32 items are placeholders, because the cloud network blocks loc.gov, wikimedia.org, si.edu and Higgsfield's CDN (d8j0ntlcm91z4.cloudfront.net). Either allow those hosts in the environment's network settings, or Gus downloads the files into `assets/` (names are in PENDING-ASSETS.md). The 8 narration MP3s go in `vo/`. Rights are confirmed for 11 of the 32 items.
3b. Episodes 2-5: rebuilt 2026-10-03 as motion cuts after Gus said the first version looked like a slideshow (see "Caught by Gus").
   - Every beat is now an animated clip: maps with routes, illustrated scenes, kinetic type and Ken Burns push-ins.
   - Each episode folder has PREVIEW.mp4 (with section labels), PICTURE.mp4 (clean; the Resolve timeline cuts it once per beat), TIMELINE.fcpxml (DTD-valid), SHOT-LIST, PENDING-ASSETS, README and A/B thumbnails.
   - Per-beat clips are a local build cache, gitignored at about 270MB per episode.
   - **Rebuilt again 2026-10-03 (v3, after Gus's Episode 2 notes):**
     - Real Commons images are the backbone, catalogued per episode in `images.json` with licence and credit.
     - No cartoon scenes.
     - A running time bar, with hedged labels such as "late 1800s".
     - Plain-talk scripts, with new narration checked by speech-to-text.
     - Runtimes and beats: ep2 5:43 (75), ep3 5:34 (76), ep4 5:11 (67), ep5 5:20 (69).
     - The photo beats are rendered and composited in the Higgsfield sandbox (`production/_shared/finish-in-sandbox.sh`), because this workspace can't reach Wikimedia.
     - The repo's PICTURE.mp4 files still carry placeholder cards on the photo beats.
   - Earlier runtimes (v2): ep2 5:51 (77), ep3 5:42 (75), ep4 5:39 (74), ep5 5:23 (66).
   - Stranger tests (now asking "is it entertaining?") ran 2–3 times per episode. None found a High problem in its final pass, and every Medium was fixed. Reviewers still rate the cuts "mostly" entertaining, limited by the missing real images.
   - **Still open:** 94 archival beats are placeholders (ep2 31, ep3 23, ep4 16, ep5 24). The network blocks the image hosts and the narration CDN, so the previews are silent and show dark "to fetch" cards.
   - Allowing these hosts unblocks both: d8j0ntlcm91z4.cloudfront.net, upload.wikimedia.org, commons.wikimedia.org, tile.loc.gov, www.loc.gov, ids.si.edu, collections.sciencemuseumgroup.org.uk, archive.org, iiif.wellcomecollection.org.
   - Ep4 must not air until the Nowak article and the 1858 text are in hand.
   - Ep4: Commons has an 1880 newspaper item ("Pizze alla napoletana", Il Bersagliere) saying Giovanni Brandi claimed to have made pizzas for Queen Margherita. Check it against the script and Nowak's paper before airing.
   - Narration cost for eps 2–5: 43.6 credits, plus 1.8 for the ep3 re-read.
4. Channel name: confirm the handle and domain with the commands in `channel-name-check.md` (direct checks were blocked from the cloud container).
5. Pronunciations to confirm: Magie (7), Chevedden (55), Tawell (97), Finlay (109), Koechlin and Nouguier (110). Others are confirmed in each script's reading notes.
6. Pre-recording source pulls, per the "Open check" column in `scripts/README.md`. The biggest are: the Nowak paper and the 1858 Usi e costumi text (4, pizza); a second strong source naming John Loud (53); a Sasson page reference for the Kibri-Dagan letter (47); and a second source for the Dunhuang banner and the Heilongjiang and Xanadu guns (49).
7. New repo: Gus will create an empty private `somebody-did-it-first` repo and give the Claude GitHub app access to it. The channel work then moves out of Osprey's `research/somebody-did-it-first` branch. Until then, that branch is the safe copy.

## Caught by Gus (pipeline misses) and the checks added
- **2026-10-03, episodes 2–5 looked like a slideshow.**
  - Gus's words: "terribly dull… what do they look like? Show us on a map what's going on."
  - The blind reviews had passed the cut, because they judged accuracy and pacing, not whether it was fun to watch.
  - Fix: a motion engine (`production/_shared/motion.html` and `motion.mjs`). Every beat is now an animated clip:
    - animated maps with routes and coastlines;
    - illustrated scenes for how things worked;
    - counters and kinetic type;
    - Ken Burns push-ins on photos.
  - New definition-of-done checks:
    - every beat moves;
    - archival placeholders are at most about 25% of beats, and text cards at most about 12%;
    - every section has a map or illustrated scene, and every place named in the narration gets a map;
    - the stranger's test now asks "is this entertaining, and where would a viewer click away?"
- **2026-10-03, Episode 2 notes.** Gus watched the narrated ep2 and listed:
  - The opening isn't relatable: Americans would guess Vanderbilt.
  - Not enough real photos: what did Trevithick, Stephenson and Rocket look like?
  - "Locomotion No. 1" was read as "Locomotion no one".
  - The jump to the Rainhill Trials didn't explain what they were.
  - The calendar pages tore off in the wrong order.
  - The illustrated tram-run animation looked like a "fifth grader" stop-motion.
  - The narrator says "right?" and makes asides.
  - "Made it work / made it pay" is not how people talk.
  - He wants a running timeline.

  Fixes:
  - Script rewritten and re-read.
  - Shot list rebuilt on 19 verified Commons images.
  - Time bar added to the engine.
  - Calendar order fixed.
  - Cartoon scenes dropped.
  - Scripts 3–5 cleaned up by the same voice rules (their shot lists and narration get redone once Gus approves the ep2 direction).

  Checks added:
  - The blind script read now flags "right?", narrator asides, slogan lines, unexplained terms, and abbreviations TTS may misread ("No. 1" is written "Number One").
  - The stranger's test asks "would an American viewer know this name or term?"
- **2026-10-03, Hanaoka date.**
  - "October 13, 1804" is the Japanese-calendar date; it falls on 14 November 1804 on ours.
  - The research had kept the date unqualified. The script now says "by the Japanese calendar of the time", and ep3 sections 06–07 were re-read.
  - Check added: any pre-1873 Japanese date (and any other non-Gregorian date) is flagged with its calendar.

## Sources (policy and licensing, checked 2026-10-02)
See the "Sources checked" table in `production-game-plan.md`. Re-check any row older than 30 days before a video ships.

## Higgsfield costs (measured 2026-10-02 on Gus's account, Plus plan)
| Item | Model | Credits | Notes |
|---|---|---|---|
| Full narration, 828 words (script 107) | text2speech_v2 / ElevenLabs, voice "Grady" | 14.25 | Three parts (2,048-character limit per request); 6 min 10 s of audio (~134 wpm). seed_audio priced at ~32 for the same text. |
| 5-second video clip, 720p | Kling 3.0 | 10 | Seedance 2.5 priced at 35 for the same clip. |
| Image | Nano Banana Pro | 4 | from spend history |
| Image | Nano Banana 2 | 1.5 | price check only, nothing generated |
| Image | GPT Image 2.5 (low) | 0.25 | price check only, nothing generated |
| Cold-open paragraph (~100 words), voice "Holden" | text2speech_v2 / ElevenLabs | 1.95 | Gus's pick (2026-10-02). Full episode ≈ 14 credits. |
| Same paragraph, voice "Holden" | text2speech_v2 / Seed Speech | 1.3 | Full episode ≈ 9.5 credits. MiniMax costs the same as ElevenLabs. Holden works only on ElevenLabs, MiniMax and Seed Speech. |
| Same paragraph, priced only | Cozy Voice 0.65 · Vibe Voice 1.3 · Seed Audio 4.3 | n/a | Holden isn't available on Cozy or Vibe, and the six male presets tried on Cozy were all rejected. |
