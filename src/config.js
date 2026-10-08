require('dotenv').config();

const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);

module.exports = {
  port: Number(env('PORT', 3000)),
  isProd: env('NODE_ENV', 'development') === 'production',
  appName: env('APP_NAME', 'Trivia Education'),
  appUrl: env('APP_URL', 'http://localhost:3000'),
  timezone: env('APP_TIMEZONE', 'Asia/Makassar'),
  currency: env('CURRENCY', 'IDR'),
  sessionSecret: env('SESSION_SECRET', 'change-me-in-production'),
  db: {
    host: env('DB_HOST', 'localhost'),
    port: Number(env('DB_PORT', 3306)),
    user: env('DB_USER', 'root'),
    password: env('DB_PASSWORD', ''),
    database: env('DB_NAME', 'triviaedu'),
  },
  admin: {
    name: env('ADMIN_NAME', 'Administrator'),
    email: env('ADMIN_EMAIL', ''),
    password: env('ADMIN_PASSWORD', ''),
  },
};
