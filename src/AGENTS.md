# src/AGENTS.md

## Module Context

브라우저 UI다. 서버와는 `/api/config`, `/api/generate/stream` 두 요청으로만 통신하고, 생성 결과는 `GeneratedComponent[]` 상태로만 들고 있다 (`hooks/useComponentGenerator.ts`).

## Tech Stack & Constraints

- 요청은 항상 상대 경로 `/api/...`로 보낸다 (`App.tsx:25`, `hooks/useComponentGenerator.ts:38`). Vite 프록시가 3002로 넘기므로 `localhost:3002`를 적지 않는다.
- 스타일은 `App.css`, `index.css`의 className 문자열이다 (`App.tsx:6`). CSS Modules, styled-components, Tailwind를 들이지 않는다.
- `Provider`, `GeneratedComponent`, `StreamEvent`는 `types/index.ts`가 단일 정의다. 서버(`server/`)도 여기서 import하므로, 바꾸면 `bun run test`로 server 테스트까지 돌린다.

## Implementation Patterns

- 생성은 SSE 스트리밍이다. `hooks/useComponentGenerator.ts`가 요청 직후 `isStreaming: true`인 자리표시 컴포넌트를 맨 앞에 올리고, `utils/sse.ts`의 `readSseStream`으로 `delta`마다 `code`를 이어 붙인 뒤 `done`에서 최종 코드로 바꾼다. `error` 이벤트나 `done` 없는 종료는 자리표시를 지우고 `error` 상태로 올린다.
- 카드 탭은 스트리밍 상태가 바뀔 때만 자동 전환한다 (`components/ComponentCard.tsx`). 시작하면 코드 탭, 끝나면 미리보기 탭. 그 사이 사용자가 고른 탭은 유지한다. effect 대신 렌더 중 상태 조정 패턴을 쓴다 (`react-hooks/set-state-in-effect` 규칙 때문이다).
- 미리보기 새로고침은 상태 초기화가 아니라 `key` 변경으로 리마운트한다 (`components/ComponentCard.tsx`). 애니메이션 컴포넌트를 처음부터 다시 그리기 위해서다.
- 서버 오류는 훅의 `error` 상태로 올리고 `App.tsx:124-128` 배너가 보여 준다. `alert`는 키 미입력 한 곳에서만 쓴다 (`App.tsx:35`). 새 오류에 `alert`를 추가하지 않는다.
- 프로바이더를 바꾸면 입력된 키를 비운다 (`App.tsx:41-44`). 다른 프로바이더의 키가 섞여 전송되는 것을 막는다.
- 프롬프트는 `trim()`한 값만 상위로 넘긴다 (`components/PromptInput.tsx:22-24`). 길이 검증은 `utils/validatePrompt.ts`를 쓴다.

## Testing Strategy

- 실행: `bun run test -- src`
- 환경: jsdom, `@testing-library/react`, `@testing-library/user-event`. 각 테스트 후 `cleanup()`은 `test/setup.ts`가 자동으로 한다.
- 컴포넌트 패턴 (`components/PromptInput.test.tsx`, `components/ComponentCard.test.tsx`): `describe('컴포넌트명')`, 테스트 이름은 한국어 문장, 요소는 `getByRole`로 찾고, 입력은 `userEvent.setup()`으로 한다. 무거운 자식(`LivePreview`)은 `vi.mock`으로 바꾼다.
- 훅 패턴 (`hooks/useComponentGenerator.test.ts`): `renderHook` + `vi.stubGlobal('fetch', ...)`. SSE 응답은 `ReadableStream`으로 만들어 넘긴다.
- 순수 함수 패턴은 `utils/validatePrompt.test.ts`, `utils/sse.test.ts`를 따른다.

## Local Golden Rules

- Do: 새 컴포넌트는 `components/`에 named export 함수로 만든다. default export는 `App.tsx:186`뿐이다.
- Do: API 키 입력은 `type="password"`를 유지한다 (`App.tsx:100`). 보기 토글은 사용자가 누를 때만 평문이 된다.
- Do: 스트리밍 중인 컴포넌트(`isStreaming`)에는 재생성, 새로고침, 복사 버튼을 비활성으로 둔다 (`components/ComponentCard.tsx`, `components/CodeView.tsx`). 받는 중인 코드는 아직 실행 가능한 코드가 아니다.
- Don't: `useComponentGenerator`의 fetch 바깥에서 API 키를 다른 상태나 localStorage에 저장하지 않는다. 키는 요청 본문에만 실린다 (`hooks/useComponentGenerator.ts:41`).
- Don't: `/api/config` 실패 처리(`App.tsx:28`의 빈 catch)를 오류 배너로 바꾸지 않는다. 서버 없이도 UI가 떠야 한다.
