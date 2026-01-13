class Render {
	setSmoothing(val) { this.smoothing = val; }
	setPasses(val) { this.passes = val; }
	setStroke(val) { this.stroke = val; }

	async render(lines, images, writer) {
		writer.reset();

		for (let image of images) {
			await writer.renderDataURL(image.point, image.dataURL);
		}

		let passes = this.passes;
		if (passes < 1) passes = 1;

		for (let line of lines) {
			let dots = line.dots();
			for (let i=1; i < passes; i++) {
				let ratio = i / passes;
				dots = smoothPass(dots, Math.floor(ratio * this.smoothing));
				writer.renderLine(dots, this.stroke * ratio, line.color.toRGBA(ratio));
			}
		}
		for (let line of lines) {
			let dots = line.dots();
			writer.renderLine(smooth(dots, this.smoothing, passes), this.stroke, line.color.toRGB());
		}
		writer.swap();
	}
}

class Writer {
	swap() { throw new Error("implement swap"); }
	reset() { throw new Error("implement reset"); }
	renderLine() { throw new Error("implement renderLine"); }
	renderDataURL() { throw new Error("implement renderDataURL"); }
}

class CanvasWriter extends Writer {
	constructor(el, width, height) {
		super();
		this.el = document.createElement("canvas");
		this.buffer = el;
		this.width = width;
		this.height = height;
		this.init();
	}

	init() {
		this.el.width = this.width;
		this.buffer.width = this.width;
		this.el.height = this.height;
		this.buffer.height = this.height;
	}

	reset() {
		const ctx = this.el.getContext("2d");
		ctx.clearRect(0, 0, this.el.width, this.el.height);
	}

	swap() {
		const ctx = this.buffer.getContext("2d");
		ctx.clearRect(0, 0, this.el.width, this.el.height);
		ctx.drawImage(this.el, 0, 0);
	}

	renderLine(dots, stroke, color) {
		const ctx = this.el.getContext("2d");
		if (dots.length < 2) return;

		if (stroke < 1) stroke = 1;

		ctx.fillStyle = "none";
		ctx.strokeStyle = color;
		ctx.lineWidth = stroke;

		let dot = dots[0];
		ctx.beginPath();
		for (let i = 1; i < dots.length; i++) {
			ctx.moveTo(dot[0], dot[1]);
			dot = dots[i];
			ctx.lineTo(dot[0], dot[1]);
		}
		ctx.closePath();
		ctx.stroke();
	}

	renderDataURL(pt, dataURL) {
		return new Promise((resolve, reject) => {
			if (!(pt instanceof Point)) return reject("Expected point");
			const img = new Image();
			img.onload = e => {
				let ctx = this.el.getContext("2d");
				ctx.drawImage(img, pt.x, pt.y);
				resolve();
			};
			img.src = dataURL;
		});
	}
}

class SVGWriter extends Writer {
	constructor(el) {
		super();
		this.el = el;
	}

	reset() {
		this.el.innerHTML = '';
	}

	swap() {
		// Not a real-time writer, no need to swap buffers
	}

	renderLine(dots, stroke, color) {
		if (dots.length < 2) return;

		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

		const d = [];

		let dot = dots[0];
		d.push(`M${dot[0]},${dot[1]}`);
		for (let i = 1; i < dots.length; i++) {
			d.push(`M${dot[0]},${dot[1]}`);
			dot = dots[i];
			d.push(`L${dot[0]},${dot[1]}`);
		}

		path.setAttribute("d", d.join(" "));
		path.setAttribute("stroke", color);
		path.setAttribute("stroke-width", `${stroke}`);
		path.setAttribute("fill", "none");
		this.el.appendChild(path);
	}

	renderDataURL(pt, dataURL) {
		if (!(pt instanceof Point)) {
			throw new Error("Expected point");
		}
		const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
		img.setAttribute("x", pt.x);
		img.setAttribute("y", pt.y);
		img.setAttribute("href", dataURL);
		this.el.appendChild(img);
	}

	static cloneFrom(source) {
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		const dims = source.getBoundingClientRect();
		svg.setAttribute("viewBox", `0 0 ${dims.width} ${dims.height}`);
		svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

		return new SVGWriter(svg);
	}
}

function smooth(dots, smoothing, passes) {
	let ret = dots;

	for (let i = 0; i < passes; i++) {
		ret = smoothPass(ret, smoothing);
	}

	return ret;
}

