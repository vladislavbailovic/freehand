class Drawing {
	setSmoothing(val) {
		this.smoothing = val;
	}
	setPasses(val) {
		this.passes = val;
	}
	setStroke(val) {
		this.stroke = val;
	}

	hasGrid() {
		return this.grid && this.grid instanceof Grid;
	}
	showGrid(grid) {
		if (!(grid instanceof Grid)) {
			throw new Error("invalid grid");
		}
		this.grid = grid;
	}
	hideGrid() {
		this.grid = null;
	}
	drawGrid(passes, renderer) {
		if (!this.grid) return;

		for (const originalLine of this.grid.lines) {
			let line = originalLine.clone();
			for (let i = 1; i < passes; i++) {
				let ratio = i / passes;
				line = line.smoothPass(Math.floor(ratio * this.smoothing));
				renderer.renderLine(
					line,
					this.stroke * ratio,
					line.color.toRGBA(ratio),
				);
			}
			renderer.renderLine(
				originalLine.smooth(this.smoothing, passes),
				this.stroke,
				line.color.toRGB(),
			);
		}
	}

	async draw(drawables, renderer) {
		if (!(drawables instanceof Drawables))
			throw new Error("expected drawables");
		if (!(renderer instanceof Renderer)) throw new Error("expected renderer");
		renderer.reset();

		let passes = this.passes;
		if (passes < 1) passes = 1;

		this.drawGrid(passes, renderer);

		for (let drawable of drawables.items) {
			switch (true) {
				case drawable.item instanceof DataImage:
					await renderer.renderDataURL(
						drawable.item.point,
						drawable.item.dataURL,
					);
					break;
				case drawable.item instanceof Line:
					if (drawable.item.points.length == 0) {
						continue;
					}
					let line = drawable.item.clone();
					for (let i = 1; i < passes; i++) {
						let ratio = i / passes;
						line = line.smoothPass(Math.floor(ratio * this.smoothing));
						renderer.renderLine(
							line,
							this.stroke * ratio,
							line.color.toRGBA(ratio),
						);
					}
					renderer.renderLine(
						drawable.item.smooth(this.smoothing, passes),
						this.stroke,
						line.color.toRGB(),
					);
					break;
				default:
					throw new Error("invalid drawable");
			}
		}

		renderer.swap();
	}
}

class Grid {
	lines = [];
	gridX = 0;
	gridY = 0;
	color = {
		normal: Color.fromRGBString("#DDDDDD"),
		accent: Color.fromRGBString("#BBBBBB"),
	};
	tickSize = 5;

	constructor(x, y, renderer) {
		this.gridX = x;
		this.gridY = y;
		this.populate(renderer);
	}

	populate(renderer) {
		this.lines = [];
		const gridHeight = renderer.height / (this.gridY * this.tickSize);
		for (let i = 0; i < this.gridY * this.tickSize; i++) {
			const color =
				i % this.tickSize == 0 ? this.color.accent : this.color.normal;
			this.lines.push(
				Line.between(
					new Point(0, i * gridHeight),
					new Point(renderer.width, i * gridHeight),
					color,
				),
			);
		}

		const gridWidth = renderer.width / (this.gridX * this.tickSize);
		for (let i = 0; i < this.gridX * this.tickSize; i++) {
			const color =
				i % this.tickSize == 0 ? this.color.accent : this.color.normal;
			this.lines.push(
				Line.between(
					new Point(i * gridWidth, 0),
					new Point(i * gridWidth, renderer.height),
					color,
				),
			);
		}
	}
}

class Renderer {
	reset() {
		throw new Error("implement reset");
	}
	renderLine() {
		throw new Error("implement renderLine");
	}
	renderDataURL() {
		throw new Error("implement renderDataURL");
	}
	swap() {
		// by default, no double-buffering
	}
}

class CanvasRenderer extends Renderer {
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
		if (dots.points.length < 2) return;

