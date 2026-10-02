# Game Plan: How "Somebody Did It First" Videos Get Made

Prepared 2026-10-02. Every policy and licensing fact below was checked against a current source today. Links are at the bottom.

## The three decisions

1. **Who narrates:** **decided 2026-10-02: the AI voice "Holden" on Higgsfield's Seed Speech engine** (about 9.5 credits per episode). Every upload must tick YouTube's "altered or synthetic content" disclosure. The original comparison is kept below for reference.
2. **What's on screen:** an "archive documentary" look. Real photos, documents, patents, newspapers and museum objects, tied together with clean graphics. We never fake a photo of a real person or event.
3. **How long:** the scripts run about 5 minutes. We either ship them at that length or deepen the research to reach 8–10 minutes. That's your call, and the trade-off is below.

---

## 1. Narration: you, not an AI voice

| Option | Upside | Downside | Verdict |
|---|---|---|---|
| **You record it** | The scripts are already written in your cadence (your long breaths, "right?", "to be fair"). A real voice is the strongest protection against YouTube's monetization rule on "inauthentic content". It's also the channel's whole pitch: not AI slop. | Your time: a ~5-minute script is roughly 15–25 minutes at the mic with retakes (my estimate). | **Recommended** |
| AI clone of your own voice | Fast; good for fixing a single flubbed line. | YouTube's disclosure rules list "synthetically generating a person's voice to narrate a video" as something creators must disclose. A disclosure label on a channel built on credibility works against you. | Not recommended |
| Stock AI voice | Cheapest and fastest. | Since 15 July 2025, YouTube's "inauthentic content" rule targets mass-produced videos (examples include slideshows with the same narration, and text-to-speech videos with little original input). A faceless channel with 100 videos and a stock AI voice is exactly what that rule is watching for, and it's the "AI slop" look you're trying to avoid. | No |

**How narration works now:** the pipeline generates Holden's narration and drops it on the `VO` track, so you review it instead of recording. (If you ever record a line yourself, the old way still works:) the pipeline hands you a timeline that's already cut, with an empty `VO` track. In DaVinci Resolve: File > Import > Timeline, pick the file, and record straight into the VO track. You never build the edit yourself.

**Gear:** a decent USB or XLR mic, a quiet small room with soft surfaces, and the same mic distance every time. Your recording pace on the first video sets the timing for every timeline after it.

---

## 2. What viewers see: the visual system

**The look:** an archive documentary. Viewers should feel they're looking at the evidence: the patent, the newspaper, the object in the museum case. That's what makes "somebody did it first" believable. Every shot is one of these types:

| Shot type | What it is | Where it comes from | Example from our scripts |
|---|---|---|---|
| **Archival photo / portrait** | A real photo or engraving with a slow push-in | Library of Congress ("free to use and reuse"), Smithsonian Open Access (CC0) | Edison, Swan and Westinghouse portraits (ep. 1) |
| **The document itself** | The primary source on screen, with the key line highlighted | US patents (drawings generally not under copyright), Library of Congress newspapers, national archives | Benz's 1886 patent (ep. 8); John Loud's 1888 ballpoint patent; the 1903 tea-bag patent; the NYT "Far Worse Than Hanging" headline (ep. 1) |
| **Museum object** | The artifact on a clean background | Smithsonian Open Access (CC0), the Met (CC0 for public-domain works), NASA (generally not copyrighted, but the NASA logo is) | Gorrie's ice-machine patent model and the IBM Simon (both Smithsonian) |
| **"Who did it first" date card** | The channel's signature graphic. Two dates on a timeline, with the gap counted up. | Built in code, your palette | "Rocket 1829 vs. Trevithick 1804: 25 years" |
| **Map / route** | An animated line or pin | Built in code | The Norse at L'Anse aux Meadows (1021); the Duyfken (1606) |
| **Quote card** | A primary-source quote in a period typeface | Built in code | Alexander Gordon's 1795 admission; Zimri-Lim's icehouse tablet; Nairon's 1671 coffee book |
| **Explainer diagram** | A simple animated diagram of how it works | Built in code | Transformer step-up and step-down (ep. 1); how the phonautograph traced sound |
| **Period film** | Real early footage | Public domain: anything published in the US in 1930 or earlier is now public domain | Le Prince's 1888 Roundhay Garden Scene; early Edison films |
| **Illustration (AI-made)** | Only for scenes where no image survives | ChatGPT, in one saved illustrated channel style | Bi Sheng setting clay type; Ibn al-Nafis; ancient Mesoamerican rubber-making |
| **Stock B-roll** | Generic texture shots (hands, paper, city streets) | Licensed stock; keep to a minimum | Transitions |

