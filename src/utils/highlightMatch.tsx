export const highlightMatch = (text, search) => {
  if (!search) return text;
  const regex = new RegExp(`(${search})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200/80">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
};
