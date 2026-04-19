import React, { useState } from 'react';

export default function QuestionPrompt({ block, onAction }) {
  const { question, options = [], inputType = 'buttons', placeholder } = block;
  const [textValue, setTextValue] = useState('');
  const [selectedOption, setSelectedOption] = useState('');

  const handleAnswer = (value) => {
    if (onAction) onAction('answer', value);
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (textValue.trim()) {
      handleAnswer(textValue.trim());
      setTextValue('');
    }
  };

  const renderInput = () => {
    switch (inputType) {
      case 'buttons':
        return (
          <div className="sb-question-options">
            {options.map((opt, i) => (
              <button
                key={i}
                className="sb-question-btn suggestion-btn"
                onClick={() => handleAnswer(typeof opt === 'string' ? opt : opt.value)}
              >
                {typeof opt === 'string' ? opt : opt.label}
              </button>
            ))}
          </div>
        );

      case 'select':
        return (
          <div className="sb-question-options">
            <select
              className="sb-question-select"
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
            >
              <option value="">Seleccionar...</option>
              {options.map((opt, i) => (
                <option key={i} value={typeof opt === 'string' ? opt : opt.value}>
                  {typeof opt === 'string' ? opt : opt.label}
                </option>
              ))}
            </select>
            <button
              className="sb-question-btn"
              onClick={() => selectedOption && handleAnswer(selectedOption)}
              disabled={!selectedOption}
            >
              Confirmar
            </button>
          </div>
        );

      case 'text':
        return (
          <form className="sb-question-options" onSubmit={handleTextSubmit}>
            <input
              type="text"
              className="sb-question-input"
              placeholder={placeholder || 'Escribe tu respuesta...'}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
            />
            <button type="submit" className="sb-question-btn" disabled={!textValue.trim()}>
              Enviar
            </button>
          </form>
        );

      case 'confirm':
        return (
          <div className="sb-question-options">
            <button
              className="sb-question-btn sb-question-btn-confirm"
              onClick={() => handleAnswer('si')}
            >
              Si
            </button>
            <button
              className="sb-question-btn sb-question-btn-cancel"
              onClick={() => handleAnswer('no')}
            >
              No
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="sb-question">
      <p className="sb-question-text">{question}</p>
      {renderInput()}
    </div>
  );
}
