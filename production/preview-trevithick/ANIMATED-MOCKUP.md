# Animated mockup (2026-10-03)

Same narration, cut points and time bar as the real-photo preview (media 891ee74d). Most beats are animated scenes; the real map, portrait and Rocket photo stay in.

- Finished video: https://d2ol7oe51mr4n9.cloudfront.net/user_3Jxhva7RWv8ZQ6PwQw5a7ufLHV6/ec794013-2be5-4cf7-b73a-bf8670f2afeb.mp4
- Method:
  - Recraft V4.1 still, 16:9, palette #EFE7D6 / #3B2F28 / #A8261B / #2F5D7C / #9A7B3C / #6E7F5A.
  - Kling 3.0 std, 5s, no sound, animated from that still.
  - Each clip is laid over the real-photo preview below the time bar (y=74, 1920×1006), tagged "ILLUSTRATION" bottom-left.
- Cost: about 52 credits (6 images at 1.25, 6 clips at 7.5).

| Window (s) | Narration | On screen | Image job | Video job |
|---|---|---|---|---|
| 0–5.2 | "On February 21st, 1804, at an ironworks in south Wales," | real map (kept) | | |
| 5.2–9.63 | "a Cornish engineer named Richard Trevithick was about to test a new machine." | engineer, engine, ironworks | cc32a7b7 | 537a7bb7 |
| 9.63–13.9 | engine on wheels, iron track | engine, flywheel turning | 8cf0d6a3 | b7bcb4b9 |
| 13.9–18.1 | five wagons, ten tons of iron | engine pulling wagons | 6b125df4 | 5143be24 |
| 18.1–21.29 | about seventy men | men riding the wagons | d37f4c8f | ed67aedf |
| 21.29–30.53 | the run; first known railway journey | real tramroad map, Linnell portrait (kept) | | |
| 30.53–36.98 | "But there was a problem…" cracking rails | wheel cracking a plate (slowed to 1.28×) | af756f2d | 6517e5e9 |
| 36.98–44.63 | Rocket, Rainhill | real Rocket photo (kept) | | |
| 44.63–49.68 | died broke; workers paid for funeral | mourners at a coffin | 79d12191 | bb4d09ca |
| 49.68–54.4 | sign-off | endcard (kept) | | |

## What's wrong with the drawings (my review of the frames)

1. **The track is drawn wrong.**
   - Penydarren was a plateway: L-shaped cast-iron plates on stone blocks, with no cross sleepers.
   - Every scene except the cracking close-up shows modern rails on sleepers.
2. **The engine changes from shot to shot.**
   - Four different designs appear.
   - The 13.9s shot has a giant wheel on the front, which is wrong.
   - The 9.63s shot is closest to the real engine: a single cylinder with a big flywheel.
3. **The mourners don't look like workers.** They wear gentlemen's waistcoats and frock coats, but the narration says local workers paid for the funeral.

**Fix if we go animated:**
- Build one locked reference sheet for the engine and the plateway, plus a cast of characters, from the replica photos.
- Generate every scene from that sheet.
- Write "stone-block plateway, no sleepers" into every track prompt.
