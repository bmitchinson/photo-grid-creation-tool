<script lang="ts">
  import { onDestroy } from 'svelte';
  import { cropRect, clamp, formatDate, cellBounds, visualBounds } from './crop.js';

  type Photo = { url: string; image: HTMLImageElement | HTMLCanvasElement; original: HTMLImageElement; turns: number; date: string; name: string; x: number; y: number; zoom: number };
  let photos: (Photo | null)[] = $state([null, null, null, null]);
  let layout: 'grid' | 'three' | 'stack' = $state('grid');
  let selected = $state(2);
  let rotated = $state(true);
  let showDates = $state(false);
  let dragged = false;
  let busy = $state(false);
  let error = $state('');
  let input: HTMLInputElement;
  let stage: HTMLDivElement;
  let drag: { index: number; x: number; y: number; startX: number; startY: number; width: number; height: number } | null = null;
  let count = $derived(layout === 'grid' ? 4 : layout === 'three' ? 3 : 2);
  let current = $derived(photos[selected]);
  let ready = $derived(photos.slice(0, count).every(Boolean));
  let visualOrder = $derived(Array.from({ length: count }, (_, index) => index).sort((a, b) => photoNumber(a) - photoNumber(b)));
  function photoNumber(index: number) {
    if (!rotated) return index + 1;
    return layout === 'grid' ? [2, 4, 1, 3][index] : layout === 'three' ? [2, 3, 1][index] : 2 - index;
  }

  function decode(blob: Blob): Promise<{ url: string; image: HTMLImageElement }> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => resolve({ url, image });
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read this image.')); };
      image.src = url;
    });
  }
  async function load(file: File): Promise<Photo> {
    let result;
    try { result = await decode(file); }
    catch (e) {
      if (!/\.(heic|heif)$/i.test(file.name) && !/hei[cf]/i.test(file.type)) throw e;
      const { default: heic2any } = await import('heic2any');
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.95 });
      result = await decode(Array.isArray(converted) ? converted[0] : converted);
    }
    let date = '';
    try {
      const { parse } = await import('exifr');
      const metadata = await parse(file, { pick: ['DateTimeOriginal', 'CreateDate', 'DateTimeDigitized'] });
      const taken = metadata?.DateTimeOriginal ?? metadata?.CreateDate ?? metadata?.DateTimeDigitized;
      if (taken instanceof Date && !Number.isNaN(taken.getTime())) {
        date = `${taken.getFullYear()}-${String(taken.getMonth() + 1).padStart(2, '0')}-${String(taken.getDate()).padStart(2, '0')}`;
      }
    } catch (e) { console.warn('Could not read photo date metadata:', e); }
    return { ...result, original: result.image, turns: 0, date, name: file.name, x: .5, y: .5, zoom: 1 };
  }
  async function choose(event: Event) {
    const el = event.currentTarget as HTMLInputElement;
    const files = Array.from(el.files ?? []);
    el.value = '';
    if (!files.length) return;
    busy = true; error = '';
    const order = Array.from({ length: count }, (_, index) => index).sort((a, b) => photoNumber(a) - photoNumber(b));
    const targets = order.slice(Math.max(0, order.indexOf(selected)));
    let loaded = 0;
    try {
      for (const file of files.slice(0, targets.length)) {
        const index = targets[loaded];
        const photo = await load(file);
        if (photos[index]) URL.revokeObjectURL(photos[index]!.url);
        photos[index] = photo;
        loaded++;
      }
    } catch (e) { error = `Couldn't open ${files[loaded]?.name ?? 'that photo'}. Try a JPEG or PNG instead.`; console.error(e); }
    finally { busy = false; }
  }
  function setLayout(value: 'grid' | 'three' | 'stack') { layout = value; if (selected >= (value === 'grid' ? 4 : value === 'three' ? 3 : 2)) selected = -1; }
  function select(index: number) { if (dragged) { dragged = false; selected = index; return; } selected = selected === index ? -1 : index; }
  function rotate() {
    rotated = !rotated;

  }
  function photoWidth(photo: Photo) { return photo.image instanceof HTMLImageElement ? photo.image.naturalWidth : photo.image.width; }
  function photoHeight(photo: Photo) { return photo.image instanceof HTMLImageElement ? photo.image.naturalHeight : photo.image.height; }
  function rotatePhoto() {
    const photo = current;
    if (!photo) return;
    const turns = (photo.turns + 1) % 4;
    if (turns === 0) photo.image = photo.original;
    else {
      const canvas = document.createElement('canvas');
      const w = photo.original.naturalWidth, h = photo.original.naturalHeight;
      canvas.width = turns % 2 ? h : w;
      canvas.height = turns % 2 ? w : h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { error = 'Could not rotate this photo.'; return; }
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(turns * Math.PI / 2);
      ctx.drawImage(photo.original, -w / 2, -h / 2);
      photo.image = canvas;
    }
    photo.turns = turns;
    photo.x = .5; photo.y = .5;
  }
  function add(index: number) { selected = index; input.click(); }
  function startDrag(event: PointerEvent, index: number) {
    if (!photos[index]) return;
    dragged = false;
    const element = event.currentTarget as HTMLDivElement;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    const rect = element.getBoundingClientRect();
    drag = { index, x: event.clientX, y: event.clientY, startX: photos[index]!.x, startY: photos[index]!.y, width: rotated ? rect.height : rect.width, height: rotated ? rect.width : rect.height };
  }
  function moveDrag(event: PointerEvent) {
    if (!drag) return;
    const photo = photos[drag.index]; if (!photo) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 3) { dragged = true; selected = drag.index; }
    const r = cropRect(photoWidth(photo), photoHeight(photo), cellBounds(layout, drag.index).width, 900, photo.zoom, drag.startX, drag.startY);
    const extraX = photoWidth(photo) - r.width;
    const extraY = photoHeight(photo) - r.height;
    const dx = rotated ? event.clientY - drag.y : event.clientX - drag.x;
    const dy = rotated ? -(event.clientX - drag.x) : event.clientY - drag.y;
    photo.x = extraX ? clamp(drag.startX - dx / drag.width * r.width / extraX, 0, 1) : .5;
    photo.y = extraY ? clamp(drag.startY - dy / drag.height * r.height / extraY, 0, 1) : .5;
  }
  function imageStyle(photo: Photo, index: number) {
    const w = cellBounds(layout, index).width;
    const r = cropRect(photoWidth(photo), photoHeight(photo), w, 900, photo.zoom, photo.x, photo.y);
    return `width:${photoWidth(photo) / r.width * 100}%;height:${photoHeight(photo) / r.height * 100}%;left:${-r.x / r.width * 100}%;top:${-r.y / r.height * 100}%`;
  }
  function showCanvas(node: HTMLCanvasElement, source: HTMLCanvasElement) {
    function update(image: HTMLCanvasElement) { node.width = image.width; node.height = image.height; node.getContext('2d')?.drawImage(image, 0, 0); }
    update(source);
    return { update };
  }
  function download() {
    error = '';
    const canvas = document.createElement('canvas'); canvas.width = rotated ? 1800 : 1200; canvas.height = rotated ? 1200 : 1800;
    const ctx = canvas.getContext('2d'); if (!ctx) { error = 'Your browser could not create the image.'; return; }
    ctx.save();
    if (rotated) { ctx.translate(1800, 0); ctx.rotate(Math.PI / 2); }
    for (let i = 0; i < count; i++) {
      const p = photos[i]!;
      const cell = cellBounds(layout, i);
      const r = cropRect(photoWidth(p), photoHeight(p), cell.width, cell.height, p.zoom, p.x, p.y);
      ctx.drawImage(p.image, r.x, r.y, r.width, r.height, cell.x, cell.y, cell.width, cell.height);
    }
    ctx.restore();
    if (showDates) {
      const fontSize = Math.round(canvas.width * 0.025);
      ctx.font = `bold ${fontSize}px "Courier New", monospace`;
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.letterSpacing = `${fontSize * .05}px`;
      ctx.fillStyle = '#ffae35'; ctx.shadowColor = '#ff8300'; ctx.shadowBlur = 4;
      ctx.strokeStyle = '#8f4218'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      visualOrder.forEach((index) => {
        const date = formatDate(photos[index]?.date ?? ''); if (!date) return;
        const cell = visualBounds(layout, index, rotated);
        const x = cell.x + cell.width * .94;
        const y = cell.y + cell.height * .93;
        ctx.strokeText(date, x, y); ctx.fillText(date, x, y);
      });
    }
    canvas.toBlob(blob => {
      if (!blob) { error = 'Could not export the image.'; return; }
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'photo-grid.jpg'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    }, 'image/jpeg', .95);
  }
  onDestroy(() => photos.forEach(p => { if (p) URL.revokeObjectURL(p.url); }));
