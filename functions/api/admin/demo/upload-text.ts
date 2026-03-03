/**
 * POST /api/admin/demo/upload-text — update only the .txt for a demo speaker.
 * FormData fields: speaker, txt (file).
 */

interface Env {
  piper: R2Bucket;
}

export async function onRequestPost(context: { env: Env; request: Request }): Promise<Response> {
  try {
    const { env, request } = context;
    const form = await request.formData();

    const speaker = (form.get('speaker') as string)?.trim();
    const txtFile = form.get('txt') as File | null;

    if (!speaker || !txtFile) {
      return new Response(JSON.stringify({ error: 'speaker and txt file are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await env.piper.put(`demo/${speaker}.txt`, txtFile.stream(), {
      httpMetadata: { contentType: 'text/plain; charset=utf-8' },
    });

    return new Response(JSON.stringify({ ok: true, speaker }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Upload failed', message: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
