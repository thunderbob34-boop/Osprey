# Episode 1 pilot: "The Man Who Invented Nothing"

Built 2026-10-02 as the template for every episode after it.

## What's in this folder

| File | What it is |
|---|---|
| `The Man Who Invented Nothing - PREVIEW.mp4` | The animatic: every visual in order at its real timing (9:37), with the section name in the corner. Watch this to approve the cut. It has no sound (see Narration). |
| `The Man Who Invented Nothing - TIMELINE.fcpxml` | The Resolve timeline. It has 119 stills on the video track, the narration on a dialogue track, and a marker at each of the 8 sections. It validates against Apple's FCPXML 1.10 DTD. |
| `SHOT-LIST.md` / `shotlist.json` | One row per beat: start time, duration, the words being spoken, what's on screen, and the source and credit. |
| `PENDING-ASSETS.md` | The 41 archival beats still showing a placeholder card, with the institution, item, rights and URL for each. |
| `graphics/` | Every frame at 1920×1080: 78 finished code graphics plus 41 placeholders. |
| `thumbnails/` | Two A/B thumbnail layouts (the portrait boxes are placeholders). |
| `vo/vo-manifest.json` | The narration: Holden on Seed Speech, one file per section, with its exact length and Higgsfield link. |
| `templates/` | The reusable system: the card and diagram templates in the channel palette, the renderer, the build script, the thumbnail template and the FCPXML DTD. |

## How it was built and checked

1. **Narration first.** Holden read each section in Higgsfield, and the real audio lengths set the timing of every beat. There are no estimated durations.
2. **Shot list.** It has 119 beats, about one new visual every 5 seconds. Beat texts were checked word for word against the script, so every spoken word belongs to exactly one beat.
3. **Graphics.** These are code-built in one archive-paper style:
   - date cards and the "who did it first" timeline;
   - diagrams that build up step by step as the narration explains them;
   - maps and quote cards.

   Nothing is AI-generated. No beat needed an illustration, because real archival material exists for every scene.
4. **Blind review.** A reviewer with no context checked the cut twice, looking for places where a viewer gets lost or bored, where the picture doesn't match the words, or where on-screen text overstates the narration.
   - Fixed from the first pass: the Niagara–Buffalo map orientation; a "screw-in socket" beat that showed a friction-type socket; three slideshow-like runs of text cards; diagrams running ahead of or behind the narration; and one dropped "as Tesla told it" hedge.
5. **Mechanical checks** run on every build:
   - every frame is 1920×1080;
   - the animatic length equals the narration length;
   - the timeline has 119 clips and 8 markers;
   - the timeline passes DTD validation.

## What's left before it can be uploaded

1. **Archival images (41 beats).** The cloud workspace's network blocks loc.gov, wikimedia.org, si.edu and Higgsfield's file server, so these couldn't be downloaded here. `PENDING-ASSETS.md` lists each one.
   - They come from 29 distinct items. Rights are confirmed for 11 of them, which cover 17 beats: three LoC Edison portraits, the LoC Westinghouse portrait, Tesla, Swan, Latimer, the Smithsonian lamp, and three patents.
   - The other 18 items need their rights checked on the item page.
   - Two ways forward: allow those hosts in the environment's network settings and I'll fetch, check and drop them in; or download them on your Mac and save each under its beat id. Then run `python3 templates/build.py --skip-render` to rebuild.
2. **Narration files.** The 8 section MP3s are in your Higgsfield library, and the links are in `vo/vo-manifest.json`. Put them in `vo/` under the names in the manifest. The timeline already points to them.
3. **Resolve.** File > Import > Timeline and pick the `.fcpxml`. If the media shows offline, use Relink Media and point it at this folder.
4. **Upload checklist.**
   - Mark "altered or synthetic content: Yes", because the voice is synthetic.
   - Credit every archival image in the description.
   - Pick a thumbnail.

## Pilot cost

- **Higgsfield:** 18.6 credits, all narration (1,613 words, 9 min 37 s). No images or video clips were needed.
- **Claude:** the shot-list research, graphics system, builds and two blind reviews. The reusable templates were a one-time cost.