		if (stroke < 1) stroke = 1;

		ctx.fillStyle = "none";
		ctx.strokeStyle = color;
		ctx.lineWidth = stroke;

		let dot = dots.points[0];
		ctx.beginPath();
		for (let i = 1; i < dots.points.length; i++) {
			ctx.moveTo(dot.x, dot.y);
			dot = dots.points[i];
			ctx.lineTo(dot.x, dot.y);
		}
		ctx.closePath();
		ctx.stroke();
	}

	renderDataURL(pt, dataURL) {
		return new Promise((resolve, reject) => {
			if (!(pt instanceof Point)) return reject("Expected point");
			const img = new Image();
			img.onload = (e) => {
				let ctx = this.el.getContext("2d");
				ctx.drawImage(img, pt.x, pt.y);
				resolve();
			};
			img.src = dataURL;
		});
	}
}

class SVGRenderer extends Renderer {
	constructor(el) {
		super();
		this.el = el;
	}

	reset() {
		this.el.innerHTML = "";
	}

	renderLine(dots, stroke, color) {
		if (dots.points.length < 2) return;

		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

		const d = [];

		let dot = dots.points[0];
		d.push(`M${dot.x},${dot.y}`);
		for (let i = 1; i < dots.points.length; i++) {
			d.push(`M${dot.x},${dot.y}`);
			dot = dots.points[i];
			d.push(`L${dot.x},${dot.y}`);
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

		return new SVGRenderer(svg);
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
		return this.points.map((p) => [p.x, p.y]);
	}

	clone() {
		let ret = new Line(this.color);
		ret.points = this.points;
		return ret;
	}

	smooth(smoothing, passes) {
		let ret = this.clone();
		if (smoothing < 1 || this.points.length <= smoothing) return ret;
		for (let i = 0; i < passes; i++) {
			ret = ret.smoothPass(smoothing);
		}
		return ret;
	}

	smoothPass(smoothing) {
		let ret = new Line(this.color);
		if (smoothing < 1 || this.points.length <= smoothing) return this.clone();

		ret.add(this.points[0]);
		for (let i = smoothing / 2; i < this.points.length - smoothing / 2; i++) {
			let valX = 0;
			let valY = 0;
			for (let j = i - smoothing / 2; j < i + smoothing / 2; j++) {
				valX += this.points[j].x;
				valY += this.points[j].y;
			}
			ret.add(new Point(valX / smoothing, valY / smoothing));
		}
		ret.add(this.points[this.points.length - 1]);
		return ret;
	}

	static between(a, b, color) {
		if (!(a instanceof Point)) throw new Error("expected origin point");
		if (!(b instanceof Point)) throw new Error("expected destination point");
		if (!(color instanceof Color)) throw new Error("expected color");
		const distance = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
		const variance = 15 / distance;
		const variations = Math.ceil(Math.random() * (distance / 10));
		const line = new Line(color);
		line.add(a);

		const base = distance / variations;
		for (let i = 0; i < variations; i++) {
			let dx = (Math.random() - 0.5) * distance * variance;
			let dy = (Math.random() - 0.5) * distance * variance;
			let x = a.x + ((b.x - a.x) * i) / variations;
			let y = a.y + ((b.y - a.y) * i) / variations;
			line.add(new Point(x + dx, y + dy));
		}

		line.add(b);
		return line;
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
		const dataURL = await new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
		const bmp = await createImageBitmap(blob);
		const me = new DataImage(pos, dataURL);
		me.width = bmp.width;
		me.height = bmp.height;
		return me;
	}
}

class Drawable {
	item;

	constructor(item) {
		if (!(item instanceof Line) && !(item instanceof DataImage))
			throw new Error("Invalid drawable");
		this.item = item;
	}

