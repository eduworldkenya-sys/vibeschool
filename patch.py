import re

with open("app/parent/create-child/page.tsx", "r") as f:
    content = f.read()

skip = '''  async function handleSkip() {
    if (!validateDetails()) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/academy/signin?role=parent"); return; }

    const { data: student, error: stuErr } = await supabase
      .from("students")
      .insert({
        name:             childName.trim(),
        profile_id:       null,
        class_id:         null,
        admission_number: null,
      })
      .select("id")
      .single();

    if (stuErr || !student) {
      setLoading(false);
      setError("Failed to create child. Please try again.");
      return;
    }

    const { error: linkErr } = await supabase
      .from("parent_student_links")
      .insert({
        parent_id:       user.id,
        student_id:      student.id,
        school_id:       null,
        relationship:    "parent",
        is_primary:      true,
        can_pickup:      true,
        receives_alerts: true,
      });

    if (linkErr) {
      setLoading(false);
      setError("Failed to link child. Please try again.");
      return;
    }

    setLoading(false);
    setDoneMsg(`${childName.trim()} has been added to your account. You can link them to a school later.`);
    setStep("done");
  }'''

submit = '''  async function handleSubmit() {
    setError("");
    if (!classId) { setError("Please select a class."); return; }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/academy/signin?role=parent"); return; }

    const { data: student, error: stuErr } = await supabase
      .from("students")
      .insert({
        name:             childName.trim(),
        profile_id:       null,
        class_id:         classId,
        admission_number: null,
      })
      .select("id")
      .single();

    if (stuErr || !student) {
      setLoading(false);
      setError("Failed to create child. Please try again.");
      return;
    }

    const { error: linkErr } = await supabase
      .from("parent_student_links")
      .insert({
        parent_id:       user.id,
        student_id:      student.id,
        school_id:       schoolId,
        relationship:    "parent",
        is_primary:      true,
        can_pickup:      true,
        receives_alerts: true,
      });

    if (linkErr) {
      setLoading(false);
      setError("Failed to link child. Please try again.");
      return;
    }

    const { error: reqErr } = await supabase
      .from("class_join_requests")
      .insert({
        student_id: student.id,
        class_id:   classId,
        parent_id:  user.id,
        status:     "pending",
      });

    if (reqErr) {
      setLoading(false);
      setError("Failed to send join request. Please try again.");
      return;
    }

    setLoading(false);
    setDoneMsg(`Join request sent. Once the teacher approves, ${childName.trim()} will appear on your dashboard.`);
    setStep("done");
  }'''

content = re.sub(r'async function handleSkip\(\).*?(?=\n  function handleAddToSchool)', skip + '\n\n', content, flags=re.DOTALL)
content = re.sub(r'async function handleSubmit\(\).*?(?=\n  function handleBack)', submit + '\n\n', content, flags=re.DOTALL)

with open("app/parent/create-child/page.tsx", "w") as f:
    f.write(content)

print("Done")
