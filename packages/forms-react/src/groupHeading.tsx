import { createContext, useContext } from "react";

/*
 * Not exported from the package: how a group and a display inside it that is
 * its title (`heading="group"`) find each other.
 */

/**
 * The nearest group, for a display that is its title (`heading="group"`):
 * the level the group's title takes, and the claim that makes the group
 * count as titled — so what is inside heads one deeper.
 */
export interface GroupHeading {
  level: number;
  claim(): () => void;
}

export const GroupHeadingContext = createContext<GroupHeading | undefined>(undefined);

/** The nearest group's heading, for the display boundary. */
export function useGroupHeading(): GroupHeading | undefined {
  return useContext(GroupHeadingContext);
}

