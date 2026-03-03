/**
 * DELETE /api/admin/demo/delete — delete a demo voice sample (.wav + .txt).
 * Body: { speaker }
 */

interface Env {
  piper: R2Bucket;
}

export async function onRequestDelete(context: { env: Env; request: Request }): Promise<Response> {
  try {
    const { env, request } = context;
    const { speaker } = (await request.json()) as { speaker: string };

    if (!speaker) {
      return new Response(JSON.stringify({ error: 'speaker is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await Promise.all([
      env.piper.delete(`demo/${speaker}.wav`),
      env.piper.delete(`demo/${speaker}.txt`),
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
