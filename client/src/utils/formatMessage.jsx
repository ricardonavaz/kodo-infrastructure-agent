import React from 'react';

// Inline formatting helper
export function inlineFormat(str) {
  return str
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
}

// Rich markdown renderer — produces React elements from markdown text
export function formatMessage(text) {
  if (!text) return '';

  const cleanText = text.replace(/\[ACTION:\s*.+?\]\s*/g, '').trim();
  const parts = [];
  const lines = cleanText.split('\n');
  let inCodeBlock = false;
  let codeContent = [];
  let inList = false;
  let listItems = [];
  let listType = 'ul';
  let inTable = false;
  let tableHeaders = [];
  let tableRows = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      const Tag = listType === 'ol' ? 'ol' : 'ul';
      parts.push(
        <Tag key={key++} className="md-list">
          {listItems.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
          ))}
        </Tag>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushTable = () => {
    if (tableHeaders.length > 0 || tableRows.length > 0) {
      parts.push(
        <div key={key++} className="md-table-wrap">
          <table className="md-table">
            {tableHeaders.length > 0 && (
              <thead>
                <tr>{tableHeaders.map((h, i) => <th key={i} dangerouslySetInnerHTML={{ __html: inlineFormat(h) }} />)}</tr>
              </thead>
            )}
            <tbody>
              {tableRows.map((row, ri) => (
                <tr key={ri}>{row.map((cell, ci) => <td key={ci} dangerouslySetInnerHTML={{ __html: inlineFormat(cell) }} />)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    }
  };

  const parseTableRow = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
  const isTableSeparator = (line) => /^\|[\s-:|]+\|$/.test(line.trim());
  const isTableRow = (line) => /^\|.+\|$/.test(line.trim());

  for (const line of lines) {
    if (line.startsWith('```')) {
      flushList(); flushTable();
      if (inCodeBlock) {
        parts.push(<pre key={key++} className="md-code"><code>{codeContent.join('\n')}</code></pre>);
        codeContent = [];
        inCodeBlock = false;
      } else { inCodeBlock = true; }
      continue;
    }
    if (inCodeBlock) { codeContent.push(line); continue; }

    const trimmed = line.trim();
    if (!trimmed) { flushList(); flushTable(); parts.push(<div key={key++} className="md-spacer" />); continue; }

    if (isTableRow(trimmed)) {
      flushList();
      if (isTableSeparator(trimmed)) continue;
      const cells = parseTableRow(trimmed);
      if (!inTable) { tableHeaders = cells; inTable = true; } else { tableRows.push(cells); }
      continue;
    } else if (inTable) { flushTable(); }

    if (/^[-_*]{3,}$/.test(trimmed)) { flushList(); parts.push(<hr key={key++} className="md-hr" />); continue; }

    const headerMatch = trimmed.match(/^(#{1,4})\s+(.+)/);
    if (headerMatch) {
      flushList();
      const level = headerMatch[1].length;
      const Tag = `h${level + 2}`;
      parts.push(<Tag key={key++} className={`md-h md-h${level}`} dangerouslySetInnerHTML={{ __html: inlineFormat(headerMatch[2]) }} />);
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      if (!inList || listType !== 'ul') { flushList(); listType = 'ul'; }
      inList = true;
      listItems.push(trimmed.replace(/^[-*+]\s+/, ''));
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      if (!inList || listType !== 'ol') { flushList(); listType = 'ol'; }
      inList = true;
      listItems.push(trimmed.replace(/^\d+\.\s+/, ''));
      continue;
    }

    flushList();
    parts.push(<p key={key++} className="md-p" dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed) }} />);
  }

  flushList();
  flushTable();
  if (inCodeBlock && codeContent.length) {
    parts.push(<pre key={key++} className="md-code"><code>{codeContent.join('\n')}</code></pre>);
  }

  return parts;
}

export function extractSuggestedActions(text) {
  if (!text) return [];
  const actions = [];
  const actionPattern = /\[ACTION:\s*(.+?)\]/g;
  let match;
  while ((match = actionPattern.exec(text)) !== null) {
    actions.push(match[1].trim());
  }
  return actions.slice(0, 4);
}
