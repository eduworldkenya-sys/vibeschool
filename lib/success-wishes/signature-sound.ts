type AudioContextWindow = Window & { webkitAudioContext?: typeof AudioContext }

/** Plays only after an explicit card-opening tap. */
export function playWishRevealSound(): () => void {
  if (typeof window === 'undefined') return () => undefined
  const AudioContextConstructor = window.AudioContext || (window as AudioContextWindow).webkitAudioContext
  if (!AudioContextConstructor) return () => undefined

  try {
    const context = new AudioContextConstructor()
    const start = context.currentTime
    const master = context.createGain()
    master.gain.setValueAtTime(0.0001, start)
    master.gain.exponentialRampToValueAtTime(0.28, start + 0.08)
    master.connect(context.destination)
    void context.resume()

    // A quiet filtered paper swish as the cover starts to unfold.
    const noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.32), context.sampleRate)
    const noise = noiseBuffer.getChannelData(0)
    for (let index = 0; index < noise.length; index += 1) noise[index] = Math.random() * 2 - 1
    const paper = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const paperGain = context.createGain()
    paper.buffer = noiseBuffer
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1050, start)
    filter.frequency.exponentialRampToValueAtTime(550, start + 0.3)
    paperGain.gain.setValueAtTime(0.0001, start)
    paperGain.gain.exponentialRampToValueAtTime(0.035, start + 0.07)
    paperGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3)
    paper.connect(filter)
    filter.connect(paperGain)
    paperGain.connect(master)
    paper.start(start)
    paper.stop(start + 0.32)

    const note = (frequency: number, onset: number, duration: number, volume: number, type: OscillatorType = 'sine') => {
      const oscillator = context.createOscillator()
      const envelope = context.createGain()
      oscillator.type = type
      oscillator.frequency.setValueAtTime(frequency, onset)
      envelope.gain.setValueAtTime(0.0001, onset)
      envelope.gain.exponentialRampToValueAtTime(volume, onset + 0.035)
      envelope.gain.exponentialRampToValueAtTime(0.0001, onset + duration)
      oscillator.connect(envelope)
      envelope.connect(master)
      oscillator.start(onset)
      oscillator.stop(onset + duration + 0.02)
    }

    // Three short, quiet chime notes land as the cover settles open.
    ;[523.25, 659.25, 783.99].forEach((frequency, index) => {
      const onset = start + 0.2 + index * 0.16
      note(frequency, onset, 0.48, 0.045)
      note(frequency * 2, onset, 0.28, 0.006)
    })

    let stopped = false
    const timeout = window.setTimeout(() => { void context.close() }, 1500)
    return () => {
      if (stopped) return
      stopped = true
      window.clearTimeout(timeout)
      try { master.gain.cancelScheduledValues(context.currentTime); master.gain.setTargetAtTime(0.0001, context.currentTime, 0.035) } catch { /* Context may already be closed. */ }
      window.setTimeout(() => { void context.close() }, 150)
    }
  } catch {
    return () => undefined
  }
}


let feedbackContext: AudioContext | null = null
/** Unlock during an opted-in user gesture so later confirmed status can chime. */
export function prepareWishFeedbackSound(): void {
  if (typeof window === 'undefined') return
  const Constructor = window.AudioContext || (window as AudioContextWindow).webkitAudioContext
  if (!Constructor) return
  try {
    if (!feedbackContext || feedbackContext.state === 'closed') feedbackContext = new Constructor()
    void feedbackContext.resume().catch(() => undefined) // Sound is optional; visual status remains authoritative.
  } catch { /* Unsupported audio must never interrupt a wish. */ }
}

export function playWishFeedbackSound(kind: 'typing' | 'ready' | 'sent'): () => void {
  prepareWishFeedbackSound()
  const context = feedbackContext
  if (!context) return () => undefined
  const notes = kind === 'typing' ? [392, 493.88, 587.33, 493.88] : kind === 'sent' ? [659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99]
  const voices: OscillatorNode[] = []
  try {
    const master = context.createGain()
    master.gain.value = 0.055
    master.connect(context.destination)
    const start = context.currentTime
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator(), gain = context.createGain()
      const onset = start + index * (kind === 'typing' ? 0.3 : 0.14)
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, onset)
      gain.gain.exponentialRampToValueAtTime(0.35, onset + 0.025)
      gain.gain.exponentialRampToValueAtTime(0.0001, onset + 0.45)
      oscillator.connect(gain); gain.connect(master)
      oscillator.start(onset); oscillator.stop(onset + 0.5); voices.push(oscillator)
    })
    let stopped = false
    const stop = () => {
      if (stopped) return
      stopped = true
      master.gain.setTargetAtTime(0.0001, context.currentTime, 0.025)
      window.setTimeout(() => { voices.forEach(voice => { try { voice.stop() } catch { /* Already ended. */ } }); master.disconnect() }, 120)
    }
    const timer = window.setTimeout(stop, 2000)
    return () => { window.clearTimeout(timer); stop() }
  } catch { return () => undefined }
}
