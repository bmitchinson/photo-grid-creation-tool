<script lang="ts">
  import { onDestroy } from 'svelte';
  import { initFasterFixes } from '@fasterfixes/svelte';

  const feedbackProjectId = import.meta.env.VITE_FASTER_FIXES_PROJECT_ID;
  if (feedbackProjectId) initFasterFixes({ projectId: feedbackProjectId, captureDiagnostics: false, captureRecording: false });
  import { cropRect, clamp } from './crop.js';

  type Photo = { url: string; image: HTMLImageElement; name: string; x: number; y: number; zoom: number };
  let photos: (Photo | null)[] = $state([null, null, null, null]);
  let layout: 'grid' | 'stack' = $state('grid');
  let selected = $state(0);
  let rotated = $state(false);
  let busy = $state(false);
  let error = $state('');
  let input: HTMLInputElement;
  let stage: HTMLDivElement;
  let drag: { index: number; x: number; y: number; startX: number; startY: number; width: number; height: number } | null = null;
  let count = $derived(layout === 'grid' ? 4 : 2);
  let current = $derived(photos[selected]);
  let ready = $derived(photos.slice(0, count).every(Boolean));

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
    return { ...result, name: file.name, x: .5, y: .5, zoom: 1 };
  }
  async function choose(event: Event) {
    const el = event.currentTarget as HTMLInputElement;
    const files = Array.from(el.files ?? []);
    el.value = '';
    if (!files.length) return;
    busy = true; error = '';
    let index = selected;
    try {
      for (const file of files.slice(0, count - index)) {
        const photo = await load(file);
        if (photos[index]) URL.revokeObjectURL(photos[index]!.url);
        photos[index] = photo;
        index++;
      }
    } catch (e) { error = `Couldn't open ${files[index - selected]?.name ?? 'that photo'}. Try a JPEG or PNG instead.`; console.error(e); }
    finally { busy = false; }
  }
  function setLayout(value: 'grid' | 'stack') { layout = value; selected = Math.min(selected, value === 'grid' ? 3 : 1); }
  function select(index: number) { selected = index; }
  function add(index: number) { selected = index; input.click(); }
  function startDrag(event: PointerEvent, index: number) {
    if (!photos[index]) return;
    selected = index;
    const element = event.currentTarget as HTMLDivElement;
    element.setPointerCapture(event.pointerId);
    const rect = element.getBoundingClientRect();
    drag = { index, x: event.clientX, y: event.clientY, startX: photos[index]!.x, startY: photos[index]!.y, width: rotated ? rect.height : rect.width, height: rotated ? rect.width : rect.height };
  }
  function moveDrag(event: PointerEvent) {
    if (!drag) return;
    const photo = photos[drag.index]; if (!photo) return;
    const r = cropRect(photo.image.naturalWidth, photo.image.naturalHeight, layout === 'grid' ? 600 : 1200, 900, photo.zoom, drag.startX, drag.startY);
    const extraX = photo.image.naturalWidth - r.width;
    const extraY = photo.image.naturalHeight - r.height;
    const dx = rotated ? event.clientY - drag.y : event.clientX - drag.x;
    const dy = rotated ? -(event.clientX - drag.x) : event.clientY - drag.y;
    photo.x = extraX ? clamp(drag.startX - dx / drag.width * r.width / extraX, 0, 1) : .5;
    photo.y = extraY ? clamp(drag.startY - dy / drag.height * r.height / extraY, 0, 1) : .5;
  }
  function imageStyle(photo: Photo) {
    const w = layout === 'grid' ? 600 : 1200;
    const r = cropRect(photo.image.naturalWidth, photo.image.naturalHeight, w, 900, photo.zoom, photo.x, photo.y);
    return `width:${photo.image.naturalWidth / r.width * 100}%;height:${photo.image.naturalHeight / r.height * 100}%;left:${-r.x / r.width * 100}%;top:${-r.y / r.height * 100}%`;
  }
  function download() {
    error = '';
    const canvas = document.createElement('canvas'); canvas.width = rotated ? 1800 : 1200; canvas.height = rotated ? 1200 : 1800;
    const ctx = canvas.getContext('2d'); if (!ctx) { error = 'Your browser could not create the image.'; return; }
    if (rotated) { ctx.translate(1800, 0); ctx.rotate(Math.PI / 2); }
    const width = layout === 'grid' ? 600 : 1200;
    for (let i = 0; i < count; i++) {
      const p = photos[i]!;
      const r = cropRect(p.image.naturalWidth, p.image.naturalHeight, width, 900, p.zoom, p.x, p.y);
      ctx.drawImage(p.image, r.x, r.y, r.width, r.height, layout === 'grid' ? (i % 2) * 600 : 0, layout === 'grid' ? Math.floor(i / 2) * 900 : i * 900, width, 900);
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
  <header><a href="/">photo formatter</a></header><hr />
  <main>
    <section class="intro"><h1>make a little photo print</h1><p>Pick your photos, adjust the crop, and download a print-ready image.</p></section>
    <div class="workspace">
      <section class="preview-section" aria-label="Print preview">
        <div class="preview-heading"><span>print preview</span><span>{rotated ? '1800 × 1200' : '1200 × 1800'} px</span></div>
        <div class:rotated class="stage-frame"><div class:stack={layout === 'stack'} class="stage" bind:this={stage}>
          {#each Array(count) as _, i}
            <div class:selected={selected === i} class="cell" role="group" aria-label={`Photo ${i + 1}`} onpointerdown={(e) => startDrag(e, i)} onpointermove={moveDrag} onpointerup={() => drag = null} onpointercancel={() => drag = null}>
              {#if photos[i]}
                <img src={photos[i]!.url} alt="" draggable="false" style={imageStyle(photos[i]!)} />
                <button class="cell-select" aria-label={`Select photo ${i + 1} for editing`} onclick={() => select(i)}></button>
              {:else}
                <button class="add-photo" onclick={() => add(i)} disabled={busy}><span>+</span> add photo {i + 1}</button>
              {/if}
            </div>
          {/each}
          <div class="guide left"></div><div class="guide right"></div>
        </div></div>
        <p class="guide-note"><span></span> Red dotted lines show the variable print edge.</p>
      </section>
      <section class="controls" aria-label="Photo controls">
        <div class="control-block"><h2>1. choose a layout</h2><div class="layout-buttons"><button class:active={layout === 'grid'} onclick={() => setLayout('grid')}>4 photos <small>2 × 2</small></button><button class:active={layout === 'stack'} onclick={() => setLayout('stack')}>2 photos <small>stacked</small></button></div><button class="outline" onclick={() => rotated = !rotated}>↻ {rotated ? 'rotate back to portrait' : 'rotate print to landscape'}</button></div>
        <div class="control-block"><h2>2. add your photos</h2><p>Choose up to {count} photos. JPEG, PNG and HEIC are welcome.</p><input bind:this={input} type="file" accept="image/*,.heic,.heif" multiple onchange={choose} hidden /><button class="outline" onclick={() => input.click()} disabled={busy}>{busy ? 'opening photos…' : current ? `replace photo ${selected + 1}` : 'choose photos'}</button><p class="hint">Select a photo in the preview to edit it. Drag to reposition.</p></div>
        <div class="control-block"><h2>3. adjust the crop</h2>{#if current}<label for="zoom">photo {selected + 1} zoom <span>{current.zoom.toFixed(1)}×</span></label><input id="zoom" type="range" min="1" max="4" step="0.01" bind:value={current.zoom} /><button class="text-button" onclick={() => { if (current) { current.zoom = 1; current.x = .5; current.y = .5; } }}>reset crop</button>{:else}<p>Choose a photo to adjust its crop.</p>{/if}</div>
        <div class="control-block"><h2>4. save your print</h2><button class="download" disabled={!ready || busy} onclick={download}>download image ↓</button><p class="hint">Your photos stay on your device.</p></div>
        {#if error}<p class="error" role="alert">{error}</p>{/if}
      </section>
    </div>
  </main>
  <hr /><footer>made for little printed memories <span>·</span> photos stay with you</footer>
</div>
