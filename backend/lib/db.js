const { neon } = require('@neondatabase/serverless');

let cached;

/**
 * Lazily build the Neon client.
 *
 * Deliberately not created at module scope: a missing DATABASE_URL should
 * surface as a handled 500 on the request that needs it, not as a cold-start
 * crash that takes down every endpoint in the deployment.
 */
function getSql() {
  if (!cached) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }
    cached = neon(process.env.DATABASE_URL);
  }
  return cached;
}

module.exports = { getSql };
