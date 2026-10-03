# Episode 5: "Thomas Crapper Didn't Invent the Toilet"

Built 2026-10-03 with the shared production kit in `production/_shared/` (same system as the Episode 1 pilot).

## What's in this folder

| File | What it is |
|---|---|
| `Thomas Crapper Didn't Invent the Toilet - PREVIEW.mp4` | The animated cut: every beat in motion at its real timing (5:23), with the section name in the corner. It is silent until the narration MP3s are in `vo/` (see below); then the build adds them. Watch this to approve the cut. |
| `Thomas Crapper Didn't Invent the Toilet - PICTURE.mp4` | The clean animated picture (no section labels), the file the timeline cuts. |
| `Thomas Crapper Didn't Invent the Toilet - TIMELINE.fcpxml` | The Resolve timeline: 66 clips cut from the PICTURE file (one per beat, so any beat can be swapped), the narration on a dialogue track, and a marker at each of the 7 sections. It validates against Apple's FCPXML 1.10 DTD. |
| `SHOT-LIST.md` / `shotlist.json` | One row per beat: start time, duration, the words being spoken, what's on screen, and the source and credit. |
| `PENDING-ASSETS.md` | The 24 archival beats still showing a placeholder card, with the file name to save each image under. |
| `graphics/` | One still per beat at 1920×1080 (taken 70% of the way through its animation), for contact sheets and thumbnails. |
| `thumbnails/` | Two A/B thumbnail layouts (`thumbs.json` drives them; the portrait boxes fill in automatically once `assets/thumb-left.jpg` and `thumb-right.jpg` exist). |
| `vo/vo-manifest.json` | The narration: Holden on Seed Speech, one file per section, with its exact length and Higgsfield link. |

## How it was built and checked

1. **Narration first.** Holden read each section in Higgsfield (924 words). The real audio lengths set the timing of every beat. Knossos was respelled in the TTS text only, for pronunciation.
2. **Shot list.** It has 66 beats, about one new visual every 5 seconds. The beat texts match the script word for word, which the build checks every time.
3. **Motion.** Every beat is an animated clip, built in code in the channel's archive-paper style (`production/_shared/motion.html`):
   - maps fly in, drop pins and draw routes with a moving train or ship (Natural Earth coastlines);
   - illustrated scenes animate how things worked, each tagged as an illustration;
   - numbers count up, words build in, timelines draw themselves, and text cards sit over a slowly drifting map of where that part of the story happens;
   - photos and documents get a slow push-in.
   Templates used: 24 archival, 11 scene, 9 pinmap, 5 text, 4 flow, 2 title, 2 date, 2 stat, 2 compare, 2 datecard, 2 timeline, 1 endcard. Nothing is AI-generated.
4. **Blind review.** A reviewer with no context checked the cut, including the question "is this entertaining, and where would a viewer click away?", plus places where the picture doesn't match the words and where on-screen text overstates the narration or drops a hedge. It ran several times on the motion cut. No pass found a High problem. Fixes made: card runs broken with Crapper, Harington and Knossos images; the recap shows Harington's portrait and Cumming's patent drawing; Knossos callouts point at the right things; map labels moved apart; the "roof cisterns" card reads as the claim that's overstated, matching the narration.
5. **Mechanical checks** run on every build: every still is 1920×1080; every clip has exactly its beat's frame count; the cut's length equals the narration length; the timeline has 66 clips and 7 markers; the timeline passes DTD validation.

## What's left before it can be uploaded

1. **Archival images (24 beats, from 11 distinct items).** Rights are stated for 9 items, covering 21 beats. The others need their rights checked on the item page. `PENDING-ASSETS.md` lists each one.
   - The cloud workspace's network blocks the museum and library sites, so these couldn't be downloaded here. You can allow those hosts and I'll fetch them, or save each image in `assets/` under the name in `PENDING-ASSETS.md`.
   - Then run `python3 production/_shared/build.py --ep production/ep005-thomas-crapper-didn-t-invent-the-toilet`. Each image is fitted to the frame automatically, with its lower-third and credit.
   - No 1596 first-edition title page of The Metamorphosis of Ajax with a clear licence was found. The beat uses the Wellcome 1814 edition, labelled "1814 edition".
   - Unconfirmed rights: the Cumming portrait, the Mohenjo-daro photo, the Library of Congress 1917 troops photo, and the Cahill ballcock patent.
   - Clean imagery on purpose: no toilets in use, and no catalogue pages.
2. **Narration files.** The section MP3s are in your Higgsfield library, and the links are in `vo/vo-manifest.json`. Put them in `vo/` under the names in the manifest; the timeline already points to them, and re-running the build adds them to the preview.
3. **Resolve.** File > Import > Timeline and pick the `.fcpxml`. If the media shows offline, use Relink Media and point it at this folder (the PICTURE file and `vo/`).
4. **Upload checklist.** Mark "altered or synthetic content: Yes", because the voice is synthetic. Credit every archival image in the description. Pick a thumbnail.

## Cost

- **Higgsfield:** 10.6 credits, all narration. No images or video clips were needed.
