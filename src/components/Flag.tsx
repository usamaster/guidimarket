interface FlagProps {
  emoji: string | null | undefined
  className?: string
  alt?: string
}

function emojiToCodepoints(emoji: string): string {
  const cps: string[] = []
  for (const ch of emoji) {
    const cp = ch.codePointAt(0)
    if (cp === undefined) continue
    if (cp === 0xFE0F) continue
    cps.push(cp.toString(16))
  }
  return cps.join('-')
}

export function Flag({ emoji, className = 'inline-block w-4 h-4 align-[-0.15em]', alt }: FlagProps) {
  if (!emoji) return null
  const codepoints = emojiToCodepoints(emoji)
  if (!codepoints) return null
  return (
    <img
      src={`https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${codepoints}.svg`}
      alt={alt || emoji}
      className={className}
      loading="lazy"
      draggable={false}
    />
  )
}
