type BookingActionsCardProps = {
  viewingAsHost: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  isGuestReadOnly: boolean;
  guestCanCancel: boolean;
  status: string | null;
  cancelLabel: string;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export const BookingActionsCard: React.FC<BookingActionsCardProps> = ({
  viewingAsHost,
  canConfirm,
  canCancel,
  isGuestReadOnly,
  guestCanCancel,
  status,
  cancelLabel,
  saving,
  onConfirm,
  onCancel,
}) => {
  // если вообще нечего показывать — не рендерим карточку
  if (!viewingAsHost && !canCancel) return null;

  return (
    <section className="mt-4 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 p-4 sm:p-5 text-sm hidden lg:block">
      <div className="space-y-2">
        {/* Хост может подтвердить */}
        {viewingAsHost && canConfirm && (
          <button
            className="w-full rounded-lg border border-green-400 bg-white py-2 text-center text-sm font-medium text-green-600 shadow-sm active:scale-[.98] disabled:border-gray-300 disabled:text-gray-400"
            onClick={onConfirm}
            disabled={saving}
          >
            Confirm booking
          </button>
        )}

        {/* Кто-то может отменить (хост или гость по правилам) */}
        {canCancel && (
          <button
            className="w-full rounded-lg border border-gray-300 bg-white py-2 text-center text-sm font-medium text-gray-700 shadow-sm active:scale-[.98] disabled:border-gray-300 disabled:text-gray-400"
            onClick={onCancel}
            disabled={saving}
          >
            {cancelLabel}
          </button>
        )}

        {/* Подсказка для гостя, когда он может отменять */}
        {isGuestReadOnly && guestCanCancel && (
          <p className="text-[11px] text-gray-500">
            {status === "onApproval"
              ? "You can cancel this request anytime before the host confirms."
              : "You can cancel ≥ 24h before start and not during rent."}
          </p>
        )}
      </div>
    </section>
  );
};
