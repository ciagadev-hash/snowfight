# Snowfight.io: hol tartunk

## Koncepció (a felhasználó kérése, 2026-10-16)
- .io játék, mindenki egyszerre egy arénában (mint a slither.io / agar.io). A felhasználó a hógolyós ötletet választotta.
- Játékmenet: hógolyók egy zsugorodó jégtáblán, lökdösik egymást, aki leesik, kiesik. A golyó nő (hó gyűjtése, ellenfelek lelökése).
- Pénz: a coin creator fee-je adja a potot. A golyód értéke élőben, dollárban látszik, és egy minimális méret fölött cash outolhatsz a walletedbe.
- Belépés: csak wallet connecttel (Phantom, Solflare, Backpack), nálunk nincs más belépés.
- Kell még: banner, OG, pfp, oldal, és illő szövegek (bio, launch poszt, oldalszöveg).

## Design szabályok
- Stílusreferencia: glossy 3D aranyos ("kawaii 3D") stílus. A felhasználó a GULP (playgulp.fun) bannerét mutatta, de SZIGORÚAN csak stílusreferencia: semmi ne hasonlítson rá (szín, elrendezés, háttér, karakter). Az első bannerem (sötét űr, színes blobok sorban) túl közel volt, és el lett utasítva.
- Új irány: nappali havas sarki jelenet, zsugorodó jégtábla a tengeren, jéghegyek, havazás, hóból gyúrt hógolyó-karakterek fényes, aranyos szemekkel, színes sapkával vagy sállal, és a golyók fölött dollárérték-címkék.
- Nem a PSApad / kártyás vonal, és nem a worm.

## Kész (2026-10-16)
- Banner (napos sarki jégtábla, hógolyók sapkában, dollárcímkék), OG, és egy pörgős pfp (kék sunburst, felénk guruló hógolyó vigyorral, hórobbanás). A felhasználó a csendes, statikus pfp-t elutasította ("zero effect").
- Oldal: `site/index.dev.html` + `site/game.js` (three.js aréna-motor) + `site/app.js` → `python -I tools/build.py [CA]` → `dist/index.html` (141 KB) + `snowfight-site.zip` (Cloudflare Pages, `_worker.js` relay). Fredoka betűtípus, gömbölyded gombok.
  - A hero-ban élőben fut az aréna (botok, "bot" címkével), keringő kamerával.
  - Play: wallet connect → név és sapkaszín → játék. Egérrel vagy joystickkal irányítasz, szóköz a lökés, a hókupacoktól nősz, a lelökött játékos havának 60%-a a tiéd, a jégtábla 90 másodpercenként összeszűkül, majd újrafagy.
  - HUD: élő dollárérték, rang, knockoutok, jégméret. Cash out 8 dollártól: 3 másodpercig kell nyomva tartani, és ha meglöknek, elölről kezdődik.
  - Amíg nincs szerver és pot, a cash out popup jelzi, hogy a kifizetések a $SNOW launch-csal indulnak.
- Szövegek: `szovegek.txt`. Kész csomag: `Downloads/snowfightkesz`.

## Következik
- Igazi multiplayer szerver (Cloudflare Durable Objects + websocket, szerveroldali szimuláció) és pot-kifizetés (creator fee → treasury → cash out tranzakció). A kliens motor ugyanaz marad.
- CA a buildbe: `python -I tools/build.py <CA>`.

## Fájlok
- `brand/banner.html` (three.js, ?a=banner|og|pfp), render: `python -I tools/shot.py "brand/banner.html?a=banner" brand/out/banner.png 1500 500`.
- Mentés: minden lépés után commit (a felhasználó kérte, fogy a credit).

## Betűtípus (2026-10-16)
- A felhasználó a Sniglet ExtraBold-ot választotta a 6 fontos mintából (`brand/fonts.html`). Címsor, gomb, címke: Sniglet 800, folyó szöveg: Sniglet 400.
- A hero cím valódi 3D (`site/title3d.js`): Sniglet TTF felfújt, lekerekített betűkkel, jégkék és arany anyaggal. A Fredoka, a Titan One és az SVG-filteres buborékbetű el lett utasítva.

## Showcase film (2026-10-16)
- `video/film.html` (determinisztikus `renderAt(t)`, three.js + DOM HUD), `python -I video/render.py` → `video/snowfight-showcase.mp4` és `-muted.mp4` (30 mp, 1080p, 60 fps, szintetizált zene). Állóképek: `--stills 1.6 10.5 …`.
- Jelenetek: hógolyók potyognak a jégre (Snowball brawl) → lobby, 48 játékos érkezik, joined toastok, online-számláló → te gyűjtöd a havat, értékkijelző, toplista → lelököd Mochit, csobbanás, kill feed, 1. hely → zsugorodó jég, sorban esnek le a többiek → hold to cash out gyűrű, konfetti, +$48.20 a walletben → zárókép a pfp-vel.
- Az arcok mindig a kamera felé néznek, a kamera kiszámítása a játékosok előtt történik (`cam.updateMatrixWorld()`), különben a címkék elcsúsznak.
