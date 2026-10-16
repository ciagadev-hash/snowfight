# Snowfight

A snowball .io brawl on a melting ice floe. Everyone plays in one arena, pushes each other into the sea, scoops snow to grow, and cashes out. The prize pot is paid by the coin's ($SNOW) pump.fun creator fees. Login is Solana wallet connect only.

## For the next Claude (read this first)

The owner writes in **Hungarian**: answer in Hungarian. Product copy (site, posts) in short, native English. No emojis, no "demo / example / not live" labels.

1. Read `FOLYTATAS.md` (Hungarian): what is done, every decision, and what is next.
2. Save and commit after every step; the owner asked for it.
3. Design rules the owner set:
   - Glossy, cute 3D style with a snowy daylight arctic world (ice floe on a turquoise sea, icebergs, snowball characters with knit beanies and glossy eyes).
   - The style reference was the GULP coin (playgulp.fun). Use it for the *style only*: never copy its colours, layout, background or characters. A first banner that looked like it was rejected hard.
   - Font: **Sniglet** (800 for titles, buttons and tags, 400 for body). The hero title is real 3D inflated letters (`site/title3d.js`, Sniglet TTF), icy blue + gold. Fredoka, Titan One and SVG-filter bubble letters were rejected.
   - The owner wants things spectacular and high quality. Flat, static or "cheap" looking work gets rejected; show options (e.g. a sheet) when a visual choice is open.
4. Open feedback on the showcase film (`video/`): the owner called it bad. My own read of why: it does not feel like real gameplay (sliding balls, no physical shoves or impacts), crowded unreadable name tags, same flat white-on-white shots, a weak first second, and key moments (knock-off, cash out) that do not hit. Ask the owner what bothers them most before redoing it.

## What is in here

| Path | What |
| --- | --- |
| `site/index.dev.html`, `site/app.js` | The site: hero with the live 3D arena, how to play, the pot, $SNOW, wallet connect, HUD, hold-to-cash-out |
| `site/game.js` | Arena engine (three.js): physics, bots, snow piles, shrinking floe, value, knock-offs |
| `site/title3d.js` | 3D inflated hero title |
| `tools/build.py` | Builds `dist/index.html` (one self-contained file) and `snowfight-site.zip` (Cloudflare Pages, with `deploy/_worker.js`). `python -I tools/build.py [CA]` |
| `brand/banner.html` | Banner / OG / pfp renders (`?a=banner|og|pfp`), rendered with `tools/shot.py` |
| `brand/fonts.html` | The font sheet the owner picked Sniglet from |
| `video/film.html`, `video/render.py` | Showcase film (deterministic `renderAt(t)`) and its frame renderer + synthesized music |
| `szovegek.txt` | Bio, launch post, short posts |

Rendering needs Python with Playwright (Chromium), Pillow, numpy and imageio-ffmpeg. Renders use SwiftShader, so they are slow.

## Not built yet

- Real multiplayer server (e.g. Cloudflare Durable Objects + websockets, server-side simulation). Today everyone plays a local arena with labelled bots.
- Real payouts: creator fees → treasury → cash-out transaction. A knocked-off ball's leftover 40% should go back to the pot.
- The $SNOW contract address (build with `python -I tools/build.py <CA>`).

Downloads (site files, showcase video, source zip): see the latest Release.
