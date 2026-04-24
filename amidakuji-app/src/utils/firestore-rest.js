// src/utils/firestore-rest.ts
function base64urlEncode(source) {
    let uint8Array;
    if (typeof source === 'string') {
        const encoder = new TextEncoder();
        uint8Array = encoder.encode(source);
    }
    else if (source instanceof ArrayBuffer) {
        uint8Array = new Uint8Array(source);
    }
    else {
        uint8Array = source;
    }
    let base64 = btoa(String.fromCharCode(...uint8Array));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function importPrivateKey(pem) {
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    let pemContents = pem.substring(pem.indexOf(pemHeader) + pemHeader.length, pem.indexOf(pemFooter));
    pemContents = pemContents.replace(/\s/g, '');
    const binaryDerString = atob(pemContents);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
        binaryDer[i] = binaryDerString.charCodeAt(i);
    }
    return await crypto.subtle.importKey("pkcs8", binaryDer.buffer, {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
    }, true, ["sign"]);
}
async function getAccessToken(serviceAccountJsonStr) {
    const sa = JSON.parse(serviceAccountJsonStr);
    const privateKey = await importPrivateKey(sa.private_key);
    const header = {
        alg: "RS256",
        typ: "JWT"
    };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/datastore",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now
    };
    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify(payload));
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    const encoder = new TextEncoder();
    const signatureBuffer = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, encoder.encode(unsignedToken));
    const signature = base64urlEncode(signatureBuffer);
    const jwt = `${unsignedToken}.${signature}`;
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt
        })
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get access token: ${errorText}`);
    }
    const data = await response.json();
    return data.access_token;
}
export class FirestoreClient {
    serviceAccountJsonStr;
    projectId;
    accessToken = null;
    tokenExp = 0;
    constructor(serviceAccountJsonStr) {
        this.serviceAccountJsonStr = serviceAccountJsonStr;
        const sa = JSON.parse(serviceAccountJsonStr);
        this.projectId = sa.project_id;
    }
    async getToken() {
        const now = Math.floor(Date.now() / 1000);
        if (!this.accessToken || now > this.tokenExp) {
            this.accessToken = await getAccessToken(this.serviceAccountJsonStr);
            this.tokenExp = now + 3500; // 有効期限(3600s)の少し前に更新
        }
        return this.accessToken;
    }
    getBaseUrl() {
        return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents`;
    }
    async getDocument(path) {
        const token = await this.getToken();
        const url = `${this.getBaseUrl()}/${path}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 404)
            return null;
        if (!res.ok)
            throw new Error(`Firestore GET failed: ${await res.text()}`);
        return res.json();
    }
    async createDocument(collectionPath, documentId, data) {
        const token = await this.getToken();
        const url = `${this.getBaseUrl()}/${collectionPath}?documentId=${documentId}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.jsonToFirestore(data))
        });
        if (!res.ok)
            throw new Error(`Firestore POST failed: ${await res.text()}`);
        return res.json();
    }
    async patchDocument(path, rawData, updateMask) {
        const token = await this.getToken();
        let url = `${this.getBaseUrl()}/${path}`;
        // undefinedな値を削除してクリーンなデータにする
        const data = this.removeUndefined(rawData);
        // updateMask が未指定の場合は、クリーンアップされたデータの最上位キーから自動生成する
        const mask = updateMask && updateMask.length > 0 ? updateMask : Object.keys(data);
        if (mask && mask.length > 0) {
            const queryParams = mask.map(m => `updateMask.fieldPaths=${encodeURIComponent(m)}`).join('&');
            url += `?${queryParams}`;
        }
        const res = await fetch(url, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.jsonToFirestore(data))
        });
        if (!res.ok)
            throw new Error(`Firestore PATCH failed: ${await res.text()}`);
        return res.json();
    }
    async deleteDocument(path) {
        const token = await this.getToken();
        const url = `${this.getBaseUrl()}/${path}`;
        const res = await fetch(url, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok)
            throw new Error(`Firestore DELETE failed: ${await res.text()}`);
        return res.json();
    }
    // 複雑なクエリは runQuery で実行
    async runQuery(parentPath, structuredQuery) {
        const token = await this.getToken();
        const url = parentPath ? `${this.getBaseUrl()}/${parentPath}:runQuery` : `${this.getBaseUrl()}:runQuery`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ structuredQuery })
        });
        if (!res.ok)
            throw new Error(`Firestore runQuery failed: ${await res.text()}`);
        return res.json();
    }
    // JSON <-> Firestore フォーマット変換ヘルパー
    // （Firestore REST APIは {"fields": {"name": {"stringValue": "taro"}}} のような形式を要求する）
    jsonToFirestore(obj) {
        if (typeof obj !== 'object' || obj === null)
            return obj;
        const fields = {};
        for (const [k, v] of Object.entries(obj)) {
            fields[k] = this.toFirestoreValue(v);
        }
        return { fields };
    }
    toFirestoreValue(val) {
        if (val === null)
            return { nullValue: null };
        if (typeof val === 'string')
            return { stringValue: val };
        if (typeof val === 'boolean')
            return { booleanValue: val };
        if (typeof val === 'number') {
            if (Number.isInteger(val))
                return { integerValue: val.toString() };
            return { doubleValue: val };
        }
        if (val instanceof Date)
            return { timestampValue: val.toISOString() };
        if (Array.isArray(val))
            return { arrayValue: { values: val.map(v => this.toFirestoreValue(v)) } };
        if (typeof val === 'object')
            return { mapValue: { fields: this.jsonToFirestore(val).fields } };
        return { nullValue: null };
    }
    firestoreToJson(doc) {
        if (!doc || !doc.fields)
            return null;
        const obj = {};
        for (const [k, v] of Object.entries(doc.fields)) {
            obj[k] = this.fromFirestoreValue(v);
        }
        // doc.name には 'projects/.../documents/col/id' が入る
        return obj;
    }
    fromFirestoreValue(val) {
        if (!val)
            return null;
        if ('stringValue' in val)
            return val.stringValue;
        if ('integerValue' in val)
            return parseInt(val.integerValue, 10);
        if ('doubleValue' in val)
            return val.doubleValue;
        if ('booleanValue' in val)
            return val.booleanValue;
        if ('nullValue' in val)
            return null;
        if ('timestampValue' in val)
            return new Date(val.timestampValue);
        if ('arrayValue' in val) {
            return (val.arrayValue.values || []).map((v) => this.fromFirestoreValue(v));
        }
        if ('mapValue' in val) {
            return this.firestoreToJson(val.mapValue);
        }
        return null;
    }
    removeUndefined(obj) {
        if (Array.isArray(obj)) {
            return obj.map(item => this.removeUndefined(item)).filter(item => item !== undefined);
        }
        else if (obj !== null && typeof obj === 'object') {
            const newObj = {};
            for (const key in obj) {
                if (obj[key] !== undefined) {
                    newObj[key] = this.removeUndefined(obj[key]);
                }
            }
            return newObj;
        }
        return obj;
    }
}
