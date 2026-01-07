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

function render(lines, smoothing, passes) {
	const pad = document.getElementById("drawing");
	const ctx = pad.getContext("2d");

	ctx.fillStyle = "blanchedalmond";
	ctx.strokeStyle = "none";
	ctx.rect(0, 0, pad.offsetWidth, pad.offsetHeight);
	ctx.fill();

	const svg = document.getElementById("export");
	svg.innerHTML = '';

	if (passes < 1) passes = 1;
	for (let line of lines) {
		for (let i=1; i < passes; i++) {
			let coeff = smoothing - i;
			line = smoothPass(line, coeff);
			let opacity = i / passes;
			renderLine(ctx, line, `rgba(0,0,0,${opacity})`);
		}
	}
	for (let line of lines) {
		renderLine(ctx, smooth(line, smoothing, passes), "black");
	}
}

function renderLine(ctx, dots, color) {
	if (dots.length < 2) return;

	ctx.fillStyle = "none";
	ctx.strokeStyle = color;

	let dot = dots[0];
	ctx.beginPath();
	for (let i = 1; i < dots.length; i++) {
		ctx.moveTo(dot[0], dot[1]);
		dot = dots[i];
		ctx.lineTo(dot[0], dot[1]);
	}
	ctx.closePath();
	ctx.stroke();

	renderLineSvg(dots, color);
}

function renderLineSvg(dots, color) {
	if (dots.length < 2) return;

	const svg = document.getElementById("export");
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
	path.setAttribute("stroke-width", "2");
	path.setAttribute("fill", "none");
	svg.appendChild(path);
}

async function init() {
	const smoothing = document.getElementById("smoothing");
	const passes = document.getElementById("passes");
	const change = e => {
		const out = e.target.parentNode.querySelector(".out");
		out.innerText = e.target.value;
		render(lines, smoothing.value || 1, passes.value || 1);
	};
	smoothing.oninput = change;
	passes.oninput = change;

	const svg = document.getElementById("export");
	const dims = svg.getBoundingClientRect();
	svg.setAttribute("viewBox", `0 0 ${dims.width} ${dims.height}`);

	const pad = document.getElementById("drawing");
	pad.width = pad.offsetWidth;
	pad.height = pad.offsetHeight;

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
			render(lines, smoothing.value || 1, passes.value || 1);
		}
	};
}

window.onload = init;
