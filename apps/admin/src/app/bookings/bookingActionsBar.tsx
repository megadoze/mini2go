// BookingActionsBar.tsx
import React from "react";

type BookingActionsBarProps = {
  mode: "create" | "edit";
  mark: "booking" | "block";

  saving: boolean;
  saved: boolean;

  canConfirm: boolean;
  canCancel: boolean;
  cancelLabel: string;
  viewingAsHost: boolean;
  isGuestReadOnly: boolean;
  guestCanCancel: boolean;
  status: string | null;

  onSave: () => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export const BookingActionsBar: React.FC<BookingActionsBarProps> = ({
  mode,
  mark,
  saving,
  saved,
  canConfirm,
  canCancel,
  cancelLabel,
  viewingAsHost,
  isGuestReadOnly,
  guestCanCancel,
  status,
  onSave,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white p-3 shadow-lg">
      <div className="flex flex-col gap-2">
        {/* SAVE */}
        {mode === "create" && (
          <button
            className="w-full rounded-lg bg-gray-900 text-white py-3 text-sm font-medium active:scale-[.98] disabled:opacity-50"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? "Saving…" : "Create booking"}
          </button>
        )}

        {mode === "edit" && (
          <button
            className="w-full rounded-lg bg-gray-900 text-white py-3 text-sm font-medium active:scale-[.98] disabled:opacity-50"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? "Saving…" : saved ? "Saved!" : "Save changes"}
          </button>
        )}

        {/* HOST CONFIRM */}
        {mark === "booking" && viewingAsHost && canConfirm && (
          <button
            className="w-full rounded-lg border border-green-500 bg-white py-3 text-sm font-medium text-green-600 active:scale-[.98]"
            onClick={onConfirm}
            disabled={saving}
          >
            Confirm booking
          </button>
        )}

        {/* CANCEL */}
        {mark === "booking" && canCancel && (
          <button
            className="w-full rounded-lg border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700 active:scale-[.98]"
            onClick={onCancel}
            disabled={saving}
          >
            {cancelLabel}
          </button>
        )}

        {isGuestReadOnly && guestCanCancel && (
          <p className="text-[11px] text-gray-500 text-center">
            {status === "onApproval"
              ? "You can cancel this request anytime before host confirms."
              : "You can cancel ≥ 24h before start."}
          </p>
        )}
      </div>
    </div>
  );
};
