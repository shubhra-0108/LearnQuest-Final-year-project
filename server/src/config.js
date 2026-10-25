// Central configuration. All env vars are read once here.
// The server refuses to start if required values are missing.

function required(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Required env var ${name} is not set`);
  return val;
}

function optional(name, fallback) {
  return process.env[name] || fallback;
}

export const config = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '5000'), 10),
  mongoUri: optional('MONGO_URI', 'mongodb://127.0.0.1:27017/learnquest'),
  jwtSecret: optional('JWT_SECRET', 'dev_jwt_secret_change_in_prod_min32chars'),
  cookieSecret: optional('COOKIE_SECRET', 'dev_cookie_secret'),
  cryptoKey: optional('CRYPTO_KEY', 'dev_crypto_key_exactly_32bytes_long!'),
  mlUrl: optional('ML_URL', 'http://localhost:8001'),
  mlApiKey: optional('ML_API_KEY', 'dev_ml_key'),
  adminEmail: optional('ADMIN_EMAIL', 'admin@learnquest.org'),
  adminPassword: optional('ADMIN_PASSWORD', 'Admin@LearnQuest2024!'),
  clientOrigin: optional('CLIENT_ORIGIN', 'http://localhost:5173'),
  openaiApiKey: optional('OPENAI_API_KEY', ''),
  openaiModel: optional('OPENAI_MODEL', 'gpt-4o-mini'),
};

export const isProd = config.nodeEnv === 'production';
export const isDev = config.nodeEnv === 'development';
