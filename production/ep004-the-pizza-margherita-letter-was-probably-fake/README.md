# Episode 4: "The Pizza Margherita Letter Was Probably Fake"

Built 2026-10-03 with the shared production kit in `production/_shared/` (same system as the Episode 1 pilot).

## What's in this folder

| File | What it is |
|---|---|
| `The Pizza Margherita Letter Was Probably Fake - PREVIEW.mp4` | The animated cut: every beat in motion at its real timing (5:39), with the section name in the corner. It is silent until the narration MP3s are in `vo/` (see below); then the build adds them. Watch this to approve the cut. |
| `The Pizza Margherita Letter Was Probably Fake - PICTURE.mp4` | The clean animated picture (no section labels), the file the timeline cuts. |
| `The Pizza Margherita Letter Was Probably Fake - TIMELINE.fcpxml` | The Resolve timeline: 74 clips cut from the PICTURE file (one per beat, so any beat can be swapped), the narration on a dialogue track, and a marker at each of the 7 sections. It validates against Apple's FCPXML 1.10 DTD. |
| `SHOT-LIST.md` / `shotlist.json` | One row per beat: start time, duration, the words being spoken, what's on screen, and the source and credit. |
| `PENDING-ASSETS.md` | The 16 archival beats still showing a placeholder card, with the file name to save each image under. |
| `graphics/` | One still per beat at 1920×1080 (taken 70% of the way through its animation), for contact sheets and thumbnails. |
| `thumbnails/` | Two A/B thumbnail layouts (`thumbs.json` drives them; the portrait boxes fill in automatically once `assets/thumb-left.jpg` and `thumb-right.jpg` exist). |
| `vo/vo-manifest.json` | The narration: Holden on Seed Speech, one file per section, with its exact length and Higgsfield link. |

## How it was built and checked

1. **Narration first.** Holden read each section in Higgsfield (932 words). The real audio lengths set the timing of every beat. Nowak was respelled in the TTS text only, for pronunciation.
2. **Shot list.** It has 74 beats, about one new visual every 5 seconds. The beat texts match the script word for word, which the build checks every time.
3. **Motion.** Every beat is an animated clip, built in code in the channel's archive-paper style (`production/_shared/motion.html`):
   - maps fly in, drop pins and draw routes with a moving train or ship (Natural Earth coastlines);
   - illustrated scenes animate how things worked, each tagged as an illustration;
   - numbers count up, words build in, timelines draw themselves, and text cards sit over a slowly drifting map of where that part of the story happens;
   - photos and documents get a slow push-in.
   Templates used: 22 scene, 16 archival, 9 compare, 8 pinmap, 6 text, 3 timeline, 3 flow, 2 stat, 2 date, 1 title, 1 datecard, 1 endcard. Nothing is AI-generated.
4. **Blind review.** A reviewer with no context checked the cut, including the question "is this entertaining, and where would a viewer click away?", plus places where the picture doesn't match the words and where on-screen text overstates the narration or drops a hedge. It ran several times on the motion cut. No pass found a High problem. Fixes made: Esposito named in the "wife's surname" box; the 1858 pizza shown as the 1858 plate, never a modern Margherita; letter callouts timed to land as each problem is spoken; a "PROBABLY FAKE" stamp on the "probably fake" line; Naples maps widened and label collisions removed; the recap uses the queen's portrait and the 1858 plate rather than replaying earlier graphics.
5. **Mechanical checks** run on every build: every still is 1920×1080; every clip has exactly its beat's frame count; the cut's length equals the narration length; the timeline has 74 clips and 7 markers; the timeline passes DTD validation.

## What's left before it can be uploaded

1. **Archival images (16 beats, from 5 distinct items).** Rights are stated for 4 items, covering 12 beats. The others need their rights checked on the item page. `PENDING-ASSETS.md` lists each one.
   - The cloud workspace's network blocks the museum and library sites, so these couldn't be downloaded here. You can allow those hosts and I'll fetch them, or save each image in `assets/` under the name in `PENDING-ASSETS.md`.
   - Then run `python3 production/_shared/build.py --ep production/ep004-the-pizza-margherita-letter-was-probably-fake`. Each image is fitted to the frame automatically, with its lower-third and credit.
   - No open image of the letter itself exists, so the seal, handwriting and name problems are carried by a diagram.
   - The Nowak article page has publisher copyright. Get permission for a title-page capture, or keep it as a text card.
   - The only Queen Margherita image is a later-life photo (c. 1910 to 1915), and its lower-third says so.
2. **Narration files.** The section MP3s are in your Higgsfield library, and the links are in `vo/vo-manifest.json`. Put them in `vo/` under the names in the manifest; the timeline already points to them, and re-running the build adds them to the preview.
3. **Resolve.** File > Import > Timeline and pick the `.fcpxml`. If the media shows offline, use Relink Media and point it at this folder (the PICTURE file and `vo/`).
4. **Upload checklist.** Mark "altered or synthetic content: Yes", because the voice is synthetic. Credit every archival image in the description. Pick a thumbnail.
5. **Before this airs:** have the published Nowak article (Food, Culture & Society, 2014) and the 1858 Usi e costumi di Napoli e contorni vol. 2 text in hand and check them against the script. The research found only one strong source for the letter analysis.

## Cost

- **Higgsfield:** 10.7 credits, all narration. No images or video clips were needed.
