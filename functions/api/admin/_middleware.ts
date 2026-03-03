/**
 * Auth middleware for /api/admin/* routes.
 * Validates X-Admin-Key header against ADMIN_KEY env var.
 * Also handles CORS preflight for admin endpoints.
 */
export async function onRequest(context: {
  request: Request;
  env: { ADMIN_KEY?: string };
  next: () => Promise<Response>;
}): Promise<Response> {
  const { request, env, next } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const adminKey = env.ADMIN_KEY;
  if (!adminKey) {
    return new Response(JSON.stringify({ error: 'ADMIN_KEY not configured on server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const provided = request.headers.get('X-Admin-Key') || '';
  if (provided !== adminKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const response = await next();
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  return newResponse;
}
