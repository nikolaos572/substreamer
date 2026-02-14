export {
  getCertificateInfo,
  trustCertificate,
  removeTrustedCertificate,
  getTrustedCertificates,
  isCertificateTrusted,
  initTrustStore,
  isSSLError,
} from './ExpoSslTrust';

export type { CertificateInfo, TrustedCert } from './ExpoSslTrust';
