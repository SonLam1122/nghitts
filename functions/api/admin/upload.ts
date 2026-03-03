/**
 * POST /api/admin/upload — upload a TTS model (.onnx + .onnx.json).
 * FormData fields: lang, name, model (file), config (file).
 */

interface Env {
  piper: R2Bucket;
}

export async function onRequestPost(context: { env: Env; request: Request }): Promise<Response> {
  try {
    const { env, request } = context;
    const form = await request.formData();

    const lang = (form.get('lang') as string)?.trim();
    const name = (form.get('name') as string)?.trim();
    const modelFile = form.get('model') as File | null;
    const configFile = form.get('config') as File | null;

    if (!lang || !name) {
      return new Response(JSON.stringify({ error: 'lang and name are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!modelFile || !configFile) {
      return new Response(JSON.stringify({ error: 'model and config files are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const prefix = `piper/${lang}/`;
    await Promise.all([
      env.piper.put(`${prefix}${name}.onnx`, modelFile.stream(), {
        httpMetadata: { contentType: 'application/octet-stream' },
      }),
      env.piper.put(`${prefix}${name}.onnx.json`, configFile.stream(), {
        httpMetadata: { contentType: 'application/json' },
      }),
    ]);

    return new Response(JSON.stringify({ ok: true, lang, name }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Upload failed', message: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
