export function parseMentions(content: string): string[] {
  const regex = /@([a-z0-9_]{1,30})/gi
  const matches: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    matches.push(match[1].toLowerCase())
  }
  return [...new Set(matches)]
}
