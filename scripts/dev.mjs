import { context } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import {
  extensionBackgroundBuildOptions,
  extensionContentBuildOptions,
  mockPageBuildOptions,
} from "./build-options.mjs";

const extensionOutputDirectory = "dist";
const mockOutputDirectory = ".dev";

await Promise.all([
  rm(extensionOutputDirectory, { recursive: true, force: true }),
  rm(mockOutputDirectory, { recursive: true, force: true }),
]);
await Promise.all([
  mkdir(extensionOutputDirectory, { recursive: true }),
  mkdir(mockOutputDirectory, { recursive: true }),
]);
await Promise.all([
  cp("manifest/manifest.json", `${extensionOutputDirectory}/manifest.json`),
  cp("mock/index.html", `${mockOutputDirectory}/index.html`),
]);

const [contentContext, backgroundContext, mockContext] = await Promise.all([
  context(extensionContentBuildOptions),
  context(extensionBackgroundBuildOptions),
  context(mockPageBuildOptions),
]);

await Promise.all([contentContext.watch(), backgroundContext.watch(), mockContext.watch()]);
const server = await mockContext.serve({
  servedir: mockOutputDirectory,
  host: "127.0.0.1",
  port: 4173,
});

console.log(`Mock-Seite: http://127.0.0.1:${server.port}`);
console.log("Unpacked Extension: dist/");
