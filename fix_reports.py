import re, os

files = [
    "app/admin/reports/page.tsx",
    "app/admin/reports/academic/page.tsx",
    "app/admin/reports/attendance/page.tsx",
    "app/admin/reports/finance/page.tsx",
    "app/admin/reports/staff/page.tsx",
    "app/admin/reports/students/page.tsx",
    "app/admin/reports/operational/page.tsx",
    "app/admin/reports/system/page.tsx",
]

# className string → style object replacements
replacements = [
    # Layout wrappers
    (r'className="min-h-screen bg-\[#0f172a\] text-white"',
     'style={{minHeight:"100vh",background:"#0f172a",color:"#f1f5f9"}}'),

    (r'className="bg-\[#1e293b\] border-b border-slate-700 px-4 py-4 sticky top-0 z-10"',
     'style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"16px",position:"sticky",top:0,zIndex:10}}'),

    (r'className="max-w-2xl mx-auto"',
     'style={{maxWidth:"672px",margin:"0 auto"}}'),

    (r'className="max-w-2xl mx-auto flex items-center gap-3"',
     'style={{maxWidth:"672px",margin:"0 auto",display:"flex",alignItems:"center",gap:"12px"}}'),

    (r'className="max-w-2xl mx-auto px-4 py-5 space-y-5"',
     'style={{maxWidth:"672px",margin:"0 auto",padding:"20px 16px",display:"flex",flexDirection:"column",gap:"20px"}}'),

    (r'className="max-w-2xl mx-auto px-4 py-6 space-y-6"',
     'style={{maxWidth:"672px",margin:"0 auto",padding:"24px 16px",display:"flex",flexDirection:"column",gap:"24px"}}'),

    # Back link
    (r'className="text-slate-400 hover:text-white text-xl"',
     'style={{color:"#94a3b8",fontSize:"20px",textDecoration:"none"}}'),

    # Headings
    (r'className="text-lg font-bold"',
     'style={{fontSize:"18px",fontWeight:700,margin:0}}'),

    (r'className="text-xl font-bold text-white"',
     'style={{fontSize:"20px",fontWeight:700,color:"#f1f5f9",margin:0}}'),

    (r'className="flex-1"',
     'style={{flex:1}}'),

    (r'className="text-xs text-slate-400"',
     'style={{fontSize:"11px",color:"#94a3b8",margin:0}}'),

    (r'className="text-xs text-slate-500"',
     'style={{fontSize:"11px",color:"#64748b",margin:0}}'),

    (r'className="text-xs text-slate-300"',
     'style={{fontSize:"11px",color:"#cbd5e1"}}'),

    (r'className="text-sm text-slate-400"',
     'style={{fontSize:"13px",color:"#94a3b8",margin:0}}'),

    (r'className="text-white font-medium"',
     'style={{color:"#f1f5f9",fontWeight:500}}'),

    (r'className="text-sm font-semibold text-white"',
     'style={{fontSize:"13px",fontWeight:600,color:"#f1f5f9",margin:0}}'),

    # Cards
    (r'className="bg-\[#1e293b\] rounded-xl p-4 border border-slate-700"',
     'style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155"}}'),

    (r'className="bg-\[#1e293b\] rounded-xl p-3 text-center border border-slate-700"',
     'style={{background:"#1e293b",borderRadius:"12px",padding:"12px",border:"1px solid #334155",textAlign:"center"}}'),

    (r'className="bg-\[#1e293b\] rounded-xl border border-slate-700 overflow-hidden"',
     'style={{background:"#1e293b",borderRadius:"12px",border:"1px solid #334155",overflow:"hidden"}}'),

    # KPI numbers
    (r'className="text-2xl font-bold text-blue-400"',
     'style={{fontSize:"24px",fontWeight:800,color:"#38bdf8",margin:0}}'),
    (r'className="text-2xl font-bold text-green-400"',
     'style={{fontSize:"24px",fontWeight:800,color:"#10b981",margin:0}}'),
    (r'className="text-2xl font-bold text-yellow-400"',
     'style={{fontSize:"24px",fontWeight:800,color:"#f59e0b",margin:0}}'),
    (r'className="text-2xl font-bold text-red-400"',
     'style={{fontSize:"24px",fontWeight:800,color:"#ef4444",margin:0}}'),
    (r'className="text-2xl font-bold text-purple-400"',
     'style={{fontSize:"24px",fontWeight:800,color:"#8b5cf6",margin:0}}'),
    (r'className="text-2xl font-bold text-pink-400"',
     'style={{fontSize:"24px",fontWeight:800,color:"#ec4899",margin:0}}'),
    (r'className="text-2xl font-bold text-cyan-400"',
     'style={{fontSize:"24px",fontWeight:800,color:"#06b6d4",margin:0}}'),
    (r'className="text-2xl font-bold text-fuchsia-400"',
     'style={{fontSize:"24px",fontWeight:800,color:"#d946ef",margin:0}}'),
    (r'className="text-lg font-bold text-blue-400"',
     'style={{fontSize:"18px",fontWeight:800,color:"#38bdf8",margin:0}}'),
    (r'className="text-lg font-bold text-green-400"',
     'style={{fontSize:"18px",fontWeight:800,color:"#10b981",margin:0}}'),
    (r'className="text-lg font-bold text-red-400"',
     'style={{fontSize:"18px",fontWeight:800,color:"#ef4444",margin:0}}'),
    (r'className="text-lg font-bold text-yellow-400"',
     'style={{fontSize:"18px",fontWeight:800,color:"#f59e0b",margin:0}}'),

    # KPI label
    (r'className="text-xs text-slate-400 mt-1"',
     'style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}'),
    (r'className="text-xs text-slate-400 mt-0\.5"',
     'style={{fontSize:"11px",color:"#94a3b8",marginTop:"2px"}}'),
    (r'className="text-xs text-slate-500 mt-0\.5"',
     'style={{fontSize:"11px",color:"#64748b",marginTop:"2px"}}'),

    # Grid
    (r'className="grid grid-cols-2 gap-3"',
     'style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}'),
    (r'className="grid grid-cols-3 gap-3"',
     'style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px"}}'),

    # Insight banner
    (r'className="bg-amber-900/40 border border-amber-600/50 rounded-xl px-4 py-3 flex gap-3 items-start"',
     'style={{background:"rgba(120,53,15,0.4)",border:"1px solid rgba(217,119,6,0.5)",borderRadius:"12px",padding:"12px 16px",display:"flex",gap:"12px",alignItems:"flex-start"}}'),
    (r'className="text-xl"',
     'style={{fontSize:"20px"}}'),
    (r'className="text-sm text-amber-200"',
     'style={{fontSize:"13px",color:"#fde68a",margin:0}}'),

    # Filters box
    (r'className="bg-\[#1e293b\] rounded-xl p-4 border border-slate-700 space-y-3"',
     'style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155",display:"flex",flexDirection:"column",gap:"12px"}}'),
    (r'className="text-xs font-semibold text-slate-400 uppercase tracking-wider"',
     'style={{fontSize:"11px",fontWeight:600,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.8px",margin:0}}'),

    # Selects / inputs
    (r'className="w-full bg-\[#0f172a\] border border-slate-600 rounded-lg px-3 py-2\.5 text-sm text-white focus:outline-none focus:border-blue-500"',
     'style={{width:"100%",background:"#0f172a",border:"1px solid #475569",borderRadius:"8px",padding:"10px 12px",fontSize:"13px",color:"#f1f5f9",outline:"none"}}'),
    (r'className="w-full bg-\[#0f172a\] border border-slate-600 rounded-xl px-4 py-2\.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"',
     'style={{width:"100%",background:"#0f172a",border:"1px solid #475569",borderRadius:"12px",padding:"10px 16px",fontSize:"13px",color:"#f1f5f9",outline:"none"}}'),
    (r'className="w-full bg-\[#1e293b\] border border-slate-600 rounded-xl px-4 py-2\.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"',
     'style={{width:"100%",background:"#1e293b",border:"1px solid #475569",borderRadius:"12px",padding:"10px 16px",fontSize:"13px",color:"#f1f5f9",outline:"none"}}'),
    (r'className="w-full bg-\[#1e293b\] border border-slate-600 rounded-xl px-4 py-2\.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"',
     'style={{width:"100%",background:"#1e293b",border:"1px solid #475569",borderRadius:"12px",padding:"10px 16px",fontSize:"13px",color:"#f1f5f9",outline:"none"}}'),
    (r'className="w-full bg-\[#1e293b\] border border-slate-600 rounded-xl px-4 py-2\.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"',
     'style={{width:"100%",background:"#1e293b",border:"1px solid #475569",borderRadius:"12px",padding:"10px 16px",fontSize:"13px",color:"#f1f5f9",outline:"none"}}'),
    (r'className="w-full bg-\[#1e293b\] border border-slate-600 rounded-xl px-4 py-2\.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"',
     'style={{width:"100%",background:"#1e293b",border:"1px solid #475569",borderRadius:"12px",padding:"10px 16px",fontSize:"13px",color:"#f1f5f9",outline:"none"}}'),

    # Loading spinner
    (r'className="text-center py-12"',
     'style={{textAlign:"center",padding:"48px 0"}}'),
    (r'className="text-center py-16"',
     'style={{textAlign:"center",padding:"64px 0"}}'),
    (r'className="text-center py-10 text-slate-500 text-sm"',
     'style={{textAlign:"center",padding:"40px 0",color:"#64748b",fontSize:"13px"}}'),
    (r'className="animate-spin text-3xl mb-3"',
     'style={{fontSize:"30px",marginBottom:"12px"}}'),
    (r'className="text-4xl mb-3"',
     'style={{fontSize:"36px",marginBottom:"12px"}}'),

    # Table wrapper
    (r'className="px-4 py-3 border-b border-slate-700"',
     'style={{padding:"12px 16px",borderBottom:"1px solid #334155"}}'),
    (r'className="text-sm font-semibold"',
     'style={{fontSize:"13px",fontWeight:600,margin:0,color:"#f1f5f9"}}'),
    (r'className="overflow-x-auto"',
     'style={{overflowX:"auto"}}'),
    (r'className="w-full text-xs"',
     'style={{width:"100%",fontSize:"11px",borderCollapse:"collapse"}}'),
    (r'className="bg-\[#0f172a\]"',
     'style={{background:"#0f172a"}}'),

    # Table headers
    (r'className="px-3 py-2\.5 text-left text-slate-400 font-medium cursor-pointer hover:text-white"',
     'style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500,cursor:"pointer"}}'),
    (r'className="px-3 py-2\.5 text-left text-slate-400"',
     'style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500}}'),
    (r'className="px-3 py-2\.5 text-left text-slate-400 whitespace-nowrap"',
     'style={{padding:"10px 12px",textAlign:"left",color:"#94a3b8",fontWeight:500,whiteSpace:"nowrap"}}'),

    # Table rows
    (r'className="border-t border-slate-700/50 hover:bg-slate-700/20"',
     'style={{borderTop:"1px solid rgba(51,65,85,0.5)"}}'),

    # Table cells
    (r'className="px-3 py-2\.5 text-white font-medium"',
     'style={{padding:"10px 12px",color:"#f1f5f9",fontWeight:500}}'),
    (r'className="px-3 py-2\.5 text-white font-medium whitespace-nowrap"',
     'style={{padding:"10px 12px",color:"#f1f5f9",fontWeight:500,whiteSpace:"nowrap"}}'),
    (r'className="px-3 py-2\.5 text-slate-300"',
     'style={{padding:"10px 12px",color:"#cbd5e1"}}'),
    (r'className="px-3 py-2\.5 text-slate-300 whitespace-nowrap"',
     'style={{padding:"10px 12px",color:"#cbd5e1",whiteSpace:"nowrap"}}'),
    (r'className="px-3 py-2\.5 text-green-400"',
     'style={{padding:"10px 12px",color:"#10b981"}}'),
    (r'className="px-3 py-2\.5 text-red-400"',
     'style={{padding:"10px 12px",color:"#ef4444"}}'),
    (r'className="px-3 py-2\.5 font-bold"',
     'style={{padding:"10px 12px",fontWeight:700}}'),

    # Table footer
    (r'className="px-4 py-3 border-t border-slate-700 text-xs text-slate-400"',
     'style={{padding:"12px 16px",borderTop:"1px solid #334155",fontSize:"11px",color:"#94a3b8"}}'),

    # Tabs row
    (r'className="flex gap-2 overflow-x-auto pb-1"',
     'style={{display:"flex",gap:"8px",overflowX:"auto",paddingBottom:"4px"}}'),

    # Divide lists
    (r'className="divide-y divide-slate-700/50"',
     'style={{}}'),
    (r'className="px-4 py-3 hover:bg-slate-700/20"',
     'style={{padding:"12px 16px"}}'),
    (r'className="px-4 py-3 hover:bg-slate-700/20 flex items-center gap-3"',
     'style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:"12px"}}'),
    (r'className="flex items-start justify-between gap-2"',
     'style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"8px"}}'),
    (r'className="flex items-center justify-between gap-2"',
     'style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px"}}'),
    (r'className="flex items-center gap-2"',
     'style={{display:"flex",alignItems:"center",gap:"8px"}}'),
    (r'className="flex items-center gap-2 mb-2"',
     'style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}'),
    (r'className="flex-1 min-width-0"',
     'style={{flex:1,minWidth:0}}'),
    (r'className="flex-1"',
     'style={{flex:1}}'),

    # Text colours in lists
    (r'className="text-xs text-red-300 mt-0\.5"',
     'style={{fontSize:"11px",color:"#fca5a5",marginTop:"2px"}}'),
    (r'className="text-xs text-blue-300 mt-0\.5"',
     'style={{fontSize:"11px",color:"#93c5fd",marginTop:"2px"}}'),
    (r'className="text-xs text-yellow-300 mt-0\.5"',
     'style={{fontSize:"11px",color:"#fde68a",marginTop:"2px"}}'),

    # Index page categories grid
    (r'className="grid grid-cols-2 gap-3"',
     'style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}'),
    (r'className="active:scale-95 transition-transform cursor-pointer"',
     'style={{cursor:"pointer"}}'),
    (r'className="text-3xl mb-2"',
     'style={{fontSize:"30px",marginBottom:"8px"}}'),
    (r'className="font-semibold text-white text-sm"',
     'style={{fontWeight:600,color:"#f1f5f9",fontSize:"13px",margin:0}}'),
    (r'className="text-xs text-white/60 mt-0\.5"',
     'style={{fontSize:"11px",color:"rgba(255,255,255,0.6)",marginTop:"2px"}}'),

    # Progress bar
    (r'className="flex-1 bg-slate-700 rounded-full h-1\.5"',
     'style={{flex:1,background:"#334155",borderRadius:"99px",height:"6px"}}'),
    (r'className="flex items-center gap-2"',
     'style={{display:"flex",alignItems:"center",gap:"8px"}}'),
    (r'className="text-xs text-slate-400 w-8 text-right"',
     'style={{fontSize:"11px",color:"#94a3b8",width:"32px",textAlign:"right"}}'),

    # Audit action colours
    (r'className="text-xs font-bold uppercase text-green-400"',
     'style={{fontSize:"11px",fontWeight:700,textTransform:"uppercase",color:"#10b981"}}'),
    (r'className="text-xs font-bold uppercase text-red-400"',
     'style={{fontSize:"11px",fontWeight:700,textTransform:"uppercase",color:"#ef4444"}}'),
    (r'className="text-xs font-bold uppercase text-yellow-400"',
     'style={{fontSize:"11px",fontWeight:700,textTransform:"uppercase",color:"#f59e0b"}}'),
    (r'className="text-xs font-bold uppercase text-blue-400"',
     'style={{fontSize:"11px",fontWeight:700,textTransform:"uppercase",color:"#38bdf8"}}'),

    # Unread notification dot
    (r'className="w-2 h-2 rounded-full bg-blue-500 mt-1\.5 flex-shrink-0"',
     'style={{width:"8px",height:"8px",borderRadius:"50%",background:"#3b82f6",marginTop:"6px",flexShrink:0}}'),
]

