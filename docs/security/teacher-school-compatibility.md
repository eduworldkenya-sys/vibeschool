# Compatibility

Existing clients may continue calling `connect_teacher_to_school` and `connect_teacher_to_directory_school`. Their return UUID is now a claim identifier rather than an authorization grant. Current onboarding UI does not interpret the UUID and therefore remains compatible while removing the privilege escalation path.
