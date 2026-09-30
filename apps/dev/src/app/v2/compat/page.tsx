"use client";

/**
 * The compat fixture: Forms v2 inside a `@react-typed-forms/core` v5 (compat)
 * app. See `CompatFixture.tsx`; asserted by `test/compatFixture.test.tsx`.
 */

import { CompatApp } from "./CompatFixture";

export default function V2CompatPage() {
  return (
    <div className="p-6">
      <h1 className="mb-4 text-lg font-semibold">
        Forms v2 in a compat-engine app
      </h1>
      <CompatApp />
    </div>
  );
}
