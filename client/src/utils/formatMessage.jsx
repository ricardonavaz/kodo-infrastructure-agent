import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  gfm: true,
  breaks: false,
  pedantic: false,
});

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'strong', 'em', 'code', 'b', 'i', 'u', 'del', 's',
    'p', 'br', 'blockquote', 'pre',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a',
    'div', 'span',
  ],
  ALLOWED_ATTR: ['href', 'class', 'title', 'target', 'rel'],
};

export function inlineFormat(str) {
  if (str === null || str === undefined) return '';
  const text = String(str);
  if (text === '') return '';
  const html = marked.parseInline(text);
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

export function formatMessage(text) {
  if (text === null || text === undefined) return '';
  const str = String(text);
  if (str === '') return '';
  const html = marked.parse(str);
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
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
