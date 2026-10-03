/**
 * OIDC login for the bridge: authorization code flow with PKCE in the system browser, redirect to
 * Zotero's local server (/semanticzotero/callback). The refresh token is kept in the prefs
 * (oidc.refreshToken, together with the issuer and client it belongs to); access tokens only in memory.
 */
import { clearPref, getPref, setPref } from '../prefs';
import { logger } from '../util/log';
import { codeChallenge, jwtClaims, randomString } from './pkce';

const log = logger('oidc');

export const CALLBACK_PATH = '/semanticzotero/callback';
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export class NotLoggedIn extends Error {
  override name = 'NotLoggedIn';
}

export interface OidcSettings {
  issuer: string;
  clientId: string;
}

export interface OidcEnv {
  fetch: (url: string, init?: any) => Promise<any>;
  crypto: Crypto;
  /** Opens the URL in the system browser. */
  launch: (url: string) => void;
  redirectUri: () => string;
  form: (fields: Record<string, string>) => URLSearchParams;
  now?: () => number;
}

interface Pending {
  verifier: string;
  settings: OidcSettings;
  resolve: (code: string) => void;
  reject: (e: Error) => void;
}

interface Discovery {
  authorization_endpoint: string;
  token_endpoint: string;
}

export class OidcSession {
  private access: { token: string; expires: number; key: string } | null = null;
  private pending = new Map<string, Pending>();
  private discovery = new Map<string, Discovery>();
  private refreshing: Promise<string> | null = null;

  constructor(private env: OidcEnv) {}

  private now(): number {
    return (this.env.now ?? Date.now)();
  }

  private key(s: OidcSettings): string {
    return `${s.issuer} ${s.clientId}`;
  }

  /** Logged-in user for these settings, or null. */
  user(s: OidcSettings): string | null {
    return getPref('oidc.refreshToken') && getPref('oidc.for') === this.key(s) ? String(getPref('oidc.user') || '?') : null;
  }

  private async discover(issuer: string): Promise<Discovery> {
    const hit = this.discovery.get(issuer);
    if (hit) return hit;
    const resp = await this.env.fetch(`${issuer}/.well-known/openid-configuration`);
    if (!resp.ok) throw new Error(`OIDC discovery failed: HTTP ${resp.status}`);
    const d = await resp.json();
    if (!d.authorization_endpoint || !d.token_endpoint) throw new Error('OIDC discovery: endpoints missing');
    this.discovery.set(issuer, d);
    return d;
  }

  /** Opens the login in the browser and resolves once the tokens are there. Returns the user name. */
  async login(s: OidcSettings): Promise<string> {
    if (!s.issuer || !s.clientId) throw new Error('OIDC issuer and client ID are required');
    const d = await this.discover(s.issuer);
    const verifier = randomString(this.env.crypto, 48);
    const state = randomString(this.env.crypto, 24);
    const params = this.env.form({
      response_type: 'code',
      client_id: s.clientId,
      redirect_uri: this.env.redirectUri(),
      scope: 'openid profile',
      state,
      code_challenge: await codeChallenge(this.env.crypto, verifier),
      code_challenge_method: 'S256',
    });
    for (const p of this.pending.values()) p.reject(new Error('superseded by a new login'));
    this.pending.clear();
    const code = await new Promise<string>((resolve, reject) => {
      this.pending.set(state, { verifier, settings: s, resolve, reject });
      void Zotero.Promise.delay(LOGIN_TIMEOUT_MS).then(() => {
        if (this.pending.delete(state)) reject(new Error('login timed out'));
      });
      this.env.launch(`${d.authorization_endpoint}?${params}`);
    });
    const tokens = await this.tokenRequest(d, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.env.redirectUri(),
      client_id: s.clientId,
      code_verifier: verifier,
    });
    const claims = jwtClaims(tokens.access_token);
    const user = String(claims.preferred_username || claims.email || claims.name || claims.sub || '?');
    this.store(s, tokens, user);
    log.info(`logged in at ${s.issuer}`);
    return user;
  }

  /** Called by the local server endpoint. Returns [status, html message]. */
  handleCallback(params: URLSearchParams): [number, string] {
    const p = this.pending.get(params.get('state') || '');
    if (!p) return [400, 'Unknown or expired login. Start the login again in Zotero.'];
    this.pending.delete(params.get('state')!);
    const code = params.get('code');
    if (!code) {
      const err = params.get('error_description') || params.get('error') || 'no code';
      p.reject(new Error(`login failed: ${err}`));
      return [400, `Login failed: ${err}`];
    }
    p.resolve(code);
    return [200, 'Logged in. You can close this tab and return to Zotero.'];
  }

  /** A valid access token, refreshed when needed; NotLoggedIn if there is none. */
  async accessToken(s: OidcSettings): Promise<string> {
    const key = this.key(s);
    if (this.access && this.access.key === key && this.access.expires > this.now() + 30_000) return this.access.token;
    const refresh = getPref('oidc.refreshToken');
    if (!refresh || getPref('oidc.for') !== key) throw new NotLoggedIn('not logged in');
    this.refreshing ??= (async () => {
      try {
        const d = await this.discover(s.issuer);
        const tokens = await this.tokenRequest(d, { grant_type: 'refresh_token', refresh_token: refresh, client_id: s.clientId });
        this.store(s, tokens, String(getPref('oidc.user') || ''));
        return tokens.access_token as string;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  /** Forget the access token (e.g. after 401) so the next request refreshes. */
  invalidate(): void {
    this.access = null;
  }

  logout(): void {
    this.access = null;
    for (const k of ['oidc.refreshToken', 'oidc.for', 'oidc.user']) clearPref(k);
  }

  private store(s: OidcSettings, tokens: any, user: string): void {
    this.access = { token: tokens.access_token, expires: this.now() + Number(tokens.expires_in || 60) * 1000, key: this.key(s) };
    if (tokens.refresh_token) setPref('oidc.refreshToken', tokens.refresh_token);
    setPref('oidc.for', this.key(s));
    setPref('oidc.user', user);
  }

  private async tokenRequest(d: Discovery, fields: Record<string, string>): Promise<any> {
    const resp = await this.env.fetch(d.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: this.env.form(fields).toString(),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok || !body.access_token) {
      if (fields.grant_type === 'refresh_token') {
        this.logout();
        throw new NotLoggedIn(`session expired (${body.error || resp.status})`);
      }
      throw new Error(`token request failed: ${body.error_description || body.error || `HTTP ${resp.status}`}`);
    }
    return body;
  }
}
