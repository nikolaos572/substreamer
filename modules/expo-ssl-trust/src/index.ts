export {
  getCertificateInfo,
  trustCertificate,
  removeTrustedCertificate,
  getTrustedCertificates,
  isCertificateTrusted,
  initTrustStore,
  getInstallStatus,
  isSSLError,
} from './ExpoSslTrust';

export type { CertificateInfo, TrustedCert, TrustStoreInstallStatus } from './ExpoSslTrust';
