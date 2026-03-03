/**
 * PUT /api/admin/asr/models/rename — rename an ASR model.
 * Body: { oldName, newName }
 * Copies all files from old prefix to new prefix, then deletes old files.
 */

interface Env {
  piper: R2Bucket;
}

export async function onRequestPut(context: { env: Env; request: Request }): Promise<Response> {
  try {
    const { env, request } = context;
    const { oldName, newName } = (await request.json()) as {
      oldName: string;
      newName: string;
    };

    if (!oldName || !newName) {
      return new Response(JSON.stringify({ error: 'oldName and newName are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const oldPrefix = `asr/${oldName}/`;
    const newPrefix = `asr/${newName}/`;
    const list = await env.piper.list({ prefix: oldPrefix });

    for (const obj of list.objects) {
      const fileName = obj.key.replace(oldPrefix, '');
      const source = await env.piper.get(obj.key);
      if (source) {
        await env.piper.put(`${newPrefix}${fileName}`, source.body, {
          httpMetadata: source.httpMetadata,
          customMetadata: source.customMetadata,
        });
      }
    }

    if (list.objects.length > 0) {
      await env.piper.delete(list.objects.map((o) => o.key));
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Rename failed', message: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
