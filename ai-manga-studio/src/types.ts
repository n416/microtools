export interface GachaResult {
  themeA: string;
  themeB: string;
  secretIngredient: string;
}

export interface Page {
  pageNumber: number;
  sceneDescription: string;
  dialogue: string;
  imagePrompt: string;
  assignedAssetId: string | null; // 画像ID
}

export interface Project {
  id: string;
  title: string;
  coverImagePrompt: string;
  coverAssetId: string | null;
  gachaResult: GachaResult;
  synopsis: string;
  pages: Page[];
  editorNote: string;
  createdAt: number;
  updatedAt: number;
}

export type AssetCategory = 'material' | 'generated';

export interface Asset {
  id: string;
  url: string; // ReduxではBlobではなくURL文字列を保持
  category: AssetCategory;
  createdAt: number;
}

// DB保存用の型（ReduxにはBlobを入れられないため分離）
export interface AssetDBItem {
  id: string;
  blob: Blob;
  category: AssetCategory;
  created: number;
}