**Rules that protect the channel:**
- **No fake photos.** AI is never used to make a realistic "photo" of a real person or a real event. YouTube requires a disclosure label for realistic synthetic scenes. Illustrations stay obviously illustrated, which YouTube doesn't require labeling, and carry a small "Illustration" tag anyway, because credibility is the brand.
- **Credit every image** in the description. Wikimedia Commons files are checked one by one, because their licenses vary, and so are Science Museum Group images.
- **Sensitive beats are shown with documents, not images.** No animal-cruelty or execution imagery: the dog demonstration and the Kemmler execution (ep. 1) use newspaper headlines and text cards. No gore in the medical episodes. The scripts' reading notes already flag these.
- **Cut beat for beat:** a new visual every few seconds, matched to the words being said at that moment, with no static stretches.

**Thumbnails:** one consistent template. The famous name or object, a red "NOT FIRST" stamp, and the real first-doer's face or object beside it. Two versions per video to A/B test on upload.

---

## 3. Length: ship at 5 minutes, or research to 8–10?

- **Today:** the reviewed scripts average about 840 spoken words, roughly 5 minutes each. The launch episode is the exception at about 10 minutes.
- **Why it matters:** YouTube only allows mid-roll ads on videos 8 minutes or longer. At 5 minutes, you get pre-roll ads but no mid-rolls.
- **Getting to 8–10 minutes honestly** means a second research round per episode for more verified material (the people, the stakes, what happened next), and then rewriting. It is not padding.
- **My suggestion:** launch the first 10–15 episodes at their natural length while the channel finds its audience. Then extend the strongest performers and new episodes to 8+ minutes once you can see what viewers stay for.

---

## 4. The per-video workflow (what's automated, what's yours)

This follows your youtube-pipeline process:

1. **Script:** done (99 scripts, plus the launch episode).
2. **Shot list:** one row per visual beat: what's on screen, its source, and its duration, timed to your read pace.
3. **Visuals built:**
   - code graphics (date cards, maps, quotes, diagrams) rendered at 1920×1080;
   - archival images pulled and credited;
   - the few illustrations rendered in the channel style.
   Every file is opened and checked against its beat.
4. **Animatic** (`PREVIEW.mp4`): the visuals in order, at their timings, with no audio. You watch it to approve.
5. **Timeline** (`.fcpxml`): imports into Resolve with one click, with section markers and an empty VO track.
6. **You record** into the VO track. This is your main job.
7. **Final audit:** a stranger's-eye check that every picture matches the words, plus thumbnails and the credits list.

**Your time per video:** about 10 minutes watching the animatic plus 15–25 minutes recording (my estimate). Everything else is produced for you.

---

## What I need from you

1. **Narrator:** you (recommended), or tell me otherwise.
2. **Length:** ship at ~5 minutes first (recommended), or research everything to 8–10 minutes before launch.
3. **Pilot:** say go, and I'll build the full package for Episode 1 (shot list, every visual, animatic and Resolve timeline) as the template for the other 99.

---

## Sources checked 2026-10-02

| Fact | Source |
|---|---|
| YouTube renamed "repetitious content" to "inauthentic content" on 15 July 2025, targeting mass-produced and repetitive videos | Social Media Today, "YouTube Clarifies Changes to Monetization Rules Around Inauthentic Content" (https://www.socialmediatoday.com/news/youtube-clarifies-monetization-update-inauthentic-repeated-content/752892/); Gulf News (https://gulfnews.com/technology/youtube-updates-monetisation-policies-ai-and-repetitive-content-ban-begins-july-15-1.500192660) |
| Creators must disclose realistic altered or synthetic content. Examples include a synthetically generated voice narrating a video, and realistic scenes that didn't happen. Clearly unrealistic or animated content doesn't need disclosure. | YouTube Blog, "How we're helping creators disclose altered or synthetic content" (https://blog.youtube/news-and-events/disclosing-ai-generated-content/); YouTube Help, "Disclosing use of GenAI content" (https://support.google.com/youtube/answer/14328491) |
| Mid-roll ads only on monetized videos 8 minutes or longer | YouTube Help, "Manage mid-roll ad breaks in long videos" (https://support.google.com/youtube/answer/6175006) |
| Smithsonian Open Access images are CC0 | Smithsonian Open Access FAQ (https://www.si.edu/openaccess/faq); Smithsonian Magazine (https://www.smithsonianmag.com/smithsonian-institution/smithsonian-releases-28-million-images-public-domain-180974263/) |
| The Met released public-domain works' images under CC0 (7 Feb 2017) | via university library guides summarizing the Met's Open Access program (e.g. https://guides.library.charlotte.edu/openimagesvideos) |
| Library of Congress "Free to Use and Reuse" sets | loc.gov (via university library guides) |
| NASA media generally not subject to US copyright; insignia and logos are protected | NASA, "Guidelines for using NASA Images and Media" (https://www.nasa.gov/nasa-brand-center/images-and-media/) |
| US patent drawings are generally not subject to copyright (limited exceptions under 37 CFR 1.71(d)–(e)) | Penn State Libraries FAQ (https://psu.libanswers.com/faq/325294); summary of the USPTO rule |
| US works published in 1930 entered the public domain on 1 Jan 2026 | Internet Archive Blog, "Public Domain Day 2026" (https://blog.archive.org/public-domain-day-2026/); Columbia University Libraries blog |
