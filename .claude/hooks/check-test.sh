#!/bin/bash
# PostToolUse(Write|Edit) Reminder hook: src/ 또는 server/의 프로덕션 코드를 쓰거나 고쳤는데
# 같은 폴더에 <이름>.test.<확장자>가 없으면 경고를 남긴다. 작업은 차단하지 않는다(exit 0).
# stdin: {"tool_name":"Write","tool_input":{"file_path":"..."},"tool_response":{...}}

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_response.filePath // .tool_input.file_path // empty')
[ -n "$file" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$PWD}"
rel="${file#"$root"/}"

# 검사 대상: src/ 와 server/ 아래 .ts, .tsx 프로덕션 코드만
case "$rel" in
  src/*|server/*) ;;
  *) exit 0 ;;
esac
case "$rel" in
  *.test.*|*.spec.*|*.d.ts|*.css|src/types/*|src/test/*|src/main.tsx|src/assets/*) exit 0 ;;
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

ext="${file##*.}"
base="${file%.$ext}"
test_file="$base.test.$ext"
[ -f "$test_file" ] && exit 0

rel_test="${test_file#"$root"/}"
msg="TDD 알림: $rel 에 대응하는 테스트 파일이 없습니다 ($rel_test). .claude/rules/tdd.md에 따라 테스트를 먼저 작성하세요."

jq -n --arg msg "$msg" \
  '{systemMessage:$msg, hookSpecificOutput:{hookEventName:"PostToolUse", additionalContext:$msg}}'
exit 0
