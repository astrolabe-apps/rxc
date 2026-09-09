/**
 * Filter console output that these tests provoke on purpose.
 *
 * Two messages are expected here and carry no signal:
 *
 *  - The scripted-override proxy's escaped-read guard. Tests build proxies
 *    against `untrackedRead`, whose `isFinalized` is permanently true, so
 *    the guard fires on every scriptable property read — it is working as
 *    designed, and no test asserts on it.
 *  - The jsonata parse error, emitted by the test that feeds a deliberately
 *    malformed expression to check it publishes `undefined` rather than
 *    throwing.
 *
 * Left alone they write ~16 lines to stderr per run, which Rush reports as
 * build warnings and escalates into a non-zero `rush test` exit. Only these
 * two messages are dropped; anything else passes through, so a genuinely
 * unexpected warning or error still shows up.
 */
const SUPPRESSED = [
  "Scripted-override proxy read for",
  "Failed to parse jsonata expression",
];

const isExpected = (args: unknown[]) =>
  typeof args[0] === "string" && SUPPRESSED.some((s) => args[0].includes(s));

const realWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (!isExpected(args)) realWarn(...args);
};

const realError = console.error;
console.error = (...args: unknown[]) => {
  if (!isExpected(args)) realError(...args);
};
