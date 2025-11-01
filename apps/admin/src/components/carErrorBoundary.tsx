// components/CarErrorBoundary.tsx
import { useRouteError, isRouteErrorResponse } from "react-router-dom";

export default function CarErrorBoundary() {
  const err = useRouteError();
  if (isRouteErrorResponse(err)) {
    return (
      <div style={{ padding: 16 }}>
        Ошибка {err.status}: {err.statusText}
      </div>
    );
  }
  return <div style={{ padding: 16 }}>Что-то пошло не так…</div>;
}
