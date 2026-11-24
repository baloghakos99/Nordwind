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
- **Elfogadva:** rule fájlnevek angolul; az `AI_NAPLO.md` a FELADAT 7. pontja szerinti kötelező leadandó név marad.

### Szabályfájlok (ebben a lépésben)
| Fájl | Cél |
|---|---|
| `.cursor/rules/ai-journal.mdc` | Jelölt promptok appendelése az `AI_NAPLO.md`-be |
| `.cursor/rules/project-context.mdc` | FELADAT lényeg: cégadatok, követelmények, korlátok |
| `.cursor/rules/secrets-and-env.mdc` | API kulcs ne kerüljön a repóba |
| `.cursor/rules/git-workflow.mdc` | Kis, beszédes commitok; ne commitoljon kérés nélkül |

### Következő
Architektúra / tech stack döntés, majd scaffolding (Docker + webapp váz).
