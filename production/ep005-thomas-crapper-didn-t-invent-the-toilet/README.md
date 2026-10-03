# Episode 5: "Thomas Crapper Didn't Invent the Toilet"

Built 2026-10-03 with the shared production kit in `production/_shared/` (same system as the Episode 1 pilot).

## What's in this folder

| File | What it is |
|---|---|
| `Thomas Crapper Didn't Invent the Toilet - PREVIEW.mp4` | The animatic: every visual in order at its real timing (5:23), with the section name in the corner. It has no sound (see Narration). Watch this to approve the cut. |
| `Thomas Crapper Didn't Invent the Toilet - TIMELINE.fcpxml` | The Resolve timeline: 70 stills on the video track, the narration on a dialogue track, and a marker at each of the 7 sections. It validates against Apple's FCPXML 1.10 DTD. |
| `SHOT-LIST.md` / `shotlist.json` | One row per beat: start time, duration, the words being spoken, what's on screen, and the source and credit. |
| `PENDING-ASSETS.md` | The 30 archival beats still showing a placeholder card, with the file name to save each image under. |
| `graphics/` | Every frame at 1920×1080: 40 finished code graphics plus 30 placeholders. |
| `thumbnails/` | Two A/B thumbnail layouts (`thumbs.json` drives them; the portrait boxes fill in automatically once `assets/thumb-left.jpg` and `thumb-right.jpg` exist). |
| `vo/vo-manifest.json` | The narration: Holden on Seed Speech, one file per section, with its exact length and Higgsfield link. |

## How it was built and checked

1. **Narration first.** Holden read each section in Higgsfield (924 words). The real audio lengths set the timing of every beat. Knossos was respelled in the TTS text only, for pronunciation.
2. **Shot list.** It has 70 beats, about one new visual every 5 seconds. The beat texts match the script word for word, which the build checks every time.
3. **Graphics.** These are code-built in the channel's archive-paper style: 30 archival, 17 flow, 11 text, 3 datecard, 2 pinmap, 2 date, 2 timeline, 1 title, 1 compare, 1 endcard. Maps use Natural Earth coastlines. Nothing is AI-generated.
4. **Blind review.** A reviewer with no context checked the cut for places where a viewer gets lost or bored, where the picture doesn't match the words, and where on-screen text overstates the narration or drops a hedge. It ran five times, and no pass found a High problem. The Medium ones were all fixed. Wallace Reyburn is now named in large type. Card-only runs got real photos (Crapper, Knossos, the S-bend drawing under the words "S-bend"). A ballcock patent by someone else was taken out of the "he made the toilet better" line. The timeline no longer gives away the ending early. The title card no longer names Harington and Cumming before the cold open reveals them. The final pass was clean.
5. **Mechanical checks** run on every build: every frame is 1920×1080; the animatic length equals the narration length; the timeline has 70 clips and 7 markers; the timeline passes DTD validation.

## What's left before it can be uploaded

1. **Archival images (30 beats, from 12 distinct items).** Rights are stated for 9 items, covering 25 beats. The others need their rights checked on the item page. `PENDING-ASSETS.md` lists each one.
   - The cloud workspace's network blocks the museum and library sites, so these couldn't be downloaded here. You can allow those hosts and I'll fetch them, or save each image in `assets/` under the name in `PENDING-ASSETS.md`.
   - Then run `python3 production/_shared/build.py --ep production/ep005-thomas-crapper-didn-t-invent-the-toilet`. Each image is fitted to the frame automatically, with its lower-third and credit.
   - No 1596 first-edition title page of The Metamorphosis of Ajax with a clear licence was found. The beat uses the Wellcome 1814 edition, labelled "1814 edition".
   - Unconfirmed rights: the Cumming portrait, the Mohenjo-daro photo, the Library of Congress 1917 troops photo, and the Cahill ballcock patent.
   - Clean imagery on purpose: no toilets in use, and no catalogue pages.
2. **Narration files.** The section MP3s are in your Higgsfield library, and the links are in `vo/vo-manifest.json`. Put them in `vo/` under the names in the manifest; the timeline already points to them.
3. **Resolve.** File > Import > Timeline and pick the `.fcpxml`. If the media shows offline, use Relink Media and point it at this folder.
4. **Upload checklist.** Mark "altered or synthetic content: Yes", because the voice is synthetic. Credit every archival image in the description. Pick a thumbnail.

## Cost

- **Higgsfield:** 10.6 credits, all narration. No images or video clips were needed.
