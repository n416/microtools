import * as THREE from 'three';

/**
 * 指定された基本色から、明度を変化させたカラーパレットの行を生成します。
 * (この関数の内容は変更ありません)
 */
export function createColorPalette(baseColors, steps = 5) {
  const fragment = document.createDocumentFragment();

  const generateShades = (colorHex) => {
    const darkShades = [];
    const lightShades = [];
    const color = new THREE.Color(colorHex);
    const hsl = {};
    color.getHSL(hsl);

    for (let i = steps; i >= 1; i--) {
      const newLightness = Math.max(0, hsl.l - (hsl.l / (steps + 1)) * i);
      darkShades.push(new THREE.Color().setHSL(hsl.h, hsl.s, newLightness).getHex());
    }

    for (let i = 1; i <= steps; i++) {
      const newLightness = Math.min(1, hsl.l + ((1 - hsl.l) / (steps + 1)) * i);
      lightShades.push(new THREE.Color().setHSL(hsl.h, hsl.s, newLightness).getHex());
    }
    
    return [...darkShades, color.getHex(), ...lightShades];
  };
  
  baseColors.forEach(hex => {
    const shades = generateShades(hex);
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.marginBottom = '2px';
    
    shades.forEach(shadeHex => {
      const colorBox = document.createElement('div');
      colorBox.style.width = '16px';
      colorBox.style.height = '16px';
      colorBox.style.backgroundColor = `#${new THREE.Color(shadeHex).getHexString()}`;
      colorBox.style.cursor = 'pointer';
      colorBox.style.margin = '1px';
      colorBox.style.border = '1px solid #555';
      colorBox.dataset.color = shadeHex; 
      row.appendChild(colorBox);
    });
    fragment.appendChild(row);
  });

  const grayscaleRow = document.createElement('div');
  grayscaleRow.style.display = 'flex';
  grayscaleRow.style.marginTop = '4px';
  
  for (let i = 0; i <= 10; i++) {
      const grayLevel = i / 10;
      const shadeHex = new THREE.Color(grayLevel, grayLevel, grayLevel).getHex();
      const colorBox = document.createElement('div');
      colorBox.style.width = '16px';
      colorBox.style.height = '16px';
      colorBox.style.backgroundColor = `#${new THREE.Color(shadeHex).getHexString()}`;
      colorBox.style.cursor = 'pointer';
      colorBox.style.margin = '1px';
      colorBox.style.border = '1px solid #555';
      colorBox.dataset.color = shadeHex;
      grayscaleRow.appendChild(colorBox);
  }
  fragment.appendChild(grayscaleRow);

  return fragment;
}