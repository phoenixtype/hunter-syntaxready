#!/usr/bin/env bash
# linear.sh — CLI helper for Linear issue management (Hunter-ai workspace)
# Usage:
#   ./scripts/linear.sh list                       # List open issues
#   ./scripts/linear.sh show HUN-28                # Show issue details
#   ./scripts/linear.sh status HUN-28 "In Progress" # Update status
#   ./scripts/linear.sh comment HUN-28 "Fixed it"  # Add a comment
#   ./scripts/linear.sh create "Title" "Description" # Create new issue

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load API key from .env.local
if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
  LINEAR_API_KEY=$(grep '^LINEAR_API_KEY=' "$PROJECT_ROOT/.env.local" | cut -d'"' -f2)
  LINEAR_TEAM_ID=$(grep '^LINEAR_TEAM_ID=' "$PROJECT_ROOT/.env.local" | cut -d'"' -f2)
else
  echo "Error: .env.local not found. Add LINEAR_API_KEY and LINEAR_TEAM_ID to .env.local"
  exit 1
fi

if [[ -z "${LINEAR_API_KEY:-}" ]]; then
  echo "Error: LINEAR_API_KEY not set in .env.local"
  exit 1
fi

TEAM_KEY="HUN"
API="https://api.linear.app/graphql"

gql() {
  local query="$1"
  local variables="${2:-}"
  
  python3 - "$LINEAR_API_KEY" "$API" "$query" "$variables" <<'EOF'
import os, json, subprocess, sys

api_key = sys.argv[1]
api_url = sys.argv[2]
q = sys.argv[3]
v_raw = sys.argv[4]

try:
    v = json.loads(v_raw) if v_raw else {}
except Exception as e:
    sys.stderr.write(f"VARS_PARSE_ERROR: {e}\n")
    sys.stderr.write(f"RAW_VARS: {v_raw}\n")
    v = {}

payload = json.dumps({"query": q, "variables": v})
res = subprocess.run(
    ["curl", "-s", "-X", "POST", api_url,
     "-H", "Content-Type: application/json",
     "-H", "Authorization: " + api_key,
     "-d", payload],
    capture_output=True, text=True
)
if res.returncode == 0:
    print(res.stdout, end="")
else:
    sys.stderr.write(res.stderr)
    sys.exit(1)
EOF
}

# Parse "HUN-28" into number 28
parse_issue_number() {
  echo "$1" | sed 's/^[A-Z]*-//'
}

# Resolve identifier like "HUN-28" to its UUID
resolve_issue_id() {
  local identifier="$1"
  local num
  num=$(parse_issue_number "$identifier")
  gql "{ issues(filter: { number: { eq: $num }, team: { key: { eq: \"$TEAM_KEY\" } } }, first: 1) { nodes { id } } }" \
    | python3 -c 'import sys,json; nodes=json.load(sys.stdin).get("data",{}).get("issues",{}).get("nodes",[]); print(nodes[0]["id"] if nodes else "")' 2>/dev/null
}

cmd_list() {
  local filter="${1:-open}"
  local state_filter=""

  case "$filter" in
    open)   state_filter='nin: ["completed", "canceled"]' ;;
    done)   state_filter='eq: "completed"' ;;
    all)    state_filter='' ;;
    *)      state_filter="eq: \"$filter\"" ;;
  esac

  local query
  if [[ -n "$state_filter" ]]; then
    query="{ team(id: \"$LINEAR_TEAM_ID\") { issues(filter: { state: { type: { $state_filter } } }, orderBy: createdAt) { nodes { identifier title priorityLabel state { name } createdAt } } } }"
  else
    query="{ team(id: \"$LINEAR_TEAM_ID\") { issues(orderBy: createdAt) { nodes { identifier title priorityLabel state { name } createdAt } } } }"
  fi

  gql "$query" | python3 -c '
import sys, json
data = json.load(sys.stdin)
issues = data.get("data",{}).get("team",{}).get("issues",{}).get("nodes",[])
if not issues:
    print("No issues found.")
else:
    print("%-10s %-14s %-12s %s" % ("ID", "Status", "Priority", "Title"))
    print("-" * 70)
    for i in issues:
        ident = i["identifier"]
        state = i["state"]["name"]
        prio = i["priorityLabel"]
        title = i["title"]
        print(f"{ident:<10} {state:<14} {prio:<12} {title}")
'
}

cmd_show() {
  local identifier="$1"
  local num
  num=$(parse_issue_number "$identifier")

  local query="{ issues(filter: { number: { eq: $num }, team: { key: { eq: \"$TEAM_KEY\" } } }, first: 1) { nodes { identifier title description state { name } priorityLabel assignee { name } createdAt labels { nodes { name } } comments { nodes { body createdAt user { name } } } } } }"

  gql "$query" | python3 -c '
import sys, json
data = json.load(sys.stdin)
nodes = data.get("data",{}).get("issues",{}).get("nodes",[])
if not nodes:
    print("Issue not found.")
    sys.exit(1)
i = nodes[0]
ident = i["identifier"]
title = i["title"]
state = i["state"]["name"]
prio = i["priorityLabel"]
print(f"[{ident}] {title}")
print(f"Status: {state}  |  Priority: {prio}")
assignee = i.get("assignee") or {}
if assignee:
    aname = assignee.get("name", "Unassigned")
    print(f"Assignee: {aname}")
labels = [l["name"] for l in i.get("labels",{}).get("nodes",[])]
if labels:
    joined = ", ".join(labels)
    print(f"Labels: {joined}")
print()
desc = i.get("description","No description")
if desc: print(desc)
comments = i.get("comments",{}).get("nodes",[])
if comments:
    n = len(comments)
    print(f"\n--- Comments ({n}) ---")
    for c in comments:
        cuser = (c.get("user") or {}).get("name","Unknown")
        cdate = c["createdAt"][:10]
        print(f"\n[{cuser}] {cdate}")
        print(c["body"])
'
}

