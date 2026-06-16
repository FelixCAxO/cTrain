export function isSingleGrapheme(text: string): boolean {
  return countGraphemesUpTo(text, 2) === 1;
}

function countGraphemesUpTo(text: string, maximum: number): number {
  const segmenter = getGraphemeSegmenter();
  if (segmenter === undefined) {
    return Array.from(text).slice(0, maximum).length;
  }

  let count = 0;
  const iterator = segmenter.segment(text)[Symbol.iterator]();
  while (iterator.next().done !== true) {
    count += 1;
    if (count >= maximum) {
      break;
    }
  }
  return count;
}

interface GraphemeSegmenter {
  segment(value: string): Iterable<unknown>;
}

let cachedGraphemeSegmenter: GraphemeSegmenter | undefined;

function getGraphemeSegmenter(): GraphemeSegmenter | undefined {
  if (cachedGraphemeSegmenter !== undefined) {
    return cachedGraphemeSegmenter;
  }

  const Segmenter = (Intl as typeof Intl & {
    Segmenter?: new (
      locales: string | string[] | undefined,
      options: { granularity: 'grapheme' }
    ) => GraphemeSegmenter;
  }).Segmenter;
  if (Segmenter === undefined) {
    return undefined;
  }

  cachedGraphemeSegmenter = new Segmenter(undefined, { granularity: 'grapheme' });
  return cachedGraphemeSegmenter;
}
