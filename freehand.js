class Render {
	setSmoothing(val) { this.smoothing = val; }
	setPasses(val) { this.passes = val; }
	setStroke(val) { this.stroke = val; }

	render(lines, writer) {
		writer.reset();
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
}

class SVGWriter extends Writer {
	constructor(el) {
		super();
		this.el = el;
	}

	reset() {
		this.el.innerHTML = '';
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


async function init() {
	const box = document.body.getBoundingClientRect();
	const pad = document.getElementById("drawing");
	const canvas = new CanvasWriter(pad, box.width, box.height);
	const render = new Render();

	window.onresize = e => canvas.init();

	const smoothing = document.getElementById("smoothing");
	const passes = document.getElementById("passes");
	const stroke = document.getElementById("stroke");
	const change = cback => {
		return e => {
			cback.apply(render, [e.target.value]);
			const out = e.target.parentNode.querySelector(".out");
			out.innerText = e.target.value;
			render.render(lines, canvas);
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
	const lines = [currentLine];

	color.onchange = e => {
		currentLine.setColor(Color.fromRGBString(color.value));
	};

	pad.onmousedown = e => {
		isDrawing = true;
	};
	pad.onmouseup = e => {
		isDrawing = false;

		currentLine = new Line(Color.fromRGBString(color.value));
		lines.push(currentLine);
	};
	pad.onmousemove = e => {
		if (isDrawing) {
			currentLine.add(new Point(e.offsetX, e.offsetY));
			render.render(lines, canvas);
		}
	};

	const undo = document.getElementById("undo");
	undo.onclick = e => {
		lines.pop();
		if (lines.length > 0) {
			lines.pop();
		}
		currentLine = new Line(Color.fromRGBString(color.value));
		lines.push(currentLine);
		render.render(lines, canvas);
	};

	const dload = document.getElementById("download-svg");
	dload.onclick = e => {
		const date = new Date().toISOString().replace(/[^-a-z0-9]/gi, '-');
		const fname = `freehand-${date}.svg`;

		const resp = confirm(`Download ${fname}?`);
		if (!resp) return false;

		const svg = SVGWriter.cloneFrom(pad);
		render.render(lines, svg);

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
		canvas.width += canvas.width/2;
		canvas.init();
		render.render(lines, canvas);
	};
	document.getElementById("plus-right").onclick = e => {
		canvas.width += canvas.width/2;
		canvas.init();
		render.render(lines, canvas);
	};
	document.getElementById("plus-top").onclick = e => {
		shiftLinesBy(lines, 0, canvas.height/2);
		canvas.height += canvas.height/2;
		canvas.init();
		render.render(lines, canvas);
	};
	document.getElementById("plus-bottom").onclick = e => {
		canvas.height += canvas.height/2;
		canvas.init();
		render.render(lines, canvas);
	};
}

window.onload = init;
