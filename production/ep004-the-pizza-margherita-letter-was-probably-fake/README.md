# Episode 4: "The Pizza Margherita Letter Was Probably Fake"

Built 2026-10-03 with the shared production kit in `production/_shared/` (same system as the Episode 1 pilot).

## What's in this folder

| File | What it is |
|---|---|
| `The Pizza Margherita Letter Was Probably Fake - PREVIEW.mp4` | The animatic: every visual in order at its real timing (5:39), with the section name in the corner. It has no sound (see Narration). Watch this to approve the cut. |
| `The Pizza Margherita Letter Was Probably Fake - TIMELINE.fcpxml` | The Resolve timeline: 64 stills on the video track, the narration on a dialogue track, and a marker at each of the 7 sections. It validates against Apple's FCPXML 1.10 DTD. |
| `SHOT-LIST.md` / `shotlist.json` | One row per beat: start time, duration, the words being spoken, what's on screen, and the source and credit. |
| `PENDING-ASSETS.md` | The 29 archival beats still showing a placeholder card, with the file name to save each image under. |
| `graphics/` | Every frame at 1920×1080: 35 finished code graphics plus 29 placeholders. |
| `thumbnails/` | Two A/B thumbnail layouts (`thumbs.json` drives them; the portrait boxes fill in automatically once `assets/thumb-left.jpg` and `thumb-right.jpg` exist). |
| `vo/vo-manifest.json` | The narration: Holden on Seed Speech, one file per section, with its exact length and Higgsfield link. |

## How it was built and checked

1. **Narration first.** Holden read each section in Higgsfield (932 words). The real audio lengths set the timing of every beat. Nowak was respelled in the TTS text only, for pronunciation.
2. **Shot list.** It has 64 beats, about one new visual every 5 seconds. The beat texts match the script word for word, which the build checks every time.
3. **Graphics.** These are code-built in the channel's archive-paper style: 29 archival, 12 text, 9 flow, 3 timeline, 2 stat, 2 date, 2 datecard, 1 title, 1 pinmap, 1 quote, 1 compare, 1 endcard. Maps use Natural Earth coastlines. Nothing is AI-generated.
4. **Blind review.** A reviewer with no context checked the cut for places where a viewer gets lost or bored, where the picture doesn't match the words, and where on-screen text overstates the narration or drops a hedge. It ran four times, and no pass found a High problem. The Medium ones were all fixed. "His wife's surname" was ambiguous, so it now names Esposito. A compare card never paid off. A modern Margherita photo sat under the 1858 description, so it is now the 1858 plate. Long runs of cards got real pictures. The timeline label now says the Brandi detail comes from Nowak, and a date-card layout was fixed. The final pass was clean. This episode has the fewest usable images of the five (four items carry most of it), so expect some repeats until more sources are found.
5. **Mechanical checks** run on every build: every frame is 1920×1080; the animatic length equals the narration length; the timeline has 64 clips and 7 markers; the timeline passes DTD validation.

## What's left before it can be uploaded

1. **Archival images (29 beats, from 6 distinct items).** Rights are stated for 5 items, covering 23 beats. The others need their rights checked on the item page. `PENDING-ASSETS.md` lists each one.
   - The cloud workspace's network blocks the museum and library sites, so these couldn't be downloaded here. You can allow those hosts and I'll fetch them, or save each image in `assets/` under the name in `PENDING-ASSETS.md`.
   - Then run `python3 production/_shared/build.py --ep production/ep004-the-pizza-margherita-letter-was-probably-fake`. Each image is fitted to the frame automatically, with its lower-third and credit.
   - No open image of the letter itself exists, so the seal, handwriting and name problems are carried by a diagram.
   - The Nowak article page has publisher copyright. Get permission for a title-page capture, or keep it as a text card.
   - The only Queen Margherita image is a later-life photo (c. 1910 to 1915), and its lower-third says so.
2. **Narration files.** The section MP3s are in your Higgsfield library, and the links are in `vo/vo-manifest.json`. Put them in `vo/` under the names in the manifest; the timeline already points to them.
3. **Resolve.** File > Import > Timeline and pick the `.fcpxml`. If the media shows offline, use Relink Media and point it at this folder.
4. **Upload checklist.** Mark "altered or synthetic content: Yes", because the voice is synthetic. Credit every archival image in the description. Pick a thumbnail.
5. **Before this airs:** have the published Nowak article (Food, Culture & Society, 2014) and the 1858 Usi e costumi di Napoli e contorni vol. 2 text in hand and check them against the script. The research found only one strong source for the letter analysis.

## Cost

- **Higgsfield:** 10.7 credits, all narration. No images or video clips were needed.
