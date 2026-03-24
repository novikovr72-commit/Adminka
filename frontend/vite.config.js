import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    /** 127.0.0.1: избегает падения Node (uv_interface_addresses) при --host 0.0.0.0 на части окружений */
    host: "127.0.0.1",
    port: 5175,
    strictPort: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }
          if (id.includes("node_modules/react-dom")) {
            return "react-vendor";
          }
          if (id.includes("node_modules/react/")) {
            return "react-vendor";
          }
          if (id.includes("xlsx")) {
            return "xlsx-vendor";
          }
          if (id.includes("prismjs")) {
            return "prism-vendor";
          }
          if (id.includes("@tanstack/react-virtual")) {
            return "virtual-vendor";
          }
          return undefined;
        }
      }
    }
  }
});
