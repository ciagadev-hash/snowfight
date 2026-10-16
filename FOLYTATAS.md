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

## Giga update (2026-10-16 délután): SnowPump
- **Név: SnowPump** (a felhasználó kérte). A ticker később $SNOWPVP lett (lásd lent).
- A felhasználó visszajelzése: a régi színek, a betűtípus, a felirat és a sárga gagyi volt, a showcase nem nézett ki játékreklámnak, a játék laggolt, a golyók átcsúsztak egymáson, és nem volt rendes kiesés-animáció. A karakter maga jó, csak legyen minőségibb. Bubisabb betűk, tisztább színek.
- **Betűtípus:** DynaPuff (a 11 bubis betűből az 1-est választotta), Nunito a kis szövegekhez. **Színek:** a "B, finom fény" paletta: ink #152b6b, fehér, zöld a pénznek és a Play gombnak, pink a knockoutnak és a "you"-nak, kék. Sárga szöveg nincs.
- **Motor nulláról:** `site/sim.js` (fix 120 Hz-es lépés, teljes átfedés-feloldás, dash-lökés knockbackkel, okosabb botok, spawn-pajzs, zsugorodó jég, kiesés és kredit), `site/world.js` (shaderes tenger habbal és fodrozódással, repedő jég, instancolt karakterek arckifejezésekkel, pislogással, nyúlással, ugrással, blob-árnyékok, részecskék, kb. 25 draw call), `site/game.js` (sima kamera, interpoláció, hit-stop, adaptív felbontás, minimap), `site/sfx.js` (szintetizált hangok). Az oldal és a HUD is új (DynaPuff, játékos gombok, ranglista, minimap, shove cooldown, cash out tartás, kill feed, knockout feliratok).
- **Showcase:** `video/film.html` + `video/shots.js`: 30 mp, 128 BPM-re vágva, 10 jelenet, mindegyik valódi szimuláció (nyitás lassított lökéssel és csobbanással, logó, hógyűjtés, BONK, STRIKE, BYE BYE, repedő jég, "Every ball has a price", cash out hajszálnyi megúszással, zárókép a csapattal és PLAY FREE gombbal). Átmenetek: whip pan, hó-írisz, csíkok, ink-írisz, villanások. `?ar=916` függőleges változat. Zene és hangeffekt: `video/soundtrack.py`, az effektek a film valódi eseményeire szólnak.
- **Renderelés:** a felhasználó a gépén lévő Claude-dal rendereli (`python -I video/render.py --gpu`, `--vertical`). Lásd README.
- Kód a `giga-update` ágon.

## Következik
- Brand képek újra (pfp, OG, banner) az új kinézettel és a SnowPump névvel.
- Multiplayer szerver, kifizetések, CA (lásd fent).

## Több oldalas weboldal (2026-10-16 este)
- A felhasználó kérte, hogy ne egy lapos legyen: új lapok hash-routinggal: `#/leaderboard` (Top earners, Biggest cash outs, Most knockouts, dobogó, és a saját "warm-up" futások a gépen), `#/how` (irányítás, mechanikák, GYIK), `#/snow` (CA, Buy on pump.fun, Chart, a pot működése), `#/community` (X és Discord; Telegram nem kell, a felhasználó kérte). Mobilon hamburger menü.
- A leaderboard nem kap kitalált nyerteseket: a `/api/leaderboard`-ról olvas (KV `leaderboard`), üresen "Season 1 starts at launch" állapot látszik.
- A linkek és a CA a `site/config.json`-ban vannak, a build beleégeti.
- A logó és a $SNOW lap az új SVG hógolyó-avatart használja a régi pfp helyett.

## Domain, X, ticker, film-javítás (2026-10-16 este)
- **Domain:** snowballpvp.fun (og:url, abszolút og:image és twitter:image, canonical; a film zárókártyáján is ott van). **X:** https://x.com/SnowPumpPvP (`site/config.json` → Community lap, kezdőlap, footer, a megosztás gomb `via=SnowPumpPvP`, `twitter:site`). **Ticker: $SNOWPVP** (oldal, film, szövegek). A CA-t a felhasználó küldi.
- **Akadozás a filmben** (a felhasználó szerint az első lelökésnél laggy volt): a `S.alpha` mindig 1 volt, így a golyók csak egész szimulációs lépésekben mozdultak, lassításban rángatva. Javítva (a renderelés egy lépéssel lemarad és interpolál, ez a játékban is simább mozgást ad). A kemény kimerevítések helyett sima sebesség-rámpák (`ramp()` a `video/shots.js`-ben), és a zuhanás, a spawn és a kamera is interpolált időt használ.
- **Textúrahiba:** a göröngyös hó-test gurulás közben átbökött a szemen, a szájon, a pirosságon és a sapkán (darabos, villódzó arcok). A `faceSafe` shader a test anyagán az arc és a sapka alatt sima gömbre simítja a havat (példányonkénti `aFace`/`aUp` irány).
- **Címkék:** a takart golyók címkéi elhalványulnak (`W.discs` + `W.cover`), nem úsznak rá az előttük lévő golyó arcára; leesésnél és a hatótáv szélén is elhalványulnak; a grow jelenetben a saját címke nem ütközik a HUD-dal.
