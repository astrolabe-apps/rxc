import { library } from "@fortawesome/fontawesome-svg-core";
import { far } from "@fortawesome/free-regular-svg-icons";
import { fas } from "@fortawesome/free-solid-svg-icons";

// No ServiceTas checkout: the free set, which lacks many of the app's icons.
library.add(far, fas);

export const iconPacks = "free" as const;
