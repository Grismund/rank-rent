/**
 * Semantic class-name vocabulary.
 * ~40 keys, each with 3-4 candidate CSS class names.
 * The resolver seed-picks one per key per site so no two sites
 * share the same set of class names.
 *
 * Constraint: no candidate appears in more than 2 keys.
 */

export const CLASSMAP_VOCAB: Record<string, string[]> = {
  // Navigation
  navList: ['main-nav-list', 'site-nav-items', 'header-nav-links'],
  navToggle: ['menu-toggle-btn', 'nav-hamburger', 'mobile-menu-trigger'],
  navWrapper: ['nav-container', 'header-nav-wrap', 'site-nav-block'],
  logoWrap: ['brand-logo-wrap', 'site-logo-box', 'header-brand'],

  // Hero
  heroWrap: ['hero-section', 'banner-block', 'page-hero-wrap'],
  heroHeading: ['hero-title', 'banner-heading', 'page-hero-h1'],
  heroSubtext: ['hero-lede', 'banner-subtext', 'hero-description'],

  // Phone / CTA
  phoneLink: ['tel-link', 'call-us-link', 'phone-action-link'],
  callButton: ['cta-call-btn', 'phone-action-btn', 'call-now-button'],
  ctaButton: ['primary-action-btn', 'main-cta-button', 'action-trigger'],
  ctaSecondary: ['form-action-btn', 'secondary-cta', 'alt-action-button'],
  ctaBand: ['cta-section-band', 'action-strip', 'cta-full-block'],

  // Sticky bar
  stickyBar: ['fixed-bottom-bar', 'mobile-call-strip', 'sticky-phone-bar'],
  stickyBarButton: ['sticky-cta-btn', 'bar-phone-btn', 'fixed-call-button'],

  // Content sections
  sectionWrap: ['content-section', 'page-block', 'section-container'],
  pageContent: ['main-content', 'article-body', 'page-prose'],
  introBlock: ['intro-section', 'opening-block', 'lede-section'],

  // Services
  serviceCard: ['service-item-card', 'offering-card', 'work-type-card'],
  serviceList: ['services-grid', 'offering-list', 'work-types-list'],
  serviceIcon: ['service-icon', 'offering-icon', 'type-icon'],

  // Areas
  areaChip: ['area-tag', 'location-chip', 'town-pill'],
  areaList: ['areas-grid', 'locations-list', 'towns-roster'],

  // Process
  processStep: ['step-item', 'process-stage', 'workflow-step'],
  processList: ['steps-list', 'process-flow', 'workflow-stages'],

  // Trust
  trustBlock: ['trust-section', 'credibility-block', 'confidence-section'],
  trustItem: ['trust-point', 'credibility-fact', 'assurance-item'],

  // FAQ
  faqItem: ['faq-entry', 'question-block', 'qa-item'],
  faqList: ['faq-list', 'questions-group', 'qa-roster'],

  // Cost
  costRow: ['price-row', 'cost-line-item', 'rate-entry'],
  costTable: ['pricing-table', 'rates-grid', 'cost-breakdown'],

  // Tool
  toolCard: ['tool-container', 'calculator-box', 'estimator-frame'],
  toolOutput: ['result-display', 'estimate-output', 'calc-result-box'],
  toolInput: ['calc-input-group', 'estimator-field', 'tool-control'],

  // Form
  formWrap: ['contact-form-wrap', 'lead-form-box', 'quote-form-frame'],
  formField: ['form-input-group', 'field-row', 'input-block'],
  formSubmit: ['form-send-btn', 'submit-action', 'form-go-button'],

  // Breadcrumbs
  breadcrumbList: ['crumb-trail', 'nav-breadcrumbs', 'path-list'],
  breadcrumbItem: ['crumb-item', 'path-segment', 'trail-link'],

  // Footer
  footerGrid: ['footer-columns', 'site-footer-grid', 'bottom-nav-layout'],
  footerDisclosure: ['legal-note', 'footer-disclosure-text', 'site-notice'],
  footerNav: ['footer-link-list', 'bottom-nav-links', 'footer-sitemap'],

  // Skip link
  skipLink: ['skip-to-main', 'a11y-skip', 'bypass-link'],

  // Figure / Data viz
  figureWrap: ['data-figure', 'chart-container', 'viz-frame'],
  figureCaption: ['fig-caption', 'chart-label', 'viz-description'],
  figureTable: ['data-fallback-tbl', 'chart-table', 'fig-detail-table'],
}
