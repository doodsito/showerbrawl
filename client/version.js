// Vite embeds the version of the code actually loaded by this tab.
export const CLIENT_VERSION = typeof __CLIENT_VERSION__ === 'string' ? __CLIENT_VERSION__ : 'dev';
export function assetUrl(path) {
  if (!path) return null;
  const url = path.startsWith('/') ? path : '/' + path;
  return CLIENT_VERSION === 'dev' ? url : `${url}${url.includes('?') ? '&' : '?'}v=${CLIENT_VERSION}`;
}

// Defer updates until the lobby so a match is never interrupted by a refresh.
export function createVersionCheck({version = CLIENT_VERSION, canReload, beforeReload = () => {},
  fetchVersion = async () => {
    const res = await fetch(`/build-version.json?t=${Date.now()}`, {cache:'no-store'});
    if (!res.ok) throw new Error('Version unavailable');
    return res.json();
  }, reload = () => location.reload()}) {
  let busy = false, reloading = false;
  return async () => {
    if (version === 'dev' || busy || reloading) return;
    busy = true;
    try {
      const data = await fetchVersion();
      if (/^[a-f0-9]{16}$/.test(data.version) && data.version !== version && canReload()) {
        reloading = true;
        beforeReload();
        reload();
      }
    } catch { /* Offline: keep the current game usable. */ }
    finally { busy = false; }
  };
}
export function watchVersion(options) {
  const check = createVersionCheck(options);
  setInterval(check, 15000);
  addEventListener('online', check);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  check();
  return check;
}
