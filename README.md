# SnowPump

A snowball .io brawl on a melting ice floe (the project was called Snowfight before; the owner renamed it SnowPump). Everyone plays in one arena, shoves each other into the sea, scoops snow to grow, and cashes out. The prize pot is paid by the coin's ($SNOW) pump.fun creator fees. Login is Solana wallet connect only.

## For the next Claude (read this first)

The owner writes in **Hungarian**: answer in Hungarian. Product copy (site, posts) in short, native English. No emojis, no "demo / example / not live" labels.

1. Read `FOLYTATAS.md` (Hungarian): what is done, every decision, and what is next.
2. Save and commit after every step; the owner asked for it. Videos (`video/*.mp4`) are not committed, they are too big.
3. Design rules the owner set:
   - Glossy, cute 3D style: a snowy daylight arctic world (ice floe on a turquoise sea, icebergs, snowball characters in knit beanies with glossy eyes). The character design stays; only its quality goes up.
   - Type: **DynaPuff** (bubbly, titles, buttons, numbers) with a thick ink outline and a solid ink drop (`.gt` class), **Nunito** 800/900 for small text. The owner picked DynaPuff from a sheet of 11 bubbly fonts.
   - Colours: clean, no yellow text. Ink `#152b6b`, white fills, green `#5df29b→#1fcf6e` for money and Play, pink `#ff7ab8→#ff3f93` for knockouts and "you", blue `#5cc0ff→#2f8dff`.
   - The owner wants things spectacular, game-like and smooth. Flat, static or cheap-looking work gets rejected.
   - The style reference was the GULP coin (playgulp.fun): style only, never its colours, layout or characters.

## How it works

One deterministic engine runs the game, the hero backdrop and the showcase film.

| Path | What |
| --- | --- |
| `site/sim.js` | Simulation (no rendering): fixed 120 Hz step, ball physics with full overlap resolution, dash shoves with knockback, bots, snow piles, the 90 s shrinking-floe cycle, falls and knockout credit, cash out, spawn shield. Emits events. |
| `site/world.js` | three.js renderer: sky, shader sea (foam, ripples), cracking floe, icebergs, the instanced snowball characters (expressions, blinking, squash, hops), blob shadows, particles. About 25 draw calls. |
| `site/game.js` | The playable arena: input (mouse, WASD, touch stick), smooth camera, interpolation, hit-stop, adaptive resolution, tags, minimap, HUD events. |
| `site/sfx.js` | Game sounds, synthesized with WebAudio. |
| `site/index.dev.html`, `site/app.js` | The site, hash-routed pages: home (live arena hero), `#/leaderboard`, `#/how` (guide + FAQ), `#/snow` (the pot, CA, buy/chart), `#/community` (X, Discord). Wallet connect, HUD, cash out, snowball SVG avatars. |
| `site/config.json` | CA and links (X, Discord, pump.fun) baked in at build time. Empty links show "Link drops at launch". |
| `deploy/_worker.js` | Cloudflare worker: `/api/leaderboard` reads KV key `leaderboard` (the payout server writes it). Until then the board shows an honest Season 1 empty state. |
| `tools/build.py` | Builds `dist/index.html` (one file; modules inlined as data: URL modules) and `snowpump-site.zip` for Cloudflare Pages. `python -I tools/build.py [CA]` |
| `video/film.html` | The 30 s showcase film (`renderAt(t)`, `?ar=916` for the vertical cut). |
| `video/shots.js` | The film's shots as small sim scenarios (real shoves, knockouts and splashes), timed to a 128 BPM track. |
| `video/soundtrack.py` | Synthesized music + sound effects placed on the film's real events. |
| `video/render.py` | Renders the film to MP4. |
| `tools/lab.html` | Dev lab: runs the sim and renders one frame from a chosen camera. |

Dev: serve the repo root (`python -m http.server`) and open `site/index.dev.html`. Wallet connect needs a web address, not a file.

## Rendering the showcase

Needs Python with `pip install playwright numpy imageio-ffmpeg pillow` and `python -m playwright install chromium`.

```
python -I video/render.py --stills 0.3 8.7 22.7      # quick check stills -> video/_still_*.png
python -I video/render.py --gpu                      # 16:9, 1920x1080, 60 fps, with sound -> video/snowpump-showcase.mp4 (+ -muted.mp4)
python -I video/render.py --vertical --gpu           # 9:16, 1080x1920 -> video/snowpump-showcase-vertical.mp4
```

`--gpu` uses the graphics card and is much faster; if it gives errors or black frames, run without it (SwiftShader, slow but always works). `--workers N` sets the parallel browsers (default 4). Frames are cached in `video/_frames*` and thrown away automatically when the film sources change.

## Not built yet

- Real multiplayer server (e.g. Cloudflare Durable Objects + websockets, running `site/sim.js` server-side). Today everyone plays a local arena with labelled bots.
- Real payouts: creator fees → treasury → cash-out transaction. A knocked-off ball's leftover 40% should go back to the pot.
- The $SNOW contract address and the X / Discord links: put them in `site/config.json`, then `python -I tools/build.py`.
- The leaderboard's data: the payout server should write `{ earners, biggest, kos }` to the KV key `leaderboard`. No made-up entries: the owner's buyers would read them as real earnings.
- Brand images (`site/pfp.png`, `site/og.png`, `site/banner.png`) still show the old characters; re-render them with the new look and the SnowPump name.
