import db from '../db.js';
import { readFileSync } from 'fs';

// ==================== EXPERIENCE LEARNING ====================

export function learnFromExecution(params) {
  const { sessionId, connectionId, osFamily, osVersion, actionName, commands, outcome, outcomeDetails, errorMessage, resolution, category } = params;

  // Check if similar entry exists
  const existing = db.prepare(
    'SELECT * FROM knowledge_entries WHERE os_family = ? AND action_name = ? AND connection_id IS ?'
  ).get(osFamily, actionName, connectionId || null);

  if (existing) {
    // Update counters
    if (outcome === 'success') {
      db.prepare('UPDATE knowledge_entries SET success_count = success_count + 1, last_used_at = datetime(\'now\'), outcome = ?, outcome_details = ? WHERE id = ?')
        .run(outcome, outcomeDetails, existing.id);
    } else {
      db.prepare('UPDATE knowledge_entries SET failure_count = failure_count + 1, last_used_at = datetime(\'now\'), outcome = ?, outcome_details = ?, error_message = ?, resolution = ? WHERE id = ?')
        .run(outcome, outcomeDetails, errorMessage || existing.error_message, resolution || existing.resolution, existing.id);
    }
    return existing.id;
  }

  // Create new entry
  const result = db.prepare(
    `INSERT INTO knowledge_entries (connection_id, os_family, os_version, category, action_name, command_sequence, outcome, outcome_details, error_message, resolution, learned_from_session, source, success_count, failure_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto', ?, ?)`
  ).run(
    connectionId || null, osFamily, osVersion, category || 'other',
    actionName, JSON.stringify(commands || []),
    outcome, outcomeDetails, errorMessage || null, resolution || null,
    sessionId || null,
    outcome === 'success' ? 1 : 0,
    outcome !== 'success' ? 1 : 0
  );

  return result.lastInsertRowid;
}

export function findRelevantKnowledge(osFamily, osVersion, category, limit = 5) {
  // First try exact OS+version match
  let entries = db.prepare(
    'SELECT * FROM knowledge_entries WHERE os_family = ? AND os_version = ? AND category = ? ORDER BY success_count DESC, last_used_at DESC LIMIT ?'
  ).all(osFamily, osVersion, category, limit);

  // Fallback to OS family only
  if (entries.length < limit) {
    const more = db.prepare(
      'SELECT * FROM knowledge_entries WHERE os_family = ? AND (os_version != ? OR os_version IS NULL) AND category = ? ORDER BY success_count DESC LIMIT ?'
    ).all(osFamily, osVersion || '', category, limit - entries.length);
    entries = [...entries, ...more];
  }

  // Add global entries
  if (entries.length < limit) {
    const global = db.prepare(
      'SELECT * FROM knowledge_entries WHERE os_family IS NULL AND category = ? ORDER BY success_count DESC LIMIT ?'
    ).all(category, limit - entries.length);
    entries = [...entries, ...global];
  }

  return entries;
}

export function getKnowledgeForPrompt(connectionId) {
  const profile = db.prepare('SELECT os_family, os_version FROM server_profiles WHERE connection_id = ?').get(connectionId);
  if (!profile) return '';

  const osFamily = profile.os_family;
  if (!osFamily) return '';

  // STRICT OS filtering: only entries matching this OS family + global (NULL) entries
  // Never mix Linux knowledge with Windows or vice versa
  const experiences = db.prepare(
    'SELECT action_name, command_sequence, outcome, success_count, failure_count FROM knowledge_entries WHERE (os_family = ? OR os_family IS NULL) AND success_count > 0 ORDER BY success_count DESC LIMIT 10'
  ).all(osFamily);

  // Get relevant document chunks
  const docs = db.prepare(
    'SELECT title, content_chunks FROM knowledge_documents WHERE (os_family = ? OR os_family IS NULL) LIMIT 5'
  ).all(profile.os_family);

  // Get failure lessons
  const failures = db.prepare(
    `SELECT action_name, error_message, resolution FROM knowledge_entries WHERE (os_family = ? OR os_family IS NULL) AND failure_count > 0 AND resolution IS NOT NULL AND resolution != '' ORDER BY failure_count DESC LIMIT 5`
  ).all(profile.os_family);

  let context = '';

  if (experiences.length > 0) {
    context += '\n\nEXPERIENCIAS PREVIAS EXITOSAS EN ESTE TIPO DE SERVIDOR:\n';
    for (const exp of experiences) {
      context += `- ${exp.action_name} (${exp.success_count} exitos, ${exp.failure_count} fallos)\n`;
    }
  }

  if (failures.length > 0) {
    context += '\n\nLECCIONES DE ERRORES PASADOS:\n';
    for (const f of failures) {
      context += `- ${f.action_name}: Error: ${f.error_message?.substring(0, 100)}. Solucion: ${f.resolution?.substring(0, 100)}\n`;
    }
  }

  if (docs.length > 0) {
    context += '\n\nDOCUMENTACION RELEVANTE:\n';
    for (const doc of docs) {
      try {
        const chunks = JSON.parse(doc.content_chunks || '[]');
        if (chunks.length > 0) {
          context += `[${doc.title}]: ${chunks[0].chunk?.substring(0, 300)}\n`;
        }
      } catch { /* invalid json */ }
    }
  }

  return context;
}

