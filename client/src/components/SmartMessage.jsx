import React, { useState, useRef, useEffect } from 'react';
import { formatMessage } from '../utils/formatMessage.jsx';
import TextBlock from './blocks/TextBlock.jsx';
import CodeBlock from './blocks/CodeBlock.jsx';
import DataTable from './blocks/DataTable.jsx';
import MetricBlock from './blocks/MetricBlock.jsx';
import Finding from './blocks/Finding.jsx';
import QuestionPrompt from './blocks/QuestionPrompt.jsx';
import Recommendation from './blocks/Recommendation.jsx';
import SummaryCard from './blocks/SummaryCard.jsx';
import ExecutionStep from './blocks/ExecutionStep.jsx';
import ActionConfirmModal from './ActionConfirmModal.jsx';

const COMPONENT_MAP = {
  data_table: DataTable,
  metric_block: MetricBlock,
  finding: Finding,
  question_prompt: QuestionPrompt,
  recommendation: Recommendation,
  code_block: CodeBlock,
  text_block: TextBlock,
  summary_card: SummaryCard,
  execution_step: ExecutionStep,
};

export default function SmartMessage({
  blocks,
  content,
  onAction,
  connectionId,
  serverName,
  onActionEdit,
  onActionSend,
}) {
  const contentRef = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingActionText, setPendingActionText] = useState('');

  useEffect(() => {
    const div = contentRef.current;
    if (!div) return;

    const handler = (e) => {
      const btn = e.target.closest('button.md-action-marker');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        const actionText = btn.dataset.actionText || '';
        setPendingActionText(actionText);
        setModalOpen(true);
      }
    };

    div.addEventListener('click', handler);
    return () => div.removeEventListener('click', handler);
  }, [content, blocks]);

  const handleCancel = () => {
    setModalOpen(false);
    setPendingActionText('');
  };

  const handleEdit = () => {
    onActionEdit?.(pendingActionText);
    setModalOpen(false);
    setPendingActionText('');
  };

  const handleSend = () => {
    onActionSend?.(pendingActionText);
    setModalOpen(false);
    setPendingActionText('');
  };

  if (blocks && blocks.length > 0) {
    return (
      <div ref={contentRef} className="sb-smart-message">
        {blocks.map((block, index) => {
          const Component = COMPONENT_MAP[block.type];
          if (!Component) {
            return (
              <div key={index} className="sb-unknown-block">
                {block.content || JSON.stringify(block)}
              </div>
            );
          }
          return (
            <Component
              key={index}
              block={block}
              onAction={onAction}
              connectionId={connectionId}
            />
          );
        })}
        <ActionConfirmModal
          open={modalOpen}
          actionText={pendingActionText}
          serverName={serverName}
          onCancel={handleCancel}
          onEdit={handleEdit}
          onSend={handleSend}
        />
      </div>
    );
  }

  return (
    <>
      <div
        ref={contentRef}
        className="sb-smart-message"
        dangerouslySetInnerHTML={{ __html: formatMessage(content) }}
      />
      <ActionConfirmModal
        open={modalOpen}
        actionText={pendingActionText}
        serverName={serverName}
        onCancel={handleCancel}
        onEdit={handleEdit}
        onSend={handleSend}
      />
    </>
  );
}
