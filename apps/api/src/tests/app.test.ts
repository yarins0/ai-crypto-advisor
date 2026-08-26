import request from 'supertest';
import { expect, it } from 'vitest';
import { createApp } from '../app.js';

it('reports health', async () => {
  const response = await request(createApp()).get('/api/health');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ ok: true });
});
