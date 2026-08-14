import { serverConfig } from './server.config';

describe('serverConfig', () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original };
    delete process.env.PORT;
    delete process.env.CORS_ORIGINS;
  });

  afterAll(() => {
    process.env = original;
  });

  it('defaults to port 5000 and localhost origin', () => {
    const config = serverConfig();

    expect(config.port).toBe(5000);
    expect(config.corsOrigins).toEqual(['http://localhost:3000']);
  });

  it('splits CORS_ORIGINS on commas and trims each entry', () => {
    process.env.CORS_ORIGINS =
      'http://localhost:3000, https://app.vercel.app , https://example.com';

    expect(serverConfig().corsOrigins).toEqual([
      'http://localhost:3000',
      'https://app.vercel.app',
      'https://example.com',
    ]);
  });
});
