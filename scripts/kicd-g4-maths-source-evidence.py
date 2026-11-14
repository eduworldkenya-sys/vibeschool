#!/usr/bin/env python3
"""Read-only PDF hash preflight for the KICD-linked Google Drive preview.

The canonical curriculum-authority-intake Edge Function remains the only
path to registering source evidence. This script never approves or uploads it.
"""
import hashlib
import json
import os
import ssl
import sys
from urllib.parse import urlsplit, parse_qs
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

FILE_ID = "1o5tDq16yC0Jj1h6zb9mo3dsxtjqXUk4G"
KICD_CATALOG = "https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-four-designs/"
KICD_PREVIEW = "https://drive.google.com/file/d/" + FILE_ID + "/preview"
DOWNLOAD_URL = "https://drive.usercontent.google.com/download?id=" + FILE_ID + "&export=download&confirm=t"
HISTORICAL_KICD_URL = "https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf"
ADAPTED_URL = "https://kicd.ac.ke/wp-content/uploads/2024/09/GRADE-4-MATHEMATICS.pdf"
MAX_BYTES = 30 * 1024 * 1024
MIN_BYTES = 30 * 1024
ALLOWED_HOSTS = {"drive.google.com", "drive.usercontent.google.com"}

def allowed(url):
    u=urlsplit(url)
    host=(u.hostname or "").lower()
    return u.scheme == "https" and (host in ALLOWED_HOSTS or host.endswith(".googleusercontent.com"))

def main():
    assert KICD_PREVIEW != ADAPTED_URL and KICD_PREVIEW != HISTORICAL_KICD_URL
    assert FILE_ID in KICD_PREVIEW and FILE_ID in DOWNLOAD_URL
    request=Request(DOWNLOAD_URL,headers={
        "User-Agent":"VibeSchool-CurriculumAuthority/1.1",
        "Accept":"application/pdf,application/octet-stream;q=0.9,text/html;q=0.2,*/*;q=0.1",
    })
    length=0
    sha=hashlib.sha256()
    prefix=b""
    try:
        with urlopen(request,timeout=25,context=ssl.create_default_context()) as response:
            resolved=response.geturl()
            if not allowed(resolved):
                raise RuntimeError("SOURCE_REDIRECT_HOST_BLOCKED")
            content_type=response.headers.get("Content-Type","unknown").split(";")[0]
            while True:
                block=response.read(65536)
                if not block: break
                length+=len(block)
                if length>MAX_BYTES: raise RuntimeError("SOURCE_OVERSIZE_BLOCKED")
                if len(prefix)<8: prefix+=block[:8-len(prefix)]
                sha.update(block)
    except (HTTPError,URLError,TimeoutError,RuntimeError) as exc:
        print("SOURCE_FETCH_BLOCKED: "+str(exc),file=sys.stderr)
        return 3
    if not prefix.startswith(b"%PDF-") or length<MIN_BYTES:
        # Never hash or register the HTML/Drive viewer response as an official PDF.
        print("SOURCE_NOT_PDF: content_type="+content_type+"; bytes="+str(length)+
              "; method=Google usercontent download; viewer evidence fallback requires the existing authenticated intake",
              file=sys.stderr)
        return 4
    evidence={
        "schema":"vibeschool.kicd.source-byte-preflight.v1",
        "catalog":KICD_CATALOG,
        "approved_source_url":None,
        "kicd_linked_preview":KICD_PREVIEW,
        "download_url":DOWNLOAD_URL,
        "historical_url":HISTORICAL_KICD_URL,
        "sha256_of_retrieved_pdf":sha.hexdigest(),
        "bytes":length,
        "source_edition_comparison":"NOT_PERFORMED",
        "source_authority_promotion":"NOT_PERFORMED",
        "curriculum_outcome_verification":"NOT_PERFORMED",
    }
    print("SOURCE_PDF_PREFLIGHT="+json.dumps(evidence,sort_keys=True))
    summary=os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary,"a",encoding="utf-8") as out:
            out.write("### KICD-linked Grade 4 Mathematics PDF preflight\\n")
            out.write("The bytes were retrieved from a Google Drive download linked by KICD, not approved as the official source.\\n")
            out.write("SHA-256: `"+evidence["sha256_of_retrieved_pdf"]+"`\\n")
            out.write("No authenticated registration, equivalence test, source promotion or publication.\\n")
    return 0

if __name__=="__main__":
    sys.exit(main())
