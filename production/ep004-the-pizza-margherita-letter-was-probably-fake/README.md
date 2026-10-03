# Episode 4: "The Pizza Margherita Letter Was Probably Fake"

Built 2026-10-03 with the shared production kit in `production/_shared/` (same system as the Episode 1 pilot).

## What's in this folder

| File | What it is |
|---|---|
| `The Pizza Margherita Letter Was Probably Fake - PREVIEW.mp4` | The animated cut: every beat in motion at its real timing (5:11), with the section name in the corner. It is silent until the narration MP3s are in `vo/` (see below); then the build adds them. Watch this to approve the cut. |
| `The Pizza Margherita Letter Was Probably Fake - PICTURE.mp4` | The clean animated picture (no section labels), the file the timeline cuts. |
| `The Pizza Margherita Letter Was Probably Fake - TIMELINE.fcpxml` | The Resolve timeline: 67 clips cut from the PICTURE file (one per beat, so any beat can be swapped), the narration on a dialogue track, and a marker at each of the 7 sections. It validates against Apple's FCPXML 1.10 DTD. |
| `SHOT-LIST.md` / `shotlist.json` | One row per beat: start time, duration, the words being spoken, what's on screen, and the source and credit. |
| `PENDING-ASSETS.md` | The 0 archival beats still showing a placeholder card, with the file name to save each image under. |
| `graphics/` | One still per beat at 1920×1080 (taken 70% of the way through its animation), for contact sheets and thumbnails. |
| `thumbnails/` | Two A/B thumbnail layouts (`thumbs.json` drives them; the portrait boxes fill in automatically once `assets/thumb-left.jpg` and `thumb-right.jpg` exist). |
| `vo/vo-manifest.json` | The narration: Holden on Seed Speech, one file per section, with its exact length and Higgsfield link. |

## How it was built and checked

1. **Narration first.** Holden read each section in Higgsfield (847 words). The real audio lengths set the timing of every beat. Nowak was respelled in the TTS text only, for pronunciation.
2. **Shot list.** It has 67 beats, about one new visual every 5 seconds. The beat texts match the script word for word, which the build checks every time.
3. **Pictures and motion.** 31 beats show real photos, prints, drawings and portraits from Wikimedia Commons (17 images, each with its licence and credit in `images.json`), with a slow push-in. Every beat is an animated clip, built in code in the channel's archive-paper style (`production/_shared/motion.html`):
   - a time bar along the top shows where in time each moment sits, with hedged labels where the narration is approximate;
   - maps fly in, drop pins and draw routes (Natural Earth coastlines);
   - numbers count up, words build in, timelines draw themselves, and text cards sit over a slowly drifting map of where that part of the story happens;
   Templates used: 31 archival, 11 flow, 8 compare, 7 pinmap, 4 text, 1 title, 1 stat, 1 date, 1 datecard, 1 timeline, 1 endcard. No picture is AI-generated.
4. **Review (this cut).** Every non-photo beat was checked on a contact sheet; every on-screen line was checked against the script so no hedge is dropped; the finished file was checked automatically for faces clear of the time bar and captions, normal audio level, and no blank frames. A blind review of this cut is still to do.
5. **Mechanical checks** run on every build: every still is 1920×1080; every clip has exactly its beat's frame count; the cut's length equals the narration length; the timeline has 67 clips and 7 markers; the timeline passes DTD validation.

## What's left before it can be uploaded

1. **Real images.** The 31 photo beats are finished outside this workspace: `production/_shared/finish-in-sandbox.sh` fetches the images from Wikimedia Commons, renders those beats and composites them into the narrated cut. The PICTURE file here still shows placeholder cards on those beats. To finish locally instead, save each image from `images.json` into `assets/` as `<key>.jpg` and re-run the build.
   - No picture of Raffaele Esposito, Zachary Nowak, Rocco or de Bourcard; they are named on cards and map pins only.
   - The palace letter scan is tiny (312px) and is the disputed object itself; it is shown twice, small, as 'the letter said to be from 1889'.
   - The seal, handwriting and name problems are carried by type cards, since the scan is too small to point at.
2. **Narration files.** The section MP3s are in your Higgsfield library, and the links are in `vo/vo-manifest.json`. Put them in `vo/` under the names in the manifest; the timeline already points to them, and re-running the build adds them to the preview.
3. **Resolve.** File > Import > Timeline and pick the `.fcpxml`. If the media shows offline, use Relink Media and point it at this folder (the PICTURE file and `vo/`).
4. **Upload checklist.** Mark "altered or synthetic content: Yes", because the voice is synthetic. Credit every archival image in the description. Pick a thumbnail.
5. **Before this airs:** have the published Nowak article (Food, Culture & Society, 2014) and the 1858 Usi e costumi di Napoli e contorni vol. 2 text in hand and check them against the script. The research found only one strong source for the letter analysis.

## Cost

- **Higgsfield:** 10.7 credits, all narration. No images or video clips were needed.