# ── Dynamic class handlers (use re.sub with lambda) ───────────────────────────

def convert_gradient_card(m):
    color_map = {
        'from-blue-600 to-blue-800':   'linear-gradient(135deg,#2563eb,#1e40af)',
        'from-green-600 to-green-800': 'linear-gradient(135deg,#16a34a,#166534)',
        'from-yellow-600 to-yellow-800':'linear-gradient(135deg,#ca8a04,#854d0e)',
        'from-purple-600 to-purple-800':'linear-gradient(135deg,#9333ea,#6b21a8)',
        'from-pink-600 to-pink-800':   'linear-gradient(135deg,#db2777,#9d174d)',
        'from-orange-600 to-orange-800':'linear-gradient(135deg,#ea580c,#9a3412)',
        'from-red-600 to-red-800':     'linear-gradient(135deg,#dc2626,#991b1b)',
    }
    classes = m.group(1)
    for k, v in color_map.items():
        if k in classes:
            return f'style={{{{background:"{v}",borderRadius:"12px",padding:"16px",border:"1px solid #334155",cursor:"pointer"}}}}'
    return m.group(0)

def convert_active_tab(m):
    color_map = {
        'bg-yellow-600': '#ca8a04',
        'bg-purple-600': '#9333ea',
        'bg-pink-600':   '#db2777',
        'bg-orange-600': '#ea580c',
        'bg-red-700':    '#b91c1c',
        'bg-blue-600':   '#2563eb',
        'bg-green-600':  '#16a34a',
    }
    full = m.group(0)
    for k, v in color_map.items():
        if k in full:
            return f'style={{{{display:"flex",alignItems:"center",gap:"6px",padding:"8px 16px",borderRadius:"12px",fontSize:"13px",fontWeight:500,whiteSpace:"nowrap",background:"{v}",color:"#ffffff",border:"none",cursor:"pointer"}}}}'
    return full

