# Forms v2 — the ServiceTas MAST EOI trial on `alpha.8`, as a brief

The prompt for rerunning the MAST licence EOI trial against `0.1.0-alpha.8`. Paste everything
below the line into a fresh Claude Code session in a new ServiceTas worktree.

**Not a cold read, and a small release.** The alpha.7 run
([`FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.7.md`](./FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.7.md))
closed every alpha.6 workaround, and found a forms-native bug that left Android fields disabled
after any `disableType="global"` action (Q2). It also found that a switch's colours had no theme
slot (Q1), and that react-native-web can't catch device-only behaviour (Q3). alpha.8 is those three
follow-ups and one docs fix, each recorded under its gap as "Fixed since". It has no breaking
changes. TalkBack has carried over from two runs, and this run settles it, with the user's hands.

Update the versions, the commits and the paths if they have moved. Check
`npm view @rx-controls/forms-react dist-tags` before starting: `alpha` should be `0.1.0-alpha.8`.

---

Rerun the ServiceTas **MAST licence EOI wizard** trial against `@rx-controls/forms-*@0.1.0-alpha.8`.
The previous run, against `0.1.0-alpha.7`, ran three MAST pages on the Android emulator from their
unchanged source with every alpha.6 workaround gone. It needed a local forms-native fix (Q2) to
pass its device checks, left the native switches Android's blue (Q1), and couldn't drive TalkBack.
alpha.8 ships the fix and the switch colours. There are four goals, in this order:

1. **alpha.8 drops in.** The bump, with no source change needed: alpha.8 breaks nothing.
2. **The switches in ServiceTas's colours (Q1).** `checkbox.switchColors` in the native theme, so
   the native switches are green like the web's.
3. **The device pass, on the MAST pages.** The checklist from rxc's `FORMS-V2-PLAN.md` ("Before an
   alpha that touches `forms-native`: a device pass"), run over the three pages with the
   published alpha.8: a refused Continue focusing its field with the lock in place, every field
   enabled after it (Q2), nothing in Metro's log.
4. **TalkBack, settled.** Whether the radio group is announced by its question, whether the
   headings are announced as headings and at what level, and whether a double-tap on a switch's
   label toggles it. **This needs the user**: ask them to swipe through (below).

The web side didn't change in alpha.8 beyond docs, so its checks are a short regression pass.

The branch is throwaway: nothing needs to be production ready. **Don't push the ServiceTas branch
without asking.**

**Read the alpha.7 report first**:
`~/astrolabe/rxc/docs/FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.7.md`. Its gap numbers (Q1–Q3) are
the ones used here, and each gap now ends with what alpha.8 did about it. Its §1 has the device
setup, the scripted checks and what went wrong driving TalkBack.

## Where things are
- Repository `~/astrolabe/ServiceTas`. The trial branch is `trial/codefirst-mast-eoi-alpha7` at
  `452aa158`. Make a worktree from it on a new branch. The main checkout is on unrelated work;
  leave it alone.
- Paths below are relative to `ServiceTasAPI/NewClientApp/client-common`. The workspace is Rush:
  edit `package.json`, then `rush update`.
- The v2 wizard: `components/mast/eoi-v2/` (`EoiWizard.tsx`, `useEoiWizard.ts`, `eoiModel.ts`,
  `steps/*.tsx`), and the native trial screen `EoiTrialScreen.native.tsx` with its fake data layer.
- The look and the component layer, in `forms-v2/`: `serviceTasTheme.tsx` and
  `serviceTasTheme.native.ts`, `components.tsx`, and the seam `platform.tsx` /
  `platform.native.tsx` with the native images in `forms-v2/assets/`.
- The JSON version, for comparison: `?path=mast-eoi`; the v2 one is at `?path=mast-eoi-v2`. Both
  take a dev-only `&step=N`.
- rxc, for the library source, the docs and the playground: `~/astrolabe/rxc`.
  - `docs/FORMS-V2-PLAN.md`, "Before an alpha that touches `forms-native`: a device pass": the
    checklist goal 3 runs.
  - `packages/forms-native/src/theme.tsx`: `NativeTheme.checkbox.switchColors`.
  - `apps/native-dev` is the React Native playground. **The alpha.7 run's copies are still in
    `apps/native-dev/src/mast/`** (excluded from git in `.git/info/exclude`); the "MAST" entry in
    `App.tsx` was reverted and needs adding again, locally.

## First: versions and one engine copy
- Bump `@rx-controls/forms-react`, `forms-html` and `forms-antd` to `0.1.0-alpha.8`, pinned
  exactly as before.
- The stable packages haven't moved: `@react-typed-forms/core` `^5.1.5` and `@rx-controls/react`
  `^1.1.5` stay as they are.
- Confirm the lockfile holds exactly one `@rx-controls/core` and one `@rx-controls/react`.
- Type-check the alpha.7 source against alpha.8 **before changing anything**, web and native.
  Nothing should break; anything that does is a finding.

## The worklist

