function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlightMatch(text: string, search: string) {
  if (!search) return text;

  // "mini cooper" -> ["mini", "cooper"]
  const tokens = search.trim().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) return text;

  // экранируем
  const escaped = tokens.map(escapeRegExp);

  // один регекс — только для split
  const splitRegex = new RegExp(`(${escaped.join("|")})`, "gi");

  const parts = text.split(splitRegex);

  // для проверки делаем список токенов в нижнем регистре
  const tokensLower = tokens.map((t) => t.toLowerCase());

  return parts.map((part, i) => {
    const lower = part.toLowerCase();
    const isMatch = tokensLower.some((t) => t === lower);

    return isMatch ? (
      <mark key={i} className="bg-yellow-200/80">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    );
  });
}
