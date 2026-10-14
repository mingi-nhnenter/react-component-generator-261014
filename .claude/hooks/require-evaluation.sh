#!/bin/bash
# Stop hook: src/ 또는 server/의 프로덕션 코드에 아직 평가받지 않은 변경이 있으면
# 턴 종료를 한 번 막고 evaluator 서브에이전트 검증을 요구한다.
# 같은 변경 상태에 대해서는 한 번만 막는다(상태 서명을 임시 파일에 기록).
# stdin: {"session_id":"...","stop_hook_active":true|false,...}

input=$(cat)
active=$(printf '%s' "$input" | jq -r '.stop_hook_active // false')
# 이 hook이 막아서 이어진 턴이 다시 끝나는 경우에는 막지 않는다(무한 반복 방지).
[ "$active" = "true" ] && exit 0

root="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$root" || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# 평가 대상: 커밋되지 않은 src/, server/의 .ts, .tsx 프로덕션 코드 (테스트, 타입, 설정 제외)
changes=$(
  { git diff HEAD --name-only -- src server; git ls-files --others --exclude-standard -- src server; } 2>/dev/null \
  | grep -E '\.(ts|tsx)$' \
  | grep -vE '\.test\.|\.spec\.|\.d\.ts$|^src/(types|test|assets)/|^src/main\.tsx$' \
  | sort -u
)
[ -z "$changes" ] && exit 0

# 변경 상태 서명: 파일 목록과 내용. 같은 서명이면 이미 평가를 요구한 상태다.
sig=$( { printf '%s\n' "$changes"; printf '%s\n' "$changes" | xargs cat 2>/dev/null; } | shasum | cut -c1-16)
state="${TMPDIR:-/tmp}/claude-evaluator-$(printf '%s' "$root" | shasum | cut -c1-12)"
if [ -f "$state" ] && [ "$(cat "$state")" = "$sig" ]; then
  exit 0
fi
printf '%s' "$sig" > "$state"

reason="평가되지 않은 프로덕션 코드 변경이 있습니다. 종료하기 전에 evaluator 서브에이전트(읽기 전용)에게 아래 파일의 적대적 리뷰를 위임하고, '반드시 고칠 것'이 있으면 반영한 뒤 결과를 사용자에게 요약 보고하세요.
$changes"

jq -n --arg reason "$reason" '{decision:"block", reason:$reason}'
exit 0
