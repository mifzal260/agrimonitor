import { Component, type ErrorInfo, type ReactNode } from "react";

import i18n from "../../i18n";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("AgriMonitor render error", error, errorInfo);
    }
  }

  private reloadApplication = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isEnglish = i18n.language === "en";

    return (
      <main className="flex min-h-screen items-center justify-center bg-field-50 px-5 text-slate-900">
        <section className="max-w-md rounded-2xl border border-field-100 bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-semibold">
            {isEnglish ? "The page could not be displayed." : "Halaman tidak dapat dipaparkan."}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {isEnglish ? "Please reload the application." : "Sila cuba muat semula aplikasi."}
          </p>
          <button
            className="mt-5 rounded-md bg-field-700 px-4 py-2 text-sm font-semibold text-white hover:bg-field-800 focus:outline-none focus:ring-2 focus:ring-field-600 focus:ring-offset-2"
            type="button"
            onClick={this.reloadApplication}
          >
            {isEnglish ? "Reload application" : "Muat semula aplikasi"}
          </button>
        </section>
      </main>
    );
  }
}
