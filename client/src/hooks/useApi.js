const BASE = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('kodo_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: getAuthHeaders(),
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // If 401, redirect to login
  if (res.status === 401 && !path.includes('/auth/login')) {
    localStorage.removeItem('kodo_token');
    localStorage.removeItem('kodo_user');
    window.location.reload();
    throw new Error('Sesion expirada');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error de servidor');
  return data;
}

function buildQuery(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

/**
 * Start a chat job and stream SSE events.
 * Returns { jobId, eventSource } where eventSource is the SSE connection.
 */
async function chatStream(connectionId, message, model, onEvent, sessionId) {
  // 1. Start job
  const { jobId } = await request(`/agent/${connectionId}/chat`, {
    method: 'POST',
    body: { message, model, session_id: sessionId },
  });

  // 2. Connect to SSE stream
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('kodo_token');
    const url = `${BASE}/agent/${connectionId}/jobs/${jobId}/stream${token ? '?token=' + token : ''}`;
    const eventSource = new EventSource(url);
    let resolved = false;

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onEvent(parsed);

        if (parsed.type === 'done' || parsed.type === 'error') {
          eventSource.close();
          if (!resolved) {
            resolved = true;
            resolve({ jobId, result: parsed.data });
          }
        }
      } catch { /* malformed event */ }
    };

    eventSource.onerror = () => {
      // SSE disconnected - try to get final result
      eventSource.close();
      if (!resolved) {
        resolved = true;
        // Fetch job status in case it completed while we were disconnected
        request(`/agent/${connectionId}/jobs/${jobId}`)
          .then((job) => {
            if (job.status === 'completed') {
              onEvent({ type: 'done', data: job.result });
              resolve({ jobId, result: job.result });
            } else if (job.status === 'error') {
              onEvent({ type: 'error', data: { message: job.error } });
              reject(new Error(job.error));
            } else {
              // Still running - emit reconnecting event
              onEvent({ type: 'reconnecting', data: { jobId } });
              resolve({ jobId, reconnecting: true });
            }
          })
          .catch(reject);
      }
    };
  });
}

/**
 * Reconnect to an active job - fetch past events + connect to stream
 */