def convert_inactive_tab(m):
    return 'style={{display:"flex",alignItems:"center",gap:"6px",padding:"8px 16px",borderRadius:"12px",fontSize:"13px",fontWeight:500,whiteSpace:"nowrap",background:"#1e293b",color:"#94a3b8",border:"1px solid #334155",cursor:"pointer"}}'

def convert_status_badge_class(m):
    full = m.group(0)
    mapping = {
        'bg-green-900/50 text-green-400 border border-green-700':  'background:"rgba(20,83,45,0.5)",color:"#10b981",border:"1px solid #15803d"',
        'bg-yellow-900/50 text-yellow-400 border border-yellow-700':'background:"rgba(113,63,18,0.5)",color:"#f59e0b",border:"1px solid #a16207"',
        'bg-red-900/50 text-red-400 border border-red-700':        'background:"rgba(127,29,29,0.5)",color:"#ef4444",border:"1px solid #b91c1c"',
        'bg-slate-700 text-slate-300':                             'background:"#334155",color:"#cbd5e1",border:"none"',
        'bg-slate-700 text-slate-400':                             'background:"#334155",color:"#94a3b8",border:"none"',
    }
    for k, v in mapping.items():
        if k in full:
            return f'style={{{{{v},fontSize:"11px",padding:"2px 8px",borderRadius:"99px",textTransform:"capitalize"}}}}'
    return full

