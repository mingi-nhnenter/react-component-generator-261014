import { describe, it, expect } from 'vitest';
import { validatePrompt } from './validatePrompt';

describe('validatePrompt', () => {
  it('500자 이하 프롬프트는 유효하다', () => {
    expect(validatePrompt('프로필 카드')).toEqual({ valid: true });
    expect(validatePrompt('가'.repeat(500))).toEqual({ valid: true });
  });

  it('500자를 초과하면 무효이고 현재 글자 수를 담은 메시지를 돌려준다', () => {
    expect(validatePrompt('가'.repeat(501))).toEqual({
      valid: false,
      error: '프롬프트는 500자 이하여야 합니다. (현재 501자)',
    });
  });

  it('앞뒤 공백은 글자 수에 넣지 않는다', () => {
    expect(validatePrompt(`  ${'가'.repeat(500)}  \n`)).toEqual({ valid: true });
  });

  it('비어 있거나 공백뿐이면 무효다', () => {
    const expected = { valid: false, error: '프롬프트를 입력해 주세요.' };
    expect(validatePrompt('')).toEqual(expected);
    expect(validatePrompt('   \n ')).toEqual(expected);
  });
});
