import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const outputDirectory = "dist";

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp("mock/index.html", `${outputDirectory}/index.html`);

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outdir: `${outputDirectory}/assets`,
  entryNames: "app",
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  sourcemap: true,
  minify: false,
  logLevel: "info",
});
