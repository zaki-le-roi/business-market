import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

export interface AppVersionInfo {
  versionCode: number;
  versionName: string;
  packageName?: string;
}

export interface RemoteVersionManifest {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  latestApkUrl?: string;
  publishedAt?: string;
  releaseNotes?: string;
  notes_ar?: string;
  notes_fr?: string;
  isMandatory?: boolean;
}

export interface UpdateDownloadProgress {
  percent: number;
  bytesDownloaded: number;
  totalBytes: number;
}

interface NativeAppUpdaterPlugin {
  getAppVersion(): Promise<AppVersionInfo>;
  canRequestPackageInstalls(): Promise<{ canInstall: boolean }>;
  openInstallPermissionSettings(): Promise<void>;
  downloadAndInstall(options: { url: string }): Promise<void>;
  installApkFile(): Promise<void>;
  addListener(
    eventName: 'updateDownloadProgress',
    listenerFunc: (data: UpdateDownloadProgress) => void
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: 'updateDownloadComplete',
    listenerFunc: (data: { status: string }) => void
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: 'updateDownloadFailed',
    listenerFunc: (data: { error: string }) => void
  ): Promise<{ remove: () => Promise<void> }>;
  removeAllListeners(): Promise<void>;
}

export const NativeAppUpdater = registerPlugin<NativeAppUpdaterPlugin>('AppUpdater');

export const GITHUB_REPO = 'zaki-le-roi/business-market';

/**
 * Get current installed app version
 */
export async function getCurrentAppVersion(): Promise<AppVersionInfo> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    try {
      const nativeInfo = await NativeAppUpdater.getAppVersion();
      if (nativeInfo && nativeInfo.versionCode) {
        return nativeInfo;
      }
    } catch {
      // Fall back to Capacitor App plugin
    }

    try {
      const appInfo = await CapApp.getInfo();
      const code = parseInt(appInfo.build, 10);
      return {
        versionCode: isNaN(code) ? 1 : code,
        versionName: appInfo.version || '1.0.0',
        packageName: appInfo.id || 'com.businessmarket.app'
      };
    } catch {
      return { versionCode: 1, versionName: '1.0.0', packageName: 'com.businessmarket.app' };
    }
  }

  // Web / fallback
  return {
    versionCode: 1,
    versionName: '1.0.0',
    packageName: 'com.businessmarket.app'
  };
}

/**
 * Fetch remote version manifest from redundant sources
 */
export async function fetchRemoteVersionManifest(): Promise<RemoteVersionManifest | null> {
  const timestamp = Date.now();
  const urls = [
    // 1. Direct version.json from latest GitHub release
    `https://github.com/${GITHUB_REPO}/releases/latest/download/version.json?_t=${timestamp}`,
    // 2. Raw GitHub repository main branch version manifest
    `https://raw.githubusercontent.com/${GITHUB_REPO}/main/public/version.json?_t=${timestamp}`,
    // 3. Web server public manifest
    `/version.json?_t=${timestamp}`,
    // 4. Cloudflare / Production Web URL manifest
    `https://business-market-olt.pages.dev/version.json?_t=${timestamp}`
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (data && (typeof data.versionCode === 'number' || typeof data.versionName === 'string')) {
          const apkUrl = data.apkUrl ||
            data.latestApkUrl ||
            `https://github.com/${GITHUB_REPO}/releases/latest/download/business-market.apk`;

          return {
            versionCode: Number(data.versionCode) || 0,
            versionName: String(data.versionName || '1.0.0'),
            apkUrl,
            latestApkUrl: data.latestApkUrl,
            publishedAt: data.publishedAt,
            releaseNotes: data.releaseNotes,
            notes_ar: data.notes_ar,
            notes_fr: data.notes_fr,
            isMandatory: Boolean(data.isMandatory)
          };
        }
      }
    } catch {
      // Try next endpoint
    }
  }

  // Fallback: Check GitHub Releases API directly
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
      cache: 'no-store'
    });
    if (res.ok) {
      const release = await res.json();
      if (release && release.tag_name) {
        // Tag format e.g. "v1.0.12"
        const tag = release.tag_name.replace(/^v/, '');
        const parts = tag.split('.');
        const lastPart = parts.length > 0 ? parseInt(parts[parts.length - 1], 10) : 1;
        const versionCode = isNaN(lastPart) ? 1 : lastPart;

        const apkAsset = release.assets?.find((a: { name: string; browser_download_url: string }) =>
          a.name.endsWith('.apk')
        );

        const apkUrl = apkAsset?.browser_download_url ||
          `https://github.com/${GITHUB_REPO}/releases/latest/download/business-market.apk`;

        return {
          versionCode,
          versionName: tag,
          apkUrl,
          publishedAt: release.published_at,
          releaseNotes: release.body || `Release ${release.tag_name}`
        };
      }
    }
  } catch {
    // Ignore GitHub API errors
  }

  return null;
}

/**
 * Check if a newer version is available on Android
 */
export async function checkForUpdate(): Promise<{
  updateAvailable: boolean;
  currentVersion: AppVersionInfo;
  remoteManifest: RemoteVersionManifest | null;
}> {
  const currentVersion = await getCurrentAppVersion();
  const remoteManifest = await fetchRemoteVersionManifest();

  if (!remoteManifest) {
    return { updateAvailable: false, currentVersion, remoteManifest: null };
  }

  const isNewer = remoteManifest.versionCode > currentVersion.versionCode;

  return {
    updateAvailable: isNewer,
    currentVersion,
    remoteManifest
  };
}

/**
 * Start automatic background download and installation
 */
export async function startAutomaticUpdate(
  apkUrl: string,
  onProgress?: (progress: UpdateDownloadProgress) => void,
  onComplete?: () => void,
  onError?: (error: string) => void
): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return;
  }

  try {
    // Register listeners
    await NativeAppUpdater.removeAllListeners();

    if (onProgress) {
      await NativeAppUpdater.addListener('updateDownloadProgress', (data) => {
        onProgress(data);
      });
    }

    if (onComplete) {
      await NativeAppUpdater.addListener('updateDownloadComplete', () => {
        onComplete();
      });
    }

    if (onError) {
      await NativeAppUpdater.addListener('updateDownloadFailed', (data) => {
        onError(data.error || 'Failed to download update');
      });
    }

    // Trigger download & install
    await NativeAppUpdater.downloadAndInstall({ url: apkUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (onError) {
      onError(message);
    }
  }
}

/**
 * Open Android Settings to grant unknown app install permissions if requested
 */
export async function requestInstallPermission(): Promise<void> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    try {
      await NativeAppUpdater.openInstallPermissionSettings();
    } catch {
      // Ignore
    }
  }
}

/**
 * Re-trigger package installer for an already downloaded APK
 */
export async function launchInstaller(): Promise<void> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    try {
      await NativeAppUpdater.installApkFile();
    } catch {
      // Ignore
    }
  }
}
