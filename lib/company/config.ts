import { getHQProductConfig } from "@/lib/hq/operating"

/**
 * Read a centrally locked HQ product configuration.
 * Product code should use this helper (or the underlying RPC server-side)
 * instead of duplicating company policy as hardcoded constants.
 */
export async function getCompanyConfig<T>(productKey: string, configKey: string, fallback: T): Promise<T> {
  try {
    const value = await getHQProductConfig(productKey, configKey)
    return (value === null || value === undefined ? fallback : value) as T
  } catch {
    return fallback
  }
}
