import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "1.0.0"),
  },
  optimizeDeps: {
    include: ["@tanstack/react-query", "react", "react-dom"],
  },
  esbuild:
    mode === "production"
      ? {
          drop: ["console", "debugger"],
        }
      : undefined,
  build: {
    sourcemap: mode !== "production",
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React vendor
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          // UI component library
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-slot",
          ],
          // Animation library
          "animation-vendor": ["framer-motion"],
          // Chart library
          "chart-vendor": ["recharts"],
          // PDF/document libraries
          "document-vendor": ["jspdf"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
}));
