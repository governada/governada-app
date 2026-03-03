type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  requestId?: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const line = JSON.stringify(entry);

  switch (level) {
    case 'error':
      console.error(line);
      break;
    case 'warn':
      console.warn(line);
      break;
    case 'debug':
      console.debug(line);
      break;
    default:
      console.log(line);
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => emit('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit('error', message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => emit('debug', message, meta),

  withContext(context: string) {
    return {
      info: (message: string, meta?: Record<string, unknown>) =>
        emit('info', message, { context, ...meta }),
      warn: (message: string, meta?: Record<string, unknown>) =>
        emit('warn', message, { context, ...meta }),
      error: (message: string, meta?: Record<string, unknown>) =>
        emit('error', message, { context, ...meta }),
      debug: (message: string, meta?: Record<string, unknown>) =>
        emit('debug', message, { context, ...meta }),
    };
  },
};
