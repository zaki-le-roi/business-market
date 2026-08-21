const fs = require('fs');
const path = require('path');

const versionFilePath = path.join(__dirname, '..', 'public', 'version.json');
const repo = 'zaki-le-roi/business-market';

let currentVersion = {
  versionCode: 1,
  versionName: '1.0.0',
  apkUrl: `https://github.com/${repo}/releases/latest/download/business-market.apk`,
  latestApkUrl: `https://github.com/${repo}/releases/latest/download/business-market.apk`,
  publishedAt: new Date().toISOString(),
  releaseNotes: 'Automated APK build',
  notes_ar: 'تحديث تلقائي جديد لتحسين الأداء واستقرار التطبيق',
  notes_fr: 'Mise à jour automatique pour améliorer les performances',
  isMandatory: false
};

if (fs.existsSync(versionFilePath)) {
  try {
    const data = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
    currentVersion = { ...currentVersion, ...data };
  } catch (e) {
    // Keep defaults
  }
}

// If running in CI or building
if (process.env.GITHUB_RUN_NUMBER) {
  const runNumber = parseInt(process.env.GITHUB_RUN_NUMBER, 10);
  currentVersion.versionCode = isNaN(runNumber) ? currentVersion.versionCode + 1 : runNumber;
  currentVersion.versionName = `1.0.${currentVersion.versionCode}`;
  currentVersion.apkUrl = `https://github.com/${repo}/releases/download/v1.0.${currentVersion.versionCode}/business-market.apk`;
} else if (process.env.NODE_ENV === 'production' && !process.env.SKIP_VERSION_BUMP) {
  // Minor increment for production builds if not specified
  currentVersion.publishedAt = new Date().toISOString();
}

// Ensure public directory exists
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(versionFilePath, JSON.stringify(currentVersion, null, 2));
console.log(`[Version Manifest] Generated versionCode: ${currentVersion.versionCode}, versionName: ${currentVersion.versionName}`);
