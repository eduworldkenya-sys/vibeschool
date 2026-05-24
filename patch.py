f='app/teacher/timetable/page.tsx'
c=open(f).read()

# Fix 1: Remove weekend banner
c=c.replace(
    "      {isWeekend && !loading && (\n                           <div style={{\n                             background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,\n                             padding: '10px 16px', marginBottom: 14,\n                             fontSize: 12, color: '#92400e', fontWeight: 600,\n                           }}>\n                             Today is a weekend — showing Monday&apos;s schedule\n                           </div>\n                         )}",
    ""
)

# Fix 2: Mon Lessons → Today's Lessons, show today's actual count
c=c.replace(
    "{ label: isWeekend ? 'Mon Lessons' : 'Today', value: todayCount }",
    "{ label: \"Today's Lessons\", value: allSlots.filter(s => s.dayOfWeek === todayDow).length }"
)

open(f,'w').write(c)
print('done')
