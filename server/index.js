import express from 'express';
import cors from 'cors';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import connectionsRouter from './routes/connections.js';
import agentRouter from './routes/agent.js';
import settingsRouter from './routes/settings.js';
import groupsRouter from './routes/groups.js';
import auditRouter from './routes/audit.js';
import playbooksRouter from './routes/playbooks.js';
import schedulerRouter from './routes/scheduler.js';
import updatesRouter from './routes/updates.js';
import sessionsRouter from './routes/sessions.js';
import profilesRouter from './routes/profiles.js';
import knowledgeRouter from './routes/knowledge.js';
import approvalRouter from './routes/approval.js';
import initialActionsRouter from './routes/initial-actions.js';
import exportRouter from './routes/export.js';
import securityRouter from './routes/security.js';
import directivesRouter from './routes/directives.js';
import authRouter from './routes/auth.js';
import { requireAuth } from './middleware/auth.js';
import { start as startScheduler, stop as stopScheduler } from './services/scheduler.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth routes (NO auth middleware on these)
app.use('/api/auth', authRouter);

// Apply auth middleware to all other /api/* routes
app.use('/api', (req, res, next) => {
  // Skip: auth routes are mounted separately, health is public
  if (req.path === '/health') return next();
  return requireAuth(req, res, next);
});

app.use('/api/connections', connectionsRouter);
app.use('/api/agent', agentRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/playbooks', playbooksRouter);
app.use('/api/scheduler', schedulerRouter);
app.use('/api/updates', updatesRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/approval', approvalRouter);
app.use('/api/initial-actions', initialActionsRouter);
app.use('/api/export', exportRouter);
app.use('/api/security', securityRouter);
app.use('/api/directives', directivesRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'Kodo Infrastructure Agent' });
});

// Serve frontend static files from client/dist
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDist = join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(clientDist, 'index.html'));
  }
});

// Kill any existing process on our port before starting
try {
  const pids = execSync(`lsof -ti:${PORT} 2>/dev/null`, { encoding: 'utf8' }).trim();
  if (pids) {
    execSync(`kill -9 ${pids.split('\n').join(' ')}`, { encoding: 'utf8' });
    console.log(`  Proceso anterior en puerto ${PORT} terminado`);
    // Small delay to let the port free up
    await new Promise((r) => setTimeout(r, 500));
  }
} catch { /* no process on port, good */ }

app.listen(PORT, () => {
  console.log(`⚡ Kōdo server running on http://localhost:${PORT}`);
  startScheduler();
});

process.on('SIGINT', () => { stopScheduler(); });
process.on('SIGTERM', () => { stopScheduler(); });

// Prevent crashes from unhandled errors (SSH disconnects, network issues)
// But let EADDRINUSE crash since it means port cleanup failed
process.on('uncaughtException', (err) => {
  if (err.code === 'EADDRINUSE') { console.error(`Puerto ${PORT} en uso. No se pudo iniciar.`); process.exit(1); }
  console.error('Uncaught exception (server continues):', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection (server continues):', err?.message || err);
});
