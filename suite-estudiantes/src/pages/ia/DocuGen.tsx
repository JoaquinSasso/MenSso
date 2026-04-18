import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
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

// --- System Prompt (para integración real con OpenAI/Gemini) ---
const SYSTEM_PROMPT = `Actúa como el Asistente Administrativo experto de una Universidad Nacional en Argentina. Tu trabajo es guiar a los estudiantes para redactar notas formales (ej. prórrogas, mesas especiales). Haz preguntas cortas y amables de a una por vez para obtener: Nombre, DNI, Destinatario y Motivo.
Cuando tengas todos los datos, tu respuesta debe ser en formato JSON con dos propiedades:
1. "chat_message": Un mensaje avisando que la nota está lista.
2. "document_content": El texto completo de la nota. La nota DEBE comenzar con "San Juan, [Fecha]" alineado a la derecha, seguido del destinatario. Usa lenguaje institucional. Termina con "Atentamente," y espacio para firma y aclaración.
Mientras falten datos, "document_content" debe ser null.`;

// --- Simulador de IA (mock) ---
// Flujo simplificado por turnos: pregunta nombre -> DNI -> destinatario -> motivo -> genera nota.
async function simulateAIResponse(
    userText: string,
    history: Message[]
): Promise<AIResponse> {
    const delay = 700 + Math.random() * 600;
    await new Promise((res) => setTimeout(res, delay));

    // Cuántos turnos del usuario llevamos (incluyendo el actual)
    const userTurns = history.filter((m) => m.role === "user").length + 1;

    // Tomamos los textos del usuario en orden para "recordar" datos previos
    const userMessages = [
        ...history.filter((m) => m.role === "user").map((m) => m.text),
        userText,
    ];

    switch (userTurns) {
        case 1:
            return {
                chat_message:
                    "¡Hola! 👋 Soy DocuGen, tu asistente para redactar notas formales. Para empezar, ¿podrías decirme tu nombre completo?",
                document_content: null,
            };
        case 2:
            return {
                chat_message: `Un gusto, ${userText}. Ahora necesito tu DNI (sin puntos, por favor).`,
                document_content: null,
            };
        case 3:
            return {
                chat_message:
                    "Perfecto. ¿A quién va dirigida la nota? (ej. Sr. Decano, Departamento de Alumnos, Cátedra de Algoritmos...)",
                document_content: null,
            };
        case 4:
            return {
                chat_message:
                    "Muy bien. Por último, contame brevemente el motivo de la nota (ej. solicitar prórroga de examen, mesa especial, etc.).",
                document_content: null,
            };
        default: {
            const [nombre, dni, destinatario, motivo] = userMessages;
            const fecha = new Date().toLocaleDateString("es-AR", {
                day: "numeric",
                month: "long",
                year: "numeric",
            });

            const documento = `                                                                San Juan, ${fecha}

${destinatario ?? ""}
S               /               D

        De mi mayor consideración:

        Me dirijo a Usted, y por su intermedio a quien corresponda, con el fin de ${motivo ?? ""}.

        Por lo expuesto, solicito tenga a bien considerar la presente solicitud, comprometiéndome a cumplir con los requisitos administrativos y académicos que se estimen pertinentes.

        Sin otro particular, y a la espera de una respuesta favorable, saluda a Usted atentamente.



                                                                    ............................
                                                                            Firma

                                                                    ${nombre ?? ""}
                                                                    DNI: ${dni ?? ""}
`;

            return {
                chat_message:
                    "¡Listo! 📄 Generé tu nota en el panel de la derecha. Podés copiar el texto o descargarlo. Si querés hacer algún ajuste, decime qué cambiar.",
                document_content: documento,
            };
        }
    }
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

    // Auto-scroll del chat
    useEffect(() => {
        scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth",
        });
    }, [messages, isLoading]);

    const handleSend = useCallback(async () => {
        const text = input.trim();
        if (!text || isLoading) return;

        const userMsg: Message = { role: "user", text };
        const historySnapshot = messages;
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            const response = await simulateAIResponse(text, historySnapshot);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", text: response.chat_message },
            ]);
            if (response.document_content !== null) {
                setDocumentContent(response.document_content);
            }
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    text: "Uy, algo falló al procesar tu mensaje. Probá de nuevo.",
                },
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

    const handleDownloadPDF = () => {
        // UI-only por ahora; lógica real de PDF se integra después.
        alert("La descarga en PDF estará disponible próximamente.");
    };

    // Silenciar warning de no-used en dev (el prompt se usará al conectar la API real)
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
