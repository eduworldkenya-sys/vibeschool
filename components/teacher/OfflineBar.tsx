'use client'

import { useEffect, useState } from 'react'
import styles from './OfflineBar.module.css'

export default function OfflineBar() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const goOnline  = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return <div className={`${styles.bar} ${!isOnline ? styles.offline : ''}`} />
}