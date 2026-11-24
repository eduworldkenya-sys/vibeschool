import { MiniLiveExplore } from './MiniLiveExplore'

// Same discovery and creation interface; no backend access until commissioning.
export function MiniExplore() {
  return <MiniLiveExplore enabled={false}/>
}
