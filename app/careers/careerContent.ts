export const focusAreas = [
  {
    id: 'curriculum',
    name: 'Curriculum & teaching',
    description: 'Curriculum content, schemes of work, lesson preparation and the everyday work of teachers.',
    href: '/teacher',
    linkText: 'See teacher tools',
  },
  {
    id: 'learning',
    name: 'Learning & assessment',
    description: 'Clear explanations, useful practice and assessments that help learners understand their progress.',
    href: '/global',
    linkText: 'See learning',
  },
  {
    id: 'schools',
    name: 'Schools & partnerships',
    description: 'The workflows that connect teachers, school teams, learners and families.',
    href: '/institutions',
    linkText: 'See VibeSchool for schools',
  },
  {
    id: 'product',
    name: 'Product, engineering & design',
    description: 'Make complex educational tasks simpler to complete on the devices people already use.',
    href: '/sandbox',
    linkText: 'Try the product sandbox',
  },
] as const

export type PublishedRole = {
  id: string
  title: string
  team: string
  location: string
  arrangement: string
  summary: string
  applicationUrl: string
  closingDate?: string
}

// Only add an approved, real VibeSchool vacancy with a working application URL.
// School-employer jobs belong in the Teacher Marketplace, not this company careers list.
export const publishedRoles: ReadonlyArray<PublishedRole> = []
