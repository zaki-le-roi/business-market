export interface LatestReleaseInfo {
  owner: string;
  repo: string;
  tagName: string;
  versionName: string;
  versionCode: number;
  downloadUrl: string;
  publishedAt: string;
  releaseTitle: string;
  body: string;
}

const DEFAULT_OWNER = 'zaki-le-roi';
const DEFAULT_REPO = 'business-market-releases';

/**
 * Fetches the latest release metadata and direct APK asset download URL
 * from GitHub REST API for the specified repository (default: zaki-le-roi/business-market-releases).
 */
export async function getLatestReleaseInfo(
  owner = DEFAULT_OWNER,
  repo = DEFAULT_REPO
): Promise<LatestReleaseInfo> {
  const cleanOwner = owner === 'zakidj181' ? 'zaki-le-roi' : owner;
  const cleanRepo = (repo === 'business-market' || repo === 'Business-Market' || repo === 'Business-Market-Releases')
    ? 'business-market-releases'
    : repo;

  const endpoint = `https://api.github.com/repos/${cleanOwner}/${cleanRepo}/releases/latest?_t=${Date.now()}`;

  const response = await fetch(endpoint, {
    headers: {
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub release info: HTTP ${response.status}`);
  }

  const releaseData = await response.json() as {
    tag_name?: string;
    name?: string;
    body?: string;
    published_at?: string;
    assets?: Array<{ name: string; browser_download_url: string }>;
  };

  const tagName = releaseData.tag_name || '';
  const versionName = tagName.replace(/^v+/, '').trim();

  let versionCode = 100;
  const bodyMatch = releaseData.body?.match(/Version Code:\s*(\d+)/i);
  if (bodyMatch && bodyMatch[1]) {
    versionCode = parseInt(bodyMatch[1], 10);
  } else {
    const parts = versionName.split('.');
    if (parts.length >= 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed) && parsed > 0) versionCode = parsed;
    } else {
      const parsed = parseInt(versionName, 10);
      if (!isNaN(parsed) && parsed > 0) versionCode = parsed;
    }
  }

  let downloadUrl = '';
  if (Array.isArray(releaseData.assets) && releaseData.assets.length > 0) {
    const apkAsset = releaseData.assets.find(a => a.name.endsWith('.apk')) || releaseData.assets[0];
    if (apkAsset?.browser_download_url) {
      downloadUrl = apkAsset.browser_download_url;
    }
  }

  if (!downloadUrl) {
    downloadUrl = `https://github.com/${cleanOwner}/${cleanRepo}/releases/download/${tagName}/Business-Market.apk`;
  }

  if (!downloadUrl.includes('?_t=')) {
    downloadUrl = `${downloadUrl}${downloadUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`;
  }

  return {
    owner: cleanOwner,
    repo: cleanRepo,
    tagName,
    versionName,
    versionCode,
    downloadUrl,
    publishedAt: releaseData.published_at || '',
    releaseTitle: releaseData.name || tagName,
    body: releaseData.body || ''
  };
}

/**
 * Convenience helper to get directly the APK download URL for the latest release.
 */
export async function getLatestReleaseDownloadUrl(
  owner = DEFAULT_OWNER,
  repo = DEFAULT_REPO
): Promise<string> {
  const info = await getLatestReleaseInfo(owner, repo);
  return info.downloadUrl;
}
