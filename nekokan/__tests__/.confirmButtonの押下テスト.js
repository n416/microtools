import fs from 'fs';
import path from 'path';
import { initializeEventListeners } from '../events.js'; // 必要に応じてパスを変更

test('confirmButtonを押下すると、ボタンや画面が正しく切り替わる', () => {
  // index.htmlを読み込み、DOMに設定
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  document.body.innerHTML = html;

  // DOMに要素が正しく存在するか確認
  const timePickerModalCloseButton = document.getElementById('timePickerModalCloseButton');
  if (!timePickerModalCloseButton) {
    console.error('timePickerModalCloseButtonが見つかりません');
  } else {
    console.log('timePickerModalCloseButtonが見つかりました');
  }

  // DOMが正しく設定された後にイベントリスナーを初期化
  initializeEventListeners();

  // confirmButtonを取得
  const confirmButton = document.getElementById('confirmButton');
  const backButton = document.getElementById('backButton');
  const logScreen = document.getElementById('logScreen');

  // 初期状態を確認
  expect(confirmButton.style.display).not.toBe('none');  // confirmButtonは表示されている
  expect(backButton.style.display).toBe('none');  // backButtonは非表示
  expect(logScreen.style.display).toBe('none');  // logScreenは非表示

  // confirmButtonをクリック
  confirmButton.click();

  // confirmButtonが非表示になることを確認
  expect(confirmButton.style.display).toBe('none');

  // backButtonが表示されることを確認
  expect(backButton.style.display).toBe('block');

  // logScreenが表示されることを確認
  expect(logScreen.style.display).toBe('flex');
});
