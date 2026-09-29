/*
 * Phase 1 of docs/FORMS-V2-PLAN.md is types only. Every exported function has
 * its real signature and this body, so the package builds, imports cleanly and
 * documents itself, and anything that calls it before phase 2 fails loudly.
 * Not exported from the package.
 */

export function notBuilt(name: string): never {
  throw new Error(
    `@rx-controls/forms-html: ${name} is not built yet — phase 1 is types only (docs/FORMS-V2-PLAN.md).`,
  );
}

/**
 * A component that throws when rendered. Factories return one, so a module
 * that builds its components at load time — the built-ins — still imports.
 */
export function notBuiltComponent<P>(name: string): (props: P) => never {
  return () => notBuilt(name);
}
