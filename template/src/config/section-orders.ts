/**
 * Section ordering per page type. Three sets (O1, O2, O3) per type.
 * Derived from template-architecture.md §4.3 and pack.yaml outlines.
 *
 * home/service/town always start with "intro" and end with "cta".
 */

export type OrderSet = 'O1' | 'O2' | 'O3'

export const SECTION_ORDERS: Record<
  string,
  Record<OrderSet, string[]>
> = {
  home: {
    O1: ['intro', 'services', 'process', 'areas', 'trust', 'cta'],
    O2: ['intro', 'process', 'services', 'areas', 'cta'],
    O3: ['intro', 'areas', 'services', 'trust', 'process', 'cta'],
  },

  service: {
    O1: ['intro', 'benefits', 'process', 'cost', 'cta'],
    O2: ['intro', 'process', 'benefits', 'cost', 'cta'],
    O3: ['intro', 'cost', 'benefits', 'process', 'cta'],
  },

  town: {
    O1: ['intro', 'demand', 'options', 'local', 'cta'],
    O2: ['intro', 'options', 'demand', 'local', 'cta'],
    O3: ['intro', 'local', 'demand', 'options', 'cta'],
  },

  guide: {
    O1: ['intro', 'comparison', 'takeaways', 'cta'],
    O2: ['intro', 'takeaways', 'comparison', 'cta'],
    O3: ['intro', 'comparison', 'cta'],
  },

  cost_guide: {
    O1: ['intro', 'prices', 'factors', 'comparison', 'cta'],
    O2: ['intro', 'factors', 'prices', 'comparison', 'cta'],
    O3: ['intro', 'comparison', 'prices', 'factors', 'cta'],
  },

  faq: {
    O1: ['intro', 'questions', 'cta'],
    O2: ['intro', 'cta', 'questions', 'cta'],
    O3: ['intro', 'questions', 'related', 'cta'],
  },

  tool: {
    O1: ['intro', 'tool', 'methodology', 'faq', 'cta'],
    O2: ['intro', 'tool', 'faq', 'methodology', 'cta'],
    O3: ['intro', 'methodology', 'tool', 'faq', 'cta'],
  },
}
