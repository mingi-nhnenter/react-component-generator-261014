/** 컴포넌트 생성 프롬프트의 최대 글자 수. 앞뒤 공백을 제외하고 센다. */
export const PROMPT_MAX_LENGTH = 500;

export type PromptValidation = { valid: true } | { valid: false; error: string };

/**
 * 프롬프트가 비어 있지 않고 최대 글자 수 이내인지 검사한다.
 * 무효이면 사용자에게 그대로 보여 줄 수 있는 한국어 메시지를 함께 돌려준다.
 */
export function validatePrompt(prompt: string): PromptValidation {
  const length = prompt.trim().length;

  if (length === 0) {
    return { valid: false, error: '프롬프트를 입력해 주세요.' };
  }
  if (length > PROMPT_MAX_LENGTH) {
    return {
      valid: false,
      error: `프롬프트는 ${PROMPT_MAX_LENGTH}자 이하여야 합니다. (현재 ${length}자)`,
    };
  }
  return { valid: true };
}
