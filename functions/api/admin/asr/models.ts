/**
 * Admin ASR model management:
 *   GET    /api/admin/asr/models          — list ASR models with file counts and sizes
 *   POST   /api/admin/asr/models          — create a new (empty) ASR model folder
 *   DELETE /api/admin/asr/models          — delete an ASR model and all its files
 */

interface Env {
  piper: R2Bucket;
}

export async function onRequestGet(context: { env: Env }): Promise<Response> {
  try {
    const list = await context.env.piper.list({ prefix: 'asr/', delimiter: '/' });

    const models: Array<{ name: string; fileCount: number; totalSize: number }> = [];

    for (const prefix of list.commonPrefixes || []) {
      const name = prefix.replace(/^asr\//, '').replace(/\/$/, '');
      if (!name) continue;

      const files = await context.env.piper.list({ prefix: `asr/${name}/` });
      const fileCount = files.objects.length;
      const totalSize = files.objects.reduce((sum, o) => sum + o.size, 0);
      models.push({ name, fileCount, totalSize });
    }

    models.sort((a, b) => a.name.localeCompare(b.name));
    return new Response(JSON.stringify({ models }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to list ASR models', message: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function onRequestPost(context: { env: Env; request: Request }): Promise<Response> {
  try {
    const { name } = (await context.request.json()) as { name: string };
    if (!name?.trim()) {
      return new Response(JSON.stringify({ error: 'name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // R2 doesn't have real folders; create a placeholder to make the prefix visible
    await context.env.piper.put(`asr/${name.trim()}/.placeholder`, new Uint8Array(0));

    return new Response(JSON.stringify({ ok: true, name: name.trim() }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Create failed', message: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function onRequestDelete(context: { env: Env; request: Request }): Promise<Response> {
  try {
    const { name } = (await context.request.json()) as { name: string };
    if (!name) {
      return new Response(JSON.stringify({ error: 'name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const prefix = `asr/${name}/`;
    const list = await context.env.piper.list({ prefix });

    if (list.objects.length > 0) {
      await context.env.piper.delete(list.objects.map((o) => o.key));
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Delete failed', message: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
