import type { Metadata, Viewport } from 'next'
import { Jost, DM_Mono, Cormorant_Garamond, Plus_Jakarta_Sans } from 'next/font/google'
import LearnYourWayReaderBridge from '@/components/student/LearnYourWayReaderBridge'
import PwaInstallPrompt from '@/components/pwa/PwaInstallPrompt'
import PwaServiceWorker from '@/components/pwa/PwaServiceWorker'
import './globals.css'

const jost = Jost({ subsets: ['latin'], weight: ['400','600','800'], display: 'swap', variable: '--font-display' })
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400'], display: 'swap', preload:false, variable: '--font-mono' })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400'], style: ['italic'], display: 'swap', preload:false, variable: '--font-serif' })
const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400','500','600','700','800'], display: 'swap', variable: '--font-jakarta' })

const schemaOrg = {
  '@context':'https://schema.org',
  '@type':'EducationalOrganization',
  name:'VibeSchool',
  url:'https://www.vibeschool.co.ke',
  logo:'https://www.vibeschool.co.ke/icons/vibeschool-logo.png',
  description:'VibeSchool connects learning, teaching, evidence, pathways and the people supporting a learner in Kenya.',
  areaServed:{'@type':'Country',name:'Kenya'},
  availableLanguage:['English'],
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.vibeschool.co.ke'),
  title: { default:'VibeSchool — Learning, teaching and future direction, connected', template:'%s | VibeSchool' },
  description:'VibeSchool connects learning, teaching, evidence, Pathways and school discovery around the Kenyan education journey.',
  keywords:['VibeSchool','Kenya education','CBC learning','CBE Kenya','Senior School pathways Kenya','school discovery Kenya','teacher tools Kenya'],
  openGraph:{title:'VibeSchool — Learning, teaching and future direction, connected',description:'Explore learning, Pathways, careers and schools while understanding how VibeSchool connects the wider education journey.',url:'https://www.vibeschool.co.ke',siteName:'VibeSchool',locale:'en_KE',type:'website',images:[{url:'/opengraph-image',width:1200,height:630,alt:'VibeSchool — connected education for Kenya'}]},
  twitter:{card:'summary_large_image',title:'VibeSchool — Learning, teaching and future direction, connected',description:'A connected education experience for learners, teachers, parents, schools and institutions in Kenya.',images:['/opengraph-image']},
  manifest:'/manifest.webmanifest',
  appleWebApp:{capable:true,statusBarStyle:'black-translucent',title:'VibeSchool'},
  icons:{icon:[{url:'/pwa-icons/v3/32',type:'image/png',sizes:'32x32'},{url:'/pwa-icons/v3/48',type:'image/png',sizes:'48x48'},{url:'/pwa-icons/v3/192',type:'image/png',sizes:'192x192'}],shortcut:[{url:'/pwa-icons/v3/48',type:'image/png',sizes:'48x48'}],apple:[{url:'/apple-icon',type:'image/png',sizes:'180x180'}]},
  formatDetection:{telephone:false},
}
export const viewport: Viewport = { themeColor:'#07111f',width:'device-width',initialScale:1,minimumScale:1,viewportFit:'cover' }
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en" className={`${jost.variable} ${dmMono.variable} ${cormorant.variable} ${plusJakarta.variable}`}><body><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schemaOrg)}} />{children}<LearnYourWayReaderBridge/><PwaServiceWorker/><PwaInstallPrompt/></body></html> }
