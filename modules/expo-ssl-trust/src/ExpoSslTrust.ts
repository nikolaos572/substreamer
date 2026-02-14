import ExpoSslTrustModule from './ExpoSslTrustModule';

export interface CertificateInfo {
  /** Certificate subject (e.g. "CN=navidrome.local") */
  subject: string;
  /** Certificate issuer (e.g. "CN=navidrome.local" for self-signed) */
  issuer: string;
  /** SHA-256 fingerprint of the certificate in hex (colon-separated) */
  sha256Fingerprint: string;
  /** Validity start date as ISO 8601 string */
  validFrom: string;
  /** Validity end date as ISO 8601 string */
  validTo: string;
  /** Certificate serial number in hex */
  serialNumber: string;
  /** Whether the certificate is self-signed (subject === issuer) */
  isSelfSigned: boolean;
}

export interface TrustedCert {
  /** The hostname this certificate is trusted for */
  hostname: string;
  /** SHA-256 fingerprint of the trusted certificate */
  sha256Fingerprint: string;
  /** Timestamp when the user accepted this certificate (epoch ms) */
  acceptedAt: number;
}

/**
 * Connect to a server and retrieve its SSL certificate information.
 * This opens a raw TLS connection to extract the certificate without
 * going through the normal trust validation.
 */
export async function getCertificateInfo(url: string): Promise<CertificateInfo> {
  return ExpoSslTrustModule.getCertificateInfo(url);
}

/**
 * Add a certificate to the app's trusted certificate store.
 * After calling this, connections to the specified hostname whose
 * certificate matches the given fingerprint will be allowed.
 */
export async function trustCertificate(
  hostname: string,
  sha256Fingerprint: string
): Promise<void> {
  return ExpoSslTrustModule.trustCertificate(hostname, sha256Fingerprint);
}

/**
 * Remove a previously trusted certificate from the trust store.
 */
export async function removeTrustedCertificate(hostname: string): Promise<void> {
  return ExpoSslTrustModule.removeTrustedCertificate(hostname);
}

/**
 * Get all currently trusted certificates.
 */
export async function getTrustedCertificates(): Promise<TrustedCert[]> {
  return ExpoSslTrustModule.getTrustedCertificates();
}

/**
 * Check if a hostname has a trusted certificate in the store.
 */
export async function isCertificateTrusted(hostname: string): Promise<boolean> {
  return ExpoSslTrustModule.isCertificateTrusted(hostname);
}

/**
 * Initialize the native trust store. Should be called early in app startup
 * to ensure the custom TrustManager / URLSession delegate is installed
 * before any network requests are made.
 */
export async function initTrustStore(): Promise<void> {
  return ExpoSslTrustModule.initTrustStore();
}

/**
 * SSL error message patterns per platform. Use this to detect whether
 * a network error is an SSL certificate trust failure.
 */
const SSL_ERROR_PATTERNS = [
  // Android (OkHttp / javax.net.ssl)
  'javax.net.ssl',
  'SSLHandshakeException',
  'CertPathValidatorException',
  'PKIX path',
  'Trust anchor for certification path not found',
  'SSL handshake aborted',
  // iOS (NSURLSession / Security framework)
  'NSURLErrorServerCertificateUntrusted',
  'NSURLErrorServerCertificateHasUnknownRoot',
  'NSURLErrorServerCertificateNotYetValid',
  'NSURLErrorServerCertificateHasBadDate',
  'kCFStreamErrorDomainSSL',
  'The certificate for this server is invalid',
  'certificate is not trusted',
  'A server with the specified hostname could not be found',
  // Generic
  'SSL',
  'certificate',
  'CERTIFICATE_VERIFY_FAILED',
  // Certificate changed (from our native module)
  'CERT_FINGERPRINT_MISMATCH',
];

/**
 * Check if an error message indicates an SSL certificate trust failure.
 */
export function isSSLError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  return SSL_ERROR_PATTERNS.some((pattern) => lower.includes(pattern.toLowerCase()));
}
