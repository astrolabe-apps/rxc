# Forms v2 — the ServiceTas MAST EOI trial on `alpha.7`, as a brief

The prompt for rerunning the MAST licence EOI trial against `0.1.0-alpha.7`. Paste everything
below the line into a fresh Claude Code session in a new ServiceTas worktree.

**Not a cold read.** The alpha.6 run
([`FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.6.md`](./FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.6.md))
met phase 10's exit: three MAST pages ran on Android from unchanged source. It ended with gaps
P1–P9, two small API gaps, and a list of device checks it could not settle. alpha.7 has no phase of
its own in [`FORMS-V2-PLAN.md`](./FORMS-V2-PLAN.md): it is that report's follow-ups, each recorded
under its gap as "Fixed since". This run starts from that run's branch and is judged on whether
the follow-ups fit: every alpha.6 workaround gone, and the native pages closer to the web's look
with the copied source still byte-identical.

Update the versions, the commits and the paths if they have moved. Check
`npm view @rx-controls/forms-react dist-tags` before starting: `alpha` should be `0.1.0-alpha.7`.

---

Rerun the ServiceTas **MAST licence EOI wizard** trial against `@rx-controls/forms-*@0.1.0-alpha.7`.
The previous run, against `0.1.0-alpha.6`, ran three MAST pages on the Android emulator from
their unchanged source, but routed around five things the library got wrong or lacked (P1, P2,
P5, P6, P7) and left several device checks open. alpha.7 fixes each. There are four goals, in this
order:

1. **Every alpha.6 workaround goes.** Each P-gap's workaround is removed and the alpha.7
   replacement used, on the web and in the native theme.
2. **The native pages, closer to the web.** The same three pages on the emulator, the copied
   source still byte-identical, now with the question cards, the switch labels and the button
   glyphs the alpha.6 run had to give up.
3. **The device checks alpha.6 could not settle.** A refused Continue focusing its field and
   raising the keyboard, with `disableType="global"` in place; TalkBack on the radio group's name
   and the heading levels; a bundled image given only a width.
4. **Visual parity, and what is still missing.** The web pages against the JSON version, with
   `Page`'s grid gone; new gaps numbered fresh.

The branch is throwaway: nothing needs to be production ready. **Don't push the ServiceTas branch
without asking.**

**Read the alpha.6 report first**:
`~/astrolabe/rxc/docs/FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.6.md`. It explains every item
below, its gap numbers (P1–P9) are the ones used here, and each gap now ends with what alpha.7
did about it.

## Where things are
- Repository `~/astrolabe/ServiceTas`. The trial branch is `trial/codefirst-mast-eoi-alpha6` at
  `c1db6634` (the native side moved into ServiceTas). Make a worktree from it on a new branch.
  The main checkout is on unrelated work; leave it alone.
- Paths below are relative to `ServiceTasAPI/NewClientApp/client-common`. The workspace is Rush:
  edit `package.json`, then `rush update`.
- The v2 wizard: `components/mast/eoi-v2/` (`EoiWizard.tsx`, `useEoiWizard.ts`, `eoiModel.ts`,
  `steps/*.tsx`), and the native trial screen `EoiTrialScreen.native.tsx` with its fake data layer.
- The look and the component layer, in `forms-v2/`:
  - `serviceTasTheme.tsx`, the html theme, and `serviceTasTheme.native.ts`, the native one, with
    the same 14 role names;
  - `components.tsx`, the components;
  - `platform.tsx` and `platform.native.tsx`, the seam: icons and image sources, with the native
    images in `forms-v2/assets/`.
- The JSON version, for comparison: `?path=mast-eoi`; the v2 one is at `?path=mast-eoi-v2`. Both
  take a dev-only `&step=N`.
- rxc, for the library source, the docs and the stories: `~/astrolabe/rxc`.
  - `packages/forms-native/README.md`: the React Native setup, and now "One form source for the
    web and native" (the seam, the roles, `shrink`) and the theme's `shellFor`.
  - `HtmlTheme`'s own description (`packages/forms-html/src/theme.tsx`, or `rush docs`): how a
    variant meets the base slot, which the alpha.6 run worked out by hand.
  - `apps/native-dev` is the React Native playground, where goals 2 and 3 run.

## First: versions and one engine copy
- Bump `@rx-controls/forms-react`, `forms-html` and `forms-antd` to `0.1.0-alpha.7`, pinned
  exactly as before.
- The stable packages haven't moved: `@react-typed-forms/core` `^5.1.5` and `@rx-controls/react`
  `^1.1.5` stay as they are.
