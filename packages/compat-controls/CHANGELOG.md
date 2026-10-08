# Change Log - @react-typed-forms/core

This log was last generated on Thu, 08 Oct 2026 22:30:34 GMT and should not be manually modified.

## 5.1.5
Thu, 08 Oct 2026 22:30:34 GMT

_Version update only_

## 5.1.4
Wed, 07 Oct 2026 22:13:31 GMT

### Patches

- A child control created after its parent was touched or disabled non-recursively (setTouched(true, true)) is no longer born touched or disabled — it inherits only after a recursive set, as if it had existed at the time. Fixes fields and collection rows on unreached wizard pages showing "Please enter a value" in @astroapps/forms-core.

## 5.1.3
Wed, 07 Oct 2026 07:01:06 GMT

### Patches

- trackedValue's proxy tracks existence and enumeration checks (in, hasOwnProperty, Object.keys) the way it tracks reads. jsonata 2.2 checks hasOwnProperty before reading a key, so a legacy jsonata expression over a key the data did not have yet (e.g. a Visible of `docs.attend != null`) never re-ran once the key was added. Consumers can drop a jsonata ~2.1 pin.

## 5.1.2
Thu, 01 Oct 2026 07:08:33 GMT

_Version update only_

## 5.1.1
Thu, 01 Oct 2026 07:00:26 GMT

_Version update only_

## 5.1.0
Wed, 30 Sep 2026 04:47:57 GMT

### Minor changes

- Add opt-in ambient diagnostics and load-time duplicate-install detection. New on the main entry point: setStrictAmbient/getStrictAmbient and getCompatPatchInfo. New '/internal' subpath export carrying setAmbientTrace, a debugging aid held outside the semver promise. No default behaviour changes: strict mode and the trace are off by default, and the duplicate report only fires on an install that is already broken.

### Patches

- Peer dependency is now `react: ^19`. React 18 was never used by any consumer; 5.0.0, which declared `^18 || ^19`, is deprecated in favour of this release.

