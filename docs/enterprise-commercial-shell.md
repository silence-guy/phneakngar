# Phase C — Enterprise commercial shell (scaffold)

**Status:** Scaffold / backlog only  
**Date:** 2026-07-16  
**Honesty:** Does **not** unlock “full commercial Helio/OpenClaw parity.” Phase C is optional after Phase A–B agent-ops parity.

## Scope (backlog)

| Workstream | Intent | Not started |
| --- | --- | --- |
| Billing / seats / usage | Plans, seat limits, usage metering on overview | No schema |
| SSO / SAML / OIDC enterprise | Org IdP beyond Better Auth social OAuth | Partial consumer OAuth only |
| Data residency notes | Region / export / retention policy docs | Docs only TBD |
| Public skill marketplace | ClawHub-class registry + verify | Internal proposals only |
| Mobile companion | Approvals + notify on mobile | Desktop Tauri partial |
| Long-tail channels | WhatsApp, Signal, iMessage, Matrix, … | Five preview gateways |
| Multi-region / multi-gateway | Isolated ports/state like OpenClaw multi-instance | Single CF deploy model |
| Compliance export | Approval + send + tool audit export | Partial traces |

## Entry criteria

- Phase A control-plane commercial language allowed  
- Phase B at least two Live providers with signed ingress + real outbound staging proof  
- Security checklist for tokens/signatures/rate limits reviewed  

## Non-claims

Until a dedicated enterprise release plan exits:

- No “SOC2 ready” / “enterprise SSO” marketing  
- No seat-billing promises  
- No long-tail channel support claims  

## Next artifacts (when scheduled)

1. `plans/YYYY-MM-DD-enterprise-commercial.md` with features/showcase, designs, new deps, TODOS  
2. Additive migrations only after product design of seats/usage  
3. Separate version bump policy for enterprise flags  
