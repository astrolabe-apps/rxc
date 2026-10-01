# Change Log - @react-typed-forms/core

This log was last generated on Thu, 01 Oct 2026 07:00:26 GMT and should not be manually modified.

## 5.1.1
Thu, 01 Oct 2026 07:00:26 GMT

_Version update only_

## 5.1.0
Wed, 30 Sep 2026 04:47:57 GMT

### Minor changes

- Add opt-in ambient diagnostics and load-time duplicate-install detection. New on the main entry point: setStrictAmbient/getStrictAmbient and getCompatPatchInfo. New '/internal' subpath export carrying setAmbientTrace, a debugging aid held outside the semver promise. No default behaviour changes: strict mode and the trace are off by default, and the duplicate report only fires on an install that is already broken.

### Patches

- Peer dependency is now `react: ^19`. React 18 was never used by any consumer; 5.0.0, which declared `^18 || ^19`, is deprecated in favour of this release.