</script>

<svelte:head><title>photo formatter</title><meta name="description" content="Arrange photos for printing, right in your browser." /></svelte:head>
<div class="page">
  <header><a href={import.meta.env.BASE_URL}>photo formatter</a></header><hr />
  <main>
    <section class="intro"><h1>generate photo grid</h1><p>Pick your photos, adjust the crop, and download a print-ready image. Preview lines show the variable print edges for Canon SELPHY printers.</p></section>
    <div class="workspace">
      <section class="preview-section" aria-label="Print preview">
        <div class="preview-heading"><span>print preview</span><span>{rotated ? '1800 × 1200' : '1200 × 1800'} px</span></div>
        <div class:rotated class="stage-frame"><div class:stack={layout === 'stack'} class:three={layout === 'three'} class="stage" bind:this={stage}>
          {#each Array(count) as _, i}
            <div class:selected={selected === i && !!photos[i]} class="cell" role="group" aria-label={`Photo ${photoNumber(i)}`} onpointerdown={(e) => startDrag(e, i)} onpointermove={moveDrag} onpointerup={() => drag = null} onpointercancel={() => drag = null}>
              {#if photos[i]}
                {#if photos[i]!.turns === 0}<img src={photos[i]!.url} alt="" draggable="false" style={imageStyle(photos[i]!, i)} />{:else}<canvas class="photo-canvas" use:showCanvas={photos[i]!.image as HTMLCanvasElement} style={imageStyle(photos[i]!, i)}></canvas>{/if}
                <button class="cell-select" aria-label={`Select photo ${photoNumber(i)} for editing`} onclick={() => select(i)}></button>
              {:else}
                <button class="add-photo" onclick={() => add(i)} disabled={busy}><span class="add-photo-content"><span class="add-photo-plus">+</span> add photo {photoNumber(i)}</span></button>
              {/if}
            </div>
          {/each}
          <div class="guide left"></div><div class="guide right"></div>
        </div>
          {#if showDates}<div class:stacked={layout === 'stack'} class:three={layout === 'three'} class:landscape={rotated} class="date-overlay" aria-hidden="true">{#each visualOrder as index}<div class="date-cell">{#if photos[index]?.date}<span class="date-stamp">{formatDate(photos[index]!.date)}</span>{/if}</div>{/each}</div>{/if}
        </div>
        <div class="control-block image-controls" class:disabled={!current}><h2>photo controls{current ? ` · photo ${photoNumber(selected)}` : ''}</h2>{#if current}<label for="zoom">photo {photoNumber(selected)} zoom <span>{current.zoom.toFixed(1)}×</span></label><input id="zoom" type="range" min="1" max="4" step="0.01" bind:value={current.zoom} /><button class="text-button" onclick={() => { if (current) { current.zoom = 1; current.x = .5; current.y = .5; } }}>reset crop</button> <button class="text-button rotate-photo" onclick={rotatePhoto}>↻ rotate photo</button><label class="date-label" for="photo-date">photo date</label><input id="photo-date" type="date" bind:value={current.date} /><p class="hint">Leave blank to omit the date for this photo.</p>{:else}<fieldset disabled><label for="zoom-disabled">zoom</label><input id="zoom-disabled" type="range" /><button class="text-button" type="button">reset crop</button> <button class="text-button rotate-photo" type="button">↻ rotate photo</button><label class="date-label" for="date-disabled">photo date</label><input id="date-disabled" type="date" /></fieldset><p class="hint">Select a photo to adjust it.</p>{/if}</div>
        <p class="guide-note"><span></span> Red dotted lines show the variable print edge.</p>
      </section>
      <section class="controls" aria-label="Photo controls">
        <div class="control-block"><h2>1. choose a layout</h2><div class="layout-buttons"><button class:active={layout === 'grid'} onclick={() => setLayout('grid')}>4 photos <small>2 × 2</small></button><button class:active={layout === 'three'} onclick={() => setLayout('three')}>3 photos <small>mixed</small></button><button class:active={layout === 'stack'} onclick={() => setLayout('stack')}>2 photos <small>stacked</small></button></div><button class="outline" onclick={rotate}>↻ {rotated ? 'rotate back to portrait' : 'rotate print to landscape'}</button></div>
        <div class="control-block"><h2>2. add your photos</h2><p>Choose up to {count} photos. JPEG, PNG and HEIC are welcome.</p><input bind:this={input} type="file" accept="image/*,.heic,.heif" multiple onchange={choose} hidden /><button class="outline" onclick={() => { if (selected < 0) selected = visualOrder[0]; input.click(); }} disabled={busy}>{busy ? 'opening photos…' : current ? `replace photo ${photoNumber(selected)}` : 'choose photos'}</button><p class="hint">Select a photo in the preview to edit it. Drag to reposition.</p></div>
        <div class="control-block"><h2>print options</h2><label class="date-toggle"><input type="checkbox" bind:checked={showDates} /> show photo dates</label><p class="hint">Dates come from photo metadata when available. Select a photo to change its date.</p></div>
        <div class="control-block"><h2>3. save your print</h2><button class="download" disabled={!ready || busy} onclick={download}>download image ↓</button><p class="hint">Your photos stay on your device.</p></div>
        {#if error}<p class="error" role="alert">{error}</p>{/if}
      </section>
    </div>
  </main>
  <hr /><footer><a href="https://mitchinson.dev">more of my work</a></footer>
</div>
