export const highlightMatch = (text: string, search: string) => {
  if (!search) return text;
  const regex = new RegExp(`(${search})`, "gi");
  const parts = text.split(regex);
  return parts.map((part: string, i: number) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200/80">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
};
