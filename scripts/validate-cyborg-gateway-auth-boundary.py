from pathlib import Path

repo = Path(__file__).resolve().parents[1]
gateway = (repo / "supabase/functions/cyborg-llm-gateway/index.ts").read_text()
deploy = (repo / "scripts/deploy-cyborg-llm-gateway.sh").read_text()

errors: list[str] = []

if "authorization')??''" not in gateway and 'authorization")??""' not in gateway:
    errors.append("gateway must inspect the Authorization header itself")
if "Cyborg " not in gateway:
    errors.append("gateway must require the signed Cyborg capability scheme")
if "verifyCapability(" not in gateway:
    errors.append("gateway must verify signed capabilities in-function")
if "--no-verify-jwt" not in deploy:
    errors.append("gateway deploy must disable Supabase JWT verification")
if "cyborg-llm-gateway" not in deploy:
    errors.append("deployment script must target cyborg-llm-gateway")

if errors:
    raise SystemExit("\n".join(f"FAIL: {error}" for error in errors))

print("PASS: Cyborg gateway custom capability auth boundary is deployment-safe")
