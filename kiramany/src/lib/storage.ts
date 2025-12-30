
import type { Params2D, Params3D } from './math';

const DB_NAME = 'kiramany_db';
const STORE_NAME = 'state_store';
const KEY = 'last_session';

export type AppStateData = {
  layers2D: Params2D[];
  layers3D: Params3D[];
  bgColor: string;
};

// --- IndexedDB ---

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveToDB = async (data: AppStateData) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, KEY);
  } catch (e) {
    console.error('DB Save failed', e);
  }
};

export const loadFromDB = async (): Promise<AppStateData | null> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
};

// --- Share (CompressionStream) ---

export const encodeState = async (data: AppStateData): Promise<string> => {
  try {
    const jsonStr = JSON.stringify(data);
    const stream = new Blob([jsonStr]).stream();
    const compressedReadableStream = stream.pipeThrough(new CompressionStream('gzip'));
    const compressedResponse = await new Response(compressedReadableStream);
    const blob = await compressedResponse.blob();
    const buffer = await blob.arrayBuffer();
    const binaryString = Array.from(new Uint8Array(buffer))
      .map((byte) => String.fromCharCode(byte))
      .join('');
    return btoa(binaryString);
  } catch (e) {
    console.error('Compression failed:', e);
    throw e;
  }
};

export const decodeState = async (base64: string): Promise<AppStateData> => {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const stream = new Blob([bytes]).stream();
    const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
    const response = await new Response(decompressedStream);
    return await response.json();
  } catch (e) {
    console.error('Decompression failed:', e);
    throw e;
  }
};
