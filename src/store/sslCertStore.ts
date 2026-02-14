import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { sqliteStorage } from './sqliteStorage';

export interface TrustedCertEntry {
  /** SHA-256 fingerprint of the trusted certificate (colon-separated hex) */
  sha256: string;
  /** Timestamp when the user accepted this certificate (epoch ms) */
  acceptedAt: number;
}

interface SslCertState {
  /** Map of hostname -> trusted certificate entry */
  trustedCerts: Record<string, TrustedCertEntry>;
  /** Add or update a trusted certificate for a hostname */
  trustCertificate: (hostname: string, sha256: string) => void;
  /** Remove a trusted certificate by hostname */
  removeTrustedCertificate: (hostname: string) => void;
  /** Check if a hostname has a trusted certificate */
  isTrusted: (hostname: string) => boolean;
  /** Get the trusted fingerprint for a hostname, or null */
  getTrustedFingerprint: (hostname: string) => string | null;
}

const PERSIST_KEY = 'substreamer-ssl-certs';

export const sslCertStore = create<SslCertState>()(
  persist(
    (set, get) => ({
      trustedCerts: {},

      trustCertificate: (hostname: string, sha256: string) =>
        set((state) => ({
          trustedCerts: {
            ...state.trustedCerts,
            [hostname]: {
              sha256: sha256.toUpperCase(),
              acceptedAt: Date.now(),
            },
          },
        })),

      removeTrustedCertificate: (hostname: string) =>
        set((state) => {
          const { [hostname]: _, ...rest } = state.trustedCerts;
          return { trustedCerts: rest };
        }),

      isTrusted: (hostname: string) => {
        return hostname in get().trustedCerts;
      },

      getTrustedFingerprint: (hostname: string) => {
        return get().trustedCerts[hostname]?.sha256 ?? null;
      },
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => sqliteStorage),
      partialize: (state) => ({
        trustedCerts: state.trustedCerts,
      }),
    }
  )
);
