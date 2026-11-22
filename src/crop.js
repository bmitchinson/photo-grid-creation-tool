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
