/**
 * Login state machine and token custody.
 *
 * Two facts drive the shape of this module:
 *   - refresh tokens rotate, so two concurrent refreshes would invalidate each
 *     other; every write therefore goes through one in-process mutex plus the
 *     credential service's serialized read-modify-write.
 *   - a loginTicket is single use, so the poll that observes `authorized` must
 *     redeem it immediately and cannot be raced by a second poll.
 */

import {
  SCOPES,
  REDIRECT_URI,
  createLoginSession,
  createPkce,
  claimLoginSession,
  exchangeCode,
  randomUrlSafe,
  redeemLoginTicket,
  refreshAccessToken,
  registerClient,
  revokeToken,
  buildAuthorizeUrl,
  mcpUrlFor,
  resolveIssuer,
  nowSeconds,
  REFRESH_SKEW_SECONDS,
} from './coros-api.js'

const LOGIN_TTL_MS = 10 * 60 * 1000

export const STATUS = {
  unauthenticated: 'unauthenticated',
  pending: 'pending',
  authenticated: 'authenticated',
  expired: 'expired',
  error: 'error',
}

export class CorosAuth {
  constructor({ credentials, credentialKey, log = () => {} }) {
    this.credentials = credentials
    this.credentialKey = credentialKey
    this.log = log
    /** @type {Map<string, any>} loginId -> pending login attempt */
    this.logins = new Map()
    this.refreshPromise = null
    this.cached = null
  }

  /* ----------------------------------------------------------- credentials */

  async readToken() {
    if (!this.credentials) return this.cached ?? undefined
    const record = await this.credentials.readRecord(this.credentialKey)
    if (!record || record.kind !== 'grant') return undefined
    return record.payload ?? undefined
  }

  async writeToken(token) {
    this.cached = token
    if (!this.credentials) return
    await this.credentials.modifyRecord(this.credentialKey, async () => ({ kind: 'grant', payload: token }))
  }

  async clearToken() {
    this.cached = null
    if (!this.credentials) return
    await this.credentials.deleteRecord(this.credentialKey)
  }

  /* ---------------------------------------------------------------- status */

  /** Resolve the current session without touching the network when possible. */
  async status() {
    const token = (await this.readToken()) ?? this.cached
    if (!token?.access_token) return { state: STATUS.unauthenticated }
    const expiresAt = Number(token.expires_at_epoch ?? 0)
    const now = nowSeconds()
    if (expiresAt - REFRESH_SKEW_SECONDS > now) {
      return { state: STATUS.authenticated, expiresAt, scope: token.scope, clientId: token.client_id }
    }
    if (!token.refresh_token) return { state: STATUS.expired, expiresAt }
    try {
      const renewed = await this.refresh()
      return { state: STATUS.authenticated, expiresAt: renewed.expires_at_epoch, scope: renewed.scope, clientId: renewed.client_id, refreshed: true }
    } catch (err) {
      this.log(`[coros] refresh failed: ${err?.message ?? err}`)
      return { state: STATUS.expired, expiresAt, error: String(err?.message ?? err) }
    }
  }

