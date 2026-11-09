/**
 * Lightweight markdown-to-HTML converter.
 * Handles the subset used in teardown/viability reports:
 * headings, tables, bold/italic, lists, horizontal rules, paragraphs.
 */

export function markdownToHtml(markdown) {
  if (!markdown) return ''

  const lines = markdown.split('\n')
  const out = []
  let listType = null // 'ul' | 'ol' | null
  let tableState = null // null | 'header' | 'body'
  let paragraph = []

  function flushParagraph() {
    if (paragraph.length > 0) {
      out.push('<p>' + inline(paragraph.join(' ')) + '</p>')
      paragraph = []
    }
  }

  function closeList() {
    if (listType) {
      out.push(`</${listType}>`)
      listType = null
    }
  }

  function closeTable() {
    if (tableState) {
      out.push('</tbody></table>')
      tableState = null
    }
  }

  function inline(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
  }

  function parseTableRow(line) {
    return line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(cell => cell.trim())
  }

  function isSeparatorRow(line) {
    return /^\|?[\s-:|]+\|[\s-:|]*$/.test(line)
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // blank line
    if (trimmed === '') {
      flushParagraph()
      closeList()
      continue
    }

    // horizontal rule
    if (/^---+$/.test(trimmed)) {
      flushParagraph()
      closeList()
      closeTable()
      out.push('<hr>')
      continue
    }

    // heading
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      closeList()
      closeTable()
      const level = headingMatch[1].length
      out.push(`<h${level}>${inline(headingMatch[2])}</h${level}>`)
      continue
    }

    // table row
    if (trimmed.startsWith('|') || (trimmed.includes('|') && tableState)) {
      flushParagraph()
      closeList()

      // check if next line is separator (this is the header row)
      if (!tableState && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
        const cells = parseTableRow(trimmed)
        out.push('<table><thead><tr>' + cells.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>')
        tableState = 'body'
        i++ // skip separator row
        continue
      }

      if (tableState === 'body') {
        const cells = parseTableRow(trimmed)
        out.push('<tr>' + cells.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>')
        continue
      }
    }

    // unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph()
      closeTable()
      if (listType !== 'ul') {
        closeList()
        listType = 'ul'
        out.push('<ul>')
      }
      out.push('<li>' + inline(trimmed.replace(/^[-*]\s+/, '')) + '</li>')
      continue
    }

    // ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph()
      closeTable()
      if (listType !== 'ol') {
        closeList()
        listType = 'ol'
        out.push('<ol>')
      }
      out.push('<li>' + inline(trimmed.replace(/^\d+\.\s+/, '')) + '</li>')
      continue
    }

    // paragraph text
    closeTable()
    paragraph.push(trimmed)
  }

  flushParagraph()
  closeList()
  closeTable()

  return out.join('')
}