	shiftBy(x, y) {
		switch (true) {
			case this.item instanceof Line:
				for (let i = 0; i < this.item.points.length; i++) {
					this.item.points[i].x += x;
					this.item.points[i].y += y;
				}
				break;
			case this.item instanceof DataImage:
				this.item.point.x += x;
				this.item.point.y += y;
				break;
			default:
				throw new Error("invalid drawable");
		}
	}

	getMinPoint() {
		const min = new Point(Number.MAX_VALUE, Number.MAX_VALUE);
		switch (true) {
			case this.item instanceof Line:
				for (let point of this.item.points) {
					min.x = Math.min(min.x, point.x);
					min.y = Math.min(min.y, point.y);
				}
				break;
			case this.item instanceof DataImage:
				min.x = Math.min(min.x, this.item.point.x);
				min.y = Math.min(min.y, this.item.point.y);
				break;
			default:
				throw new Error("invalid drawable");
		}
		return min;
	}

	getMaxPoint() {
		const max = new Point(0, 0);
		switch (true) {
			case this.item instanceof Line:
				for (let point of this.item.points) {
					max.x = Math.max(max.x, point.x);
					max.y = Math.max(max.y, point.y);
				}
				break;
			case this.item instanceof DataImage:
				max.x = Math.max(max.x, this.item.point.x + this.item.width);
				max.y = Math.max(max.y, this.item.point.y + this.item.height);
				break;
			default:
				throw new Error("invalid drawable");
		}
		return max;
	}
}

class Drawables {
	items = [];

	add(item) {
		this.items.push(new Drawable(item));
	}

	remove() {
		while (this.items.length > 0) {
			let d = this.items.pop();
			if (d.item instanceof Line && d.item.points.length == 0) {
				continue;
			}
			break;
		}
	}

	shiftBy(x, y) {
		for (let i = 0; i < this.items.length; i++) {
			this.items[i].shiftBy(x, y);
		}
	}

	getLines() {
		const ret = [];
		for (let item of this.items) {
			if (item.item instanceof Line) {
				ret.push(item.item);
			}
		}
		return ret;
	}

	getImages() {
		const ret = [];
		for (let item of this.items) {
			if (item.item instanceof DataImage) {
				ret.push(item.item);
			}
		}
		return ret;
	}

	getMaxPoint() {
		const max = new Point(0, 0);
		for (let i = 0; i < this.items.length; i++) {
			const pt = this.items[i].getMaxPoint();
			max.x = Math.max(max.x, pt.x);
			max.y = Math.max(max.y, pt.y);
		}
		return max;
	}

