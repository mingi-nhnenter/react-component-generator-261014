// 프로바이더별 스트리밍 응답을 공통 StreamEvent로 바꾸는 순수 함수들.
// 부수효과가 없어 단위 테스트가 가능하다. 네트워크 호출은 index.ts에 있다.
import type { StreamEvent } from '../src/types';

export type { StreamEvent };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Anthropic Messages 스트림 이벤트에서 텍스트 조각을 꺼낸다. 텍스트 델타가 아니면 null. */
export function extractAnthropicDelta(event: unknown): string | null {
  if (!isRecord(event) || event.type !== 'content_block_delta') return null;
  const delta = event.delta;
  if (!isRecord(delta) || delta.type !== 'text_delta' || typeof delta.text !== 'string') return null;
  return delta.text;
}

function firstGeminiCandidate(event: unknown): Record<string, unknown> | null {
  if (!isRecord(event) || !Array.isArray(event.candidates)) return null;
  const candidate = event.candidates[0];
  return isRecord(candidate) ? candidate : null;
}

/** Gemini streamGenerateContent 청크에서 첫 candidate의 텍스트를 이어 붙여 꺼낸다. 없으면 null. */
export function extractGeminiDelta(event: unknown): string | null {
  const candidate = firstGeminiCandidate(event);
  const content = candidate?.content;
  if (!isRecord(content) || !Array.isArray(content.parts)) return null;
  const text = content.parts
    .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
    .join('');
  return text;
}

/** Gemini가 출력 토큰 한도로 응답을 잘랐는지 본다. */
export function isGeminiTruncated(event: unknown): boolean {
  return firstGeminiCandidate(event)?.finishReason === 'MAX_TOKENS';
}

/** StreamEvent 하나를 SSE 한 블록(data 줄 + 빈 줄)으로 직렬화한다. JSON은 한 줄이라 줄바꿈이 섞이지 않는다. */
export function encodeSseEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** 프로바이더 오류 메시지를 사용자에게 보여 줄 문구와 HTTP 상태로 바꾼다. 503, 429 외에는 그대로 500이다. */
export function mapProviderError(message: string): { status: number; error: string } {
  if (message.includes('503')) {
    return { status: 503, error: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.' };
  }
  if (message.includes('429')) {
    return { status: 429, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' };
  }
  return { status: 500, error: message };
}
