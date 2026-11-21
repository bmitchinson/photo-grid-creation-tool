import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
export default defineConfig({ plugins: [svelte()], server: { allowedHosts: ['127.0.0.1.sslip.io'] } });
