import type { IconRef } from "@rx-controls/forms-react";
import type { IconReference } from "@rx-controls/forms-schema";

/**
 * An icon the format names, as the contract's icon by name: its `library`
 * the family (`fa-regular`, `FontAwesome`, `Material`), which the icon sets
 * in scope interpret. For a host translator drawing an icon the loader does
 * not.
 *
 * @group Hosts
 */
export function iconRefOf(icon: IconReference): IconRef {
  return icon.library ? { family: icon.library, name: icon.name } : { name: icon.name };
}
