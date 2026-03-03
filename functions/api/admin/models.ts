/**
 * Admin TTS model management:
 *   GET    /api/admin/models?lang=xx  — list TTS models (all or by language)
 *   DELETE /api/admin/models          — delete a TTS model (body: { lang, name })
 */

interface Env {
  piper: R2Bucket;
}

export async function onRequestGet(context: { env: Env; request: Request }): Promise<Response> {
  const { env, request } = context;
  const url = new URL(request.url);
  const lang = url.searchParams.get('lang');
  const languages = lang ? [lang] : ['vi', 'en', 'id'];

  try {
    const allModels: Array<{
      lang: string;
      name: string;
      sizeOnnx: number;
      sizeJson: number;
      uploaded: string | null;
    }> = [];

    for (const l of languages) {
      const prefix = `piper/${l}/`;
      const list = await env.piper.list({ prefix });

      const jsonFiles = list.objects.filter((o) => o.key.endsWith('.onnx.json'));
      for (const jsonObj of jsonFiles) {
        const name = jsonObj.key.replace(prefix, '').replace('.onnx.json', '');
        if (!name) continue;
        const onnxKey = `${prefix}${name}.onnx`;
        const onnxObj = list.objects.find((o) => o.key === onnxKey);
        allModels.push({
          lang: l,
          name,
          sizeOnnx: onnxObj?.size ?? 0,
          sizeJson: jsonObj.size,
          uploaded: jsonObj.uploaded?.toISOString() ?? null,
        });
      }
    }

    allModels.sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
    return new Response(JSON.stringify({ models: allModels }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to list models', message: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function onRequestDelete(context: { env: Env; request: Request }): Promise<Response> {
  try {
    const { env, request } = context;
    const { lang, name } = (await request.json()) as { lang: string; name: string };
    if (!lang || !name) {
      return new Response(JSON.stringify({ error: 'lang and name are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const prefix = `piper/${lang}/`;
    await Promise.all([
      env.piper.delete(`${prefix}${name}.onnx`),
      env.piper.delete(`${prefix}${name}.onnx.json`),
    ]);

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
