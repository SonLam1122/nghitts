/**
 * GET /api/admin/asr/models/:model/files — list files in an ASR model.
 */

interface Env {
  piper: R2Bucket;
}

export async function onRequestGet(context: {
  env: Env;
  params: { model: string };
}): Promise<Response> {
  try {
    const { env, params } = context;
    const model = decodeURIComponent(params.model);
    if (!model) {
      return new Response(JSON.stringify({ error: 'model name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const prefix = `asr/${model}/`;
    const list = await env.piper.list({ prefix });

    const files = list.objects
      .filter((o) => !o.key.endsWith('.placeholder'))
      .map((o) => ({
        name: o.key.replace(prefix, ''),
        size: o.size,
        uploaded: o.uploaded.toISOString(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return new Response(JSON.stringify({ files }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to list files', message: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
