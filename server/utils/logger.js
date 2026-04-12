const { createLogger, format, transports } = require('winston')
const path = require('path')
const fs = require('fs')

const logDir = path.join(__dirname, '../logs')
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'HH:mm:ss' }),
    format.printf(({ level, message, timestamp, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
      return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`
    })
  ),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
    new transports.File({
      filename: path.join(logDir, 'app.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
      tailable: true,
    }),
  ],
})

module.exports = logger
