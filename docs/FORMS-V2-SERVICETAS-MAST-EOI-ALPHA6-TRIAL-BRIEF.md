# Forms v2 — the ServiceTas MAST EOI trial on `alpha.6`, as a brief

The prompt for rerunning the MAST licence EOI trial against `0.1.0-alpha.6`. Paste everything
below the line into a fresh Claude Code session in a new ServiceTas worktree.

**Not a cold read.** The alpha.5 run
([`FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.5.md`](./FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.5.md))
removed every alpha.4 workaround, and ended with gaps N1–N11 and a `looks` object and a seam
module that the contract had no words for. alpha.6 (phase 10 of
[`FORMS-V2-PLAN.md`](./FORMS-V2-PLAN.md)) was built against those. This run starts from that run's
branch and is judged on phase 10's exit:

- the `looks` moved into theme variants;
- the seam down to icons and image sources;
- one MAST page's **unchanged** source rendering under `@rx-controls/forms-native`, with only a
  `platform.native.tsx` beside it.

Update the versions, the commits and the paths if they have moved. Check
`npm view @rx-controls/forms-react dist-tags` before starting: `alpha` should be `0.1.0-alpha.6`.

---

Rerun the ServiceTas **MAST licence EOI wizard** trial against `@rx-controls/forms-*@0.1.0-alpha.6`.
The previous run, against `0.1.0-alpha.5`, left the form source free of DOM but carrying two
things the contract had no words for: a `looks` object of visual classes (gaps N1, N2, N10) and a
seam module for icons, images and emphasis (N8, N9). alpha.6 was built to take both away, and is
the first release with a React Native implementation. There are four goals, in this order:

1. **The form source names roles, never looks.** `looks` goes: every text style, card, pill and
   link look becomes a `variant` the form names and the theme resolves.
2. **The seam shrinks to icons and image sources.** `Strong` becomes `<RichText>`, `Picture`
   becomes `<ImageDisplay>`. What is left in `platform.tsx` is only what genuinely differs by
   platform.
3. **One page on React Native, unchanged.** One MAST page's source — the page, `components.tsx`
   and the theme's roles — renders under `forms-native` in rxc's `apps/native-dev`, with only a
   `platform.native.tsx` beside it. This is the point of the run.
4. **The worklist, and what is still missing.** Each alpha.5 gap closed with the alpha.6 API, and
   recorded as fitting, fitting awkwardly or not fitting; visual parity with the JSON version held.

The branch is throwaway: nothing needs to be production ready. **Don't push the ServiceTas branch
without asking.**

**Read the alpha.5 report first**:
`~/astrolabe/rxc/docs/FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.5.md`. It explains every item
below, and its gap numbers (N1–N11) are the ones used here.

## Where things are
- Repository `~/astrolabe/ServiceTas`. The trial branch is `trial/codefirst-mast-eoi-alpha5` at
  `e3d4e0b2` ("the Ant swap and two follow-ups"). Make a worktree from it on a new branch. The
  main checkout is on unrelated work; leave it alone.
- Paths below are relative to `ServiceTasAPI/NewClientApp/client-common`. The workspace is Rush:
  edit `package.json`, then `rush update`.
- The v2 wizard: `components/mast/eoi-v2/` (`EoiWizard.tsx`, `useEoiWizard.ts`, `steps/*.tsx`).
- The look and the component layer, in `forms-v2/`:
  - `serviceTasTheme.tsx`, the `PartialHtmlTheme`;
  - `components.tsx`, the components and the `looks` object;
  - `platform.tsx`, the seam: icons, `Picture`, `Strong`.
- The JSON version, for comparison: `?path=mast-eoi`; the v2 one is at `?path=mast-eoi-v2`. Both
  take a dev-only `&step=N`.
- rxc, for the library source, the docs and the stories: `~/astrolabe/rxc`.
  - `docs/FORMS-V2-PLAN.md` phase 10 says what each alpha.6 item is and why.
  - `apps/forms-storybook/src/stories/` shows the new APIs: `Looks.stories.tsx` (variants under
    all five implementations), and in `Display.stories.tsx` "Rich", "Image" and "GroupHeading",
    and in `Field.stories.tsx` "CheckboxLabelSide".
  - `packages/forms-native/README.md` is the React Native setup.
  - `apps/native-dev` is the React Native playground, where goal 3 runs.

