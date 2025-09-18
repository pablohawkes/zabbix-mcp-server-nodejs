/* eslint-disable security/detect-object-injection */
/**
 * Zabbix API Client using zabbix-utils library
 * 
 * This is the unified, professional Zabbix API client that supports both:
 * - API Token authentication (Zabbix 5.4+, recommended)
 * - Username/Password authentication (traditional)
 * 
 * Provides a clean, modern interface using the professional zabbix-utils library
 * with better type safety, automatic authentication, and robust error handling.
 */

const { AsyncZabbixAPI } = require('zabbix-utils');
const config = require('../config');
const { logger } = require('../utils/logger');

class ZabbixClient {
    constructor() {
        this.api = null;
        this.isConnected = false;
        this.lastConnectionAttempt = null;
        this.connectionRetryDelay = 5000; // 5 seconds
    }

    /**
     * Initialize the Zabbix API client with automatic authentication method detection
     */
    async initialize() {
        logger.info(`[ZABBIX CLIENT DEBUG] initialize() called, current state: isConnected=${this.isConnected}, api=${!!this.api}`);
        
        if (this.api && this.isConnected) {
            logger.info('[ZABBIX CLIENT DEBUG] Already initialized and connected, returning existing API');
            return this.api;
        }

        logger.info(`[ZABBIX CLIENT DEBUG] Config check - authMethod: ${config.api.authMethod}`);
        logger.info(`[ZABBIX CLIENT DEBUG] Config check - url: ${config.api.url}`);
        logger.info(`[ZABBIX CLIENT DEBUG] Config check - username: ${config.api.username ? 'SET' : 'UNDEFINED'}`);
        logger.info(`[ZABBIX CLIENT DEBUG] Config check - password: ${config.api.password ? 'SET' : 'UNDEFINED'}`);
        logger.info(`[ZABBIX CLIENT DEBUG] Config check - apiToken: ${config.api.apiToken ? 'SET' : 'UNDEFINED'}`);

        try {
            logger.info(`${config.logging.prefix} Initializing Zabbix API client with ${config.api.authMethod} authentication...`);
            
            // Configure client based on authentication method
            const clientConfig = {
                url: config.api.url,
                validateCerts: !config.api.ignoreSelfSignedCert,
                timeout: Math.floor(config.api.timeout / 1000), // Library expects seconds, will convert to ms internally
                skipVersionCheck: true
            };

            logger.info('[ZABBIX CLIENT DEBUG] Base clientConfig:', JSON.stringify(clientConfig, null, 2));

            if (config.api.authMethod === 'token') {
                // API Token authentication (Zabbix 5.4+)
                clientConfig.token = config.api.apiToken;
                logger.info(`${config.logging.prefix} Using API token authentication`);
                logger.info('[ZABBIX CLIENT DEBUG] Added token to clientConfig');
            } else if (config.api.authMethod === 'password') {
                // Username/Password authentication (traditional)
                // Note: zabbix-utils library expects 'user' and 'password' properties
                clientConfig.user = config.api.username;
                clientConfig.password = config.api.password;
                logger.info(`${config.logging.prefix} Using username/password authentication`);
                logger.debug(`${config.logging.prefix} Debug - config.api.username: ${config.api.username ? 'SET' : 'UNDEFINED'}, config.api.password: ${config.api.password ? 'SET' : 'UNDEFINED'}`);
                logger.debug(`${config.logging.prefix} Debug - clientConfig.user: ${clientConfig.user ? 'SET' : 'UNDEFINED'}, clientConfig.password: ${clientConfig.password ? 'SET' : 'UNDEFINED'}`);
                logger.info('[ZABBIX CLIENT DEBUG] Added username/password to clientConfig');

            } else {
                const errorMsg = 'No valid authentication credentials provided. Set ZABBIX_API_TOKEN or ZABBIX_PASSWORD environment variable.';
                logger.error(`[ZABBIX CLIENT DEBUG] ${errorMsg}`);
                throw new Error(errorMsg);
            }

            logger.info('[ZABBIX CLIENT DEBUG] Final clientConfig:', JSON.stringify({...clientConfig, password: clientConfig.password ? '***' : undefined}, null, 2));
            logger.info('[ZABBIX CLIENT DEBUG] About to create AsyncZabbixAPI instance...');
            
            this.api = new AsyncZabbixAPI(clientConfig);
            logger.info('[ZABBIX CLIENT DEBUG] AsyncZabbixAPI instance created successfully');

            // For username/password auth, login is required
            if (config.api.authMethod === 'password') {
                logger.info('[ZABBIX CLIENT DEBUG] Password auth detected, calling login...');
                await this.api.login(null, config.api.username, config.api.password);
                logger.info('[ZABBIX CLIENT DEBUG] Login completed successfully');
            }
            
            // Get API version to verify connection
            logger.info('[ZABBIX CLIENT DEBUG] About to call apiVersion() to verify connection...');
            const version = await this.api.apiVersion();
            logger.info(`${config.logging.prefix} Connected to Zabbix API version: ${version}`);
            logger.info('[ZABBIX CLIENT DEBUG] Connection verified successfully');
            
            this.isConnected = true;
            this.lastConnectionAttempt = Date.now();
            
            return this.api;
        } catch (error) {
            this.isConnected = false;
            this.lastConnectionAttempt = Date.now();
            logger.error('[ZABBIX CLIENT DEBUG] Initialization failed:', error.message);
            logger.error('[ZABBIX CLIENT DEBUG] Error stack:', error.stack);
            logger.error(`${config.logging.prefix} Failed to initialize Zabbix API client:`, error.message);
            throw new Error(`Zabbix API initialization failed: ${error.message}`);
        }
    }

