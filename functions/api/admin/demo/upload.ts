/**
 * POST /api/admin/demo/upload — upload a demo voice sample pair (.wav + .txt).
 * FormData fields: speaker, wav (file), txt (file).
 */

interface Env {
  piper: R2Bucket;
}

export async function onRequestPost(context: { env: Env; request: Request }): Promise<Response> {
  try {
    const { env, request } = context;
    const form = await request.formData();

    const speaker = (form.get('speaker') as string)?.trim();
    const wavFile = form.get('wav') as File | null;
    const txtFile = form.get('txt') as File | null;

    if (!speaker) {
      return new Response(JSON.stringify({ error: 'speaker name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!wavFile && !txtFile) {
      return new Response(JSON.stringify({ error: 'At least one file (wav or txt) is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ops: Promise<unknown>[] = [];

    if (wavFile) {
      ops.push(
        env.piper.put(`demo/${speaker}.wav`, wavFile.stream(), {
          httpMetadata: { contentType: 'audio/wav' },
        })
      );
    }
    if (txtFile) {
      ops.push(
        env.piper.put(`demo/${speaker}.txt`, txtFile.stream(), {
          httpMetadata: { contentType: 'text/plain; charset=utf-8' },
        })
      );
    }

    await Promise.all(ops);

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
