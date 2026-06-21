with open('app/page.tsx', 'r') as f:
    content = f.read()

old_block = '''      const userId = authData.user.id
      const dbRole = ROLE_DB[role]

      // Insert profile — never use pending_admin, use real role
      const profilePayload: Record<string, unknown> = {
        id:        userId,
        full_name: fullName.trim(),
        role:      dbRole,
        ...(country && { country_code: country }),
        ...(dob     && { date_of_birth: dob }),
        ...(schoolId && { school_id: schoolId }),
      }

      const { error: profileErr } = await supabase
        .from('profiles')
        .insert(profilePayload)

      if (profileErr) {
        await supabase.auth.signOut()
    document.cookie = 'vibe_role=; path=/; max-age=0'
        setError(`Account setup failed: ${profileErr.message} (${profileErr.code ?? 'no code'} | ${profileErr.details ?? 'no details'})`)
        return                                                                                }'''

new_block = '''      const userId = authData.user.id
      const dbRole = ROLE_DB[role]

      const profilePayload: Record<string, unknown> = {
        ...(country && { country_code: country }),
        ...(dob     && { date_of_birth: dob }),
        ...(schoolId && { school_id: schoolId }),
      }

      let profileErr: { message: string; code?: string } | null = null
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error, data } = await supabase
          .from('profiles')
          .update(profilePayload)
          .eq('id', userId)
          .select('id')

        profileErr = error
        if (!error && data && data.length > 0) { profileErr = null; break }
        if (attempt < 2) await new Promise(r => setTimeout(r, 250))
      }

      if (profileErr) {
        await supabase.auth.signOut()
        document.cookie = 'vibe_role=; path=/; max-age=0'
        setError('Account setup failed. Please try again.')
        return
      }'''

if old_block not in content:
    print("MATCH FAILED")
else:
    content = content.replace(old_block, new_block)
    with open('app/page.tsx', 'w') as f:
        f.write(content)
    print("Patched successfully.")
