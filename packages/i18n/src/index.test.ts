import { describe, expect, it } from 'vitest';
import { messages } from './index';

describe('translations', () => {
  it('keeps the same keys in both locales', () => {
    expect(Object.keys(messages['pt-BR'])).toEqual(
      Object.keys(messages['en-US']),
    );
  });
});