- Confirm the lockfile holds exactly one `@rx-controls/core` and one `@rx-controls/react`.
- Keep `transpilePackages` as it is.
- Type-check the alpha.6 source against alpha.7 **before changing anything**, and record what
  breaks. One thing should: the native theme's group variants (below).

## The worklist

For each item: remove the workaround, use the alpha.7 replacement, and record how it went.

| alpha.6 workaround | alpha.7 replacement | gap |
|---|---|---|
| `Page` lays the image, pill, title, intro and stats out as the `Section`'s own children on a CSS grid (with `b82a5699`'s `1fr` fix), because the page title titled the nearest group | Nest the header groups again, as the JSON version does (Header → Header text → heading and text). A group that is only layout (no `title`, no `variant`, no scope) passes `heading="group"`'s claim to the group above. Drop the grid | P1 |
| Nothing: a refused check inside a `disableType="global"` action didn't focus | Nothing to write: the focus now waits for the lock to lift. Check it (below) | P2 |
| `platform.native.tsx` colours each glyph for the one kind of button it sits on | Plain string glyphs. A string icon is drawn in the button variant's text look; `action.iconTextClassName` (`no-underline` by default) keeps an underline off it | P5 |
| Nothing: no question cards on native, switch labels at the 24px field label | `shellFor` in the native theme, keyed as html's: `radio` for the question card, `checkbox` for the switch label | P6 |
| `shrink` on the native theme's action text, label row and label; `shrink min-w-0` on `TaskCard`'s column | The default native theme shrinks those three itself. A theme that replaces those slots still needs `shrink` in them, so check yours; `TaskCard`'s stays, as it's the author's own row | P7 |
| `eoiModel.ts` split out of the data layer | Nothing new; the forms-native README now says it. Confirm the pages still import only the model | P8 |
| Nothing: tapping a switch's label did nothing | Pressing a checkbox's label toggles it, box or switch, and not while locked. Check it on the device | P9 |
| The note icon's 24px as the theme's only `icon.className` | `IconDisplay variant="…"`, from `icon.variants` (html and native), or the `icon` entry of a variants provider (MUI, Ant, Fluent) | — |
| `order-last` on the disclosure's chevron | `disclosure.iconPlacement: "after"`, in the html and native themes | N11 |
| The native theme's group variants under `className` | **Breaking:** `wrapper`, as html's. Rename the five (`notice`, `taskCard`, `actionRequired`, `stats`, `footer`); `contents.className` and `inline.className` are `wrapper` too, and inline variants take the group variant's shape | — |

Points to decide and record as you go:
- **The header's groups.** With the grid gone, does the nested header draw the same as the grid
  did at both widths and on native? Does the outline hold: the h1, page titles at 2, groups at 3,
  task-card titles at 4, and the same under Ant?
- **The base slots, against the docs.** The html theme was shaped by hand in the alpha.6 run;
  `HtmlTheme` now documents that shape (body typography on `displayShell.display`, heading
  weight and size on `levels`, `!` on a heading variant). Does the theme match what the docs say?
  Anything they don't cover is a finding.
- **The seam.** With glyphs plain again, does `platform.native.tsx` hold only icons and image
  sources, typed `satisfies Record<keyof typeof webIcons, unknown>`?

## The pages on React Native

The same three pages as the alpha.6 run, in one `Wizard` (`navigation="none"`):
- the start page ("Before you start");
- page 2 ("Confirm your personal details");
- page 3 ("More details needed"), reached through "Link my account".

- **Copy, don't edit.** Copy the pages, `eoiModel.ts`, `forms-v2/` and
  `custom-display/HowToFindLicenceNumber.tsx` into `apps/native-dev/src/` keeping client-common's
  tree, and show `EoiTrialScreen` from a local "MAST" entry in the app.
  - Every copied file must stay **byte-identical** to its ServiceTas original. Record a checksum
    of each, and `diff` them at the end. Change a file in ServiceTas first and re-copy, as the
    alpha.6 run's script did.
  - The copies stay out of the rxc repo (a gitignored folder), and so does the "MAST" entry: they
    import ServiceTas's source, which isn't the public repo's to carry.
- **The native theme.** Rename the group variants, add `shellFor` for the question cards and the
  switch labels, drop the per-button glyph colours, and add whatever icon variant the html theme
  gained. Record which roles now carry over as the same classes, and what NativeWind still can't
  draw.
