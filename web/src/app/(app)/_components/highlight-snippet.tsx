const SENTINEL = /\[\[HL\]\]|\[\[\/HL\]\]/;

export function HighlightSnippet({ fragment }: { fragment: string }) {
  const parts = fragment.split(SENTINEL);

  return (
    <span>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={index}
            className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-500/40"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </span>
  );
}
