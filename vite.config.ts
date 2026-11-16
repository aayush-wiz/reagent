import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
// Vite serves the SPA in dev; /api/* is proxied to the Hono backend on :8181.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Fixed port from ports.env; strictPort so it FAILS instead of drifting to
    // 5174 (which left a stale bundle on 5173). scripts/dev.sh frees it first.
    port: Number(process.env.WEB_PORT) || 5173,
    strictPort: true,
    proxy: {
      // ws:true so the run WebSocket (/api/runs/:id/ws) is proxied too.
      "/api": { target: `http://localhost:${Number(process.env.API_PORT) || 8181}`, ws: true },
    },
  },
});
