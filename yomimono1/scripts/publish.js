import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { stripMarkdown, cleanMarkdown } from './utils_novel.js';
import { getEpisodeIds, saveEpisodeId } from './publish_map.js';
import publishNarou from './publish_narou.js';
import publishKakuyomu from './publish_kakuyomu.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distSettingsDir = path.resolve(__dirname, '../dist/export_resolved_ruby');

async function main() { // 引数解析
  const fileName = process.argv[2]; // This is the 'target' from original
  let targetPlatform = 'all';
  let isDryRun = false;

  // Parse arguments from index 3 onwards
  const args = process.argv.slice(3);
  args.forEach(arg => {
    if (arg === '--dry-run' || arg === '--dryrun') {
      isDryRun = true;
    } else if (['narou', 'kakuyomu', 'all'].includes(arg)) {
      targetPlatform = arg;
    }
  });

  if (!fileName) {
    console.error('Usage: node scripts/publish.js <filepath> [narou|kakuyomu|all] [--dry-run]');
    process.exit(1);
  }

  const filePath = path.join(distSettingsDir, fileName);
  if (!fs.existsSync(filePath)) {
    console.error(`[Error] File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  
  // 抽出処理: タイトル（一番最初の # 見出し）と、それ以降の本文
  let title = '';
  let bodyContent = content;
  const match = content.match(/#\s*([^\n]+)/);
  if (match) {
    title = match[1].trim();
    bodyContent = content.replace(match[0], '');
  } else {
    // タイトルが見つからない場合のフォールバック
    title = `エピソード: ${fileName.replace('.mdx', '')}`;
  }

  // 既存の文字抽出・クリーニングロジックを再利用
  const cleanedContent = cleanMarkdown(bodyContent);
  const plainTextNovel = stripMarkdown(cleanedContent);

  console.log(`========================================`);
  console.log(`[Publish] Target File: ${fileName}`);
  console.log(`[Publish] Target Platform: ${targetPlatform}`);
  console.log(`[Publish] Dry Run: ${isDryRun}`);
  console.log(`[Publish] Document Title: ${title}`);
  console.log(`[Publish] Body Length: ${plainTextNovel.length} characters`);
  console.log(`========================================`);
  
  // マップから既存ID取得
  const existingIds = getEpisodeIds(fileName);
  const kakuyomuExistingId = existingIds.kakuyomu || null;
  const narouExistingId = existingIds.narou || null;

  let successTotal = true;
  let narouResult = null;
  let kakuyomuResult = null;

  const platformMatch = (platformName) => targetPlatform === 'all' || targetPlatform === platformName;

  // カクヨム投稿
  if (platformMatch('kakuyomu')) {
    try {
      console.log('[Publish] Starting Kakuyomu publish...');
      kakuyomuResult = await publishKakuyomu(title, plainTextNovel, kakuyomuExistingId, isDryRun);
      
      if (kakuyomuResult && kakuyomuResult.id && !isDryRun) {
        saveEpisodeId(fileName, 'kakuyomu', kakuyomuResult.id);
        console.log(`[Publish] Saved new Kakuyomu ID: ${kakuyomuResult.id} to map for ${fileName}`);
      }
      
      if (kakuyomuResult && kakuyomuResult.skipped) {
        console.log('[Publish] Result: SKIPPED_NO_CHANGES (Kakuyomu)');
      } else if (isDryRun) {
        console.log('[Publish] Kakuyomu dry run finished.');
      } else {
        console.log('[Publish] Kakuyomu publish finished successfully.');
      }
    } catch (err) {
      console.error('[Publish] Kakuyomu publish failed:', err.message || err);
      successTotal = false;
    }
  } else {
    console.log('[Publish] Skipping Kakuyomu publish...');
  }

  // なろう投稿
  if (platformMatch('narou')) {
    try {
      console.log('[Publish] Starting Narou publish...');
      narouResult = await publishNarou(title, plainTextNovel, narouExistingId, isDryRun);
      
      if (narouResult && narouResult.id && !isDryRun) {
        saveEpisodeId(fileName, 'narou', narouResult.id);
        console.log(`[Publish] Saved new Narou ID: ${narouResult.id} to map for ${fileName}`);
      }
      
      if (narouResult && narouResult.skipped) {
        console.log('[Publish] Result: SKIPPED_NO_CHANGES (Narou)');
      } else if (isDryRun) {
        console.log('[Publish] Narou dry run finished.');
      } else {
        console.log('[Publish] Narou publish finished successfully.');
      }
    } catch (err) {
      console.error('[Publish] Narou publish failed:', err.message || err);
      successTotal = false;
    }
  } else {
    console.log('[Publish] Skipping Narou publish...');
  }

  if (!successTotal) {
    process.exit(1);
  } else {
    console.log('[Publish] All sync tasks completed.');
    console.log('JSON_RESULT:' + JSON.stringify({ 
        success: true, 
        narou: narouResult, 
        kakuyomu: kakuyomuResult,
        dryRun: isDryRun,
        localTitle: title,
        localBody: plainTextNovel
    }));
  }
}

main();
