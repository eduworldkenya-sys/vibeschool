import {
  buildCanonicalLearningAssetIdentity,
  type CanonicalLearningAssetIdentityInput,
} from '@/lib/content/canonicalLearningAssetIdentity'

export interface CertifiedCanonicalLearningAsset {
  resourceId: string
  resourceVersionId: string
  version: number
  familyKey: string
  assetKind: string
  purpose: string
  payloadFormat: string
  payload: unknown
  contentSha256: string
  certificationPolicyVersion: string
  certifiedAt: string
}

export interface CanonicalLearningAssetStore {
  /**
   * Returns only a currently certified reusable version. Candidate, verified,
   * rejected, retired and legacy/unreviewed content must resolve as a miss.
   */
  findCertifiedByFamilyKey(
    familyKey: string,
  ): Promise<CertifiedCanonicalLearningAsset | null>
}

export type CanonicalLearningAssetLookupResult =
  | {
      kind: 'hit'
      familyKey: string
      asset: CertifiedCanonicalLearningAsset
      generationAllowed: false
    }
  | {
      kind: 'miss'
      familyKey: string
      generationAllowed: true
    }

/**
 * Canonical reuse gate that must execute before any model/search spend.
 *
 * This module deliberately knows nothing about Groq, Tavily, Vibe Credits,
 * teacher identity, schools, classes or timetable occurrences. It resolves
 * reusable educational substance only. Delivery personalization happens
 * after a hit (or after a newly certified candidate is produced).
 */
export async function lookupCanonicalLearningAssetBeforeGeneration({
  identity,
  store,
}: {
  identity: CanonicalLearningAssetIdentityInput
  store: CanonicalLearningAssetStore
}): Promise<CanonicalLearningAssetLookupResult> {
  const resolvedIdentity = buildCanonicalLearningAssetIdentity(identity)
  const asset = await store.findCertifiedByFamilyKey(
    resolvedIdentity.familyKey,
  )

  if (!asset) {
    return {
      kind: 'miss',
      familyKey: resolvedIdentity.familyKey,
      generationAllowed: true,
    }
  }

  if (asset.familyKey !== resolvedIdentity.familyKey) {
    throw new Error(
      'canonicalLearningAssetLookup: store returned an asset for the wrong family key.',
    )
  }

  return {
    kind: 'hit',
    familyKey: resolvedIdentity.familyKey,
    asset,
    generationAllowed: false,
  }
}
