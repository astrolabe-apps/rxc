# Forms v2 — `alpha.6`, a session brief

The prompt for starting the `alpha.6` work in a fresh session. Paste everything below the line
into a new Claude Code session in `~/astrolabe/rxc`.

---

Plan and build Forms v2 `alpha.6`: phase 10 of `docs/FORMS-V2-PLAN.md`. Its thread is form source
that names what it means and leaves the look to the theme, so the same source draws under html,
MUI, Ant, Fluent and React Native.

## Read first
- `docs/FORMS-V2-PLAN.md`, phases 8–10. Phase 10 is the work. Phase 9 is `forms-native`, which
  is new since `alpha.5` and is the fifth implementation every item now lands in.
- `docs/FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.5.md`, gaps N1–N11: the evidence behind phase
  10. Its "For `forms-native`" section is what a real form needs.
- `CLAUDE.md`, for the packages, commands, conventions and test counts.

## Where things stand
- `alpha.5` is published (seven packages on `alpha`; `forms-fluent`'s first release).
- `@rx-controls/forms-native` is built but private and outside the alpha policy: every slot
  drawn, the shared suite 40 / 40 under three declared `limits`, checked on an Android emulator
  through `apps/native-dev` (Expo 57, React Native 0.86, the repo's React 19.2).
- The shared conformance suite now finds choice widgets by role as well as input type, and lets
  an implementation declare platform `limits`. Keep both when adding cases.

## Start by deciding, not building
Phase 10 marks four choices *To decide*, each with a recommendation:
1. How MUI, Ant and Fluent resolve a `variant`.
2. Rich text as an inline component or as segments.
3. How an image source names an asset across platforms.
4. A group's own heading: `GroupProps.header` or `heading="group"`.

Put them to me together (AskUserQuestion), with the recommendation first, before writing
code. Then propose an order of batches. Mine would be: checks and focus (small, behaviour);
named looks; rich text; the image display; the group heading; `labelEnd` finished;
`forms-native` published.

## How this repo works (learned the hard way)
- **Commit straight to `main`**; push when a batch lands. End commit messages with the
  attribution line the session gives you.
- **Run `rush build`, `rush test`, `rush lint` and check each one's exit status**, not just the
  test counts. Anything on stderr (an `act()` warning, a console log) makes `rush test` exit 1
  even when every test passes.
- **Update CLAUDE.md's test counts in the same commit as the tests.**
- **Run `rushx gates` in `tools/forms-corpus` before anything touching the loader lands.** If the
  burndown drops, lower the ratchet with `--update`.
- **`rush update`, never `rush update --full`** unless asked: `--full` re-resolves the whole
  lockfile.
- **Every contract item goes into all five implementations.** Native's two halves of
  accessibility (string name and hint for native; `aria-*` by id for the web) apply to anything
  new it draws.
- **Never publish, and never push to another repository, without asking me.**

## Running `forms-native` on a device
- `apps/native-dev`: `rushx dev` (Metro). Never set `CI=1`: it disables file watching and serves
  stale code.
- The Android emulator `Pixel_9`: `~/Android/Sdk/emulator/emulator -avd Pixel_9`. Open the
  app with `adb reverse tcp:8081 tcp:8081`, then `adb shell am start -a
  android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent`.
- Inspect with `adb exec-out screencap -p`, and `adb shell uiautomator dump` for the
  accessibility tree. `uiautomator` doesn't show hints or which views TalkBack skips; those need
  TalkBack.
- After rebuilding `forms-native` (`tsc`), check Metro serves the new code before you trust a
  device result: `curl` the bundle and grep it.
- When stopping processes with `pgrep -f` / `kill`, use a pattern that can't match your own
  shell's command line (e.g. `expo/bin/cl[i]`).

## Exit
Phase 10's: `alpha.6` published with `forms-native`; the MAST trial re-run with its `looks` in
theme variants and its seam down to icons and image sources; one MAST page's unchanged source
rendering under `forms-native` in `apps/native-dev`. Write a brief for that MAST re-run as part
of finishing, as `docs/FORMS-V2-SERVICETAS-MAST-EOI-TRIAL-BRIEF.md` was for `alpha.5`.
