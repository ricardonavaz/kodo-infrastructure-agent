import React from 'react';

const ENVIRONMENTS = [
  { value: '', label: 'Todos' },
  { value: 'production', label: 'Produccion' },
  { value: 'staging', label: 'Staging' },
  { value: 'test', label: 'Test' },
  { value: 'dev', label: 'Dev' },
];

const STATUSES = [
  { value: '', label: 'Todos' },
  { value: 'ok', label: 'OK' },
  { value: 'warning', label: 'Warning' },
  { value: 'unreachable', label: 'Unreachable' },
  { value: 'invalid_credentials', label: 'Cred. invalidas' },
  { value: 'pending_review', label: 'Pendiente' },
];

export default function SearchFilter({ filters, onChange }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="search-filter">
      <input
        type="text"
        className="search-input"
        placeholder="Buscar servidores..."
        value={filters.search || ''}
        onChange={(e) => update('search', e.target.value)}
      />
      <div className="filter-row">
        <select
          className="filter-select"
          value={filters.environment || ''}
          onChange={(e) => update('environment', e.target.value)}
        >
          {ENVIRONMENTS.map((e) => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filters.status || ''}
          onChange={(e) => update('status', e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button
          className={`filter-fav-btn ${filters.favorite ? 'active' : ''}`}
          onClick={() => update('favorite', filters.favorite ? '' : '1')}
          title="Solo favoritos"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill={filters.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2">
            <path d="M6 1l1.5 3.1L11 4.5 8.5 7l.6 3.5L6 8.8 2.9 10.5l.6-3.5L1 4.5l3.5-.4z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
