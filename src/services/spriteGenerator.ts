import type { IconItem, SpriteConfig, SpriteResult, IconPosition } from '../types';

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function sanitizeName(name: string): string {
  return name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function isSvgDataUrl(dataUrl: string): boolean {
  return dataUrl.startsWith('data:image/svg+xml');
}

function svgDataUrlToXml(dataUrl: string): string {
  if (dataUrl.startsWith('data:image/svg+xml;base64,')) {
    const base64 = dataUrl.slice('data:image/svg+xml;base64,'.length);
    try {
      return atob(base64);
    } catch {
      return '';
    }
  }
  if (dataUrl.startsWith('data:image/svg+xml,')) {
    const encoded = dataUrl.slice('data:image/svg+xml,'.length);
    try {
      return decodeURIComponent(encoded);
    } catch {
      return '';
    }
  }
  if (dataUrl.startsWith('data:image/svg+xml;utf8,')) {
    const encoded = dataUrl.slice('data:image/svg+xml;utf8,'.length);
    try {
      return decodeURIComponent(encoded);
    } catch {
      return '';
    }
  }
  return '';
}

function extractSvgViewBox(svgXml: string): string | null {
  const viewBoxMatch = svgXml.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (viewBoxMatch) return viewBoxMatch[1];
  const widthMatch = svgXml.match(/<svg[^>]*\bwidth\s*=\s*["']([\d.]+)(px)?["']/i);
  const heightMatch = svgXml.match(/<svg[^>]*\bheight\s*=\s*["']([\d.]+)(px)?["']/i);
  if (widthMatch && heightMatch) {
    return `0 0 ${parseFloat(widthMatch[1])} ${parseFloat(heightMatch[1])}`;
  }
  return null;
}

function extractSvgContent(svgXml: string): string {
  const contentMatch = svgXml.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  if (contentMatch) {
    return contentMatch[1].trim();
  }
  return svgXml;
}

function buildSymbolFromSvg(icon: IconItem, sanitizedName: string): string {
  const xml = svgDataUrlToXml(icon.dataUrl);
  if (!xml) {
    return buildSymbolFromRaster(icon, sanitizedName);
  }
  const viewBox = extractSvgViewBox(xml) || `0 0 ${icon.width} ${icon.height}`;
  const content = extractSvgContent(xml);
  const symbolId = `icon-${sanitizedName}`;
  return `  <symbol id="${symbolId}" viewBox="${viewBox}">\n${content}\n  </symbol>`;
}

function buildSymbolFromRaster(icon: IconItem, sanitizedName: string): string {
  const symbolId = `icon-${sanitizedName}`;
  return `  <symbol id="${symbolId}" viewBox="0 0 ${icon.width} ${icon.height}">
    <image width="${icon.width}" height="${icon.height}" href="${icon.dataUrl}" />
  </symbol>`;
}

function buildSvgSprite(icons: IconItem[]): string {
  const symbols = icons.map((icon) => {
    const name = sanitizeName(icon.name);
    if (isSvgDataUrl(icon.dataUrl)) {
      return buildSymbolFromSvg(icon, name);
    }
    return buildSymbolFromRaster(icon, name);
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
${symbols.join('\n')}
  </defs>
</svg>\n`;
}

function generatePNGModeCSS(
  positions: IconPosition[],
  prefix: string,
  totalWidth: number,
  totalHeight: number,
  cellWidth: number,
  cellHeight: number,
  retina: boolean
): string {
  const scale = retina ? 2 : 1;
  const displayWidth = Math.round(totalWidth / scale);
  const displayHeight = Math.round(totalHeight / scale);
  const displayCellW = Math.round(cellWidth / scale);
  const displayCellH = Math.round(cellHeight / scale);

  let css = `.${prefix} {
  display: inline-block;
  background-image: url('sprite.png');
  background-repeat: no-repeat;
  background-size: ${displayWidth}px ${displayHeight}px;
  width: ${displayCellW}px;
  height: ${displayCellH}px;
}

`;

  positions.forEach((pos) => {
    const x = Math.round(pos.x / scale);
    const y = Math.round(pos.y / scale);
    css += `.${prefix}-${pos.name} {
  background-position: -${x}px -${y}px;
  width: ${Math.round(pos.width / scale)}px;
  height: ${Math.round(pos.height / scale)}px;
}

`;
  });

  return css.trimEnd() + '\n';
}

function generatePNGModeSCSS(
  positions: IconPosition[],
  prefix: string,
  totalWidth: number,
  totalHeight: number,
  cellWidth: number,
  cellHeight: number,
  retina: boolean
): string {
  const scale = retina ? 2 : 1;
  const displayWidth = Math.round(totalWidth / scale);
  const displayHeight = Math.round(totalHeight / scale);
  const displayCellW = Math.round(cellWidth / scale);
  const displayCellH = Math.round(cellHeight / scale);

  let scss = `$sprite-url: 'sprite.png';
$sprite-width: ${displayWidth}px;
$sprite-height: ${displayHeight}px;
$sprite-cell-w: ${displayCellW}px;
$sprite-cell-h: ${displayCellH}px;

@mixin sprite {
  display: inline-block;
  background-image: url($sprite-url);
  background-repeat: no-repeat;
  background-size: $sprite-width $sprite-height;
  width: $sprite-cell-w;
  height: $sprite-cell-h;
}

.${prefix} {
  @include sprite;
}

`;

  positions.forEach((pos) => {
    const x = Math.round(pos.x / scale);
    const y = Math.round(pos.y / scale);
    const w = Math.round(pos.width / scale);
    const h = Math.round(pos.height / scale);
    scss += `@mixin sprite-${pos.name} {
  @include sprite;
  background-position: -${x}px -${y}px;
  width: ${w}px;
  height: ${h}px;
}

.${prefix}-${pos.name} {
  @include sprite-${pos.name};
}

`;
  });

  return scss.trimEnd() + '\n';
}

function generateSVGModeCSS(
  positions: IconPosition[],
  prefix: string
): string {
  let css = `.${prefix} {
  display: inline-block;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
  background-color: currentColor;
}

`;

  positions.forEach((pos) => {
    css += `.${prefix}-${pos.name} {
  -webkit-mask-image: url('sprite.svg#icon-${pos.name}');
  mask-image: url('sprite.svg#icon-${pos.name}');
  width: ${pos.width}px;
  height: ${pos.height}px;
}

`;
  });

  return css.trimEnd() + '\n';
}

function generateSVGModeSCSS(
  positions: IconPosition[],
  prefix: string
): string {
  let scss = `$sprite-svg-url: 'sprite.svg';

@mixin svg-sprite {
  display: inline-block;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
  background-color: currentColor;
}

@mixin svg-sprite-icon($name, $width, $height) {
  @include svg-sprite;
  -webkit-mask-image: url('#{$sprite-svg-url}##{$name}');
  mask-image: url('#{$sprite-svg-url}##{$name}');
  width: $width;
  height: $height;
}

.${prefix} {
  @include svg-sprite;
}

`;

  positions.forEach((pos) => {
    scss += `@mixin sprite-${pos.name} {
  @include svg-sprite-icon('icon-${pos.name}', ${pos.width}px, ${pos.height}px);
}

.${prefix}-${pos.name} {
  @include sprite-${pos.name};
}

`;
  });

  return scss.trimEnd() + '\n';
}

function generateBothModeCSS(
  positions: IconPosition[],
  prefix: string,
  totalWidth: number,
  totalHeight: number,
  cellWidth: number,
  cellHeight: number,
  retina: boolean
): string {
  const scale = retina ? 2 : 1;
  const displayWidth = Math.round(totalWidth / scale);
  const displayHeight = Math.round(totalHeight / scale);
  const displayCellW = Math.round(cellWidth / scale);
  const displayCellH = Math.round(cellHeight / scale);

  let css = `/* PNG Sprite Mode - default fallback */
.${prefix} {
  display: inline-block;
  background-image: url('sprite.png');
  background-repeat: no-repeat;
  background-size: ${displayWidth}px ${displayHeight}px;
  width: ${displayCellW}px;
  height: ${displayCellH}px;
}

/* SVG Sprite Mode - add .svg class to <html> to enable */
.svg .${prefix} {
  background-image: none;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
  background-color: currentColor;
}

`;

  positions.forEach((pos) => {
    const x = Math.round(pos.x / scale);
    const y = Math.round(pos.y / scale);
    css += `.${prefix}-${pos.name} {
  background-position: -${x}px -${y}px;
  width: ${Math.round(pos.width / scale)}px;
  height: ${Math.round(pos.height / scale)}px;
}

.svg .${prefix}-${pos.name} {
  -webkit-mask-image: url('sprite.svg#icon-${pos.name}');
  mask-image: url('sprite.svg#icon-${pos.name}');
  background-position: 0 0;
}

`;
  });

  return css.trimEnd() + '\n';
}

function generateBothModeSCSS(
  positions: IconPosition[],
  prefix: string,
  totalWidth: number,
  totalHeight: number,
  cellWidth: number,
  cellHeight: number,
  retina: boolean
): string {
  const scale = retina ? 2 : 1;
  const displayWidth = Math.round(totalWidth / scale);
  const displayHeight = Math.round(totalHeight / scale);
  const displayCellW = Math.round(cellWidth / scale);
  const displayCellH = Math.round(cellHeight / scale);

  let scss = `$sprite-png-url: 'sprite.png';
$sprite-svg-url: 'sprite.svg';
$sprite-width: ${displayWidth}px;
$sprite-height: ${displayHeight}px;
$sprite-cell-w: ${displayCellW}px;
$sprite-cell-h: ${displayCellH}px;

@mixin sprite-png {
  display: inline-block;
  background-image: url($sprite-png-url);
  background-repeat: no-repeat;
  background-size: $sprite-width $sprite-height;
  width: $sprite-cell-w;
  height: $sprite-cell-h;
}

@mixin sprite-svg {
  background-image: none;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
  background-color: currentColor;
}

@mixin sprite {
  @include sprite-png;
  .svg & {
    @include sprite-svg;
  }
}

.${prefix} {
  @include sprite;
}

`;

  positions.forEach((pos) => {
    const x = Math.round(pos.x / scale);
    const y = Math.round(pos.y / scale);
    const w = Math.round(pos.width / scale);
    const h = Math.round(pos.height / scale);
    scss += `@mixin sprite-${pos.name} {
  @include sprite;
  background-position: -${x}px -${y}px;
  width: ${w}px;
  height: ${h}px;
  .svg & {
    -webkit-mask-image: url('#{$sprite-svg-url}#icon-${pos.name}');
    mask-image: url('#{$sprite-svg-url}#icon-${pos.name}');
    background-position: 0 0;
  }
}

.${prefix}-${pos.name} {
  @include sprite-${pos.name};
}

`;
  });

  return scss.trimEnd() + '\n';
}

export async function generateSprite(
  icons: IconItem[],
  config: SpriteConfig
): Promise<SpriteResult> {
  if (icons.length === 0) {
    return {
      imageDataUrl: '',
      svgSpriteContent: '',
      cssCode: '',
      scssCode: '',
      iconPositions: [],
      totalWidth: 0,
      totalHeight: 0,
      cellWidth: 0,
      cellHeight: 0,
    };
  }

  const { columns, spacing, bgColor, classPrefix, retina, outputFormat } = config;
  const scale = retina ? 2 : 1;
  const actualSpacing = spacing * scale;

  const loadedImages = await Promise.all(
    icons.map((icon) => loadImage(icon.dataUrl))
  );

  const cellWidth = Math.max(...loadedImages.map((img) => img.width)) * scale;
  const cellHeight = Math.max(...loadedImages.map((img) => img.height)) * scale;

  const numCols = Math.min(columns, icons.length);
  const numRows = Math.ceil(icons.length / numCols);

  const totalWidth = numCols * cellWidth + (numCols + 1) * actualSpacing;
  const totalHeight = numRows * cellHeight + (numRows + 1) * actualSpacing;

  let imageDataUrl = '';

  if (outputFormat === 'png' || outputFormat === 'both') {
    const canvas = document.createElement('canvas');
    canvas.width = totalWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d')!;

    if (bgColor && bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, totalWidth, totalHeight);
    }

    icons.forEach((icon, index) => {
      const row = Math.floor(index / numCols);
      const col = index % numCols;
      const img = loadedImages[index];

      const x = actualSpacing + col * (cellWidth + actualSpacing);
      const y = actualSpacing + row * (cellHeight + actualSpacing);

      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      const offsetX = (cellWidth - drawWidth) / 2;
      const offsetY = (cellHeight - drawHeight) / 2;

      ctx.drawImage(img, x + offsetX, y + offsetY, drawWidth, drawHeight);
    });

    imageDataUrl = canvas.toDataURL('image/png');
  }

  const iconPositions: IconPosition[] = icons.map((icon, index) => {
    const row = Math.floor(index / numCols);
    const col = index % numCols;
    const img = loadedImages[index];

    const x = actualSpacing + col * (cellWidth + actualSpacing);
    const y = actualSpacing + row * (cellHeight + actualSpacing);

    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    const offsetX = (cellWidth - drawWidth) / 2;
    const offsetY = (cellHeight - drawHeight) / 2;

    return {
      id: icon.id,
      name: sanitizeName(icon.name),
      x: x + offsetX,
      y: y + offsetY,
      width: drawWidth,
      height: drawHeight,
    };
  });

  let svgSpriteContent = '';
  if (outputFormat === 'svg' || outputFormat === 'both') {
    svgSpriteContent = buildSvgSprite(icons);
  }

  let cssCode: string;
  let scssCode: string;

  if (outputFormat === 'svg') {
    cssCode = generateSVGModeCSS(iconPositions, classPrefix);
    scssCode = generateSVGModeSCSS(iconPositions, classPrefix);
  } else if (outputFormat === 'both') {
    cssCode = generateBothModeCSS(
      iconPositions, classPrefix, totalWidth, totalHeight, cellWidth, cellHeight, retina
    );
    scssCode = generateBothModeSCSS(
      iconPositions, classPrefix, totalWidth, totalHeight, cellWidth, cellHeight, retina
    );
  } else {
    cssCode = generatePNGModeCSS(
      iconPositions, classPrefix, totalWidth, totalHeight, cellWidth, cellHeight, retina
    );
    scssCode = generatePNGModeSCSS(
      iconPositions, classPrefix, totalWidth, totalHeight, cellWidth, cellHeight, retina
    );
  }

  return {
    imageDataUrl,
    svgSpriteContent,
    cssCode,
    scssCode,
    iconPositions,
    totalWidth,
    totalHeight,
    cellWidth,
    cellHeight,
  };
}
