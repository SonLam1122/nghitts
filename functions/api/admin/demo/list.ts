/**
 * GET /api/admin/demo/list — list demo voice samples from R2.
 */

interface Env {
  piper: R2Bucket;
}

export async function onRequestGet(context: { env: Env }): Promise<Response> {
  try {
    const list = await context.env.piper.list({ prefix: 'demo/' });

    const demos = list.objects
      .filter((obj) => obj.key.endsWith('.wav'))
      .map((obj) => ({
        speaker: decodeURIComponent(obj.key.replace(/^demo\//, '').replace(/\.wav$/, '')),
        size: obj.size,
        uploaded: obj.uploaded.toISOString(),
      }))
      .sort((a, b) => a.speaker.localeCompare(b.speaker, 'vi'));

    return new Response(JSON.stringify({ demos }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to list demos', message: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
