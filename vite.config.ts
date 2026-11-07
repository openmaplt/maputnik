import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import istanbul from "vite-plugin-istanbul";

export default defineConfig(({ mode }) => ({
  server: {
    port: 8888,
  },
  build: {
    sourcemap: true,
    rolldownOptions: {
      checks: { invalidAnnotation: false },
    },
  },
  plugins: [
    react(),
    istanbul({
      requireEnv: false,
      nycrcPath: "./.nycrc.json",
      // Instrument the source so e2e runs can collect coverage. The openmap.lt
      // Docker image sets MAPUTNIK_INSTRUMENT=false: no coverage code in production.
      forceBuildInstrument: process.env.MAPUTNIK_INSTRUMENT !== "false",
    }),
  ],
  optimizeDeps: {
    exclude: ["maplibre-gl/dist/maplibre-gl-worker.mjs"],
  },
  base: mode === "desktop" ? "/" : "/maputnik/",
  define: {
    global: "globalThis"
  },
}));
