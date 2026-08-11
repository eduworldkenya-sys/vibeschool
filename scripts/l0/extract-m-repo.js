// scripts/l0/extract-m-repo.js
// Contract: migration-dir + foundation tables -> { mutations: [] }
//
// Example:
//   node scripts/l0/extract-m-repo.js schools profiles classes subjects teacher_classes timetable_slots
//   node scripts/l0/extract-m-repo.js supabase/migrations schools profiles classes subjects teacher_classes timetable_slots
//
// Uses pgsql-parser (libpg_query-backed) so mutation detection is AST-based rather than regex-based.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'pgsql-parser';

const args = process.argv.slice(2);
const migrationDir = args[0]?.includes('/') || args[0]?.endsWith('migrations')
  ? args.shift()
  : 'supabase/migrations';
const foundationTables = new Set(args.map((name) => name.replace(/^public\./i, '')));

if (foundationTables.size === 0) {
  console.error('Usage: node scripts/l0/extract-m-repo.js [migration-dir] <foundation_table>...');
  process.exit(2);
}

const mutations = [];
const parseErrors = [];

function scalarName(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return undefined;
  return value.relname || value.relName || value.str || value.name || value.Name || value.sval;
}

function nestedName(value, keys) {
  const direct = scalarName(value);
  if (direct) return direct;
  if (!value || typeof value !== 'object') return undefined;
  for (const key of keys) {
    const nested = value[key];
    const name = scalarName(nested);
    if (name) return name;
  }
  return undefined;
}

function tableName(node) {
  return nestedName(node?.relation, ['RangeVar'])
    || nestedName(node?.table, ['RangeVar'])
    || nestedName(node?.RangeVar, ['RangeVar']);
}

function columnName(payload) {
  return nestedName(payload?.name, ['String'])
    || nestedName(payload?.def, ['ColumnDef'])
    || scalarName(payload?.def?.ColumnDef?.colname)
    || scalarName(payload?.def?.colname);
}

function constraintName(payload) {
  return nestedName(payload?.name, ['String'])
    || scalarName(payload?.def?.Constraint?.conname)
    || scalarName(payload?.def?.conname);
}

function pushMutation(type, table, extra, migration) {
  if (!table || !foundationTables.has(table)) return;
  mutations.push({ type, table: `public.${table}`, ...extra, migration });
}

function walk(node, context) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, context);
    return;
  }

  for (const [tag, body] of Object.entries(node)) {
    if (!body || typeof body !== 'object') continue;

    if (tag === 'AlterTableStmt') {
      const table = tableName(body);
      for (const wrappedCmd of body.cmds ?? []) {
        const payload = wrappedCmd?.AlterTableCmd ?? wrappedCmd;
        const subtype = payload?.subtype;
        const column = columnName(payload);
        const constraint = constraintName(payload);

        switch (subtype) {
          case 'AT_AddColumn':
            pushMutation('ADD_COLUMN', table, { column }, context.migration);
            break;
          case 'AT_AddConstraint':
            pushMutation('ADD_CONSTRAINT', table, { constraint }, context.migration);
            break;
          case 'AT_DropColumn':
            pushMutation('DROP_COLUMN', table, { column }, context.migration);
            break;
          case 'AT_DropConstraint':
            pushMutation('DROP_CONSTRAINT', table, { constraint }, context.migration);
            break;
          case 'AT_AlterColumnType':
            pushMutation('ALTER_COLUMN_TYPE', table, { column }, context.migration);
            break;
          case 'AT_SetNotNull':
            pushMutation('SET_NOT_NULL', table, { column }, context.migration);
            break;
          case 'AT_DropNotNull':
            pushMutation('DROP_NOT_NULL', table, { column }, context.migration);
            break;
          case 'AT_ColumnDefault':
          case 'AT_SetDefault':
            pushMutation('SET_DEFAULT', table, { column }, context.migration);
            break;
          case 'AT_ValidateConstraint':
            pushMutation('VALIDATE_CONSTRAINT', table, { constraint }, context.migration);
            break;
          case 'AT_EnableRowSecurity':
            pushMutation('ENABLE_RLS', table, {}, context.migration);
            break;
          case 'AT_DisableRowSecurity':
            pushMutation('DISABLE_RLS', table, {}, context.migration);
            break;
          case 'AT_ForceRowSecurity':
            pushMutation('FORCE_RLS', table, {}, context.migration);
            break;
          case 'AT_NoForceRowSecurity':
            pushMutation('NO_FORCE_RLS', table, {}, context.migration);
            break;
        }
      }
    }

    // CREATE INDEX is represented by IndexStmt in libpg_query/pgsql-parser,
    // not CreateStmt. Keep both forms for parser-version compatibility.
    if (tag === 'IndexStmt') {
      const table = tableName(body);
      const index = scalarName(body?.idxname) || nestedName(body?.idxname, ['String']);
      pushMutation('CREATE_INDEX', table, { index }, context.migration);
    }

    if (tag === 'CreateStmt') {
      const table = tableName(body);
      const index = scalarName(body?.idxname);
      if (index) pushMutation('CREATE_INDEX', table, { index }, context.migration);
    }

    if (tag === 'CreatePolicyStmt') {
      const table = tableName(body);
      const policy = scalarName(body?.policyname) || nestedName(body?.policyname, ['String']);
      pushMutation('CREATE_POLICY', table, { policy }, context.migration);
    }

    if (tag === 'CreateTrigStmt') {
      const table = tableName(body);
      const trigger = scalarName(body?.trigname) || nestedName(body?.trigname, ['String']);
      pushMutation('CREATE_TRIGGER', table, { trigger }, context.migration);
    }

    walk(body, context);
  }
}

const migrations = readdirSync(resolve(migrationDir))
  .filter((file) => file.endsWith('.sql') && file.slice(0, 14) > '20260520000000')
  .sort();

for (const migration of migrations) {
  const sql = readFileSync(resolve(migrationDir, migration), 'utf8');
  try {
    const tree = await parse(sql);
    walk(tree, { migration });
  } catch (error) {
    parseErrors.push({
      migration,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Deduplicate exact AST hits while preserving migration order.
const seen = new Set();
const uniqueMutations = mutations.filter((mutation) => {
  const key = JSON.stringify(mutation);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log(JSON.stringify({
  contract: 'm-repo-v1',
  cutoff: '20260520000000',
  migration_dir: resolve(migrationDir),
  foundation_tables: [...foundationTables],
  migrations_scanned: migrations,
  parse_errors: parseErrors,
  mutations: uniqueMutations,
}, null, 2));

if (parseErrors.length) process.exitCode = 1;
