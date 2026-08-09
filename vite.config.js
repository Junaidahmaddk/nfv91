import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./", // KRITISK: relative stier — virker på GitHub Pages (/repo-navn/) og enhver anden host
  plugins: [react()],
  server: { port: 5180 },
});
