# ARGUS — demo video production kit

Everything needed to shoot, narrate and cut a demo video of ARGUS end to end.
Written to be followed top to bottom on the day: prep, script, shot list,
capture settings, edit commands.

**Target:** one 2:40 master cut (hackathon / portfolio / README embed), with a
0:60 cut derived from the same footage. Nothing here needs footage the master
cut doesn't already produce.

## Contents

- [The one idea](#the-one-idea)
- [Pre-flight](#pre-flight)
- [Capture settings](#capture-settings)
- [The master script](#the-master-script)
- [Shot list](#shot-list)
- [Editing](#editing)
- [The 60-second cut](#the-60-second-cut)
- [Things that go wrong on camera](#things-that-go-wrong-on-camera)

---

## The one idea

A demo video fails when it shows *features*. This one shows a single claim and
then proves it:

> **Every sentence in this brief is traceable to a source you can click.**

The pipeline, the tool belt, the observability, the evals — all of it exists to
make that one sentence true. So the emotional peak of the video is not the brief
appearing. It's the moment you **click a citation and a real public page opens**.
Build the cut around that beat.

Secondary claims, in priority order, if there's room:

1. It takes seconds, not 45 minutes.
2. Thin evidence produces a sparse brief, not a confident lie.
3. You can interrogate it afterwards, still cited.

## Pre-flight

Do all of this **the day before**, not ten minutes before recording.

### 1. Toolchain

```bash
nvm use 24          # engines.node is 24.x — see .nvmrc
pnpm install
```

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in `GEMINI_API_KEY` (free, no card — [AI Studio → API keys](https://aistudio.google.com/apikey)).
Everything else is optional.

Decide up front which of the optional layers appear on camera, because each one
changes what's on screen:

| Layer | Env | What it adds to the video |
|---|---|---|
| Sign-in + saved briefs | `DATABASE_URL`, `BETTER_AUTH_*`, `GOOGLE_CLIENT_*` | A sign-in control in the header, and a "briefs persist to your account" beat |
| Langfuse | `LANGFUSE_*` | The trace-tree shot in the architecture beat — **worth it**, it's the most credible 6 seconds in the video |
| Attachment storage | storage bucket | Clickable attachment sources in a saved brief |

**Recommendation:** configure `GEMINI_API_KEY` + Langfuse, skip auth and storage
for the master cut. Auth adds a Google consent screen you'd have to blur, and it
isn't the story.

### 3. Record against a production build, never `pnpm dev`

Dev mode gives you the Next.js dev overlay, route compilation stalls on first
navigation, and HMR flashes. All three show up on camera.

```bash
pnpm build
pnpm start          # http://localhost:3000
```

### 4. Warm the app and the model

Before the first take, click through the whole flow once for real:

1. Load `/`
2. Header → **Try a demo** → `/demo`
3. Press **Generate brief**, let it finish
4. Ask one follow-up
5. Click one source link

This compiles every route, warms the model connection, and — critically — tells
you the Gemini free tier isn't rate-limiting you today. If the warm-up run
errors, you've learned it in private.

### 5. Stage the browser state

- **Fresh browser profile.** No extensions, no bookmarks bar, no autofill
  dropdowns, no password manager.
- **Recent briefs:** the studio shows a "Recent briefs" list from
  `localStorage`. Two choices, both fine — pick one and be consistent:
  - *Empty* (clear site data) — cleanest, reads as first use.
  - *Pre-seeded with 2–3 briefs* — reads as a tool someone actually uses. To do
    this, generate two live briefs for real companies before recording, then
    don't clear storage.
- **Theme:** the app is dark by default and the palette was designed for it.
  Leave it dark. Don't demo the theme toggle — it's not the story.
- **Notifications off.** macOS: Focus / Do Not Disturb. Windows: Focus Assist.
- **Second monitor** for the script, if you have one. Never alt-tab on camera.

### 6. One rehearsal, timed

Read the script aloud while clicking through. If you land over 3:00, cut the
architecture beat first — it's the most compressible.

## Capture settings

### Screen recorder

Use **OBS Studio** (free, all platforms). Settings that matter:

| Setting | Value | Why |
|---|---|---|
| Base + Output resolution | `1920×1080` | Matches YouTube/README embeds; no rescaling artifacts |
| FPS | `60` | The app has a three.js animated background and CSS transitions; 30fps makes scrolls look juddery |
| Encoder | Hardware (NVENC / Apple VT / QSV) | Keeps CPU free so the app itself doesn't stutter |
| Rate control | `CRF 18` (or CQP 18) | Visually lossless source to edit from |
| Recording format | `mkv`, remux to `mp4` after | mkv survives a crash mid-take |
| Capture source | **Window Capture** on the browser, not Display Capture | No dock, no menu bar, no wallpaper |
| Audio | Mic on a separate track from desktop audio | Lets you fix a bad VO without re-shooting the screen |

### Browser window

- Size the window to exactly 1920×1080 if capturing display, or just use window
  capture and let OBS scale.
- **Zoom to 125–150%.** ARGUS uses a lot of 10–13px mono type (source labels,
  section labels, the meta footer). At 100% those are unreadable in a video
  compressed by YouTube. 150% is the sweet spot for a demo that will be watched
  on a phone or in a scaled-down README embed; 125% if you want more of the
  brief in frame at once.

  The ceiling is set by the layout, not by taste: the studio's two-column split
  and the brief's paired sections need ≥1024 CSS pixels, which on a 1920-wide
  capture means **stay at or below 175%**. Past that both collapse to a single
  narrow column and the brief stops looking like one screen.
- **Do not** use fullscreen (F11) for the whole video. Keeping the browser
  chrome visible for the first shot proves it's a real web app at
  `localhost:3000`; you can go fullscreen after.

### Cursor

Enable cursor capture, and **move it deliberately** — slow, straight lines,
pause before each click. Fast jittery mouse movement is the single most common
thing that makes a demo look amateur. If your recorder supports click
highlighting (OBS + a plugin, or ScreenStudio / Screen Studio on macOS), turn it
on.

### Audio

- Record VO **separately from the screen**, reading over the finished screen
  capture. Trying to narrate live while clicking produces both bad clicking and
  bad narration.
- Any USB mic or even AirPods beats laptop built-in. Record in a soft room
  (bed, curtains, closet) — room echo is unfixable in post.
- Record 3 seconds of silence at the start of the VO take, for noise reduction.

## The master script

**Total: ~2:40.** VO is word-for-word — read it at a natural pace, roughly 150
words per minute. `[ ]` = what's on screen. `»` = on-screen caption card (add in
the edit; also serves as the full script if you go voiceless).

---

### Beat 1 — The problem (0:00 – 0:12)

> **VO:** "Before a sales call, a rep spends forty-five minutes digging through
> the company's site, their filings, the news, job boards — and walks in with a
> pile of tabs and no synthesis."

**[ On screen ]** Not the app. A browser with **eight tabs open** — Nykaa's
investor relations page, their careers page, a news article, Wikipedia, Yahoo
Finance, their "who we are" page. Slowly cycle through three of them.

» *45 minutes of tabs. No synthesis.*

*Why this shot:* it's the only footage that isn't the app, and it's what makes
the brief that follows feel like a payoff. Grab these URLs from
`src/lib/demo/scenario.ts` — they're the same sources the demo brief cites,
which pays off subtly in beat 6.

---

### Beat 2 — What ARGUS is (0:12 – 0:24)

> **VO:** "ARGUS turns that into one cited, conversation-ready brief. You give
> it three things — the company, the person, the meeting. It gives you back one
> screen where every claim links to its source."

**[ On screen ]** Cut to `localhost:3000`. Land on the hero — *"Walk in already
briefed."* Let the animated background breathe for a beat. Slow-scroll past the
**Grounded in** strip (Wikipedia · Company site · Job boards · News (GDELT) ·
Wikidata · Web search) and stop.

» *ARGUS — pre-meeting intelligence*

---

### Beat 3 — The setup (0:24 – 0:42)

> **VO:** "Here's a real one. I'm selling fulfilment-cost observability, and I've
> got a renewal review with Nykaa — a public Indian e-commerce company — ahead of
> their festive quarter. This is demo mode: the sources are a fixed set of eight
> real public pages, so it runs the same every time. The brief itself is still
> written live by the model."

**[ On screen ]**
1. Click **Try a demo** in the header. The chip turns into **Exit demo**, the
   hero changes to *"Watch it get briefed."*
2. Scroll to the studio. The **Demo mode** banner is visible with its source
   chips — `financials · wikipedia · website · gdelt · jobboards`.
3. Hover slowly down the pre-filled form: **Company** Nykaa · **Who you're
   meeting** Ananya Deshmukh · **Meeting context** the renewal line · the
   **renewal** chip lit.
4. Expand / point at **Your product** — Lekha Systems, and what they sell.

» *Demo mode: scripted sources, live synthesis*

*Say the honesty line out loud.* "Only the gathering step is pre-recorded" is a
credibility gain, not a caveat — the app says it on screen, and an audience that
spots it themselves trusts you less than one you told.

---

### Beat 4 — Generation (0:42 – 1:04)

> **VO:** "Resolve figures out which Nykaa and which Ananya. Gather fans a belt
> of specialised tools out in parallel — Wikipedia, their own site, job boards,
> news sentiment, financials. Then synthesis writes the brief using only what
> those tools actually returned."

**[ On screen ]** Click **Generate brief**. You land on the focused page and the
loader runs its three stages:

- *Resolving the company & person…* (~0.7s)
- *Gathering signals across sources…* (~1.5s)
- *Synthesising your brief…* (however long the model takes)

The completed stages strike through as it advances — hold on that.

» *resolve → gather → synthesise*

*Timing note:* the pre-synthesis stages are fast by design. If the read-through
runs long here, **slow this segment to 60–70% in the edit** so the VO lands with
the stage labels rather than after them. Do not speed up the synthesis wait —
the real elapsed time is a selling point, and it's stamped in the footer anyway.

---

### Beat 5 — The brief (1:04 – 1:32)

> **VO:** "Eight seconds. Snapshot and objective at the top — framing, and it's
> labelled as framing. Then the sourced claims: talking points, risk alerts,
> buying signals. Underneath, the playbook — what to push for, what to ask, what
> to test. Every one of them carries a numbered citation."

**[ On screen ]** The brief renders. Move top to bottom, pausing on each:

1. Header — **FSN E-Commerce Ventures Ltd. (Nykaa)**, the `Demo data` badge,
   the person line, and the big **8 sources** counter.
2. *Summary · framing, not a sourced claim* — snapshot + objective.
3. **Talking points** (full width), **Risk alerts**, **Buying signals**.
4. *Your playbook · guidance, not sourced claims* — Decision asks, Questions to
   ask, Fit hypotheses.
5. Footer — `gemini-2.5-flash · 8.2s · scripted sources · live synthesis`.

» *Every claim carries a citation*

*Do not read the brief's contents aloud.* The audience reads faster than you
talk. Narrate the *structure*; let them read the substance.

---

### Beat 6 — The proof (1:32 – 1:52) ← **the peak**

> **VO:** "And this is the part that matters. That's not a footnote — it's a
> link. Every claim resolves to the actual page it came from. If a claim can't
> cite evidence, it doesn't go in the brief at all. No source, no sentence."

**[ On screen ]**
1. Hover a citation marker inside a talking point — the tooltip shows the source
   title.
2. Scroll to the **Sources** list — `[1]`…`[8]`, each with its tool name
   (`financials`, `wikipedia`, `website`, `gdelt`, `jobboards`).
3. **Click one.** Let the real page load in a new tab — Nykaa's investor
   relations page, or the Wikipedia article. Hold for a full 2 seconds on the
   loaded page.
4. Cut back to the brief.

» *No source, no sentence.*

*This is the shot the whole video exists for.* Give it room. Don't rush back.

---

### Beat 7 — Follow-ups (1:52 – 2:12)

> **VO:** "Once the brief exists, you can interrogate it — same evidence base,
> same rules. Ask for their biggest risk and you get an answer with citations.
> Ask something the evidence can't support, and it says so instead of inventing
> one."

**[ On screen ]**
1. Scroll below the brief to the follow-up bar.
2. Click the suggestion **"What's their single biggest risk?"** — the stage line
   reads *Checking the brief's evidence…*, then the cited answer appears.
3. *(Optional, if the take allows)* Type something deliberately unanswerable —
   e.g. *"What's their cloud spend?"* — and show the honest empty answer.

» *Grounded follow-ups — cited or honestly empty*

*The unanswerable question is the strongest 8 seconds in the video after the
citation click.* It's the difference between claiming you don't hallucinate and
demonstrating it. Include it if you have any room at all.

---

### Beat 8 — Under the hood (2:12 – 2:32)

> **VO:** "Under it: a Next.js app on the Vercel AI SDK, a belt of read-only
> tools that self-route on the resolved entity and fail soft, structured output
> so the brief shape is guaranteed, every run traced in Langfuse, and a
> deterministic eval suite that fails the build if a claim ever ships uncited."

**[ On screen ]** Three quick cuts, ~6 seconds each:

1. **The pipeline diagram** — the ASCII one from `README.md`, or scroll the
   *"An agent, not another dashboard"* section with its 01 Resolve / 02 Gather /
   03 Synthesise cards.
2. **A Langfuse trace** — the `brief → resolve → each gather tool → synthesize`
   tree with per-step latency and token cost. Zoom in enough that the tool names
   are legible.
3. **The evals passing** — a terminal running `pnpm eval`, green.

```bash
pnpm eval
```

» *Grounding invariants, machine-checked in CI*

---

### Beat 9 — Close (2:32 – 2:40)

> **VO:** "Forty-five minutes of research, in the time it takes to walk to the
> meeting room. That's ARGUS."

**[ On screen ]** The closing card on the landing page — *"Context, credibility,
command of the room."* Hold. Fade.

» *github.com/punyamsingh/ARGUS*

---

## Shot list

**Film in takes, not in one continuous run.** A single unbroken run means one
fumble costs you everything. Each take below is independently re-shootable.

| # | Take | Source | Duration | Notes |
|---|---|---|---|---|
| A | Eight open tabs, cycling | Browser, not the app | ~20s raw | URLs from `src/lib/demo/scenario.ts` |
| B | Landing page + slow scroll to the sources strip | `localhost:3000` | ~25s raw | Let the background animate |
| C | Enter demo, scroll the pre-filled studio | `/demo` | ~30s raw | Hover each field slowly |
| D | Generate → loader → brief renders | `/demo` → `/brief/new` | ~20s raw | **The one take you may need several attempts at** |
| E | Scroll the full brief, top to bottom | `/brief/<id>` | ~40s raw | Slow, even scroll speed |
| F | Hover a citation, open a source, come back | `/brief/<id>` | ~25s raw | The peak — shoot it twice |
| G | Two follow-up questions | `/brief/<id>` | ~40s raw | One answerable, one not |
| H | Langfuse trace tree | cloud.langfuse.com | ~15s raw | Zoom to legible |
| I | `pnpm eval` green | Terminal | ~15s raw | Big font — **22pt+**, and narrow the window so lines don't wrap |
| J | Closing card | `/` bottom | ~10s raw | Fade out |

Takes D through G must come from **one continuous session** (same brief, same
id) or the brief content will differ between shots and the cut will not match.
So: shoot D, and without touching anything else, keep rolling through E, F and G
as separate recordings of the same live brief.

**Total raw footage:** ~4 minutes, cut down to 2:40. That ratio is deliberate —
don't over-shoot.

## Editing

Any NLE works (DaVinci Resolve is free and excellent). If you'd rather stay in
the terminal, these `ffmpeg` recipes cover the whole edit.

**Remux OBS mkv → mp4** (no re-encode, instant):

```bash
ffmpeg -i take-d.mkv -c copy take-d.mp4
```

**Trim a take** (`-ss` start, `-to` end; re-encodes for frame accuracy):

```bash
ffmpeg -i take-e.mp4 -ss 00:00:03.5 -to 00:00:41 -c:v libx264 -crf 18 -preset slow -an take-e-trim.mp4
```

**Slow the loader segment to 65%** (beat 4, so the VO lands on the stage labels):

```bash
ffmpeg -i take-d-trim.mp4 -filter:v "setpts=PTS/0.65" -an take-d-slow.mp4
```

**Speed up dead time 4×** (e.g. a long page load you don't want to cut around):

```bash
ffmpeg -i clip.mp4 -filter:v "setpts=0.25*PTS" -an clip-fast.mp4
```

**Concatenate the takes.** Write `takes.txt`:

```
file 'take-a-trim.mp4'
file 'take-b-trim.mp4'
file 'take-c-trim.mp4'
file 'take-d-slow.mp4'
file 'take-e-trim.mp4'
file 'take-f-trim.mp4'
file 'take-g-trim.mp4'
file 'take-h-trim.mp4'
file 'take-i-trim.mp4'
file 'take-j-trim.mp4'
```

All clips must share resolution, fps and pixel format for `-c copy` to work — if
they came from the same OBS profile they do:

```bash
ffmpeg -f concat -safe 0 -i takes.txt -c copy screen-master.mp4
```

**Lay the voice-over over the screen master:**

```bash
ffmpeg -i screen-master.mp4 -i voiceover.wav \
  -filter:a "highpass=f=90,afftdn=nf=-25,acompressor=threshold=-18dB:ratio=3,loudnorm=I=-16:TP=-1.5:LRA=11" \
  -c:v copy -c:a aac -b:a 192k -shortest argus-demo.mp4
```

That audio chain is: roll off rumble → denoise → gentle compression → normalise
to −16 LUFS (the streaming standard). It turns an ordinary mic into a decent one.

**Add background music under the VO** (music at ~12% so it never fights speech):

```bash
ffmpeg -i argus-demo.mp4 -i music.mp3 \
  -filter_complex "[1:a]volume=0.12,afade=t=out:st=155:d=5[bg];[0:a][bg]amix=inputs=2:duration=first[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k argus-demo-music.mp4
```

**Burn in caption cards.** Write the `»` lines as `captions.srt`.

⚠️ **`FontSize` is not in pixels.** ffmpeg converts an SRT to ASS using a
reference canvas of **384×288**, then libass scales that to the frame — so on a
1080p export every size is multiplied by `1080 ÷ 288 = 3.75`. `FontSize=22` is
not small type; it renders at ~82px. Pick a number without knowing this and
you'll either get subtitles that fill half the screen or a re-encode you have to
throw away.

Convert once and set the canvas yourself, so the size you write is the size you
get:

```bash
ffmpeg -i captions.srt captions.ass
```

Then in `captions.ass`, set the header to the real frame size and the style to a
real pixel size:

```ini
[Script Info]
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
; Name, Fontname, Fontsize, PrimaryColour, ..., BorderStyle, ..., MarginV
Style: Default,Inter,88,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,4,0,0,2,60,60,72,1
```

Then burn it in:

```bash
ffmpeg -i argus-demo.mp4 -vf "subtitles=captions.ass" \
  -c:v libx264 -crf 18 -preset slow -c:a copy argus-demo-captioned.mp4
```

**Sizing, in real pixels on a 1080p frame:**

| Size | Reads as | Use when |
|---|---|---|
| `64` | Standard subtitle, slightly large | The video is mostly watched full-screen |
| `88` | A caption **card** — the default here | Phone viewing, README embed, LinkedIn/X autoplay |
| `104` | Title card | The 60-second cut, where each card is on screen ~2s |

These lines are short punchy cards (*"No source, no sentence."*), not dialogue
subtitles, so erring large is correct — but check one card at `88` against a
`960px`-wide embed before committing to a full re-encode:

```bash
ffmpeg -i argus-demo.mp4 -ss 95 -t 4 -vf "subtitles=captions.ass,scale=960:-1" -c:v libx264 -crf 18 caption-check.mp4
```

Burn captions if the video will autoplay muted (README embed, LinkedIn, X). Keep
them as a sidecar `.srt` for YouTube.

**Final export for the web:**

```bash
ffmpeg -i argus-demo-captioned.mp4 -c:v libx264 -crf 20 -preset slow \
  -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 160k argus-demo-final.mp4
```

`-pix_fmt yuv420p` and `-movflags +faststart` are non-negotiable for browser
playback — without them the video won't play in Safari or won't start streaming
until fully downloaded.

**A GIF for the README** (the citation-click beat, ~6s, is the right one):

```bash
ffmpeg -i take-f-trim.mp4 -ss 2 -t 6 -vf "fps=15,scale=900:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 argus-citations.gif
```

## The 60-second cut

Derived from the same footage — no re-shoot. Keep:

| Beat | From | Duration |
|---|---|---|
| Tabs → app hard cut | A + B | 0:08 |
| The setup, sped 1.5× | C | 0:10 |
| Generate → brief renders | D | 0:12 |
| Brief scroll, sped 1.5× | E | 0:10 |
| **Citation click, full speed** | F | 0:12 |
| One follow-up | G | 0:08 |

Cut entirely: beat 8 (architecture), the unanswerable follow-up, the closing
card. Replace the close with a 2-second end card: the wordmark and the repo URL.

The citation click keeps its full duration in every cut. Everything else is
compressible; that isn't.

## Things that go wrong on camera

| Symptom | Cause | Fix |
|---|---|---|
| Brief errors mid-generation | Gemini free-tier rate limit (requests/min or /day) | Space takes 60s apart. If you hit the daily cap, you're done for the day — hence the warm-up run the day before |
| Capture stutters during scroll | The three.js background competes with the encoder | Switch OBS to a hardware encoder; drop to 30fps; close every other app |
| Text unreadable after upload | Browser at 100% zoom | Re-shoot at 125–150%. Compression eats 10px mono type |
| Studio / brief collapse to one narrow column | Browser zoomed past ~175% on a 1920 capture | Back off to 150% — the two-column layouts need ≥1024 CSS px |
| Captions render enormous (or tiny) | `FontSize` in an SRT is on a 384×288 canvas, scaled 3.75× at 1080p | Use the `.ass` route with `PlayResX/Y` set to 1920×1080, where the number is real pixels |
| Brief content differs between shots | Takes D–G were recorded in separate sessions | They must be one continuous session on one brief |
| Loader flashes past before the VO gets there | The scripted resolve/gather stages total ~2.2s | Slow that segment to 65% in the edit (recipe above) |
| Dev overlay / route-compile stall on screen | Recorded against `pnpm dev` | `pnpm build && pnpm start` |
| A Google consent screen appears | Auth is configured and you clicked sign-in | Leave auth unconfigured for the master cut |
| Sources open to a 404 | A scripted URL rotted since the snapshot | Check every URL in `src/lib/demo/scenario.ts` during pre-flight; pick a different one to click |

---

## Appendix — the caption cards, in order

For a voiceless cut, or as an `.srt` starting point.

```
1. 45 minutes of tabs. No synthesis.
2. ARGUS — pre-meeting intelligence
3. Demo mode: scripted sources, live synthesis
4. resolve → gather → synthesise
5. Every claim carries a citation
6. No source, no sentence.
7. Grounded follow-ups — cited or honestly empty
8. Grounding invariants, machine-checked in CI
9. github.com/punyamsingh/ARGUS
```
