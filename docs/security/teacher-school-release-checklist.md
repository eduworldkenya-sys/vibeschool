# Release checklist

- Branch starts from exact main `164a98ea97bb38e459a3f04dd869440becf718c6`.
- School selection cannot directly insert `school_members`.
- Claims use RLS and own-row read policy.
- Review requires platform owner or canonical-school administrator.
- Approval is the only membership write in this migration.
- Existing connection RPC names remain compatible.
- Teacher class self-service remains membership-gated by #638.
- Production migration must be applied only after repository merge/certification.
