const favicons = require('favicons').default;
const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');
// faviconsライブラリが内部で使用しているsharpを直接利用します
const sharp = require('sharp');

// --- 設定 ---
const SOURCE_IMAGE = 'src/logo-300px.png'; // 自動生成のベース
const PIXEL_IMAGE = 'src/icon-16px.png';   // 手動ドット絵 (16px)
const OUTPUT_DIR = 'public/icons';
const HTML_OUTPUT = 'public/icons/index.html';

const configuration = {
    path: "/icons/",
    appName: "My App",
    appShortName: "App",
    appDescription: "My awesome application",
    lang: "ja-JP",
    background: "#fff",
    theme_color: "#fff",
    display: "standalone",
    start_url: "/?homescreen=1",
    icons: {
        android: true,
        appleIcon: true,
        appleStartup: false,
        favicons: true,
        windows: false,
        yandex: false
    }
};

(async () => {
    try {
        console.log('🏗️  Favicon generation started...');

        // 1. 全量生成 (logo-300px から一旦すべて作る)
        const response = await favicons(SOURCE_IMAGE, configuration);

        if (!fs.existsSync(OUTPUT_DIR)){
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        // 2. 画像ファイルの書き出し
        for (const file of response.images) {
            const isAndroid = file.name.includes('android-chrome');
            const isApple180 = file.name.includes('180x180');
            const isFavicon32 = file.name.includes('32x32');
            const isFavicon16 = file.name.includes('16x16'); 

            if (isAndroid || isApple180 || isFavicon32 || isFavicon16) {
                let fileName = file.name;
                if (isApple180) fileName = 'apple-touch-icon.png';
                fs.writeFileSync(path.join(OUTPUT_DIR, fileName), file.contents);
            }
        }

        // 設定ファイルの書き出し
        for (const file of response.files) {
            fs.writeFileSync(path.join(OUTPUT_DIR, file.name), file.contents);
        }

        // 3. HTMLタグの書き出し
        const cleanHtml = response.html.filter(line => {
            if (line.includes('apple-touch-icon')) return line.includes('180x180');
            if (line.includes('icon') && line.includes('image/png')) {
                return line.includes('16x16') || line.includes('32x32') || line.includes('android');
            }
            return true; 
        }).map(line => {
            return line.replace('apple-touch-icon-180x180.png', 'apple-touch-icon.png');
        });

        fs.writeFileSync(HTML_OUTPUT, cleanHtml.join('\n'));
        console.log('✅ Base assets generated.');

        // 4. 手打ち画像の適用処理 & 32pxへのアップスケール
        if (fs.existsSync(PIXEL_IMAGE)) {
            const icon32Path = path.join(OUTPUT_DIR, 'favicon-32x32.png');

            console.log('🎨 Upscaling 16px icon to 32px (Nearest Neighbor)...');
            
            // sharpを使って16pxを32pxに「くっきり」拡大して上書き保存
            await sharp(PIXEL_IMAGE)
                .resize(32, 32, { kernel: 'nearest' }) // ドット絵用アルゴリズム
                .toFile(icon32Path);
            
            console.log('✨ favicon-32x32.png overwritten with upscaled pixel art.');

            // 手動16pxもコピーして適用
            fs.copyFileSync(PIXEL_IMAGE, path.join(OUTPUT_DIR, 'favicon-16x16.png'));
            console.log('✨ favicon-16x16.png overwritten.');

            // 5. ICOファイルの生成 (16px原画 + 32px拡大版)
            try {
                // 生成したばかりの画像ファイルを指定して結合
                const icoBuffer = await pngToIco([PIXEL_IMAGE, icon32Path]);
                fs.writeFileSync(path.join(OUTPUT_DIR, 'favicon.ico'), icoBuffer);
                console.log('✨ favicon.ico generated (16px + 32px upscaled).');
            } catch (err) {
                console.error('❌ Failed to generate ico:', err);
            }

        } else {
            console.warn(`⚠️ Manual source not found at ${PIXEL_IMAGE}.`);
        }

        console.log('🎉 All done!');
    } catch (error) {
        console.error(error);
    }
})();