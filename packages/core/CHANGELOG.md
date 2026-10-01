# Change Log - @rx-controls/core

This log was last generated on Thu, 01 Oct 2026 07:00:26 GMT and should not be manually modified.

## 1.1.1
Thu, 01 Oct 2026 07:00:26 GMT

### Patches

- deepEquals compares Maps and Sets by contents, as @react-typed-forms/core v4 did. Previously two equal Map or Set instances were never equal, so a computed control returning a new Map re-rendered its readers on every recompute.

## 1.1.0
Wed, 30 Sep 2026 04:47:57 GMT

### Minor changes

- Add addEscapedReadHook (internal subpath): escaped-read hooks now compose instead of occupying a single slot, so a second installer no longer silently disables the first. setEscapedReadHook is unchanged and reimplemented over it.
- Add createDerivedGroup and detachFields. A derived group composes its value from its children but never writes it back down to them, which makes it safe to aggregate validity, touched and dirty over an arbitrary set of controls — including a control and a descendant of it, where an ordinary group silently reverts writes. detachFields removes members by key, which previously required replacing them with a throwaway control.

