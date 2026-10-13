import type { IconSet } from "@rx-controls/forms-react";

/**
 * The classes legacy drew an icon with, for a family and name the format
 * gave: `fa fa-user` for `FontAwesome`, the name itself for `Material` and
 * `CssClass`, and `fa-regular fa-user` for a Font Awesome style named as the
 * family (`fa-regular`, `fa-solid`).
 *
 * @group Rendering
 */
export function legacyIconClass(family: string, name: string): string {
  switch (family) {
    case "FontAwesome":
      return `fa fa-${name}`;
    case "Material":
    case "CssClass":
      return name;
    default:
      return `${family} fa-${name}`;
  }
}

/**
 * An icon set that draws what legacy drew: an `<i>` with
 * {@link legacyIconClass}'s classes, for an app that loads the icon font's
 * stylesheet. Only icons with a family — the ones a JSON form names; a name
 * without one, such as the implementation's own `info` or `chevron-right`, is
 * left to the next set out.
 *
 * ```tsx
 * <FormIconsProvider set={legacyWebIcons}>…</FormIconsProvider>
 * ```
 *
 * @group Rendering
 */
export const legacyWebIcons: IconSet = ({ family, name }) =>
  family ? <i className={legacyIconClass(family, name)} /> : undefined;
