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
- **Visual system (pilot, 2026-10-02):** archive-paper palette: paper #EFE7D6, ink #1D1B18, red #A8261B, brass #9A7B3C, blue #2F5D7C. Fonts: Libre Baskerville (headlines), Inter (labels). Templates live in `production/ep001-the-man-who-invented-nothing/templates/` (card.html, render.mjs, build.py). Diagrams build step by step with the narration. Lower-thirds name every person and caption any modern photo. No more than 2 text cards in a row, and no stretch longer than 12 seconds without a picture.
- **Visuals:**
  - Real archival material first: Library of Congress, Smithsonian Open Access (CC0), the Met (CC0), NASA (no logos), US patents, and public-domain film and print (US-published 1930 or earlier).
  - AI only for scenes with no surviving image, in one illustrated channel style tagged "Illustration".
  - Never a realistic AI "photo" of a real person or event.
- **Sensitive beats:** no animal-cruelty, execution or gore imagery. Use documents and text cards instead.
- **Credits:** every image credited in the description; Wikimedia and Science Museum Group licenses checked per file.
- **Thumbnails:** famous name/object + red "NOT FIRST" stamp + the real first-doer. Two versions to A/B test.
- **Length (decided 2026-10-03):** ship at about 5 minutes. Holden on Seed Speech reads about 168 wpm, so an 830-word script runs about 5 minutes. No mid-roll ads under 8 minutes. That's accepted for launch. Extending means more research, never padding.

## Open items waiting on Gus
1. ~~Narrator decision~~: decided 2026-10-02. Holden on Seed Speech (see Channel).
2. ~~Length decision~~: decided 2026-10-03. Ship at natural length, about 5 minutes (episode 1 runs 9:37). No padding. Extend later only with new verified research, for the episodes that perform.
3. ~~Pilot~~: built 2026-10-02 in `production/ep001-the-man-who-invented-nothing/` (116 beats, 9:37, Holden narration, validated FCPXML, five blind reviews). **Still open:** 53 archival/stock beats from 32 items are placeholders, because the cloud network blocks loc.gov, wikimedia.org, si.edu and Higgsfield's CDN (d8j0ntlcm91z4.cloudfront.net). Either allow those hosts in the environment's network settings, or Gus downloads the files into `assets/` (names are in PENDING-ASSETS.md). The 8 narration MP3s go in `vo/`. Rights are confirmed for 11 of the 32 items.
4. Channel name: confirm the handle and domain with the commands in `channel-name-check.md` (direct checks were blocked from the cloud container).
5. Pronunciations to confirm: Magie (7), Chevedden (55), Tawell (97), Finlay (109), Koechlin and Nouguier (110). Others are confirmed in each script's reading notes.
6. Pre-recording source pulls, per the "Open check" column in `scripts/README.md`. The biggest are: the Nowak paper and the 1858 Usi e costumi text (4, pizza); a second strong source naming John Loud (53); a Sasson page reference for the Kibri-Dagan letter (47); and a second source for the Dunhuang banner and the Heilongjiang and Xanadu guns (49).
7. New repo: Gus will create an empty private `somebody-did-it-first` repo and give the Claude GitHub app access to it. The channel work then moves out of Osprey's `research/somebody-did-it-first` branch. Until then, that branch is the safe copy.

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
