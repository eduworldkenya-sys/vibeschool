# Governed teacher-school authority

A teacher selecting a school is a claim, not authorization. School-scoped authority is established only by an approved `school_members` row. Claims are teacher-readable under RLS and can be approved only by the platform owner or an administrator of the resolved canonical school. Legacy connection RPCs are retained as compatibility wrappers but now create claims instead of memberships. Class setup remains downstream of verified membership and is handled by the current Teacher Class Self Service contract.
