# Change Log - @rx-controls/core

This log was last generated on Wed, 07 Oct 2026 22:13:31 GMT and should not be manually modified.

## 1.1.4
Wed, 07 Oct 2026 22:13:31 GMT

### Patches

- A child created after its parent was touched or disabled with notChildren is no longer born touched or disabled. Children inherit the flag only when it was last set recursively (and pass that on to their own later children); a clear, recursive or not, stops later children inheriting. Previously the flags a lazy child started with depended on when it was first accessed, so a field or collection row first created after setTouched(true, true) on its compound showed its error early.

## 1.1.3
Wed, 07 Oct 2026 07:01:06 GMT

### Patches

- getTrackedValue's proxy tracks existence and enumeration checks (in, hasOwnProperty, Object.keys) the way it tracks reads. jsonata 2.2 checks hasOwnProperty before reading a key, so an expression over a key the data did not have yet never subscribed to it and never re-ran once the key was added.

## 1.1.2
Thu, 01 Oct 2026 07:08:33 GMT

### Patches

- Republish with the compiled Map and Set comparison in lib/. 1.1.1 shipped the fix in src/ only.

## 1.1.1
Thu, 01 Oct 2026 07:00:26 GMT

### Patches

- deepEquals compares Maps and Sets by contents, as @react-typed-forms/core v4 did. Previously two equal Map or Set instances were never equal, so a computed control returning a new Map re-rendered its readers on every recompute.

## 1.1.0
Wed, 30 Sep 2026 04:47:57 GMT

### Minor changes

- Add addEscapedReadHook (internal subpath): escaped-read hooks now compose instead of occupying a single slot, so a second installer no longer silently disables the first. setEscapedReadHook is unchanged and reimplemented over it.
- Add createDerivedGroup and detachFields. A derived group composes its value from its children but never writes it back down to them, which makes it safe to aggregate validity, touched and dirty over an arbitrary set of controls — including a control and a descendant of it, where an ordinary group silently reverts writes. detachFields removes members by key, which previously required replacing them with a throwaway control.

