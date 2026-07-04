/* Portable signing link payload — compresses {contract, client, company} into
   a URL-safe string so a contract can be reviewed/signed on a machine that
   has never seen this app's localStorage (e.g. the client's own computer). */
export async function encodePortablePayload(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  const cs = new CompressionStream('gzip');
  const compressed = await new Response(new Blob([bytes]).stream().pipeThrough(cs)).arrayBuffer();
  const bin = String.fromCharCode(...new Uint8Array(compressed));
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return b64;
}

export async function decodePortablePayload(b64) {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  const ds = new DecompressionStream('gzip');
  const decompressed = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
  const json = new TextDecoder().decode(decompressed);
  return JSON.parse(json);
}
