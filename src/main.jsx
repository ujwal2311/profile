import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: '#ff4444', background: '#0a0a0a', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h1>React Error</h1>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#ccc' }}>{this.state.error?.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#888', fontSize: 12 }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
