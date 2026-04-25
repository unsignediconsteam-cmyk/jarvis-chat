const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

/* =========================
   🔊 VOZ FEMENINA JARVIS
========================= */
const speak = (text) => {
	if (!text) return;

	const utterance = new SpeechSynthesisUtterance(text);

	let voices = speechSynthesis.getVoices();

	if (!voices || voices.length === 0) {
		speechSynthesis.onvoiceschanged = () => {
			voices = speechSynthesis.getVoices();
		};
	}

	// 💥 FORZAR VOZ FEMENINA
	const femaleVoice =
		voices.find(v =>
			v.lang === "es-ES" &&
			/victoria|carolina|monica|lucia|paula|google female/i.test(v.name)
		) ||
		voices.find(v => v.lang === "es-ES" && v.name.toLowerCase().includes("female")) ||
		voices.find(v => v.lang === "es-ES") ||
		voices.find(v => v.lang.includes("es")) ||
		voices[0];

	if (femaleVoice) utterance.voice = femaleVoice;

	utterance.lang = "es-ES";
	utterance.rate = 1.2;   // 🔥 más fluido
	utterance.pitch = 1.3;  // 🔥 voz femenina más marcada
	utterance.volume = 1;

	speechSynthesis.cancel();
	speechSynthesis.speak(utterance);
};

/* =========================
   🎤 WAKE WORD JARVIS
========================= */
const SpeechRecognition =
	window.SpeechRecognition || window.webkitSpeechRecognition;

const wakeRec = SpeechRecognition ? new SpeechRecognition() : null;

if (wakeRec) {
	wakeRec.lang = "es-ES";
	wakeRec.continuous = true;

	wakeRec.onresult = (event) => {
		const text =
			event.results[event.results.length - 1][0].transcript.toLowerCase();

		if (text.includes("jarvis")) {
			speak("Sí señor");
			startMic();
		}
	};

	wakeRec.start();
}

/* =========================
   🎤 MICRÓFONO
========================= */
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
	recognition.lang = "es-ES";

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

						// 🔥 voz en tiempo real
						speechSynthesis.cancel();
						speak(responseText);

						chatMessages.scrollTop = chatMessages.scrollHeight;
					}
				} catch (e) {}
			}
		}

		if (responseText.length > 0) {
			chatHistory.push({ role: "assistant", content: responseText });
		}
	} catch (error) {
		addMessageToChat("assistant", "Error del sistema.");
	} finally {
		typingIndicator.classList.remove("visible");

		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		userInput.focus();
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
