import React from 'react';
import { formatMessage } from '../../utils/formatMessage.jsx';

export default function TextBlock({ block }) {
  const { content, format } = block;

  if (format === 'markdown' || !format) {
    return (
      <div
        className="sb-text-block"
        dangerouslySetInnerHTML={{ __html: formatMessage(content) }}
      />
    );
  }

  return (
    <div className="sb-text-block">
      <pre className="sb-text-pre">{content}</pre>
    </div>
  );
}