| alpha.7 gap | alpha.8 | to do |
|---|---|---|
| Q1: native switches in Android's default blue | `checkbox.switchColors: { trackOn?, trackOff?, thumbOn?, thumbOff? }`, colour values, each the platform's own when left out | Add it to `serviceTasTheme.native.ts` in the html theme's colours (the track `primary` when on). Record which values you took from where: Tailwind's config, the html theme's classes |
| Q2: a field disabled and enabled again stayed disabled on Android | Fixed in forms-native; every disabled state handed to React Native is a boolean | Nothing to write. Check it on the device, with `disableType="global"` in place and no local patch |
| Q3: no check short of a device | The device pass in rxc's plan | Run it over the MAST pages (below) |
| §3: the docs didn't name icon and image variants | `HtmlTheme`'s paragraph names them, with sizes in the variants | Check the html theme's note icon against it |
| TalkBack, open since alpha.6 | Nothing in the library | Settle it with the user (below) |

## The pages on React Native

The same three pages, in one `Wizard` (`navigation="none"`): the start page, page 2, and page 3
through "Link my account".

- **Copy, don't edit.** Re-copy the pages, `eoiModel.ts`, `forms-v2/` and
  `custom-display/HowToFindLicenceNumber.tsx` into `apps/native-dev/src/mast/servicetas/` over the
  alpha.7 run's copies, and show `EoiTrialScreen` from a local "MAST" entry in `App.tsx`.
  - Every copied file must stay **byte-identical** to its ServiceTas original. Record a checksum
    of each and `diff` them at the end. Change a file in ServiceTas first and re-copy. Only the
    native theme should differ from the alpha.7 run's checksums.
  - The copies and the "MAST" entry stay out of the rxc repo.
- **Run it on the Android emulator** (`Pixel_9`):
  - Rebuild rxc first (`rush build`): `apps/native-dev` takes the workspace packages, which are
    alpha.8's source at the release commit.
  - Run Metro **so you can read its output**: Expo Go sends the app's console to Metro, not to
    logcat (the alpha.7 run checked an empty logcat). Start `rushx dev` in `apps/native-dev` from
    a background shell writing to a file. If a Metro is already on 8081, use the plan's second
    port (`--port 8082`) rather than stopping someone else's.
  - `adb reverse tcp:<port> tcp:<port>`, then open `exp://127.0.0.1:<port>` in Expo Go.
  - Check the bundle carries alpha.8 before trusting what you see: `switchColors` in forms-native.
- **The device pass, from the plan:**
  - The three pages draw with nothing in Metro's log after the bundle.
  - **A refused Continue on page 3 focuses the field and raises the keyboard**
    (`focused="true"` in `uiautomator dump`, `mInputShown=true` from
    `dumpsys input_method`), with `disableType="global"` on the action and alpha.8 as published.
  - **After any global action, every field enabled:** the page 3 input and page 2's radios
    `enabled="true"` in the dump. Typing into the input lands.
  - **The switches green:** sample the track's colour from a screenshot, on and off, against the
    theme's values.
  - The logo at `width={402}` alone keeps its proportions.
- **Tips the alpha.7 run and the rxc device pass learned:**
  - The emulator's autofill opens a popup over a focused field, and `uiautomator dump` then sees
    only the popup. Dismiss it with Escape (`adb shell input keyevent 111`) or a tap on an empty
    area. Back sends Expo Go to the background (state kept).
  - Screenshots are 1080 × 2424; scale coordinates from a downscaled view before tapping.

## TalkBack, with the user

The alpha.7 run couldn't drive TalkBack: `adb shell input tap` goes past touch exploration, its
keyboard shortcuts did nothing, and two screen captures saw no speech. So this run asks the user.

- Turn on TalkBack's developer setting **"Display speech output"** (TalkBack settings → Advanced
  settings → Developer settings) so each utterance shows as a caption on screen. Check it shows
  before involving the user.
- **Ask the user** to swipe through page 2 and page 3 on the emulator window, one swipe at a time,
  and to double-tap a switch's label on page 3. Screenshot the caption after each step, or ask
  them to tell you what it said.
- Record, for each of these, what TalkBack said:
  - each radio group on page 2: is it announced by its question, before its options ("Yes it
    matches")?
  - the page title and a group title: announced as headings, and at what level?
  - the help button on page 3: "Help: Commercial vessel UVI"?
  - a double-tap on a switch's label: does it toggle the switch (P9's open half)?
- Turn TalkBack off at the end; it changes how every later tap behaves.

## The web, briefly
Nothing on the web changed in alpha.8 except `HtmlTheme`'s docs. At 1440×1000 and 375×812, walk
the nine pages against the JSON version (`&step=N`) and record anything that moved since the
alpha.7 run's §5. Check the console against the known noise, and the Ant swap
(`?path=mast-eoi-v2-antd`) for its known one-warning-per-role.

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
- Walk every page in both web versions, and the three pages on the device.

## Report back
Write `~/astrolabe/rxc/docs/FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.8.md`, in the style of the
alpha.7 report, citing rxc source lines at the `@rx-controls/forms-react_v0.1.0-alpha.8` tag. New
gaps are numbered R1 onwards.
1. **The verdict**, first: did alpha.8 drop in unchanged, are the switches green, did the device
   pass hold with no local patch, and what did TalkBack say?
2. **The pages on React Native**: the checksums and the `diff`, the native theme's
   `switchColors` and where its values came from, the device screenshots and the accessibility
   tree, and the device pass as a table, each check settled or not.
3. **TalkBack**: what it said for each item above, with the caption screenshots.
4. **The worklist**, as a table: each Q-gap and the docs item closed, changed or still open.
5. **New gaps** this run found (R1 onwards), each with what you did instead and what the library
   should offer.
6. **The web**: anything that moved, and the console.
7. **Against alpha.7**: each of its suggestions fixed, changed or still open, and anything it got
   wrong.
