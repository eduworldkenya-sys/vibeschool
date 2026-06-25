fixes = [
    (
        '/data/data/com.termux/files/home/vibeschool/app/teacher/classhub/[id]/page.tsx',
        "if (err || !studentId) { setSaving(false); setError(err?.message ?? 'Failed to add student — no ID returned'); alert('RPC error: ' + (err?.message ?? 'no studentId returned')); return }",
        "if (err || !studentId) { setSaving(false); setError(err?.message ?? 'Failed to add student — no ID returned'); return }"
    ),
    (
        '/data/data/com.termux/files/home/vibeschool/app/teacher/resources/page.tsx',
        "if (err) { alert('Failed to delete: ' + err.message); setDeleting(null); return }",
        "if (err) { setDeleting(null); return }"
    ),
    (
        '/data/data/com.termux/files/home/vibeschool/app/parent/funhub/match/page.tsx',
        "alert('No questions found for this configuration. Loading backup dataset...');",
        "console.warn('No questions found for this configuration.');"
    ),
    (
        '/data/data/com.termux/files/home/vibeschool/app/parent/funhub/match/page.tsx',
        "alert('Insufficient valid matching data blocks present for this module config.');",
        "console.warn('Insufficient matching data blocks.');"
    ),
    (
        '/data/data/com.termux/files/home/vibeschool/app/global/read/publication/[id]/page.tsx',
        "onClick={() => isLoggedIn ? alert('M-Pesa coming soon') : router.push('/')}",
        "onClick={() => { if (!isLoggedIn) router.push('/') }}"
    ),
]

for fpath, old, new in fixes:
    try:
        with open(fpath, 'r') as f:
            src = f.read()
        if old in src:
            src = src.replace(old, new)
            with open(fpath, 'w') as f:
                f.write(src)
            print('Fixed: ' + fpath.split('/')[-1])
        else:
            print('NOT FOUND: ' + fpath.split('/')[-1] + ' | ' + old[:50])
    except FileNotFoundError:
        print('FILE NOT FOUND: ' + fpath)
print("alerts: Done")
