const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);

// Watch the whole repo: Rush declares no workspaces where Expo looks for
// them, so without this Metro reads the linked packages (forms-native, …)
// once at startup and serves them stale after a rebuild.
config.watchFolders = [repoRoot];

// Font Awesome Pro, which ServiceTas draws its icons with, is licensed: never a dependency of
// this public repo. With a ServiceTas checkout beside the repo (or at SERVICETAS_RN), the packs
// resolve from its node_modules and `rxc-icon-packs` is src/icons/proPacks.ts; without one, the
// free set (freePacks.ts).
const serviceTasRn =
  process.env.SERVICETAS_RN ??
  path.resolve(repoRoot, "../ServiceTas/ServiceTasAPI/NewClientApp/servicetas-rn");
const proPacks = ["@fortawesome/pro-regular-svg-icons", "@fortawesome/pro-solid-svg-icons"];
const proDirs = proPacks.map((p) => path.join(serviceTasRn, "node_modules", p));
const hasPro = proDirs.every((d) => fs.existsSync(d));
if (hasPro) proDirs.forEach((d, i) => (proDirs[i] = fs.realpathSync(d)));
if (hasPro) config.watchFolders.push(...proDirs);
console.log(
  hasPro ? `Icons: Font Awesome Pro from ${serviceTasRn}` : "Icons: the free Font Awesome set (no ServiceTas checkout)",
);

// The workspace packages this app links (forms-native, forms-react,
// @rx-controls/react, …) resolve React and React Native from their own
// node_modules. Two copies in one bundle break every hook and every native
// component, so these resolve to the app's own wherever the import is.
const single = ["react", "react-native"];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "rxc-icon-packs")
    return {
      type: "sourceFile",
      filePath: path.join(projectRoot, "src/icons", hasPro ? "proPacks.ts" : "freePacks.ts"),
    };
  // Straight to the pack's file: it imports nothing, and Metro will not look up packages from
  // a directory outside the project.
  if (hasPro && proPacks.includes(moduleName))
    return { type: "sourceFile", filePath: path.join(proDirs[proPacks.indexOf(moduleName)], "index.js") };
  const pkg = single.find((p) => moduleName === p || moduleName.startsWith(p + "/"));
  if (pkg)
    return context.resolveRequest(
      { ...context, originModulePath: path.join(projectRoot, "package.json") },
      moduleName,
      platform,
    );
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
