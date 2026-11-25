// src/image-processor.js

/**
 * Fetch the ORIGINAL bytes of a media source as a data URL.
 *
 * No canvas, no re-encode: the returned data URL carries the exact bytes the
 * browser fetched, so pptxgenjs `addImage({data})` / `addMedia({data})` embed
 * the source file byte-identically. (A canvas re-rasterization is always a
 * NEW file — however it looks — and breaks byte-exact round-trip fidelity.)
 *
 * Requires fetch() to reach the source: on file:// pages that means the
 * browser must run with --allow-file-access-from-files (node-exporter.js
 * already launches Chromium with it for exactly this kind of local fetch).
 *
 * @param {string} src source URL (relative or absolute)
 * @returns {Promise<string|null>} data URL, or null when the fetch fails
 */
export async function fetchOriginalDataUrl(src) {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Rendered sub-rect (px, relative to the element's border box) that an image
 * with `objectFit` / `objectPosition` occupies — the same math
 * getProcessedImage applies inside its canvas, exposed as pure geometry so a
 * byte-exact embed can position the ORIGINAL file at the right rect instead
 * of rasterizing it there. `naturalW/H` unknown (0) degrades to 'fill'.
 */
export function getObjectFitRect(boxW, boxH, naturalW, naturalH, objectFit = 'fill', objectPosition = '50% 50%') {
  if (!naturalW || !naturalH || !boxW || !boxH) return { x: 0, y: 0, w: boxW, h: boxH };
  const wRatio = boxW / naturalW;
  const hRatio = boxH / naturalH;
  let renderW, renderH;
  if (objectFit === 'contain') {
    const fitScale = Math.min(wRatio, hRatio);
    renderW = naturalW * fitScale;
    renderH = naturalH * fitScale;
  } else if (objectFit === 'cover') {
    const coverScale = Math.max(wRatio, hRatio);
    renderW = naturalW * coverScale;
    renderH = naturalH * coverScale;
  } else if (objectFit === 'none') {
    renderW = naturalW;
    renderH = naturalH;
  } else if (objectFit === 'scale-down') {
    const scaleDown = Math.min(1, Math.min(wRatio, hRatio));
    renderW = naturalW * scaleDown;
    renderH = naturalH * scaleDown;
  } else {
    // 'fill' (default): the whole box, distortion and all — same as the browser
    return { x: 0, y: 0, w: boxW, h: boxH };
  }
  let posX = 0.5;
  let posY = 0.5;
  const posParts = String(objectPosition).split(' ');
  if (posParts.length > 0) {
    const parsePos = (val) => {
      if (val === 'left' || val === 'top') return 0;
      if (val === 'center') return 0.5;
      if (val === 'right' || val === 'bottom') return 1;
      if (val.includes('%')) return parseFloat(val) / 100;
      return 0.5;
    };
    posX = parsePos(posParts[0]);
    posY = posParts.length > 1 ? parsePos(posParts[1]) : 0.5;
  }
  return {
    x: (boxW - renderW) * posX,
    y: (boxH - renderH) * posY,
    w: renderW,
    h: renderH,
  };
}

export async function getProcessedImage(src, targetW, targetH, radius, objectFit = 'fill', objectPosition = '50% 50%') {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 2; // Double resolution
      canvas.width = targetW * scale;
      canvas.height = targetH * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);

      // Normalize radius
      let r = { tl: 0, tr: 0, br: 0, bl: 0 };
      if (typeof radius === 'number') {
        r = { tl: radius, tr: radius, br: radius, bl: radius };
      } else if (typeof radius === 'object' && radius !== null) {
        r = { ...r, ...radius };
      }

      // 1. Draw Mask
      ctx.beginPath();
      // ... (radius clamping logic remains the same) ...
      const factor = Math.min(
        targetW / (r.tl + r.tr) || Infinity,
        targetH / (r.tr + r.br) || Infinity,
        targetW / (r.br + r.bl) || Infinity,
        targetH / (r.bl + r.tl) || Infinity
      );

      if (factor < 1) {
        r.tl *= factor;
        r.tr *= factor;
        r.br *= factor;
        r.bl *= factor;
      }

      ctx.moveTo(r.tl, 0);
      ctx.lineTo(targetW - r.tr, 0);
      ctx.arcTo(targetW, 0, targetW, r.tr, r.tr);
      ctx.lineTo(targetW, targetH - r.br);
      ctx.arcTo(targetW, targetH, targetW - r.br, targetH, r.br);
      ctx.lineTo(r.bl, targetH);
      ctx.arcTo(0, targetH, 0, targetH - r.bl, r.bl);
      ctx.lineTo(0, r.tl);
      ctx.arcTo(0, 0, r.tl, 0, r.tl);
      ctx.closePath();
      ctx.fillStyle = '#000';
      ctx.fill();

      // 2. Composite Source-In
      ctx.globalCompositeOperation = 'source-in';

      // 3. Draw Image with Object Fit logic
      const wRatio = targetW / img.width;
      const hRatio = targetH / img.height;
      let renderW, renderH;

      if (objectFit === 'contain') {
        const fitScale = Math.min(wRatio, hRatio);
        renderW = img.width * fitScale;
        renderH = img.height * fitScale;
      } else if (objectFit === 'cover') {
        const coverScale = Math.max(wRatio, hRatio);
        renderW = img.width * coverScale;
        renderH = img.height * coverScale;
      } else if (objectFit === 'none') {
        renderW = img.width;
        renderH = img.height;
      } else if (objectFit === 'scale-down') {
        const scaleDown = Math.min(1, Math.min(wRatio, hRatio));
        renderW = img.width * scaleDown;
        renderH = img.height * scaleDown;
      } else {
        // 'fill' (default)
        renderW = targetW;
        renderH = targetH;
      }

      // Handle Object Position (simplified parsing for "x% y%" or keywords)
      let posX = 0.5; // Default center
      let posY = 0.5;

      const posParts = objectPosition.split(' ');
      if (posParts.length > 0) {
        const parsePos = (val) => {
          if (val === 'left' || val === 'top') return 0;
          if (val === 'center') return 0.5;
          if (val === 'right' || val === 'bottom') return 1;
          if (val.includes('%')) return parseFloat(val) / 100;
          return 0.5; // fallback
        };
        posX = parsePos(posParts[0]);
        posY = posParts.length > 1 ? parsePos(posParts[1]) : 0.5;
      }

      const renderX = (targetW - renderW) * posX;
      const renderY = (targetH - renderH) * posY;

      ctx.drawImage(img, renderX, renderY, renderW, renderH);

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => resolve(null);
    img.src = src;
  });
}
