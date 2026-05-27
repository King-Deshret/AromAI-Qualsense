/**
 * TLS Error Handler Utility
 *
 * Detects TLS/SSL certificate errors in fetch responses and provides
 * structured error information compatible with the AI service retry mechanism.
 *
 * Node.js validates TLS certificates by default (rejectUnauthorized: true).
 * This utility identifies TLS-specific errors so they can be treated as
 * AI service errors with standard retry (Requirement 18.4, 18.5).
 */

/**
 * Known TLS/SSL error codes and message patterns from Node.js
 */
const TLS_ERROR_CODES = [
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'CERT_CHAIN_TOO_LONG',
  'CERT_NOT_YET_VALID',
  'CERT_REJECTED',
  'CERT_REVOKED',
  'CERT_SIGNATURE_FAILURE',
  'CERT_UNTRUSTED',
  'ERR_TLS_HANDSHAKE_TIMEOUT',
] as const;

const TLS_ERROR_PATTERNS = [
  'certificate',
  'ssl',
  'tls',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_CRL',
  'UNABLE_TO_DECRYPT_CERT_SIGNATURE',
  'UNABLE_TO_DECRYPT_CRL_SIGNATURE',
  'UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY',
  'ERR_SSL',
] as const;

/**
 * Determines if an error is a TLS/SSL certificate validation error.
 */
export function isTlsError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toUpperCase();
  const code = (error as NodeJS.ErrnoException).code?.toUpperCase() || '';

  // Check against known TLS error codes
  for (const tlsCode of TLS_ERROR_CODES) {
    if (code === tlsCode || message.includes(tlsCode)) {
      return true;
    }
  }

  // Check against TLS error message patterns
  for (const pattern of TLS_ERROR_PATTERNS) {
    if (message.includes(pattern.toUpperCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts a human-readable TLS error reason from the error.
 */
export function getTlsErrorReason(error: unknown): string {
  if (!(error instanceof Error)) return 'Unknown TLS error';

  const code = (error as NodeJS.ErrnoException).code;
  if (code) {
    return `TLS certificate validation failed: ${code}`;
  }

  return `TLS certificate validation failed: ${error.message}`;
}
