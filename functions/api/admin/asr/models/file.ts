/**
 * DELETE /api/admin/asr/models/file — delete a single file from an ASR model.
 * Body: { model, fileName }
 */

interface Env {
  piper: R2Bucket;
}

export async function onRequestDelete(context: { env: Env; request: Request }): Promise<Response> {
  try {
    const { env, request } = context;
    const { model, fileName } = (await request.json()) as {
      model: string;
      fileName: string;
    };

    if (!model || !fileName) {
      return new Response(JSON.stringify({ error: 'model and fileName are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await env.piper.delete(`asr/${model}/${fileName}`);

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
