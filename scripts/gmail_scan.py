#!/usr/bin/env python3
"""
gmail_scan.py — Daily Gmail inbox scanner for Bieri Family Hub

Searches Gmail for family-relevant emails (registrations, deadlines,
appointments, payments, schedules), then calls the app's /api/inbox/scan
endpoint to extract structured items via LLM and queue them for review.

Run by a daily cron. Skips emails already processed (deduped by gmail_id).
"""

import json
import subprocess
import sys
import os
from datetime import datetime, timedelta

# ─── Config ───────────────────────────────────────────────────────────────────
# The deployed app backend URL (uses Perplexity proxy)
APP_API = os.environ.get(
    "FAMILY_HUB_API",
    "https://sites.pplx.app/sites/proxy/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwcmVmaXgiOiJ3ZWIvZGlyZWN0LWZpbGVzL2NvbXB1dGVyLzkyZDI5Mzg2LWFmNzEtNDJhNC05ZjdiLTU0NDNmZTg1MzVmOC9mYW1pbHktYWRtaW4vIiwic2lkIjoiOTJkMjkzODYtYWY3MS00MmE0LTlmN2ItNTQ0M2ZlODUzNWY4IiwiZXhwIjoxNzgwMTY5NjUzfQ.h0wG_i0-wgPkg2J9lm3KQpJH0uNU9PYF8PHHgthPGS8"
)

# Search queries — broad enough to catch relevant emails, specific enough
# not to drown in noise. We look back ~3 days to catch anything missed.
SEARCH_QUERIES = [
    "registration deadline",
    "camp registration",
    "payment due",
    "school newsletter",
    "appointment reminder",
    "practice schedule",
    "sports schedule",
    "permission slip",
    "field trip",
    "vaccine reminder",
    "doctor appointment",
    "summer program",
    "enrollment",
    "after:2026-05-27T00:00:00-04:00 (registration OR deadline OR payment OR appointment OR schedule)",
]


def call_tool(source_id: str, tool_name: str, arguments: dict) -> dict:
    payload = json.dumps({"source_id": source_id, "tool_name": tool_name, "arguments": arguments})
    result = subprocess.run(
        ["external-tool", "call", payload],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"Tool error: {result.stderr.strip()}")
    return json.loads(result.stdout)


def search_emails() -> list[dict]:
    """Search Gmail and return deduplicated list of relevant emails."""
    print(f"[gmail_scan] Searching Gmail with {len(SEARCH_QUERIES)} queries...")
    result = call_tool("gcal", "search_email", {"queries": SEARCH_QUERIES})

    # Result may be a JSON string or already parsed
    if isinstance(result, str):
        result = json.loads(result)

    # Response shape: { email_results: { emails: [...] } }
    emails_by_id: dict[str, dict] = {}
    raw = (
        result.get("email_results", {}).get("emails", [])
        if isinstance(result, dict)
        else result
    )

    for email in raw:
        if not isinstance(email, dict):
            continue
        # Connector uses email_id and from_ (note the underscore)
        mid = email.get("email_id") or email.get("id") or email.get("message_id")
        if mid and mid not in emails_by_id:
            emails_by_id[mid] = email

    print(f"[gmail_scan] Found {len(emails_by_id)} unique emails")
    return list(emails_by_id.values())


def post_to_app(email: dict) -> dict:
    """Send a single email to the app's /api/inbox/scan endpoint."""
    import urllib.request

    # Connector field names (from live response shape)
    gmail_id  = email.get("email_id") or email.get("id", "")
    subject   = email.get("subject", "(no subject)")
    sender    = email.get("from_") or email.get("from") or email.get("sender", "")
    date      = email.get("date", "")
    snippet   = email.get("snippet") or email.get("body_preview", "")
    body      = email.get("body") or email.get("body_uncompressed") or ""

    payload = json.dumps({
        "gmail_id": gmail_id,
        "subject":  subject,
        "from":     sender,
        "date":     date,
        "snippet":  snippet[:500],
        "body":     body[:3000] if body else None,
    }).encode()

    # Try the production proxy URL, fall back gracefully
    url = f"{APP_API.rstrip('/')}/api/inbox/scan"
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"[gmail_scan] API error for '{subject}': {e}")
        return {"error": str(e)}


def main():
    print(f"[gmail_scan] Starting — {datetime.now().isoformat()}")

    try:
        emails = search_emails()
    except Exception as e:
        print(f"[gmail_scan] Gmail search failed: {e}", file=sys.stderr)
        sys.exit(1)

    if not emails:
        print("[gmail_scan] No emails found — nothing to process")
        return

    new_items = 0
    skipped   = 0
    errors    = 0

    for email in emails:
        subject = email.get("subject", "(no subject)")
        try:
            result = post_to_app(email)
            if result.get("skipped"):
                skipped += 1
            elif result.get("extracted") and len(result["extracted"]) > 0:
                count = len(result["extracted"])
                new_items += count
                print(f"[gmail_scan] ✓ '{subject}' → {count} item(s) extracted")
            else:
                print(f"[gmail_scan] – '{subject}' → nothing extractable")
        except Exception as e:
            errors += 1
            print(f"[gmail_scan] ✗ '{subject}': {e}")

    print(f"\n[gmail_scan] Done — {new_items} new items, {skipped} skipped (already seen), {errors} errors")

    # Notify the user if anything new was found
    if new_items > 0:
        return new_items  # signal to cron wrapper to send notification


if __name__ == "__main__":
    main()
