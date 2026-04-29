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

// Custom marked extension to convert [ACTION: text] markers into clickable
// pill buttons. The pills use class "md-action-marker" for CSS styling and
// data-action-text attribute carrying the action text. Click handler is
// attached via event delegation in the consumer component (SmartMessage).
//
// Two extensions: block-level (own line) and inline-level (mid-paragraph).
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

marked.use({
  extensions: [{
    name: 'actionMarkerBlock',
    level: 'block',
    start(src) { return src.match(/\[ACTION:/)?.index; },
    tokenizer(src) {
      const match = /^\[ACTION:\s*([^\]]+)\]\s*\n?/.exec(src);
      if (match) {
        return {
          type: 'actionMarkerBlock',
          raw: match[0],
          text: match[1].trim(),
        };
      }
    },
    renderer(token) {
      const escaped = escapeHtml(token.text);
      return `<button type="button" class="md-action-marker" data-action-text="${escaped}">⚡ ${escaped}</button>`;
    },
  }, {
    name: 'actionMarkerInline',
    level: 'inline',
    start(src) { return src.match(/\[ACTION:/)?.index; },
    tokenizer(src) {
      const match = /^\[ACTION:\s*([^\]]+)\]/.exec(src);
      if (match) {
        return {
          type: 'actionMarkerInline',
          raw: match[0],
          text: match[1].trim(),
        };
      }
    },
    renderer(token) {
      const escaped = escapeHtml(token.text);
      return `<button type="button" class="md-action-marker" data-action-text="${escaped}">⚡ ${escaped}</button>`;
    },
  }]
});

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'strong', 'em', 'code', 'b', 'i', 'u', 'del', 's',
    'p', 'br', 'blockquote', 'pre',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a',
    'div', 'span', 'button',
  ],
  ALLOWED_ATTR: ['href', 'class', 'title', 'target', 'rel', 'type', 'data-action-text'],
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
