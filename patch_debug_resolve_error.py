import sys
path = "/data/data/com.termux/files/home/vibeschool/lib/curriculum/globalSubjects.ts"
with open(path, "r") as f:
    content = f.read()

old = '''export async function resolveGlobalSubjectId(subjectName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("subjects")
    .select("id")
    .is("school_id", null)
    .ilike("name", subjectName)
    .maybeSingle()

  if (error || !data) return null
  return data.id
}'''

new = '''export let lastResolveDebug: string = ""

export async function resolveGlobalSubjectId(subjectName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("subjects")
    .select("id")
    .is("school_id", null)
    .ilike("name", subjectName)
    .maybeSingle()

  if (error || !data) {
    lastResolveDebug = JSON.stringify({ code: error?.code ?? null, message: error?.message ?? null, hasData: !!data })
    return null
  }
  lastResolveDebug = "ok"
  return data.id
}'''

count = content.count(old)
if count != 1:
    print(f"ERROR: expected 1 match, found {count}. Paste me the full file instead.")
    sys.exit(1)

content = content.replace(old, new)
with open(path, "w") as f:
    f.write(content)
print("Patched globalSubjects.ts")
