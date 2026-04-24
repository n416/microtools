function base64urlEncode(buffer) {
    let bytes;
    if (typeof buffer === "string") {
        bytes = new TextEncoder().encode(buffer);
    }
    else {
        bytes = new Uint8Array(buffer);
    }
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function importPrivateKey(pem) {
    // 環境変数から渡される際のエスケープされた改行を復元
    const normalizedPem = pem.replace(/\\n/g, '\n');
    // 正規表現で BEGIN と END の間にある BASE64 文字列を抽出
    const pemRegex = /-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/;
    const match = normalizedPem.match(pemRegex);
    if (!match) {
        throw new Error("Invalid private key format");
    }
    const pemContents = match[1].replace(/\s/g, '');
    const binaryDerString = atob(pemContents);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
        binaryDer[i] = binaryDerString.charCodeAt(i);
    }
    return await crypto.subtle.importKey("pkcs8", binaryDer.buffer, {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
    }, false, ["sign"]);
}
export async function generateV4UploadSignedUrl(serviceAccountJson, bucketName, objectName, contentType, expiresInSeconds = 900) {
    const sa = JSON.parse(serviceAccountJson);
    const clientEmail = sa.client_email;
    const privateKeyPem = sa.private_key;
    const method = 'PUT';
    const now = new Date();
    // YYYYMMDDTHHMMSSZ format
    const isoString = now.toISOString();
    const datestamp = isoString.substring(0, 10).replace(/-/g, '');
    const timestamp = isoString.replace(/[:-]|\.\d{3}/g, '');
    const scope = `${datestamp}/auto/storage/goog4_request`;
    const host = 'storage.googleapis.com';
    // CanonicalHeaders must be sorted by key
    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
    const signedHeaders = 'content-type;host';
    const canonicalQueryString = [
        `X-Goog-Algorithm=GOOG4-RSA-SHA256`,
        `X-Goog-Credential=${encodeURIComponent(`${clientEmail}/${scope}`)}`,
        `X-Goog-Date=${timestamp}`,
        `X-Goog-Expires=${expiresInSeconds}`,
        `X-Goog-SignedHeaders=${encodeURIComponent(signedHeaders)}`
    ].join('&');
    // URLEncode object path, but keep slashes
    const encodedObjectName = objectName.split('/').map(encodeURIComponent).join('/');
    const canonicalRequest = [
        method,
        `/${encodeURIComponent(bucketName)}/${encodedObjectName}`,
        canonicalQueryString,
        canonicalHeaders,
        signedHeaders,
        'UNSIGNED-PAYLOAD'
    ].join('\n');
    const encoder = new TextEncoder();
    const canonicalRequestHashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(canonicalRequest));
    const canonicalRequestHash = Array.from(new Uint8Array(canonicalRequestHashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    const stringToSign = [
        'GOOG4-RSA-SHA256',
        timestamp,
        scope,
        canonicalRequestHash
    ].join('\n');
    const privateKey = await importPrivateKey(privateKeyPem);
    const signatureBuffer = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, encoder.encode(stringToSign));
    const signatureHex = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    const signedUrl = `https://${host}/${encodeURIComponent(bucketName)}/${encodedObjectName}?${canonicalQueryString}&X-Goog-Signature=${signatureHex}`;
    return signedUrl;
}
