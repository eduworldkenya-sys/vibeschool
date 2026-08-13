// scripts/l0/extract-m-repo.js
// Contract: migration-dir + foundation tables -> { mutations: [], routines: [], routine_privileges: [] }
//
// Example:
//   node scripts/l0/extract-m-repo.js schools profiles classes subjects teacher_classes timetable_slots country_majority_ages school_members school_periods
//   node scripts/l0/extract-m-repo.js supabase/migrations schools profiles classes subjects teacher_classes timetable_slots country_majority_ages school_members school_periods
//
// Uses pgsql-parser (libpg_query-backed) so mutation and routine-authority
// detection is AST-based rather than regex-based.

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
const routines = [];
const routinePrivileges = [];
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

function unwrapNode(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const entries = Object.entries(value);
  return entries.length === 1 && entries[0][1] && typeof entries[0][1] === 'object'
    ? entries[0][1]
    : value;
}

function listNames(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => scalarName(value) || scalarName(unwrapNode(value)))
    .filter(Boolean);
}

function qualifiedRoutineName(values) {
  const names = listNames(values);
  if (names.length === 0) return undefined;
  return names.length === 1 ? `public.${names[0]}` : names.join('.');
}

function typeName(value) {
  const node = unwrapNode(value);
  const names = listNames(node?.names);
  if (names.length) return names.join('.');
  return scalarName(node) || 'unknown';
}

function routineObject(value) {
  const node = unwrapNode(value);
  const routine = qualifiedRoutineName(node?.objname || node?.objName || node?.name);
  if (!routine) return undefined;
  const argTypes = Array.isArray(node?.objargs)
    ? node.objargs.map(typeName)
    : [];
  return { routine, arg_types: argTypes };
}

function roleName(value) {
  const node = unwrapNode(value);
  const explicit = scalarName(node?.rolename) || scalarName(node?.roleName);
  if (explicit) return explicit;
  const roleType = String(node?.roletype || node?.roleType || '');
  return roleType.includes('PUBLIC') ? 'PUBLIC' : undefined;
}

function privilegeNames(values) {
  if (!Array.isArray(values) || values.length === 0) return ['ALL'];
  const names = values
    .map((value) => {
      const node = unwrapNode(value);
      return scalarName(node?.priv_name) || scalarName(node?.privName) || scalarName(node?.name);
    })
    .filter(Boolean)
    .map((value) => value.toUpperCase());
  return names.length ? names : ['ALL'];
}

function tableName(node) {
  return nestedName(node?.relation, ['RangeVar'])
    || nestedName(node?.table, ['RangeVar'])
    || nestedName(node?.RangeVar, ['RangeVar']);
}

function columnName(payload) {
  return nestedName(payload?.name, ['String'])
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

    if (tag === 'IndexStmt') {
      const table = tableName(body);
      const index = scalarName(body?.idxname) || nestedName(body?.idxname, ['String']);
      pushMutation('CREATE_INDEX', table, { index }, context.migration);
    }

    // CREATE TABLE is also represented by CreateStmt. Detect the table itself;
    // a post-baseline table must be excluded wholesale from a reconstructed baseline.
    if (tag === 'CreateStmt') {
      const table = tableName(body);
      if (table) pushMutation('CREATE_TABLE', table, {}, context.migration);
    }

    if (tag === 'CreatePolicyStmt') {
      const table = tableName(body);
      const policyValue = body?.PolicyName
        ?? body?.policyName
        ?? body?.policy_name
        ?? body?.policyname;
      const policy = scalarName(policyValue) || nestedName(policyValue, ['String']);
      pushMutation('CREATE_POLICY', table, { policy }, context.migration);
    }

    if (tag === 'CreateTrigStmt') {
      const table = tableName(body);
      const trigger = scalarName(body?.trigname) || nestedName(body?.trigname, ['String']);
      pushMutation('CREATE_TRIGGER', table, { trigger }, context.migration);
    }

    if (tag === 'CreateFunctionStmt') {
      const routine = qualifiedRoutineName(body?.funcname || body?.funcName);
      if (routine) {
        const parameters = Array.isArray(body?.parameters)
          ? body.parameters.map((value) => {
              const parameter = unwrapNode(value);
              return typeName(parameter?.argType || parameter?.argtype);
            })
          : [];
        routines.push({
          type: body?.replace ? 'CREATE_OR_REPLACE_FUNCTION' : 'CREATE_FUNCTION',
          routine,
          arg_types: parameters,
          migration: context.migration,
        });
      }
    }

    if (tag === 'GrantStmt') {
      const objectType = String(body?.objtype || body?.objType || '');
      if (objectType.includes('FUNCTION') || objectType.includes('PROCEDURE') || objectType.includes('ROUTINE')) {
        const objects = (body?.objects || [])
          .map(routineObject)
          .filter(Boolean);
        const grantees = (body?.grantees || [])
          .map(roleName)
          .filter(Boolean);
        const privileges = privilegeNames(body?.privileges);
        for (const object of objects) {
          for (const grantee of grantees) {
            for (const privilege of privileges) {
              routinePrivileges.push({
                action: body?.is_grant ? 'GRANT' : 'REVOKE',
                privilege,
                ...object,
                grantee,
                migration: context.migration,
              });
            }
          }
        }
      }
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

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

console.log(JSON.stringify({
  contract: 'm-repo-v2',
  cutoff: '20260520000000',
  migration_dir: resolve(migrationDir),
  foundation_tables: [...foundationTables],
  migrations_scanned: migrations,
  parse_errors: parseErrors,
  mutations: dedupe(mutations),
  routines: dedupe(routines),
  routine_privileges: dedupe(routinePrivileges),
}, null, 2));

if (parseErrors.length) process.exitCode = 1;
