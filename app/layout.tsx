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
  '@graph':[
    {
      '@type':'EducationalOrganization',
      '@id':'https://www.vibeschool.co.ke/#organization',
      name:'VibeSchool',
      url:'https://www.vibeschool.co.ke',
      logo:'https://www.vibeschool.co.ke/icons/vibeschool-logo.png',
      description:'VibeSchool is a Kenyan education platform designed to connect curriculum, teaching, learner evidence, educational understanding, family support and future progression.',
      areaServed:{'@type':'Country',name:'Kenya'},
      availableLanguage:['English'],
    },
    {
      '@type':'WebSite',
      '@id':'https://www.vibeschool.co.ke/#website',
      url:'https://www.vibeschool.co.ke',
      name:'VibeSchool',
      publisher:{'@id':'https://www.vibeschool.co.ke/#organization'},
      inLanguage:'en-KE',
      description:'One learning system from curriculum to the learner’s next step.',
    },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.vibeschool.co.ke'),
  applicationName:'VibeSchool',
  title:{default:'VibeSchool — One learning system from curriculum to the next step',template:'%s | VibeSchool'},
  description:'VibeSchool connects curriculum, teaching, learning evidence, assessment, families, schools and Senior School Pathways around one continuing Kenyan education journey.',
  keywords:['VibeSchool','Kenya education','education operating system Kenya','CBC learning','CBE Kenya','Senior School pathways Kenya','school discovery Kenya','teacher tools Kenya'],
  openGraph:{title:'VibeSchool — One learning system from curriculum to the next step',description:'Explore how curriculum, teaching, learning evidence, families, schools and future direction can stay connected.',url:'https://www.vibeschool.co.ke',siteName:'VibeSchool',locale:'en_KE',type:'website',images:[{url:'/opengraph-image',width:1200,height:630,alt:'VibeSchool — connected education for Kenya'}]},
  twitter:{card:'summary_large_image',title:'VibeSchool — One learning system from curriculum to the next step',description:'Connected education for learners, teachers, families and schools in Kenya.',images:['/opengraph-image']},
  manifest:'/manifest.webmanifest',
  appleWebApp:{capable:true,statusBarStyle:'black-translucent',title:'VibeSchool'},
  icons:{icon:[{url:'/pwa-icons/v3/32',type:'image/png',sizes:'32x32'},{url:'/pwa-icons/v3/48',type:'image/png',sizes:'48x48'},{url:'/pwa-icons/v3/192',type:'image/png',sizes:'192x192'}],shortcut:[{url:'/pwa-icons/v3/48',type:'image/png',sizes:'48x48'}],apple:[{url:'/apple-icon',type:'image/png',sizes:'180x180'}]},
  formatDetection:{telephone:false},
}

export const viewport: Viewport = { themeColor:'#07111f',width:'device-width',initialScale:1,minimumScale:1,viewportFit:'cover' }

export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en" className={`${jost.variable} ${dmMono.variable} ${cormorant.variable} ${plusJakarta.variable}`}><body><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schemaOrg)}} />{children}<LearnYourWayReaderBridge/><PwaServiceWorker/><PwaInstallPrompt/></body></html> }