## First: versions and one engine copy
- Bump `@rx-controls/forms-react`, `forms-html` and `forms-antd` to `0.1.0-alpha.6`, pinned
  exactly as before.
- alpha.6 needs `@rx-controls/react ^1.1.5`: that release carries a fix forms-native depends on.
  So bump the compat package, `@react-typed-forms/core`, to `^5.1.5`, and the direct
  `@rx-controls/react` to `^1.1.5`, **everywhere each is declared**.
- Confirm the lockfile holds exactly one `@rx-controls/core` and one `@rx-controls/react`.
- Keep `transpilePackages` as it is; the alpha.5 run showed it is still needed.

## The worklist

For each item: remove the workaround, use the alpha.6 replacement, and record how it went.

| alpha.5 workaround | alpha.6 replacement | gap |
|---|---|---|
| `looks` text classes: lead, stat label, pill text, tag, chip, task number, the step pill's box | `TextDisplay variant="…"`, resolved from the theme's `text.variants` | N1 |
| `looks` group classes: the grey card, the task card, the callout, pills and tags, the two rules | `variant` on `Contents` / `Section`, from `contents.variants` (wrapper / title / body classes) | N2 |
| The page title as the `Section`'s title, so the step pill and the start page's image sat under it | `TextDisplay heading="group"`, the section's own title with content before it | N3 |
| `useValidation().check()` then writing the bound `page`, for a server-decided next page | `useWizard().check()`, then `goTo(key)` where the answer says | N4 |
| `else page.focusInvalid()` after each of three checks | Gone: a refused `check()` now focuses, opening a disclosure and switching a tab first. `{ focus: false }` opts out | N5 |
| `shellFor.checkbox.labelRow` reordering with `[&>label]:contents` and `!ml-auto` | `CheckboxField labelPosition="before"`: words, help, then the switch at the row's end, in focus order too | N6 |
| (none: every help button was named "Help") | Nothing to do. Each is now named "Help: ‹label›"; check it in the tree | N7 |
| `Picture` in the seam, drawing `<img>` | `<ImageDisplay source alt width height fit variant>`. Only the *sources* stay in the seam | N8 |
| `Strong` in the seam | `<RichText html={html\`Is <b>${name}</b> …\`} />`, the `html` template escaping the name | N9 |
| Both links underlined | Two action variants, e.g. `quiet` and `inlineLink`, from the theme's `action.variants` | N10 |
| The disclosure's `::after` Font Awesome chevron | `disclosure.icon` / `iconClassName`, turned under `data-open` | N11 |

Points to decide and record as you go:
- **Roles, not looks.** Name each variant for what it *is* in the form ("lead", "statLabel",
  "taskCard"), not what it looks like ("bold18", "greyBox"). Record the list of names. That list
  is the vocabulary a native theme has to fill in, and a name that only makes sense as a look is a
  finding.
- **The base slots.** html's variant classes are *added* to the base slot, so a utility both set
  (`px-3` against `px-0`) resolves by stylesheet order, not by which is the variant's. The Tailwind
  theme now leaves button padding to its variants for this reason. Record every conflict you hit
  and how the theme had to be shaped to avoid it.
- **What stays in `platform.tsx`.** The target is icons and image sources only. Anything else
  left there is a finding: say what boundary would have taken it.
- **Wizard moves.** With `check()` and `goTo()`, can `useEoiWizard.ts` stop owning the step, or
  does the data layer still want to?

## One page on React Native

Pick one page that has a variant-styled card, a rich-text label, an image and an action. The start
page ("Before you start") is the obvious one; page 2 is a fallback.

- **Copy, don't edit.** Copy the page's source, `components.tsx` and anything ServiceTas-local
  they import into a new screen in rxc's `apps/native-dev/src/mast/`.
  - The data layer can be a fake: plain controls holding a profile, no API.
  - Every copied file must stay **byte-identical** to its ServiceTas original. Record a checksum
    of each, and `diff` them at the end.
  - The one file that may differ is a `platform.native.tsx` beside the copied `platform.tsx`:
    native icons (a glyph in a `Text`, or `@expo/vector-icons` if it is already in the app) and
    `require`d image assets.
- **The theme's roles for native.** The html theme can't be copied: its classes are html slots.
  Write the same role names as a `PartialNativeTheme` for `NativeThemeProvider`
  (`text.variants`, `contents.variants`, `action.variants`, `image.variants`), in NativeWind
  classes.
  - Record which roles carried over as the same classes, which needed different ones, and which
    NativeWind could not draw.
  - A role native has no slot for is a gap.