    /**
     * Get the API client instance, initializing if necessary
     */
    async getClient() {
        if (!this.api || !this.isConnected) {
            await this.initialize();
        }

        // Check if we need to retry connection after a failure
        if (!this.isConnected && this.lastConnectionAttempt) {
            const timeSinceLastAttempt = Date.now() - this.lastConnectionAttempt;
            if (timeSinceLastAttempt > this.connectionRetryDelay) {
                await this.initialize();
            } else {
                throw new Error('Zabbix API client not connected. Retry in progress.');
            }
        }

        return this.api;
    }

    /**
     * Check if the client is authenticated and connected
     */
    async checkConnection() {
        try {
            if (!this.api) {
                return false;
            }
            
            // For API token auth, check by making a simple API call
            if (config.api.authMethod === 'token') {
                await this.api.apiVersion();
                this.isConnected = true;
                return true;
            } else {
                // For username/password auth, use checkAuth
                const isAuth = await this.api.checkAuth();
                this.isConnected = isAuth;
                return isAuth;
            }
        } catch (error) {
            logger.warn(`${config.logging.prefix} Connection check failed:`, error.message);
            this.isConnected = false;
            return false;
        }
    }

    /**
     * Disconnect and cleanup
     */
    async disconnect() {
        if (this.api && this.isConnected) {
            try {
                // Only logout for username/password auth
                if (config.api.authMethod === 'password') {
                    await this.api.logout();
                }
                logger.info(`${config.logging.prefix} Disconnected from Zabbix API`);
            } catch (error) {
                logger.warn(`${config.logging.prefix} Error during logout:`, error.message);
            }
        }
        
        this.api = null;
        this.isConnected = false;
    }

    /**
     * Get API version information
     */
    async getVersion() {
        const client = await this.getClient();
        return await client.apiVersion();
    }

    /**
     * Generic method to make API calls with automatic error handling
     */
    async request(method, params = {}) {
        logger.info(`[ZABBIX CLIENT DEBUG] request() called with method: ${method}, params:`, JSON.stringify(params, null, 2));
        logger.info(`[ZABBIX CLIENT DEBUG] Current connection status: isConnected=${this.isConnected}, api=${!!this.api}`);
        
        const client = await this.getClient();
        logger.info('[ZABBIX CLIENT DEBUG] getClient() returned, client type:', typeof client);
        
        try {
            // Parse method to object.method format for dynamic calling
            const [object, methodName] = method.split('.');
            
            if (!object || !methodName) {
                throw new Error(`Invalid API method format: ${method}. Expected format: 'object.method'`);
            }

            logger.info(`[ZABBIX CLIENT DEBUG] Parsed method: object="${object}", methodName="${methodName}"`);
            logger.info(`[ZABBIX CLIENT DEBUG] About to call client[${object}][${methodName}](params)...`);
            logger.info(`[ZABBIX CLIENT DEBUG] client[${object}] exists:`, !!client[object]);
            logger.info(`[ZABBIX CLIENT DEBUG] client[${object}][${methodName}] exists:`, !!(client[object] && client[object][methodName]));

            // Use dynamic method calling
            const result = await client[object][methodName](params);
            
            logger.info(`[ZABBIX CLIENT DEBUG] API call successful: ${method}, result type:`, typeof result, 'length:', result?.length || 'N/A');
            logger.debug(`${config.logging.prefix} API call successful: ${method}`);
            return result;
        } catch (error) {
            logger.error(`[ZABBIX CLIENT DEBUG] API call failed: ${method}, error:`, error.message);
            logger.error('[ZABBIX CLIENT DEBUG] Error stack:', error.stack);
            logger.error(`${config.logging.prefix} API call failed: ${method}`, error.message);
            
            // Check if it's an authentication error and try to reconnect (only for password auth)
            if (config.api.authMethod === 'password' && error.message && (
                error.message.includes('not authorised') ||
                error.message.includes('Session terminated') ||
                error.message.includes('Not authorized')
            )) {
                logger.info(`${config.logging.prefix} Authentication error detected, attempting to reconnect...`);
                this.isConnected = false;
                await this.initialize();
                
                // Retry the request once
                const retryClient = await this.getClient();
                const result = await retryClient[object][methodName](params);
                return result;
            }
            
            throw error;
        }
    }
}

// Create singleton instance
const zabbixClient = new ZabbixClient();

// Export clean, modern interface only
module.exports = {
    ZabbixClient,
    zabbixClient,
    
    // Modern interface methods
    async getClient() {
        return await zabbixClient.getClient();
    },
    
    async request(method, params) {
        return await zabbixClient.request(method, params);
    },
    
    async checkConnection() {
        return await zabbixClient.checkConnection();
    },
    
    async disconnect() {
        return await zabbixClient.disconnect();
    },
    
    async getVersion() {
        return await zabbixClient.getVersion();
    }
}; 
