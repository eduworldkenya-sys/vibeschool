#!/usr/bin/env bash
set -euo pipefail

OUT="READ_001_CORE"
mkdir -p "$OUT"

extract () {
    FILE="$1"
    NAME=$(echo "$FILE" | sed 's/\//__/g')
    echo "=================================================="
    echo "$FILE"
    echo "=================================================="

    if [ ! -f "$FILE" ]; then
        echo "MISSING: $FILE"
        return
    fi

    cp "$FILE" "$OUT/$NAME"

    echo
    echo "----- LINE COUNT -----"
    wc -l "$FILE"

    echo
    echo "----- IMPORTS -----"
    grep '^import ' "$FILE" || true

    echo
    echo "----- SUPABASE REFERENCES -----"
    grep -nE 'supabase|rpc|from\(|storage|channel|on\(' "$FILE" || true

    echo
    echo "----- REACT HOOKS -----"
    grep -nE 'useState|useEffect|useMemo|useCallback|useRef|useReducer' "$FILE" || true

    echo
    echo "----- COMPONENT EXPORT -----"
    grep -nE 'export default|export function|export const' "$FILE" || true

    echo
}

extract "app/read/textbook/[publicationId]/page.tsx"
extract "components/read/StudyCapturePanel.tsx"
extract "components/read/ReadingAnalyticsTracker.tsx"
extract "components/global/publish/PublicationEditor.tsx"
extract "components/vibelearn/VibeLearnShellWrapper.tsx"

echo
echo "======================================="
echo "FILES COPIED TO:"
echo "$OUT"
echo "======================================="
