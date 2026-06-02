import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: 'monospace',
            color: '#ff6b6b',
            backgroundColor: '#1a1a2e',
            minHeight: '100vh',
            overflow: 'auto',
          }}
        >
          <h1 style={{ fontSize: 18, marginBottom: 16 }}>
            提灯遇到了错误
          </h1>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 13,
              lineHeight: 1.5,
              color: '#e0e0e0',
              padding: 12,
              borderRadius: 8,
              backgroundColor: '#0d0d1a',
              marginBottom: 16,
            }}
          >
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          {this.state.errorInfo && (
            <details style={{ fontSize: 12, color: '#888' }}>
              <summary style={{ cursor: 'pointer', marginBottom: 8 }}>
                Component Stack
              </summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '8px 20px',
              border: 'none',
              borderRadius: 8,
              backgroundColor: '#4a6fa5',
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            重新加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
