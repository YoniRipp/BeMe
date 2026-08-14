import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '.env') });

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { register as registerFoodEntries } from './tools/food-entries.js';
import { register as registerWorkouts } from './tools/workouts.js';
import { register as registerWater } from './tools/water.js';
import { register as registerWeight } from './tools/weight.js';
import { register as registerGoals } from './tools/goals.js';
import { register as registerCheckins } from './tools/checkins.js';
import { register as registerExercises } from './tools/exercises.js';
import { register as registerFoodSearch } from './tools/food-search.js';
import { register as registerProfile } from './tools/profile.js';
import { register as registerStreaks } from './tools/streaks.js';
import { register as registerTestMode } from './tools/test-mode.js';
import { register as registerOps } from './tools/ops.js';

const TRACKVIBE_API_URL = process.env.TRACKVIBE_API_URL || 'http://localhost:3000';
const TRACKVIBE_MCP_TOKEN = process.env.TRACKVIBE_MCP_TOKEN;
const authHeaders = TRACKVIBE_MCP_TOKEN ? { Authorization: `Bearer ${TRACKVIBE_MCP_TOKEN}` } : {};

async function handleResponse(res) {
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    // API errors arrive as { error: { code, message } }; older middleware used { error: string }
    const message = typeof err.error === 'string' ? err.error : err.error?.message;
    throw new Error(message || res.statusText || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const api = {
  async get(p) {
    const res = await fetch(`${TRACKVIBE_API_URL}${p}`, { headers: authHeaders });
    return handleResponse(res);
  },
  async post(p, body) {
    const res = await fetch(`${TRACKVIBE_API_URL}${p}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },
  async patch(p, body) {
    const res = await fetch(`${TRACKVIBE_API_URL}${p}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },
  async put(p, body) {
    const res = await fetch(`${TRACKVIBE_API_URL}${p}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },
  async delete(p) {
    const res = await fetch(`${TRACKVIBE_API_URL}${p}`, { method: 'DELETE', headers: authHeaders });
    return handleResponse(res);
  },
  // Non-throwing variant: returns { status, ok, body } instead of throwing on
  // non-2xx. Used by test-mode tools so Claude can assert on error responses
  // (e.g. that invalid input returns 400) rather than crashing the tool call.
  async raw(method, p, body) {
    const opts = { method, headers: { ...authHeaders } };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${TRACKVIBE_API_URL}${p}`, opts);
    const text = await res.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: res.status, ok: res.ok, body: parsed };
  },
};

const server = new McpServer({
  name: 'trackvibe',
  version: '2.0.0',
});

// --- Register all tools ---

registerFoodEntries(server, api);
registerWorkouts(server, api);
registerWater(server, api);
registerWeight(server, api);
registerGoals(server, api);
registerCheckins(server, api);
registerExercises(server, api);
registerFoodSearch(server, api);
registerProfile(server, api);
registerStreaks(server, api);

// Test/diagnostic tools are gated behind MCP_TEST_MODE so they are never
// exposed in normal operation. Enable only when pointing at a local backend
// with a dedicated test user (ideally an admin user, so the diagnostic
// endpoints — logs, metrics, stats — are readable).
if (process.env.MCP_TEST_MODE === 'true') {
  registerTestMode(server, api);
}

// Read-only analytics tools for the ops/analytics agents. Gated behind
// MCP_OPS_MODE; the impersonated user must be an admin (the wrapped endpoints
// require admin role).
if (process.env.MCP_OPS_MODE === 'true') {
  registerOps(server, api);
}

// --- Resources ---

server.resource(
  'goals',
  'trackvibe://goals',
  { title: 'Current goals' },
  async (uri) => {
    const items = await api.get('/api/goals');
    return {
      contents: [{ uri: uri.toString(), mimeType: 'application/json', text: JSON.stringify(items, null, 2) }],
    };
  }
);

server.resource(
  'profile',
  'trackvibe://profile',
  { title: 'User profile' },
  async (uri) => {
    const data = await api.get('/api/profile');
    return {
      contents: [{ uri: uri.toString(), mimeType: 'application/json', text: JSON.stringify(data, null, 2) }],
    };
  }
);

server.resource(
  'water-today',
  'trackvibe://water-today',
  { title: "Today's water intake" },
  async (uri) => {
    const data = await api.get('/api/water-entries');
    return {
      contents: [{ uri: uri.toString(), mimeType: 'application/json', text: JSON.stringify(data, null, 2) }],
    };
  }
);

server.resource(
  'streaks',
  'trackvibe://streaks',
  { title: 'Current streaks' },
  async (uri) => {
    const data = await api.get('/api/streaks');
    return {
      contents: [{ uri: uri.toString(), mimeType: 'application/json', text: JSON.stringify(data, null, 2) }],
    };
  }
);

// --- Run ---

const transport = new StdioServerTransport();
await server.connect(transport);
