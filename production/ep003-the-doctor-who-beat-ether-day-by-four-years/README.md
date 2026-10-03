# Episode 3: "The Doctor Who Beat Ether Day by Four Years"

Built 2026-10-03 with the shared production kit in `production/_shared/` (same system as the Episode 1 pilot).

## What's in this folder

| File | What it is |
|---|---|
| `The Doctor Who Beat Ether Day by Four Years - PREVIEW.mp4` | The animated cut: every beat in motion at its real timing (5:42), with the section name in the corner. It is silent until the narration MP3s are in `vo/` (see below); then the build adds them. Watch this to approve the cut. |
| `The Doctor Who Beat Ether Day by Four Years - PICTURE.mp4` | The clean animated picture (no section labels), the file the timeline cuts. |
| `The Doctor Who Beat Ether Day by Four Years - TIMELINE.fcpxml` | The Resolve timeline: 75 clips cut from the PICTURE file (one per beat, so any beat can be swapped), the narration on a dialogue track, and a marker at each of the 7 sections. It validates against Apple's FCPXML 1.10 DTD. |
| `SHOT-LIST.md` / `shotlist.json` | One row per beat: start time, duration, the words being spoken, what's on screen, and the source and credit. |
| `PENDING-ASSETS.md` | The 23 archival beats still showing a placeholder card, with the file name to save each image under. |
| `graphics/` | One still per beat at 1920×1080 (taken 70% of the way through its animation), for contact sheets and thumbnails. |
| `thumbnails/` | Two A/B thumbnail layouts (`thumbs.json` drives them; the portrait boxes fill in automatically once `assets/thumb-left.jpg` and `thumb-right.jpg` exist). |
| `vo/vo-manifest.json` | The narration: Holden on Seed Speech, one file per section, with its exact length and Higgsfield link. |

## How it was built and checked

1. **Narration first.** Holden read each section in Higgsfield (939 words). The real audio lengths set the timing of every beat. Magendie, Hanaoka Seishu, Kan Aiya, mafutsusan and tsusensan were respelled in the TTS text only, for pronunciation. Sections 06 and 07 were re-read after the Hanaoka date fix.
2. **Shot list.** It has 75 beats, about one new visual every 5 seconds. The beat texts match the script word for word, which the build checks every time.
3. **Motion.** Every beat is an animated clip, built in code in the channel's archive-paper style (`production/_shared/motion.html`):
   - maps fly in, drop pins and draw routes with a moving train or ship (Natural Earth coastlines);
   - illustrated scenes animate how things worked, each tagged as an illustration;
   - numbers count up, words build in, timelines draw themselves, and text cards sit over a slowly drifting map of where that part of the story happens;
   - photos and documents get a slow push-in.
   Templates used: 23 archival, 7 scene, 7 pinmap, 7 compare, 6 text, 6 timeline, 5 date, 5 flow, 4 datecard, 2 quote, 1 title, 1 stat, 1 endcard. Nothing is AI-generated.
4. **Blind review.** A reviewer with no context checked the cut, including the question "is this entertaining, and where would a viewer click away?", plus places where the picture doesn't match the words and where on-screen text overstates the narration or drops a hedge. It ran several times on the motion cut. The one High problem was map backdrops behind timelines putting dates over the wrong countries; timelines and datecards no longer have backdrops in any episode. Medium fixes: card runs broken with portraits and documents; Magendie's face on screen when he is named; a "First, of the two" hedge on the public-versus-first card; the anesthesia diagram timed to the words; the Hanaoka date always shown with "Japanese calendar of the time".
5. **Mechanical checks** run on every build: every still is 1920×1080; every clip has exactly its beat's frame count; the cut's length equals the narration length; the timeline has 75 clips and 7 markers; the timeline passes DTD validation.

## What's left before it can be uploaded

1. **Archival images (23 beats, from 13 distinct items).** Rights are stated for 3 items, covering 6 beats. The others need their rights checked on the item page. `PENDING-ASSETS.md` lists each one.
   - The cloud workspace's network blocks the museum and library sites, so these couldn't be downloaded here. You can allow those hosts and I'll fetch them, or save each image in `assets/` under the name in `PENDING-ASSETS.md`.
   - Then run `python3 production/_shared/build.py --ep production/ep003-the-doctor-who-beat-ether-day-by-four-years`. Each image is fitted to the frame automatically, with its lower-third and credit.
   - Do not use Wellcome M0008841 for Morton (it is marked "In copyright"). Use M0002620 as listed.
   - The Countway Long engraving prints "Discoverer of anaesthesia" in its caption. That overstates the script, so crop it to the portrait.
   - No image of Long's own 1842 or 1849 record was found. The "documented" beat uses the Smithsonian Crawford W. Long Collection record instead.
   - No surgical, wound or patient imagery is used anywhere, on purpose.
2. **Narration files.** The section MP3s are in your Higgsfield library, and the links are in `vo/vo-manifest.json`. Put them in `vo/` under the names in the manifest; the timeline already points to them, and re-running the build adds them to the preview.
3. **Resolve.** File > Import > Timeline and pick the `.fcpxml`. If the media shows offline, use Relink Media and point it at this folder (the PICTURE file and `vo/`).
4. **Upload checklist.** Mark "altered or synthetic content: Yes", because the voice is synthetic. Credit every archival image in the description. Pick a thumbnail.

## Cost

- **Higgsfield:** 12.6 credits, all narration. No images or video clips were needed.
