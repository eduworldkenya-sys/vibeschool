import type { SupabaseClient } from '@supabase/supabase-js'

// The limiting/order MUST operate on non-deleted reservation rows, not on an
// unfiltered page of old messages, or ready media can be starved indefinitely.
// Embedded !inner filters ensure only withdrawn/blocked/expired wishes qualify.
export function selectRetiredMediaUploads(db: SupabaseClient, now: string) {
  return db.from('success_wishes_media_uploads')
    .select('message_id,provider,asset_id,state,upload_expires_at,success_wishes_messages!inner(id)')
    .in('state',['ready','issued','processing','cleanup_required'])
    .lte('upload_expires_at',now)
    .or('state.in.(withdrawn,blocked,expired),expires_at.lt.'+now,
      {referencedTable:'success_wishes_messages'})
    .order('upload_expires_at',{ascending:true}).limit(20)
}
