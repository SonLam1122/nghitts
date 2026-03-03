/**
 * Serve a demo file from R2: demo/{name} (e.g. demo/Ngọc Ngạn.wav).
 * The [[name]] catch-all handles filenames with dots.
 */
export async function onRequestGet(context: {
  env: { piper: R2Bucket };
  params: { name: string[] };
}): Promise<Response> {
  try {
    const { env, params } = context;
    const name = (params.name || []).map(decodeURIComponent).join('/');
    if (!name) {
      return new Response('File name is required', { status: 400 });
    }

    const r2Key = `demo/${name}`;
    const object = await env.piper.get(r2Key);
    if (!object) {
      return new Response('Demo file not found', { status: 404 });
    }

    let contentType = 'application/octet-stream';
    if (name.endsWith('.wav')) contentType = 'audio/wav';
    else if (name.endsWith('.mp3')) contentType = 'audio/mpeg';
    else if (name.endsWith('.txt')) contentType = 'text/plain; charset=utf-8';

    return new Response(object.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': object.size.toString(),
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Error serving demo file:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to serve demo file',
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
