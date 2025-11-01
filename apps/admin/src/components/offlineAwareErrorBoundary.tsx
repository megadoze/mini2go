import { isRouteErrorResponse, useRouteError } from "react-router-dom";

export default function OfflineAwareErrorBoundary() {
  const error = useRouteError();

  // 1. Пытаемся понять, это просто отсутствие интернета?
  const offlineSuspected =
    !navigator.onLine ||
    (error instanceof TypeError && /Failed to fetch/i.test(error.message));

  if (offlineSuspected) {
    return (
      <div className="p-6 flex flex-col items-center text-center text-gray-800">
        <div className="mb-4 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300 px-3 py-1 text-[11px] font-medium">
          Offline mode
        </div>

        <p className="text-lg font-medium mb-2">You're offline</p>

        <p className="text-sm text-gray-500 max-w-xs">
          We couldn't load data because there's no internet connection. Please
          reconnect and refresh the page.
        </p>

        <button
          className="mt-6 text-sm border rounded px-4 py-2 border-gray-400 text-gray-700 hover:bg-gray-50"
          onClick={() => {
            window.location.reload();
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  // 2. Если это не оффлайн, а обычная ошибка роутера (например loader вернул 404/500)
  if (isRouteErrorResponse(error)) {
    return (
      <div className="p-6 text-center text-gray-800">
        <p className="text-lg font-medium mb-2">{error.status} error</p>
        <p className="text-sm text-gray-500">{error.statusText}</p>
      </div>
    );
  }

  // 3. Вообще непредвиденная ошибка (какой-то throw new Error(...))
  return (
    <div className="p-6 text-center text-gray-800">
      <p className="text-lg font-medium mb-2">Something went wrong</p>
      <p className="text-sm text-gray-500">
        {(error as any)?.message || "Unexpected error"}
      </p>
    </div>
  );
}
