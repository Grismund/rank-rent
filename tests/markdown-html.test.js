import { describe, it, expect } from 'vitest'
import { markdownToHtml } from '../lib/markdown-html.js'

describe('markdownToHtml', () => {
  it('returns empty string for empty input', () => {
    expect(markdownToHtml('')).toBe('')
    expect(markdownToHtml(null)).toBe('')
    expect(markdownToHtml(undefined)).toBe('')
  })

  it('converts h1–h4 headings', () => {
    expect(markdownToHtml('# Title')).toBe('<h1>Title</h1>')
    expect(markdownToHtml('## Section')).toBe('<h2>Section</h2>')
    expect(markdownToHtml('### Sub')).toBe('<h3>Sub</h3>')
    expect(markdownToHtml('#### Deep')).toBe('<h4>Deep</h4>')
  })

  it('converts bold and italic inline', () => {
    expect(markdownToHtml('This is **bold** text')).toBe('<p>This is <strong>bold</strong> text</p>')
    expect(markdownToHtml('This is *italic* text')).toBe('<p>This is <em>italic</em> text</p>')
    expect(markdownToHtml('**bold** and *italic*')).toBe('<p><strong>bold</strong> and <em>italic</em></p>')
  })

  it('converts horizontal rules', () => {
    expect(markdownToHtml('---')).toBe('<hr>')
    expect(markdownToHtml('---\n')).toBe('<hr>')
  })

  it('converts unordered lists', () => {
    const md = '- item one\n- item two\n- item three'
    expect(markdownToHtml(md)).toBe('<ul><li>item one</li><li>item two</li><li>item three</li></ul>')
  })

  it('converts ordered lists', () => {
    const md = '1. first\n2. second\n3. third'
    expect(markdownToHtml(md)).toBe('<ol><li>first</li><li>second</li><li>third</li></ol>')
  })

  it('converts tables with thead and tbody', () => {
    const md = '| Col A | Col B |\n|-------|-------|\n| val 1 | val 2 |\n| val 3 | val 4 |'
    const html = markdownToHtml(md)
    expect(html).toContain('<table>')
    expect(html).toContain('<thead><tr><th>Col A</th><th>Col B</th></tr></thead>')
    expect(html).toContain('<tbody>')
    expect(html).toContain('<tr><td>val 1</td><td>val 2</td></tr>')
    expect(html).toContain('<tr><td>val 3</td><td>val 4</td></tr>')
    expect(html).toContain('</tbody></table>')
  })

  it('wraps plain text in paragraphs', () => {
    expect(markdownToHtml('Just some text')).toBe('<p>Just some text</p>')
  })

  it('separates paragraphs on blank lines', () => {
    const md = 'First paragraph\n\nSecond paragraph'
    expect(markdownToHtml(md)).toBe('<p>First paragraph</p><p>Second paragraph</p>')
  })

  it('handles mixed content', () => {
    const md = '## Verdict: BEATABLE\n\nCompetitors are weak.\n\n- thin content\n- few backlinks\n\n---\n\n| Metric | Value |\n|--------|-------|\n| CPC | $5.00 |'
    const html = markdownToHtml(md)
    expect(html).toContain('<h2>Verdict: BEATABLE</h2>')
    expect(html).toContain('<p>Competitors are weak.</p>')
    expect(html).toContain('<ul><li>thin content</li><li>few backlinks</li></ul>')
    expect(html).toContain('<hr>')
    expect(html).toContain('<th>Metric</th>')
    expect(html).toContain('<td>$5.00</td>')
  })

  it('handles real teardown sample', () => {
    const md = `# Teardown: air duct cleaning in Houston

## Competitor Summary

| # | Domain | Backlinks |
|---|--------|-----------|
| 1 | example.org | 3 |

## Verdict: BEATABLE

Majority of competitors have thin content.`

    const html = markdownToHtml(md)
    expect(html).toContain('<h1>Teardown: air duct cleaning in Houston</h1>')
    expect(html).toContain('<th>#</th>')
    expect(html).toContain('<td>example.org</td>')
    expect(html).toContain('<h2>Verdict: BEATABLE</h2>')
    expect(html).toContain('<p>Majority of competitors have thin content.</p>')
  })

  it('handles real viability sample', () => {
    const md = `# Viability Report — bathroom remodel in Conroe

**Date:** 2026-11-09
**Verdict:** viable

## Job Economics

| Metric | Value |
|--------|-------|
| Avg job value | $6000–$15000 |
| Gross margin | 25–40% |`

    const html = markdownToHtml(md)
    expect(html).toContain('<h1>Viability Report')
    expect(html).toContain('<strong>Date:</strong> 2026-11-09')
    expect(html).toContain('<h2>Job Economics</h2>')
    expect(html).toContain('<td>$6000–$15000</td>')
  })

  it('closes open lists before other block elements', () => {
    const md = '- item\n\n## Next Section'
    const html = markdownToHtml(md)
    expect(html).toContain('</ul>')
    expect(html).toContain('<h2>Next Section</h2>')
    // list should close before heading
    const ulEnd = html.indexOf('</ul>')
    const h2Start = html.indexOf('<h2>')
    expect(ulEnd).toBeLessThan(h2Start)
  })
})
