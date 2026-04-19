import {
	useState,
	useRef,
	useEffect,
	useCallback,
	type KeyboardEvent,
} from "react";
import { Link } from "react-router-dom";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
	Bot,
	Send,
	Copy,
	Download,
	ChevronLeft,
	FileText,
	Check,
	Loader2,
	User,
} from "lucide-react";

// --- Tipado ---
interface Message {
	role: "user" | "assistant";
	text: string;
}

interface AIResponse {
	chat_message: string;
	document_content: string | null;
}

// Capturamos la fecha real del sistema del usuario
const fechaHoy = new Date().toLocaleDateString("es-AR", {
	day: "numeric",
	month: "long",
	year: "numeric",
});

// --- System Prompt ---
const SYSTEM_PROMPT = `Actúa como el Asistente Administrativo experto de una Universidad Nacional en Argentina. Tu trabajo es guiar a los estudiantes para redactar notas formales (ej. prórrogas, mesas especiales). Haz preguntas cortas y amables para obtener ÚNICAMENTE estos 5 datos: Nombre, DNI, Registro, Destinatario y Motivo.

REGLA ESTRICTA DE FORMATO: TODAS tus respuestas, desde ahora y para siempre, DEBEN ser un objeto JSON válido con exactamente estas dos propiedades:
1. "chat_message": (string) El texto que le envías al usuario en el chat.
2. "document_content": (string o null) El texto completo de la nota administrativa terminada, o null si todavía estás haciendo preguntas.

REGLA DE ENTREGA (CONTENEDOR HERMÉTICO): 
Para evitar que tus procesos de pensamiento interfieran con el sistema, tu respuesta final DEBE estar envuelta exactamente entre las etiquetas <OUTPUT> y </OUTPUT>. 
Ejemplo exacto de cómo debes responder al final:
<OUTPUT>
{
  "chat_message": "Tu mensaje aquí...",
  "document_content": "El documento completo aquí..."
}
</OUTPUT>

REGLA DE CONTENIDO Y ANTI-PEREZA (LAZY GENERATION): 
Está ESTRICTAMENTE PROHIBIDO resumir el texto, usar abreviaciones o colocar puntos suspensivos ("..."). Debes generar y devolver el contenido COMPLETO de la nota en "document_content" y el mensaje COMPLETO en "chat_message" en cada respuesta. Usa EXCLUSIVAMENTE los datos provistos por el usuario. ESTÁ ESTRICTAMENTE PROHIBIDO inventar datos extra, pedir número de legajo, carrera, o dejar espacios en blanco con corchetes como "[ESPACIO PARA LEGAJO]" o "[Completar]". Si un dato secundario no fue pedido, simplemente omítelo en la redacción de la nota.

Formato de la nota: Cuando llenes "document_content", la nota DEBE comenzar estrictamente con "San Juan, ${fechaHoy}" alineado a la derecha, seguido del destinatario. Usa lenguaje institucional. Termina con "Atentamente," y espacio para firma y aclaración.`;

// Inicializamos la IA
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
	model: "gemma-4-31b-it",
	systemInstruction: SYSTEM_PROMPT,
	generationConfig: { responseMimeType: "application/json" },
});

async function getGeminiResponse(
	userText: string,
	history: Message[],
): Promise<AIResponse> {
	try {
		let chatHistory = history.map((m) => ({
			role: m.role === "user" ? "user" : "model",
			parts: [{ text: m.text }],
		}));

		while (chatHistory.length > 0 && chatHistory[0].role === "model") {
			chatHistory.shift();
		}

		const chat = model.startChat({ history: chatHistory });
		const result = await chat.sendMessage(userText);
		let responseText = result.response.text();

		responseText = extractGuaranteedJSON(responseText);
		responseText = responseText
			.replace(/```json/g, "")
			.replace(/```/g, "")
			.trim();
		console.log("Respuesta cruda de Gemini:", result.response.text());
		const parsedData = JSON.parse(responseText);
		console.log("Respuesta parseada de Gemini:", parsedData);

		return {
			chat_message:
				parsedData.chat_message ||
				parsedData.text ||
				parsedData.mensaje ||
				"Recibido. Sigamos.",
			document_content: parsedData.document_content || null,
		} as AIResponse;
	} catch (error) {
		console.error("🔴 ERROR DETALLADO DE GEMINI:", error);
		throw error;
	}
}

function extractGuaranteedJSON(text: string): string {
	const startTag = "<OUTPUT>";
	const endTag = "</OUTPUT>";

	const startIndex = text.lastIndexOf(startTag);
	const endIndex = text.lastIndexOf(endTag);

	if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
		const jsonString = text
			.substring(startIndex + startTag.length, endIndex)
			.trim();
		return jsonString;
	}

	const fallbackStart = text.indexOf("{");
	const fallbackEnd = text.lastIndexOf("}");
	if (fallbackStart !== -1 && fallbackEnd !== -1) {
		return text.substring(fallbackStart, fallbackEnd + 1);
	}

	throw new Error("No se pudo extraer un JSON válido de la respuesta.");
}

