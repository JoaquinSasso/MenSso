import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
	ChevronLeft,
	Play,
	SkipForward,
	SkipBack,
	Square,
	Terminal,
	Database,
	Code,
} from "lucide-react";

// --- Tipos y Estructuras de Datos ---
export type TipoDato =
	| "entero"
	| "real"
	| "cadena"
	| "caracter"
	| "logico"
	| "arreglo"
	| "registro";

export interface VariableMemoria {
	nombre: string;
	tipo: TipoDato;
	valor: any;
	direccion: string;
	tamano?: number;
	baseIndex?: number;
}

export interface EstadoEjecucion {
	lineaActual: number | null;
	memoria: VariableMemoria[];
	consola: string[];
	terminado: boolean;
	error?: string;
}

// --- Motor de Ejecución Avanzado ---
function* ejecutarPasoAPaso(codigo: string): Generator<EstadoEjecucion> {
	const lineas = codigo.split("\n");
	const memoria: VariableMemoria[] = [];
	const consola: string[] = [];

	const saltos: Record<number, number> = {};
	const pilaBloques: { tipo: string; linea: number }[] = [];

	for (let i = 0; i < lineas.length; i++) {
		const ln = lineas[i].trim().toLowerCase();
		if (ln.startsWith("si ")) {
			pilaBloques.push({ tipo: "si", linea: i });
		} else if (ln === "sino") {
			const block = pilaBloques[pilaBloques.length - 1];
			if (block && block.tipo === "si") {
				saltos[block.linea] = i;
				block.tipo = "sino";
				block.linea = i;
			}
		} else if (ln === "finsi") {
			const block = pilaBloques.pop();
			if (block) saltos[block.linea] = i;
		} else if (ln.startsWith("para ")) {
			pilaBloques.push({ tipo: "para", linea: i });
		} else if (ln === "finpara") {
			const block = pilaBloques.pop();
			if (block) {
				saltos[block.linea] = i;
				saltos[i] = block.linea;
			}
		} else if (ln.startsWith("mientras ")) {
			pilaBloques.push({ tipo: "mientras", linea: i });
		} else if (ln === "finmientras") {
			const block = pilaBloques.pop();
			if (block) {
				saltos[block.linea] = i;
				saltos[i] = block.linea;
			}
		}
	}

	const evaluar = (expresion: string, lineaActual: number) => {
		let jsExpr = expresion
			.replace(/\bY\b/gi, "&&")
			.replace(/\bO\b/gi, "||")
			.replace(/\bNO\b/gi, "!")
			.replace(/=/g, "===")
			.replace(/>===/g, ">=")
			.replace(/<===/g, "<=")
			.replace(/!===/g, "!=");

		const varsLocal: Record<string, any> = {};

		memoria.forEach((v) => {
			if (v.tipo === "arreglo") {
				varsLocal[v.nombre] = new Proxy(v.valor, {
					get(target: any, prop: string | symbol) {
						if (typeof prop === "string" && prop.trim() !== "") {
							const idx = Number(prop);
							if (!isNaN(idx)) {
								if (idx === v.tamano && v.baseIndex === 0) v.baseIndex = 1;
								else if (idx === 0 && v.baseIndex === 1) v.baseIndex = 0;
							}
						}
						return target[prop];
					},
				});
			} else {
				varsLocal[v.nombre] = v.valor;
			}
		});

		try {
			const nombres = Object.keys(varsLocal);
			const valores = Object.values(varsLocal);
			jsExpr = jsExpr.replace(
				/([a-zA-Z_]\w*)\[(.+?)\]/g,
				(_match, arrName, indexExpr) => {
					return `${arrName}[${indexExpr}]`;
				},
			);
			const func = new Function(...nombres, `return ${jsExpr};`);
			return func(...valores);
		} catch (e) {
			throw new Error(
				`Error en línea ${lineaActual + 1}: No se pudo evaluar '${expresion}'. Revise la sintaxis.`,
			);
		}
	};

	let ip = 0;
	let enEjecucion = false;

	while (ip < lineas.length) {
		const lineaRaw = lineas[ip].trim();
		const linea = lineaRaw.toLowerCase();

		if (!lineaRaw || lineaRaw.startsWith("/*") || lineaRaw.startsWith("//")) {
			ip++;
			continue;
		}

		if (linea === "comienzo") {
			enEjecucion = true;
			ip++;
			continue;
		}
		if (linea === "fin") {
			break;
		}
		if (!enEjecucion) {
			ip++;
			continue;
		}

		const memoriaClonada = memoria.map((v) => ({
			...v,
			valor: Array.isArray(v.valor)
				? [...v.valor]
				: typeof v.valor === "object" && v.valor !== null
					? { ...v.valor }
					: v.valor,
		}));

		yield {
			lineaActual: ip,
			memoria: memoriaClonada,
			consola: [...consola],
			terminado: false,
		};

		try {
			const matchArreglo = lineaRaw.match(
				/^(entero|real|cadena|caracter|booleano|logico)\s+([a-zA-Z_]\w*)\[(\d+)\]/i,
			);
			if (matchArreglo) {
				const nombre = matchArreglo[2];
				const tamano = parseInt(matchArreglo[3]);
				memoria.push({
					nombre,
					tipo: "arreglo",
					tamano,
					valor: new Array(tamano + 1).fill(
						matchArreglo[1].toLowerCase() === "cadena" ? '""' : 0,
					),
					direccion: `0x${Math.floor(Math.random() * 0xffff)
						.toString(16)
						.toUpperCase()
						.padStart(4, "0")}`,
					baseIndex: 0,
				});
				ip++;
				continue;
			}

			const matchVar = lineaRaw.match(
				/^(entero|real|cadena|caracter|booleano|logico)\s+([a-zA-Z_]\w*)$/i,
			);
			if (matchVar) {
				const nombre = matchVar[2];
				const tipo = matchVar[1].toLowerCase() as TipoDato;
				memoria.push({
					nombre,
					tipo,
					valor: tipo === "cadena" ? '""' : 0,
					direccion: `0x${Math.floor(Math.random() * 0xffff)
						.toString(16)
						.toUpperCase()
						.padStart(4, "0")}`,
				});
				ip++;
				continue;
			}

			const matchAsignacionArr = lineaRaw.match(
				/^([a-zA-Z_]\w*)\[(.+?)\]\s*=\s*(.+)$/,
			);
			if (matchAsignacionArr) {
				const nombre = matchAsignacionArr[1];
				const idxExpr = matchAsignacionArr[2];
				const expr = matchAsignacionArr[3];
				const variable = memoria.find((v) => v.nombre === nombre);
				if (variable && variable.tipo === "arreglo") {
					const idxReal = evaluar(idxExpr, ip);
					if (idxReal < 0 || idxReal > (variable.tamano || 0)) {
						throw new Error(
							`Índice [${idxReal}] fuera de límites. El arreglo '${nombre}' tiene un tamaño de ${variable.tamano}.`,
						);
					}
					if (idxReal === variable.tamano && variable.baseIndex === 0)
						variable.baseIndex = 1;
					else if (idxReal === 0 && variable.baseIndex === 1)
						variable.baseIndex = 0;
					variable.valor[idxReal] = evaluar(expr, ip);
				} else {
					throw new Error(`El arreglo '${nombre}' no existe.`);
				}
				ip++;
				continue;
			}

			const matchAsig = lineaRaw.match(/^([a-zA-Z_]\w*(?:\.\w+)?)\s*=\s*(.+)$/);
			if (matchAsig) {
				const destino = matchAsig[1];
				const expr = matchAsig[2];
				if (destino.includes(".")) {
					const [regName, propName] = destino.split(".");
					let variable = memoria.find((v) => v.nombre === regName);
					if (!variable) {
						variable = {
							nombre: regName,
							tipo: "registro",
							valor: {},
							direccion: `0x${Math.floor(Math.random() * 0xffff)
								.toString(16)
								.toUpperCase()
								.padStart(4, "0")}`,
						};
						memoria.push(variable);
					}
					variable.valor[propName] = evaluar(expr, ip);
				} else {
					const variable = memoria.find((v) => v.nombre === destino);
					if (variable) variable.valor = evaluar(expr, ip);
					else throw new Error(`Variable no declarada '${destino}'`);
				}
				ip++;
				continue;
			}

			const matchSi = lineaRaw.match(/^Si\s*\((.+)\)\s*Entonces/i);
			if (matchSi) {
				const condicion = evaluar(matchSi[1], ip);
				if (!condicion) ip = saltos[ip];
				else ip++;
				continue;
			}

			const matchMientras = lineaRaw.match(/^Mientras\s*\((.+)\)/i);
			if (matchMientras) {
				const condicion = evaluar(matchMientras[1], ip);
				if (!condicion) ip = saltos[ip] + 1;
				else ip++;
				continue;
			}

			if (linea === "finmientras") {
				ip = saltos[ip];
				continue;
			}

			const matchPara = lineaRaw.match(
				/^Para\s+([a-zA-Z_]\w*)\s+desde\s+(.+)\s+hasta\s+(.+)/i,
			);
			if (matchPara) {
				const varControl = matchPara[1];
				let variable = memoria.find((v) => v.nombre === varControl);
				if (!variable)
					throw new Error(`Variable de control '${varControl}' no declarada.`);
				const inicio = evaluar(matchPara[2], ip);
				const fin = evaluar(matchPara[3], ip);
				if (variable.valor === 0 && inicio !== 0) variable.valor = inicio;
				if (variable.valor <= fin) {
					ip++;
				} else {
					ip = saltos[ip] + 1;
					variable.valor = 0;
				}
				continue;
			}

			if (linea === "finpara") {
				const lineaPara = lineas[saltos[ip]].trim();
				const varControl = lineaPara.match(/^Para\s+([a-zA-Z_]\w*)/i)?.[1];
				if (varControl) {
					const v = memoria.find((varMem) => varMem.nombre === varControl);
					if (v) v.valor += 1;
				}
				ip = saltos[ip];
				continue;
			}

			if (lineaRaw.toLowerCase().startsWith("escribir ")) {
				const argStr = lineaRaw.substring(9).trim();
				let salida = "";
				const argumentos = argStr.split(",").map((arg) => arg.trim());
				for (const arg of argumentos) {
					if (arg.startsWith('"') && arg.endsWith('"')) {
						salida += arg.slice(1, -1) + " ";
					} else {
						salida += evaluar(arg, ip) + " ";
					}
				}
				consola.push(salida.trim());
				ip++;
				continue;
			}

			if (linea === "sino" || linea === "finsi") {
				if (linea === "sino") ip = saltos[ip];
				else ip++;
				continue;
			}

			ip++;
		} catch (err: any) {
			yield {
				lineaActual: ip,
				memoria,
				consola,
				terminado: true,
				error: err.message,
			};
			return;
		}
	}

	yield { lineaActual: null, memoria, consola, terminado: true };
}

