# Teacher OS manual backup and recovery procedure

Use a **consistent PostgreSQL logical dump, encrypted at capture**, followed by a restore rehearsal in an isolated compatible target. This works independently of automatic daily backups and does not require the failing Supabase Management API token. No connected backup or production restore has been performed by this work.

The supplied capture helper is `scripts/teacher-os-backup-readonly.py`. It only reads the source: it enforces read-only transactions, holds an exported repeatable-read snapshot, captures all database schemas/data without RLS-filtered export, and captures global roles without their login passwords. It streams both exports directly to GPG and records SHA-256 checksums and table counts. It never restores a database, changes RLS/grants, or prints database credentials/query data.

## Prepare the source connection securely

1. In the Supabase dashboard's **Connect** panel, use the **Session pooler on port 5432** when working from an IPv4 environment. Use the direct connection only when its network path is supported. Do not use the transaction pooler for this operation. Copy the actual host/username from this project's panel; do not guess its region.
2. Configure `PGHOST`, `PGPORT`, `PGDATABASE` and `PGUSER` in secure environment settings. Supply the existing database password through a secure `PGPASSWORD` binding or a private `PGPASSFILE` with mode `600`. Do not put a password-bearing URL in shell commands, CLI flags, chat, saved setup scripts, Git, screenshots or logs. Do not reset the database password as part of this procedure.
3. Install PostgreSQL client tools compatible with the source server (the capture helper rejects an older dump client). For TCP the helper forces `PGSSLMODE=verify-full`. libpq 17+ can use `PGSSLROOTCERT=system`; if the server requires its documented CA, configure that verified CA file instead. Resolve certificate errors rather than downgrading verification.
4. Supply `BACKUP_GPG_RECIPIENT` as the verified **full public-key fingerprint** of an available trusted GPG encryption key. Confirm its fingerprint with the backup owner through a trusted channel. The matching private key and any unlock secret must be available separately for recovery. Do not copy them into the repository or publish them with the backup.

Coordinate a quiet backup window before write tests: no schema/role changes, app write tests or uploads during capture. The exported snapshot keeps database tables consistent; global roles and external Storage need their own consistent inventory. Do not stop or reconfigure unrelated production services automatically.

## Capture

Run on a trusted machine where those secure bindings and native PostgreSQL/GPG tools are available:

```bash
umask 077
mkdir -p /workspace-private/vibeschool-backups
chmod 700 /workspace-private/vibeschool-backups
python3 scripts/teacher-os-backup-readonly.py \
  --output-dir /workspace-private/vibeschool-backups
```

Choose a private writable path on that machine **outside the checkout and shared artifact directories**. In this cloud environment, `/workspace/.vibeschool-private-backups` is an appropriate private working directory if its mode is `700`; it is not durable off-machine storage.

Each successful capture creates a unique directory containing:

- `database.dump.gpg`: encrypted full custom-format database archive, including readable `auth`, `storage`, application schemas and migration history.
- `globals.sql.gpg`: encrypted global-role definitions/grants. Database login passwords are deliberately omitted; provision isolated-target login credentials separately.
- `manifest.json`: private source fingerprint, client/server versions, extensions, per-table snapshot counts, encrypted-artifact hashes and unresolved recovery requirements. No database password or record contents.

Permission, encryption, snapshot or dump failures abort capture and remove incomplete artifacts. Do not add `--enable-row-security`, exclude a failed schema or ignore an error to manufacture a “complete” backup. Foreign-table **contents** are not part of a normal dump and require a separate approved export if present. Move encrypted artifacts and their manifest to owner-controlled durable backup storage; verify their hashes after transfer. Do not publish the exports or include them in the app's Git history.

## Complete the project backup

A database archive is not a complete Supabase project backup:

- Export **Storage binary objects** separately through an authorized read-only export. `storage.objects` contains metadata, not file contents. Inventory every bucket/object represented by the snapshot, retain object bytes and checksums in encrypted durable storage, and compare the exported inventory with the database. A teacher login alone may not have access to every object; do not weaken policies to obtain them.
- Preserve deployed project configuration, Auth settings, redirect URLs, Edge Function source and necessary secrets through the owner's secure configuration/vault process. Database migrations in this repository do not establish deployed-schema parity.
- If Vault/pgsodium or encrypted columns are used, preserve the required encryption root key through the provider's supported secure administrative process. A SQL dump does not contain that key. The current rejected Management API token must not be retried to obtain it. Until the key can be recovered and restored data decrypted, that recovery scope is unverified.

Supabase's CLI is an alternative supported migration tool, but its default dumps treat managed schemas specially. Its role/schema/data exports, managed-schema customizations and migration history must be reconciled explicitly. Do not substitute three CLI files for a verified complete backup, or pass credential-bearing `--db-url` arguments in this shared environment.

## Verify recovery before connected writes

Use a **new disposable compatible Supabase/local target**, never the source project. Restore commands may overwrite target objects and are therefore limited to that isolated target. Before restoring any real project archive:

1. Confirm source and target identities differ, target permissions are authorized, and the target has no unrelated data.
2. Prevent outbound mail, SMS, M-Pesa, webhooks and other external calls. Keep workers, schedulers and cron jobs inactive; restoring scheduler/queue rows must not activate them. Use network isolation in a local rehearsal.
3. Check hashes, decrypt with the owner's recovery key, and list the PostgreSQL archive successfully. Restore global/application ownership and the complete archive into the compatible target with errors treated as failures. Managed roles/extensions may require Supabase's supported target scaffolding; inspect conflicts rather than suppressing them.
4. Compare all source-snapshot table counts and verify functions, indexes, constraints, RLS policies, grants, migration history, Auth records, Storage metadata/files and encryption recovery. Exercise representative teacher reads on the clone and unauthorized cross-school denial. Do not send real external notifications during those checks.
5. Record the exact source snapshot/time, encrypted artifact checksums, durable storage location, recovery-key custodian, target identity/version, restore results and any exclusions. Mark `recoverability_verified` only after these checks succeed for the **actual connected project**.

The isolated synthetic rehearsal of this helper is evidence about the procedure. It does not prove a VibeSchool production backup exists. Until the connected capture and restoration are verified, keep connected write testing paused and do not perform destructive production operations.

Run `python3 scripts/test-teacher-os-backup-readonly.py` with Docker, Python 3 and GPG installed to repeat the rehearsal. It uses a digest-pinned PostgreSQL image, two temporary containers with networking disabled, and disposable synthetic encryption keys. It verifies complete table counts, restored roles/functions/RLS, cross-school denial, encrypted private artifacts, source read-only enforcement and failed-capture cleanup. It removes only its own containers. No production credentials are used. The same rehearsal runs in the dedicated pull-request workflow.

## Sources

- [Supabase: Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase: Database backups and Storage limitations](https://supabase.com/docs/guides/platform/backups)
- [PostgreSQL: pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html)
- [PostgreSQL: TLS connection verification](https://www.postgresql.org/docs/17/libpq-ssl.html)
