import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { extensionBackgroundBuildOptions, extensionContentBuildOptions } from "./build-options.mjs";

const outputDirectory = "dist";

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp("manifest/manifest.json", `${outputDirectory}/manifest.json`);

await Promise.all([build(extensionContentBuildOptions), build(extensionBackgroundBuildOptions)]);
