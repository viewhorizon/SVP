import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || "Error de render en la aplicacion",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[AppErrorBoundary] Error atrapado:", error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <section className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Error de ejecucion detectado</h1>
          <p className="mt-2 text-sm text-slate-600">
            La interfaz no pudo renderizarse correctamente. Esto evita la pantalla en blanco y permite recuperar la app.
          </p>
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Detalle: {this.state.message}</p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-4 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Recargar aplicacion
          </button>
        </section>
      </main>
    );
  }
}

export default AppErrorBoundary;