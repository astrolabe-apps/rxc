import type { FieldOption } from "@rx-controls/forms-react";

/**
 * Legacy's `DefaultBoolOptions`: Yes → `true`, No → `false`. See
 * {@link LoaderOptions.boolOptions}.
 *
 * @group Loading
 */
export const defaultBoolOptions: readonly FieldOption[] = [
  { name: "Yes", value: true },
  { name: "No", value: false },
];
