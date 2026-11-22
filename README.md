# Photo formatter

[Open the photo formatter](https://bmitchinson.github.io/photo-grid-creation-tool/)

Arrange two, three, or four photos into a print-ready grid. Adjust each crop and download the result as a JPEG in portrait or landscape. The preview shows the variable print edges for Canon SELPHY printers.

![Photo formatter showing the landscape grid preview and controls](docs/screenshot.png)

## How it was built

- Model: OpenAI GPT-6.1 Terra
- Coding agent: Pi, running under Herdr
- Build machine: home lab Windows desktop running WSL
- Remote access: Tailscale and Heeler on iOS

## Printing and privacy

The red dotted preview lines sit 75 pixels in from the left and right edges of the output and are not included in the downloaded image. Allow for print variation when positioning photos.

Photos are processed on your device. HEIC and HEIF files use a local conversion fallback when the browser cannot open them directly.

## Development

Run `npm install`, then `npm run dev`. Run `npm run check`, `npm test`, and `npm run build` to verify changes. Pushes to `main` deploy to GitHub Pages.

## Printer reference

[Canon SELPHY CP1500 advanced user guide](docs/canon-selphy-cp1500-manual.pdf) ([original PDF](https://cam.start.canon/en/P001/manual/p001.pdf)).
