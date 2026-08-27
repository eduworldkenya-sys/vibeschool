-- Keep the public school directory RPC surface visible to PostgREST after deployment.
NOTIFY pgrst, 'reload schema';
