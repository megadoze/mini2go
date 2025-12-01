type BookingQrModalProps = {
  open: boolean;
  onClose: () => void;
  displayId: string;
  qrSrc: string | null;
  bookingId?: string | null;
  shareUrl: string;
};

export const BookingQrModal: React.FC<BookingQrModalProps> = ({
  open,
  onClose,
  displayId,
  qrSrc,
  bookingId,
  shareUrl,
}) => {
  if (!open) return null;

  const canDownload = Boolean(qrSrc);
  const hasBookingId = Boolean(bookingId);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[999]"
      role="dialog"
      aria-modal="true"
      aria-label="Booking QR code"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm sm:max-w-md rounded-2xl bg-white shadow-lg p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800">
            Booking #{displayId}
          </h2>
          <button
            className="h-8 w-8 rounded-md hover:bg-gray-100 active:scale-[.98]"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 sm:mt-6">
          {qrSrc ? (
            <img
              src={qrSrc}
              alt="QR code"
              className="mx-auto w-56 h-56 sm:w-72 sm:h-72 object-contain"
            />
          ) : (
            <div className="mx-auto w-56 h-56 sm:w-72 sm:h-72 rounded-xl bg-gray-100 animate-pulse" />
          )}
        </div>

        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-2">
          {/* Скачать PNG */}
          <a
            href={canDownload ? qrSrc! : "#"}
            download={`booking-${displayId}.png`}
            className="flex-1 rounded-md bg-gray-900 text-white py-2.5 text-sm text-center active:scale-[.99] disabled:opacity-50"
            onClick={(e) => {
              if (!canDownload) e.preventDefault();
            }}
          >
            Download PNG
          </a>

          {/* Скопировать ID */}
          <button
            onClick={async () => {
              if (!hasBookingId || !bookingId) return;
              try {
                await navigator.clipboard.writeText(bookingId);
              } catch {
                // игнор
              }
            }}
            className="flex-1 rounded-md border border-gray-300 text-gray-800 py-2.5 text-sm active:scale-[.99]"
          >
            Copy full ID
          </button>

          {/* Поделиться ссылкой */}
          <button
            onClick={async () => {
              try {
                if (navigator.share && shareUrl) {
                  await navigator.share({
                    title: `Booking #${displayId}`,
                    url: shareUrl,
                  });
                } else if (shareUrl) {
                  await navigator.clipboard.writeText(shareUrl);
                }
              } catch {
                // игнор
              }
            }}
            className="flex-1 rounded-md bg-blue-600 text-white py-2.5 text-sm active:scale-[.99]"
          >
            Share
          </button>
        </div>

        {bookingId && (
          <p className="mt-2 text-xs text-gray-500 break-all">{bookingId}</p>
        )}
      </div>
    </div>
  );
};
