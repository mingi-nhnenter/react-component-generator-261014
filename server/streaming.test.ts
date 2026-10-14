import { describe, it, expect } from 'vitest';
import {
  extractAnthropicDelta,
  extractGeminiDelta,
  isGeminiTruncated,
  encodeSseEvent,
  mapProviderError,
} from './streaming';

describe('extractAnthropicDelta', () => {
  it('content_block_delta의 text_delta에서 텍스트를 꺼낸다', () => {
    const ev = { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'abc' } };
    expect(extractAnthropicDelta(ev)).toBe('abc');
  });

  it('텍스트가 아닌 이벤트는 null을 돌려준다', () => {
    expect(extractAnthropicDelta({ type: 'message_start' })).toBeNull();
    expect(extractAnthropicDelta({ type: 'content_block_delta', delta: { type: 'input_json_delta' } })).toBeNull();
    expect(extractAnthropicDelta(null)).toBeNull();
  });
});

describe('extractGeminiDelta', () => {
  it('첫 candidate의 parts 텍스트를 이어 붙여 돌려준다', () => {
    const ev = { candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] };
    expect(extractGeminiDelta(ev)).toBe('ab');
  });

  it('parts가 없으면 null을 돌려준다', () => {
    expect(extractGeminiDelta({ candidates: [{ finishReason: 'STOP' }] })).toBeNull();
    expect(extractGeminiDelta({})).toBeNull();
  });
});

describe('isGeminiTruncated', () => {
  it('finishReason이 MAX_TOKENS면 true다', () => {
    expect(isGeminiTruncated({ candidates: [{ finishReason: 'MAX_TOKENS' }] })).toBe(true);
    expect(isGeminiTruncated({ candidates: [{ finishReason: 'STOP' }] })).toBe(false);
    expect(isGeminiTruncated({})).toBe(false);
  });
});

describe('encodeSseEvent', () => {
  it('data 줄 하나와 빈 줄로 직렬화한다', () => {
    expect(encodeSseEvent({ type: 'delta', text: 'x' })).toBe('data: {"type":"delta","text":"x"}\n\n');
  });

  it('텍스트에 줄바꿈이 있어도 한 줄 JSON으로 유지한다', () => {
    const out = encodeSseEvent({ type: 'delta', text: 'a\nb' });
    expect(out.split('\n')).toHaveLength(3);
  });
});

describe('mapProviderError', () => {
  it('503은 과부하 안내와 503 상태로 바꾼다', () => {
    expect(mapProviderError('Gemini API error: 503')).toEqual({
      status: 503,
      error: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
    });
  });

  it('429는 요청 과다 안내와 429 상태로 바꾼다', () => {
    expect(mapProviderError('Claude API error: 429')).toEqual({
      status: 429,
      error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    });
  });

  it('그 외 메시지는 500 상태로 그대로 돌려준다', () => {
    expect(mapProviderError('boom')).toEqual({ status: 500, error: 'boom' });
  });
});