// --- Descarga PDF usando iframe oculto con estilos de impresión ---
function downloadAsPDF(content: string, _fecha: string) {
	const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Nota Institucional</title>
  <style>
    @page {
      size: A4;
      margin: 2.5cm 3cm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      line-height: 1.8;
      color: #000;
      background: #fff;
    }
    pre {
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
    }
  </style>
</head>
<body>
  <pre>${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
</body>
</html>`;

	// Creamos un iframe invisible, lo llenamos con el HTML y disparamos print()
	const iframe = document.createElement("iframe");
	iframe.style.position = "fixed";
	iframe.style.top = "-9999px";
	iframe.style.left = "-9999px";
	iframe.style.width = "210mm";
	iframe.style.height = "297mm";
	iframe.style.border = "none";
	document.body.appendChild(iframe);

	const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
	if (!iframeDoc) {
		document.body.removeChild(iframe);
		return;
	}

	iframeDoc.open();
	iframeDoc.write(htmlContent);
	iframeDoc.close();

	// Esperamos a que cargue antes de imprimir
	iframe.onload = () => {
		try {
			iframe.contentWindow?.focus();
			iframe.contentWindow?.print();
		} finally {
			// Limpiamos el iframe después de un momento
			setTimeout(() => {
				document.body.removeChild(iframe);
			}, 1000);
		}
	};
}

// --- Componente principal ---
export default function DocuGen() {
	const [messages, setMessages] = useState<Message[]>([
		{
			role: "assistant",
			text: "¡Hola! 👋 Soy DocuGen, tu asistente para redactar notas formales. Para empezar, ¿podrías decirme tu nombre completo?",
		},
	]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [documentContent, setDocumentContent] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const scrollRef = useRef<HTMLDivElement>(null);
	// ✅ NUEVO: ref al input para hacer focus automático
	const inputRef = useRef<HTMLInputElement>(null);

	// Auto-scroll del chat
	useEffect(() => {
		scrollRef.current?.scrollTo({
			top: scrollRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [messages, isLoading]);

	// ✅ NUEVO: cuando isLoading pasa de true a false, devolvemos el foco al input
	useEffect(() => {
		if (!isLoading) {
			// Pequeño timeout para que el DOM termine de renderizar el mensaje antes del focus
			const timer = setTimeout(() => {
				inputRef.current?.focus();
			}, 50);
			return () => clearTimeout(timer);
		}
	}, [isLoading]);

	const handleSend = useCallback(async () => {
		const text = input.trim();
		if (!text || isLoading) return;

		const userMsg: Message = { role: "user", text };
		const historySnapshot = messages;
		setMessages((prev) => [...prev, userMsg]);
		setInput("");
		setIsLoading(true);

		try {
			console.log("1. Iniciando llamada...");
			console.log(
				"2. API Key configurada:",
				import.meta.env.VITE_GEMINI_API_KEY ? "SÍ" : "NO",
			);

			const response = await getGeminiResponse(text, historySnapshot);

			setMessages((prev) => [
				...prev,
				{ role: "assistant", text: response.chat_message },
			]);
			if (response.document_content !== null) {
				setDocumentContent(response.document_content);
			}
		} catch (err: any) {
			console.error("🔴 EL ERROR REAL DENTRO DE HANDLESEND ES:", err);

			let mensajeError =
				"Uy, algo falló al procesar tu mensaje. Probá de nuevo.";

			if (
				err.message &&
				(err.message.includes("503") || err.message.includes("high demand"))
			) {
				mensajeError =
					"⏳ Los servidores de Google Gemini están experimentando mucha demanda en este momento. Por favor, esperá unos segundos y volvé a intentar.";
			}

			setMessages((prev) => [
				...prev,
				{ role: "assistant", text: mensajeError },
			]);
		} finally {
			setIsLoading(false);
		}
	}, [input, isLoading, messages]);

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const handleCopy = async () => {
		if (!documentContent) return;
		try {
			await navigator.clipboard.writeText(documentContent);
			setCopied(true);
			setTimeout(() => setCopied(false), 1800);
		} catch {
			/* no-op */
		}
	};

	// ✅ NUEVO: descarga PDF real usando iframe oculto
	const handleDownloadPDF = () => {
		if (!documentContent) return;
		downloadAsPDF(documentContent, fechaHoy);
	};

	void SYSTEM_PROMPT;

	return (
		<div className="animate-in fade-in duration-500 -mx-4 -my-8">
			{/* Header con breadcrumb */}
			<div className="max-w-7xl mx-auto px-4 pt-6 pb-4">
				<Link
					to="/"
					className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-sky-400 transition-colors"
				>
					<ChevronLeft size={16} />
					Volver al Hub
				</Link>
			</div>

			{/* Split screen */}
			<div className="max-w-7xl mx-auto px-4 pb-8">
				<div className="grid grid-cols-1 lg:grid-cols-[35%_65%] rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/50 h-[calc(100vh-13rem)] min-h-[600px]">
					{/* ====== Columna Izquierda: Chat ====== */}
					<aside className="flex flex-col border-r border-slate-800 bg-slate-950/60 min-h-0">
						{/* Header chat */}
						<header className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
							<div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
								<Bot size={22} />
							</div>
							<div>
								<h2 className="font-bold text-slate-50 leading-tight">
									DocuGen AI
								</h2>
								<p className="text-xs text-slate-400">
									Asistente de Redacción Institucional
								</p>
							</div>
						</header>

						{/* Historial */}
						<div
							ref={scrollRef}
							className="flex-1 overflow-y-auto px-4 py-5 space-y-3 scroll-smooth"
						>
							{messages.map((msg, idx) => (
								<MessageBubble key={idx} message={msg} />
							))}
							{isLoading && (
								<div className="flex items-center gap-2 text-slate-400 text-sm pl-2">
									<Loader2 size={14} className="animate-spin" />
									<span>DocuGen está escribiendo…</span>
								</div>
							)}
						</div>

						{/* Input */}
						<div className="border-t border-slate-800 p-3 bg-slate-950/80">
							<div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 focus-within:border-sky-500/60 transition-colors">
								<input
									ref={inputRef} // ✅ ref conectado
									type="text"
									value={input}
									onChange={(e) => setInput(e.target.value)}
									onKeyDown={handleKeyDown}
									placeholder="Escribí tu respuesta…"
									disabled={isLoading}
									className="flex-1 bg-transparent outline-none text-sm text-slate-100 placeholder:text-slate-500 disabled:opacity-60"
								/>
								<button
									onClick={handleSend}
									disabled={!input.trim() || isLoading}
									className="p-2 rounded-lg bg-sky-500 text-white hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
									aria-label="Enviar mensaje"
								>
									<Send size={16} />
								</button>
							</div>
							<p className="text-[11px] text-slate-500 mt-2 px-1">
								Presioná Enter para enviar
							</p>
						</div>
					</aside>

					{/* ====== Columna Derecha: Visor documento ====== */}
					<section className="flex flex-col bg-slate-200 min-h-0">
						{/* Toolbar */}
						<header className="px-5 py-3 border-b border-slate-300 bg-slate-100 flex items-center justify-between">
							<div className="flex items-center gap-2 text-slate-700">
								<FileText size={18} className="text-sky-600" />
								<span className="font-semibold text-sm">
									Vista previa del documento
								</span>
							</div>
							<div className="flex items-center gap-2">
								<button
									onClick={handleCopy}
									disabled={!documentContent}
									className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								>
									{copied ? (
										<>
											<Check size={14} className="text-emerald-600" />
											Copiado
										</>
									) : (
										<>
											<Copy size={14} />
											Copiar texto
										</>
									)}
								</button>
								<button
									onClick={handleDownloadPDF}
									disabled={!documentContent}
									className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								>
									<Download size={14} />
									Descargar PDF
								</button>
							</div>
						</header>

						{/* Canvas del documento */}
						<div className="flex-1 overflow-y-auto p-6 lg:p-10">
							<div
								className="bg-white shadow-lg mx-auto p-8 lg:p-12 text-slate-900 rounded-sm"
								style={{
									width: "100%",
									maxWidth: "780px",
									minHeight: "1000px",
									aspectRatio: "1 / 1.414",
								}}
							>
								{documentContent ? (
									<pre className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-slate-800">
										{documentContent}
									</pre>
								) : (
									<EmptyDocumentState />
								)}
							</div>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}

// --- Subcomponentes ---
function MessageBubble({ message }: { message: Message }) {
	const isUser = message.role === "user";
	return (
		<div
			className={`flex items-start gap-2 ${isUser ? "justify-end" : "justify-start"}`}
		>
			{!isUser && (
				<div className="shrink-0 w-7 h-7 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center">
					<Bot size={14} />
				</div>
			)}
			<div
				className={`max-w-[82%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
					isUser
						? "bg-slate-100 text-slate-900 rounded-br-sm"
						: "bg-blue-50 text-slate-800 rounded-bl-sm"
				}`}
			>
				{message.text}
			</div>
			{isUser && (
				<div className="shrink-0 w-7 h-7 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center">
					<User size={14} />
				</div>
			)}
		</div>
	);
}

function EmptyDocumentState() {
	return (
		<div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center text-slate-400 select-none">
			<FileText size={56} className="mb-4 text-slate-300" />
			<h3 className="text-lg font-semibold text-slate-500">
				Tu nota aparecerá acá
			</h3>
			<p className="text-sm mt-2 max-w-xs text-slate-400">
				Respondé las preguntas del asistente en el panel de la izquierda y
				DocuGen redactará la nota institucional por vos.
			</p>
		</div>
	);
}
