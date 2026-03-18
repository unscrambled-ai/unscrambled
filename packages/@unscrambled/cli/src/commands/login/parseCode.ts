export default function parseCode(url: string | undefined) {
  if (!url) {
    return undefined;
  }

  const match = url.match(/^\/\?code=([a-zA-Z0-9\-]{32,36})$/);

  if (!match) {
    return undefined;
  }

  return match[1];
}
