-- County options are sourced only from the canonical administrative reference table.
CREATE OR REPLACE FUNCTION public.schools_location_options_public_v1(
  p_county text DEFAULT NULL,
  p_sub_county text DEFAULT NULL
)
RETURNS TABLE(option_type text, value text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH counties AS (
    SELECT DISTINCT county AS value
    FROM public.kenya_administrative_areas
    WHERE county IS NOT NULL AND trim(county) <> ''
  ), subs AS (
    SELECT DISTINCT sub_county AS value
    FROM public.kenya_administrative_areas
    WHERE sub_county IS NOT NULL
      AND (p_county IS NULL OR lower(county)=lower(trim(p_county)))
    UNION
    SELECT DISTINCT sub_county::text
    FROM public.schools
    WHERE deleted_at IS NULL AND status='active'
      AND sub_county IS NOT NULL AND trim(sub_county)<>''
      AND (p_county IS NULL OR lower(county)=lower(trim(p_county)))
  ), wards AS (
    SELECT DISTINCT ward AS value
    FROM public.kenya_administrative_areas
    WHERE ward IS NOT NULL
      AND (p_county IS NULL OR lower(county)=lower(trim(p_county)))
      AND (p_sub_county IS NULL OR lower(sub_county)=lower(trim(p_sub_county)))
    UNION
    SELECT DISTINCT ward::text
    FROM public.schools
    WHERE deleted_at IS NULL AND status='active'
      AND ward IS NOT NULL AND trim(ward)<>''
      AND (p_county IS NULL OR lower(county)=lower(trim(p_county)))
      AND (p_sub_county IS NULL OR lower(sub_county)=lower(trim(p_sub_county)))
  )
  SELECT 'county', value FROM counties
  UNION ALL SELECT 'sub_county', value FROM subs WHERE p_county IS NOT NULL AND trim(p_county)<>''
  UNION ALL SELECT 'ward', value FROM wards WHERE p_county IS NOT NULL AND trim(p_county)<>'' AND p_sub_county IS NOT NULL AND trim(p_sub_county)<>''
  ORDER BY 1,2;
$function$;
GRANT EXECUTE ON FUNCTION public.schools_location_options_public_v1(text,text) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
