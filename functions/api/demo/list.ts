/**
 * List demo voice samples from R2 under prefix "demo/".
 * Returns speakers derived from .wav filenames (without extension).
 * Each speaker has a .wav and .txt file.
 */
export async function onRequestGet(context: {
  env: { piper: R2Bucket };
}): Promise<Response> {
  try {
    const { env } = context;
    const list = await env.piper.list({ prefix: 'demo/' });

    const wavFiles = list.objects
      .filter((obj) => obj.key.endsWith('.wav'))
      .map((obj) => {
        const speaker = decodeURIComponent(
          obj.key.replace(/^demo\//, '').replace(/\.wav$/, '')
        );
        return { speaker, size: obj.size, uploaded: obj.uploaded.toISOString() };
      })
      .sort((a, b) => a.speaker.localeCompare(b.speaker, 'vi'));

    return new Response(JSON.stringify({ demos: wavFiles }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error listing demos:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to list demos',
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
