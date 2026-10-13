import { library } from "@fortawesome/fontawesome-svg-core";
// Resolved from the ServiceTas checkout's node_modules by metro.config.js: Pro is licensed,
// so it is never a dependency of this public repo.
import { far } from "@fortawesome/pro-regular-svg-icons";
import { fas } from "@fortawesome/pro-solid-svg-icons";

// As the app's setupFontAwesome.ts.
library.add(far, fas);

export const iconPacks = "pro" as const;
