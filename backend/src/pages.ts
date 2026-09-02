import { randomBytes } from 'node:crypto';

import type { Response } from 'express';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return replacements[character] ?? character;
  });
}

function document(title: string, body: string, script = ''): { html: string; nonce: string } {
  const nonce = randomBytes(18).toString('base64url');
  return {
    nonce,
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; color: CanvasText; }
    main { width: min(28rem, calc(100% - 2rem)); }
    h1 { font-size: 1.5rem; margin: 0 0 .75rem; }
    p { line-height: 1.5; }
    button { min-height: 2.75rem; padding: 0 1rem; font: inherit; cursor: pointer; }
    .muted { opacity: .72; }
    .actions { display: flex; gap: .75rem; flex-wrap: wrap; margin-top: 1.25rem; }
    code { overflow-wrap: anywhere; }
  </style>
</head>
<body><main>${body}</main><script nonce="${nonce}">${script}</script></body>
</html>`,
  };
}

export function sendPage(response: Response, page: ReturnType<typeof document>, status = 200): void {
  response
    .status(status)
    .set({
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${page.nonce}'; connect-src 'self'; base-uri 'none'; form-action 'self'`,
      'referrer-policy': 'no-referrer',
    })
    .send(page.html);
}

const socialSignInScript = `
async function googleSignIn() {
  const body = { provider: 'google', callbackURL: location.href };
  const params = new URLSearchParams(location.search);
  if (params.has('sig')) body.oauth_query = params.toString();
  const response = await fetch('/api/auth/sign-in/social', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    credentials: 'same-origin', body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Login failed');
  location.assign(result.url);
}
document.querySelector('[data-google]')?.addEventListener('click', () => googleSignIn().catch(showError));
function showError(error) { document.querySelector('[data-error]').textContent = error.message; }
`;

export function loginPage(): ReturnType<typeof document> {
  return document(
    'Sign in to NoteX MCP',
    `<h1>Sign in to NoteX MCP</h1>
     <p>Use the same Google account that is registered in NoteX Desktop.</p>
     <p class="muted" data-error></p>
     <div class="actions"><button type="button" data-google>Continue with Google</button></div>`,
    `${socialSignInScript}
async function continueAuthorization() {
  const session = await fetch('/api/auth/get-session', { credentials: 'same-origin' });
  if (!session.ok || !(await session.json())) return;
  const response = await fetch('/api/auth/oauth2/continue', {
    method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
    body: JSON.stringify({ selected: true, oauth_query: new URLSearchParams(location.search).toString() })
  });
  const result = await response.json();
  if (response.ok && result.redirect_uri) location.replace(result.redirect_uri);
}
continueAuthorization().catch(() => {});`,
  );
}

export function consentPage(scopes: string): ReturnType<typeof document> {
  return document(
    'Authorize NoteX MCP',
    `<h1>Authorize AI access</h1>
     <p>This client is requesting access to your local NoteX while the desktop application is online.</p>
     <p class="muted"><code>${escapeHtml(scopes || 'notex:read')}</code></p>
     <p class="muted" data-error></p>
     <div class="actions"><button type="button" data-accept>Allow</button><button type="button" data-deny>Deny</button></div>`,
    `async function decide(accept) {
      const response = await fetch('/api/auth/oauth2/consent', {
        method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ accept, oauth_query: new URLSearchParams(location.search).toString() })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Authorization failed');
      location.replace(result.redirect_uri);
    }
    function showError(error) { document.querySelector('[data-error]').textContent = error.message; }
    document.querySelector('[data-accept]').addEventListener('click', () => decide(true).catch(showError));
    document.querySelector('[data-deny]').addEventListener('click', () => decide(false).catch(showError));`,
  );
}

export function devicePage(userCode: string, authenticated: boolean): ReturnType<typeof document> {
  const safeCode = escapeHtml(userCode);
  const body = authenticated
    ? `<h1>Connect NoteX Desktop</h1><p>Confirm code <strong>${safeCode}</strong>.</p>
       <p class="muted" data-error></p><div class="actions"><button type="button" data-approve>Approve</button><button type="button" data-deny>Deny</button></div>`
    : `<h1>Connect NoteX Desktop</h1><p>Sign in with Google to confirm code <strong>${safeCode}</strong>.</p>
       <p class="muted" data-error></p><div class="actions"><button type="button" data-google>Continue with Google</button></div>`;
  const actionScript = authenticated
    ? `async function decide(action) {
        const response = await fetch('/api/auth/device/' + action, {
          method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
          body: JSON.stringify({ userCode: ${JSON.stringify(userCode)} })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Request failed');
        document.querySelector('main').innerHTML = '<h1>Done</h1><p>You can return to NoteX.</p>';
      }
      function showError(error) { document.querySelector('[data-error]').textContent = error.message; }
      document.querySelector('[data-approve]').addEventListener('click', () => decide('approve').catch(showError));
      document.querySelector('[data-deny]').addEventListener('click', () => decide('deny').catch(showError));`
    : socialSignInScript;
  return document('Connect NoteX Desktop', body, actionScript);
}

export function errorPage(message: string): ReturnType<typeof document> {
  return document(
    'NoteX MCP sign-in error',
    `<h1>Sign-in failed</h1><p>${escapeHtml(message)}</p><p class="muted">Open NoteX Desktop and register this Google account first.</p>`,
  );
}

export function completePage(): ReturnType<typeof document> {
  return document('NoteX MCP', '<h1>Done</h1><p>You can return to NoteX.</p>');
}
