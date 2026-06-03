#!/bin/bash
# Family Hub — server lifecycle + email POSTing
#
# Usage: bash /home/user/workspace/post_emails.sh /tmp/emails_to_scan.json
#
# Expects a JSON file at $1 with shape:
#   [{"gmail_id":"...","subject":"...","from":"...","date":"...","snippet":"...","body":"..."},...]
#
# Starts the Express server, POSTs each email to /api/inbox/scan,
# prints a JSON summary, then kills the server.
# All happens in one shell — server stays alive for the duration.

set -e

EMAILS_FILE="${1:-/tmp/emails_to_scan.json}"
LOG=/tmp/family-hub-scan.log
RESULTS_FILE=/tmp/scan_results.json

exec > >(tee -a "$LOG") 2>&1
echo "=== post_emails.sh started $(date) ==="

if [ ! -f "$EMAILS_FILE" ]; then
  echo "ERROR: emails file not found: $EMAILS_FILE"
  exit 1
fi

EMAIL_COUNT=$(python3 -c "import json,sys; print(len(json.load(open('$EMAILS_FILE'))))")
echo "Emails to process: $EMAIL_COUNT"

if [ "$EMAIL_COUNT" -eq 0 ]; then
  echo "No emails — nothing to do."
  echo '{"total_extracted":0,"results":[]}' > "$RESULTS_FILE"
  exit 0
fi

# ── Build ──────────────────────────────────────────────────────────────────
cd /home/user/workspace/family-admin
echo "Building..."
npm run build 2>&1 | tail -3

# ── Start server ───────────────────────────────────────────────────────────
fuser -k 5000/tcp 2>/dev/null || true
sleep 1
NODE_ENV=production node dist/index.cjs &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait up to 15s
for i in $(seq 1 15); do
  if curl -sf http://localhost:5000/api/categories > /dev/null 2>&1; then
    echo "Server ready after ${i}s ✓"
    break
  fi
  if [ $i -eq 15 ]; then
    echo "ERROR: server failed to start"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

# ── POST each email ────────────────────────────────────────────────────────
python3 - <<'PYEOF'
import json, urllib.request, sys

EMAILS_FILE = "/tmp/emails_to_scan.json"
RESULTS_FILE = "/tmp/scan_results.json"
API = "http://localhost:5000/api/inbox/scan"

emails = json.load(open(EMAILS_FILE))
results = []
total_extracted = 0

for email in emails:
    payload = json.dumps({
        "gmail_id": email.get("gmail_id") or email.get("email_id", ""),
        "subject":  email.get("subject", ""),
        "from":     email.get("from", "") or email.get("from_", ""),
        "date":     email.get("date", ""),
        "snippet":  (email.get("snippet") or "")[:500],
        "body":     (email.get("body") or "")[:3000],
    }).encode()

    try:
        req = urllib.request.Request(API, data=payload,
                                     headers={"Content-Type": "application/json"})
        resp = json.loads(urllib.request.urlopen(req, timeout=30).read())
    except Exception as e:
        resp = {"error": str(e)}

    subject = email.get("subject", "(no subject)")
    if resp.get("skipped"):
        print(f"  SKIP  {subject}")
        results.append({"subject": subject, "status": "skipped"})
    elif "extracted" in resp:
        n = len(resp["extracted"])
        total_extracted += n
        print(f"  +{n}    {subject}")
        results.append({"subject": subject, "status": "extracted", "count": n,
                         "items": resp["extracted"]})
    else:
        print(f"  ERR   {subject} → {resp}")
        results.append({"subject": subject, "status": "error", "detail": str(resp)})

summary = {"total_extracted": total_extracted, "results": results}
json.dump(summary, open(RESULTS_FILE, "w"), indent=2)
print(f"\n[scan] Done — {total_extracted} new items extracted from {len(emails)} emails")
PYEOF

# ── Shut down server ───────────────────────────────────────────────────────
kill $SERVER_PID 2>/dev/null || true
echo "=== post_emails.sh finished $(date) ==="