	getMinPoint() {
		const min = new Point(Number.MAX_VALUE, Number.MAX_VALUE);
		for (let i = 0; i < this.items.length; i++) {
			const pt = this.items[i].getMinPoint();
			min.x = Math.min(min.x, pt.x);
			min.y = Math.min(min.y, pt.y);
		}
		return min;
	}
}

async function init() {
	const box = document.body.getBoundingClientRect();
	const pad = document.getElementById("drawing");
	const canvas = new CanvasRenderer(pad, box.width, box.height);
	const drawing = new Drawing();

	const smoothing = document.getElementById("smoothing");
	const passes = document.getElementById("passes");
	const stroke = document.getElementById("stroke");
	const change = (cback) => {
		return (e) => {
			cback.apply(drawing, [e.target.value]);
			const out = e.target.parentNode.querySelector(".out");
			out.innerText = e.target.value;
		};
	};
	smoothing.oninput = change(drawing.setSmoothing);
	drawing.setSmoothing(smoothing.value || 1);

	passes.oninput = change(drawing.setPasses);
	drawing.setPasses(passes.value || 1);

	stroke.oninput = change(drawing.setStroke);
	drawing.setStroke(stroke.value || 1);

	let color = document.getElementById("foreground");
	let isDrawing = false;
	let currentLine = new Line(Color.fromRGBString(color.value));
	let lastPos = new Point(0, 0);
	const drawables = new Drawables();
	drawables.add(currentLine);

	color.onchange = (e) => {
		currentLine.setColor(Color.fromRGBString(color.value));
	};

	pad.onmousedown = (e) => {
		isDrawing = true;
		lastPos = new Point(e.offsetX, e.offsetY);
	};
	pad.onmouseup = (e) => {
		isDrawing = false;

		currentLine = new Line(Color.fromRGBString(color.value));
		drawables.add(currentLine);
	};
	pad.onmousemove = (e) => {
		if (isDrawing) {
			currentLine.add(new Point(e.offsetX, e.offsetY));
		}
	};

	let start;
	const draw = (ts) => {
		if (!start) start = ts;
		const deltaTime = ts - start;
		window.requestAnimationFrame(draw);
		if (deltaTime > 1000 / 25) {
			drawing.draw(drawables, canvas);
			start = ts;
		}
	};
	window.requestAnimationFrame(draw);

	document.addEventListener("paste", async (e) => {
		const items = e.clipboardData.items;
		for (let item of items) {
			if (item.type === "image/png") {
				const blob = item.getAsFile();
				drawables.add(await DataImage.fromBlobAt(blob, lastPos));
			}
		}
		e.preventDefault();

		currentLine = new Line(Color.fromRGBString(color.value));
		drawables.add(currentLine);
	});

	const crop = document.getElementById("crop");
	crop.onclick = (e) => {
		const min = drawables.getMinPoint();
		const max = drawables.getMaxPoint();
		drawables.shiftBy(-1 * min.x, -1 * min.y);

		canvas.width = max.x - min.x;
		canvas.height = max.y - min.y;
		canvas.init();
	};

	const undo = document.getElementById("undo");
	undo.onclick = (e) => {
		drawables.remove();
		currentLine = new Line(Color.fromRGBString(color.value));
		drawables.add(currentLine);
	};
	document.addEventListener("keydown", (e) => {
		if (e.ctrlKey && e.key === "z") {
			e.preventDefault();
			undo.click();
		}
	});

	const dload = document.getElementById("download-svg");
	dload.onclick = async (e) => {
		const date = new Date().toISOString().replace(/[^-a-z0-9]/gi, "-");
		const fname = `freehand-${date}.svg`;

		const resp = confirm(`Download ${fname}?`);
		if (!resp) return false;

		const svg = SVGRenderer.cloneFrom(pad);
		await drawing.draw(drawables, svg);

		const dl = document.createElement("a");
		dl.href = window.URL.createObjectURL(
			new Blob([svg.el.outerHTML], { type: "text/svg" }),
		);
		dl.download = fname;
		document.body.appendChild(dl);
		dl.click();
		document.body.removeChild(dl);
	};

	document.getElementById("plus-left").onclick = (e) => {
		drawables.shiftBy(canvas.width / 2, 0);
		canvas.width += canvas.width / 2;
		canvas.init();
	};
	document.getElementById("plus-right").onclick = (e) => {
		canvas.width += canvas.width / 2;
		canvas.init();
	};
	document.getElementById("plus-top").onclick = (e) => {
		drawables.shiftBy(0, canvas.height / 2);
		canvas.height += canvas.height / 2;
		canvas.init();
	};
	document.getElementById("plus-bottom").onclick = (e) => {
		canvas.height += canvas.height / 2;
		canvas.init();
	};

	const gridX = document.getElementById("grid-x");
	const gridY = document.getElementById("grid-y");
	const gridShow = () => {
		const x = parseInt(gridX.value, 10);
		const y = parseInt(gridY.value, 10);
		const grid = new Grid(x, y, canvas);
		drawing.showGrid(grid);
	};
	document.getElementById("show-grid").onchange = (e) => {
		if (drawing.hasGrid()) {
			drawing.hideGrid();
		} else {
			gridShow();
		}
	};
	gridX.onchange = gridShow;
	gridY.onchange = gridShow;

	window.onresize = (e) => {
		canvas.init();
	};
}

window.onload = init;
