class Render {
	setSmoothing(val) { this.smoothing = val; }
	setPasses(val) { this.passes = val; }
	setStroke(val) { this.stroke = val; }

	render(lines, writer) {
		writer.reset();
		let passes = this.passes;
		if (passes < 1) passes = 1;

		for (let line of lines) {
			for (let i=1; i < passes; i++) {
				let ratio = i / passes;
				line = smoothPass(line, Math.floor(ratio * this.smoothing));
				writer.renderLine(line, this.stroke * ratio, `rgba(0,0,0,${ratio})`);
			}
		}
		for (let line of lines) {
			writer.renderLine(smooth(line, this.smoothing, passes), this.stroke, "black");
		}
	}
}

class Writer {
	reset() { throw new Error("implement reset"); }
	renderLine() { throw new Error("implement renderLine"); }
}

class CanvasWriter extends Writer {
	constructor(el) {
		super();
		this.el = el;
	}

	init() {
		this.el.width = this.el.offsetWidth;
		this.el.height = this.el.offsetHeight;
	}

	reset() {
		const ctx = this.el.getContext("2d");
		ctx.fillStyle = "blanchedalmond";
		ctx.strokeStyle = "none";
		ctx.rect(0, 0, this.el.offsetWidth, this.el.offsetHeight);
		ctx.fill();
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


async function init() {
	const pad = document.getElementById("drawing");
	const canvas = new CanvasWriter(pad);
	const render = new Render();

	window.onresize = e => {
		console.log("resize");
		canvas.init();
	};

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

	let isDrawing = false;
	let currentLine = 0;
	const lines = [[]];
	pad.onmousedown = e => {
		isDrawing = true;
	};
	pad.onmouseup = e => {
		isDrawing = false;
		currentLine += 1;
		lines.push([]);
	};
	pad.onmousemove = e => {
		if (isDrawing) {
			const dot = [e.offsetX, e.offsetY];
			lines[currentLine].push(dot);
			render.render(lines, canvas);
		}
	};

	const undo = document.getElementById("undo");
	undo.onclick = e => {
		lines.pop();
		if (currentLine > 0) {
			currentLine -= 1;
			lines.pop();
		}
		lines.push([]);
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
}

window.onload = init;
