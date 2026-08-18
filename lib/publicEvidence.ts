import evidenceConfig from '@/config/public-evidence.json'

export type EvidenceStatus = 'draft' | 'measured' | 'verified' | 'permissioned' | 'published' | 'withdrawn'

export type PublicEvidenceClaim = {
  id: string
  title: string
  status: EvidenceStatus
  metric_definition: string
  value: string
  measurement_window: string
  population: string
  method: string
  verification: {
    status: 'verified'
    verified_at: string
    verified_by: string
    evidence_reference: string
  }
  permission: {
    status: 'granted'
    granted_at: string
    scope: string
  }
  limitations: string[]
  source_reference: string
}

type EvidenceConfig = {
  schema_version: number
  reviewed_at: string
  publication_policy: {
    default: 'withhold'
    description: string
    allowed_statuses: EvidenceStatus[]
  }
  claims: PublicEvidenceClaim[]
}

const config = evidenceConfig as EvidenceConfig

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isPublishableEvidenceClaim(claim: PublicEvidenceClaim): boolean {
  return claim.status === 'published'
    && hasText(claim.id)
    && hasText(claim.title)
    && hasText(claim.metric_definition)
    && hasText(claim.value)
    && hasText(claim.measurement_window)
    && hasText(claim.population)
    && hasText(claim.method)
    && claim.verification?.status === 'verified'
    && hasText(claim.verification.verified_at)
    && hasText(claim.verification.verified_by)
    && hasText(claim.verification.evidence_reference)
    && claim.permission?.status === 'granted'
    && hasText(claim.permission.granted_at)
    && hasText(claim.permission.scope)
    && Array.isArray(claim.limitations)
    && claim.limitations.length > 0
    && claim.limitations.every(hasText)
    && hasText(claim.source_reference)
}

export function getPublishableEvidenceClaims(): PublicEvidenceClaim[] {
  return config.claims.filter(isPublishableEvidenceClaim)
}

export function getEvidencePublicationState() {
  return {
    reviewedAt: config.reviewed_at,
    totalClaims: config.claims.length,
    publishedClaims: getPublishableEvidenceClaims().length,
    defaultPolicy: config.publication_policy.default,
  }
}
