// Native trust-store mock. Returns the new TrustStoreInstallStatus shape
// from initTrustStore() — { installed, error }.
const mockInitTrustStore = jest.fn();
const mockNativeTrustCertificate = jest.fn();
const mockNativeRemoveTrustedCertificate = jest.fn();

jest.mock('../../../modules/expo-ssl-trust/src', () => ({
  initTrustStore: mockInitTrustStore,
  trustCertificate: mockNativeTrustCertificate,
  removeTrustedCertificate: mockNativeRemoveTrustedCertificate,
}));

// Lightweight stub for sslCertStore. We don't exercise the real Zustand
// store here — that's covered by sslCertStore.test.ts. We just need to
// verify the service writes the right actions through to it.
const mockTrustCertificateAction = jest.fn();
const mockRemoveTrustedCertificateAction = jest.fn();
const mockSetInstallFailed = jest.fn();
const mockClearInstallFailed = jest.fn();
let mockTrustedCerts: Record<string, { sha256: string; acceptedAt: number }> = {};

jest.mock('../../store/sslCertStore', () => ({
  sslCertStore: {
    getState: jest.fn(() => ({
      trustedCerts: mockTrustedCerts,
      trustCertificate: mockTrustCertificateAction,
      removeTrustedCertificate: mockRemoveTrustedCertificateAction,
      setInstallFailed: mockSetInstallFailed,
      clearInstallFailed: mockClearInstallFailed,
    })),
  },
}));

beforeEach(() => {
  mockInitTrustStore.mockReset().mockResolvedValue({ installed: true, error: null });
  mockNativeTrustCertificate.mockReset().mockResolvedValue(undefined);
  mockNativeRemoveTrustedCertificate.mockReset().mockResolvedValue(undefined);
  mockTrustCertificateAction.mockClear();
  mockRemoveTrustedCertificateAction.mockClear();
  mockSetInstallFailed.mockClear();
  mockClearInstallFailed.mockClear();
  mockTrustedCerts = {};
});

function loadFreshService() {
  jest.resetModules();
  return require('../sslTrustService') as typeof import('../sslTrustService');
}

