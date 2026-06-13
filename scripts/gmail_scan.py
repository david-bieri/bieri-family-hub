#!/usr/bin/env python3
"""
gmail_scan.py — Manus Sandbox Gmail Scanner for Bieri Family Hub

╔══════════════════════════════════════════════════════════════════════════════╗
║  THIS SCRIPT RUNS IN THE MANUS SANDBOX ONLY (daily cron at 7am EDT)        ║
║                                                                            ║
║  It uses the Manus `external-tool` CLI to access the Gmail connector.      ║
║  It does NOT run on the Render server — for manual scans on Render,        ║
║  the app uses direct IMAP (see server/gmailScanner.ts).                    ║
║                                                                            ║
║  Cron Configuration (Manus/Perplexity):                                    ║
║    Schedule: 0 11 * * * (7:00 AM EDT / 11:00 UTC daily)                    ║
║    Command:  python3 /path/to/scripts/gmail_scan.py                        ║
║    Env vars: FAMILY_HUB_API=https://bieri-family-hub.onrender.com          ║
║              GMAIL_LOOKBACK_DAYS=3 (optional, default 3)                   ║
║                                                                            ║
║  The `external-tool` binary is provided by the Manus sandbox environment   ║
║  and connects to the user's Gmail via the configured Gmail connector.      ║
╚══════════════════════════════════════════════════════════════════════════════╝

CAPABILITIES:
  1. Searches Gmail for family-relevant emails (via Manus Gmail connector)
  2. Downloads and processes attachments (PDF, ICS, text/HTML)
  3. Sends enriched email data to the app's /api/inbox/scan endpoint
  4. Deduplicates by gmail_id to avoid re-processing

FLOW:
  external-tool (Manus) → Gmail API → emails → POST to Render backend → LLM extraction
"""

import json
import subprocess
import sys
import os
import base64
from datetime import datetime, timedelta, timezone

# ─── Config ───────────────────────────────────────────────────────────────────
APP_API = os.environ.get("FAMILY_HUB_API", "https://bieri-family-hub.onrender.com")
LOOK_BACK_DAYS = int(os.environ.get("GMAIL_LOOKBACK_DAYS", "3"))
_since = (datetime.now(timezone.utc) - timedelta(days=LOOK_BACK_DAYS)).strftime("%Y/%m/%d")

# Search queries — broad enough to catch relevant emails
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
    "birthday party invitation",
    "RSVP",
    "maintenance reminder",
    "home repair",
    f"after:{_since} (registration OR deadline OR payment OR appointment OR schedule OR invitation)",
]

# Attachment types we can process
PROCESSABLE_MIME_TYPES = {
    "application/pdf",
    "text/calendar",
    "text/plain",
    "text/html",
    "text/csv",
    "application/ics",
}

PROCESSABLE_EXTENSIONS = {".pdf", ".ics", ".txt", ".html", ".htm", ".csv"}

# Max attachment size to download (5MB)
MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024


def call_tool(source_id: str, tool_name: str, arguments: dict) -> dict:
    """
    Call a Manus connector tool via the external-tool CLI.
    This binary is only available in the Manus sandbox environment.
    """
    payload = json.dumps({"source_id": source_id, "tool_name": tool_name, "arguments": arguments})
    result = subprocess.run(
        ["external-tool", "call", payload],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"Tool error: {result.stderr.strip()}")
    return json.loads(result.stdout)


def search_emails() -> list[dict]:
    """Search Gmail via the Manus connector and return deduplicated list of relevant emails."""
    print(f"[gmail_scan] Searching Gmail with {len(SEARCH_QUERIES)} queries...")
    print(f"[gmail_scan] Looking back {LOOK_BACK_DAYS} days (since {_since})")
    result = call_tool("gcal", "search_email", {"queries": SEARCH_QUERIES})

    if isinstance(result, str):
        result = json.loads(result)

    emails_by_id: dict[str, dict] = {}
    raw = (
        result.get("email_results", {}).get("emails", [])
        if isinstance(result, dict)
        else result
    )

    for email in raw:
        if not isinstance(email, dict):
            continue
        mid = email.get("email_id") or email.get("id") or email.get("message_id")
        if mid and mid not in emails_by_id:
            emails_by_id[mid] = email

    print(f"[gmail_scan] Found {len(emails_by_id)} unique emails")
    return list(emails_by_id.values())


