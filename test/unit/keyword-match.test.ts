import { describe, it, expect } from 'vitest';
import { matchesKeyword } from '@/utils/keyword-match.js';

describe('keyword-match — matchesKeyword', () => {
  const KEYWORD = 'BASUSTA';

  describe('positive matches (keyword detected)', () => {
    it('detects exact match', () => {
      expect(matchesKeyword('BASUSTA', KEYWORD)).toBe(true);
    });

    it('detects case-insensitive lowercase', () => {
      expect(matchesKeyword('basusta', KEYWORD)).toBe(true);
    });

    it('detects case-insensitive mixed case', () => {
      expect(matchesKeyword('BasuSta', KEYWORD)).toBe(true);
    });

    it('detects keyword within longer text', () => {
      expect(matchesKeyword('quiero BASUSTA por favor', KEYWORD)).toBe(true);
    });

    it('detects keyword with trailing punctuation', () => {
      expect(matchesKeyword('BASUSTA!', KEYWORD)).toBe(true);
    });

    it('detects keyword with leading punctuation', () => {
      expect(matchesKeyword('¡BASUSTA', KEYWORD)).toBe(true);
    });
  });

  describe('negative matches (keyword NOT detected)', () => {
    it('rejects partial prefix match — "BASUST"', () => {
      expect(matchesKeyword('BASUST', KEYWORD)).toBe(false);
    });

    it('rejects partial suffix match — "BASUSTAS"', () => {
      expect(matchesKeyword('BASUSTAS', KEYWORD)).toBe(false);
    });

    it('rejects partial match embedded in longer word — "xBASUSTAx"', () => {
      expect(matchesKeyword('xBASUSTAx', KEYWORD)).toBe(false);
    });

    it('rejects unrelated comment', () => {
      expect(matchesKeyword('me gusta!', KEYWORD)).toBe(false);
    });

    it('rejects empty text', () => {
      expect(matchesKeyword('', KEYWORD)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false for empty keyword string', () => {
      expect(matchesKeyword('BASUSTA', '')).toBe(false);
    });

    it('handles keyword with special regex characters literally', () => {
      // Keyword "test.me" should match the literal text "test.me", not "testXme"
      expect(matchesKeyword('visit test.me today', 'test.me')).toBe(true);
      expect(matchesKeyword('testXme', 'test.me')).toBe(false);
    });

    it('returns false for empty text and empty keyword', () => {
      expect(matchesKeyword('', '')).toBe(false);
    });
  });
});
