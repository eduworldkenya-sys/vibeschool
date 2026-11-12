import SchoolLearnLibrary from '@/components/learn/SchoolLearnLibrary'

export const dynamic = 'force-dynamic'

/** One grade/subject discovery entry point for every released school lesson. */
export default function LearnPage() {
  return <SchoolLearnLibrary mode="public" />
}
