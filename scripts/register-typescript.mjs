// Keep the canonical Node 20 CI runtime and support newer local runtimes.
// Node 20 has module.register but not module.registerHooks.
import * as moduleApi from 'node:module';
if (typeof moduleApi.registerHooks === 'function') {
  const { resolve, load } = await import('./typescript-loader-hooks.mjs');
  moduleApi.registerHooks({resolve, load});
} else {
  moduleApi.register('./typescript-loader-hooks.mjs', import.meta.url);
}
