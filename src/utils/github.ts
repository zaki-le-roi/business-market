export interface GitHubReleaseAsset {
  id: number;
  name: string;
  label: string | null;
  content_type: string;
  size: number;
  download_count: number;
  created_at: string;
  updated_at: string;
  browser_download_url: string;
}

export interface GitHubReleaseResponse {
  url: string;
  html_url: string;
  id: number;
  tag_name: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  assets: GitHubReleaseAsset[];
  body: string;
}

const DEFAULT_OWNER = 'zaki-le-roi';
const DEFAULT_REPO = 'business-market-releases';

/**
 * Fetches the latest release from the GitHub REST API for zaki-le-roi/business-market-releases
 * and returns the browser_download_url of the first asset (or first .apk asset) found.
 *
 * @param owner GitHub repository owner (default: 'zaki-le-roi')
 * @param repo GitHub repository name (default: 'business-market-releases')
 * @returns The browser_download_url of the first release asset, or null if no assets exist or an error occurs.
 */
export async function getLatestReleaseAssetUrl(
  owner = DEFAULT_OWNER,
  repo = DEFAULT_REPO
): Promise<string | null> {
  try {
    const sanitizedOwner = owner === 'zakidj181' ? 'zaki-le-roi' : owner;
    const sanitizedRepo = (repo === 'business-market' || repo === 'Business-Market')
      ? 'business-market-releases'
      : repo;

    const url = `https://api.github.com/repos/${sanitizedOwner}/${sanitizedRepo}/releases/latest?_t=${Date.now()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      console.warn(`[github] GitHub API request failed with status ${response.status}: ${response.statusText}`);
      return null;
    }

    const releaseData: GitHubReleaseResponse = await response.json();

    if (!releaseData || !Array.isArray(releaseData.assets) || releaseData.assets.length === 0) {
      console.warn(`[github] No release assets found for ${sanitizedOwner}/${sanitizedRepo} release ${releaseData?.tag_name || ''}`);
      return null;
    }

    // Prefer .apk asset if present, otherwise fall back to the very first asset
    const apkAsset = releaseData.assets.find((asset) => asset.name.toLowerCase().endsWith('.apk'));
    const targetAsset = apkAsset || releaseData.assets[0];

    return targetAsset.browser_download_url || null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[github] Error fetching latest release asset URL:', message);
    return null;
  }
}
