import fs from 'fs';
import path from 'path';

// テストケース: index.htmlが開き、NEKO-KANのタイトルが存在するかを確認
test('index.htmlにNEKO-KANタイトルが存在する', () => {
  // index.htmlを読み込み、DOMに設定
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  document.body.innerHTML = html;

  // タイトルの要素を取得
  const titleElement = document.querySelector('.title');

  // タイトルが存在するか、かつ「NEKO-KAN」であるかを確認
  expect(titleElement).not.toBeNull();  // 要素が存在することを確認
  expect(titleElement.textContent).toBe('NEKO-KAN');  // テキスト内容がNEKO-KANであることを確認
});
