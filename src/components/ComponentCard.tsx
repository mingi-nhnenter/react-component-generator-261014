import { useState } from 'react';
import type { GeneratedComponent } from '../types';
import { LivePreview } from './LivePreview';
import { CodeView } from './CodeView';

interface ComponentCardProps {
  component: GeneratedComponent;
  onRemove: (id: string) => void;
  onRegenerate: (prompt: string) => void;
  isLoading: boolean;
}

type Tab = 'preview' | 'code';

export function ComponentCard({ component, onRemove, onRegenerate, isLoading }: ComponentCardProps) {
  const [activeTab, setActiveTab] = useState<Tab>(component.isStreaming ? 'code' : 'preview');
  const [previewKey, setPreviewKey] = useState(0);
  const [prevStreaming, setPrevStreaming] = useState(component.isStreaming);
  const createdAt = component.createdAt.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // 스트리밍 상태가 바뀌는 렌더에서만 탭을 바꾼다. 시작하면 코드 탭에서 생성 과정을 보여 주고,
  // 끝나면 미리보기로 넘어간다. 사용자가 직접 고른 탭은 그 사이에는 유지된다.
  // (effect 대신 렌더 중 상태 조정: 추가 렌더 한 번으로 끝나고 깜빡임이 없다.)
  if (component.isStreaming !== prevStreaming) {
    setPrevStreaming(component.isStreaming);
    setActiveTab(component.isStreaming ? 'code' : 'preview');
  }

  const busy = isLoading || component.isStreaming;

  return (
    <div className="component-card">
      <div className="card-header">
        <div className="card-title-group">
          <span>{createdAt}</span>
          <p className="card-prompt">{component.prompt}</p>
        </div>
        <div className="card-actions">
          <button
            className="btn-refresh"
            onClick={() => setPreviewKey((k) => k + 1)}
            title="미리보기 새로고침"
            aria-label="미리보기 새로고침"
            disabled={component.isStreaming}
          >
            ↻
          </button>
          <button
            className="btn-regenerate"
            onClick={() => onRegenerate(component.prompt)}
            disabled={busy}
          >
            {busy ? '생성 중...' : '재생성'}
          </button>
          <button
            className="btn-remove"
            onClick={() => onRemove(component.id)}
          >
            삭제
          </button>
        </div>
      </div>
      <div className="card-tabs">
        <button
          className={`tab ${activeTab === 'preview' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          미리보기
        </button>
        <button
          className={`tab ${activeTab === 'code' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('code')}
        >
          코드
        </button>
      </div>
      <div className="card-content">
        {activeTab === 'preview' ? (
          <LivePreview key={previewKey} code={component.code} />
        ) : (
          <CodeView code={component.code} isStreaming={component.isStreaming} />
        )}
      </div>
    </div>
  );
}
