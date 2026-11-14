import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Last line of defence: the child sees a way back instead of a blank screen. Progress is already saved. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[app] render error', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="display text-3xl text-gold">Тайм-аут</p>
        <p className="text-mute">Сталася помилка: {this.state.error.message}. Твій прогрес збережено.</p>
        <button
          className="display rounded-2xl bg-gold px-8 py-4 text-xl text-night"
          onClick={() => window.location.reload()}
        >
          Повернутися в гру
        </button>
      </div>
    );
  }
}
