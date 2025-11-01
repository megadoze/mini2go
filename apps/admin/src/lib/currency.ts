export const makeCurrencyFormatter = (currency: string) => (value: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
    value
  );

export const getCurrencySymbol = (iso: string) => {
  switch (iso) {
    case "EUR":
      return "€";
    case "USD":
      return "$";
    case "GBP":
      return "£";
    case "CHF":
      return "CHF";
    case "PLN":
      return "zł";
    default:
      return iso; // fallback — показываем код
  }
};
