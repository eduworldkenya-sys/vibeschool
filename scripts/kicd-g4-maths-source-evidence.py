#!/usr/bin/env python3
"""Read-only, exact-origin official KICD PDF evidence preflight.

Never uploads, registers, promotes or stores publisher PDF content in Git.
A successful checksum confirms the bytes *retrieved by this runner*, not
KICD approval or the VibeSchool curriculum authority promotion gate.
"""
import hashlib
import json
import os
import re
import ssl
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

SOURCE_URL = "https://drive.google.com/uc?export=download&id=1o5tDq16yC0Jj1h6zb9mo3dsxtjqXUk4G"\nKICD_LISTING = "https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-four-designs/"\nHISTORICAL_URL = "https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf"
ADAPTED_SOURCE = "https://kicd.ac.ke/wp-content/uploads/2024/09/GRADE-4-MATHEMATICS.pdf"
MAX_BYTES = 30 * 1024 * 1024
MIN_BYTES = 30 * 1024

def main() -> int:
    if SOURCE_URL == ADAPTED_SOURCE:
        raise AssertionError("Regular and adapted curriculum authorities must differ")
    request = Request(SOURCE_URL, headers={
        "User-Agent": "VibeSchool-Curriculum-Source-Evidence/1.0 (read-only)",
        "Accept": "application/pdf",
    })
    digest = hashlib.sha256()
    nbytes = 0
    first_bytes = b""
    try:
        with urlopen(request, timeout=25, context=ssl.create_default_context()) as response:
            final_url = response.geturl()
            if not (final_url.startswith("https://drive.google.com/") or final_url.startswith("https://drive.usercontent.google.com/") or ".googleusercontent.com/" in final_url):
                raise RuntimeError("Source URL redirected; authority identity requires separate review: " + final_url)
            while True:
                chunk = response.read(64 * 1024)
                if not chunk:
                    break
                nbytes += len(chunk)
                if nbytes > MAX_BYTES:
                    raise RuntimeError("Source exceeds preflight byte limit")
                if len(first_bytes) < 10:
                    first_bytes += chunk[:10-len(first_bytes)]
                digest.update(chunk)
    except (HTTPError, URLError, TimeoutError) as error:
        print("SOURCE_RETRIEVAL_BLOCKED: " + repr(error), file=sys.stderr)
        return 3
    if not first_bytes.startswith(b"%PDF-") or nbytes < MIN_BYTES:
        print("SOURCE_IDENTITY_BLOCKED: response was not a complete-looking PDF", file=sys.stderr)
        return 4
    evidence = {
        "schema": "vibeschool.kicd.readonly-source-observation.v1",
        "url": SOURCE_URL,\n        "origin_listing": KICD_LISTING,\n        "historical_kicd_url": HISTORICAL_URL,\n        "historical_pdf_equivalence": "NOT_VERIFIED",
        "target": "KICD Grade 4 regular Mathematics, revised 2024",
        "sha256_of_retrieved_bytes": digest.hexdigest(),
        "size_bytes": nbytes,
        "pdf_header": first_bytes[:8].decode("ascii", errors="replace"),
        "authority_promotion": "NOT_PERFORMED",
        "publisher_approval": "NOT_INFERRED",
        "source_snapshot": "NOT_REGISTERED",
        "downloaded_pdf_committed": False,
    }
    print("KICD_SOURCE_EVIDENCE=" + json.dumps(evidence, sort_keys=True))
    with open(os.environ.get("GITHUB_STEP_SUMMARY", os.devnull), "a", encoding="utf-8") as summary:
        summary.write("### KICD regular Grade 4 Mathematics source observation\n")
        summary.write("Retrieved PDF bytes and calculated SHA-256 (non-promoting preflight only).\n")
        summary.write("Source: `" + SOURCE_URL + "`\n")
        summary.write("SHA-256: `" + evidence["sha256_of_retrieved_bytes"] + "`\n")
        summary.write("Size: " + str(nbytes) + " bytes. No official approval, certification or publication.\n")
    return 0

if __name__ == "__main__":
    sys.exit(main())
