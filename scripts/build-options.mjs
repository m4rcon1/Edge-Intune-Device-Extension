export const extensionContentBuildOptions = {
  entryPoints: { content: "src/content/content-script.ts" },
  bundle: true,
  outdir: "dist",
  entryNames: "[name]",
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  sourcemap: true,
  minify: false,
  logLevel: "info",
};

export const extensionBackgroundBuildOptions = {
  entryPoints: { background: "src/background/service-worker.ts" },
  bundle: true,
  outdir: "dist",
  entryNames: "[name]",
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  sourcemap: true,
  minify: false,
  logLevel: "info",
};

export const mockPageBuildOptions = {
  entryPoints: { mock: "src/mock/mock-main.ts" },
  bundle: true,
  outdir: ".dev/assets",
  entryNames: "[name]",
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  sourcemap: true,
  minify: false,
  logLevel: "info",
};
