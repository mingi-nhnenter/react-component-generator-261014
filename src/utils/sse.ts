/**
 * SSE(text/event-stream) 텍스트를 이벤트 단위로 자른다.
 * 빈 줄로 끝나지 않은 마지막 블록은 아직 다 오지 않은 것이므로 rest로 돌려준다.
 * data: 줄만 모으고, 여러 줄이면 줄바꿈으로 이어 붙인다. event:, id:, 주석(:)은 버린다.
 */
export function parseSseChunk(buffer: string): { events: string[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n\n');
  const rest = blocks.pop() ?? '';

  const events: string[] = [];
  for (const block of blocks) {
    const dataLines = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).replace(/^ /, ''));
    if (dataLines.length > 0) {
      events.push(dataLines.join('\n'));
    }
  }
  return { events, rest };
}

/**
 * fetch 응답 본문(ReadableStream)을 끝까지 읽으며 data 페이로드마다 onData를 부른다.
 * 청크가 이벤트나 멀티바이트 문자 중간에서 잘려도 TextDecoder의 stream 모드와 rest 버퍼로 이어 붙인다.
 */
export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseChunk(buffer);
      buffer = rest;
      for (const event of events) onData(event);
    }
  } finally {
    reader.releaseLock();
  }

  // 스트림이 빈 줄 없이 끝난 경우 남은 블록도 이벤트로 처리한다.
  buffer += decoder.decode();
  if (buffer.trim().length > 0) {
    const { events } = parseSseChunk(`${buffer}\n\n`);
    for (const event of events) onData(event);
  }
}
