/**
 * Copy banks — short strings varied across sites.
 * Each bank has >= 4 entries; the resolver seed-picks one per site.
 * Values from template-architecture.md §4.5.
 */

export const COPY_BANKS: Record<string, string[]> = {
  'nav.services': ['Services', 'What We Do', 'Our Work', 'Service Menu'],
  'nav.areas': ['Areas Served', 'Where We Work', 'Service Area', 'Locations'],
  'nav.cost': ['Pricing', 'Cost Guide', 'What It Costs', 'Estimates'],
  'nav.faq': ['FAQ', 'Common Questions', 'Good to Know', 'Questions'],
  'nav.about': ['How It Works', 'About', 'Our Process', 'Who We Are'],

  'cta.primary': [
    'Call for a Free Quote',
    'Talk to a Local Pro',
    'Get Pricing by Phone',
    'Request a Call Back',
    'Speak With a Contractor',
  ],
  'cta.secondary': [
    'Request a Quote',
    'Send Details',
    'Get an Estimate',
    'Tell Us About Your Project',
  ],

  'form.heading': [
    'Prefer to Type?',
    'Send Us the Details',
    'Request a Quote Online',
    'Get a Written Estimate',
  ],

  'footer.disclosure': [
    'We connect homeowners with independent local contractors. Operated by Vantabox LLC.',
    'This site matches local homeowners with independent, unaffiliated contractors. A Vantabox LLC service.',
    'Independent contractors serve every request made through this site. Site operated by Vantabox LLC.',
    "We're a local referral service: your request goes to an independent contractor in your area. Vantabox LLC.",
  ],

  'trust.heading': [
    'How This Works',
    'What to Expect',
    'Before You Call',
    'The Process',
  ],

  'areas.intro': [
    'We connect homeowners across the region with trusted local contractors.',
    'Our network of contractors covers these communities and beyond.',
    'Looking for service in your neighborhood? We cover these areas.',
    'Local contractors are available in the following communities.',
  ],
}
