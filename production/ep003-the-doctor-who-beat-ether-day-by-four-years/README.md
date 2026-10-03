# Episode 3: "The Doctor Who Beat Ether Day by Four Years"

Built 2026-10-03 with the shared production kit in `production/_shared/` (same system as the Episode 1 pilot).

## What's in this folder

| File | What it is |
|---|---|
| `The Doctor Who Beat Ether Day by Four Years - PREVIEW.mp4` | The animatic: every visual in order at its real timing (5:43), with the section name in the corner. It has no sound (see Narration). Watch this to approve the cut. |
| `The Doctor Who Beat Ether Day by Four Years - TIMELINE.fcpxml` | The Resolve timeline: 71 stills on the video track, the narration on a dialogue track, and a marker at each of the 7 sections. It validates against Apple's FCPXML 1.10 DTD. |
| `SHOT-LIST.md` / `shotlist.json` | One row per beat: start time, duration, the words being spoken, what's on screen, and the source and credit. |
| `PENDING-ASSETS.md` | The 31 archival beats still showing a placeholder card, with the file name to save each image under. |
| `graphics/` | Every frame at 1920×1080: 40 finished code graphics plus 31 placeholders. |
| `thumbnails/` | Two A/B thumbnail layouts (`thumbs.json` drives them; the portrait boxes fill in automatically once `assets/thumb-left.jpg` and `thumb-right.jpg` exist). |
| `vo/vo-manifest.json` | The narration: Holden on Seed Speech, one file per section, with its exact length and Higgsfield link. |

## How it was built and checked

1. **Narration first.** Holden read each section in Higgsfield (934 words). The real audio lengths set the timing of every beat. Magendie, Hanaoka Seishu, Kan Aiya, mafutsusan and tsusensan were respelled in the TTS text only, for pronunciation.
2. **Shot list.** It has 71 beats, about one new visual every 5 seconds. The beat texts match the script word for word, which the build checks every time.
3. **Graphics.** These are code-built in the channel's archive-paper style: 31 archival, 10 text, 7 date, 5 timeline, 4 datecard, 4 flow, 4 compare, 2 quote, 1 title, 1 stat, 1 pinmap, 1 endcard. Maps use Natural Earth coastlines. Nothing is AI-generated.
4. **Blind review.** A reviewer with no context checked the cut for places where a viewer gets lost or bored, where the picture doesn't match the words, and where on-screen text overstates the narration or drops a hedge. It ran three times. The first pass found no High problems and 4 Medium ones, all fixed: a text-card run in section 2, the timeline drawing a 4-year gap as wide as a 38-year one (it now spaces by date), small diagram text, and an end card that didn't match the last line. The next two passes were clean.
5. **Mechanical checks** run on every build: every frame is 1920×1080; the animatic length equals the narration length; the timeline has 71 clips and 7 markers; the timeline passes DTD validation.

## What's left before it can be uploaded

1. **Archival images (31 beats, from 15 distinct items).** Rights are stated for 3 items, covering 7 beats. The others need their rights checked on the item page. `PENDING-ASSETS.md` lists each one.
   - The cloud workspace's network blocks the museum and library sites, so these couldn't be downloaded here. You can allow those hosts and I'll fetch them, or save each image in `assets/` under the name in `PENDING-ASSETS.md`.
   - Then run `python3 production/_shared/build.py --ep production/ep003-the-doctor-who-beat-ether-day-by-four-years`. Each image is fitted to the frame automatically, with its lower-third and credit.
   - Do not use Wellcome M0008841 for Morton (it is marked "In copyright"). Use M0002620 as listed.
   - The Countway Long engraving prints "Discoverer of anaesthesia" in its caption. That overstates the script, so crop it to the portrait.
   - No image of Long's own 1842 or 1849 record was found. The "documented" beat uses the Smithsonian Crawford W. Long Collection record instead.
   - No surgical, wound or patient imagery is used anywhere, on purpose.
2. **Narration files.** The section MP3s are in your Higgsfield library, and the links are in `vo/vo-manifest.json`. Put them in `vo/` under the names in the manifest; the timeline already points to them.
3. **Resolve.** File > Import > Timeline and pick the `.fcpxml`. If the media shows offline, use Relink Media and point it at this folder.
4. **Upload checklist.** Mark "altered or synthetic content: Yes", because the voice is synthetic. Credit every archival image in the description. Pick a thumbnail.

## Cost

- **Higgsfield:** 10.8 credits, all narration. No images or video clips were needed.
