// Scoped runner compatibility only: the Next.js application bundles the
// extensionless next/server import, but native Node ESM needs next/server.js.
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === 'next/server' ? 'next/server.js' : specifier, context)
  },
})
