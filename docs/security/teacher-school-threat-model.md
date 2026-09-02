# Teacher-school claim threat model

Protected asset: tenant-scoped school authority.

Threats: a teacher self-assigns to another school; a directory match creates authority without canonical resolution; a teacher reads another teacher's claim; an unauthorized reviewer approves a claim; a legacy client bypasses governance.

Controls: selection RPCs create claims only; claim RLS is own-row; approval requires platform-owner or resolved-school-admin authority; approval requires canonical school resolution; membership creation exists only in the approval path; legacy RPCs delegate to claim submission; #638 independently requires verified membership before class assignment.
