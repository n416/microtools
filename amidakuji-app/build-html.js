const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, 'views');
const publicDir = path.join(__dirname, 'public');
const indexPath = path.join(viewsDir, 'index.ejs');

function renderEjs(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. include の展開
    content = content.replace(/<%-?\s*include\(['"]([^'"]+)['"]\)\s*%>/g, (match, includePath) => {
        const fullPath = path.join(path.dirname(filePath), includePath);
        return renderEjs(fullPath);
    });

    // 2. if文の削除 (特定のエラー表示用ブロックなど)
    // 完全に安全に消すのは難しいですが、基本的には <% if (...) { %> から <% } %> までを削除、
    // または EJS タグ自体を取り除きます。
    // ここでは、SPA用に EJSタグ (<% ... %> や <%= ... %>) を空文字やデフォルト値に置換します。

    // OGP関連 (デフォルト値に置換)
    content = content.replace(/<%= \(typeof ogpData !== 'undefined' && ogpData\.title\) \? ogpData\.title : '([^']+)' %>/g, '$1');
    content = content.replace(/<%= \(typeof ogpData !== 'undefined' && ogpData\.description\) \? ogpData\.description : '([^']+)' %>/g, '$1');
    content = content.replace(/<%= \(typeof ogpData !== 'undefined' && ogpData\.imageUrl\) \? ogpData\.imageUrl : '([^']+)' %>/g, '$1');

    // noIndex
    content = content.replace(/<% if \(typeof noIndex !== 'undefined' && noIndex\) { %>([\s\S]*?)<% } %>/g, '');

    // appVersion (キャッシュバスティング用) -> 'v1.0' などの固定値か、削除
    content = content.replace(/<%= appVersion(\s*)%>/g, 'v1.0.0');

    // エラーブロック (サーバーサイドレンダリング時のエラー用なので削除)
    content = content.replace(/<% if \(typeof error !== 'undefined' && error\) { %>([\s\S]*?)<% } %>/g, '');

    // impersonation banner
    content = content.replace(/<% if \(typeof user !== 'undefined' && user && user\.isImpersonating\) { %>([\s\S]*?)<% } %>/g, '');

    // header home url
    content = content.replace(/<%\s*let homeUrl = "\/";\s*if \(typeof user !== 'undefined' && user && user\.id\) {[\s\S]*?} else {[\s\S]*?}\s*}/g, '');
    content = content.replace(/<%= homeUrl %>/g, '/'); // デフォルトはルートへ

    // emojiToLucide の呼び出し
    content = content.replace(/<%= emojiToLucide\('([^']+)'\) %>/g, '$1'); // そのまま文字にして後でJSで処理するか、Lucideアイコン名に手動置換

    // user role check for system admin
    content = content.replace(/<% if \(typeof user !== 'undefined' && user && user\.role === 'system_admin' && !user\.isImpersonating\) { %>([\s\S]*?)<% } %>/g, '$1'); // SPA側でJSで非表示にするのでDOMは残す

    // script data injection
    content = content.replace(/<%- typeof firebaseConfigJSON !== "undefined" \? firebaseConfigJSON : "{}" %>/g, '{}');
    content = content.replace(/<%- \(typeof emojiMapJSON !== 'undefined' && emojiMapJSON\) \? emojiMapJSON : '\[\]' %>/g, '[]');
    content = content.replace(/<%- \(typeof groupData !== 'undefined' && groupData\) \? groupData : 'null' %>/g, 'null');
    content = content.replace(/<%- \(typeof eventData !== 'undefined' && eventData\) \? eventData : 'null' %>/g, 'null');

    // remove inline firebase initialization script that causes errors in SPA
    content = content.replace(/<script>\s*\/\/\s*Your web app's Firebase configuration[\s\S]*?firebase\.initializeApp\(firebaseConfig\);\s*<\/script>/g, '');

    // remove old inline data assignment script
    content = content.replace(/<script>\s*window\.emojiMapData = JSON\.parse[\s\S]*?const initialEventData = JSON\.parse[\s\S]*?<\/script>/g, '');

    // 残った <%- ... %> を削除
    content = content.replace(/<%-[\s\S]*?%>/g, '');

    // 残った <% ... %> を削除
    content = content.replace(/<%[\s\S]*?%>/g, '');

    return content;
}

try {
    const finalHtml = renderEjs(indexPath);
    fs.writeFileSync(path.join(publicDir, 'index.html'), finalHtml, 'utf8');
    console.log('Successfully generated public/index.html');
} catch (error) {
    console.error('Error generating HTML:', error);
}
