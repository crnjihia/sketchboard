/**
 * Wraps text into lines that fit within a maximum width based on character estimate or Canvas context measurement.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measureFn?: (line: string) => number,
  approxCharWidth = 9
): string[] {
  if (!text) return [];

  const paragraphs = text.split('\n');
  const resultLines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      resultLines.push('');
      continue;
    }

    const words = para.split(' ');
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const width = measureFn ? measureFn(candidate) : candidate.length * approxCharWidth;

      if (width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          resultLines.push(currentLine);
          currentLine = word;
        } else {
          // Word itself exceeds maxWidth: break word
          resultLines.push(candidate);
          currentLine = '';
        }
      }
    }

    if (currentLine) {
      resultLines.push(currentLine);
    }
  }

  return resultLines;
}
