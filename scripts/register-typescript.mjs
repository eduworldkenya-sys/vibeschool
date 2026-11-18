// Preserve canonical Node 20 CI and newer local runtimes.
import * as moduleApi from 'node:module';
if (typeof moduleApi.registerHooks === 'function') {
  const {resolveSync, load} = await import('./typescript-loader-hooks.mjs');
  moduleApi.registerHooks({resolve:resolveSync, load});
} else {
  moduleApi.register('./typescript-loader-hooks.mjs', import.meta.url);
}
