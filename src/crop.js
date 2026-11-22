/** Return the source rectangle for a cover crop. Positions run from 0 to 1. */
export function cropRect(width, height, targetWidth, targetHeight, zoom = 1, x = 0.5, y = 0.5) {
  const scale = Math.max(targetWidth / width, targetHeight / height) * zoom;
  const w = targetWidth / scale;
  const h = targetHeight / scale;
  return { x: (width - w) * x, y: (height - h) * y, width: w, height: h };
}
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export function formatDate(date) {
  const [year, month, day] = date.split('-');
  return year && month && day ? `${month}/${day}/${year}` : '';
}

/** Cell bounds in the unrotated 1200 x 1800 composition. */
export function cellBounds(layout, index) {
  if (layout === 'stack') return { x: 0, y: index * 900, width: 1200, height: 900 };
  if (layout === 'three' && index === 2) return { x: 0, y: 900, width: 1200, height: 900 };
  return { x: (index % 2) * 600, y: Math.floor(index / 2) * 900, width: 600, height: 900 };
}

export function visualBounds(layout, index, rotated) {
  const rect = cellBounds(layout, index);
  return rotated ? { x: 1800 - rect.y - rect.height, y: rect.x, width: rect.height, height: rect.width } : rect;
}

/** Stamp margins in output pixels, including clearance from the print guide. */
export function dateMargins(layout, index, rotated) {
  const cell = visualBounds(layout, index, rotated);
  const outputWidth = rotated ? 1800 : 1200;
  const outputHeight = rotated ? 1200 : 1800;
  let right = cell.width * 0.054;
  let bottom = cell.height * 0.042;
  if (cell.x + cell.width === outputWidth) right = Math.max(right, 43 + 12);
  if (layout === 'three' && rotated && cell.y + cell.height === outputHeight) bottom = outputHeight * 0.042;
  return { right, bottom };
}
