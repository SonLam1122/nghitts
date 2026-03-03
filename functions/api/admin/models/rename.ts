/**
 * PUT /api/admin/models/rename — rename a TTS model.
 * Body: { lang, oldName, newName }
 * Copies .onnx and .onnx.json to new keys, then deletes old keys.
 */

interface Env {
  piper: R2Bucket;
}

export async function onRequestPut(context: { env: Env; request: Request }): Promise<Response> {
  try {
    const { env, request } = context;
    const { lang, oldName, newName } = (await request.json()) as {
      lang: string;
      oldName: string;
      newName: string;
    };

    if (!lang || !oldName || !newName) {
      return new Response(JSON.stringify({ error: 'lang, oldName, and newName are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const prefix = `piper/${lang}/`;
    const extensions = ['.onnx', '.onnx.json'];

    for (const ext of extensions) {
      const oldKey = `${prefix}${oldName}${ext}`;
      const newKey = `${prefix}${newName}${ext}`;
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
