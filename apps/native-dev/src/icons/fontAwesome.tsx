import {
  findIconDefinition,
  type IconName,
  type IconPrefix,
} from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import type { ChromeIcon, IconRef, IconSet } from "@rx-controls/forms-react";
// The packs: Font Awesome Pro from a ServiceTas checkout beside this repo, else the free
// set. Metro picks the file (metro.config.js); see the README there.
import { iconPacks } from "rxc-icon-packs";

/** The format's families, as Font Awesome's prefixes. Legacy's `fa fa-x` is the solid style. */
const prefixes: Record<string, IconPrefix> = {
  "fa-regular": "far",
  "fa-solid": "fas",
  FontAwesome: "fas",
  fa: "fas",
};

/** What the app draws in place of the implementation's own glyphs. */
const chrome: Record<ChromeIcon, IconRef> = {
  // RNHelpTextRenderer: FontAwesome5 `info-circle`, solid.
  info: { family: "fa-solid", name: "circle-info" },
  // The app's date button: FontAwesome5 `calendar-alt` (\uf073), `calendar-days` in 6.
  calendar: { family: "fa-regular", name: "calendar-days" },
  // RNCheckbox: FontAwesome `check`.
  check: { family: "fa-solid", name: "check" },
  "chevron-right": { family: "fa-solid", name: "chevron-right" },
  // The accordion: `fontAwesomeIcon("chevron-down" / "chevron-up")`.
  "chevron-down": { family: "fa-solid", name: "chevron-down" },
  "chevron-up": { family: "fa-solid", name: "chevron-up" },
};

/**
 * ServiceTas's icons on a device: Font Awesome, drawn as the app's `RNIcon` does, at the size
 * and colour of the place. A name the packs lack draws nothing — with the free set, most of the
 * app's Pro icons.
 */
export const fontAwesomeIcons: IconSet = ({ family, name, size, color }) => {
  const ref = family ? { family, name } : chrome[name as ChromeIcon];
  const prefix = ref && prefixes[ref.family!];
  if (!prefix) return undefined;
  const icon = findIconDefinition({ prefix, iconName: ref.name as IconName });
  return icon ? <FontAwesomeIcon icon={icon} size={size} color={color ?? "black"} /> : null;
};

/** Which packs the playground drew from: `pro` only with a ServiceTas checkout. */
export const iconPackKind = iconPacks;
