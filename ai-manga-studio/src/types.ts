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

// 演出設定を保存するオブジェクト
export interface DirectorAttributes {
  structure?: 'prequel' | 'bridge' | 'sequel';
  cameraMovements?: string[];
  shotSize?: string;
  angle?: string;
  focus?: string;
  lighting?: string;
  emotion?: string;
}

export interface VideoBlock extends BaseBlock {
  type: 'video';
  prompt: string;         // 生成用プロンプト
  referenceBlockId?: string; 
  assignedAssetId: string | null;
  attributes?: DirectorAttributes; // ★追加: ウィザードの状態保存用
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
  mimeType: string;
  createdAt: number;
}

export interface AssetDBItem {
  id: string;
  blob: Blob;
  category: AssetCategory;
  created: number;
}
