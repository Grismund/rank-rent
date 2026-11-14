/**
 * Maps section-order keys to component type names.
 * Keys not present here render as ProseSection.
 *
 * Prose keys (not mapped): intro, benefits, demand, options, local,
 * comparison, takeaways, methodology, related, factors
 */
export const SECTION_KEY_TO_TYPE: Record<string, string> = {
  services: 'ServicesList',
  areas: 'AreasServed',
  process: 'Process',
  trust: 'TrustBlock',
  cta: 'CTABand',
  questions: 'FAQ',
  faq: 'FAQ',
  tool: 'ToolShell',
  cost: 'CostTable',
  prices: 'CostTable',
}
