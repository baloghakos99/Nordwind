# AI fejlesztési napló – Nordwind számlafeldolgozó

Időrendben dokumentáljuk a feladat lebontását, a meghatározó promptokat, az AI javaslatainak elfogadását/elvetését, a hibákat és javításokat, valamint a használt szabályfájlokat.

**Jelölés a naplóba:** ha egy agent prompt tartalmazza a `@napló` vagy `@naplo` jelölőt, az agent appendeli a bejegyzést ide (lásd `.cursor/rules/ai-journal.mdc`).

---

## 2026-11-24 – Indítás: feladat átolvasása, napló és rule-ok

### Lépés
Feladat (`FELADAT.md`) átolvasása; `AI_NAPLO.md` létrehozása; Cursor rule-ok felállítása a fejlesztéshez.

### Miért
A 7. pont kötelezően kéri az AI-asszisztált fejlesztés dokumentálását. A rule-ok állandó kontextust adnak (cégadatok, MNB, Docker, titkok), így kevesebb ismétlés kell a promptokban, és a naplójelölővel a meghatározó utasítások automatikusan bekerülnek.

### AI javaslat / döntés
- **Elfogadva:** mindig érvényes rule-ok a projektre (kontextus, napló, titkok, git), plusz később fájlspecifikus rule-ok a kódra.
- **Elfogadva:** `@napló` / `@naplo` jelölő a naplóba íráshoz – csak jelölt promptok kerülnek be, nem minden üzenet.
- **Elfogadva:** rule fájlnevek angolul; az `AI_NAPLO.md` a FELADAT szerinti kötelező név.


## 2026-11-24 06:30 – PLANNING.md: feladat részegységekre bontása

### Prompt
> Hozz létre egy `PLANNING.md` file-t; bontsd részegységekre a feladatot: (1) architektúra/skeleton Node.js + SQLite + Vite React + Tailwind, (2) tömeges PDF feltöltés, (3) extrakció, (4) MNB currency modul, (5) aggregáció/kimutatás.

### Agent válasz / döntés
- **Elfogadva** a felhasználó stackje: Node.js + SQLite + Vite/React/Tailwind.
- `PLANNING.md` öt fázissal, deliverables + acceptance kritériumokkal, commit ritmussal.
- LLM vs szabályalapú extrakció: Phase 3-ban döntendő, nem előre rögzítve.

---

## 2026-11-24 06:34 – Phase 1 skeleton (PLANNING 9–25)

### Prompt
> Készítsd el a Phase 1 vázat (architektúra, skeleton: Node.js + SQLite + Vite React + Tailwind); naplózd.

### Agent válasz / döntés
- **Elfogadva:** egy konténeres deploy – Express szolgálja az API-t és a built SPA-t (`:8080`).
- **Elfogadva:** `better-sqlite3` + volume `/data`; séma váz: `invoices`, `exchange_rates`, `upload_errors`.
- **Elfogadva:** Tailwind v4 (`@tailwindcss/vite`); placeholder UI health checkkel.
- Docker `compose up --build` sikeres; `/api/health` → `ok`, UI HTTP 200.
- Direction a DB-ben angolul (`incoming`/`outgoing`) – UI később magyar címkékkel.



## 2026-11-24 06:46 – Phase 2: tömeges PDF feltöltés (PLANNING 31–45)

### Prompt
> Csináld meg a PDF feltöltést (Phase 2)

### Agent válasz / döntés
- **Elfogadva:** PDF → `data/uploads/{sha256}.pdf`; DB sor `pending` státusszal.
- **Elfogadva:** hash-alapú duplikátum skip (kiállító+számlaszám Phase 3 után).
- **Elfogadva:** hibás / nem-PDF fájl csak az adott eredményben fail; a többi megy tovább (multer fileFilter helyett per-fájl validáció + `%PDF-` magic).
- API: `POST /api/invoices/upload`, `GET /api/invoices`.
- UI: drag & drop + file picker, státuszlista.
- Smoke test: 2 új + 1 hibás + 1 duplikátum → várt summary.

---

## 2026-11-24 07:04 – Phase 3: szabályalapú adatkinyerés

### Prompt
> Készítsd el a 3. pontot (adatkinyerés), add a naplóhoz. 3 különböző számla feltöltve a UI-n. LLM nélkül, szabályokkal.

### Agent válasz / döntés
- **Elfogadva:** elsődleges szabályalapú pipeline, LLM nincs (FELADAT előny).
- PDF szöveg: `pdf-parse` (PDFParse), többoldalas szöveg összefűzve.
- Címke-szótárak + `parseDate` / `parseAmount` + Nordwind irány (adószám/név).
- Validáció kötelező mezőkre; fail → `error` státusz üzenettel.
- Üzleti duplikátum: `issuer_tax_id` + `invoice_number` → megtartjuk az elsőt.
- Feltöltés után / induláskor `scheduleProcessPending`.

---

## 2026-11-24 07:26 – LLM tartalékág (OpenRouter) + UI jelölés

### Prompt
> Csináld meg az LLM ágat; a listán írjuk ki, szabályok vagy LLM nyerte-e ki az adatot. Modell: olcsó flash/mini, csak fail esetén.

### Agent válasz / döntés
- **Elfogadva:** rules → validate; fail esetén OpenRouter (`google/gemini-2.5-flash` default).
- `extraction_method`: `rules` | `llm`; UI: „szabályok alapján” / „LLM tartalék…”.
- Tokenkímélés: nincs kulcs → error rules üzenettel; `done` + method → skip; szöveg truncate ~12k.
- Kulcs csak `.env` / env var — nem a repóba.

---

## 2026-11-24 07:45 – Phase 4: MNB FX modul

### Prompt
> Implementáld a Phase 4 tervet (MNB SOAP, cache, on-or-before, half-up, UI, tesztek).

### Agent válasz / döntés
- SOAP `GetExchangeRates` **http**; nested XML parse (vessző, `unit`).
- Cache `exchange_rates`; miss → 14 napos ablak fetch; lookup on-or-before teljesítés.
- HUF: rate 1, nincs hívás; `amount_huf = floor(x+0.5)`.
- Extrakció `done` után FX; hiányzó HUF backfill a process queue-ban.
- FX hiba → `error` (ne menjen aggregációba üres HUF-fal).
- Unit tesztek mockkal (19 pass összesen).

---

## 2026-11-24 09:00 – Phase 5: aggregáció és kimutatás UI

### Prompt
> Csináld meg a kimutatásokat és aggregációt (PLANNING Phase 5).

### Agent válasz / döntés
- `buildMonthlySeries` / `buildPartnerMatrix` / `buildReport` — csak `done` + `amount_huf`.
- Havi X = due date `YYYY-MM`, üres hónap = 0; partner oszlopok adószám szerint.
- `GET /api/report`; UI: SVG vonaldiagram → partner tábla → részletes számlalista.
- Aggregáció unit tesztek zöldek; frontend/backend typecheck OK.


---


