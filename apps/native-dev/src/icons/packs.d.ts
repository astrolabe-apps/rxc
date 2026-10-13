// Metro resolves `rxc-icon-packs` to proPacks.ts or freePacks.ts (metro.config.js), and the Pro
// packs from a ServiceTas checkout; neither is installed here, so TypeScript is told their shape.
declare module "rxc-icon-packs" {
  export const iconPacks: "pro" | "free";
}
declare module "@fortawesome/pro-regular-svg-icons" {
  export const far: import("@fortawesome/fontawesome-svg-core").IconPack;
}
declare module "@fortawesome/pro-solid-svg-icons" {
  export const fas: import("@fortawesome/fontawesome-svg-core").IconPack;
}
