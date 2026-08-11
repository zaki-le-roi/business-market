import { supabase } from '../lib/supabase';
import { getLatestReleaseInfo } from './githubRelease';

export interface OtaDiagnosticResult {
  supabaseOwner: string;
  supabaseRepo: string;
  apiEndpoint: string;
  githubTag: string;
  versionName: string;
  versionCode: number;
  downloadUrl: string;
  publishedAt: string;
  releaseTitle: string;
  isMatching: boolean;
}

export async function runOtaDiagnostic(): Promise<OtaDiagnosticResult> {
  // 1. Fetch Supabase system_settings
  let owner = 'zaki-le-roi';
  let repo = 'business-market-releases';

  try {
    const { data: dbData } = await supabase
      .from('system_settings')
      .select('*')
      .eq('key', 'app_update_config')
      .maybeSingle();

    if (dbData?.value) {
      const val = dbData.value;
      if (typeof val.github_owner === 'string' && val.github_owner.trim()) {
        owner = val.github_owner.trim();
      }
      if (typeof val.github_repo === 'string' && val.github_repo.trim()) {
        repo = val.github_repo.trim();
      }
    }
  } catch (err) {
    console.warn('Supabase fetch error in diagnostic:', err);
  }

  const releaseInfo = await getLatestReleaseInfo(owner, repo);

  return {
    supabaseOwner: releaseInfo.owner,
    supabaseRepo: releaseInfo.repo,
    apiEndpoint: `https://api.github.com/repos/${releaseInfo.owner}/${releaseInfo.repo}/releases/latest`,
    githubTag: releaseInfo.tagName,
    versionName: releaseInfo.versionName,
    versionCode: releaseInfo.versionCode,
    downloadUrl: releaseInfo.downloadUrl,
    publishedAt: releaseInfo.publishedAt,
    releaseTitle: releaseInfo.releaseTitle,
    isMatching: true
  };
}
