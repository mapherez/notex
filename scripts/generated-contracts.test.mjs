import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { formatContent, root } from "./format-files.mjs";

void test("typecheck leaves the generated manifest formatted and regeneration is repeatable", async () => {
  execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "typecheck"], {
    cwd: root,
    shell: process.platform === "win32",
    stdio: "pipe",
  });
  const path = "packages/notex-mcp-contract/generated/tool-manifest.json";
  const file = new URL(`../${path}`, import.meta.url);
  const contents = readFileSync(file, "utf8");
  assert.equal(
    await formatContent(path, contents),
    contents,
    "A build must not undo the formatter",
  );
  const { createToolManifest } = await import("../packages/notex-mcp-contract/dist/index.js");
  assert.deepEqual(JSON.parse(contents), createToolManifest());
  execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL(
          "../packages/notex-mcp-contract/scripts/generate-tool-manifest.mjs",
          import.meta.url,
        ),
      ),
    ],
    { cwd: root },
  );
  assert.equal(
    readFileSync(file, "utf8"),
    contents,
    "Regenerating twice must produce identical bytes",
  );
});
