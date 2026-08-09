import { getHQProductConfig } from "@/lib/hq/operating"

/** Read centrally controlled HQ product configuration with a safe fallback. */
export async function getCompanyConfig<T>(productKey: string, configKey: string, fallback: T): Promise<T> {
  try {
    const value = await getHQProductConfig(productKey, configKey)
    return (value === null || value === undefined ? fallback : value) as T
  } catch {
    return fallback
  }
}
