# Nordwind – számlafeldolgozó és cash-flow kimutatás

Dockerben futó webalkalmazás: PDF számlák feltöltése, mezőkinyerés, MNB árfolyam, forintos kimutatás.

## Indítás

```bash
cp .env.example .env
# opcionális: OPENROUTER_API_KEY kitöltése (Phase 3+)

docker compose up --build
```

Alkalmazás: **http://localhost:8080**

## Architektúra (Phase 1)

| Réteg | Tech |
|---|---|
| API | Node.js, Express |
| DB | SQLite (`better-sqlite3`), volume: `/data` |
| UI | Vite, React, Tailwind |
| Futtatás | egy konténer: API + built SPA |

```
backend/     Express + SQLite
frontend/    Vite React SPA
Dockerfile   multi-stage build
```

## Fejlesztés (lokális)

```bash
cp .env.example .env   # ha még nincs
npm install
npm run dev
```

- UI: **http://localhost:5173** (Vite, `/api` → backend `:8080`)
- API: **http://localhost:8080**

Együtt fut a backend (`node --watch`) és a frontend (Vite) a gyökér `concurrently` scriptjével.

## Állapot

- [x] Phase 1 – skeleton
- [x] Phase 2 – bulk PDF upload
- [ ] Phase 3 – extraction
- [ ] Phase 4 – MNB FX
- [ ] Phase 5 – report UI

Részletes terv: `PLANNING.md`. AI napló: `AI_NAPLO.md`.
