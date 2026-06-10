import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Toggl Track API v9. Auth token comes from $TOGGL_API_TOKEN or
// ~/.gretchen/toggl-token (the token is on https://track.toggl.com/profile).
const TOKEN_FILE = path.join(os.homedir(), '.gretchen', 'toggl-token');
const BASE = 'https://api.track.toggl.com/api/v9';

export function togglToken() {
  if (process.env.TOGGL_API_TOKEN) return process.env.TOGGL_API_TOKEN.trim();
  try {
    return fs.readFileSync(TOKEN_FILE, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

// the profile page where the API token lives, at the bottom
export const TOKEN_URL = 'https://track.toggl.com/profile';

export function openTokenPage() {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', TOKEN_URL] : [TOKEN_URL];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch {}
}

// /toggl setup: check a token against the API before saving it
export async function verifyToken(token) {
  const res = await fetch(`${BASE}/me`, {
    headers: { Authorization: `Basic ${Buffer.from(`${token}:api_token`).toString('base64')}` },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export function saveToken(token) {
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, `${token}\n`, { mode: 0o600 });
  cache = null;
}

export function clearToken() {
  try {
    fs.unlinkSync(TOKEN_FILE);
  } catch {}
  cache = null;
}

async function api(method, route, body) {
  const token = togglToken();
  if (!token) throw new Error('no token — set TOGGL_API_TOKEN or write it to ~/.gretchen/toggl-token');
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${token}:api_token`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${res.status}${detail ? ` ${detail.slice(0, 80)}` : ''}`);
  }
  return res.status === 204 ? null : res.json();
}

// workspace id + project list, fetched once per session
let cache = null;
async function context() {
  if (!cache) {
    const me = await api('GET', '/me');
    const projects = (await api('GET', '/me/projects')) || [];
    cache = { workspaceId: me.default_workspace_id, projects };
  }
  return cache;
}

// Match a #tag to an existing Toggl project by name (case-insensitive).
// Tags never create their own projects — unmatched entries fall back to "Untitled".
async function findProject(tag) {
  if (!tag) return null;
  const name = tag.replace(/^#/, '').toLowerCase();
  const { projects } = await context();
  return projects.find((p) => p.name.toLowerCase() === name) || null;
}

// the catch-all project for entries whose tag matches nothing; created on first use
async function untitledProject() {
  const ctx = await context();
  let p = ctx.projects.find((p) => p.name.toLowerCase() === 'untitled');
  if (!p) {
    p = await api('POST', `/workspaces/${ctx.workspaceId}/projects`, { name: 'Untitled', active: true });
    ctx.projects.push(p);
  }
  return p;
}

export async function startEntry({ description, tag }) {
  const { workspaceId } = await context();
  const project = (await findProject(tag)) || (await untitledProject());
  const entry = await api('POST', `/workspaces/${workspaceId}/time_entries`, {
    description,
    project_id: project.id,
    start: new Date().toISOString(),
    duration: -1, // running entry; Toggl stops any previously running one
    created_with: 'gretchen',
    workspace_id: workspaceId,
  });
  return { entry, project };
}

export async function stopEntry(entryId) {
  const { workspaceId } = await context();
  return api('PATCH', `/workspaces/${workspaceId}/time_entries/${entryId}/stop`);
}
