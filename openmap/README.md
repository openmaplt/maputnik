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
- `ModalSources.tsx`, `src/config/openmap-tilesets.json` – „Data Sources“ sąrašo
  viršuje rodo openmap.lt duomenų rinkinius, o po jų – nepakeistą upstream sąrašą
  (build kintamasis `VITE_OPENMAP_SOURCES=true`, nustatomas `openmap/Dockerfile`; be
  jo redaktorius veikia kaip upstream). Laisvos formos „Add New Source“ taip pat
  lieka: openmap.lt priima bet kurį `https` šaltinį, o jei serveris neleidžia CORS,
  sluoksnis tiesiog neužsikraus.
- `AppToolbar.tsx`, `ModalExport.tsx` – openmap režime upstream „Save“ (kuris tik
  atsisiunčia failą) vadinasi „Atsisiųsti“, o „Open“ – „Įkelti“.
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
  Serveris patikrina stilių (≤ 1 MB, version 8, visi adresai tik `https`).
- Jei stiliaus nepavyksta užkrauti, „Išsaugoti“ išjungtas, kad tuščias stilius
  neperrašytų profilio.

## Paleidimas (Docker) ir automatinis diegimas

Kiekvienas push į `main` paleidžia `.github/workflows/openmap-image.yml`: jis
surenka vaizdą `ghcr.io/openmaplt/maputnik`, per SSH nukopijuoja
`openmap/docker-compose.yml` į serverį (`/opt/openmap-editor`), padaro
`docker compose pull` ir `up -d`. Jungtis į serverį nereikia.

Šio fork'o GitHub Secrets (tokie patys kaip openmap.lt repo): `SSH_HOST`,
`SSH_USERNAME`, `SSH_PRIVATE_KEY`, `GHCR_PAT`; neprivalomi: `SSH_PORT`,
`GHCR_USER` (numatytasis `paumas`), `EDITOR_DEPLOY_PATH`.
SSH vartotojas serveryje turi galėti naudoti docker.

Ranka: `docker compose -f openmap/docker-compose.yml pull && docker compose -f openmap/docker-compose.yml up -d`.

nginx konfigūracija konteinerio viduje (`openmap/nginx.conf`) yra reikalinga: tai
statinio puslapio serveris, panašiai kaip Next.js serveris openmap.lt konteineryje.
Serverio nginx daro tik TLS ir `proxy_pass`.

Prievadas `127.0.0.1:3002` (keičiamas `openmap/docker-compose.yml`). Serverio nginx
nukreipia domeną į jį:

    server {
        listen 443 ssl;
        server_name editor.openmap.lt;
        # ssl_certificate ...;

        location / {
            proxy_pass http://127.0.0.1:3002;
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
