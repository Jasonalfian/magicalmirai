import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Vite config — includes polyfills needed by textalive-app-api (CommonJS package)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    global: "globalThis",
    "process.env": {},
  },
  optimizeDeps: {
    include: ["textalive-app-api"],
  },
});
