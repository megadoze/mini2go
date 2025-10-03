import { isRouteErrorResponse, useRouteError } from "react-router-dom";

export default function SimpleRouteError() {
  const err = useRouteError();
  if (isRouteErrorResponse(err)) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Oops</h1>
        <p>Status: {err.status}</p>
        <p>{err.statusText}</p>
      </div>
    );
  }
  return <div className="p-6">Something went wrong.</div>;
}
