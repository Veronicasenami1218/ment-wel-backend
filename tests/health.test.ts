import request from 'supertest';
import { expressApp } from '../src/test-app';
import { describe, it } from 'node:test';
import expect from 'expect';

describe('Health Check', () => {
  it('GET /health should return ok', async () => {
    const res = await request(expressApp).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

