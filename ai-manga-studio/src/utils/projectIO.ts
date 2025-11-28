import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Project, Asset } from '../types';
import type { AppDispatch } from '../app/store';
import { addAsset } from '../features/assets/assetSlice';
import { createOrUpdateProject, setCurrentProject } from '../features/projects/projectSlice';
import { v4 as uuidv4 } from 'uuid';

/**
 * プロジェクトと使用画像をZIPにまとめてエクスポート
 */
export const exportProjectToZip = async (project: Project, assets: Asset[]) => {
  const zip = new JSZip();
  
  // 1. プロジェクトデータをJSONとして追加
  zip.file('project.json', JSON.stringify(project, null, 2));

  // 2. 使用されているアセットIDを収集
  const usedIds = new Set<string>();
  if (project.coverAssetId) usedIds.add(project.coverAssetId);
  project.pages.forEach(p => {
    if (p.assignedAssetId) usedIds.add(p.assignedAssetId);
  });

  // 3. 画像ファイルを追加
  const assetsFolder = zip.folder('assets');
  if (assetsFolder) {
    for (const id of usedIds) {
      const asset = assets.find(a => a.id === id);
      if (asset) {
        try {
          // URLからBlobを取得してZIPに追加
          const res = await fetch(asset.url);
          const blob = await res.blob();
          // 拡張子の推定 (簡易的)
          const ext = blob.type.split('/')[1] || 'png';
          assetsFolder.file(`${id}.${ext}`, blob);
        } catch (e) {
          console.error(`Failed to export asset ${id}`, e);
        }
      }
    }
  }

  // 4. ZIP生成とダウンロード
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `${project.title}.zip`);
};

/**
 * ZIPファイルからプロジェクトを復元
 */
export const importProjectFromZip = async (file: File, dispatch: AppDispatch) => {
  const zip = await JSZip.loadAsync(file);
  
  // 1. project.json を読む
  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error('project.json が見つかりません (無効なファイルです)');
  
  const projectJson = await projectFile.async('string');
  const projectData: Project = JSON.parse(projectJson);
  
  // 2. 画像を復元し、IDのマッピングを作成 (旧ID -> 新ID)
  const idMap = new Map<string, string>();
  const assetsFolder = zip.folder('assets');
  
  if (assetsFolder) {
    // フォルダ内のファイルを走査
    const entries: Array<{ name: string, fileObj: JSZip.JSZipObject }> = [];
    assetsFolder.forEach((relativePath, fileObj) => {
      entries.push({ name: relativePath, fileObj });
    });

    for (const entry of entries) {
      // ファイル名 (oldId.ext) から旧IDを取得
      const oldId = entry.name.split('.')[0];
      
      const blob = await entry.fileObj.async('blob');
      // Fileオブジェクト化
      const imageFile = new File([blob], entry.name, { type: blob.type });
      
      // Reduxアクションでアップロード（新規IDが発行される）
      // ※インポートした画像はとりあえず 'material' に入れます
      const resultAction = await dispatch(addAsset({ file: imageFile, category: 'material' }));
      
      if (addAsset.fulfilled.match(resultAction)) {
        const newId = resultAction.payload.id;
        idMap.set(oldId, newId);
      }
    }
  }

  // 3. プロジェクトデータのIDを新しいものに書き換え
  const newProject: Project = {
    ...projectData,
    id: uuidv4(), // プロジェクトIDも一新して「コピー」として扱う
    title: projectData.title + " (Imported)",
    coverAssetId: projectData.coverAssetId ? (idMap.get(projectData.coverAssetId) || null) : null,
    pages: projectData.pages.map(p => ({
      ...p,
      assignedAssetId: p.assignedAssetId ? (idMap.get(p.assignedAssetId) || null) : null
    })),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // 4. 保存して開く
  await dispatch(createOrUpdateProject(newProject));
  dispatch(setCurrentProject(newProject));
  
  return newProject;
};