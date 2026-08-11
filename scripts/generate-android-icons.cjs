const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rawSource = 'src/assets/images/business_market_logo_1784312368352.jpg';

if (!fs.existsSync(rawSource)) {
  console.error('Source file does not exist:', rawSource);
  process.exit(1);
}

// 1. Trim white border from logo image to get pure BM icon mark symbol
const trimmedMarkPath = '/tmp/bm_trimmed_mark.png';
const cleanMasterPath = '/tmp/bm_clean_master.png';

execFileSync('convert', [rawSource, '-fuzz', '5%', '-trim', '+repage', trimmedMarkPath]);

// Create master clean logo for public assets (1024x1024 white background with centered logo mark)
execFileSync('convert', [
  trimmedMarkPath,
  '-resize', '737x737',
  '-gravity', 'center',
  '-background', 'white',
  '-extent', '1024x1024',
  cleanMasterPath
]);

if (fs.existsSync('public')) {
  fs.copyFileSync(cleanMasterPath, 'public/logo.jpg');
  fs.copyFileSync(cleanMasterPath, 'public/favicon.png');
}

const densities = [
  { name: 'mdpi', foreground: 108, legacy: 48 },
  { name: 'hdpi', foreground: 162, legacy: 72 },
  { name: 'xhdpi', foreground: 216, legacy: 96 },
  { name: 'xxhdpi', foreground: 324, legacy: 144 },
  { name: 'xxxhdpi', foreground: 432, legacy: 192 },
];

densities.forEach(d => {
  const dir = path.join('android/app/src/main/res', `mipmap-${d.name}`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const fgSize = d.foreground;
  // Adaptive foreground safe-zone inner scale (~62% of 108dp canvas for optimal centered fit inside 66dp-72dp mask)
  const fgInner = Math.round(fgSize * 0.62);
  
  // 1. Adaptive icon foreground PNG (transparent background)
  execFileSync('convert', [
    trimmedMarkPath,
    '-resize', `${fgInner}x${fgInner}`,
    '-gravity', 'center',
    '-background', 'transparent',
    '-extent', `${fgSize}x${fgSize}`,
    path.join(dir, 'ic_launcher_foreground.png')
  ]);

  // 2. Standard legacy icon (white background with centered logo mark)
  const legacySize = d.legacy;
  const legacyInner = Math.round(legacySize * 0.78);
  execFileSync('convert', [
    trimmedMarkPath,
    '-resize', `${legacyInner}x${legacyInner}`,
    '-gravity', 'center',
    '-background', 'white',
    '-extent', `${legacySize}x${legacySize}`,
    path.join(dir, 'ic_launcher.png')
  ]);

  // 3. Round legacy icon (circle clipped)
  const cx = legacySize / 2;
  const cy = legacySize / 2;
  const rx = legacySize / 2;
  const ry = 0;
  execFileSync('convert', [
    path.join(dir, 'ic_launcher.png'),
    '(', '+clone', '-threshold', '-1', '-negate', '-fill', 'white', '-draw', `circle ${cx},${cy} ${rx},${ry}`, ')',
    '-alpha', 'off',
    '-compose', 'copy_opacity',
    '-composite',
    path.join(dir, 'ic_launcher_round.png')
  ]);

  console.log(`Generated launcher icons for mipmap-${d.name}`);
});

console.log('All Android Launcher Icons generated successfully.');