- **Run it on the Android emulator** (`Pixel_9`). Follow the steps in rxc's
  `docs/FORMS-V2-ALPHA6-SESSION-BRIEF.md` under "Running forms-native on a device":
  - `rushx dev` in `apps/native-dev`, never with `CI=1`;
  - `adb reverse tcp:8081 tcp:8081`;
  - open `exp://127.0.0.1:8081` in Expo Go.

  After rebuilding a package, check Metro serves the new code before trusting what you see.
- **What to check on the device:**
  - The page draws.
  - The roles look like roles.
  - The rich text's emphasis shows.
  - The image keeps its proportions.
  - A refused action focuses its field.
  - The accessibility tree, through `uiautomator dump`, names each control by its label and each
    help button "Help: ‹label›".

  Screenshots (`adb exec-out screencap -p`) go in the report.

The rxc side of this is a new screen in `apps/native-dev`, so it lands in the rxc repo. Commit
it on `main` there if it is clean. The copied ServiceTas source is the user's, so ask before
committing it to the public rxc repo; a gitignored folder is fine for the run itself.

## New behaviour to exercise in the real form
- **Focus on a refused check.** Every page action refused by `check()` now moves focus to the
  first field in error. Put a required field in the "How to find this" disclosure temporarily:
  the refusal must open it and focus the field. Is focusing right on every page, or is there one
  that should opt out with `{ focus: false }`?
- **The group heading's outline.** With `heading="group"` the page's title is its section's own
  title. Check the outline through the accessibility tree: the page title, then card titles one
  level below.
- **Rich text names.** A label with a `<b>` in it still names its control by its plain words.
  Check through the tree, not visible text.
- **A name with markup in it.** Put a `<` or an `&` in the vessel name from the fake profile: the
  `html` template must draw it as text.

## Visual parity
As in the alpha.5 run: page by page at 1440×1000 and 375×812 against the JSON version, using
`&step=N`. The alpha.5 differences to recheck:
- the start page's image above its title on a phone (N3);
- the step pill above the details page's title (N3);
- the standalone link not underlined (N10);
- the UVI row's order (N6).

Record the size of the theme, the provider, `components.tsx` and `platform.tsx` before and after.
`looks` should be gone.

## Environment
- `next dev` for the portal on `:3000`, served through the API on `https://localhost:5001`, signed
  in through B2C dev. **The user signs in**: ask them to, and do not enter credentials yourself.
- **Never press an action that calls MAST or creates a case.** Reach later pages with `&step=N`.
- The known console noise is ServiceTas's own: the page-shell warning "Cannot update
  `PageContent` while rendering `Reactive`", and `console.log(undefined)`. Anything else on the
  console is a finding, on the web and on the device.

## Verify
- `client-common` and `sites/portal` type-check with no errors, and the portal builds.
- rxc's `apps/native-dev` type-checks (`rushx build`).
- Walk every page by hand in both web versions, and the copied page on the device.

## Report back
Write `~/astrolabe/rxc/docs/FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.6.md`, in the style of the
alpha.5 report, citing rxc source lines at the `@rx-controls/forms-react_v0.1.0-alpha.6` tag:
1. **The page on React Native**, first:
   - the files copied and their checksums, and the `diff` showing them unchanged;
   - what `platform.native.tsx` holds;
   - the native theme's roles against the html theme's;
   - the device screenshots, and the accessibility tree.

   Say plainly whether the exit holds: one page's unchanged source on native, with only the
   platform file beside it. If not, what stands in the way.
2. **Roles and the seam**:
   - the variant names, by kind;
   - what is left in `platform.tsx`, which should be icons and image sources only;
   - the base-slot conflicts the theme had to be shaped around.
3. **The worklist**, as a table: each N-gap closed, changed or still open, and why. Then the
   sizes before and after.
4. **The new APIs in a real form**: what fitted, what was awkward, what is wrong with them.
5. **New gaps** this run found, numbered fresh (P1 onwards), each with what you did instead and
   what the library should offer.
6. **Visual parity**, both widths, with the alpha.5 differences rechecked.
7. **Against alpha.5**: each of its suggestions fixed, changed or still open, and anything it got
   wrong.