// Altura de línea fija en px — fuente de verdad compartida por las 3 capas del editor
const LINE_HEIGHT_PX = 24;

const ESTADO_INICIAL: EstadoEjecucion = {
	lineaActual: null,
	memoria: [],
	consola: [],
	terminado: false,
};

// --- Componente UI Principal ---
export default function InterpretePseudocodigo() {
	const [codigo, setCodigo] = useState<string>(
		`Algoritmo LiquidacionSueldo
Comienzo
  real sueldo_base
  real bono_categoria

  empleado.legajo = 1042
  empleado.categoria = 2
  empleado.horas_trabajadas = 160
  empleado.tarifa_hora = 2500.50

  empresa.nombre = "Tech UNSJ"
  empresa.sucursal = 3

  Escribir "Calculando liquidacion para el legajo", empleado.legajo

  sueldo_base = empleado.horas_trabajadas * empleado.tarifa_hora

  Si (empleado.categoria = 1) Entonces
    bono_categoria = 50000
  Sino
    bono_categoria = 20000
  FinSi

  recibo.empresa_emisora = empresa.nombre
  recibo.monto_base = sueldo_base
  recibo.monto_bono = bono_categoria
  recibo.total_pagar = sueldo_base + bono_categoria
  recibo.estado_pago = "Pendiente"

  Escribir "Recibo generado para la empresa", recibo.empresa_emisora
  Escribir "El total a transferir es", recibo.total_pagar
Fin`,
	);

	const [estado, setEstado] = useState<EstadoEjecucion>(ESTADO_INICIAL);

	// ✅ Historial de snapshots de estado para poder retroceder
	const historialRef = useRef<EstadoEjecucion[]>([]);
	const generadorRef = useRef<Generator<EstadoEjecucion> | null>(null);

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const lineNumbersRef = useRef<HTMLDivElement>(null);
	const highlightRef = useRef<HTMLDivElement>(null);

	// ✅ Auto-scroll: mantiene la línea activa centrada en el editor
	useEffect(() => {
		if (estado.lineaActual === null) return;
		const ta = textareaRef.current;
		if (!ta) return;
		const lineaY = estado.lineaActual * LINE_HEIGHT_PX;
		const padding = 16;
		const areaVisible = ta.clientHeight - padding * 2;
		const scrollActual = ta.scrollTop;
		if (
			lineaY < scrollActual + padding ||
			lineaY > scrollActual + areaVisible - LINE_HEIGHT_PX
		) {
			const nuevoScroll = lineaY - areaVisible / 2;
			ta.scrollTop = Math.max(0, nuevoScroll);
			if (lineNumbersRef.current)
				lineNumbersRef.current.scrollTop = ta.scrollTop;
			if (highlightRef.current) highlightRef.current.scrollTop = ta.scrollTop;
		}
	}, [estado.lineaActual]);

	// Re-crea el generador saltándose los primeros N yields (para restaurar posición al retroceder)
	const recrearGeneradorDesdeIndice = useCallback(
		(cod: string, indiceObjetivo: number): Generator<EstadoEjecucion> => {
			const gen = ejecutarPasoAPaso(cod);
			for (let i = 0; i < indiceObjetivo; i++) gen.next();
			return gen;
		},
		[],
	);

	const iniciarDepuracion = useCallback(() => {
		historialRef.current = [];
		generadorRef.current = ejecutarPasoAPaso(codigo);
		const { value } = generadorRef.current.next();
		if (value) {
			historialRef.current.push(value);
			setEstado(value);
		}
	}, [codigo]);

	// ✅ Avanzar: guarda snapshot antes de avanzar
	const avanzarPaso = useCallback(() => {
		if (!generadorRef.current) return;
		const { value, done } = generadorRef.current.next();
		if (value) {
			historialRef.current.push(value);
			setEstado(value);
		}
		if (done || value?.terminado) generadorRef.current = null;
	}, []);

	// ✅ Retroceder: extrae el snapshot anterior del historial y recrea el generador
	const retrocederPaso = useCallback(() => {
		const historial = historialRef.current;
		if (historial.length < 2) return;
		historial.pop(); // descarta el estado actual
		const estadoAnterior = historial[historial.length - 1];
		setEstado(estadoAnterior);
		// Recrea el generador posicionado justo después del índice anterior
		generadorRef.current = recrearGeneradorDesdeIndice(
			codigo,
			historial.length - 1,
		);
	}, [codigo, recrearGeneradorDesdeIndice]);

	const detener = useCallback(() => {
		generadorRef.current = null;
		historialRef.current = [];
		setEstado(ESTADO_INICIAL);
	}, []);

	const handleScroll = () => {
		const ta = textareaRef.current;
		if (!ta) return;
		if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = ta.scrollTop;
		if (highlightRef.current) {
			highlightRef.current.scrollTop = ta.scrollTop;
			highlightRef.current.scrollLeft = ta.scrollLeft;
		}
	};

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			const hayEjecucion =
				generadorRef.current !== null || historialRef.current.length > 0;
			if (!hayEjecucion) return;
			if (e.key === "F10" || (e.ctrlKey && e.key === "ArrowRight")) {
				e.preventDefault();
				avanzarPaso();
			} else if (e.key === "F9" || (e.ctrlKey && e.key === "ArrowLeft")) {
				e.preventDefault();
				retrocederPaso();
			} else if (e.key === "Escape") {
				e.preventDefault();
				detener();
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [avanzarPaso, retrocederPaso, detener]);

	const enEjecucion =
		generadorRef.current !== null || historialRef.current.length > 0;
	const puedeRetroceder = historialRef.current.length >= 2;
	const puedeAvanzar = generadorRef.current !== null && !estado.terminado;

	const numLineas = Math.max(codigo.split("\n").length, 20);
	const lineasArray = Array.from({ length: numLineas }, (_, i) => i + 1);

	return (
		<div className="space-y-4 max-w-7xl mx-auto animate-in fade-in duration-500 min-h-[90vh] flex flex-col pb-8">
			{/* Cabecera */}
			<div className="space-y-2">
				<Link
					to="/"
					className="inline-flex items-center gap-1 text-slate-400 hover:text-sky-400 transition-colors text-sm"
				>
					<ChevronLeft size={16} /> Volver al Hub
				</Link>
				<h1 className="text-2xl sm:text-3xl font-bold text-slate-50">
					Intérprete de Pseudocódigo
				</h1>
				<p className="text-slate-400 text-sm sm:text-base">
					Soporta <code>Si</code>, <code>Para</code>, <code>Mientras</code>,
					Registros y Arreglos. <br className="hidden sm:block" />
					<span className="text-sky-400/80 text-xs sm:text-sm mt-1.5 inline-block">
						💡 <strong>Tip:</strong> Puedes avanzar y retroceder paso a paso
						usando{" "}
						<kbd className="font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
							F10
						</kbd>{" "}
						/{" "}
						<kbd className="font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
							F9
						</kbd>{" "}
						o{" "}
						<kbd className="font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
							Ctrl + flechas (←/→)
						</kbd>
						.
					</span>
				</p>
			</div>

			{/* CONTROLES — solo Iniciar / Detener. Pasos en FAB flotante */}
			<div className="sticky top-16 z-40 flex items-center justify-between lg:justify-end gap-3 bg-slate-950/90 backdrop-blur-xl border-y border-slate-800 -mx-4 px-4 py-3 shadow-lg lg:static lg:bg-transparent lg:border-none lg:backdrop-blur-none lg:mx-0 lg:px-0 lg:py-0 lg:shadow-none">
				<div className="text-xs font-mono flex items-center gap-1.5">
					{enEjecucion ? (
						<>
							<span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
							<span className="text-sky-400 font-bold">En ejecución</span>
						</>
					) : (
						<>
							<span className="w-2 h-2 rounded-full bg-slate-500" />
							<span className="text-slate-400">Listo</span>
						</>
					)}
				</div>
				<div className="flex items-center gap-2">
					{!enEjecucion ? (
						<button
							onClick={iniciarDepuracion}
							className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-medium py-2 px-5 rounded-lg transition-colors text-sm shadow-md"
						>
							<Play size={16} fill="currentColor" /> Iniciar
						</button>
					) : (
						<button
							onClick={detener}
							className="flex items-center gap-2 bg-slate-800 hover:bg-rose-900/50 hover:text-rose-400 text-slate-300 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
						>
							<Square size={16} fill="currentColor" /> Detener
						</button>
					)}
				</div>
			</div>

			{/* Layout Dividido */}
			<div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
				{/* PANEL 1: Editor */}
				<div className="lg:col-span-6 flex flex-col bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
					<div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80">
						<div className="flex items-center gap-2 text-slate-300 font-medium">
							<Code size={18} className="text-sky-400" /> <span>Editor</span>
						</div>
						{estado.lineaActual !== null && (
							<span className="text-xs font-mono text-sky-400/80 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
								Línea {estado.lineaActual + 1}
							</span>
						)}
					</div>

					<div className="flex flex-1 min-h-[500px] md:min-h-[550px] lg:min-h-[75vh] xl:min-h-[80vh] bg-[#0A0D14] overflow-hidden">
						{/* Números de línea */}
						<div
							ref={lineNumbersRef}
							className="shrink-0 overflow-hidden select-none bg-slate-950/80 border-r border-slate-800/80"
							style={{
								width: "3rem",
								paddingTop: "1rem",
								paddingBottom: "1rem",
							}}
							aria-hidden="true"
						>
							{lineasArray.map((n) => (
								<div
									key={n}
									className={`flex items-center justify-end pr-3 font-mono text-sm transition-colors duration-150 ${
										estado.lineaActual === n - 1
											? "text-sky-400 font-bold"
											: "text-slate-600"
									}`}
									style={{ height: `${LINE_HEIGHT_PX}px` }}
								>
									{n}
								</div>
							))}
						</div>

						{/* Highlight + Textarea apilados */}
						<div className="flex-1 relative overflow-hidden">
							<div
								ref={highlightRef}
								className="absolute inset-0 overflow-hidden pointer-events-none"
								style={{
									paddingTop: "1rem",
									paddingBottom: "1rem",
									paddingLeft: "1rem",
									paddingRight: "1rem",
								}}
								aria-hidden="true"
							>
								{lineasArray.map((_, index) => (
									<div
										key={index}
										style={{ height: `${LINE_HEIGHT_PX}px` }}
										className={`w-full transition-colors duration-150 ${
											estado.lineaActual === index
												? "bg-sky-500/20 border-l-4 border-sky-400 -ml-4 pl-4"
												: "border-l-4 border-transparent -ml-4 pl-4"
										}`}
									/>
								))}
							</div>

							<textarea
								ref={textareaRef}
								value={codigo}
								onChange={(e) => setCodigo(e.target.value)}
								onScroll={handleScroll}
								disabled={enEjecucion}
								spellCheck="false"
								className="absolute inset-0 w-full h-full font-mono bg-transparent text-slate-300 resize-none outline-none disabled:opacity-80 overflow-auto scrollbar-thin scrollbar-thumb-slate-700"
								style={{
									fontSize: "14px",
									lineHeight: `${LINE_HEIGHT_PX}px`,
									paddingTop: "1rem",
									paddingBottom: "4rem",
									paddingLeft: "1rem",
									paddingRight: "1rem",
									tabSize: 4,
									WebkitFontSmoothing: "antialiased",
								}}
							/>
						</div>
					</div>
				</div>

				{/* PANEL 2: Memoria y Consola */}
				<div className="lg:col-span-6 flex flex-col gap-5 lg:gap-6">
					{/* Mapa de Memoria */}
					<div className="flex-1 flex flex-col bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl min-h-[300px] lg:min-h-[350px]">
						<div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex items-center gap-2 text-slate-300 font-medium text-sm sm:text-base">
							<Database size={18} className="text-emerald-400" />{" "}
							<span>Mapa de Memoria</span>
						</div>
						<div className="p-3 sm:p-4 flex-1 overflow-auto">
							{estado.memoria.length === 0 ? (
								<div className="flex h-full items-center justify-center text-slate-500 text-xs sm:text-sm text-center px-4 sm:px-8 border-2 border-dashed border-slate-800 rounded-xl">
									Inicia la ejecución para ver variables en memoria.
								</div>
							) : (
								<div className="space-y-3">
									{estado.memoria.map((variable, idx) => (
										<div
											key={idx}
											className="bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-inner transition-all duration-300"
										>
											<div className="flex items-center justify-between mb-2">
												<div className="flex items-center gap-2">
													<span className="font-bold text-sky-400 text-sm sm:text-base">
														{variable.nombre}
													</span>
													<span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-emerald-400/80 bg-emerald-950/50 border border-emerald-900/50 px-2 py-0.5 rounded-full">
														{variable.tipo}
													</span>
												</div>
												<span className="text-[9px] sm:text-[10px] font-mono text-slate-600 hidden xs:inline-block">
													{variable.direccion}
												</span>
											</div>

											{variable.tipo === "arreglo" ? (
												<div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
													{Array.isArray(variable.valor) &&
														variable.valor
															.map((val, i) => ({ val, i }))
															.filter(
																({ i }) =>
																	i >= (variable.baseIndex || 0) &&
																	i <
																		(variable.baseIndex || 0) +
																			(variable.tamano || 0),
															)
															.map(({ val, i }) => (
																<div
																	key={i}
																	className="flex flex-col items-center min-w-[2.5rem] sm:min-w-[3rem]"
																>
																	<span className="text-[9px] sm:text-[10px] text-slate-500 mb-1">
																		[{i}]
																	</span>
																	<div className="w-full flex items-center justify-center h-8 sm:h-10 px-1 sm:px-2 bg-slate-900 border border-slate-700 rounded-md text-slate-200 font-mono text-xs sm:text-sm shadow-sm">
																		{val !== undefined && val !== null
																			? val
																			: "-"}
																	</div>
																</div>
															))}
												</div>
											) : variable.tipo === "registro" ? (
												<div className="grid grid-cols-1 xs:grid-cols-2 gap-2 mt-2 bg-slate-900/30 p-2 rounded-lg border border-slate-800/50">
													{Object.entries(variable.valor).map(
														([key, val]: any, i) => (
															<div
																key={i}
																className="flex items-center justify-between text-xs sm:text-sm font-mono bg-slate-900/50 px-2 py-1.5 rounded border border-slate-800"
															>
																<span className="text-slate-400 truncate pr-2">
																	.{key}
																</span>
																<span className="text-sky-300 font-bold whitespace-nowrap">
																	{val}
																</span>
															</div>
														),
													)}
												</div>
											) : (
												<div className="flex items-center justify-end h-8 sm:h-10 px-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-sm sm:text-lg shadow-sm">
													{variable.valor}
												</div>
											)}
										</div>
									))}
								</div>
							)}
						</div>
					</div>

					{/* Consola de Salida */}
					<div className="h-40 sm:h-48 lg:h-56 flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl shrink-0">
						<div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2 text-slate-400 text-[10px] sm:text-xs font-mono uppercase tracking-wider bg-slate-900/50">
							<Terminal size={14} /> <span>Salida Estándar</span>
						</div>
						<div className="p-3 sm:p-4 flex-1 overflow-auto font-mono text-xs sm:text-sm text-slate-300 space-y-2">
							{estado.error && (
								<div className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
									<span className="font-bold">Error:</span> {estado.error}
								</div>
							)}
							{estado.consola.map((msg, idx) => (
								<div key={idx} className="flex gap-2">
									<span className="text-slate-600 select-none">{">"}</span>
									<span className="text-emerald-400 font-medium break-all">
										{msg}
									</span>
								</div>
							))}
							{estado.terminado && !estado.error && (
								<div className="text-slate-500 italic mt-4 flex items-center gap-2 text-[10px] sm:text-xs">
									<div className="h-px bg-slate-800 flex-1" />
									Ejecución finalizada
									<div className="h-px bg-slate-800 flex-1" />
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* ================================================================
                ✅ FAB FLOTANTE DE NAVEGACIÓN
                - position: fixed, siempre visible en esquina inferior derecha
                - Aparece con animación al iniciar la ejecución
                - Contiene: [◀ Anterior] [Línea N] [Siguiente ▶]
                - Atajos: Ctrl+← / F9 para retroceder, Ctrl+→ / F10 para avanzar
            ================================================================ */}
			{enEjecucion && (
				<>
					<style>{`
                        @keyframes fab-in {
                            from { opacity: 0; transform: translateY(16px) scale(0.9); }
                            to   { opacity: 1; transform: translateY(0)     scale(1);  }
                        }
                        .fab-nav { animation: fab-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
                    `}</style>

					<div className="fab-nav fixed bottom-6 right-6 z-50 flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/60 p-1.5">
						{/* Botón anterior */}
						<button
							onClick={retrocederPaso}
							disabled={!puedeRetroceder}
							title="Línea anterior  (F9 o Ctrl+←)"
							className="group flex items-center gap-1.5 h-9 px-3 rounded-xl
                                       bg-slate-800 hover:bg-slate-700 active:bg-slate-600
                                       text-slate-400 hover:text-slate-100
                                       disabled:opacity-25 disabled:cursor-not-allowed
                                       transition-all duration-150 active:scale-95 text-sm font-medium"
						>
							<SkipBack size={14} />
							<span className="hidden sm:inline">Anterior</span>
						</button>

						{/* Indicador de línea actual */}
						<div className="flex flex-col items-center justify-center px-3 min-w-[3.25rem] h-9 rounded-xl bg-slate-800/60">
							<span className="text-[9px] uppercase tracking-widest text-slate-500 leading-none">
								línea
							</span>
							<span className="text-base font-bold font-mono text-sky-400 leading-tight">
								{estado.lineaActual !== null ? estado.lineaActual + 1 : "—"}
							</span>
						</div>

						{/* Botón siguiente */}
						<button
							onClick={avanzarPaso}
							disabled={!puedeAvanzar}
							title="Siguiente línea  (F10 o Ctrl+→)"
							className="group flex items-center gap-1.5 h-9 px-3 rounded-xl
                                       bg-sky-600 hover:bg-sky-500 active:bg-sky-700
                                       text-white font-medium text-sm
                                       disabled:opacity-30 disabled:cursor-not-allowed
                                       transition-all duration-150 active:scale-95
                                       shadow-lg shadow-sky-950/60"
						>
							<span className="hidden sm:inline">Siguiente</span>
							<SkipForward size={14} />
						</button>
					</div>
				</>
			)}
		</div>
	);
}
