import { hasSign, tokenizeForSigning } from './signMap';

export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'about', 'by', 'do', 'does', 
  'did', 'will', 'shall', 'has', 'have', 'had', 'this', 'that', 'these', 
  'those', 'it', 'its', 'my', 'your', 'his', 'her', 'their', 'our'
]);

export function convertTextToSigns(text: string): string[] {
  if (!text) return [];

  // Use the tokenizer from signMap which already handles stop words & normalization
  const tokens = tokenizeForSigning(text);

  const signs: string[] = [];

  for (const word of tokens) {
    if (hasSign(word)) {
      signs.push(word);
    } else {
      // Unknown words are silently dropped — no broken file loads
      console.warn(`[ISL Engine] No procedural sign for: "${word}", skipping.`);
    }
  }

  return signs;
}
