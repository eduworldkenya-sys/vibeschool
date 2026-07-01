PATH = "app/teacher/lessonnotes/page.tsx"

with open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

OLD_1 = '''      tidRef.current = user.id;
      sidRef.current = sid;

      await loadNotes(user.id, sid);
    } catch (e: unknown) {'''

NEW_1 = '''      tidRef.current = user.id;
      sidRef.current = sid;

      await loadNotes(user.id, sid);

      if (searchParams.get("planId")) {
        await openNew();
      }
    } catch (e: unknown) {'''

assert OLD_1 in src, "Patch 1 anchor not found."
assert src.count(OLD_1) == 1, "Patch 1 anchor not unique."
src = src.replace(OLD_1, NEW_1, 1)

OLD_2 = '''        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px", paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))", background: "#fff", borderTop: "1px solid #e5e7eb", zIndex: 50 }}>'''

NEW_2 = '''        <div style={{ position: "fixed", bottom: "calc(64px + env(safe-area-inset-bottom, 0px))", left: 0, right: 0, padding: "12px 16px", background: "#fff", borderTop: "1px solid #e5e7eb", zIndex: 720, boxShadow: "0 -2px 8px rgba(0,0,0,0.06)" }}>'''

assert OLD_2 in src, "Patch 2 anchor not found."
assert src.count(OLD_2) == 1, "Patch 2 anchor not unique."
src = src.replace(OLD_2, NEW_2, 1)

OLD_3A = '''            <button onClick={() => setConfirmDelete(note.id)} disabled={deleting} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1.5px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontSize: 14, fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1, fontFamily: "inherit" }}>
              {deleting ? "Deleting…" : "🗑 Delete"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Delete Note?</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>This cannot be undone.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmDeleteNote} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}'''

NEW_3A = '''            <button onClick={() => setConfirmDelete(note.id)} disabled={deleting} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1.5px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontSize: 14, fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1, fontFamily: "inherit" }}>
              {deleting ? "Deleting…" : "🗑 Delete"}
            </button>
          </div>
        </div>
        {confirmDelete && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Delete Note?</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>This cannot be undone.</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button onClick={confirmDeleteNote} disabled={deleting} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: deleting ? '#9ca3af' : '#ef4444', color: '#fff', fontWeight: 700, fontSize: 13, cursor: deleting ? 'not-allowed' : 'pointer' }}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}'''

assert OLD_3A in src, "Patch 3 anchor not found."
assert src.count(OLD_3A) == 1, "Patch 3 anchor not unique."
src = src.replace(OLD_3A, NEW_3A, 1)

def balance(s):
    return (s.count("(") - s.count(")"), s.count("{") - s.count("}"), s.count("[") - s.count("]"))

with open(PATH, "r", encoding="utf-8") as f:
    original = f.read()

if balance(original) != balance(src):
    raise SystemExit(f"Balance check FAILED: original={balance(original)} new={balance(src)}. Aborting write.")

with open(PATH, "w", encoding="utf-8") as f:
    f.write(src)

print("Patched app/teacher/lessonnotes/page.tsx:")
print("  1. Mark-as-Taught / week deep-link now auto-opens pre-filled new note")
print("  2. Save button bar moved above the global bottom nav (was hidden behind it)")
print("  3. Delete confirmation modal now actually renders (was unreachable dead code)")
print("Balance check OK. Ready for vibe-push.sh.")
