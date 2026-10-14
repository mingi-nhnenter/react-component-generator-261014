#!/bin/bash
# PreToolUse(Bash) hook: git commit 명령이면 전체 테스트를 먼저 실행한다.
# 하나라도 실패하면 permissionDecision=deny로 커밋을 차단한다.
# stdin으로 {"tool_name":"Bash","tool_input":{"command":"..."}} JSON을 받는다.

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')

# git commit 명령일 때만 동작한다. "git -c key=val commit", "git add x && git commit"도 잡는다.
if ! printf '%s' "$cmd" | grep -qE '(^|[;&|(]|[[:space:]])git([[:space:]]+-[-A-Za-z]+([[:space:]]+[^[:space:]]+)?)*[[:space:]]+commit([[:space:]]|$)'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# TEST_CMD는 hook 자체를 테스트할 때만 덮어쓴다.
out=$(${TEST_CMD:-bun run test} 2>&1)
status=$?

if [ "$status" -eq 0 ]; then
  exit 0
fi

summary=$(printf '%s\n' "$out" | grep -E 'Test Files|Tests |FAIL|×|Error' | head -8)
reason="커밋 차단: 테스트가 실패했습니다. 실패한 테스트를 고친 뒤 다시 커밋하세요.
$summary"

jq -n --arg reason "$reason" \
  '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$reason}}'
exit 0
