// Utility for compressing/decompressing JSON data for URL sharing
// Uses the browser's native CompressionStream API (Gzip)

export const compressToEncodedStr = async (data: any): Promise<string> => {
  try {
    const jsonString = JSON.stringify(data);
    
    // 1. Gzip圧縮
    const stream = new Blob([jsonString]).stream().pipeThrough(new CompressionStream('gzip'));
    const compressedBuffer = await new Response(stream).arrayBuffer();
    
    // 2. バッファをバイナリ文字列に変換
    const bytes = new Uint8Array(compressedBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    // 3. Base64エンコード
    return btoa(binary);
  } catch (e) {
    console.error('Compression failed:', e);
    throw e;
  }
};

export const decompressFromEncodedStr = async (base64: string): Promise<any> => {
  try {
    // 1. Base64デコード
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    // 2. Gzip解凍
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    // Response.json() で直接オブジェクトに戻す
    const data = await new Response(stream).json();
    
    return data;
  } catch (e) {
    console.error('Decompression failed:', e);
    throw e;
  }
};