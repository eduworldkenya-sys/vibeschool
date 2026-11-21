'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isPlaceValueStudioPayload } from '@/components/learn/PlaceValueResourceStudio'

export type CertifiedInteractiveResource = {
  id: string
  versionId: string
  title: string
  subStrandId: string
}

type Result = {
  scope: string
  status: 'loading' | 'ready' | 'error'
  resources: CertifiedInteractiveResource[]
}

/**
 * Certified-only projection of existing canonical learning resources.
 * The resource root, exact immutable version, and existing RLS are the authority.
 * A candidate version never enters the learner catalogue, even if it has a
 * matching topic ID or appears in an editorial manuscript.
 */
export function useCertifiedInteractiveResources(grade: string, subject: string) {
  const scope = JSON.stringify([grade, subject])
  const [state, setState] = useState<Result>({ scope, status: 'loading', resources: [] })

  useEffect(() => {
    let active = true
    setState({ scope, status: 'loading', resources: [] })

    async function load() {
      try {
        const { data: roots, error: rootError } = await supabase.from('learning_resources')
          .select('id,title,sub_strand_id')
          .eq('grade', grade).eq('subject', subject)
          .eq('status', 'active').eq('visibility', 'public')
          .eq('owner_type', 'platform')
          .eq('asset_kind', 'practical')
          .eq('material_variant', 'demonstration')
          .not('sub_strand_id', 'is', null)
          .order('updated_at', { ascending: false }).limit(80)
        if (rootError) throw rootError
        const ids = (roots ?? []).map(row => row.id)
        if (!ids.length) {
          if (active) setState({ scope, status: 'ready', resources: [] })
          return
        }

        // Release is a version-level property. A public-looking root without
        // a genuine certified version must still remain invisible.
        const { data: versions, error: versionError } = await supabase.from('learning_resource_versions')
          .select('id,resource_id,version,payload')
          .in('resource_id', ids)
          .eq('lifecycle_status', 'certified').not('certified_at', 'is', null)
          .order('version', { ascending: false }).limit(250)
        if (versionError) throw versionError
        const certified = new Map<string,string>()
        for (const version of versions ?? []) {
          if (!certified.has(version.resource_id) && isPlaceValueStudioPayload(version.payload))
            certified.set(version.resource_id, version.id)
        }
        const resources: CertifiedInteractiveResource[] = (roots ?? []).flatMap(root => {
          const versionId = certified.get(root.id)
          return versionId && root.sub_strand_id
            ? [{ id: root.id, versionId, title: root.title, subStrandId: root.sub_strand_id }]
            : []
        })
        if (active) setState({ scope, status: 'ready', resources })
      } catch {
        if (active) setState({ scope, status: 'error', resources: [] })
      }
    }
    void load()
    return () => { active = false }
  }, [scope, grade, subject])

  return state.scope === scope ? state : { scope, status: 'loading' as const, resources: [] as CertifiedInteractiveResource[] }
}

export function certifiedResourceHref(resource: CertifiedInteractiveResource) {
  return `/learn/resources/${encodeURIComponent(resource.id)}?versionId=${encodeURIComponent(resource.versionId)}`
}
