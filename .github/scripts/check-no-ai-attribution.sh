#!/usr/bin/env bash
# Fails when text carries AI attribution: an AI Co-Authored-By trailer or a
# "Generated with <tool>" footer. Reads the files given as arguments, or stdin.
# Human co-authors are untouched. Used by the commit-msg hook and by CI.
set -euo pipefail

ai='(claude|anthropic|codex|openai|chatgpt|gpt-[0-9]|copilot|cursor|gemini|devin|aider|windsurf)'
patterns=(
  "^[[:space:]]*co-authored-by:.*${ai}"
  "^[[:space:]]*co-authored-by:.*noreply@(anthropic|openai)\.com"
  "generated (with|by) .*${ai}"
  "🤖 generated"
)

# Comment lines are git's editor template, not part of the message.
text=$(cat "$@" | grep -v '^#' || true)

status=0
for p in "${patterns[@]}"; do
  if hits=$(printf '%s\n' "$text" | grep -inE -- "$p"); then
    printf 'AI attribution is not allowed (foundation: CORE.md, working agreements):\n%s\n' "$hits" >&2
    status=1
  fi
done
exit "$status"
