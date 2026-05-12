const { Pool } = require('pg');

let pool;

const getPool = () => {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL is not defined in .env. Database features will be disabled.');
      return null;
    }
    
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
      });
      console.log('Postgres Pool initialized.');
    } catch (err) {
      console.error('Failed to initialize Postgres Pool:', err);
    }
  }
  return pool;
};

module.exports = { getPool };
