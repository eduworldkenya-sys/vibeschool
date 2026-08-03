import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabaseServer'

// Dismiss a bank question once it accumulates this many error flags
const FLAG_DISMISS_THRESHOLD = 3

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()
    const { questionId, bankId, type, reason } = await req.json()

    if (!questionId || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!['error', 'contest', 'other'].includes(type)) {
      return NextResponse.json({ error: 'Invalid flag type' }, { status: 400 })
    }

    // ── Save the flag persistently ────────────────────────────────────────
    const { error: insertErr } = await supabase.from('exam_flags').insert({
      question_text: String(questionId).slice(0, 2000),
      flag_type:     type,
      reason:        reason ? String(reason).slice(0, 1000) : null,
      status:        'open',
    })

    if (insertErr) {
      console.error('[VibeExam] Flag insert error:', insertErr.message)
    }

    // ── If this flag references a bank question, track it for dismissal ──
    if (bankId && typeof bankId === 'string') {
      const { data: bankRow, error: fetchErr } = await supabase
        .from('exam_question_bank')
        .select('times_flagged')
        .eq('id', bankId)
        .single()

      if (!fetchErr && bankRow) {
        const newFlagCount = (bankRow.times_flagged ?? 0) + 1

        if (newFlagCount >= FLAG_DISMISS_THRESHOLD) {
          // Enough reports — pull it from rotation immediately
          await supabase.rpc('dismiss_bank_question', { p_id: bankId })
          console.warn(`[VibeExam] Bank question ${bankId} auto-dismissed after ${newFlagCount} flags`)
        } else {
          // Not enough yet — just increment the counter, keep serving it
          await supabase
            .from('exam_question_bank')
            .update({ times_flagged: newFlagCount })
            .eq('id', bankId)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback received. Our team will review within 24 hours.',
    })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[VibeExam] Flag route error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
