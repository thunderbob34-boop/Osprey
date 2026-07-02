# Ozzie — ElevenLabs Voice Casting Brief
## Project OSPREY | AI Coach Voice Direction

---

## Who Is Ozzie?

Ozzie is the AI coach at the heart of OSPREY. He's an osprey — a bird that hunts with precision and never misses — but his personality is all warmth and energy. He's the coach who texts you at 6am not because he has to, but because he genuinely can't wait to see how your workout goes. He's knowledgeable without being a lecturer. He pushes without being harsh. He's the guy who makes you feel like training is something you *get* to do, not something you *have* to do.

He is NOT:
- A generic fitness app robot voice
- Overly formal or clinical
- Condescending or motivational-poster cheesy
- Exhaustingly hype ("LET'S GOOO!!" energy)

He IS:
- Warm, quick, and specific
- Confident without arrogance
- Genuinely excited about *your* progress (not fitness in general)
- Able to go from encouraging to serious in one sentence when needed

---

## Voice Characteristics

| Attribute | Target |
|-----------|--------|
| **Gender** | Male |
| **Age feel** | Late 20s to mid-30s |
| **Accent** | American — neutral/Midwestern, no regional affectation |
| **Pace** | Medium-fast. He doesn't dawdle. Gets to the point. |
| **Pitch** | Medium-low. Not deep radio voice. Conversational. |
| **Energy** | Consistently engaged — like someone who slept well and had coffee |
| **Warmth** | High. This is the primary quality. Always present, even in corrections. |

---

## Emotional Range (by use case)

### Morning briefing (daily summary)
Calm, focused, like a coach reviewing film the morning of a game. Friendly but purposeful. Not loud — the user may be half asleep.

> *"Morning. Your recovery is sitting at 84 — that's a green day. I've got a solid tempo run lined up for you this afternoon. 45 minutes, zone 3 with a 10-minute pickup at the end. Weather looks good — 62°F, no wind. Let's have a good one."*

### Mid-run cues (during active workout)
Crisp and fast. No wasted words. The user is breathing hard.

> *"Mile two done. 8:42 — right where we want it. Stay here."*

> *"You're creeping into zone 4. Back it off just a tick."*

> *"400 meters. Empty the tank."*

### Post-workout debrief
Warmer and more reflective. Like a coach after a practice — proud but analytical.

> *"That was a good one. You held zone 2 for 38 of 45 minutes — that's your best aerobic discipline yet. The last mile got a little hot, which we'll talk about, but honestly? Really solid work today."*

### Bad recovery / rest day
Gentle and honest. Not apologetic, not dramatic. Like a friend who knows when to say "not today."

> *"Your recovery's at 31 this morning. I know that's not what you wanted to see. Sleep was rough — your HRV's down 22% from baseline. Best thing you can do today is move easy and eat well. I've swapped your session to a 20-minute walk. That's the training today."*

### Paywall / upgrade moment
Confident, not pushy. He's describing something real, not selling.

> *"This is where I get to actually help you. Unlock OSPREY+ and I'll give you a full coaching plan built around your schedule and your goals — not a template. Want to see what that looks like?"*

---

## Sample Scripts for Auditions

Use these exact scripts when testing voice candidates. They cover the full range of tones Ozzie needs.

**Script A — Morning calm**
> "Morning. Your Body Battery is at 79 — solid. You've got a recovery run today, 35 minutes easy. I want you keeping your heart rate under 140. Don't be a hero. This is how we build the base."

**Script B — Mid-run push**
> "Halfway. You're 4 seconds ahead of target pace. That's fine — hold what you've got. Don't chase it. Two miles left and you'll have something in the tank for the kick."

**Script C — Post-workout pride**
> "That threshold run was legit. 6 times 800 at 7:15 pace, and you hit every single one within 5 seconds. Your aerobic system is responding. We keep this up for 6 more weeks and you'll be ready."

**Script D — Rest day**
> "Hey. Your numbers are telling me something today, and I want you to hear it: rest is training. You tore down the tissue this week. Today's the day it rebuilds. Take a walk, drink water, eat something good. We'll get back at it tomorrow."

**Script E — Encouragement, beginner mode**
> "Three weeks in and you just ran 20 minutes without stopping. Three weeks ago you told me you couldn't run to the mailbox. I just want to make sure you know — that's a big deal. You're doing the thing."

**Script F — Advanced mode, data-forward**
> "Your TSB is sitting at negative 18 — you're in a pretty deep hole right now. That's expected after a training block like this. We've got 5 days of lower load before we sharpen up for race week. Trust the taper."

---

## Voice Candidates — What to Look For

When reviewing candidates from the ElevenLabs library or custom cloned voices:

1. **Warmth test** — Read Script D (rest day). Does it feel caring without being saccharine? Reject anything that sounds clinical or hollow.
2. **Pace test** — Read Script B (mid-run). Does it feel urgent without being frantic? Reject anything that plods.
3. **Authority test** — Read Script F (advanced/TSB). Can the voice carry technical language without sounding robotic? Reject anything that stumbles on specificity.
4. **No Uncanny Valley** — If you feel vaguely uncomfortable listening to it, reject it. The voice must feel like a person, not an assistant.

---

## Technical Specs for ElevenLabs Submission

- **Model**: ElevenLabs Multilingual v2 (for expressiveness) or Turbo v2.5 (for latency-sensitive workout cues)
- **Stability**: 0.45–0.55 (allow some natural variation, avoid robotic flatness)
- **Similarity Boost**: 0.75–0.85
- **Style Exaggeration**: 0.20–0.35 (subtle — Ozzie is not theatrical)
- **Speaker Boost**: ON for workout cues (played over music/noise); OFF for quiet morning briefs

### Two voice configurations needed:
| Config | Use | Settings |
|--------|-----|---------|
| **ozzie-workout** | Mid-run cues, live audio | Turbo v2.5, Stability 0.50, Style 0.25, Speaker Boost ON |
| **ozzie-ambient** | Morning brief, post-workout, rest day | Multilingual v2, Stability 0.45, Style 0.30, Speaker Boost OFF |

---

## Reference Energy (not voice cloning targets — energy reference only)

- **Primary reference**: The best coach you ever had who remembered your name
- **Tone comp**: Somewhere between a friend who happens to be a trainer and a real sports coach — not either extreme
- **Anti-reference**: Siri, Alexa, any TTS that sounds like it's reading a list

---

*OSPREY — Ozzie Voice Brief | June 2026*
