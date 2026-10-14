import { useState, useCallback } from 'react';
import type { GeneratedComponent, Provider, StreamEvent } from '../types';
import { readSseStream } from '../utils/sse';

interface UseComponentGeneratorReturn {
  components: GeneratedComponent[];
  isLoading: boolean;
  error: string | null;
  generate: (prompt: string, apiKey: string | undefined, provider: Provider) => Promise<void>;
  removeComponent: (id: string) => void;
  clearAll: () => void;
}

function parseStreamEvent(data: string): StreamEvent | null {
  try {
    return JSON.parse(data) as StreamEvent;
  } catch {
    return null;
  }
}

export function useComponentGenerator(): UseComponentGeneratorReturn {
  const [components, setComponents] = useState<GeneratedComponent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    setIsLoading(true);
    setError(null);

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const patch = (update: Partial<GeneratedComponent> | ((c: GeneratedComponent) => Partial<GeneratedComponent>)) =>
      setComponents((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...(typeof update === 'function' ? update(c) : update) } : c)),
      );

    try {
      const res = await fetch('/api/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate component');
      }

      // 스트림이 열리면 바로 자리표시 컴포넌트를 올려 코드 탭에서 실시간으로 보이게 한다.
      setComponents((prev) => [{ id, prompt, code: '', createdAt: new Date(), isStreaming: true }, ...prev]);

      let finished = false;
      let failure: string | null = null;

      await readSseStream(res.body, (data) => {
        const event = parseStreamEvent(data);
        if (!event) return;
        if (event.type === 'delta') {
          patch((c) => ({ code: c.code + event.text }));
        } else if (event.type === 'done') {
          finished = true;
          patch({ code: event.code, isStreaming: false });
        } else if (event.type === 'error') {
          failure = event.error;
        }
      });

      if (failure) throw new Error(failure);
      if (!finished) throw new Error('응답이 중간에 끊겼습니다. 다시 시도해주세요.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setComponents((prev) => prev.filter((c) => c.id !== id));
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setComponents([]);
  }, []);

  return { components, isLoading, error, generate, removeComponent, clearAll };
}
