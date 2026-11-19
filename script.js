"use strict";

const today = new Date();
const dateElement = document.querySelector("#today-date");
const localDate = [
	today.getFullYear(),
	String(today.getMonth() + 1).padStart(2, "0"),
	String(today.getDate()).padStart(2, "0"),
].join("-");

dateElement.dateTime = localDate;
dateElement.textContent = new Intl.DateTimeFormat("ko-KR", {
	dateStyle: "long",
}).format(today);

const summaryElement = document.querySelector(".intro__summary");
const nameElement = document.querySelector("h1");
const originalSummary = "AI대해서 공부하고 배우는 사람";
const alternateSummary = "ai로 게임을 만드는 사람";
const originalName = nameElement.textContent;
const glitchCharacters = "アイウエオ#$%&01";
let glitchTimeout;
let nameGlitchTimeout;

function showTextGlitch(element, text, saveTimeout) {
	element.classList.add("is-glitching");
	const endTime = Date.now() + 420;

	function updateGlitch() {
		const remainingTime = endTime - Date.now();
		if (remainingTime <= 0) {
			element.textContent = text;
			element.classList.remove("is-glitching");
			return;
		}

		const progress = 1 - remainingTime / 420;
		element.textContent = [...text]
			.map((character) => Math.random() < progress
				? character
				: glitchCharacters[Math.floor(Math.random() * glitchCharacters.length)])
			.join("");
		saveTimeout(setTimeout(updateGlitch, 45));
	}

	updateGlitch();
}

function showAlternateSummary() {
	clearTimeout(glitchTimeout);
	showTextGlitch(summaryElement, alternateSummary, (timeout) => { glitchTimeout = timeout; });
}

function restoreOriginalSummary() {
	clearTimeout(glitchTimeout);
	summaryElement.classList.remove("is-glitching");
	summaryElement.textContent = originalSummary;
}

function showNameGlitch() {
	clearTimeout(nameGlitchTimeout);
	showTextGlitch(nameElement, originalName, (timeout) => { nameGlitchTimeout = timeout; });
}

function restoreOriginalName() {
	clearTimeout(nameGlitchTimeout);
	nameElement.classList.remove("is-glitching");
	nameElement.textContent = originalName;
}

summaryElement.addEventListener("mouseenter", showAlternateSummary);
summaryElement.addEventListener("mouseleave", restoreOriginalSummary);
summaryElement.addEventListener("focus", showAlternateSummary);
summaryElement.addEventListener("blur", restoreOriginalSummary);
nameElement.addEventListener("mouseenter", showNameGlitch);
nameElement.addEventListener("mouseleave", restoreOriginalName);
nameElement.addEventListener("focus", showNameGlitch);
nameElement.addEventListener("blur", restoreOriginalName);

document.querySelectorAll(".game-idea").forEach((card) => {
	const steps = [...card.querySelectorAll(".game-idea__step")];
	let activeStep = 0;
	let cycleInterval;
	let revealTimeout;

	function showStep(stepIndex) {
		clearTimeout(revealTimeout);
		card.classList.add("is-active", "is-glitching");
		steps.forEach((step) => { step.hidden = true; });
		activeStep = stepIndex;
		revealTimeout = setTimeout(() => {
			steps[stepIndex].hidden = false;
			card.classList.remove("is-glitching");
		}, 220);
	}

	function startCycle() {
		if (cycleInterval) return;
		showStep(0);
		cycleInterval = setInterval(() => {
			showStep((activeStep + 1) % steps.length);
		}, 5000);
	}

	function stopCycle() {
		clearInterval(cycleInterval);
		clearTimeout(revealTimeout);
		cycleInterval = undefined;
		card.classList.remove("is-active", "is-glitching");
		steps.forEach((step) => { step.hidden = true; });
	}

	card.addEventListener("mouseenter", startCycle);
	card.addEventListener("mouseleave", stopCycle);
	card.addEventListener("focus", startCycle);
	card.addEventListener("blur", stopCycle);
});

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const sky = ctx.createLinearGradient(0, 0, 0, 600);
sky.addColorStop(0, "#18221e");
sky.addColorStop(0.58, "#34453b");
sky.addColorStop(1, "#121a16");
ctx.fillStyle = sky;
ctx.fillRect(0, 0, 800, 600);

ctx.fillStyle = "#202b25";
ctx.beginPath();
ctx.moveTo(0, 185);
ctx.quadraticCurveTo(400, 68, 800, 185);
ctx.lineTo(800, 305);
ctx.quadraticCurveTo(400, 218, 0, 305);
ctx.closePath();
ctx.fill();
ctx.strokeStyle = "#a58d56";
ctx.lineWidth = 4;
ctx.beginPath();
ctx.moveTo(0, 185);
ctx.quadraticCurveTo(400, 68, 800, 185);
ctx.stroke();

function drawColumn(x, y, width, height) {
	ctx.fillStyle = "#8c8066";
	ctx.beginPath();
	ctx.moveTo(x - width * 0.42, y);
	ctx.lineTo(x + width * 0.42, y);
	ctx.lineTo(x + width * 0.32, y - height);
	ctx.lineTo(x - width * 0.32, y - height);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = "#d0ad61";
	ctx.fillRect(x - width * 0.48, y - height - 8, width * 0.96, 10);
	ctx.fillStyle = "#596454";
	ctx.fillRect(x - width * 0.56, y - 2, width * 1.12, 7);
}

[75, 185, 615, 735].forEach((x, index) => {
	drawColumn(x, 305 - (index % 2) * 18, 34, 90 + (index % 3) * 12);
});

const arena = ctx.createLinearGradient(0, 282, 0, 600);
arena.addColorStop(0, "#66705c");
arena.addColorStop(1, "#202e27");
ctx.fillStyle = arena;
ctx.beginPath();
ctx.ellipse(410, 440, 510, 190, 0, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = "#b89a5c";
ctx.lineWidth = 3;
for (const radius of [92, 164, 242, 328]) {
	ctx.beginPath();
	ctx.ellipse(410, 432, radius, radius * 0.34, 0, 0, Math.PI * 2);
	ctx.stroke();
}

ctx.strokeStyle = "rgba(20, 35, 27, 0.48)";
ctx.lineWidth = 2;
for (let index = 0; index < 10; index += 1) {
	const angle = (index / 10) * Math.PI * 2;
	ctx.beginPath();
	ctx.moveTo(410, 430);
	ctx.lineTo(410 + Math.cos(angle) * 380, 430 + Math.sin(angle) * 138);
	ctx.stroke();
}

drawColumn(350, 420, 66, 118);
drawColumn(592, 390, 44, 82);
ctx.fillStyle = "#a94e3c";
ctx.beginPath();
ctx.arc(500, 348, 19, 0, Math.PI * 2);
ctx.fill();
ctx.fillRect(488, 363, 24, 33);
ctx.beginPath();
ctx.arc(556, 371, 15, 0, Math.PI * 2);
ctx.fillStyle = "#8a9c91";
ctx.fill();
ctx.save();
ctx.translate(545, 374);
ctx.rotate(0.45);
ctx.fillStyle = "#c9d5c9";
ctx.fillRect(-4, -34, 8, 72);
ctx.restore();