  /** Single-flight refresh: concurrent callers await one network round trip. */
  async refresh() {
    if (this.refreshPromise) return this.refreshPromise
    this.refreshPromise = this.#refreshOnce().finally(() => {
      this.refreshPromise = null
    })
    return this.refreshPromise
  }

  async #refreshOnce() {
    // Re-read inside the flight: another process may have rotated already.
    const token = (await this.readToken()) ?? this.cached
    if (!token?.refresh_token) throw new Error('no refresh token stored')
    if (Number(token.expires_at_epoch ?? 0) - REFRESH_SKEW_SECONDS > nowSeconds()) return token
    const issuer = resolveIssuer(token.region, token.issuer)
    const renewed = await refreshAccessToken(issuer, {
      clientId: token.client_id,
      refreshToken: token.refresh_token,
    })
    const merged = { ...renewed, region: token.region, issuer: token.issuer }
    await this.writeToken(merged)
    return merged
  }

  /** A usable access token, refreshing first when it is close to expiry. */
  async accessToken() {
    const token = (await this.readToken()) ?? this.cached
    if (!token?.access_token) throw Object.assign(new Error('not authenticated'), { code: 'unauthenticated' })
    if (Number(token.expires_at_epoch ?? 0) - REFRESH_SKEW_SECONDS > nowSeconds()) return token
    return this.refresh()
  }

  /* ----------------------------------------------------------------- login */

  /**
   * Start a login attempt.
   *
   * Returns the COROS consent URL to embed. Nothing here signs anyone in: the
   * consent page refuses server-side fetches, so the user must see it.
   */
  async startLogin({ region = 'cn', issuer: issuerOverride } = {}) {
    this.#sweepLogins()
    const issuer = resolveIssuer(region, issuerOverride)
    const mcpUrl = mcpUrlFor(issuer)
    const registration = await registerClient(issuer)
    const clientId = String(registration.client_id)
    const { verifier, challenge } = createPkce()
    const state = randomUrlSafe(24)
    const authorizeUrl = buildAuthorizeUrl({
      issuer,
      mcpUrl,
      clientId,
      redirectUri: REDIRECT_URI,
      scopes: SCOPES,
      challenge,
      state,
    })
    const session = await createLoginSession(issuer, clientId)
    const loginId = randomUrlSafe(16)
    const attempt = {
      loginId,
      issuer,
      region,
      clientId,
      verifier,
      state,
      authorizeUrl,
      sessionId: session.sessionId,
      pollToken: session.pollToken,
      loginUrl: session.loginUrl,
      intervalMs: session.intervalMs,
      expiresAt: Date.now() + LOGIN_TTL_MS,
      polling: false,
      settled: false,
    }
    this.logins.set(loginId, attempt)
    this.log(`[coros] login ${loginId} started against ${issuer}`)
    return {
      loginId,
      loginUrl: attempt.loginUrl,
      issuer,
      intervalMs: attempt.intervalMs,
      expiresAt: attempt.expiresAt,
    }
  }

  /**
   * Poll one attempt once, and redeem the ticket the moment it appears.
   *
   * The redeem happens inline because the ticket is single use: leaving it for
   * a later request lets a duplicate poll burn it and the user sees a failure
   * after a successful consent.
   */
  async pollLogin(loginId) {
    const attempt = this.logins.get(loginId)
    if (!attempt) return { state: 'unknown' }
    if (attempt.settled) return { state: attempt.result?.state ?? STATUS.error, message: attempt.result?.error }
    if (Date.now() > attempt.expiresAt) {
      this.logins.delete(loginId)
      return { state: STATUS.expired, message: 'login session expired' }
    }
    if (attempt.polling) return { state: STATUS.pending, message: 'poll in flight' }
    attempt.polling = true
    try {
      const claim = await claimLoginSession(attempt.issuer, attempt.sessionId, attempt.pollToken)
      if (claim.status === 'authorized') {
        const ticket = claim.payload?.loginTicket
        if (!ticket) throw new Error('authorized without a login ticket')
        const code = await redeemLoginTicket(
          { issuer: attempt.issuer, redirectUri: REDIRECT_URI, state: attempt.state, authorizeUrl: attempt.authorizeUrl },
          String(ticket),
        )
        const token = await exchangeCode(attempt.issuer, {
          clientId: attempt.clientId,
          redirectUri: REDIRECT_URI,
          code,
          verifier: attempt.verifier,
        })
        await this.writeToken({ ...token, region: attempt.region, issuer: attempt.issuer })
        attempt.settled = true
        attempt.result = { state: STATUS.authenticated }
        this.logins.delete(loginId)
        this.log(`[coros] login ${loginId} completed`)
        return { state: STATUS.authenticated }
      }
      if (claim.status === 'pending') return { state: STATUS.pending }
      if (claim.status === 'network-error') {
        // A transient blip must not kill a login the user is still completing.
        return { state: STATUS.pending, message: claim.message }
      }
      attempt.settled = true
      this.logins.delete(loginId)
      if (claim.status === 'expired') return { state: STATUS.expired, message: 'login session expired' }
      if (claim.status === 'failed') return { state: STATUS.error, message: claim.payload?.errorCode ?? 'authorization denied' }
      if (claim.status === 'claimed') return { state: STATUS.error, message: 'already claimed' }
      return { state: STATUS.error, message: claim.message ?? claim.status }
    } catch (err) {
      attempt.settled = true
      this.logins.delete(loginId)
      this.log(`[coros] login ${loginId} failed: ${err?.message ?? err}`)
      return { state: STATUS.error, message: String(err?.message ?? err) }
    } finally {
      attempt.polling = false
    }
  }

  async cancelLogin(loginId) {
    this.logins.delete(loginId)
  }

  async logout() {
    this.logins.clear()
    // Best effort revocation before custody is dropped: once the token is gone
    // we can no longer ask COROS to invalidate it.
    const token = (await this.readToken()) ?? this.cached
    if (token?.refresh_token) {
      try {
        const issuer = resolveIssuer(token.region, token.issuer)
        await revokeToken(issuer, { clientId: token.client_id, token: token.refresh_token })
      } catch (err) {
        this.log(`[coros] revoke failed, clearing locally anyway: ${err?.message ?? err}`)
      }
    }
    await this.clearToken()
  }

  #sweepLogins() {
    const now = Date.now()
    for (const [id, attempt] of this.logins) {
      if (now > attempt.expiresAt) this.logins.delete(id)
    }
  }
}
