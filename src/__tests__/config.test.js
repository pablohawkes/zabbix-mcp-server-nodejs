const config = require('../config');
const { logger } = require('../utils/logger');

describe('Zabbix MCP Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Default Configuration', () => {
    test('should have correct default API configuration', () => {
      expect(config.api.url).toBe('https://monitoring.sipef.com/api_jsonrpc.php');
      expect(config.api.timeout).toBe(120000);
      expect(config.api.authMethod).toBe('none'); // No credentials in test env
      expect(config.api.username).toBe('Admin');
    });

    test('should have correct default transport configuration', () => {
      expect(config.transport.mode).toBe('stdio');
      expect(config.transport.http.port).toBe(3000);
      expect(config.transport.http.host).toBe('localhost');
      expect(config.transport.http.sessionManagement).toBe(false);
    });

    test('should have correct cache configuration', () => {
      expect(config.cache.enabled).toBe(false); // Fixed || true pattern
      expect(config.cache.ttl).toBe(300);
      expect(config.cache.maxSize).toBe(1000);
    });

    test('should have correct SSL configuration', () => {
      expect(config.api.ignoreSelfSignedCert).toBe(false); // Fixed || true pattern
    });

    test('should have logging configuration', () => {
      expect(config.logging.prefix).toBe('[Zabbix API Client]');
    });
  });

  describe('Environment Variable Override', () => {
    test('should override API configuration from environment', () => {
      process.env.ZABBIX_API_URL = 'https://custom.zabbix.server/api_jsonrpc.php';
      process.env.ZABBIX_API_TOKEN = 'custom-token';
      process.env.ZABBIX_REQUEST_TIMEOUT = '60000';

      delete require.cache[require.resolve('../config')];
      const customConfig = require('../config');

      expect(customConfig.api.url).toBe('https://custom.zabbix.server/api_jsonrpc.php');
      expect(customConfig.api.apiToken).toBe('custom-token');
      expect(customConfig.api.timeout).toBe(60000);
      expect(customConfig.api.authMethod).toBe('token');
    });

    test('should prioritize API token over password', () => {
      process.env.ZABBIX_API_TOKEN = 'token-auth';
      process.env.ZABBIX_PASSWORD = 'password-auth';

      delete require.cache[require.resolve('../config')];
      const customConfig = require('../config');

      expect(customConfig.api.authMethod).toBe('token');
      expect(customConfig.api.apiToken).toBe('token-auth');
    });

    test('should use password auth when no token provided', () => {
      delete process.env.ZABBIX_API_TOKEN;
      process.env.ZABBIX_PASSWORD = 'test-password';
      process.env.ZABBIX_USERNAME = 'test-user';

      delete require.cache[require.resolve('../config')];
      const customConfig = require('../config');

      expect(customConfig.api.authMethod).toBe('password');
      expect(customConfig.api.password).toBe('test-password');
      expect(customConfig.api.username).toBe('test-user');
    });

    test('should override transport configuration from environment', () => {
      process.env.MCP_TRANSPORT_MODE = 'http';
      process.env.MCP_HTTP_PORT = '8080';
      process.env.MCP_HTTP_HOST = '0.0.0.0';
      process.env.MCP_SESSION_MANAGEMENT = 'true';

      delete require.cache[require.resolve('../config')];
      const customConfig = require('../config');

      expect(customConfig.transport.mode).toBe('http');
      expect(customConfig.transport.http.port).toBe(8080);
      expect(customConfig.transport.http.host).toBe('0.0.0.0');
      expect(customConfig.transport.http.sessionManagement).toBe(true);
    });

    test('should respect SSL and cache environment variables', () => {
      process.env.ZABBIX_IGNORE_SELFSIGNED_CERT = 'true';
      process.env.CACHE_ENABLED = 'true';

      delete require.cache[require.resolve('../config')];
      const customConfig = require('../config');

      expect(customConfig.api.ignoreSelfSignedCert).toBe(true);
      expect(customConfig.cache.enabled).toBe(true);
    });

    test('should handle invalid timeout gracefully', () => {
      process.env.ZABBIX_REQUEST_TIMEOUT = 'invalid';

      delete require.cache[require.resolve('../config')];
      const customConfig = require('../config');

      expect(customConfig.api.timeout).toBe(120000); // Should fallback to default
    });

    test('should handle invalid port gracefully', () => {
      process.env.MCP_HTTP_PORT = 'invalid';

      delete require.cache[require.resolve('../config')];
      const customConfig = require('../config');

      expect(customConfig.transport.http.port).toBe(3000); // Should fallback to default
    });
  });

  test('should have valid API configuration', () => {
    expect(config).toBeDefined();
    expect(config.api).toBeDefined();
    expect(config.api.url).toBeDefined();
    expect(config.api.timeout).toBeDefined();
    expect(typeof config.api.timeout).toBe('number');
  });

  test('should have valid Zabbix API URL', () => {
    expect(config.api.url).toMatch(/^https?:\/\//);
    expect(config.api.url).toContain('api_jsonrpc.php');
  });

  test('should have reasonable timeout value', () => {
    expect(config.api.timeout).toBeGreaterThan(0);
    expect(config.api.timeout).toBeLessThanOrEqual(180000); // Max 180 seconds (3 minutes)
  });

  test('should validate authentication method', () => {
    expect(['none', 'token', 'password']).toContain(config.api.authMethod);
  });

  test('should have valid transport mode', () => {
    expect(['stdio', 'http']).toContain(config.transport.mode);
  });
});

describe('Logger', () => {
  test('should create logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });

  test('should log messages without throwing', () => {
    expect(() => {
      logger.info('Test info message');
      logger.debug('Test debug message');
      logger.warn('Test warning message');
    }).not.toThrow();
  });

  test('should handle error logging', () => {
    expect(() => {
      logger.error('Test error message');
      logger.error('Test error with object', { error: 'test' });
    }).not.toThrow();
  });
});