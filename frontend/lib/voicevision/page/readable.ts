// SPARSH VoiceVision — Page Content Reader
// Identifies and reads structured DOM content marked with data-voice-region and data-voice-item.
// Only reads on explicit student command — NEVER auto-reads entire pages.

export class PageContentReader {
  /**
   * Discovers text elements marked with data-voice-region or data-voice-item.
   */
  public static getRegionContent(regionName: string = 'lesson-content'): string[] {
    if (typeof document === 'undefined') return [];

    // 1. Check for specific region
    const regionElem = document.querySelector(`[data-voice-region="${regionName}"]`);
    if (regionElem) {
      const items = regionElem.querySelectorAll('[data-voice-item]');
      if (items.length > 0) {
        return Array.from(items)
          .map(el => (el.textContent || '').trim())
          .filter(Boolean);
      }

      // If no nested data-voice-item, read paragraphs within region
      const paragraphs = regionElem.querySelectorAll('p, li, h1, h2, h3, h4');
      if (paragraphs.length > 0) {
        return Array.from(paragraphs)
          .map(p => (p.textContent || '').trim())
          .filter(Boolean);
      }

      return [(regionElem.textContent || '').trim()].filter(Boolean);
    }

    // 2. Fallback: Search any generic voice region or readable container
    const anyRegion = document.querySelector('[data-voice-region]');
    if (anyRegion) {
      return [(anyRegion.textContent || '').trim()].filter(Boolean);
    }

    return [];
  }

  /**
   * Finds the primary readable summary or transcript text on the current page.
   */
  public static extractPrimaryText(): string {
    const contents = PageContentReader.getRegionContent('lesson-content');
    if (contents.length > 0) {
      return contents.join('. ');
    }

    // Try finding visible transcript or summary classes
    if (typeof document !== 'undefined') {
      const summaryEl = document.querySelector('[data-voice-summary]');
      if (summaryEl && summaryEl.textContent) {
        return summaryEl.textContent.trim();
      }
    }

    return '';
  }
}
