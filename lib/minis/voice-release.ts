// Keep legacy reads compatible until the additive migration and screening configuration are verified.
export function miniVoiceEnabled():boolean{return process.env.NEXT_PUBLIC_MINI_LESSON_VOICE_ENABLED==='true'}
export function miniVoiceColumns(enabled=miniVoiceEnabled()):string{return enabled?',audio_path':''}
