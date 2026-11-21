# Photo formatter

A static, client-side tool for arranging photos into a 1200 × 1800 print. Choose a four-photo grid or two stacked photos, adjust the crops, and download the result as a JPEG. The whole composition can also be rotated to landscape.

The red dotted preview lines indicate the variable print edges for Canon SELPHY printers. They sit 75 pixels in from each side of the portrait composition and are not included in the downloaded image. Allow for print variation when positioning photos.

Photos are processed on your device. HEIC and HEIF files use a local conversion fallback when the browser cannot open them directly.

## Development

Run `npm install`, then `npm run dev`. Run `npm run check`, `npm test`, and `npm run build` to verify changes. Pushes to `main` deploy to GitHub Pages.
