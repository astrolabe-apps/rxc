# Forms v2 — the talk

A 30-minute internal presentation: forms as React first, JSON loaded onto the
same surface. Built 2026-09-24 for an audience of developers who have used the
form editor to build ServiceTas forms.

| | |
|---|---|
| `build_deck.py` | the source of truth — every slide's HTML and speaker notes, as Python data |
| `deck.css` / `deck.js` | styling, and the keyboard / notes / overview logic; inlined at build time |
| `build_runsheet.py` | the presenter's run sheet: pre-flight, timings, demo clicks, fallbacks, expected questions, and the notes compiled from `build_deck.py` |
| `forms-v2-deck.html` | built output — open in a browser; `←`/`→` to move, `N` notes, `O` overview, `F` fullscreen, `#/12` in the URL jumps to a slide |
| `forms-v2-runsheet.html` | built output — the presenter copy, printable |

```bash
python3 build_deck.py && python3 build_runsheet.py
```

The built pages are written for the Artifact host, which supplies the
`<html>`/`<head>`/`<body>` skeleton; to open one locally, wrap it, e.g.

```bash
{ printf '<!doctype html><html><head><meta charset="utf-8"></head><body>'; cat forms-v2-deck.html; printf '</body></html>'; } > /tmp/deck.html
```

**The numbers move.** Slides 3, 4, 18 and 21 and the run sheet quote the
corpus, the burndown and the parity run. Re-check them against the POC
README's burndown line and `rushx parity` before presenting. The demos run
against the POC's *Legacy form* tab (`src/loader/CorpusDemo.tsx`) and need an
extracted corpus.
