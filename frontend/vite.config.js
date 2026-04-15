import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@kazakhmys-docs": path.resolve(__dirname, "../cursor/docs/Казахстан")
    }
  },
  server: {
    /** 127.0.0.1: избегает падения Node (uv_interface_addresses) при --host 0.0.0.0 на части окружений */
    host: "127.0.0.1",
    port: 5175,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname, "..")]
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        miningDashboard: path.resolve(__dirname, "mining-dashboard.html")
      },
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
          if (id.includes("echarts")) {
            return "echarts-vendor";
          }
          return undefined;
        }
      }
    }
  }
});
