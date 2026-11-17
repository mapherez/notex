import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { formatContent, root } from "./format-files.mjs";

void test("code checks bootstrap a clean contract and typecheck preserves its formatted manifest", async () => {
  const npm = (...args) =>
    execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
      cwd: root,
      shell: process.platform === "win32",
      stdio: "pipe",
    });
  npm("run", "clean", "--workspace", "@notex/mcp-contract");
  assert.equal(
    existsSync(new URL("../packages/notex-mcp-contract/dist/index.d.ts", import.meta.url)),
    false,
  );
  npm("run", "check:code");
  assert.equal(
    existsSync(new URL("../packages/notex-mcp-contract/dist/index.d.ts", import.meta.url)),
    true,
  );
  const path = "packages/notex-mcp-contract/generated/tool-manifest.json";
  const file = new URL(`../${path}`, import.meta.url);
  const contents = readFileSync(file, "utf8");
  assert.equal(
    await formatContent(path, contents),
    contents,
    "A build must not undo the formatter",
  );
  npm("run", "typecheck");
  assert.equal(
    readFileSync(file, "utf8"),
    contents,
    "Typechecking must preserve the generated manifest",
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
