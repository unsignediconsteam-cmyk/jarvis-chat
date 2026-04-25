const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

/* =========================
   🔊 VOZ JARVIS PRO
========================= */
const speak = (text) => {
	if (!text) return;

	const utterance = new SpeechSynthesisUtterance(text);

	let voices = speechSynthesis.getVoices();

	// 🔥 fix iOS / carga tardía voces
	if (!voices || voices.length === 0) {
		speechSynthesis.onvoiceschanged = () => {
			voices = speechSynthesis.getVoices();
		};
	}

	// 🧠 mejor voz disponible
	const voice =
		voices.find(v => v.lang === "es-ES" && v.name.toLowerCase().includes("google")) ||
		voices.find(v => v.lang === "es-ES") ||
		voices.find(v => v.lang.includes("es")) ||
		voices[0];

	if (voice) utterance.voice = voice;

	utterance.lang = "es-ES";
	utterance.rate = 1.05;
	utterance.pitch = 0.85;
	utterance.volume = 1;

	speechSynthesis.cancel();
	speechSynthesis.speak(utterance);
};

/* =========================
   💥 DESBLOQUEO VOZ iOS
========================= */
window.addEventListener("click", () => {
	speechSynthesis.getVoices();
});

/* =========================
   📦 CHAT STATE
========================= */
let chatHistory = [
	{
		role: "assistant",
		content: "Buenos días señor. JARVIS está en línea.",
	},
];

let isProcessing = false;

/* =========================
   ✍️ INPUT UI
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
   🎤 MICRÓFONO
========================= */
const SpeechRecognition =
	window.SpeechRecognition || window.webkitSpeechRecognition;

const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
	recognition.lang = "es-ES";
	recognition.continuous = false;

	recognition.onresult = (event) => {
		const text = event.results[0][0].transcript;
		userInput.value = text;
		sendMessage();
	};
}

function startMic() {
	if (recognition) recognition.start();
}

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

	typingIndicator.classList.add("visible");

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
			throw new Error("Error en respuesta");
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
					}
				} catch (e) {}
			}
		}

		if (responseText.length > 0) {
			chatHistory.push({ role: "assistant", content: responseText });

			// 🔊 VOZ JARVIS
			speak(responseText);
		}
	} catch (error) {
		addMessageToChat(
			"assistant",
			"Error del sistema. No he podido procesar la solicitud."
		);
	} finally {
		typingIndicator.classList.remove("visible");

		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		userInput.focus();
	}
}

/* =========================
   💬 UI CHAT
========================= */
function addMessageToChat(role, content) {
	const messageEl = document.createElement("div");
	messageEl.className = `message ${role}-message`;
	messageEl.innerHTML = `<p>${content}</p>`;
	chatMessages.appendChild(messageEl);
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* =========================
   🧠 SSE PARSER
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