function smoothPass(dots, smoothing) {
	if (smoothing < 1 || dots.length <= smoothing) return dots;
	const ret = [];

	ret.push(dots[0]);
	for (i = smoothing / 2; i < dots.length - smoothing/2; i++) {
		let valX = 0;
		let valY = 0;
		for (j = i - smoothing / 2; j < i + smoothing / 2; j++) {
			valX += dots[j][0];
			valY += dots[j][1];
		}
		ret.push([
			valX / smoothing,
			valY / smoothing
		]);
	}
	ret.push(dots[dots.length-1]);
	return ret;
}

function shiftLinesBy(lines, x, y) {
	for (let i = 0; i < lines.length; i++) {
		for (let j = 0; j < lines[i].points.length; j++) {
			lines[i].points[j].x += x;
			lines[i].points[j].y += y;
		}
	}
}

function shiftImagesBy(images, x, y) {
	for (let i = 0; i < images.length; i++) {
		images[i].point.x += x;
		images[i].point.y += y;
	}
}

class Color {
	constructor(r, g, b) {
		if (!Number.isFinite(r) || r < 0 || r > 1) {
			throw new Error(`Invalid red channel value: ${r}`);
		}
		this.r = r;
		if (!Number.isFinite(g) || g < 0 || g > 1) {
			throw new Error(`Invalid green channel value: ${g}`);
		}
		this.g = g;
		if (!Number.isFinite(b) || b < 0 || b > 1) {
			throw new Error(`Invalid blue channel value: ${b}`);
		}
		this.b = b;
	}

	toRGBA(opacity) {
		if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
			throw new Error(`Invalid opacity value: ${opacity}`);
		}
		let r = Math.round(this.r * 255);
		let g = Math.round(this.g * 255);
		let b = Math.round(this.b * 255);
		return `rgba(${r},${g},${b},${opacity})`;
	}

	toRGB() {
		let r = Math.round(this.r * 255);
		let g = Math.round(this.g * 255);
		let b = Math.round(this.b * 255);
		return `rgb(${r},${g},${b})`;
	}

	static fromRGBString(val) {
		if (val.length < 7) throw new Error(`Invalid color string: ${val}`);
		return new Color(
			parseInt(val.slice(1, 3), 16) / 255,
			parseInt(val.slice(3, 5), 16) / 255,
			parseInt(val.slice(5, 7), 16) / 255,
		);
	}
}

class Line {
	points;
	color;

	constructor(color) {
		this.points = [];
		this.setColor(color);
	}

	setColor(color) {
		if (!(color instanceof Color)) {
			throw new Error(`Invalid color value: ${color}`);
		}
		this.color = color;
	}

	add(p) {
		if (!(p instanceof Point)) {
			throw new Error("Can't add non-point");
		}
		this.points.push(p);
	}

	dots() {
		return this.points.map(p => [p.x, p.y]);
	}
}

class Point {
	x;
	y;

	constructor(x, y) {
		if (!Number.isFinite(x)) {
			throw new Error(`Invalid coordinate X: ${x}`);
		}
		if (!Number.isFinite(y)) {
			throw new Error(`Invalid coordinate Y: ${y}`);
		}
		this.x = x;
		this.y = y;
	}
}

class DataImage {
	width = 0;
	height = 0;
	constructor(pt, dataURL) {
		if (!(pt instanceof Point)) {
			throw new Error("expected point");
		}
		this.point = new Point(pt.x, pt.y);
		this.dataURL = dataURL;
	}

	static async fromBlobAt(blob, pos) {
		if (!(pos instanceof Point)) throw new Error("expected point");
		const dataURL = await(new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		}));
		const bmp = await createImageBitmap(blob);
		const me = new DataImage(pos, dataURL);
		me.width = bmp.width;
		me.heigh = bmp.height;
		console.log(me);
		return me;
	}
}

function getMinPoint(lines, images) {
	const min = new Point(Number.MAX_VALUE, Number.MAX_VALUE);
	for (let line of lines) {
		for (let point of line.points) {
			min.x = Math.min(min.x, point.x);
			min.y = Math.min(min.y, point.y);
		}
	}
	for (let img of images) {
		min.x = Math.min(min.x, img.point.x);
		min.y = Math.min(min.y, img.point.y);
	}
	return min;
}

function getMaxPoint(lines, images) {
	const max = new Point(0, 0);
	for (let line of lines) {
		for (let point of line.points) {
			max.x = Math.max(max.x, point.x);
			max.y = Math.max(max.y, point.y);
		}
	}
	for (let img of images) {
		max.x = Math.max(max.x, img.point.x + img.width);
		max.y = Math.max(max.y, img.point.y + img.height);
	}
	return max;
}

