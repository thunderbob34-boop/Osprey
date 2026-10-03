# Episode 2: "The Real Father of the Railways"

Built 2026-10-03 with the shared production kit in `production/_shared/` (same system as the Episode 1 pilot).

## What's in this folder

| File | What it is |
|---|---|
| `The Real Father of the Railways - PREVIEW.mp4` | The animatic: every visual in order at its real timing (5:51), with the section name in the corner. It has no sound (see Narration). Watch this to approve the cut. |
| `The Real Father of the Railways - TIMELINE.fcpxml` | The Resolve timeline: 77 stills on the video track, the narration on a dialogue track, and a marker at each of the 6 sections. It validates against Apple's FCPXML 1.10 DTD. |
| `SHOT-LIST.md` / `shotlist.json` | One row per beat: start time, duration, the words being spoken, what's on screen, and the source and credit. |
| `PENDING-ASSETS.md` | The 34 archival beats still showing a placeholder card, with the file name to save each image under. |
| `graphics/` | Every frame at 1920×1080: 43 finished code graphics plus 34 placeholders. |
| `thumbnails/` | Two A/B thumbnail layouts (`thumbs.json` drives them; the portrait boxes fill in automatically once `assets/thumb-left.jpg` and `thumb-right.jpg` exist). |
| `vo/vo-manifest.json` | The narration: Holden on Seed Speech, one file per section, with its exact length and Higgsfield link. |

## How it was built and checked

1. **Narration first.** Holden read each section in Higgsfield (999 words). The real audio lengths set the timing of every beat. Penydarren, Merthyr and Abercynon were respelled in the TTS text only, for pronunciation.
2. **Shot list.** It has 77 beats, about one new visual every 5 seconds. The beat texts match the script word for word, which the build checks every time.
3. **Graphics.** These are code-built in the channel's archive-paper style: 34 archival, 15 text, 7 timeline, 5 compare, 4 pinmap, 3 stat, 2 quote, 2 date, 2 flow, 1 title, 1 datecard, 1 endcard. Maps use Natural Earth coastlines. Nothing is AI-generated.
4. **Blind review.** A reviewer with no context checked the cut for places where a viewer gets lost or bored, where the picture doesn't match the words, and where on-screen text overstates the narration or drops a hedge. It ran four times, and no pass found a High problem. The Medium ones were all fixed: Homfray named in the narration but not on screen, a card that dropped "a lot of" from the Stephensons' credit, and the same replica photo shown three times in 45 seconds. The second pass and the final pass were clean, with one Medium found and fixed in between.
5. **Mechanical checks** run on every build: every frame is 1920×1080; the animatic length equals the narration length; the timeline has 77 clips and 6 markers; the timeline passes DTD validation.

## What's left before it can be uploaded

1. **Archival images (34 beats, from 15 distinct items).** Rights are stated for 5 items, covering 14 beats. The others need their rights checked on the item page. `PENDING-ASSETS.md` lists each one.
   - The cloud workspace's network blocks the museum and library sites, so these couldn't be downloaded here. You can allow those hosts and I'll fetch them, or save each image in `assets/` under the name in `PENDING-ASSETS.md`.
   - Then run `python3 production/_shared/build.py --ep production/ep002-the-real-father-of-the-railways`. Each image is fitted to the frame automatically, with its lower-third and credit.
   - Six of the unconfirmed items are Science Museum Group objects (the Penydarren model, Locomotion No. 1, Rocket, the Rocket print, the Rainhill lithograph and Puffing Billy). Their reuse licence has to be read on each object page.
   - The tramplate beat uses a generic Museum Wales record. Museum Wales also lists a Penydarren tramplate (accession 46.209/1); confirm which one it is and fix the label if needed.
   - There is no period image of the 1804 run itself. Those beats use the conjectural model, a modern replica photo (captioned as modern) and maps. The Terence Cuneo painting is modern and in copyright, so it was left out.
2. **Narration files.** The section MP3s are in your Higgsfield library, and the links are in `vo/vo-manifest.json`. Put them in `vo/` under the names in the manifest; the timeline already points to them.
3. **Resolve.** File > Import > Timeline and pick the `.fcpxml`. If the media shows offline, use Relink Media and point it at this folder.
4. **Upload checklist.** Mark "altered or synthetic content: Yes", because the voice is synthetic. Credit every archival image in the description. Pick a thumbnail.

## Cost

- **Higgsfield:** 11.5 credits, all narration. No images or video clips were needed.
