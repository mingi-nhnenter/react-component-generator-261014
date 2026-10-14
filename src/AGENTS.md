# src/AGENTS.md

## Module Context

브라우저 UI다. 서버와는 `/api/config`, `/api/generate` 두 요청으로만 통신하고, 생성 결과는 `GeneratedComponent[]` 상태로만 들고 있다 (`hooks/useComponentGenerator.ts`).

## Tech Stack & Constraints

- 요청은 항상 상대 경로 `/api/...`로 보낸다 (`App.tsx:25`, `hooks/useComponentGenerator.ts:24`). Vite 프록시가 3002로 넘기므로 `localhost:3002`를 적지 않는다.
- 스타일은 `App.css`, `index.css`의 className 문자열이다 (`App.tsx:6`). CSS Modules, styled-components, Tailwind를 들이지 않는다.
- `Provider` 타입은 `types/index.ts:1`에 있고 `server/index.ts:57`에 같은 유니온이 따로 있다. 프로바이더를 추가하면 두 곳을 함께 고친다.

## Implementation Patterns

- 미리보기 새로고침은 상태 초기화가 아니라 `key` 변경으로 리마운트한다 (`components/ComponentCard.tsx:17, 33, 70`). 애니메이션 컴포넌트를 처음부터 다시 그리기 위해서다.
- 서버 오류는 훅의 `error` 상태로 올리고 `App.tsx:124-128` 배너가 보여 준다. `alert`는 키 미입력 한 곳에서만 쓴다 (`App.tsx:35`). 새 오류에 `alert`를 추가하지 않는다.
- 프로바이더를 바꾸면 입력된 키를 비운다 (`App.tsx:41-44`). 다른 프로바이더의 키가 섞여 전송되는 것을 막는다.
- 프롬프트는 `trim()`한 값만 상위로 넘긴다 (`components/PromptInput.tsx:22-24`). 길이 검증은 `utils/validatePrompt.ts`를 쓴다.

## Testing Strategy

- 실행: `bun run test -- src`
- 환경: jsdom, `@testing-library/react`, `@testing-library/user-event`. 각 테스트 후 `cleanup()`은 `test/setup.ts`가 자동으로 한다.
- 패턴 (`components/PromptInput.test.tsx`): `describe('컴포넌트명')`, 테스트 이름은 한국어 문장, 요소는 `getByRole`로 찾고, 입력은 `userEvent.setup()`으로 한다.
- 순수 함수 테스트 패턴은 `utils/validatePrompt.test.ts`를 따른다.

## Local Golden Rules

- Do: 새 컴포넌트는 `components/`에 named export 함수로 만든다. default export는 `App.tsx:186`뿐이다.
- Do: API 키 입력은 `type="password"`를 유지한다 (`App.tsx:100`). 보기 토글은 사용자가 누를 때만 평문이 된다.
- Don't: `useComponentGenerator`의 fetch 바깥에서 API 키를 다른 상태나 localStorage에 저장하지 않는다. 키는 요청 본문에만 실린다 (`hooks/useComponentGenerator.ts:26`).
- Don't: `/api/config` 실패 처리(`App.tsx:28`의 빈 catch)를 오류 배너로 바꾸지 않는다. 서버 없이도 UI가 떠야 한다.
