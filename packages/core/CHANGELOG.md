# Change Log - @rx-controls/core

This log was last generated on Wed, 30 Sep 2026 04:47:57 GMT and should not be manually modified.

## 1.1.0
Wed, 30 Sep 2026 04:47:57 GMT

### Minor changes

- Add addEscapedReadHook (internal subpath): escaped-read hooks now compose instead of occupying a single slot, so a second installer no longer silently disables the first. setEscapedReadHook is unchanged and reimplemented over it.
- Add createDerivedGroup and detachFields. A derived group composes its value from its children but never writes it back down to them, which makes it safe to aggregate validity, touched and dirty over an arbitrary set of controls — including a control and a descendant of it, where an ordinary group silently reverts writes. detachFields removes members by key, which previously required replacing them with a throwaway control.

