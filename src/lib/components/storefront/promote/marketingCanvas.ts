/** Client-side marketing asset helpers (canvas PNG downloads). */

export function downloadDataUrl(dataUrl: string, filename: string) {
	const link = document.createElement('a');
	link.href = dataUrl;
	link.download = filename;
	link.click();
}

export function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('Could not load image'));
		img.src = src;
	});
}

export function slugifyFilename(name: string): string {
	const cleaned = (name || 'store')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	return cleaned || 'store';
}

export function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) {
	const radius = Math.min(r, w / 2, h / 2);
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.arcTo(x + w, y, x + w, y + h, radius);
	ctx.arcTo(x + w, y + h, x, y + h, radius);
	ctx.arcTo(x, y + h, x, y, radius);
	ctx.arcTo(x, y, x + w, y, radius);
	ctx.closePath();
}

/** Draw cover-fit image centered in a box. */
export function drawImageCover(
	ctx: CanvasRenderingContext2D,
	img: HTMLImageElement,
	x: number,
	y: number,
	w: number,
	h: number
) {
	const scale = Math.max(w / img.width, h / img.height);
	const dw = img.width * scale;
	const dh = img.height * scale;
	ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** Draw contain-fit image centered in a box. */
export function drawImageContain(
	ctx: CanvasRenderingContext2D,
	img: HTMLImageElement,
	x: number,
	y: number,
	w: number,
	h: number
) {
	const scale = Math.min(w / img.width, h / img.height);
	const dw = img.width * scale;
	const dh = img.height * scale;
	ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
