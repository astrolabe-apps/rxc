const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);

// Watch the whole repo: Rush declares no workspaces where Expo looks for
// them, so without this Metro reads the linked packages (forms-native, …)
// once at startup and serves them stale after a rebuild.
config.watchFolders = [repoRoot];

// The workspace packages this app links (forms-native, forms-react,
// @rx-controls/react, …) resolve React and React Native from their own
// node_modules. Two copies in one bundle break every hook and every native
// component, so these resolve to the app's own wherever the import is.
const single = ["react", "react-native", "nativewind", "react-native-css-interop"];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const pkg = single.find((p) => moduleName === p || moduleName.startsWith(p + "/"));
  if (pkg)
    return context.resolveRequest(
      { ...context, originModulePath: path.join(projectRoot, "package.json") },
      moduleName,
      platform,
    );
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
