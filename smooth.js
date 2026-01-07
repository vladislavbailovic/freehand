function smooth(dots, smoothing, passes) {
	let ret = dots;

	for (let i = 0; i < passes; i++) {
		ret = smoothPass(ret, smoothing);
	}

	return ret;
}

function smoothPass(dots, smoothing) {
	if (dots.length <= smoothing) return dots;
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

	ctx.fillStyle = "none";
	ctx.strokeStyle = "red";
	for (let line of lines) renderLine(ctx, line, 0, 0);

	ctx.fillStyle = "none";
	ctx.strokeStyle = "black";
	for (let line of lines) renderLine(ctx, line, smoothing, passes);
}

function renderLine(ctx, raw, smoothing, passes) {
	if (raw.length < 2) return;

	const dots = smooth(raw, smoothing, passes);
	if (dots.length < 2) return;

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

async function init() {
	const pad = document.getElementById("drawing");
	const smoothing = document.getElementById("smoothing");
	const passes = document.getElementById("passes");

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

	const change = e => {
		const out = e.target.parentNode.querySelector(".out");
		out.innerText = e.target.value;
		render(lines, smoothing.value || 1, passes.value || 1);
	};
	smoothing.oninput = change;
	passes.oninput = change;

}

window.onload = init;
