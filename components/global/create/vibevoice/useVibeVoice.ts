"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { createBrowserClient } from "@supabase/ssr"
import {
  VVNarration,
  VVQueueItem,
  VVLang,
  VVTier,
  VVStatus,
  VVQuestionResponse
} from "@/lib/types"

export function useVibeVoice(userId: string | null) {
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), [])

  const [loading, setLoading] = useState<boolean>(true)
  const [narrations, setNarrations] = useState<VVNarration[]>([])
  const [queue, setQueue] = useState<VVQueueItem[]>([])
  const [activeReviews, setActiveReviews] = useState<VVNarration[]>([])
  const [currentNarration, setCurrentNarration] = useState<VVNarration | null>(null)

  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1)
  const [wordsList, setWordsList] = useState<string[]>([])

  const [liveRoom, setLiveRoom] = useState<any>(null)
  const [liveParticipants] = useState<string[]>(["Amani", "Nia", "Baraka"])
  const [liveReactions, setLiveReactions] = useState<string[]>([])
  const [raisedHands, setRaisedHands] = useState<string[]>([])
  const [liveTranscription, setLiveTranscription] = useState<string>("")
  const [isRecording, setIsRecording] = useState<boolean>(false)

  const [reviewsCount, setReviewsCount] = useState<number>(0)
  const [accuracy] = useState<number>(92)
  const [xp, setXp] = useState<number>(340)
  const [leaderboard, setLeaderboard] = useState<Array<{ name: string; xp: number; role: string }>>([])

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const liveChannelRef = useRef<any>(null)

  useEffect(() => {
    if (!userId) return
    async function loadData() {
      setLoading(true)
      try {
        await Promise.all([fetchNarrations(), fetchQueue(), fetchCommunityData()])
      } catch (err) {
        console.error("Error loading VibeVoice content:", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel()
      if (liveChannelRef.current) liveChannelRef.current.unsubscribe()
    }
  }, [userId])

  const fetchNarrations = async () => {
    const { data, error } = await supabase
      .from("vibevoice_narrations")
      .select("*")
      .or("status.eq.live,status.eq.approved")
      .order("created_at", { ascending: false })
    if (!error && data) setNarrations(data as VVNarration[])
  }

  const fetchQueue = async () => {
    const { data, error } = await supabase
      .from("vibevoice_queue")
      .select("*")
      .order("created_at", { ascending: false })
    if (!error && data) setQueue(data as VVQueueItem[])
  }

  const fetchCommunityData = async () => {
    if (!userId) return
    const { data: pending, error: pendingErr } = await supabase
      .from("vibevoice_narrations")
      .select("*")
      .eq("status", "pending")
      .neq("narrator_id", userId)
      .order("created_at", { ascending: false })
    if (!pendingErr && pending) setActiveReviews(pending as VVNarration[])

    const { data: reviews, error: reviewErr } = await supabase
      .from("vibevoice_reviews")
      .select("*")
      .eq("reviewer_id", userId)
    if (!reviewErr && reviews) {
      const count = reviews.length
      setReviewsCount(count)
      setXp(340 + count * 15)
    }

    setLeaderboard([
      { name: "Teacher Mwangi", xp: 1420, role: "Educator" },
      { name: "Fatuma O.",       xp: 980,  role: "Student Pioneer" },
      { name: "John Kiprop",     xp: 850,  role: "Parent Mentor" },
      { name: "Mama Stacy",      xp: 620,  role: "Parent Mentor" },
      { name: "You",             xp: 340 + (reviews?.length || 0) * 15, role: "Student Pioneer" }
    ].sort((a, b) => b.xp - a.xp))
  }

  const playNarration = (narration: VVNarration) => {
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    setCurrentNarration(narration)
    setIsPlaying(true)
    const tokens = narration.script.split(/\s+/).filter(w => w.length > 0)
    setWordsList(tokens)
    setCurrentWordIndex(-1)
    const utterance = new SpeechSynthesisUtterance(narration.script)
    utterance.lang = narration.language === "swahili" ? "sw-KE" : "en-US"
    utterance.rate = 0.9
    utterance.onboundary = (event) => {
      if (event.name === "word") {
        const textBefore = narration.script.substring(0, event.charIndex)
        const wordMatch = textBefore.split(/\s+/).filter(w => w.length > 0)
        setCurrentWordIndex(wordMatch.length)
      }
    }
    utterance.onend = () => {
      setIsPlaying(false)
      setCurrentWordIndex(-1)
      incrementPlayCount(narration.id)
    }
    utterance.onerror = () => {
      setIsPlaying(false)
      setCurrentWordIndex(-1)
    }
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  const pauseNarration = () => {
    if (window.speechSynthesis) { window.speechSynthesis.pause(); setIsPlaying(false) }
  }

  const resumeNarration = () => {
    if (window.speechSynthesis) { window.speechSynthesis.resume(); setIsPlaying(true) }
  }

  const stopNarration = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
      setIsPlaying(false)
      setCurrentWordIndex(-1)
    }
  }

  const incrementPlayCount = async (narrationId: string) => {
    const { data } = await supabase
      .from("vibevoice_narrations")
      .select("play_count")
      .eq("id", narrationId)
      .single()
    const currentCount = data?.play_count || 0
    await supabase
      .from("vibevoice_narrations")
      .update({ play_count: currentCount + 1 })
      .eq("id", narrationId)
    setNarrations(prev =>
      prev.map(item => item.id === narrationId ? { ...item, play_count: currentCount + 1 } : item)
    )
  }

  const generateScript = async (dialect: string) => {
    const res = await fetch("/api/vibevoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_script", payload: { dialect } })
    })
    if (!res.ok) throw new Error("Failed to generate script via AI")
    return await res.json()
  }

  const translateScript = async (text: string, targetLang: string) => {
    const res = await fetch("/api/vibevoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "translate", payload: { text, targetLang } })
    })
    if (!res.ok) throw new Error("Failed to translate script via AI")
    const data = await res.json()
    return data.translation
  }

  const generateQuestion = async (script: string) => {
    const res = await fetch("/api/vibevoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_question", payload: { script } })
    })
    if (!res.ok) throw new Error("Failed to generate question via AI")
    return await res.json() as VVQuestionResponse
  }

  const claimQueueItem = async (queueId: string) => {
    if (!userId) return false
    const { error } = await supabase
      .from("vibevoice_queue")
      .update({ status: "claimed", claimed_by: userId, claimed_at: new Date().toISOString() })
      .eq("id", queueId)
    if (!error) { await fetchQueue(); return true }
    return false
  }

  const unclaimQueueItem = async (queueId: string) => {
    const { error } = await supabase
      .from("vibevoice_queue")
      .update({ status: "open", claimed_by: null, claimed_at: null })
      .eq("id", queueId)
    if (!error) { await fetchQueue(); return true }
    return false
  }

  const submitNarration = async (
    title: string,
    script: string,
    language: VVLang,
    subject: string,
    tier: VVTier,
    durationSec: number = 30,
    queueId?: string
  ) => {
    if (!userId) return false
    const { error } = await supabase
      .from("vibevoice_narrations")
      .insert({
        title, script, language, subject, tier,
        narrator_id: userId,
        status: "pending",
        duration_sec: durationSec,
        excerpt: script.substring(0, 100) + "..."
      })
      .select()
    if (error) { console.error("Narration write failed:", error); return false }
    if (queueId) {
      await supabase.from("vibevoice_queue").update({ status: "complete" }).eq("id", queueId)
    }
    await Promise.all([fetchNarrations(), fetchQueue(), fetchCommunityData()])
    return true
  }

  const submitReview = async (narrationId: string, approved: boolean) => {
    if (!userId) return false
    const { error: reviewErr } = await supabase
      .from("vibevoice_reviews")
      .insert({ narration_id: narrationId, reviewer_id: userId, approved, asr_score: approved ? 95.0 : 40.0 })
    if (reviewErr) { console.error("Submission of review failed:", reviewErr); return false }
    const { data: reviews } = await supabase
      .from("vibevoice_reviews")
      .select("approved")
      .eq("narration_id", narrationId)
    const approveCount = reviews?.filter(r => r.approved).length || 0
    const totalCount = reviews?.length || 0
    const newTrustScore = approveCount - (totalCount - approveCount)
    const updatePayload: { trust_score: number; status?: VVStatus } = { trust_score: newTrustScore }
    if (newTrustScore >= 2) updatePayload.status = "live"
    await supabase.from("vibevoice_narrations").update(updatePayload).eq("id", narrationId)
    await Promise.all([fetchNarrations(), fetchCommunityData()])
    return true
  }

  const createLiveRoom = async (topic: string, language: VVLang) => {
    if (!userId) throw new Error("Not logged in to create live room")
    const roomCode = Math.floor(100000 + Math.random() * 900000).toString()
    const { data, error } = await supabase
      .from("vibevoice_live_rooms")
      .insert({ room_code: roomCode, topic, language, host_id: userId, status: "active" })
      .select()
      .single()
    if (error || !data) throw new Error(error?.message || "Could not insert live broadcast session")
    setLiveRoom(data)
    setupLiveChannel(roomCode)
    return data
  }

  const joinLiveRoom = async (roomCode: string) => {
    const { data, error } = await supabase
      .from("vibevoice_live_rooms")
      .select("*")
      .eq("room_code", roomCode)
      .eq("status", "active")
      .single()
    if (error || !data) throw new Error("No active room found with this invitation code.")
    setLiveRoom(data)
    setupLiveChannel(roomCode)
    return data
  }

  const setupLiveChannel = (roomCode: string) => {
    if (liveChannelRef.current) liveChannelRef.current.unsubscribe()
    const channel = supabase.channel(`room:${roomCode}`, { config: { broadcast: { self: true } } })
    channel
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        setLiveReactions(prev => [...prev.slice(-10), payload.emoji])
      })
      .on("broadcast", { event: "handraise" }, ({ payload }) => {
        const student = payload.student
        setRaisedHands(prev =>
          prev.includes(student) ? prev.filter(s => s !== student) : [...prev, student]
        )
      })
      .on("broadcast", { event: "transcribe" }, ({ payload }) => {
        setLiveTranscription(payload.text)
      })
      .subscribe()
    liveChannelRef.current = channel
  }

  const addLiveReaction = (emoji: string) => {
    if (liveChannelRef.current) {
      liveChannelRef.current.send({ type: "broadcast", event: "reaction", payload: { emoji } })
    }
  }

  const toggleHandRaise = (studentName: string) => {
    if (liveChannelRef.current) {
      liveChannelRef.current.send({ type: "broadcast", event: "handraise", payload: { student: studentName } })
    }
  }

  const sendLiveTranscription = (text: string) => {
    if (liveChannelRef.current) {
      liveChannelRef.current.send({ type: "broadcast", event: "transcribe", payload: { text } })
    }
  }

  const endLiveRoom = async (roomId: string, finalScript?: string) => {
    if (!liveRoom) return
    await supabase
      .from("vibevoice_live_rooms")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", roomId)
    if (finalScript && finalScript.trim().length > 10) {
      await submitNarration(
        `Class Broadcast: ${liveRoom.topic}`,
        finalScript, liveRoom.language, "Class Lecture", "human", 120
      )
    }
    if (liveChannelRef.current) liveChannelRef.current.unsubscribe()
    setLiveRoom(null)
    setLiveTranscription("")
    setRaisedHands([])
  }

  return {
    loading, userId, narrations, queue, activeReviews,
    currentNarration, isPlaying, currentWordIndex, wordsList,
    liveRoom, liveParticipants, liveReactions, raisedHands,
    liveTranscription, isRecording, setIsRecording,
    reviewsCount, accuracy, xp, leaderboard,
    playNarration, pauseNarration, resumeNarration, stopNarration,
    generateScript, translateScript, generateQuestion,
    claimQueueItem, unclaimQueueItem, submitNarration, submitReview,
    createLiveRoom, joinLiveRoom, addLiveReaction, toggleHandRaise,
    sendLiveTranscription, endLiveRoom,
    refreshQueue: fetchQueue,
    refreshNarrations: fetchNarrations
  }
}
