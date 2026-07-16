import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tanstackStart({
      server: { entry: "server" },
      router: {
        routeFileIgnorePattern: "\\.functions\\.ts$",
      },
    }),
    netlify(),
    react(),
    tailwindcss(),
  ],
});
