import type { Metadata } from 'next'
import OfflineBooksLibrary from '@/components/read/OfflineBooksLibrary'

export const metadata:Metadata={title:'My Offline Books | VibeSchool',robots:{index:false,follow:false}}
export default function OfflineBooksPage(){return <OfflineBooksLibrary/>}
