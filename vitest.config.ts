import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    clearMocks: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