// Wait for any pending microtasks to settle. The lazy-install path is
// `void ensureNativeTrustStoreInstalled().then(...)` so we need to flush
// the promise chain before asserting.
async function flush() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe('initSslTrustStore', () => {
  it('does NOT touch native when no certs are persisted', async () => {
    const { initSslTrustStore } = loadFreshService();
    initSslTrustStore();
    await flush();

    expect(mockInitTrustStore).not.toHaveBeenCalled();
    expect(mockNativeTrustCertificate).not.toHaveBeenCalled();
  });

  it('eagerly installs and syncs when certs are persisted', async () => {
    mockTrustedCerts = {
      'example.com': { sha256: 'AA:BB', acceptedAt: 1000 },
    };

    const { initSslTrustStore } = loadFreshService();
    initSslTrustStore();
    await flush();

    expect(mockInitTrustStore).toHaveBeenCalledTimes(1);
    expect(mockNativeTrustCertificate).toHaveBeenCalledWith('example.com', 'AA:BB');
    expect(mockClearInstallFailed).toHaveBeenCalled();
    expect(mockSetInstallFailed).not.toHaveBeenCalled();
  });

  it('does not sync certs when native install reports failure', async () => {
    mockTrustedCerts = {
      'example.com': { sha256: 'AA:BB', acceptedAt: 1000 },
    };
    mockInitTrustStore.mockResolvedValueOnce({
      installed: false,
      error: 'JSSE provider broken',
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { initSslTrustStore } = loadFreshService();
    initSslTrustStore();
    await flush();

    expect(mockInitTrustStore).toHaveBeenCalledTimes(1);
    expect(mockNativeTrustCertificate).not.toHaveBeenCalled();
    expect(mockSetInstallFailed).toHaveBeenCalledWith('JSSE provider broken');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('install failed'),
      'JSSE provider broken',
    );

    warnSpy.mockRestore();
  });

  it('records a default error message when native returns null error', async () => {
    mockTrustedCerts = {
      'example.com': { sha256: 'AA:BB', acceptedAt: 1000 },
    };
    mockInitTrustStore.mockResolvedValueOnce({ installed: false, error: null });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { initSslTrustStore } = loadFreshService();
    initSslTrustStore();
    await flush();

    expect(mockSetInstallFailed).toHaveBeenCalledWith(
      expect.stringContaining('could not be installed'),
    );

    warnSpy.mockRestore();
  });

  it('handles native init throwing (not just rejecting with status)', async () => {
    mockTrustedCerts = {
      'example.com': { sha256: 'AA:BB', acceptedAt: 1000 },
    };
    mockInitTrustStore.mockRejectedValueOnce(new Error('JNI crash'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { initSslTrustStore } = loadFreshService();
    expect(() => initSslTrustStore()).not.toThrow();
    await flush();

    expect(mockSetInstallFailed).toHaveBeenCalledWith('JNI crash');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('install threw'),
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });

  it('coerces non-Error throws into a string message', async () => {
    mockTrustedCerts = {
      'example.com': { sha256: 'AA:BB', acceptedAt: 1000 },
    };
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    mockInitTrustStore.mockRejectedValueOnce('string-shaped failure');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { initSslTrustStore } = loadFreshService();
    initSslTrustStore();
    await flush();

    expect(mockSetInstallFailed).toHaveBeenCalledWith('string-shaped failure');
    warnSpy.mockRestore();
  });

  it('is idempotent on repeated calls', async () => {
    mockTrustedCerts = {
      'example.com': { sha256: 'AA:BB', acceptedAt: 1000 },
    };

    const { initSslTrustStore } = loadFreshService();
    initSslTrustStore();
    initSslTrustStore();
    initSslTrustStore();
    await flush();

    expect(mockInitTrustStore).toHaveBeenCalledTimes(1);
  });

  it('handles per-cert sync failures gracefully', async () => {
    mockTrustedCerts = {
      'good.com': { sha256: 'AA:BB', acceptedAt: 1000 },
      'bad.com': { sha256: 'CC:DD', acceptedAt: 2000 },
    };
    mockNativeTrustCertificate
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('sync fail'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { initSslTrustStore } = loadFreshService();
    initSslTrustStore();
    await flush();

    expect(mockNativeTrustCertificate).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to sync cert'),
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });
});

describe('ensureNativeTrustStoreInstalled', () => {
  it('returns true when native install succeeds', async () => {
    const { ensureNativeTrustStoreInstalled } = loadFreshService();
    const ok = await ensureNativeTrustStoreInstalled();
    expect(ok).toBe(true);
    expect(mockClearInstallFailed).toHaveBeenCalled();
  });

  it('returns false and records failure when install fails', async () => {
    mockInitTrustStore.mockResolvedValueOnce({ installed: false, error: 'broken' });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { ensureNativeTrustStoreInstalled } = loadFreshService();
    const ok = await ensureNativeTrustStoreInstalled();

    expect(ok).toBe(false);
    expect(mockSetInstallFailed).toHaveBeenCalledWith('broken');

    warnSpy.mockRestore();
  });

  it('caches success — second call does not re-invoke native', async () => {
    const { ensureNativeTrustStoreInstalled } = loadFreshService();
    await ensureNativeTrustStoreInstalled();
    await ensureNativeTrustStoreInstalled();
    await ensureNativeTrustStoreInstalled();
    expect(mockInitTrustStore).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent calls into a single inflight install', async () => {
    let resolveInit: (v: { installed: boolean; error: string | null }) => void;
    mockInitTrustStore.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveInit = resolve;
      }),
    );

    const { ensureNativeTrustStoreInstalled } = loadFreshService();
    const a = ensureNativeTrustStoreInstalled();
    const b = ensureNativeTrustStoreInstalled();
    const c = ensureNativeTrustStoreInstalled();

    expect(mockInitTrustStore).toHaveBeenCalledTimes(1);
    resolveInit!({ installed: true, error: null });

    expect(await a).toBe(true);
    expect(await b).toBe(true);
    expect(await c).toBe(true);
  });

  it('allows retry after a failed install', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockInitTrustStore
      .mockResolvedValueOnce({ installed: false, error: 'fail' })
      .mockResolvedValueOnce({ installed: true, error: null });

    const { ensureNativeTrustStoreInstalled } = loadFreshService();
    const first = await ensureNativeTrustStoreInstalled();
    const second = await ensureNativeTrustStoreInstalled();

    expect(first).toBe(false);
    expect(second).toBe(true);
    expect(mockInitTrustStore).toHaveBeenCalledTimes(2);

    warnSpy.mockRestore();
  });
});

