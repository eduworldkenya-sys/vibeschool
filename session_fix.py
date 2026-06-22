with open('app/page.tsx', 'r') as f:
    content = f.read()

old = '      navigated = true\n      router.replace(SIGNUP_DESTINATIONS[role])'
new = '''      if (authData.session) {
        await supabase.auth.setSession({
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
        })
      }
      navigated = true
      router.replace(SIGNUP_DESTINATIONS[role])'''

if old not in content:
    print("MATCH FAILED")
else:
    content = content.replace(old, new, 1)
    with open('app/page.tsx', 'w') as f:
        f.write(content)
    print("Patched successfully.")
