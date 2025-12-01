// BookingTopActions.tsx
import React from "react";
import { Loader } from "@mantine/core";

type BookingTopActionsProps = {
  goBack: () => void;
  handleSave: () => void;

  saving: boolean;
  saved: boolean;

  isChanged: boolean;
  invalidTime: boolean;
  isLoading: boolean;
};

export const BookingTopActions: React.FC<BookingTopActionsProps> = ({
  goBack,
  handleSave,
  saving,
  saved,
  isChanged,
  invalidTime,
  isLoading,
}) => {
  return (
    <div className="hidden lg:block mt-8">
      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 px-5 py-4 flex items-center justify-between">
        {/* Back */}
        <button
          type="button"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm active:scale-[.98] disabled:opacity-50"
          onClick={goBack}
          disabled={saving}
        >
          Back
        </button>

        {/* Save Changes */}
        <div className="flex items-center gap-3">
          {saved && !saving && (
            <span className="text-sm font-medium text-lime-600 animate-fade-in">
              ✓ Saved
            </span>
          )}

          <button
            type="button"
            className={`inline-flex items-center gap-2 rounded-lg border px-5 py-2 text-sm font-medium shadow-sm active:scale-[.98] ${
              isChanged && !saving
                ? "border-green-400 bg-white text-green-600"
                : "border-gray-300 bg-white text-gray-400 cursor-not-allowed"
            }`}
            onClick={handleSave}
            disabled={isLoading || invalidTime || !isChanged || saving}
          >
            {saving ? (
              <>
                <Loader size="xs" color="gray" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </section>
    </div>
  );
};
