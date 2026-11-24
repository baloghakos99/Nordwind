# Planning – Nordwind invoice cash-flow

Stack döntés (rögzítve): **Node.js** backend + **SQLite** + **Vite + React + Tailwind** frontend, egy Docker Compose paranccsal.

Fázisok sorrendben; minden fázis után legyen működő, commitolható állapot.

---

## Phase 1 – Architecture & skeleton

**Cél:** üres, de induló app: `docker compose up --build` → UI elérhető.

### Deliverables
- Monorepo vagy `backend/` + `frontend/` elrendezés
- Node.js API (Express/Fastify) + SQLite (pl. better-sqlite3 / drizzle)
- Vite + React + Tailwind SPA (proxy az API-ra devben)
- `Dockerfile`(ok) + `docker-compose.yml` (egy szolgáltatás vagy api+web)
- `.env.example` (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, portok)
- `.gitignore` (`.env`, `node_modules`, DB fájlok, build)
- README váz: indítási URL
- Üres DB séma váz (invoices, exchange_rates, upload_errors – később pontosítva)

### Acceptance
- [x] Lokális függőség nélkül indul Dockerből
- [x] Böngészőben megjelenik a placeholder UI

**Állapot:** kész (2026-11-24) — `http://localhost:8080`

---

## Phase 2 – Bulk PDF upload

**Cél:** egyszerre sok PDF feltölthető; perzisztencia; hibás fájl nem állítja le a többit.

### Deliverables
- Multi-file upload UI (drag & drop + file picker, 100 fájl OK)
- `POST /api/invoices/upload` (multipart)
- PDF-ek tárolása (volume / `uploads/`)
- Feldolgozási státusz listában (pending / processing / done / error)
- Duplikátum-azonosítás előkészítve (hash és/vagy kiállító+számlaszám – teljes logika Phase 3 után)
- Frissítés után is megmarad az állapot (SQLite)

### Acceptance
- [x] 100 PDF egy feltöltéssel elfogadva
- [x] Egy hibás fájl → hibaüzenet az adott sornál, a többi megy tovább

**Állapot:** kész (2026-11-24) — PDF → `data/uploads/{hash}.pdf`, hash-duplikátum skip, lista SQLite-ból

---

## Phase 3 – Extraction

**Cél:** minden számlából a kötelező mezők kinyerése; irány + partner; ismeretlen sablonokra is általános.

### Kötelező mezők
Számlaszám; kiállító/vevő név+adószám; kiállítás dátuma; **teljesítés**; **fizetési határidő**; pénznem; **bruttó** végösszeg; irány (`bejövő`/`kimenő`); partner.

### Deliverables
- PDF szövegkinyerés (szöveges PDF, OCR nem kell; többoldalas támogatás)
- Extrakciós pipeline: szabályalapú első kör és/vagy LLM (OpenRouter) tartalékként / elsődlegesen – döntés implementációkor, README-ben indoklás
- Irány: Nordwind Solutions Kft. / `26481937-2-43` / `HU26481937` alapján
- Partner = a másik fél; cégegységesítés adószám szerint
- Séma-validáció + hibajelzés fájlonként
- Duplikátum: kiállító + számlaszám → ne duplázza az adatot
- Tesztek: mezőkinyerés mintákon

### Acceptance
- [x] Ismert mezők struktúráltan a DB-ben
- [x] Fájlnévre nem támaszkodik; új sablonokra sem bedrótozott

**Állapot:** kész (2026-11-24) — szabályalapú extrakció (nincs LLM); HU/DE/EN mintákon `done`; unit tesztek

---

## Phase 4 – MNB currency module

**Cél:** nem-HUF összegek forintra a teljesítés napi (vagy utolsó megelőző) MNB árfolyamon.

### Deliverables
- SOAP kliens: `GetExchangeRates` → **http** `http://www.mnb.hu/arfolyamok.asmx`
- Belső XML parse (vesszős tizedes, `unit`)
- Cache tábla: `(date, currency) → rate` – ne kérdezzünk le újra
- Lookup: teljesítés dátuma → ha nincs jegyzés, utolsó megelőző
- HUF: rate = 1, nincs hívás
- Kerekítés: számlánként egész HUF (0,5↑)
- Unit tesztek: hétvége/ünnep fallback, unit≠1, kerekítés

### Acceptance
- [x] Ismételt futás nem spameli az MNB-t
- [x] Számlánként tárolt: felhasznált árfolyam + árfolyam dátuma + HUF összeg

**Állapot:** kész (2026-11-24) — SOAP http + cache + on-or-before + half-up; UI mutatja a HUF-ot

---

## Phase 5 – Aggregation & report UI

**Cél:** egy oldal, FELADAT sorrendben; minden összeg bruttó HUF.

### Deliverables
1. **Vonaldiagram** – X: due date havi (`ÉÉÉÉ-HH`), folytonos tartomány (üres hónap = 0); Y: HUF; két vonal: bejövő / kimenő; jelmagyarázat, olvasható számok
2. **Partner táblázat** – oszlopok = partnerek (adószám); sorok: Össz bejövő / Össz kimenő; hiányzó irány = `0`
3. **Számlalista** – kinyert mezők + eredeti összeg/pénznem + MNB rate/dátum + HUF

### Acceptance
- Aggregáció unit tesztek
- UI frissítés után is a mentett adatokból épül
- Docker demó: 100 számla → diagram + tábla + lista

---

## Out of scope / később (README)

- OCR szkennelt PDF-ekhez
- Auth / multi-user
- Referenciaértékekkel való teljes egyezés finomhangolása a demó előtt

## Suggested commit rhythm

Phase 1 skeleton → Phase 2 upload → Phase 3 extraction MVP → Phase 4 MNB → Phase 5 chart/table → tesztek + README + napló frissítés.
