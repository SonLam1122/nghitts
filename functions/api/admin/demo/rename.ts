/**
 * PUT /api/admin/demo/rename — rename a demo voice sample.
 * Body: { oldName, newName }
 * Copies .wav and .txt to new keys, then deletes old keys.
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

    const extensions = ['.wav', '.txt'];

    for (const ext of extensions) {
      const oldKey = `demo/${oldName}${ext}`;
      const newKey = `demo/${newName}${ext}`;
      const obj = await env.piper.get(oldKey);
      if (obj) {
        await env.piper.put(newKey, obj.body, {
          httpMetadata: obj.httpMetadata,
          customMetadata: obj.customMetadata,
        });
        await env.piper.delete(oldKey);
      }
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
