import React, { useState, useEffect } from 'react';
import { api } from '../hooks/useApi.js';

const OS_OPTIONS = ['', 'debian', 'rhel', 'fedora', 'arch', 'suse', 'windows'];
const CAT_OPTIONS = ['', 'maintenance', 'diagnostic', 'security', 'deployment', 'configuration', 'monitoring', 'other'];
const OUTCOME_COLORS = { success: 'var(--accent)', failure: 'var(--red)', partial: 'var(--amber)' };

export default function KnowledgeManager({ onClose }) {
  const [tab, setTab] = useState('entries');
  const [entries, setEntries] = useState([]);
  const [docs, setDocs] = useState([]);
  const [osFilter, setOsFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [importUrl, setImportUrl] = useState('');
  const [importPath, setImportPath] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [importOs, setImportOs] = useState('');

  const load = async () => {
    const params = {};
    if (osFilter) params.os_family = osFilter;
    if (catFilter) params.category = catFilter;
    try {
      setEntries(await api.getKnowledge(params));
      setDocs(await api.getKnowledgeDocs({ os_family: osFilter || undefined }));
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, [osFilter, catFilter]);

  const handleDeleteEntry = async (id) => {
    if (!confirm('Eliminar esta entrada?')) return;
    await api.deleteKnowledge(id);
    load();
  };

  const handleDeleteDoc = async (id) => {
    if (!confirm('Eliminar este documento?')) return;
    await api.deleteDocument(id);
    load();
  };

  const handleImportUrl = async () => {
    if (!importUrl) return;
    try {
      await api.importDocUrl({ url: importUrl, title: importTitle || undefined, os_family: importOs || undefined });
      setImportUrl(''); setImportTitle(''); setImportOs('');
      load();
    } catch (e) { alert(e.message); }
  };

  const handleImportFile = async () => {
    if (!importPath) return;
    try {
      await api.uploadDocument({ filePath: importPath, title: importTitle || undefined, os_family: importOs || undefined });
      setImportPath(''); setImportTitle(''); setImportOs('');
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <h3>// Base de Conocimientos</h3>

        <div className="kb-controls">
          <div className="exec-tabs">
            <button className={`exec-tab ${tab === 'entries' ? 'active' : ''}`} onClick={() => setTab('entries')}>Experiencias ({entries.length})</button>
            <button className={`exec-tab ${tab === 'docs' ? 'active' : ''}`} onClick={() => setTab('docs')}>Documentos ({docs.length})</button>
          </div>
          <div className="kb-filters">
            <select className="filter-select" value={osFilter} onChange={(e) => setOsFilter(e.target.value)}>
              <option value="">OS: Todos</option>
              {OS_OPTIONS.filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {tab === 'entries' && (
              <select className="filter-select" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                <option value="">Categoria: Todas</option>
                {CAT_OPTIONS.filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginTop: 8 }}>
          {tab === 'entries' ? (
            entries.length === 0 ? <p className="kb-empty">Sin experiencias registradas para estos filtros.</p> :
            entries.map((e) => (
              <div key={e.id} className="kb-entry" onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>
                <div className="kb-entry-header">
                  <span className="kb-dot" style={{ background: OUTCOME_COLORS[e.outcome] || 'var(--text-muted)' }} />
                  <span className="kb-name">{e.action_name}</span>
                  {e.os_family && <span className="env-badge dev">{e.os_family}</span>}
                  <span className="audit-type">{e.category}</span>
                  <span className="metrics-chip">{e.success_count}✓ {e.failure_count}✗</span>
                  <span className="metrics-chip">{e.source}</span>
                  <button className="delete-btn" onClick={(ev) => { ev.stopPropagation(); handleDeleteEntry(e.id); }} title="Eliminar">✗</button>
                </div>
                {expandedId === e.id && (
                  <div className="kb-detail">
                    {e.outcome_details && <p><strong>Detalle:</strong> {e.outcome_details.substring(0, 300)}</p>}
                    {e.error_message && <p style={{ color: 'var(--red)' }}><strong>Error:</strong> {e.error_message}</p>}
                    {e.resolution && <p style={{ color: 'var(--accent)' }}><strong>Resolucion:</strong> {e.resolution}</p>}
                    {e.command_sequence && <pre>{e.command_sequence}</pre>}
                  </div>
                )}
              </div>
            ))
          ) : (
            <>
              <div className="kb-import-bar">
                <input type="text" placeholder="Titulo (opcional)" value={importTitle} onChange={(e) => setImportTitle(e.target.value)} className="search-input" style={{ marginBottom: 0, flex: 1 }} />
                <select className="filter-select" value={importOs} onChange={(e) => setImportOs(e.target.value)}>
                  <option value="">OS: Global</option>
                  {OS_OPTIONS.filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="kb-import-bar">
                <input type="text" placeholder="URL del documento..." value={importUrl} onChange={(e) => setImportUrl(e.target.value)} className="search-input" style={{ marginBottom: 0, flex: 1 }} />
                <button className="btn btn-primary" onClick={handleImportUrl} disabled={!importUrl} style={{ padding: '5px 12px', fontSize: 11 }}>Importar URL</button>
              </div>
              <div className="kb-import-bar">
                <input type="text" placeholder="Ruta del archivo local..." value={importPath} onChange={(e) => setImportPath(e.target.value)} className="search-input" style={{ marginBottom: 0, flex: 1 }} />
                <button className="btn btn-primary" onClick={handleImportFile} disabled={!importPath} style={{ padding: '5px 12px', fontSize: 11 }}>Importar Archivo</button>
              </div>

              {docs.length === 0 ? <p className="kb-empty">Sin documentos importados.</p> :
              docs.map((d) => (
                <div key={d.id} className="kb-entry">
                  <div className="kb-entry-header">
                    <span className="kb-doc-icon">{d.source_type === 'url' ? '🌐' : '📄'}</span>
                    <span className="kb-name">{d.title}</span>
                    {d.os_family && <span className="env-badge dev">{d.os_family}</span>}
                    <span className="audit-type">{d.source_type}</span>
                    <span className="metrics-chip">{d.file_size ? Math.round(d.file_size / 1024) + 'KB' : ''}</span>
                    <button className="delete-btn" onClick={() => handleDeleteDoc(d.id)} title="Eliminar">✗</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="modal-actions">
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tab === 'entries' ? entries.length : docs.length} registros</span>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
