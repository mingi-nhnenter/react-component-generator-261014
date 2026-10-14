export type Provider = 'anthropic' | 'google';

export interface GeneratedComponent {
  id: string;
  prompt: string;
  code: string;
  createdAt: Date;
  /** 서버가 코드를 아직 보내는 중이면 true. 끝나면 false. */
  isStreaming: boolean;
}

/** /api/generate/stream 이 SSE data로 보내는 이벤트. 서버(server/streaming.ts)와 클라이언트가 함께 쓴다. */
export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; code: string }
  | { type: 'error'; error: string };
