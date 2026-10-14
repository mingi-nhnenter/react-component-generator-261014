import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useComponentGenerator } from './useComponentGenerator';

function sseResponse(events: object[], chunking: 'whole' | 'split' = 'whole') {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  const enc = new TextEncoder();
  const chunks = chunking === 'whole' ? [text] : [text.slice(0, 15), text.slice(15)];
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
  return { ok: true, status: 200, body, json: async () => ({}) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useComponentGenerator (스트리밍)', () => {
  it('요청 직후 isStreaming 컴포넌트가 생기고, 델타가 올 때마다 code가 늘어나며, done에서 최종 코드로 끝난다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse(
          [
            { type: 'delta', text: 'const A' },
            { type: 'delta', text: ' = () => null;' },
            { type: 'done', code: 'const A = () => null;\n\nrender(<A />);' },
          ],
          'split',
        ),
      ),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('카드', undefined, 'google');
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.components).toHaveLength(1);
    const c = result.current.components[0];
    expect(c.isStreaming).toBe(false);
    expect(c.code).toBe('const A = () => null;\n\nrender(<A />);');
    expect(c.prompt).toBe('카드');
    expect(result.current.error).toBeNull();
  });

  it('스트리밍 엔드포인트로 prompt, provider, apiKey를 보낸다', async () => {
    const fetchMock = vi.fn(async () => sseResponse([{ type: 'done', code: 'x' }]));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('p', 'key-1', 'anthropic');
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/generate/stream');
    expect(JSON.parse(init.body as string)).toEqual({ prompt: 'p', apiKey: 'key-1', provider: 'anthropic' });
  });

  it('스트림 중 error 이벤트가 오면 자리표시 컴포넌트를 지우고 error를 설정한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse([{ type: 'delta', text: 'a' }, { type: 'error', error: '실패했어요' }])),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('p', undefined, 'google');
    });

    expect(result.current.components).toHaveLength(0);
    expect(result.current.error).toBe('실패했어요');
    expect(result.current.isLoading).toBe(false);
  });

  it('응답이 ok가 아니면 JSON의 error를 보여 주고 컴포넌트를 만들지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 400, body: null, json: async () => ({ error: 'Prompt is required' }) })),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('', undefined, 'google');
    });

    expect(result.current.components).toHaveLength(0);
    expect(result.current.error).toBe('Prompt is required');
  });
});
