import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "vite-plus/fmt";
import formatOptions from "../../../scripts/format-options.json" with { type: "json" };

import { createToolManifest } from "../dist/index.js";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, "../generated/tool-manifest.json");

await mkdir(dirname(outputPath), { recursive: true });
const { code, errors } = await format(
  outputPath,
  `${JSON.stringify(createToolManifest(), null, 2)}\n`,
  formatOptions,
);
if (errors.length) throw new Error(errors.map((error) => error.message).join("\n"));
await writeFile(outputPath, code, "utf8");
