export interface GachaResult {
  themeA: string;
  themeB: string;
  secretIngredient: string;
}

export interface BaseBlock {
  id: string;
  type: 'image' | 'video';
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  pageNumber: number;
  sceneDescription: string;
  dialogue: string;
  imagePrompt: string;
  assignedAssetId: string | null;
}

export interface VideoBlock extends BaseBlock {
  type: 'video';
  prompt: string;         // 生成用プロンプト
  referenceBlockId?: string; // (Optional) 元ネタにする画像のID
  assignedAssetId: string | null; // 動画ファイルID
}

export type StoryBlock = ImageBlock | VideoBlock;

export interface Project {
  id: string;
  title: string;
  coverImagePrompt: string;
  coverAssetId: string | null;
  gachaResult: GachaResult;
  synopsis: string;
  storyboard: StoryBlock[];
  editorNote: string;
  createdAt: number;
  updatedAt: number;
}

export type AssetCategory = 'material' | 'generated';

export interface Asset {
  id: string;
  url: string;
  category: AssetCategory;
  mimeType: string; // ★追加: 動画か画像か判別するため
  createdAt: number;
}

export interface AssetDBItem {
  id: string;
  blob: Blob;
  category: AssetCategory;
  created: number;
}
