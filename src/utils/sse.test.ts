import { describe, it, expect } from 'vitest';
import { parseSseChunk, readSseStream } from './sse';

describe('parseSseChunk', () => {
  it('빈 줄로 끝난 이벤트의 data를 꺼낸다', () => {
    expect(parseSseChunk('data: {"a":1}\n\n')).toEqual({ events: ['{"a":1}'], rest: '' });
  });

  it('이벤트가 여럿이면 순서대로 꺼낸다', () => {
    const { events, rest } = parseSseChunk('data: one\n\ndata: two\n\n');
    expect(events).toEqual(['one', 'two']);
    expect(rest).toBe('');
  });

  it('빈 줄로 끝나지 않은 꼬리는 rest로 남긴다', () => {
    const { events, rest } = parseSseChunk('data: one\n\ndata: tw');
    expect(events).toEqual(['one']);
    expect(rest).toBe('data: tw');
  });

  it('data 줄이 여러 개면 줄바꿈으로 이어 붙인다', () => {
    expect(parseSseChunk('data: a\ndata: b\n\n').events).toEqual(['a\nb']);
  });

  it('주석과 event, id 필드는 무시한다', () => {
    const { events } = parseSseChunk(': keep-alive\nevent: ping\nid: 3\ndata: x\n\n');
    expect(events).toEqual(['x']);
  });

  it('data 없이 빈 줄만 있으면 이벤트를 만들지 않는다', () => {
    expect(parseSseChunk('\n\n: c\n\n').events).toEqual([]);
  });

  it('CRLF 줄바꿈도 처리한다', () => {
    expect(parseSseChunk('data: a\r\n\r\n').events).toEqual(['a']);
  });
});

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
}

describe('readSseStream', () => {
  it('청크 경계가 이벤트 중간이어도 data를 순서대로 전달한다', async () => {
    const got: string[] = [];
    await readSseStream(streamOf(['data: {"t":"a', 'b"}\n\ndata: ', '{"t":"c"}\n\n']), (d) => got.push(d));
    expect(got).toEqual(['{"t":"ab"}', '{"t":"c"}']);
  });

  it('스트림이 빈 줄 없이 끝나도 남은 data를 전달한다', async () => {
    const got: string[] = [];
    await readSseStream(streamOf(['data: last']), (d) => got.push(d));
    expect(got).toEqual(['last']);
  });

  it('멀티바이트 문자가 청크 경계에서 잘려도 깨지지 않는다', async () => {
    const bytes = new TextEncoder().encode('data: 한글\n\n');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 8)); // "data: " + '한'의 첫 2바이트
        controller.enqueue(bytes.slice(8));
        controller.close();
      },
    });
    const got: string[] = [];
    await readSseStream(stream, (d) => got.push(d));
    expect(got).toEqual(['한글']);
  });
});