def get_email_attachments(email_id: str) -> list[dict]:
    """Fetch attachment metadata and content for an email via the Manus connector."""
    attachments = []
    try:
        result = call_tool("gcal", "get_email_attachments", {"email_id": email_id})
        if isinstance(result, str):
            result = json.loads(result)

        att_list = result.get("attachments", []) if isinstance(result, dict) else []

        for att in att_list:
            filename = att.get("filename", "")
            mime_type = att.get("mime_type", "")
            size = att.get("size", 0)
            att_id = att.get("attachment_id") or att.get("id", "")

            # Check if we can/should process this attachment
            ext = os.path.splitext(filename)[1].lower()
            if mime_type not in PROCESSABLE_MIME_TYPES and ext not in PROCESSABLE_EXTENSIONS:
                continue
            if size > MAX_ATTACHMENT_SIZE:
                print(f"[gmail_scan]   Skipping attachment '{filename}' — too large ({size} bytes)")
                continue

            # Download the attachment content
            try:
                content_result = call_tool("gcal", "get_attachment_content", {
                    "email_id": email_id,
                    "attachment_id": att_id
                })
                if isinstance(content_result, str):
                    content_result = json.loads(content_result)

                content_b64 = content_result.get("content_base64", "")
                content_text = content_result.get("content_text", "")

                attachments.append({
                    "filename": filename,
                    "mime_type": mime_type,
                    "content_base64": content_b64,
                    "content_text": content_text,
                })
                print(f"[gmail_scan]   Downloaded attachment: {filename} ({mime_type})")
            except Exception as e:
                print(f"[gmail_scan]   Failed to download '{filename}': {e}")

    except Exception as e:
        # Attachment fetching is optional — don't fail the whole scan
        if "not found" not in str(e).lower() and "not implemented" not in str(e).lower():
            print(f"[gmail_scan]   Attachment fetch error: {e}")

    return attachments


def post_to_app(email: dict, attachments: list[dict] = None) -> dict:
    """Send a single email (with attachments) to the app's /api/inbox/scan endpoint."""
    import urllib.request

    gmail_id = email.get("email_id") or email.get("id", "")
    subject = email.get("subject", "(no subject)")
    sender = email.get("from_") or email.get("from") or email.get("sender", "")
    date = email.get("date", "")
    snippet = email.get("snippet") or email.get("body_preview", "")
    body = email.get("body") or email.get("body_uncompressed") or ""
    html_body = email.get("html_body") or email.get("body_html") or ""

    payload = json.dumps({
        "gmail_id": gmail_id,
        "subject": subject,
        "from": sender,
        "date": date,
        "snippet": snippet[:500],
        "body": body[:4000] if body else None,
        "html_body": html_body[:8000] if html_body else None,
        "attachments": attachments or [],
    }).encode()

    url = f"{APP_API.rstrip('/')}/api/inbox/scan"
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"[gmail_scan] API error for '{subject}': {e}")
        return {"error": str(e)}


def main():
    print(f"[gmail_scan] Starting — {datetime.now().isoformat()}")
    print(f"[gmail_scan] Target API: {APP_API}")
    print(f"[gmail_scan] Enhanced mode: attachment parsing enabled")

    try:
        emails = search_emails()
    except FileNotFoundError:
        print("[gmail_scan] ERROR: 'external-tool' binary not found.", file=sys.stderr)
        print("[gmail_scan] This script must run in the Manus sandbox environment.", file=sys.stderr)
        print("[gmail_scan] For manual scans on Render, use the IMAP-based scanner instead.", file=sys.stderr)
        print("[gmail_scan] Set GMAIL_USER and GMAIL_APP_PASSWORD in Render env vars.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[gmail_scan] Gmail search failed: {e}", file=sys.stderr)
        sys.exit(1)

    if not emails:
        print("[gmail_scan] No emails found — nothing to process")
        return

    new_items = 0
    skipped = 0
    errors = 0
    attachments_processed = 0

    for email in emails:
        subject = email.get("subject", "(no subject)")
        email_id = email.get("email_id") or email.get("id", "")

        try:
            # Fetch attachments for this email
            attachments = []
            if email_id:
                attachments = get_email_attachments(email_id)
                if attachments:
                    attachments_processed += len(attachments)

            result = post_to_app(email, attachments)

            if result.get("skipped"):
                skipped += 1
            elif result.get("extracted") and len(result["extracted"]) > 0:
                count = len(result["extracted"])
                new_items += count
                att_note = f" (+{len(attachments)} attachments)" if attachments else ""
                print(f"[gmail_scan] ✓ '{subject}' → {count} item(s) extracted{att_note}")
            else:
                print(f"[gmail_scan] – '{subject}' → nothing extractable")
        except Exception as e:
            errors += 1
            print(f"[gmail_scan] ✗ '{subject}': {e}")

    print(f"\n[gmail_scan] Done — {new_items} new items, {skipped} skipped (already seen), {errors} errors")
    if attachments_processed > 0:
        print(f"[gmail_scan] Processed {attachments_processed} attachments total")

    if new_items > 0:
        return new_items


if __name__ == "__main__":
    main()
