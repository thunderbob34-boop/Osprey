# Episode 2: "The Real Father of the Railways"

Built 2026-10-03 with the shared production kit in `production/_shared/` (same system as the Episode 1 pilot).

## What's in this folder

| File | What it is |
|---|---|
| `The Real Father of the Railways - PREVIEW.mp4` | The animated cut: every beat in motion at its real timing (5:43), with the section name in the corner. It is silent until the narration MP3s are in `vo/` (see below); then the build adds them. Watch this to approve the cut. |
| `The Real Father of the Railways - PICTURE.mp4` | The clean animated picture (no section labels), the file the timeline cuts. |
| `The Real Father of the Railways - TIMELINE.fcpxml` | The Resolve timeline: 75 clips cut from the PICTURE file (one per beat, so any beat can be swapped), the narration on a dialogue track, and a marker at each of the 6 sections. It validates against Apple's FCPXML 1.10 DTD. |
| `SHOT-LIST.md` / `shotlist.json` | One row per beat: start time, duration, the words being spoken, what's on screen, and the source and credit. |
| `PENDING-ASSETS.md` | The 0 archival beats still showing a placeholder card, with the file name to save each image under. |
| `graphics/` | One still per beat at 1920×1080 (taken 70% of the way through its animation), for contact sheets and thumbnails. |
| `thumbnails/` | Two A/B thumbnail layouts (`thumbs.json` drives them; the portrait boxes fill in automatically once `assets/thumb-left.jpg` and `thumb-right.jpg` exist). |
| `vo/vo-manifest.json` | The narration: Holden on Seed Speech, one file per section, with its exact length and Higgsfield link. |

## How it was built and checked

1. **Narration first.** Holden read each section in Higgsfield (951 words). The real audio lengths set the timing of every beat. Penydarren, Merthyr and Abercynon were respelled in the TTS text only, for pronunciation.
2. **Shot list.** It has 75 beats, about one new visual every 5 seconds. The beat texts match the script word for word, which the build checks every time.
3. **Pictures and motion.** 41 beats show real photos, prints, drawings and portraits from Wikimedia Commons (17 images, each with its licence and credit in `images.json`), with a slow push-in. Every beat is an animated clip, built in code in the channel's archive-paper style (`production/_shared/motion.html`):
   - a time bar along the top shows where in time each moment sits, with hedged labels where the narration is approximate;
   - maps fly in, drop pins and draw routes (Natural Earth coastlines);
   - numbers count up, words build in, timelines draw themselves, and text cards sit over a slowly drifting map of where that part of the story happens;
   Templates used: 41 archival, 11 pinmap, 5 text, 5 compare, 4 flow, 3 scene, 2 stat, 2 date, 1 datecard, 1 endcard. No picture is AI-generated.
4. **Review (this cut).** Every non-photo beat was checked on a contact sheet; every on-screen line was checked against the script so no hedge is dropped; the finished file was checked automatically for faces clear of the time bar and captions, normal audio level, and no blank frames. A blind review of this cut is still to do.
5. **Mechanical checks** run on every build: every still is 1920×1080; every clip has exactly its beat's frame count; the cut's length equals the narration length; the timeline has 75 clips and 6 markers; the timeline passes DTD validation.

## What's left before it can be uploaded

1. **Real images.** The 41 photo beats are finished outside this workspace: `production/_shared/finish-in-sandbox.sh` fetches the images from Wikimedia Commons, renders those beats and composites them into the narrated cut. The PICTURE file here still shows placeholder cards on those beats. To finish locally instead, save each image from `images.json` into `assets/` as `<key>.jpg` and re-run the build.
   - There is no period image of the 1804 run itself. Those beats use photos of the working Penydarren replica (captioned as a replica), an 1811 ironworks view, and maps.
   - The Rainhill print and the 1811 ironworks view are small originals, so their push-ins are kept gentle.
   - No picture is AI-generated or illustrated; the only drawn graphics are maps, calendars and type cards.
2. **Narration files.** The section MP3s are in your Higgsfield library, and the links are in `vo/vo-manifest.json`. Put them in `vo/` under the names in the manifest; the timeline already points to them, and re-running the build adds them to the preview.
3. **Resolve.** File > Import > Timeline and pick the `.fcpxml`. If the media shows offline, use Relink Media and point it at this folder (the PICTURE file and `vo/`).
4. **Upload checklist.** Mark "altered or synthetic content: Yes", because the voice is synthetic. Credit every archival image in the description. Pick a thumbnail.

## Cost

- **Higgsfield:** 11.5 credits, all narration. No images or video clips were needed.
