import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

let commit = 'unknown';
try {
  commit = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {
  // Source archives may not include Git metadata.
}

export default defineConfig({
  plugins: [svelte()],
  base: process.env.GITHUB_PAGES_BASE || '/',
  define: { __BUILD_SHA__: JSON.stringify(commit) },
});
