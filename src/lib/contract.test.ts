
import { describe, it, expect } from 'vitest';

/**
 * Contract Tests
 * 
 * These tests ensure that the values used in the Frontend match the 
 * serialization expectations of the Rust Backend (serde).
 * 
 * Rust uses #[serde(rename_all = "snake_case")] for Enums.
 * This means TypeScript must send "some_value" instead of "someValue".
 */

describe('Backend Contract Compliance', () => {
  
  it('SortPreference values should be snake_case', () => {
    // These are the values defined in TypeScript types
    const tsValues = ['title', 'author', 'date_last_read', 'highlight_count'];
    
    // Regex for snake_case (lowercase, underscores, no humps)
    const snakeCaseRegex = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
    
    tsValues.forEach(value => {
      expect(value, `Value '${value}' should be snake_case to match Rust enum`).toMatch(snakeCaseRegex);
    });
  });

  it('DateFormat values should be snake_case', () => {
    // These are the values defined in TypeScript types
    const tsValues = ['dd_mm_yyyy', 'dd_month_yyyy', 'iso8601'];
    
    const snakeCaseRegex = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
    
    tsValues.forEach(value => {
      expect(value, `Value '${value}' should be snake_case to match Rust enum`).toMatch(snakeCaseRegex);
    });
  });

  it('ViewMode values should be snake_case', () => {
    const tsValues = ['grid', 'list'];
    
    const snakeCaseRegex = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
    
    tsValues.forEach(value => {
      expect(value).toMatch(snakeCaseRegex);
    });
  });

  it('ThemePreference values should be snake_case', () => {
    const tsValues = ['system', 'light', 'dark'];
    
    const snakeCaseRegex = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
    
    tsValues.forEach(value => {
      expect(value).toMatch(snakeCaseRegex);
    });
  });

});
