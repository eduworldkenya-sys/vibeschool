#!/usr/bin/env python3
from pathlib import Path

gateway = Path("supabase/functions/cyborg-llm-gateway/index.ts").read_text()
client = Path("supabase/functions/_shared/cyborg-model-client.ts").read_text()
chemistry = Path("supabase/functions/chemistry-stage-executor/index.ts").read_text()

gateway_invariants = [
    "class ProviderFailure",
    "providerErrorDetails(",
    "status===413?'capacity'",
    "status===429?'rate_limit'",
    "attempt<=2",
    "retryAfterMs",
    "providerCode",
    "retryable",
]
client_invariants = [
    "class CyborgGatewayError",
    "invokeCyborgEdgeModelWithFallback",
    "details.category === 'capacity'",
    "fallback: index > 0",
]
chemistry_invariants = [
    '"llama-3.3-70b-versatile"',
    '"openai/gpt-oss-120b"',
    "invokeCyborgEdgeModelWithFallback",
    "maxTokens:2800",
    "text(g.lineage.model)||MODEL",
]

for label, source, required in [
    ("gateway", gateway, gateway_invariants),
    ("client", client, client_invariants),
    ("chemistry", chemistry, chemistry_invariants),
]:
    missing = [value for value in required if value not in source]
    if missing:
        raise SystemExit(f"{label} provider reliability invariants missing: {missing}")

if "GROQ_API_KEY" in chemistry or "api.groq.com" in chemistry:
    raise SystemExit("Chemistry contains a direct Groq credential/provider integration")

print("Cyborg provider diagnostics, retry, fallback and Chemistry route: PASS")
