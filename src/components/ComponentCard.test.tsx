import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComponentCard } from './ComponentCard';
import type { GeneratedComponent } from '../types';

vi.mock('./LivePreview', () => ({
  LivePreview: ({ code }: { code: string }) => <div data-testid="preview">{code}</div>,
}));

function component(overrides: Partial<GeneratedComponent> = {}): GeneratedComponent {
  return {
    id: '1',
    prompt: '카드',
    code: 'const A = () => null;',
    createdAt: new Date('2026-10-14T10:00:00'),
    isStreaming: false,
    ...overrides,
  };
}

function renderCard(c: GeneratedComponent) {
  return render(<ComponentCard component={c} onRemove={vi.fn()} onRegenerate={vi.fn()} isLoading={false} />);
}

describe('ComponentCard 탭 전환', () => {
  it('기본은 미리보기 탭이다', () => {
    renderCard(component());
    expect(screen.getByRole('button', { name: '미리보기' })).toHaveClass('tab--active');
    expect(screen.getByTestId('preview')).toBeInTheDocument();
  });

  it('스트리밍 중이면 코드 탭이 열리고 지금까지 받은 코드를 보여 준다', () => {
    renderCard(component({ isStreaming: true, code: 'const A' }));
    expect(screen.getByRole('button', { name: '코드' })).toHaveClass('tab--active');
    expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
    expect(screen.getByText('const A')).toBeInTheDocument();
  });

  it('스트리밍이 끝나면 미리보기 탭으로 돌아간다', () => {
    const { rerender } = renderCard(component({ isStreaming: true, code: 'const A' }));
    rerender(
      <ComponentCard
        component={component({ isStreaming: false, code: 'const A = () => null;' })}
        onRemove={vi.fn()}
        onRegenerate={vi.fn()}
        isLoading={false}
      />,
    );
    expect(screen.getByRole('button', { name: '미리보기' })).toHaveClass('tab--active');
    expect(screen.getByTestId('preview')).toHaveTextContent('const A = () => null;');
  });

  it('스트리밍 중에는 재생성 버튼이 비활성이다', () => {
    renderCard(component({ isStreaming: true }));
    expect(screen.getByRole('button', { name: '생성 중...' })).toBeDisabled();
  });
});
