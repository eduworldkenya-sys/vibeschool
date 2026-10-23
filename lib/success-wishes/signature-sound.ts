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
