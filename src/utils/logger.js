/**
 * Zabbix MCP Server - Logger Utility
 * 
 * Copyright (c) 2024 Han Yong Lim
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// Log levels in order of severity
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    http: 4
};

class Logger {
    constructor() {
        // Get log level from environment, default to 'info'
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.currentLogLevel = LOG_LEVELS[this.logLevel.toLowerCase()] ?? LOG_LEVELS.info;
        
        // Bind all methods to ensure they work correctly when passed as references
        this.error = this.error.bind(this);
        this.warn = this.warn.bind(this);
        this.info = this.info.bind(this);
        this.debug = this.debug.bind(this);
        this.http = this.http.bind(this);
    }

    _shouldLog(level) {
        return LOG_LEVELS[level] <= this.currentLogLevel;
    }

    _formatMessage(level, ...args) {
        const timestamp = new Date().toISOString();
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        return `${timestamp} [${level.toUpperCase()}] ${message}`;
    }

    error(...args) {
        if (this._shouldLog('error')) {
            process.stderr.write(this._formatMessage('error', ...args) + '\n');
        }
    }

    warn(...args) {
        if (this._shouldLog('warn')) {
            process.stderr.write(this._formatMessage('warn', ...args) + '\n');
        }
    }

    info(...args) {
        if (this._shouldLog('info')) {
            process.stderr.write(this._formatMessage('info', ...args) + '\n');
        }
    }

    debug(...args) {
        if (this._shouldLog('debug')) {
            process.stderr.write(this._formatMessage('debug', ...args) + '\n');
        }
    }

    http(...args) {
        if (this._shouldLog('http')) {
            process.stderr.write(this._formatMessage('http', ...args) + '\n');
        }
    }

    // Allow changing log level at runtime
    setLogLevel(level) {
        if (level in LOG_LEVELS) {
            this.logLevel = level;
            this.currentLogLevel = LOG_LEVELS[level];
            this.info(`Log level changed to: ${level}`);
        } else {
            this.warn(`Invalid log level: ${level}. Valid levels: ${Object.keys(LOG_LEVELS).join(', ')}`);
        }
    }

    // Get current log level
    getLogLevel() {
        return this.logLevel;
    }
}

// Create a single instance of the logger
const logger = new Logger();

// Request logging middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    });
    next();
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
    logger.error('Unhandled Error:', err.message);
    if (err.stack) {
        logger.error('Stack:', err.stack);
    }
    next(err);
};

// Helper methods
const logApiCall = (method, endpoint, _params, _response) => {
    logger.debug(`API Call - ${method} ${endpoint}`);
};

const logToolExecution = (toolName, _args, _result) => {
    logger.info(`Tool Execution: ${toolName}`);
};

const logPerformance = (operation, duration) => {
    logger.debug(`Performance: ${operation} - ${duration}ms`);
};

// Export the logger instance and helper functions
module.exports = {
    logger,
    requestLogger,
    errorLogger,
    logApiCall,
    logToolExecution,
    logPerformance,
    LOG_LEVELS
};