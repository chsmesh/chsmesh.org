// Client side of a `photos` field in SubmissionForm.astro.
//
// Each chosen file is drawn to a canvas, scaled down and re-encoded as a JPEG
// before it goes anywhere. That keeps uploads small, turns whatever the phone
// produced into a format the site serves, and - because a canvas holds only
// pixels - drops the EXIF block, GPS position included, before the photo leaves
// the device. The submissions service strips metadata again on its side; it is
// the trust boundary, this is a courtesy. The thumbnails shown in the list are
// the re-encoded photos, so what people see is what gets sent.

// Longest edge of an uploaded photo, in pixels.
const MAX_EDGE = 1600;
// Keep in step with the `photos` field's maxBytes in services/submissions/lib.mjs.
const MAX_BYTES = 1.5 * 1024 * 1024;
// Tried in order until the encoded photo fits MAX_BYTES.
const JPEG_QUALITIES = [0.85, 0.7, 0.55];
const ALT_MAX = 160;

export interface PhotoPayload {
  /** Base64 JPEG, no data: prefix. */
  data: string;
  alt?: string;
}

export interface PhotoField {
  name: string;
  /** A message to show instead of submitting, or null when ready. */
  problem(): string | null;
  collect(): PhotoPayload[];
  reset(): void;
}

interface Photo {
  dataUrl: string;
  alt: string;
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

// Both paths apply the EXIF orientation, so the canvas gets upright pixels.
async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Fall through: some browsers reject the options bag or the file type.
    }
  }
  // A data: URL rather than a blob: URL, which the site's CSP does not allow.
  const image = new Image();
  image.src = await readAsDataUrl(file);
  await image.decode();
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => {} };
}

async function prepare(file: File): Promise<string> {
  const { source, width, height, release } = await decode(file);
  try {
    if (!width || !height) throw new Error('empty image');
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no canvas');
    // JPEG has no transparency; without this, clear areas come out black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    for (const quality of JPEG_QUALITIES) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64Length = dataUrl.length - dataUrl.indexOf(',') - 1;
      if (dataUrl.startsWith('data:image/jpeg') && (base64Length * 3) / 4 <= MAX_BYTES) return dataUrl;
    }
    throw new Error('too large');
  } finally {
    release();
  }
}

export function initPhotoField(root: HTMLElement, idPrefix: string): PhotoField | null {
  const name = root.dataset.photoField ?? '';
  const input = root.querySelector<HTMLInputElement>('input[type="file"]');
  const list = root.querySelector<HTMLElement>('[data-photo-list]');
  const status = root.querySelector<HTMLElement>('[data-photo-status]');
  if (!name || !input || !list || !status) return null;

  const max = Number(root.dataset.max) || 6;
  const required = root.dataset.required !== undefined;
  const photos: Photo[] = [];
  let preparing = 0;

  function button(label: string, onClick: () => void): HTMLButtonElement {
    const node = document.createElement('button');
    node.type = 'button';
    node.textContent = label;
    node.className = 'text-xs font-medium text-primary-600 hover:text-primary-700';
    node.addEventListener('click', onClick);
    return node;
  }

  function render() {
    list!.replaceChildren(
      ...photos.map((photo, index) => {
        const item = document.createElement('li');
        item.className = 'flex items-start gap-3 bg-neutral-50 border border-neutral-200 rounded-md p-2';

        const thumb = document.createElement('img');
        thumb.src = photo.dataUrl;
        thumb.alt = '';
        thumb.className = 'w-20 h-20 object-cover rounded shrink-0 bg-neutral-200';

        const body = document.createElement('div');
        body.className = 'flex-grow min-w-0';

        const altId = `${idPrefix}-${name}-${index}-alt`;
        const label = document.createElement('label');
        label.htmlFor = altId;
        label.className = 'block text-xs font-medium text-neutral-700 mb-1';
        label.textContent = index === 0 ? 'Photo 1 (cover): what does it show?' : `Photo ${index + 1}: what does it show?`;

        const alt = document.createElement('input');
        alt.type = 'text';
        alt.id = altId;
        alt.value = photo.alt;
        alt.maxLength = ALT_MAX;
        alt.placeholder = 'e.g., Solar node on a fence post (optional)';
        alt.className = 'w-full px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500';
        alt.addEventListener('input', () => {
          photo.alt = alt.value;
        });

        const actions = document.createElement('div');
        actions.className = 'flex gap-4 mt-2';
        if (index > 0) {
          actions.append(
            button('Make cover', () => {
              photos.unshift(...photos.splice(index, 1));
              render();
            })
          );
        }
        const remove = button('Remove', () => {
          photos.splice(index, 1);
          status!.textContent = '';
          render();
        });
        remove.className = 'text-xs font-medium text-red-600 hover:text-red-700';
        remove.setAttribute('aria-label', `Remove photo ${index + 1}`);
        actions.append(remove);

        body.append(label, alt, actions);
        item.append(thumb, body);
        return item;
      })
    );
    input!.disabled = photos.length >= max;
  }

  input.addEventListener('change', async () => {
    const files = Array.from(input.files ?? []);
    input.value = ''; // so choosing the same file again fires `change`
    if (!files.length) return;

    const room = max - photos.length;
    const accepted = files.slice(0, room);
    const problems: string[] = [];
    if (files.length > room) problems.push(`Only ${max} photos fit; the rest were left out.`);

    preparing += 1;
    status.textContent = accepted.length === 1 ? 'Preparing photo...' : `Preparing ${accepted.length} photos...`;
    try {
      for (const file of accepted) {
        try {
          photos.push({ dataUrl: await prepare(file), alt: '' });
        } catch (error) {
          console.error('Could not prepare photo', file.name, error);
          problems.push(`Could not use "${file.name}". Try a JPEG, PNG or WebP photo.`);
        }
        render();
      }
    } finally {
      preparing -= 1;
      status.textContent = problems.join(' ');
    }
  });

  return {
    name,
    problem() {
      if (preparing > 0) return 'Your photos are still being prepared. Give it a moment, then try again.';
      if (required && photos.length === 0) return 'Add at least one photo.';
      return null;
    },
    collect() {
      return photos.map((photo) => {
        const alt = photo.alt.trim();
        return { data: photo.dataUrl.slice(photo.dataUrl.indexOf(',') + 1), ...(alt ? { alt } : {}) };
      });
    },
    reset() {
      photos.length = 0;
      status.textContent = '';
      render();
    },
  };
}
