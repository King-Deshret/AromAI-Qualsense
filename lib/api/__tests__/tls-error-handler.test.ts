import { describe, it, expect } from 'vitest';
import { isTlsError, getTlsErrorReason } from '../tls-error-handler';

describe('isTlsError', () => {
  it('returns false for non-Error values', () => {
    expect(isTlsError(null)).toBe(false);
    expect(isTlsError(undefined)).toBe(false);
    expect(isTlsError('string error')).toBe(false);
    expect(isTlsError(42)).toBe(false);
  });

  it('returns false for generic errors', () => {
    expect(isTlsError(new Error('ECONNREFUSED'))).toBe(false);
    expect(isTlsError(new Error('ENOTFOUND'))).toBe(false);
    expect(isTlsError(new Error('timeout'))).toBe(false);
  });

  it('detects expired certificate errors', () => {
    const error = new Error('CERT_HAS_EXPIRED');
    expect(isTlsError(error)).toBe(true);
  });

  it('detects self-signed certificate errors', () => {
    const error = new Error('DEPTH_ZERO_SELF_SIGNED_CERT');
    expect(isTlsError(error)).toBe(true);
  });

  it('detects self-signed cert in chain errors', () => {
    const error = new Error('SELF_SIGNED_CERT_IN_CHAIN');
    expect(isTlsError(error)).toBe(true);
  });

  it('detects unable to verify leaf signature errors', () => {
    const error = new Error('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    expect(isTlsError(error)).toBe(true);
  });

  it('detects certificate altname invalid errors', () => {
    const error = new Error('ERR_TLS_CERT_ALTNAME_INVALID');
    expect(isTlsError(error)).toBe(true);
  });

  it('detects errors with TLS error code property', () => {
    const error = new Error('connection failed') as NodeJS.ErrnoException;
    error.code = 'CERT_HAS_EXPIRED';
    expect(isTlsError(error)).toBe(true);
  });

  it('detects errors with certificate-related messages', () => {
    const error = new Error('unable to verify the first certificate');
    expect(isTlsError(error)).toBe(true);
  });

  it('detects errors with SSL in message', () => {
    const error = new Error('SSL routines:ssl3_get_server_certificate:certificate verify failed');
    expect(isTlsError(error)).toBe(true);
  });

  it('detects errors with TLS in message', () => {
    const error = new Error('TLS handshake failed');
    expect(isTlsError(error)).toBe(true);
  });

  it('detects CERT_REVOKED errors', () => {
    const error = new Error('CERT_REVOKED');
    expect(isTlsError(error)).toBe(true);
  });

  it('detects CERT_UNTRUSTED errors', () => {
    const error = new Error('CERT_UNTRUSTED');
    expect(isTlsError(error)).toBe(true);
  });
});

describe('getTlsErrorReason', () => {
  it('returns generic message for non-Error values', () => {
    expect(getTlsErrorReason(null)).toBe('Unknown TLS error');
    expect(getTlsErrorReason('string')).toBe('Unknown TLS error');
  });

  it('includes error code when available', () => {
    const error = new Error('connection failed') as NodeJS.ErrnoException;
    error.code = 'CERT_HAS_EXPIRED';
    expect(getTlsErrorReason(error)).toBe(
      'TLS certificate validation failed: CERT_HAS_EXPIRED'
    );
  });

  it('includes error message when no code is available', () => {
    const error = new Error('SELF_SIGNED_CERT_IN_CHAIN');
    expect(getTlsErrorReason(error)).toBe(
      'TLS certificate validation failed: SELF_SIGNED_CERT_IN_CHAIN'
    );
  });
});
