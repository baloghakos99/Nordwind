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

### Érintett fájlok
- `backend/` – Express, `db.js`, `schema.sql`
- `frontend/` – Vite React Tailwind App
- `Dockerfile`, `docker-compose.yml`, `.env.example`, `.gitignore`
- `README.md` – indítás + architektúra váz
- `PLANNING.md` – Phase 1 acceptance pipálva

