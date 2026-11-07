# openmap.lt redaktorius (Maputnik fork)

Tai [Maputnik](https://github.com/maplibre/maputnik) v3.1.0 šakutė, kuria
openmap.lt naudotojai redaguoja savo žemėlapių profilių stilių. Ji laikoma
`editor.openmap.lt` adresu, atskirame Docker konteineryje.

## Kuo skiriasi nuo upstream

Visi pakeitimai nedideli, kad būtų lengva sinchronizuotis su upstream:

- `src/libs/openmap.ts` – visa integracija: sesija iš URL, stiliaus
  užkrovimas ir išsaugojimas per openmap.lt API, klaidų tekstai (testai:
  `src/libs/openmap.test.ts`).
- `style-store-factory.ts`, `App.tsx`, `AppToolbar.tsx`, `OpenmapNotice.tsx`,
  `_toolbar.scss` – įjungia tai redaktoriuje: „← openmap.lt“ nuoroda,
  „Išsaugoti“ mygtukas (arba Ctrl/Cmd+S), neišsaugotų pakeitimų indikatorius ir
  įspėjimas paliekant puslapį.
- `ModalSources.tsx`, `src/config/tilesets.json` – „Data Sources“ siūlo tik
  openmap.lt duomenų rinkinius; laisvos formos „Add New Source“ išjungta
  (grąžinama su `VITE_ALLOW_CUSTOM_SOURCES=true`).
- `vite.config.ts` – `MAPUTNIK_INSTRUMENT=false` išjungia padengimo
  instrumentaciją gamybiniame bundle.

## Kaip veikia prisijungimas

openmap.lt atidaro redaktorių adresu

    https://editor.openmap.lt/?style=<profilio stiliaus URL>&token=<raktas>&return=<profilio puslapis>

- `style` turi būti `https://openmap.lt/...` (arba `*.openmap.lt`); kitu atveju
  tai paprastas Maputnik URL ir raktas niekur nesiunčiamas.
- `token` – trumpalaikis (≤ 2 val.), vienam profiliui skirtas raktas; siunčiamas
  tik kaip `Authorization: Bearer` į openmap.lt.
- Po užkrovimo `style`, `token`, `return` pašalinami iš adreso juostos;
  sesija laikoma `sessionStorage` (perkrovus kortelę veikia, kol raktas galioja).
- Redaktorius niekada nesaugo automatiškai: įrašoma tik paspaudus „Išsaugoti“.
  Serveris patikrina stilių (≤ 1 MB, version 8, tik openmap.lt adresai).
- Jei stiliaus nepavyksta užkrauti, „Išsaugoti“ išjungtas, kad tuščias stilius
  neperrašytų profilio.

## Paleidimas (Docker)

Vaizdą `ghcr.io/openmaplt/maputnik` surenka `.github/workflows/openmap-image.yml`
(kiekvienas push į `main`). Serveryje:

    docker login ghcr.io        # vieną kartą; tokenas su read:packages
    docker compose -f openmap/docker-compose.yml pull
    docker compose -f openmap/docker-compose.yml up -d

Prievadas `127.0.0.1:3001` (keičiamas `EDITOR_PORT`). Serverio nginx
nukreipia domeną į jį:

    server {
        listen 443 ssl;
        server_name editor.openmap.lt;
        # ssl_certificate ...;

        location / {
            proxy_pass http://127.0.0.1:3001;
            proxy_set_header Host $host;
        }
    }

Reikia DNS įrašo `editor.openmap.lt` ir TLS sertifikato. openmap.lt pusėje
nustatomi `PROFILE_EDIT_SECRET` ir (jei adresas kitoks)
`PROFILE_EDITOR_ORIGIN=https://editor.openmap.lt`.

Lokaliai vaizdą galima surinkti: `docker build -f openmap/Dockerfile -t openmap-editor .`
(šaknyje esantis `Dockerfile` – upstream Go „desktop“ versijai, jo nereikia).

## Sinchronizavimas su upstream

    git remote add upstream https://github.com/maplibre/maputnik
    git fetch upstream --tags
    git merge upstream/main     # arba konkretus žymimas leidimas

Konfliktai tikėtini tik aukščiau išvardytuose failuose.