async function init() {
	const box = document.body.getBoundingClientRect();
	const pad = document.getElementById("drawing");
	const canvas = new CanvasWriter(pad, box.width, box.height);
	const render = new Render();

	const smoothing = document.getElementById("smoothing");
	const passes = document.getElementById("passes");
	const stroke = document.getElementById("stroke");
	const change = cback => {
		return e => {
			cback.apply(render, [e.target.value]);
			const out = e.target.parentNode.querySelector(".out");
			out.innerText = e.target.value;
			render.render(lines, images, canvas);
		};
	};
	smoothing.oninput = change(render.setSmoothing);
	render.setSmoothing(smoothing.value || 1);

	passes.oninput = change(render.setPasses);
	render.setPasses(passes.value || 1);

	stroke.oninput = change(render.setStroke);
	render.setStroke(stroke.value || 1);

	let color = document.getElementById("foreground");
	let isDrawing = false;
	let currentLine = new Line(Color.fromRGBString(color.value));
	let lastPos = new Point(0, 0);
	const lines = [currentLine];
	const images = [];

	color.onchange = e => {
		currentLine.setColor(Color.fromRGBString(color.value));
	};

	pad.onmousedown = e => {
		isDrawing = true;
		lastPos = new Point(e.offsetX, e.offsetY);
	};
	pad.onmouseup = e => {
		isDrawing = false;

		currentLine = new Line(Color.fromRGBString(color.value));
		lines.push(currentLine);
	};
	pad.onmousemove = e => {
		if (isDrawing) {
			currentLine.add(new Point(e.offsetX, e.offsetY));
			render.render(lines, images, canvas);
		}
	};

	document.addEventListener("paste", async (e) => {
		const items = e.clipboardData.items;
		for (let item of items) {
			if (item.type === "image/png") {
				const blob = item.getAsFile();
				images.push(await DataImage.fromBlobAt(blob, lastPos));
			}
		}
		e.preventDefault();
		render.render(lines, images, canvas);
	});

	const crop = document.getElementById("crop");
	crop.onclick = e => {
		const min = getMinPoint(lines, images);
		const max = getMaxPoint(lines, images);
		shiftLinesBy(lines, -1 * min.x, -1 * min.y);
		shiftImagesBy(images, -1 * min.x, -1 * min.y);

		canvas.width = max.x - min.x;
		canvas.height = max.y - min.y;
		canvas.init();

		render.render(lines, images, canvas);
	};

	const undo = document.getElementById("undo");
	undo.onclick = e => {
		lines.pop();
		if (lines.length > 0) {
			lines.pop();
		}
		currentLine = new Line(Color.fromRGBString(color.value));
		lines.push(currentLine);
		render.render(lines, images, canvas);
	};

	const dload = document.getElementById("download-svg");
	dload.onclick = e => {
		const date = new Date().toISOString().replace(/[^-a-z0-9]/gi, '-');
		const fname = `freehand-${date}.svg`;

		const resp = confirm(`Download ${fname}?`);
		if (!resp) return false;

		const svg = SVGWriter.cloneFrom(pad);
		render.render(lines, images, svg);

		const dl = document.createElement('a');
		dl.href = window.URL.createObjectURL(
			new Blob([svg.el.outerHTML], {"type": "text/svg" })
		);
		dl.download = fname;
		document.body.appendChild(dl);
		dl.click();
		document.body.removeChild(dl);
	};

	document.getElementById("plus-left").onclick = e => {
		shiftLinesBy(lines, canvas.width/2, 0);
		shiftImagesBy(images, canvas.width/2, 0);
		canvas.width += canvas.width/2;
		canvas.init();
		render.render(lines, images, canvas);
	};
	document.getElementById("plus-right").onclick = e => {
		canvas.width += canvas.width/2;
		canvas.init();
		render.render(lines, images, canvas);
	};
	document.getElementById("plus-top").onclick = e => {
		shiftLinesBy(lines, 0, canvas.height/2);
		shiftImagesBy(images, 0, canvas.height/2);
		canvas.height += canvas.height/2;
		canvas.init();
		render.render(lines, images, canvas);
	};
	document.getElementById("plus-bottom").onclick = e => {
		canvas.height += canvas.height/2;
		canvas.init();
		render.render(lines, images, canvas);
	};

	window.onresize = e => {
		canvas.init();
		render.render(lines, images, canvas);
	}

}

window.onload = init;
