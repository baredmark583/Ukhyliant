
const LOG_PREFIX = '[Ukhyliant FE]';

/**
 * A simple console logger with levels and structured output.
 * @param level - The log level ('info', 'warn', 'error', 'action').
 * @param message - The main log message. For 'action', this will be the action type.
 * @param data - Optional data payload to log with the message.
 */
const log = (level: 'info' | 'warn' | 'error' | 'action', message: string, data?: any) => {
    // In a production environment, you might want to disable some log levels
    // if (process.env.NODE_ENV === 'production' && level !== 'error') return;

    const formattedMessage = `${LOG_PREFIX} [${level.toUpperCase()}] ${message}`;
    
    // Use console.group for better readability of complex objects
    // The 'action' level is just a styled info log.
    const logFn = console[level === 'action' ? 'info' : level] || console.log;

    if (data !== undefined) {
        // Create a clean object to log, avoiding potential Proxy or complex object issues
        const cleanData = JSON.parse(JSON.stringify(data, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value // Convert BigInts to strings for logging
        ));
        logFn(formattedMessage, cleanData);
    } else {
        logFn(formattedMessage);
    }
};

export const logger = {
    info: (message: string, data?: any) => log('info', message, data),
    warn: (message: string, data?: any) => log('warn', message, data),
    error: (message: string, data?: any) => log('error', message, data),
    /**
     * Specifically for logging user or system actions.
     * @param action - The name of the action, e.g., 'TAP', 'BUY_UPGRADE'.
     * @param data - Optional data associated with the action.
     */
    action: (action: string, data?: any) => log('action', `[ACTION:${action}]`, data),
};
