// components/student/VibeTwin/types.ts

export type TwinMode   = 'text' | 'audio'
export type TwinState  = 'idle' | 'listening' | 'processing' | 'speaking'
export type VibeIntent = 'NEWS' | 'QUESTION' | 'READ' | 'LESSON' | 'CONVERSATIONAL' | 'GENERAL'

// Named TwinMessage to avoid collision with lib/types.ts Message interface
export interface TwinMessage {
  id:        string
  role:      'twin' | 'user'
  text:      string
  timestamp: number
}

export interface VibeTwinProps {
  isOpen:   boolean
  onClose:  () => void
  userName: string
}

export interface SearchResult {
  title:    string
  snippet:  string
  url?:     string
}

export interface SearchResponse {
  results: SearchResult[]
}

// Typed interface for SpeechRecognition — avoids any, works across browsers
export interface SpeechRecognitionInstance {
  lang:           string
  continuous:     boolean
  interimResults: boolean
  onstart:        (() => void) | null
  onresult:       ((e: SpeechRecognitionResultEvent) => void) | null
  onerror:        ((e: SpeechRecognitionErrorEvent) => void) | null
  onend:          (() => void) | null
  start():        void
  stop():         void
  abort():        void
}

export interface SpeechRecognitionResultEvent extends Event {
  results: {
    0: {
      0: { transcript: string; confidence: number }
      isFinal: boolean
    }
  }
}

export interface SpeechRecognitionErrorEvent extends Event {
  error:   string
  message: string
}
