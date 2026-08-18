# VibeSchool School Trust Pack

## Purpose

Marketing trust says "we take security seriously." Procurement-grade trust tells a school what is currently available, what is still under validation, what evidence exists and what must be contractually resolved before dependence.

The public Trust Pack uses the same product vocabulary as the wider public site: **Available / Validation / Planned**.

## Trust domains

- public/private data separation;
- identity and authorization;
- teacher/school assignment authority;
- child-data privacy;
- retention and deletion;
- AI and automation boundaries;
- incident route;
- migration;
- offline/field reliability;
- institutional pricing and SLA.

## Certification rule

Schema presence, a migration, a passing unit test or a security principle does not automatically equal complete production certification. In particular, VibeSchool must not market the full learner → teacher → family → school authorization graph as end-to-end certified while that matrix remains under active certification.

Where the evidence is incomplete, status stays **Validation**.

## Procurement use

A school can print/save `/trust/schools` and use its due-diligence checklist during evaluation. The pack links outward to current ODPC and PPRA authority surfaces because procurement and privacy review cannot be replaced by vendor marketing.

## Deployment sign-off questions

Before a pilot becomes operational dependence, resolve:

1. identity and relationship creation/removal;
2. cross-role/cross-school adversarial access tests;
3. required learner/staff/family data and lawful purpose;
4. retention, correction, deletion and exit handling;
5. automation/AI scope and human review;
6. migration source and reconciliation;
7. device, connectivity and offline acceptance tests;
8. support, incident escalation and contractual SLA;
9. commercial scope and renewal/change rules.

## Maintenance

`config/school-trust-pack.json` is the public status source for the Trust Pack. Status changes require evidence and review; they should never be upgraded purely because a sales conversation needs a stronger answer.
