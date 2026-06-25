import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CREDIT_COST = 1
const FREE_CREDITS = 3

export async function POST(req: NextRequest) {
  try {
    // 1. Auth — get teacher from bearer token
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const teacherId = user.id

    // 2. Get or create credit wallet
    let { data: wallet } = await supabaseAdmin
      .from('vibe_credits')
      .select('balance, total_earned, total_spent')
      .eq('teacher_id', teacherId)
      .maybeSingle()

    if (!wallet) {
      // First time — create wallet with free credits
      const { data: newWallet } = await supabaseAdmin
        .from('vibe_credits')
        .insert({
          teacher_id:   teacherId,
          balance:      FREE_CREDITS,
          total_earned: FREE_CREDITS,
          total_spent:  0,
        })
        .select('balance, total_earned, total_spent')
        .single()
      wallet = newWallet

      // Log the free credit grant
      await supabaseAdmin.from('vibe_credit_transactions').insert({
        teacher_id:    teacherId,
        type:          'gift',
        feature:       'signup_bonus',
        amount:        FREE_CREDITS,
        balance_after: FREE_CREDITS,
        notes:         'Free credits on first AI use',
      })
    }

    // 3. Check balance
    if (!wallet || wallet.balance < CREDIT_COST) {
      return NextResponse.json({
        error:        'insufficient_credits',
        balance:      wallet?.balance ?? 0,
        required:     CREDIT_COST,
        message:      'You have no Vibe Credits. Buy credits to generate lesson plans.',
      }, { status: 402 })
    }

    // 4. Parse request
    const { prompt } = await req.json()
    if (!prompt) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })

    // 5. Call Anthropic
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 2000,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    const anthropicData = await anthropicRes.json()
    if (!anthropicRes.ok) {
      return NextResponse.json({
        error: anthropicData.error?.message ?? 'AI generation failed'
      }, { status: 500 })
    }

    // 6. Parse plan — only deduct credits after successful generation
    const text  = anthropicData.content
      ?.map((b: { type: string; text?: string }) => b.text ?? '')
      .join('') ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const plan  = JSON.parse(clean)

    // 7. Deduct credit atomically
    const newBalance     = wallet.balance - CREDIT_COST
    const newTotalSpent  = wallet.total_spent + CREDIT_COST

    await supabaseAdmin
      .from('vibe_credits')
      .update({
        balance:      newBalance,
        total_spent:  newTotalSpent,
        updated_at:   new Date().toISOString(),
      })
      .eq('teacher_id', teacherId)

    await supabaseAdmin.from('vibe_credit_transactions').insert({
      teacher_id:    teacherId,
      type:          'spend',
      feature:       'lesson_plan',
      amount:        -CREDIT_COST,
      balance_after: newBalance,
      notes:         `Generated lesson plan`,
    })

    // 8. Return plan + updated balance
    return NextResponse.json({
      plan,
      credits: {
        used:      CREDIT_COST,
        balance:   newBalance,
        was:       wallet.balance,
      }
    })

  } catch (e: unknown) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 })
  }
}