describe('trustCertificateForHost', () => {
  it('installs native, persists in Zustand, and syncs to native', async () => {
    const { trustCertificateForHost } = loadFreshService();

    await trustCertificateForHost('music.example.com', 'FF:EE:DD');

    expect(mockInitTrustStore).toHaveBeenCalledTimes(1);
    expect(mockTrustCertificateAction).toHaveBeenCalledWith(
      'music.example.com',
      'FF:EE:DD',
      undefined,
    );
    expect(mockNativeTrustCertificate).toHaveBeenCalledWith(
      'music.example.com',
      'FF:EE:DD',
    );
  });

  it('passes validTo through to the Zustand action', async () => {
    const { trustCertificateForHost } = loadFreshService();
    await trustCertificateForHost('music.example.com', 'FF:EE:DD', '2027-01-01T00:00:00Z');
    expect(mockTrustCertificateAction).toHaveBeenCalledWith(
      'music.example.com',
      'FF:EE:DD',
      '2027-01-01T00:00:00Z',
    );
  });

  it('still persists in Zustand when native install fails', async () => {
    mockInitTrustStore.mockResolvedValueOnce({ installed: false, error: 'broken' });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { trustCertificateForHost } = loadFreshService();
    await trustCertificateForHost('music.example.com', 'FF:EE:DD');

    expect(mockTrustCertificateAction).toHaveBeenCalledWith(
      'music.example.com',
      'FF:EE:DD',
      undefined,
    );

    warnSpy.mockRestore();
  });

  it('swallows native trustCertificate failure', async () => {
    mockNativeTrustCertificate.mockRejectedValueOnce(new Error('jni go boom'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { trustCertificateForHost } = loadFreshService();
    await expect(
      trustCertificateForHost('music.example.com', 'FF:EE:DD'),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to push cert'),
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });
});

describe('removeTrustForHost', () => {
  it('removes from Zustand store and native', async () => {
    const { removeTrustForHost } = loadFreshService();

    await removeTrustForHost('old.example.com');

    expect(mockRemoveTrustedCertificateAction).toHaveBeenCalledWith('old.example.com');
    expect(mockNativeRemoveTrustedCertificate).toHaveBeenCalledWith('old.example.com');
  });

  it('swallows native remove failure', async () => {
    mockNativeRemoveTrustedCertificate.mockRejectedValueOnce(new Error('boom'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { removeTrustForHost } = loadFreshService();
    await expect(removeTrustForHost('old.example.com')).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to remove cert'),
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });
});

describe('__resetForTests', () => {
  it('clears initialized + nativeInstalled state for retest', async () => {
    const svc = loadFreshService();

    await svc.ensureNativeTrustStoreInstalled();
    expect(mockInitTrustStore).toHaveBeenCalledTimes(1);

    // Without reset, the cached `nativeInstalled` would short-circuit.
    svc.__resetForTests();

    await svc.ensureNativeTrustStoreInstalled();
    expect(mockInitTrustStore).toHaveBeenCalledTimes(2);
  });
});
