import { context } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const outputDirectory = "dist";

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp("mock/index.html", `${outputDirectory}/index.html`);

const buildContext = await context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outdir: `${outputDirectory}/assets`,
  entryNames: "app",
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  sourcemap: true,
  logLevel: "info",
});

await buildContext.watch();
const server = await buildContext.serve({
  servedir: outputDirectory,
  host: "127.0.0.1",
  port: 4173,
});

console.log(`Lokaler Mock-Prototyp: http://127.0.0.1:${server.port}`);