async function reconnectToJob(connectionId, jobId, onEvent) {
  // Get past events
  const job = await request(`/agent/${connectionId}/jobs/${jobId}`);

  // Replay past events
  for (const event of job.events || []) {
    onEvent({ type: event.type, data: event.data, replayed: true });
  }

  if (job.status === 'completed') {
    onEvent({ type: 'done', data: job.result });
    return { jobId, result: job.result };
  }

  if (job.status === 'error') {
    onEvent({ type: 'error', data: { message: job.error } });
    return { jobId, error: job.error };
  }

  // Still running - connect to stream for new events
  return new Promise((resolve) => {
    const token = localStorage.getItem('kodo_token');
    const url = `${BASE}/agent/${connectionId}/jobs/${jobId}/stream${token ? '?token=' + token : ''}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onEvent(parsed);
        if (parsed.type === 'done' || parsed.type === 'error') {
          eventSource.close();
          resolve({ jobId, result: parsed.data });
        }
      } catch { /* ignore */ }
    };

    eventSource.onerror = () => {
      eventSource.close();
      resolve({ jobId });
    };
  });
}

export const api = {
  // Connections
  getConnections: (params) => request(`/connections${buildQuery(params)}`),
  getConnection: (id) => request(`/connections/${id}`),
  createConnection: (data) => request('/connections', { method: 'POST', body: data }),
  updateConnection: (id, data) => request(`/connections/${id}`, { method: 'PUT', body: data }),
  deleteConnection: (id) => request(`/connections/${id}`, { method: 'DELETE' }),
  testConnection: (id) => request(`/connections/${id}/test`, { method: 'POST' }),
  connectServer: (id) => request(`/connections/${id}/connect`, { method: 'POST' }),
  disconnectServer: (id) => request(`/connections/${id}/disconnect`, { method: 'POST' }),
  getServerStatus: (id) => request(`/connections/${id}/status`),
  getAllStatuses: () => request('/connections/status/all'),
  toggleFavorite: (id) => request(`/connections/${id}/favorite`, { method: 'PUT' }),

  // Groups
  getGroups: () => request('/groups'),
  getGroup: (id) => request(`/groups/${id}`),
  createGroup: (data) => request('/groups', { method: 'POST', body: data }),
  updateGroup: (id, data) => request(`/groups/${id}`, { method: 'PUT', body: data }),
  deleteGroup: (id) => request(`/groups/${id}`, { method: 'DELETE' }),
  addToGroup: (groupId, connectionId) => request(`/groups/${groupId}/members`, { method: 'POST', body: { connection_id: connectionId } }),
  removeFromGroup: (groupId, connectionId) => request(`/groups/${groupId}/members/${connectionId}`, { method: 'DELETE' }),

  // Agent - Streaming
  chatStream,
  reconnectToJob,
  getActiveJobs: (connectionId) => request(`/agent/${connectionId}/jobs/active`),
  getJob: (connectionId, jobId) => request(`/agent/${connectionId}/jobs/${jobId}`),
  cancelJob: (connectionId, jobId) => request(`/agent/${connectionId}/jobs/${jobId}/cancel`, { method: 'POST' }),

  // Agent - Contextual explain
  explainBlock: (connectionId, data) => request(`/agent/${connectionId}/explain`, { method: 'POST', body: data }),

  // Agent - Legacy (for history)
  getHistory: (connectionId) => request(`/agent/${connectionId}/history`),
  clearHistory: (connectionId) => request(`/agent/${connectionId}/history`, { method: 'DELETE' }),

  // Playbooks
  getPlaybooks: (params) => request(`/playbooks${buildQuery(params)}`),
  getPlaybook: (id) => request(`/playbooks/${id}`),
  createPlaybook: (data) => request('/playbooks', { method: 'POST', body: data }),
  updatePlaybook: (id, data) => request(`/playbooks/${id}`, { method: 'PUT', body: data }),
  deletePlaybook: (id) => request(`/playbooks/${id}`, { method: 'DELETE' }),
  executePlaybook: (id, data) => request(`/playbooks/${id}/execute`, { method: 'POST', body: data }),
  getPlaybookRuns: (id) => request(`/playbooks/${id}/runs`),
  generatePlaybook: (data) => request('/playbooks/generate', { method: 'POST', body: data }),
  getPlaybookRun: (runId) => request(`/playbooks/runs/${runId}`),
  getRunInteractions: (runId) => request(`/playbooks/runs/${runId}/interactions`),
  respondToInteraction: (runId, interactionId, data) =>
    request(`/playbooks/runs/${runId}/interactions/${interactionId}/respond`, { method: 'POST', body: data }),
  executePlaybookStream: (id, data, onEvent) => {
    return new Promise((resolve, reject) => {
      fetch(`${BASE}/playbooks/${id}/execute-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((res) => {
        if (!res.ok) return res.json().then((d) => reject(new Error(d.error || 'Error')));
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        function read() {
          reader.read().then(({ done, value }) => {
            if (done) { resolve(); return; }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const parsed = JSON.parse(line.slice(6));
                  onEvent(parsed);
                  if (parsed.type === 'done' || parsed.type === 'error') { resolve(parsed); return; }
                } catch { /* malformed */ }
              }
            }
            read();
          }).catch(reject);
        }
        read();
      }).catch(reject);
    });
  },

  // Scheduler
  getScheduledTasks: () => request('/scheduler'),
  createScheduledTask: (data) => request('/scheduler', { method: 'POST', body: data }),
  updateScheduledTask: (id, data) => request(`/scheduler/${id}`, { method: 'PUT', body: data }),
  deleteScheduledTask: (id) => request(`/scheduler/${id}`, { method: 'DELETE' }),
  toggleScheduledTask: (id) => request(`/scheduler/${id}/toggle`, { method: 'PUT' }),
  runScheduledTaskNow: (id) => request(`/scheduler/${id}/run-now`, { method: 'POST' }),
  getScheduledTaskRuns: (id, params) => request(`/scheduler/${id}/runs${buildQuery(params)}`),
  getSchedulerTemplates: () => request('/scheduler/templates/list'),

  // Updates
  checkUpdates: (connectionId) => request(`/updates/check/${connectionId}`, { method: 'POST' }),
  getUpdateStatus: (connectionId) => request(`/updates/status/${connectionId}`),
  getAllUpdateStatus: () => request('/updates/status'),
  applyUpdates: (connectionId, data) => request(`/updates/apply/${connectionId}`, { method: 'POST', body: data }),
  getUpdateHistory: (connectionId) => request(`/updates/history/${connectionId}`),
  getUpdateDashboard: () => request('/updates/dashboard/summary'),

  // Sessions
  startSession: (connectionId) => request(`/sessions/${connectionId}/start`, { method: 'POST' }),
  endSession: (sessionId) => request(`/sessions/${sessionId}/end`, { method: 'POST' }),
  getActiveSession: (connectionId) => request(`/sessions/${connectionId}/active`),
  getSessionHistory: (connectionId) => request(`/sessions/${connectionId}/history`),

  // Server Profiles
  getProfile: (connectionId) => request(`/profiles/${connectionId}`),
  updateProfile: (connectionId, data) => request(`/profiles/${connectionId}`, { method: 'PUT', body: data }),
  refreshProfile: (connectionId) => request(`/profiles/${connectionId}/refresh`, { method: 'POST' }),

  // Knowledge Base
  getKnowledge: (params) => request(`/knowledge${buildQuery(params)}`),
  createKnowledge: (data) => request('/knowledge', { method: 'POST', body: data }),
  deleteKnowledge: (id) => request(`/knowledge/${id}`, { method: 'DELETE' }),
  getKnowledgeDocs: (params) => request(`/knowledge/documents/list${buildQuery(params)}`),
  uploadDocument: (data) => request('/knowledge/documents/upload', { method: 'POST', body: data }),
  importDocUrl: (data) => request('/knowledge/documents/url', { method: 'POST', body: data }),
  deleteDocument: (id) => request(`/knowledge/documents/${id}`, { method: 'DELETE' }),

  // Approval Profiles
  getApprovalProfiles: () => request('/approval/profiles'),
  toggleApprovalProfile: (id) => request(`/approval/profiles/${id}/toggle`, { method: 'PUT' }),

  // Initial Actions
  getInitialActions: (connectionId) => request(`/initial-actions/${connectionId}`),

  // Security
  runSecurityAudit: (connectionId) => request(`/security/audit/${connectionId}`, { method: 'POST' }),
  getSecurityReport: (connectionId) => request(`/security/report/${connectionId}`),
  getServerEvents: (connectionId, params) => request(`/security/events/${connectionId}${buildQuery(params)}`),

  // Audit
  getAuditLog: (params) => request(`/audit${buildQuery(params)}`),
  getAuditRecord: (id) => request(`/audit/${id}`),
  getAuditStats: () => request('/audit/stats/summary'),

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: (data) => request('/settings', { method: 'PUT', body: data }),

  // Auth & Users
  login: (data) => request('/auth/login', { method: 'POST', body: data }),
  getMe: () => request('/auth/me'),
  changePassword: (data) => request('/auth/password', { method: 'PUT', body: data }),
  getUsers: () => request('/auth/users'),
  createUser: (data) => request('/auth/users', { method: 'POST', body: data }),
  updateUser: (id, data) => request(`/auth/users/${id}`, { method: 'PUT', body: data }),
  deleteUser: (id) => request(`/auth/users/${id}`, { method: 'DELETE' }),

  // Approval Profiles (full CRUD)
  createApprovalProfile: (data) => request('/approval/profiles', { method: 'POST', body: data }),
  updateApprovalProfile: (id, data) => request(`/approval/profiles/${id}`, { method: 'PUT', body: data }),
  deleteApprovalProfile: (id) => request(`/approval/profiles/${id}`, { method: 'DELETE' }),
  checkApproval: (data) => request('/approval/check', { method: 'POST', body: data }),
  getApprovalLog: (params) => request(`/approval/log${buildQuery(params)}`),

  // Safety Directives
  getDirectives: () => request('/directives'),
  createDirective: (data) => request('/directives', { method: 'POST', body: data }),
  toggleDirective: (id) => request(`/directives/${id}/toggle`, { method: 'PUT' }),
  deleteDirective: (id) => request(`/directives/${id}`, { method: 'DELETE' }),
  suggestDirectives: (data) => request('/directives/suggest', { method: 'POST', body: data }),
};