// ==================== DOCUMENT IMPORT ====================

export function importDocument(filePath, metadata = {}) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  let content = '';

  try {
    if (['txt', 'md', 'markdown'].includes(ext)) {
      content = readFileSync(filePath, 'utf8');
    } else if (ext === 'html' || ext === 'htm') {
      const raw = readFileSync(filePath, 'utf8');
      content = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    } else {
      // For PDF, DOCX - store path, content extraction would need external tools
      // For now, store metadata and empty content (user can paste text manually)
      content = `[Archivo ${ext} importado - extraer texto manualmente si es necesario]`;
    }
  } catch (e) {
    throw new Error(`Error leyendo archivo: ${e.message}`);
  }

  const chunks = chunkText(content, metadata.title || filePath);
  const fileSize = content.length;

  const result = db.prepare(
    `INSERT INTO knowledge_documents (title, source_type, source_path, os_family, os_version, category, content_text, content_chunks, tags, file_size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    metadata.title || filePath.split('/').pop(),
    ext, filePath,
    metadata.os_family || null,
    metadata.os_version || null,
    metadata.category || 'general',
    content,
    JSON.stringify(chunks),
    JSON.stringify(metadata.tags || []),
    fileSize
  );

  return { id: result.lastInsertRowid, chunks: chunks.length };
}

export async function importFromUrl(url, metadata = {}) {
  let content = '';
  try {
    const res = await fetch(url);
    const html = await res.text();
    // Strip HTML tags for plain text
    content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (e) {
    throw new Error(`Error fetching URL: ${e.message}`);
  }

  const chunks = chunkText(content, metadata.title || url);

  const result = db.prepare(
    `INSERT INTO knowledge_documents (title, source_type, source_path, os_family, os_version, category, content_text, content_chunks, tags, file_size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    metadata.title || url,
    'url', url,
    metadata.os_family || null,
    metadata.os_version || null,
    metadata.category || 'general',
    content.substring(0, 500000), // max 500KB text
    JSON.stringify(chunks),
    JSON.stringify(metadata.tags || []),
    content.length
  );

  return { id: result.lastInsertRowid, chunks: chunks.length };
}

function chunkText(text, title, chunkSize = 500) {
  if (!text) return [];
  const chunks = [];
  const paragraphs = text.split(/\n\n+/);
  let current = '';
  let section = title;

  for (const para of paragraphs) {
    // Detect section headers
    const headerMatch = para.match(/^#{1,4}\s+(.+)/);
    if (headerMatch) section = headerMatch[1];

    if (current.length + para.length > chunkSize && current) {
      const keywords = extractKeywords(current);
      chunks.push({ chunk: current.trim(), section, keywords });
      current = '';
    }
    current += para + '\n\n';
  }

  if (current.trim()) {
    chunks.push({ chunk: current.trim(), section, keywords: extractKeywords(current) });
  }

  return chunks;
}

function extractKeywords(text) {
  const stopwords = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'en', 'un', 'una', 'que', 'es', 'y', 'a', 'por', 'para', 'con', 'se', 'the', 'is', 'in', 'to', 'and', 'of', 'a', 'for', 'on', 'with']);
  const words = text.toLowerCase().replace(/[^a-z0-9áéíóúñ\s-]/g, '').split(/\s+/);
  const freq = {};
  for (const w of words) {
    if (w.length > 3 && !stopwords.has(w)) {
      freq[w] = (freq[w] || 0) + 1;
    }
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);
}

export function searchDocuments(query, osFamily = null) {
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

  let docs;
  if (osFamily) {
    docs = db.prepare('SELECT * FROM knowledge_documents WHERE os_family = ? OR os_family IS NULL').all(osFamily);
  } else {
    docs = db.prepare('SELECT * FROM knowledge_documents').all();
  }

  const results = [];
  for (const doc of docs) {
    try {
      const chunks = JSON.parse(doc.content_chunks || '[]');
      for (const chunk of chunks) {
        const score = queryWords.reduce((s, w) => s + (chunk.chunk?.toLowerCase().includes(w) ? 1 : 0) + (chunk.keywords?.includes(w) ? 2 : 0), 0);
        if (score > 0) {
          results.push({ docId: doc.id, title: doc.title, section: chunk.section, chunk: chunk.chunk?.substring(0, 300), score });
        }
      }
    } catch { /* invalid json */ }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 10);
}
