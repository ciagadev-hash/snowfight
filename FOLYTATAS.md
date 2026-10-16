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

## Fájlok
- `brand/banner.html` (three.js, ?a=banner|og|pfp), render: `python -I tools/shot.py "brand/banner.html?a=banner" brand/out/banner.png 1500 500`.
- Mentés: minden lépés után commit (a felhasználó kérte, fogy a credit).
