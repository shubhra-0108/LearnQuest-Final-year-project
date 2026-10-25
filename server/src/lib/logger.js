import winston from 'winston';
import { isDev } from '../config.js';

export const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    isDev
      ? winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, stack }) => {
            return `[${timestamp}] ${level}: ${stack || message}`;
          })
        )
      : winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});
