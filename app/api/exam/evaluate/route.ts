import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { question, selectedIndex } = await req.json()
    if (!question || typeof selectedIndex !== 'number') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const isCorrect = question.correctIndex === selectedIndex
    return NextResponse.json({
      isCorrect,
      explanation:  question.explanation,
      teachingNote: question.teachingNote,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
