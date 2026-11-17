import type { FormatConfig } from "vite-plus/fmt";
import formatOptions from "./scripts/format-options.json" with { type: "json" };
import { defineConfig, loadEnv, lazyPlugins } from "vite-plus";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  fmt: formatOptions as FormatConfig,
  staged: { "*": "vp check --fix" },
  lint: {
    // Remote MCP remains deferred; its separate CI is disabled until its SDK adapter is restored.

    ignorePatterns: [
      "backend/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/target/**",
      "**/vendor/**",
      "**/*.md",
      "**/*.mdx",
      "**/package-lock.json",
      "**/pnpm-lock.yaml",
      "packages/notex-mcp-contract/generated/**",
      "src/content/**",
    ],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  // The hosted image uses /app/; desktop and local development keep /.
  base: loadEnv(mode, ".", "NOTEX_").NOTEX_WEB_BASE_PATH || "/",
  plugins: lazyPlugins(() => [react()]),
  server: {
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");

          if (normalizedId.indexOf("node_modules/@chenglou/pretext") >= 0) {
            return "pretext";
          }

          if (normalizedId.indexOf("node_modules/prosemirror") >= 0) {
            return "prosemirror";
          }

          if (normalizedId.indexOf("node_modules/@tiptap") >= 0) {
            return "tiptap";
          }

          if (
            normalizedId.indexOf("node_modules/@floating-ui") >= 0 ||
            normalizedId.indexOf("node_modules/fast-equals") >= 0 ||
            normalizedId.indexOf("node_modules/linkifyjs") >= 0
          ) {
            return "editor-support";
          }

          return undefined;
        },
      },
    },
  },
}));