def convert_grade_color(m):
    full = m.group(0)
    color_map = {
        'text-green-400': '#10b981',
        'text-yellow-400': '#f59e0b',
        'text-red-400': '#ef4444',
        'text-slate-400': '#94a3b8',
    }
    for k, v in color_map.items():
        if k in full:
            return f'style={{{{padding:"10px 12px",fontWeight:700,color:"{v}"}}}}'
    return full

def convert_progress_bar(m):
    color_map = {
        'bg-green-500': '#10b981',
        'bg-yellow-500': '#f59e0b',
        'bg-red-500': '#ef4444',
    }
    full = m.group(0)
    for k, v in color_map.items():
        if k in full:
            rest = re.search(r"style=\{\{([^}]+)\}\}", full)
            width = ''
            if rest:
                width = rest.group(1)
            return f'style={{{{background:"{v}",height:"6px",borderRadius:"99px",{width}}}}}'
    return full

def convert_unread_notif(m):
    full = m.group(0)
    if 'border-l-2 border-blue-500' in full:
        return 'style={{padding:"12px 16px",borderLeft:"2px solid #3b82f6"}}'
    return 'style={{padding:"12px 16px"}}'

def process_file(path):
    if not os.path.exists(path):
        print(f"SKIP (not found): {path}")
        return

    with open(path, 'r') as f:
        content = f.read()

    original = content

    # Static replacements
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)

    # Dynamic: gradient category cards
    content = re.sub(
        r'className=\{`bg-gradient-to-br \$\{cat\.color\} rounded-xl p-4 border border-slate-700 active:scale-95 transition-transform cursor-pointer`\}',
        'style={{background:"linear-gradient(135deg,#1e3a5f,#0f172a)",borderRadius:"12px",padding:"16px",border:"1px solid #334155",cursor:"pointer"}}',
        content
    )

    # Dynamic: active tab (template literal with ternary)
    content = re.sub(
        r'className=\{`flex items-center gap-1\.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors \$\{[^}]+\? \'(bg-\w+-\d+) text-white\'[^}]+\}`\}',
        lambda m: f'style={{{{display:"flex",alignItems:"center",gap:"6px",padding:"8px 16px",borderRadius:"12px",fontSize:"13px",fontWeight:500,whiteSpace:"nowrap",cursor:"pointer"}}}}',
        content
    )

    # Dynamic: status badge className expressions
    content = re.sub(
        r'className=\{`[^`]*px-2 py-(?:0\.5|1) rounded-full capitalize[^`]*\$\{[^}]+\}`\}',
        'style={{fontSize:"11px",padding:"2px 8px",borderRadius:"99px",textTransform:"capitalize"}}',
        content
    )

    # Dynamic: grade color className
    content = re.sub(
        r'className=\{`px-3 py-2\.5 font-bold \$\{gradeColor\([^)]+\)\}`\}',
        'style={{padding:"10px 12px",fontWeight:700}}',
        content
    )

    # Dynamic: unread notification border
    content = re.sub(
        r'className=\{`px-4 py-3 hover:bg-slate-700/20 \$\{[^}]+border-l-2 border-blue-500[^}]+\}`\}',
        'style={{padding:"12px 16px"}}',
        content
    )

    # Dynamic: progress bar color
    content = re.sub(
        r'className=\{`\$\{color\} h-1\.5 rounded-full`\}',
        'style={{height:"6px",borderRadius:"99px",background:"#10b981"}}',
        content
    )

    # statusBadge() function return values — convert className strings to style objects
    # These are returned from helper functions and applied as className={statusBadge(...)}
    # Replace the function bodies to return inline style strings we can spread
    # Instead: replace className={statusBadge(...)} with style spreads

    # Replace className={statusBadge(x)} pattern with a style prop
    content = re.sub(
        r'className=\{statusBadge\(([^)]+)\)\}',
        r'style={{fontSize:"11px",padding:"2px 8px",borderRadius:"99px",textTransform:"capitalize",background:"#334155",color:"#94a3b8"}}',
        content
    )

    # Replace className={`... ${statusBadge(x)}`} pattern
    content = re.sub(
        r'className=\{`[^`]*\$\{statusBadge\([^)]+\)\}`\}',
        r'style={{fontSize:"11px",padding:"2px 8px",borderRadius:"99px",textTransform:"capitalize",background:"#334155",color:"#94a3b8"}}',
        content
    )

    # actionColor() className
    content = re.sub(
        r'className=\{`text-xs font-bold uppercase \$\{actionColor\([^)]+\)\}`\}',
        'style={{fontSize:"11px",fontWeight:700,textTransform:"uppercase",color:"#94a3b8"}}',
        content
    )

    # gradeColor() className
    content = re.sub(
        r'className=\{`px-3 py-2\.5 font-bold \$\{gradeColor\([^)]+\)\}`\}',
        'style={{padding:"10px 12px",fontWeight:700,color:"#94a3b8"}}',
        content
    )

    if content != original:
        with open(path, 'w') as f:
            f.write(content)
        print(f"FIXED: {path}")
    else:
        print(f"NO CHANGE: {path}")

files = [
    "app/admin/reports/page.tsx",
    "app/admin/reports/academic/page.tsx",
    "app/admin/reports/attendance/page.tsx",
    "app/admin/reports/finance/page.tsx",
    "app/admin/reports/staff/page.tsx",
    "app/admin/reports/students/page.tsx",
    "app/admin/reports/operational/page.tsx",
    "app/admin/reports/system/page.tsx",
]

for f in files:
    process_file(f)

print("\nDone. Check for any remaining className= in these files:")
for f in files:
    if os.path.exists(f):
        with open(f) as fh:
            lines = [(i+1, l.rstrip()) for i, l in enumerate(fh) if 'className=' in l]
        if lines:
            print(f"\n{f} — {len(lines)} remaining:")
            for ln, l in lines[:5]:
                print(f"  L{ln}: {l[:80]}")
