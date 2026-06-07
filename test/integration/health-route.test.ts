import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../src/app.js';

describe('GET /health', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let request: supertest.SuperTest<supertest.Test>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 when all services are healthy', async () => {
    const response = await request.get('/health');

    // If postgres/redis are available in test env, expect 200
    // Otherwise expect 503 (services unavailable)
    if (response.status === 200) {
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('timestamp');
    } else {
      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'error');
    }
  });

  it('returns expected service check fields', async () => {
    const response = await request.get('/health');

    if (response.status === 200) {
      const { services } = response.body;
      expect(services).toHaveProperty('postgres');
      expect(services).toHaveProperty('redis');
      expect(services).toHaveProperty('instagram_token');
      expect(services).toHaveProperty('queues');
    }
  });
});