#!/usr/bin/env bash
# Spec 022: starts the triage agent. The workflow and the local test run use
# exactly this call, so both have the same instruction and the same limits.
#
#   bash scripts/feedback-triage/agent.sh
#
# - Prompt: agents/feedback-triage.md (via stdin)
# - Tools: only Read, Glob, Grep and Write/Edit below triage-out/
#   (agents/feedback-triage.settings.json). No Bash, no web, no MCP servers.
# - --restricted ignores user/project/local settings and keeps file tools
#   inside the working directory.
# - The log (stream-json) goes to $PROTOKOLL (default: triage-out/protokoll.jsonl).
#   It contains feedback texts: never into a public place.
# - Exit code = exit code of claude.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

protokoll="${PROTOKOLL:-triage-out/protokoll.jsonl}"
mkdir -p triage-out/entwuerfe triage-out/skizzen

claude -p \
  --model opus \
  --max-turns 60 \
  --restricted \
  --tools "Read,Glob,Grep,Write,Edit" \
  --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
  --settings agents/feedback-triage.settings.json \
  --permission-mode dontAsk \
  --permission-prompts none \
  --no-session-persistence \
  --no-chrome \
  --output-format stream-json --verbose \
  < agents/feedback-triage.md > "$protokoll"
