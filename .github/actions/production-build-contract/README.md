# Production Build Contract Action

This local composite action is the single CI authority for VibeSchool's production-build runtime.

Callers may supply a `prebuild_command` for domain-specific certification after dependencies are installed and before the production build. The action itself owns Node.js setup, exact dependency installation, build memory, Next.js telemetry, Supabase public build configuration, and `npm run build`.

Do not copy this configuration back into workflow YAML. The repository drift guard intentionally rejects direct production-build commands in `.github/workflows`.
