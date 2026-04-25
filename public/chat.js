document.addEventListener("DOMContentLoaded", () => {

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const micBtn = document.getElementById("mic-btn");
const typingIndicator = document.getElementById("typing-indicator");

if (!chatMessages || !userInput || !sendButton) {
	console.error("DOM roto");
	return;
}

/* =========================
   🧠 CHAT STATE
========================= */
let chatHistory = [
	{ role: "assistant", content: "Sistema listo." }
];

let isProcessing = false;

/* =========================
   🔊 VOZ FINAL PRO (SIN TOCAR NADA MÁS)
========================= */

let voiceQueue = [];
let speaking = false;

function speakStream(text) {
	if (!text) return;

	const sentences = text
		.split(/(?<=[.!?])\s+/)
		.filter(Boolean);

	voiceQueue.push(...sentences);

	if (!speaking) playVoice();
}

function playVoice() {
	if (voiceQueue.length === 0) {
		speaking = false;
		return;
	}

	speaking = true;

	const sentence = voiceQueue.shift();

	const u = new SpeechSynthesisUtterance(sentence);
	const voices = speechSynthesis.getVoices();

	const voice =
		voices.find(v => v.lang === "es-ES") ||
		voices[0];

	if (voice) u.voice = voice;

	u.lang = "es-ES";
	u.rate = 1.5;
	u.pitch = 1.3;

	u.onend = playVoice;
	u.onerror = playVoice;

	speechSynthesis.cancel();
	speechSynthesis.speak(u);
}

/* =========================
   💬 UI
========================= */
function addMessage(role, text) {
	const div = document.createElement("div");
	div.className = `message ${role}-message`;
	div.textContent = text;
	chatMessages.appendChild(div);
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* =========================
   🚀 CHAT STREAMING
========================= */
async function sendMessage(textFromMic = null) {

	const message = textFromMic || userInput.value.trim();
	if (!message || isProcessing) return;

	isProcessing = true;

	userInput.value = "";
	userInput.disabled = true;
	sendButton.disabled = true;

	addMessage("user", message);
	chatHistory.push({ role: "user", content: message });

	typingIndicator && (typingIndicator.style.display = "block");

	try {

		const res = await fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages: chatHistory })
		});

		const reader = res.body.getReader();
		const decoder = new TextDecoder();

		let buffer = "";
		let fullText = "";

		const ai = document.createElement("div");
		ai.className = "message assistant-message";
		const p = document.createElement("p");
		ai.appendChild(p);
		chatMessages.appendChild(ai);

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			const parsed = parseSSE(buffer);
			buffer = parsed.buffer;

			for (const ev of parsed.events) {

				if (ev === "[DONE]") continue;

				try {
					const json = JSON.parse(ev);

					let text =
						json.response ||
						json.choices?.[0]?.delta?.content ||
						"";

					if (text) {
						fullText += text;
						p.textContent = fullText;
						chatMessages.scrollTop = chatMessages.scrollHeight;
					}

				} catch {}
			}
		}

		if (fullText) {
			chatHistory.push({ role: "assistant", content: fullText });

			// 🔥 VOZ FLUIDA FINAL
			speakStream(fullText);
		}

	} catch (e) {
		addMessage("assistant", "Error del sistema.");
	}

	isProcessing = false;
	userInput.disabled = false;
	sendButton.disabled = false;

	typingIndicator && (typingIndicator.style.display = "none");
}

/* =========================
   🎤 MICRÓFONO
========================= */

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const rec = SR ? new SR() : null;

if (rec) {
	rec.lang = "es-ES";
	rec.continuous = false;

	rec.onresult = (e) => {
		const text = e.results[0][0].transcript;
		sendMessage(text);
	};
}

if (micBtn) {
	micBtn.onclick = () => rec && rec.start();
}

/* =========================
   SSE PARSER
========================= */
function parseSSE(buffer) {
	let clean = buffer.replace(/\r/g, "");
	const events = [];

	let i;
	while ((i = clean.indexOf("\n\n")) !== -1) {
		const raw = clean.slice(0, i);
		clean = clean.slice(i + 2);

		const lines = raw.split("\n");
		const data = lines
			.filter(l => l.startsWith("data:"))
			.map(l => l.replace("data:", "").trim())
			.join("\n");

		if (data) events.push(data);
	}

	return { events, buffer: clean };
}

/* =========================
   EVENTS
========================= */
sendButton.onclick = () => sendMessage();

userInput.addEventListener("keydown", (e) => {
	if (e.key === "Enter") {
		e.preventDefault();
		sendMessage();
	}
});

});
