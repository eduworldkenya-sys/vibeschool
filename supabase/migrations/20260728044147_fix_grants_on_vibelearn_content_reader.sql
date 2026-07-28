-- Lock down execution. The reader requires a real authenticated viewer
-- and derives role and ownership from auth.uid().

revoke all
on function public.get_vibelearn_content_reader(uuid)
from anon, public;
