import React from 'react';

interface State {
  failed: boolean;
}

/** Last line of defence: a render error shows a recoverable screen instead of a blank page. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center" role="alert">
        <p className="text-[17px] font-semibold text-ink">Kutilmagan xatolik yuz berdi.</p>
        <p className="mt-1 text-[15px] text-ink-muted">Sahifani yangilab koʻring.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 min-h-touch px-5 rounded-xl border border-line bg-surface text-[15px] font-semibold text-ink"
        >
          Sahifani yangilash
        </button>
      </div>
    );
  }
}
