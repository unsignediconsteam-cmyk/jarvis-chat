const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

/* =========================
   🧠 VOZ PRO (SIN CORTES)
========================= */

let voiceQueue = [];
let speaking = false;

function speakQueue(text) {
	if (!text) return;

	voiceQueue.push(text);
	if (!speaking) processQueue();
}

function processQueue() {
	if (voiceQueue.length === 0) {
		speaking = false;
		return;
	}

	speaking = true;

	const text = voiceQueue.shift();

	const utterance = new SpeechSynthesisUtterance(text);

	let voices = speechSynthesis.getVoices();

	const femaleVoice =
		voices.find(v => v.lang === "es-ES" && /female|lucia|paula|monica/i.test(v.name)) ||
		voices.find(v => v.lang === "es-ES") ||
		voices[0];

	if (femaleVoice) utterance.voice = femaleVoice;

	utterance.lang = "es-ES";
	utterance.rate = 1.45;   // 🔥 más rápido
	utterance.pitch = 1.3;

	utterance.onend = () => {
		processQueue();
	};

	speechSynthesis.speak(utterance);
}

/* =========================
   📦 CHAT STATE
========================= */

let chatHistory = [
	{
		role: "assistant",
		content: "Sistema JARVIS en línea.",
	},
];

let isProcessing = false;

/* =========================
   ✍️ INPUT
========================= */

userInput.addEventListener("input", function () {
	this.style.height = "auto";
	this.style.height = this.scrollHeight + "px";
});

userInput.addEventListener("keydown", function (e) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

sendButton.addEventListener("click", sendMessage);

/* =========================
   🚀 ENVIAR MENSAJE
========================= */

async function sendMessage() {
	const message = userInput.value.trim();
	if (!message || isProcessing) return;

	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;

	addMessageToChat("user", message);

	userInput.value = "";
	userInput.style.height = "auto";

	typingIndicator?.classList.add("visible");

	chatHistory.push({ role: "user", content: message });

	try {
		const assistantMessageEl = document.createElement("div");
		assistantMessageEl.className = "message assistant-message";
		assistantMessageEl.innerHTML = "<p></p>";
		chatMessages.appendChild(assistantMessageEl);

		const assistantTextEl = assistantMessageEl.querySelector("p");

		const response = await fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages: chatHistory }),
		});

		if (!response.ok || !response.body) {
			throw new Error("Error API");
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();

		let buffer = "";
		let responseText = "";

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			const parsed = consumeSseEvents(buffer);
			buffer = parsed.buffer;

			for (const data of parsed.events) {
				if (data === "[DONE]") continue;

				try {
					const json = JSON.parse(data);

					let content = "";

					if (json.response) {
						content = json.response;
					} else if (json.choices?.[0]?.delta?.content) {
						content = json.choices[0].delta.content;
					}

					if (content) {
						responseText += content;

						assistantTextEl.textContent = responseText;
						chatMessages.scrollTop = chatMessages.scrollHeight;

						/* =========================
						   🔊 VOZ EN TIEMPO REAL (CLAVE)
						========================= */

						// cortar en frases naturales
						const parts = responseText.split(/[.,!?]/);
						const last = parts.slice(-2).join(" ").trim();

						if (last.length > 25) {
							speakQueue(last);
						}

						// HUD hook si lo tienes
						if (window.setHUD) {
							setHUD("PROCESSING", "SPEAKING");
						}
					}
				} catch (e) {}
			}
		}

		if (responseText.length > 0) {
			chatHistory.push({
				role: "assistant",
				content: responseText,
			});
		}

	} catch (err) {
		addMessageToChat("assistant", "Error del sistema.");
	} finally {
		typingIndicator?.classList.remove("visible");

		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		userInput.focus();

		if (window.setHUD) {
			setHUD("ONLINE", "READY");
		}
	}
}

/* =========================
   💬 UI
========================= */

function addMessageToChat(role, content) {
	const messageEl = document.createElement("div");
	messageEl.className = `message ${role}-message`;
	messageEl.innerHTML = `<p>${content}</p>`;
	chatMessages.appendChild(messageEl);
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* =========================
   SSE PARSER
========================= */

function consumeSseEvents(buffer) {
	let normalized = buffer.replace(/\r/g, "");
	const events = [];
	let eventEndIndex;

	while ((eventEndIndex = normalized.indexOf("\n\n")) !== -1) {
		const raw = normalized.slice(0, eventEndIndex);
		normalized = normalized.slice(eventEndIndex + 2);

		const lines = raw.split("\n");
		const dataLines = [];

		for (const line of lines) {
			if (line.startsWith("data:")) {
				dataLines.push(line.slice(5).trim());
			}
		}

		if (dataLines.length) {
			events.push(dataLines.join("\n"));
		}
	}

	return { events, buffer: normalized };
}
