# Episode 5: "Thomas Crapper Didn't Invent the Toilet"

Built 2026-10-03 with the shared production kit in `production/_shared/` (same system as the Episode 1 pilot).

## What's in this folder

| File | What it is |
|---|---|
| `Thomas Crapper Didn't Invent the Toilet - PREVIEW.mp4` | The animated cut: every beat in motion at its real timing (5:20), with the section name in the corner. It is silent until the narration MP3s are in `vo/` (see below); then the build adds them. Watch this to approve the cut. |
| `Thomas Crapper Didn't Invent the Toilet - PICTURE.mp4` | The clean animated picture (no section labels), the file the timeline cuts. |
| `Thomas Crapper Didn't Invent the Toilet - TIMELINE.fcpxml` | The Resolve timeline: 69 clips cut from the PICTURE file (one per beat, so any beat can be swapped), the narration on a dialogue track, and a marker at each of the 7 sections. It validates against Apple's FCPXML 1.10 DTD. |
| `SHOT-LIST.md` / `shotlist.json` | One row per beat: start time, duration, the words being spoken, what's on screen, and the source and credit. |
| `PENDING-ASSETS.md` | The 0 archival beats still showing a placeholder card, with the file name to save each image under. |
| `graphics/` | One still per beat at 1920×1080 (taken 70% of the way through its animation), for contact sheets and thumbnails. |
| `thumbnails/` | Two A/B thumbnail layouts (`thumbs.json` drives them; the portrait boxes fill in automatically once `assets/thumb-left.jpg` and `thumb-right.jpg` exist). |
| `vo/vo-manifest.json` | The narration: Holden on Seed Speech, one file per section, with its exact length and Higgsfield link. |

## How it was built and checked

1. **Narration first.** Holden read each section in Higgsfield (900 words). The real audio lengths set the timing of every beat. Knossos was respelled in the TTS text only, for pronunciation.
2. **Shot list.** It has 69 beats, about one new visual every 5 seconds. The beat texts match the script word for word, which the build checks every time.
3. **Pictures and motion.** 35 beats show real photos, prints, drawings and portraits from Wikimedia Commons (18 images, each with its licence and credit in `images.json`), with a slow push-in. Every beat is an animated clip, built in code in the channel's archive-paper style (`production/_shared/motion.html`):
   - a time bar along the top shows where in time each moment sits, with hedged labels where the narration is approximate;
   - maps fly in, drop pins and draw routes (Natural Earth coastlines);
   - numbers count up, words build in, timelines draw themselves, and text cards sit over a slowly drifting map of where that part of the story happens;
   Templates used: 35 archival, 12 flow, 6 pinmap, 3 date, 3 compare, 2 text, 2 stat, 2 datecard, 2 timeline, 1 title, 1 endcard. No picture is AI-generated.
4. **Review (this cut).** Every non-photo beat was checked on a contact sheet; every on-screen line was checked against the script so no hedge is dropped; the finished file was checked automatically for faces clear of the time bar and captions, normal audio level, and no blank frames. A blind review of this cut is still to do.
5. **Mechanical checks** run on every build: every still is 1920×1080; every clip has exactly its beat's frame count; the cut's length equals the narration length; the timeline has 69 clips and 7 markers; the timeline passes DTD validation.

## What's left before it can be uploaded

1. **Real images.** The 35 photo beats are finished outside this workspace: `production/_shared/finish-in-sandbox.sh` fetches the images from Wikimedia Commons, renders those beats and composites them into the narrated cut. The PICTURE file here still shows placeholder cards on those beats. To finish locally instead, save each image from `images.json` into `assets/` as `<key>.jpg` and re-run the build.
   - No picture of a straight pipe to the sewer; section 05 opens on type cards and an undated set of water-closet engravings.
   - Cumming's 1775 S-bend drawing exists only as a 355px copy, shown once at full frame.
   - No 1800s ballcock drawing; the ballcock is explained with type cards.
   - No image of Reyburn's Flushed with Pride (copyright); a title card stands in.
2. **Narration files.** The section MP3s are in your Higgsfield library, and the links are in `vo/vo-manifest.json`. Put them in `vo/` under the names in the manifest; the timeline already points to them, and re-running the build adds them to the preview.
3. **Resolve.** File > Import > Timeline and pick the `.fcpxml`. If the media shows offline, use Relink Media and point it at this folder (the PICTURE file and `vo/`).
4. **Upload checklist.** Mark "altered or synthetic content: Yes", because the voice is synthetic. Credit every archival image in the description. Pick a thumbnail.

## Cost

- **Higgsfield:** 10.6 credits, all narration. No images or video clips were needed.
