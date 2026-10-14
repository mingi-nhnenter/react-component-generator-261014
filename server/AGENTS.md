# server/AGENTS.md

## Module Context

Bun 런타임에서 `Bun.serve`로 띄우는 AI 프록시다 (`index.ts:288`). 프레임워크 없이 요청을 분기하고, 프로바이더 호출 결과를 react-live용 코드로 정규화해 돌려준다. 생성은 일괄(`/api/generate`)과 스트리밍(`/api/generate/stream`) 두 경로가 있다.

## Tech Stack & Constraints

- Bun 내장 API만 쓴다 (`Bun.serve`, `fetch`, `Response.json`, `ReadableStream`). Express 등 HTTP 프레임워크를 들이지 않는다.
- 포트는 3002 고정이다 (`index.ts:289`). `vite.config.ts:11`의 프록시 대상과 같아야 한다.
- 모든 응답에 `CORS_HEADERS`를 붙인다 (`index.ts:61-65`). JSON 응답은 `{ headers: CORS_HEADERS }`를, SSE 응답은 `{ ...CORS_HEADERS, 'Content-Type': 'text/event-stream' }`을 넘긴다. 새 라우트도 같다.
- `Provider`, `StreamEvent`는 `src/types/index.ts`에서 import한다 (`index.ts:12`, `streaming.ts:3`). 서버에 같은 타입을 다시 정의하지 않는다. SSE 파서도 `src/utils/sse.ts`를 함께 쓴다 (`index.ts:11`).

## Implementation Patterns

- 프로바이더 호출 함수(`callAnthropic`, `callGoogleModel`)는 원문 텍스트만 반환한다. 정규화는 `generator.ts`의 `stripCodeFences`, `ensureRenderCall`이 한다 (`index.ts:344`). 스트리밍은 `streamGeneration`이 `done` 이벤트에 같은 정규화 결과를 담는다.
- 스트리밍 열기 함수(`openAnthropicStream`, `openGoogleModelStream`)는 HTTP 상태만 보고 본문 스트림을 돌려준다. 그래서 `withModelFallback`은 연결 단계 실패에만 폴백하고, 스트림 도중 실패는 `error` 이벤트로 끝난다.
- 프로바이더 SSE 조각을 `StreamEvent`로 바꾸는 일은 `streaming.ts`의 순수 함수(`extractAnthropicDelta`, `extractGeminiDelta`, `isGeminiTruncated`, `encodeSseEvent`)가 한다. 프로바이더를 추가하면 여기에 추출 함수와 테스트를 먼저 쓴다.
- 클라이언트가 스트림을 끊으면 `cancel()`이 AbortController로 프로바이더 요청을 함께 끊는다. 닫힌 뒤의 `enqueue`는 `send()`가 조용히 버린다.
- 모델 폴백은 `withModelFallback` (`fallback.ts`)로 한다. Google 모델 순서는 `GOOGLE_MODELS` 배열이다 (`index.ts:15`). 모델을 추가하면 배열에만 넣는다.
- 에러 매핑은 `mapProviderError` (`streaming.ts:47`)가 메시지 문자열로 한다. `includes('503')`, `includes('429')`로 분기하므로 프로바이더 오류는 반드시 `... error: ${response.status}` 형태로 던진다 (`index.ts:93, 120, 172, 197`). 일괄 경로는 HTTP 상태로, 스트리밍 경로는 `error` 이벤트 문구로 같은 결과를 쓴다.
- 키 우선순위는 클라이언트 입력, 그다음 환경변수다 (`resolveApiKey`, `index.ts:72-74`). 키 검사(400)가 프롬프트 검사(400)보다 먼저고, 스트리밍은 두 검사를 통과한 뒤에야 SSE로 전환한다 (`index.ts:318-336`).

## Testing Strategy

- 실행: `bun run test -- server`
- `index.ts`는 테스트가 없다. `Bun.serve`가 모듈 로드 시 바로 실행되기 때문이다. 테스트할 로직은 `generator.ts`, `fallback.ts`, `streaming.ts`처럼 부수효과 없는 파일로 분리한다 (`generator.ts:1-2`).
- 패턴: `generator.test.ts`, `streaming.test.ts`는 입력과 기대값을 직접 비교한다. `fallback.test.ts`는 `vi.fn`으로 호출 횟수와 순서를 검증한다.

## Local Golden Rules

- Do: `SYSTEM_PROMPT`를 바꾸면 `generator.ts`의 정규화 함수와 그 테스트를 함께 본다. 둘은 같은 규칙(render 호출, import 금지, TS 금지)을 이중으로 지킨다.
- Do: 새 프로바이더를 추가하면 `ENV_KEYS` (`index.ts:67-70`), `resolveApiKey`, `/api/config` 응답 (`index.ts:297-306`), 일괄 호출과 스트리밍 열기 함수, `streaming.ts`의 델타 추출, 프런트 `PROVIDER_CONFIG` (`src/App.tsx:8-11`), `src/types/index.ts`의 `Provider`를 모두 고친다.
- Do: 잘림 처리를 추가하면 Gemini의 `MAX_TOKENS` 분기 (`index.ts:131-133`, `streaming.ts`의 `isGeminiTruncated`)와 같은 한국어 메시지 형식을 따른다. Anthropic 경로에는 아직 없다.
- Don't: `apiKey`, `resolvedKey`를 `console.log`, 응답 본문, SSE 페이로드에 넣지 않는다. 현재 코드에는 키를 출력하는 곳이 한 곳도 없다.
- Don't: 503, 429 매핑을 지우지 않는다. 프런트는 서버의 `error` 문자열을 그대로 배너에 띄우므로 (`src/App.tsx:126`) 사용자에게 보이는 문구다.
