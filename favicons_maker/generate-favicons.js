const favicons = require('favicons').default;
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

// --- 設定 ---
// プロジェクトルートから実行することを前提としたパス設定
const SOURCE_IMAGE = 'src/logo-300px.png';
const PIXEL_IMAGE = 'src/icon-16px.png';
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
        android: true,       // Androidは必須
        appleIcon: true,     // iOSも必須（だがあとで間引く）
        appleStartup: false, // 起動画面は不要
        favicons: true,      // PC用必須
        windows: false,      // タイルは不要
        yandex: false
    }
};

(async () => {
    try {
        console.log('🏗️  Favicon generation started...');

        // 1. 全量生成
        const response = await favicons(SOURCE_IMAGE, configuration);

        if (!fs.existsSync(OUTPUT_DIR)){
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        // 2. 画像ファイルの書き出し（フィルタリング付き）
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

        // 4. 手打ち画像の適用処理
        if (fs.existsSync(PIXEL_IMAGE)) {
            const pixelImageBuffer = fs.readFileSync(PIXEL_IMAGE);
            const icoBuffer = await toIco([pixelImageBuffer], { resize: false });
            
            fs.writeFileSync(path.join(OUTPUT_DIR, 'favicon.ico'), icoBuffer);
            console.log('✨ favicon.ico overwritten with manual source.');

            fs.copyFileSync(PIXEL_IMAGE, path.join(OUTPUT_DIR, 'favicon-16x16.png'));
            console.log('✨ favicon-16x16.png overwritten.');
        } else {
            console.warn(`⚠️ Manual source not found at ${PIXEL_IMAGE}.`);
        }

        console.log('🎉 All done!');
    } catch (error) {
        console.error(error);
    }
})();