import { StrictMode, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          fontFamily: 'system-ui, sans-serif',
          maxWidth: 560,
          margin: '80px auto',
          padding: 32,
          border: '1px solid #fca5a5',
          borderRadius: 12,
          background: '#fef2f2',
          color: '#991b1b',
        }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Application error</h2>
          <p style={{ margin: '0 0 12px', fontSize: 14, color: '#b91c1c' }}>
            {this.state.error.message}
          </p>
          <pre style={{
            background: '#fee2e2',
            padding: 12,
            borderRadius: 8,
            fontSize: 12,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '8px 20px',
              background: '#16a34a',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