cmd_status() {
  local identifier="$1"
  local target_state="$2"
  export TARGET_STATE="$target_state"

  local issue_id
  issue_id=$(resolve_issue_id "$identifier")

  if [[ -z "$issue_id" ]]; then
    echo "Error: Issue $identifier not found."
    exit 1
  fi

  # Get available states
  local states_data
  states_data=$(gql "{ team(id: \"$LINEAR_TEAM_ID\") { states { nodes { id name } } } }")

  local state_id
  state_id=$(echo "$states_data" | python3 -c '
import sys, json, os
data = json.load(sys.stdin)
target = os.environ["TARGET_STATE"].lower()
for s in data["data"]["team"]["states"]["nodes"]:
    if s["name"].lower() == target:
        print(s["id"])
        break
' 2>/dev/null)

  if [[ -z "$state_id" ]]; then
    echo "Error: State '$target_state' not found. Available states:"
    echo "$states_data" | python3 -c '
import sys,json
for s in json.load(sys.stdin)["data"]["team"]["states"]["nodes"]:
    n = s["name"]
    print(f"  - {n}")
'
    exit 1
  fi

  gql "mutation { issueUpdate(id: \"$issue_id\", input: { stateId: \"$state_id\" }) { success issue { identifier title state { name } } } }" \
    | python3 -c '
import sys, json
data = json.load(sys.stdin)
if data.get("data",{}).get("issueUpdate",{}).get("success"):
    i = data["data"]["issueUpdate"]["issue"]
    ident = i["identifier"]
    state = i["state"]["name"]
    print(f"Updated {ident} -> {state}")
else:
    print("Failed to update issue.")
    print(json.dumps(data, indent=2))
'
}

cmd_comment() {
  local identifier="$1"
  local body="$2"

  local issue_id
  issue_id=$(resolve_issue_id "$identifier")

  if [[ -z "$issue_id" ]]; then
    echo "Error: Issue $identifier not found."
    exit 1
  fi

  local variables
  variables=$(python3 -c "import json,sys; print(json.dumps({'issueId': sys.argv[1], 'body': sys.argv[2]}))" "$issue_id" "$body")

  gql 'mutation($issueId: String!, $body: String!) { commentCreate(input: { issueId: $issueId, body: $body }) { success } }' "$variables" \
    | python3 -c "
import sys, json
identifier = '$identifier'
data = json.load(sys.stdin)
if data.get('data',{}).get('commentCreate',{}).get('success'):
    print(f'Comment added to {identifier}')
else:
    print('Failed to add comment.')
    print(json.dumps(data, indent=2))
"
}

cmd_create() {
  local title="$1"
  local description="${2:-}"

  local variables
  variables=$(python3 -c "import json,sys; print(json.dumps({'teamId': sys.argv[1], 'title': sys.argv[2], 'desc': sys.argv[3] if len(sys.argv) > 3 else ''}))" "$LINEAR_TEAM_ID" "$title" "$description")

  gql 'mutation($teamId: String!, $title: String!, $desc: String) { issueCreate(input: { teamId: $teamId, title: $title, description: $desc }) { success issue { identifier title state { name } } } }' "$variables" \
    | python3 -c '
import sys, json
data = json.load(sys.stdin)
if data.get("data",{}).get("issueCreate",{}).get("success"):
    i = data["data"]["issueCreate"]["issue"]
    ident = i["identifier"]
    title = i["title"]
    state = i["state"]["name"]
    print(f"Created {ident}: {title} [{state}]")
else:
    print("Failed to create issue.")
    print(json.dumps(data, indent=2))
'
}

# --- Main ---
case "${1:-help}" in
  list)    cmd_list "${2:-open}" ;;
  show)    cmd_show "${2:?Usage: linear.sh show <ID>}" ;;
  status)  cmd_status "${2:?Usage: linear.sh status <ID> <State>}" "${3:?Provide target state}" ;;
  comment) cmd_comment "${2:?Usage: linear.sh comment <ID> <body>}" "${3:?Provide comment body}" ;;
  create)  cmd_create "${2:?Usage: linear.sh create <title> [description]}" "${3:-}" ;;
  help|*)
    cat <<'USAGE'
Linear CLI — Hunter-ai workspace

Commands:
  list [filter]                    List issues (default: open)
                                   Filters: open, done, all
  show <ID>                        Show issue details + comments
  status <ID> <State>              Update issue status
                                   States: Backlog, Todo, In Progress, In Review, Done, Canceled
  comment <ID> "message"           Add a comment to an issue
  create "title" ["description"]   Create a new issue

Examples:
  ./scripts/linear.sh list
  ./scripts/linear.sh show HUN-28
  ./scripts/linear.sh status HUN-28 "In Progress"
  ./scripts/linear.sh comment HUN-28 "Deployed the fix"
  ./scripts/linear.sh create "Fix login bug" "Users can't login on Safari"
USAGE
    ;;
esac
