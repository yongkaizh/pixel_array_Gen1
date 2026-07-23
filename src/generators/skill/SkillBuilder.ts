/**
 * Simple line accumulator for building multi-line SKILL scripts.
 */
export class SkillBuilder {
  private readonly lines: string[] = [];

  /** Append one pre-formatted line (legacy interface, still supported). */
  push(line: string): void {
    this.lines.push(line);
  }

  /**
   * Append a multi-line SKILL block written as a template literal.
   *
   * Leading and trailing blank lines are stripped, and the minimum common
   * indentation prefix (dedent) is removed so callers can write naturally-
   * indented SKILL code inside a function body without extra noise.
   *
   * @example
   *   builder.append(`
   *     procedure(doThing()
   *       printf("hello\\n")
   *     )
   *   `);
   */
  append(block: string): void {
    const raw = block.split('\n');

    // Strip leading blank lines
    let start = 0;
    while (start < raw.length && raw[start].trim() === '') start++;

    // Strip trailing blank lines
    let end = raw.length;
    while (end > start && raw[end - 1].trim() === '') end--;

    const content = raw.slice(start, end);
    if (content.length === 0) return;

    // Find minimum indentation (ignore blank lines)
    let minIndent = Infinity;
    for (const line of content) {
      if (line.trim() === '') continue;
      const spaces = line.match(/^( *)/)?.[1].length ?? 0;
      if (spaces < minIndent) minIndent = spaces;
    }
    if (!isFinite(minIndent)) minIndent = 0;

    for (const line of content) {
      this.lines.push(line.slice(minIndent));
    }
  }

  build(): string {
    return this.lines.join('\n');
  }
}
