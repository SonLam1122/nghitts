/**
 * POST /api/admin/asr/upload — upload files to an ASR model.
 * FormData fields: model (name), files (multiple File entries).
 */

interface Env {
  piper: R2Bucket;
}

export async function onRequestPost(context: { env: Env; request: Request }): Promise<Response> {
  try {
    const { env, request } = context;
    const form = await request.formData();

    const model = (form.get('model') as string)?.trim();
    if (!model) {
      return new Response(JSON.stringify({ error: 'model name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const files = form.getAll('files') as File[];
    if (!files.length) {
      return new Response(JSON.stringify({ error: 'No files provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Remove placeholder if it exists (model is now real)
    await env.piper.delete(`asr/${model}/.placeholder`).catch(() => {});

    const uploads = files.map((file) => {
      let contentType = 'application/octet-stream';
      if (file.name.endsWith('.json')) contentType = 'application/json';
      else if (file.name.endsWith('.js')) contentType = 'application/javascript';
      else if (file.name.endsWith('.wasm')) contentType = 'application/wasm';

      return env.piper.put(`asr/${model}/${file.name}`, file.stream(), {
        httpMetadata: { contentType },
      });
    });

    await Promise.all(uploads);

    return new Response(
      JSON.stringify({ ok: true, model, uploaded: files.map((f) => f.name) }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Upload failed', message: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
