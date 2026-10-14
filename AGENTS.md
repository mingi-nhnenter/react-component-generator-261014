# AGENTS.md

에이전트 전용 지침이다. 프로젝트 소개, 설치, 실행 방법은 `README.md`에 있으므로 여기서 반복하지 않는다.

## Operational Commands

패키지 매니저는 `bun`만 쓴다. lock 파일이 `bun.lock` 하나뿐이다. npm, yarn, pnpm으로 설치하면 lock이 둘로 갈라진다.

- `bun install`: 의존성 설치
- `bun run dev`: API 서버(3002)와 Vite(5173)를 동시에 실행
- `bun run server`: API 서버만 실행 (`bun --watch`)
- `bun run test`: 전체 테스트 1회 실행 (`vitest run`)
- `bun run test -- <경로>`: 특정 파일만 실행
- `bun run lint`: eslint
- `bun run build`: `tsc -b && vite build`. 타입 오류가 있으면 빌드가 실패한다.

브라우저는 `/api/*`를 Vite 프록시로 3002에 보낸다 (`vite.config.ts:9-12`, `server/index.ts:139`). 포트를 바꾸면 두 파일을 함께 바꾼다.

## Golden Rules

### Immutable (보안)

1. **민감 파일을 읽거나 수정하지 않는다.** `.env`, `.env.*`, 이름에 `credential` 또는 `secret`이 들어간 파일, `*.pem`, `*.key`, `.ssh/`, `.aws/credentials`. `.claude/settings.json`의 `permissions.deny`가 도구 수준에서 막고 있고, `.env`는 `.gitignore:32`로 커밋에서도 제외된다. 값이 필요하면 사용자에게 직접 확인하라고 요청한다. `.env.example`에 키 이름만 적는다.
2. **API 키는 서버에서만 해석한다.** `ENV_KEYS`는 `server/index.ts:59-62`에서만 읽고, `/api/config`는 키 존재 여부를 boolean으로만 돌려준다 (`server/index.ts:148-156`). 키 값을 응답, 로그, 클라이언트 상태에 넣지 않는다.
3. **키를 하드코딩하지 않는다.** 프런트에 있는 `sk-ant-...`, `AIza...`는 placeholder 문자열뿐이다 (`src/App.tsx:9-10`).

### Hard Constraints (어기면 즉시 깨짐)

- **생성 코드 규칙은 react-live noInline에 묶여 있다.** `LivePreview.tsx:14`가 `noInline`이므로 생성 코드는 `render(<X />)`로 끝나야 하고, import와 TypeScript 문법을 쓸 수 없다. 이 규칙은 `SYSTEM_PROMPT` (`server/index.ts:11-12, 21`)와 `ensureRenderCall` (`server/generator.ts:16-24`) 두 곳에서 지킨다. 한쪽만 고치지 않는다.
- **`verbatimModuleSyntax`가 켜져 있다** (`tsconfig.app.json:14`). 타입만 가져올 때는 `import type`을 쓴다 (`src/App.tsx:5`).
- **미사용 변수와 매개변수는 빌드 오류다** (`tsconfig.app.json:21-22`). 미구현 스텁의 매개변수는 `_` 접두사를 붙인다.
- **테스트 파일 위치가 고정이다.** vitest는 `src/**/*.test.{ts,tsx}`와 `server/**/*.test.ts`만 찾는다 (`vite.config.ts:20`). 다른 곳에 두면 실행되지 않는다.

### Double Defense (한쪽을 지우지 않는다)

- 빈 프롬프트는 프런트(`PromptInput.tsx:22, 46`의 `trim()` 검사와 버튼 비활성)와 서버(`server/index.ts:176`)가 각각 막는다. 유틸 `src/utils/validatePrompt.ts`도 같은 검사를 한다.
- 생성 코드 정규화는 프롬프트 지시(`SYSTEM_PROMPT`)와 사후 처리(`stripCodeFences`, `ensureRenderCall`)가 겹친다. 모델이 지시를 어겨도 사후 처리가 받친다.

### Asymmetry (의도된 비대칭)

- `/api/config` 조회 실패는 조용히 무시한다 (`src/App.tsx:28`). 서버가 꺼져 있어도 UI는 떠야 한다. 반면 생성 요청 실패는 `error` 상태로 올려 배너에 보여 준다 (`useComponentGenerator.ts:44-46`, `App.tsx:124-128`). 새 요청을 추가할 때 어느 쪽인지 정한다.
- Gemini 경로만 `MAX_TOKENS` 잘림을 에러로 바꾼다 (`server/index.ts:123-125`). Anthropic 경로에는 같은 처리가 없다. 잘림 문제가 보고되면 여기부터 본다.

### Test Boundary

테스트가 있는 곳: `server/generator.ts`, `server/fallback.ts`, `src/components/PromptInput.tsx`, `src/utils/validatePrompt.ts`.
테스트가 없는 곳: `server/index.ts`(Bun.serve 부수효과), `src/hooks/`, `src/App.tsx`.

규칙: 순수 로직은 `server/index.ts`에 넣지 않는다. `generator.ts:1-2`의 주석대로 부수효과 없는 함수로 분리해 테스트한다. 새 로직은 `.claude/rules/tdd.md`를 따른다.

## Project Context

프롬프트를 받아 AI가 React 컴포넌트를 생성하고 react-live로 즉시 미리보기하는 도구다.

Tech Stack: React 19, TypeScript 5.9, Vite 8, react-live 4, Bun (서버 런타임), vitest 4, @testing-library/react, eslint 9 (flat config)

## Standards & References

- TDD: `.claude/rules/tdd.md`. 이 파일이 TDD 기준이다.
- 커밋: `/commit` 스킬. 형식은 `<feat|fix|refactor|chore>: <한국어 요약>` (`git log --oneline` 참고). 승인 전 커밋하지 않는다.
- PR: `/create-pr` 스킬. Draft로 만든다.
- 커밋 메시지와 UI 문구, 테스트 이름은 한국어로 쓴다 (`PromptInput.test.tsx:7`, `fallback.test.ts:5`).
- Maintenance Policy: 이 파일의 규칙과 코드가 어긋나면 코드를 규칙에 맞추지 말고, 먼저 어긋난 지점과 근거를 보고하고 규칙 수정을 제안한다.

## Context Map

- **[프런트엔드 (src/)](./src/AGENTS.md)** — 컴포넌트, 훅, 프런트 테스트 작업 시.
- **[API 서버 (server/)](./server/AGENTS.md)** — 프로바이더 호출, 응답 정규화, 에러 매핑 작업 시.
