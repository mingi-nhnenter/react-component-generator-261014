import { useState } from 'react';

interface CodeViewProps {
  code: string;
  /** 서버가 아직 코드를 보내는 중이면 true. 커서를 깜빡이고 복사를 막는다. */
  isStreaming?: boolean;
}

export function CodeView({ code, isStreaming = false }: CodeViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-panel">
      <div className="panel-header">
        <h3>{isStreaming ? '코드 생성 중' : '코드'}</h3>
        <button className="btn-copy" onClick={handleCopy} disabled={isStreaming}>
          {copied ? '복사됨!' : '복사'}
        </button>
      </div>
      <pre className="code-block">
        <code>{code}</code>
        {isStreaming && <span className="code-caret" aria-hidden="true" />}
      </pre>
    </div>
  );
}
