/**
 * core/intent/normalizer.ts
 * OWNS: Text cleaning before classification
 * EXPOSES: normalize()
 */

export class IntentNormalizer {
  normalize(rawText: string): string {
    if (!rawText?.trim()) throw new Error('Normalizer received empty input');

    let text = rawText.trim();

    // Remove emojis (all pictograph blocks incl. U+1F900+ supplemental symbols)
    // then re-collapse whitespace left behind by removed emojis
    text = text
      .replace(
        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{FE0F}]/gu,
        ''
      )
      .replace(/\s+/g, ' ')
      .trim();

    // Reduce repeated punctuation
    text = text.replace(/([!?.])\1+/g, '$1');

    // Lowercase
    text = text.toLowerCase();

    return text;
  }
}
