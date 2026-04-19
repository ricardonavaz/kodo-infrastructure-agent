import React from 'react';
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

export default function SmartMessage({ blocks, content, onAction, connectionId }) {
  if (blocks && blocks.length > 0) {
    return (
      <div className="sb-smart-message">
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
      </div>
    );
  }

  return <div className="sb-smart-message">{formatMessage(content)}</div>;
}
