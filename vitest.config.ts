import { configDefaults, defineConfig } from 'vitest/config';

// Node 25+/26 exposes an experimental global `localStorage` getter returning `undefined`
// unless `--localstorage-file` is passed, causing Vitest's jsdom `populateGlobal` to skip
// copying `jsdom.window.localStorage`. Disabling it restores standard jsdom WebStorage.
const nodeFlags = process.allowedNodeEnvironmentFlags?.has('--no-experimental-webstorage')
  ? ['--no-experimental-webstorage']
  : [];

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: [...configDefaults.exclude, '.worktrees/**', '**/.worktrees/**', 'dist/**'],
    ...(nodeFlags.length > 0
      ? {
          poolOptions: {
            forks: { execArgv: nodeFlags },
          },
        }
      : {}),
  },
});