- **Run it on the Android emulator** (`Pixel_9`), as the alpha.6 run did:
  - `rushx dev` in `apps/native-dev`, never with `CI=1`;
  - `adb reverse tcp:8081 tcp:8081`;
  - open `exp://127.0.0.1:8081` in Expo Go.

  `apps/native-dev` takes the workspace packages, so rebuild rxc (`rush build`) before starting,
  and check Metro serves the new code before trusting what you see.
- **What to check on the device:**
  - The three pages draw, with no JS warnings in logcat.
  - The question cards behind each yes/no question, and the switches' labels in their own look.
  - The button glyphs in their buttons' colours, with no colour set in `platform.native.tsx`.
  - **A refused Continue on page 3 focuses the field and raises the keyboard**, with
    `disableType="global"` still on the action. This was the alpha.6 run's one "No".
  - Tapping a switch's label toggles it.
  - **The logo at `width={402}` alone keeps its proportions**: the bundled-asset case P3 fixed,
    which can only be checked on a device.
  - The accessibility tree (`uiautomator dump`) names each control and each help button, as in
    the alpha.6 run.
  - **TalkBack**, for what `uiautomator` doesn't show: whether the radio group is announced by its
    question, and whether the headings are announced as headings. Turn on TalkBack's developer
    setting "Display speech output" so what it says shows on screen, and screenshot it.

  Screenshots (`adb exec-out screencap -p`) go in the report.

## New behaviour to exercise on the web
- **Focus behind a disclosure, with the global lock.** Put a required field in the "How to find
  this" disclosure temporarily, on a page whose action has `disableType="global"`. A refused
  check must open the disclosure and focus the field. This was the race the alpha.6 run measured
  with a mutation observer: record the same, the field enabled when focus arrives.
- **The heading outline with the header nested.** Check it through the accessibility tree at
  both widths.
- **`IconDisplay variant` under Ant.** The Ant swap (`?path=mast-eoi-v2-antd`) should now warn
  once for the icon variant too, as it does for every other role the Ant theme doesn't name.

## Visual parity
As in the alpha.6 run: page by page at 1440×1000 and 375×812 against the JSON version, using
`&step=N`. To recheck:
- the start page with its header nested instead of on a grid: the title column's width, the stats
  on one row, the image flush right at 1440 and first at 375;
- page 2's intro width, which `b82a5699` fixed on the grid;
- the disclosure's chevron after its title, with no `order-last`.

Record the size of the theme (both), the provider, `components.tsx` and `platform.tsx` /
`platform.native.tsx` before and after.

## Environment
- `next dev` for the portal on `:3000`, served through the API on `https://localhost:5001`, signed
  in through B2C dev. **The user signs in**: ask them to, and do not enter credentials yourself.
- **Never press an action that calls MAST or creates a case.** Reach later pages with `&step=N`.
  On the device, the fake data layer answers instead.
- The known console noise is ServiceTas's own: "Cannot update `PageContent` while rendering
  `Reactive`", one "Cannot update … `RenderElements` / `PageHeader`", and `console.log(undefined)`.
  Anything else on the console is a finding, on the web and on the device.

## Verify
- `client-common` and `sites/portal` type-check with no errors, and the portal builds.
- rxc's `apps/native-dev` type-checks (`rushx build`) with the copies in place.
- Walk every page by hand in both web versions, and the three pages on the device.

## Report back
Write `~/astrolabe/rxc/docs/FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.7.md`, in the style of the
alpha.6 report, citing rxc source lines at the `@rx-controls/forms-react_v0.1.0-alpha.7` tag:
1. **The verdict**, first: did every alpha.6 workaround go, and do the copied pages still run
   unchanged on native with only `platform.native.tsx` beside them?
2. **The pages on React Native**:
   - the files copied, their checksums and the `diff`;
   - what `platform.native.tsx` holds now;
   - the native theme against the alpha.6 one: the rename, `shellFor`, what carried over;
   - the device screenshots, the accessibility tree and what TalkBack said;
   - the device checks as a table, each settled or not.
3. **The worklist**, as a table: each P-gap and the two API items closed, changed or still open,
   and why. Then the sizes before and after.
4. **The theme against the docs**: where the documented shape matched the theme, and where it
   didn't.
5. **New gaps** this run found, numbered fresh (Q1 onwards), each with what you did instead and
   what the library should offer.
6. **Visual parity**, both widths, with the items above rechecked.
7. **Against alpha.6**: each of its suggestions fixed, changed or still open, and anything it got
   wrong.
