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
