import { useState } from "react";
import { Link } from "react-router-dom";
import {
	ArrowLeft,
	ArrowRight,
	ArrowLeftRight,
	RotateCcw,
	ChevronLeft,
	Play,
} from "lucide-react";

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

type Base = "bin" | "dec" | "hex";

interface DivisionStepData {
	dividend: number;
	divisor: number;
	quotient: number;
	remainder: number;
	remainderLabel: string; // "1", "0", "A", "F", etc.
}

interface PositionalTermData {
	digit: string;
	base: number;
	exponent: number;
	value: number;
}

interface GroupData {
	bits: string;
	value: string;
}

type StepType = "intro" | "division" | "positional" | "grouping" | "result";

interface ConversionStep {
	title: string;
	description: string;
	type: StepType;
	// Datos específicos según el tipo
	divisionRow?: DivisionStepData;
	allDivisions?: DivisionStepData[]; // divisiones acumuladas hasta este paso
	positionalTerms?: PositionalTermData[];
	highlightedTerm?: number; // índice del término resaltado
	partialSum?: number;
	groups?: GroupData[];
	highlightedGroup?: number;
	result?: string;
	resultBase?: string;
}

// ─────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────

const BASE_LABELS: Record<Base, string> = {
	bin: "Binario",
	dec: "Decimal",
	hex: "Hexadecimal",
};

const BASE_PREFIXES: Record<Base, string> = {
	bin: "",
	dec: "",
	hex: "",
};

const HEX_DIGITS = "0123456789ABCDEF";

// ─────────────────────────────────────────────
// VALIDACIÓN
// ─────────────────────────────────────────────

function validateInput(value: string, base: Base): boolean {
	if (value.trim() === "") return false;
	const cleaned = value.trim().toUpperCase();
	switch (base) {
		case "bin":
			return /^[01]+$/.test(cleaned);
		case "dec":
			return /^[0-9]+$/.test(cleaned);
		case "hex":
			return /^[0-9A-F]+$/.test(cleaned);
	}
}

function toDecimal(value: string, base: Base): number {
	const cleaned = value.trim().toUpperCase();
	switch (base) {
		case "bin":
			return parseInt(cleaned, 2);
		case "dec":
			return parseInt(cleaned, 10);
		case "hex":
			return parseInt(cleaned, 16);
	}
}

// ─────────────────────────────────────────────
// GENERADORES DE PASOS
// ─────────────────────────────────────────────

function generateDecToBinSteps(decimal: number): ConversionStep[] {
	const steps: ConversionStep[] = [];

	steps.push({
		title: "Método de divisiones sucesivas",
		description: `Para convertir ${decimal} a binario, dividimos sucesivamente por 2 y anotamos los restos. Al final, leemos los restos de abajo hacia arriba.`,
		type: "intro",
	});

	if (decimal === 0) {
		steps.push({
			title: "Caso especial: el número es 0",
			description: "El 0 en decimal es 0 en cualquier base.",
			type: "result",
			result: "0",
			resultBase: "binario",
		});
		return steps;
	}

	const divisions: DivisionStepData[] = [];
	let current = decimal;

	while (current > 0) {
		const quotient = Math.floor(current / 2);
		const remainder = current % 2;
		const row: DivisionStepData = {
			dividend: current,
			divisor: 2,
			quotient,
			remainder,
			remainderLabel: String(remainder),
		};
		divisions.push(row);

		steps.push({
			title: `División ${divisions.length}`,
			description: `Dividimos ${current} entre 2. El cociente es ${quotient} y el resto es ${remainder}.`,
			type: "division",
			divisionRow: row,
			allDivisions: [...divisions],
		});

		current = quotient;
	}

	const result = divisions.map((d) => d.remainderLabel).reverse().join("");

	steps.push({
		title: "Resultado: leer los restos de abajo hacia arriba",
		description: `Leyendo los restos desde el último al primero obtenemos: ${result}`,
		type: "result",
		allDivisions: divisions,
		result,
		resultBase: "binario",
	});

	return steps;
}

function generateDecToHexSteps(decimal: number): ConversionStep[] {
	const steps: ConversionStep[] = [];

	steps.push({
		title: "Método de divisiones sucesivas",
		description: `Para convertir ${decimal} a hexadecimal, dividimos sucesivamente por 16 y anotamos los restos. Recordá que los restos del 10 al 15 se escriben como A, B, C, D, E, F.`,
		type: "intro",
	});

	if (decimal === 0) {
		steps.push({
			title: "Caso especial: el número es 0",
			description: "El 0 en decimal es 0 en cualquier base.",
			type: "result",
			result: "0",
			resultBase: "hexadecimal",
		});
		return steps;
	}

	const divisions: DivisionStepData[] = [];
	let current = decimal;

	while (current > 0) {
		const quotient = Math.floor(current / 16);
		const remainder = current % 16;
		const row: DivisionStepData = {
			dividend: current,
			divisor: 16,
			quotient,
			remainder,
			remainderLabel: HEX_DIGITS[remainder],
		};
		divisions.push(row);

		const hexNote =
			remainder >= 10
				? ` (${remainder} en hexadecimal se escribe ${HEX_DIGITS[remainder]})`
				: "";

		steps.push({
			title: `División ${divisions.length}`,
			description: `Dividimos ${current} entre 16. El cociente es ${quotient} y el resto es ${remainder}.${hexNote}`,
			type: "division",
			divisionRow: row,
			allDivisions: [...divisions],
		});

		current = quotient;
	}

	const result = divisions.map((d) => d.remainderLabel).reverse().join("");

	steps.push({
		title: "Resultado: leer los restos de abajo hacia arriba",
		description: `Leyendo los restos desde el último al primero obtenemos: ${result}`,
		type: "result",
		allDivisions: divisions,
		result,
		resultBase: "hexadecimal",
	});

	return steps;
}

function generateBinToDecSteps(binary: string): ConversionStep[] {
	const steps: ConversionStep[] = [];
	const digits = binary.split("");

	const terms: PositionalTermData[] = digits.map((digit, i) => {
		const exponent = digits.length - 1 - i;
		return {
			digit,
			base: 2,
			exponent,
			value: parseInt(digit) * Math.pow(2, exponent),
		};
	});

	steps.push({
		title: "Método de expansión posicional",
		description: `Para convertir ${binary} de binario a decimal, multiplicamos cada bit por 2 elevado a su posición (contando desde 0 de derecha a izquierda) y sumamos todos los resultados.`,
		type: "intro",
	});

	let partialSum = 0;
	for (let i = 0; i < terms.length; i++) {
		partialSum += terms[i].value;
		const t = terms[i];
		steps.push({
			title: `Posición ${t.exponent}`,
			description: `El bit "${t.digit}" está en la posición ${t.exponent}. Calculamos: ${t.digit} × 2^${t.exponent} = ${t.digit} × ${Math.pow(2, t.exponent)} = ${t.value}`,
			type: "positional",
			positionalTerms: terms,
			highlightedTerm: i,
			partialSum,
		});
	}

	const result = String(terms.reduce((sum, t) => sum + t.value, 0));

	steps.push({
		title: "Resultado: sumar todos los valores",
		description: `Sumamos todos los valores: ${terms.map((t) => t.value).join(" + ")} = ${result}`,
		type: "result",
		positionalTerms: terms,
		result,
		resultBase: "decimal",
	});

	return steps;
}

function generateHexToDecSteps(hex: string): ConversionStep[] {
	const steps: ConversionStep[] = [];
	const digits = hex.toUpperCase().split("");

	const terms: PositionalTermData[] = digits.map((digit, i) => {
		const exponent = digits.length - 1 - i;
		const digitValue = HEX_DIGITS.indexOf(digit);
		return {
			digit,
			base: 16,
			exponent,
			value: digitValue * Math.pow(16, exponent),
		};
	});

	steps.push({
		title: "Método de expansión posicional",
		description: `Para convertir ${hex.toUpperCase()} de hexadecimal a decimal, multiplicamos cada dígito por 16 elevado a su posición y sumamos.`,
		type: "intro",
	});

	let partialSum = 0;
	for (let i = 0; i < terms.length; i++) {
		partialSum += terms[i].value;
		const t = terms[i];
		const digitValue = HEX_DIGITS.indexOf(t.digit);
		const digitNote =
			digitValue >= 10
				? ` (recordá que ${t.digit} vale ${digitValue})`
				: "";

		steps.push({
			title: `Posición ${t.exponent}`,
			description: `El dígito "${t.digit}" está en la posición ${t.exponent}.${digitNote} Calculamos: ${digitValue} × 16^${t.exponent} = ${digitValue} × ${Math.pow(16, t.exponent)} = ${t.value}`,
			type: "positional",
			positionalTerms: terms,
			highlightedTerm: i,
			partialSum,
		});
	}

	const result = String(terms.reduce((sum, t) => sum + t.value, 0));

	steps.push({
		title: "Resultado: sumar todos los valores",
		description: `Sumamos todos los valores: ${terms.map((t) => t.value).join(" + ")} = ${result}`,
		type: "result",
		positionalTerms: terms,
		result,
		resultBase: "decimal",
	});

	return steps;
}

function generateBinToHexSteps(binary: string): ConversionStep[] {
	const steps: ConversionStep[] = [];

	steps.push({
		title: "Método de agrupación de 4 bits",
		description: `Para convertir binario a hexadecimal, agrupamos los bits de a 4 desde la derecha. Si el último grupo (el de la izquierda) tiene menos de 4 bits, lo completamos con ceros a la izquierda.`,
		type: "intro",
	});

	// Pad to multiple of 4
	let padded = binary;
	while (padded.length % 4 !== 0) {
		padded = "0" + padded;
	}

	const groups: GroupData[] = [];
	for (let i = 0; i < padded.length; i += 4) {
		const bits = padded.substring(i, i + 4);
		const value = HEX_DIGITS[parseInt(bits, 2)];
		groups.push({ bits, value });
	}

	if (padded !== binary) {
		steps.push({
			title: "Completar con ceros a la izquierda",
			description: `El número ${binary} tiene ${binary.length} bits. Para que sea múltiplo de 4, agregamos ceros a la izquierda: ${padded}`,
			type: "grouping",
			groups,
			highlightedGroup: -1,
		});
	}

	for (let i = 0; i < groups.length; i++) {
		const g = groups[i];
		steps.push({
			title: `Grupo ${i + 1}: ${g.bits}`,
			description: `El grupo "${g.bits}" en binario equivale a ${parseInt(g.bits, 2)} en decimal, que en hexadecimal es ${g.value}.`,
			type: "grouping",
			groups,
			highlightedGroup: i,
		});
	}

	const result = groups.map((g) => g.value).join("");

	steps.push({
		title: "Resultado: unir los dígitos hexadecimales",
		description: `Unimos todos los dígitos: ${result}`,
		type: "result",
		groups,
		result,
		resultBase: "hexadecimal",
	});

	return steps;
}

function generateHexToBinSteps(hex: string): ConversionStep[] {
	const steps: ConversionStep[] = [];
	const digits = hex.toUpperCase().split("");

	steps.push({
		title: "Expansión de cada dígito a 4 bits",
		description: `Para convertir hexadecimal a binario, expandimos cada dígito hexadecimal a su equivalente de 4 bits en binario.`,
		type: "intro",
	});

	const groups: GroupData[] = digits.map((digit) => {
		const decValue = HEX_DIGITS.indexOf(digit);
		const bits = decValue.toString(2).padStart(4, "0");
		return { bits, value: digit };
	});

	for (let i = 0; i < groups.length; i++) {
		const g = groups[i];
		const decValue = HEX_DIGITS.indexOf(g.value);
		steps.push({
			title: `Dígito "${g.value}"`,
			description: `El dígito hexadecimal ${g.value} equivale a ${decValue} en decimal, que en binario (4 bits) es ${g.bits}.`,
			type: "grouping",
			groups,
			highlightedGroup: i,
		});
	}

	const rawResult = groups.map((g) => g.bits).join("");
	const result = rawResult.replace(/^0+/, "") || "0";

	steps.push({
		title: "Resultado: concatenar los grupos",
		description: `Concatenamos los bits: ${rawResult}${rawResult !== result ? ` → eliminamos ceros a la izquierda: ${result}` : ""}`,
		type: "result",
		groups,
		result,
		resultBase: "binario",
	});

	return steps;
}

// ─────────────────────────────────────────────
// FUNCIÓN PRINCIPAL DE GENERACIÓN
// ─────────────────────────────────────────────

function generateSteps(
	value: string,
	from: Base,
	to: Base
): ConversionStep[] {
	const cleaned = value.trim().toUpperCase();

	if (from === "dec" && to === "bin")
		return generateDecToBinSteps(parseInt(cleaned));
	if (from === "dec" && to === "hex")
		return generateDecToHexSteps(parseInt(cleaned));
	if (from === "bin" && to === "dec") return generateBinToDecSteps(cleaned);
	if (from === "hex" && to === "dec") return generateHexToDecSteps(cleaned);
	if (from === "bin" && to === "hex") return generateBinToHexSteps(cleaned);
	if (from === "hex" && to === "bin") return generateHexToBinSteps(cleaned);

	// Misma base → no hay conversión
	return [
		{
			title: "Sin conversión necesaria",
			description: `El número ya está en base ${BASE_LABELS[to]}: ${cleaned}`,
			type: "result",
			result: cleaned,
			resultBase: BASE_LABELS[to],
		},
	];
}

// ─────────────────────────────────────────────
// COMPONENTES DE VISUALIZACIÓN
// ─────────────────────────────────────────────

function DivisionTable({
	divisions,
	currentIndex,
}: {
	divisions: DivisionStepData[];
	currentIndex: number;
}) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b border-slate-700 text-slate-400">
						<th className="py-2 px-3 text-left font-medium">#</th>
						<th className="py-2 px-3 text-right font-medium">Dividendo</th>
						<th className="py-2 px-3 text-center font-medium">÷</th>
						<th className="py-2 px-3 text-center font-medium">Divisor</th>
						<th className="py-2 px-3 text-center font-medium">=</th>
						<th className="py-2 px-3 text-right font-medium">Cociente</th>
						<th className="py-2 px-3 text-right font-medium">Resto</th>
					</tr>
				</thead>
				<tbody>
					{divisions.map((d, i) => {
						const isHighlighted = i === currentIndex;
						return (
							<tr
								key={i}
								className={`border-b border-slate-800 transition-colors ${isHighlighted ? "bg-sky-500/10" : ""}`}
							>
								<td className="py-2 px-3 text-slate-500">{i + 1}</td>
								<td className="py-2 px-3 text-right font-mono font-bold">
									{d.dividend}
								</td>
								<td className="py-2 px-3 text-center text-slate-500">÷</td>
								<td className="py-2 px-3 text-center font-mono">{d.divisor}</td>
								<td className="py-2 px-3 text-center text-slate-500">=</td>
								<td className="py-2 px-3 text-right font-mono">{d.quotient}</td>
								<td
									className={`py-2 px-3 text-right font-mono font-bold ${isHighlighted ? "text-sky-400" : "text-emerald-400"}`}
								>
									{d.remainderLabel}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>

			{/* Flecha visual de lectura */}
			{divisions.length > 1 && (
				<div className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-500">
					<span>Lectura</span>
					<svg
						width="16"
						height="40"
						viewBox="0 0 16 40"
						className="text-emerald-500"
					>
						<path
							d="M8 36 L8 4 M3 9 L8 4 L13 9"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						/>
					</svg>
					<span className="font-mono font-bold text-emerald-400">
						{divisions.map((d) => d.remainderLabel).reverse().join("")}
					</span>
				</div>
			)}
		</div>
	);
}

function PositionalView({
	terms,
	highlightedTerm,
	partialSum,
}: {
	terms: PositionalTermData[];
	highlightedTerm?: number;
	partialSum?: number;
}) {
	return (
		<div className="space-y-3">
			{/* Fila de bits/dígitos con posiciones */}
			<div className="flex flex-wrap gap-2 justify-center">
				{terms.map((t, i) => {
					const isActive = highlightedTerm !== undefined && i <= highlightedTerm;
					const isCurrent = i === highlightedTerm;
					return (
						<div
							key={i}
							className={`flex flex-col items-center px-3 py-2 rounded-lg border transition-all ${
								isCurrent
									? "bg-sky-500/20 border-sky-500"
									: isActive
										? "bg-slate-800 border-slate-700"
										: "bg-slate-900 border-slate-800 opacity-50"
							}`}
						>
							<span className="text-xs text-slate-500 mb-1">
								pos {t.exponent}
							</span>
							<span className="font-mono text-lg font-bold">{t.digit}</span>
							<span className="text-xs text-slate-400 mt-1">
								×{t.base}
								<sup>{t.exponent}</sup>
							</span>
							<span
								className={`text-xs font-mono mt-1 ${isCurrent ? "text-sky-400 font-bold" : "text-slate-500"}`}
							>
								= {t.value}
							</span>
						</div>
					);
				})}
			</div>

			{/* Suma parcial */}
			{partialSum !== undefined && (
				<div className="text-center text-sm">
					<span className="text-slate-400">Suma parcial: </span>
					<span className="font-mono font-bold text-emerald-400">
						{partialSum}
					</span>
				</div>
			)}
		</div>
	);
}

function GroupingView({
	groups,
	highlightedGroup,
}: {
	groups: GroupData[];
	highlightedGroup?: number;
}) {
	return (
		<div className="flex flex-wrap gap-3 justify-center">
			{groups.map((g, i) => {
				const isActive =
					highlightedGroup !== undefined && i <= highlightedGroup;
				const isCurrent = i === highlightedGroup;
				return (
					<div
						key={i}
						className={`flex flex-col items-center px-4 py-3 rounded-lg border transition-all ${
							isCurrent
								? "bg-sky-500/20 border-sky-500"
								: isActive
									? "bg-slate-800 border-slate-700"
									: "bg-slate-900 border-slate-800 opacity-50"
						}`}
					>
						<span className="font-mono text-sm tracking-widest">{g.bits}</span>
						<div className="w-full h-px bg-slate-700 my-2" />
						<span
							className={`font-mono text-lg font-bold ${isCurrent ? "text-sky-400" : "text-emerald-400"}`}
						>
							{g.value}
						</span>
					</div>
				);
			})}
		</div>
	);
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────

export default function ConversorBases() {
	const [inputValue, setInputValue] = useState("");
	const [fromBase, setFromBase] = useState<Base>("dec");
	const [toBase, setToBase] = useState<Base>("bin");
	const [steps, setSteps] = useState<ConversionStep[]>([]);
	const [currentStep, setCurrentStep] = useState(0);
	const [error, setError] = useState("");
	const [isConverted, setIsConverted] = useState(false);

	function handleConvert() {
		setError("");

		if (!inputValue.trim()) {
			setError("Ingresá un número para convertir.");
			return;
		}

		if (fromBase === toBase) {
			setError("La base de origen y destino son iguales.");
			return;
		}

		if (!validateInput(inputValue, fromBase)) {
			const examples: Record<Base, string> = {
				bin: "solo 0 y 1",
				dec: "solo dígitos del 0 al 9",
				hex: "dígitos 0-9 y letras A-F",
			};
			setError(
				`El número no es válido en base ${BASE_LABELS[fromBase]}. Debe contener ${examples[fromBase]}.`
			);
			return;
		}

		// Validar que no sea un número excesivamente grande
		const decimalValue = toDecimal(inputValue, fromBase);
		if (decimalValue > 999999) {
			setError(
				"Para fines didácticos, usá un número que en decimal sea menor a 1.000.000."
			);
			return;
		}

		const generatedSteps = generateSteps(inputValue, fromBase, toBase);
		setSteps(generatedSteps);
		setCurrentStep(0);
		setIsConverted(true);
	}

	function handleReset() {
		setInputValue("");
		setSteps([]);
		setCurrentStep(0);
		setError("");
		setIsConverted(false);
	}

	function handleSwapBases() {
		setFromBase(toBase);
		setToBase(fromBase);
		setSteps([]);
		setCurrentStep(0);
		setIsConverted(false);
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") handleConvert();
	}

	const step = steps[currentStep] as ConversionStep | undefined;
	const isLastStep = currentStep === steps.length - 1;
	const isFirstStep = currentStep === 0;

	const baseOptions: Base[] = ["bin", "dec", "hex"];

	return (
		<div className="space-y-8 max-w-3xl mx-auto">
			{/* Header */}
			<div className="space-y-2">
				<Link
					to="/"
					className="inline-flex items-center gap-1 text-slate-400 hover:text-sky-400 transition-colors text-sm"
				>
					<ChevronLeft size={16} />
					Volver al Hub
				</Link>
				<h1 className="text-3xl font-bold">Conversor de Bases Numéricas</h1>
				<p className="text-slate-400">
					Convertí entre binario, decimal y hexadecimal viendo el proceso
					completo paso a paso, tal como lo harías en un parcial.
				</p>
			</div>

			{/* Panel de entrada */}
			<div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-5">
				{/* Input del número */}
				<div>
					<label className="block text-sm font-medium text-slate-300 mb-2">
						Número a convertir
					</label>
					<input
						type="text"
						value={inputValue}
						onChange={(e) => {
							setInputValue(e.target.value);
							if (isConverted) {
								setIsConverted(false);
								setSteps([]);
							}
						}}
						onKeyDown={handleKeyDown}
						placeholder={
							fromBase === "bin"
								? "Ej: 11010110"
								: fromBase === "dec"
									? "Ej: 214"
									: "Ej: D6"
						}
						className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 font-mono text-lg placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
					/>
				</div>

				{/* Selectores de base */}
				<div className="flex items-center gap-3">
					<div className="flex-1">
						<label className="block text-sm font-medium text-slate-300 mb-2">
							Base origen
						</label>
						<select
							value={fromBase}
							onChange={(e) => {
								setFromBase(e.target.value as Base);
								if (isConverted) {
									setIsConverted(false);
									setSteps([]);
								}
							}}
							className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-sky-500 transition-colors"
						>
							{baseOptions.map((b) => (
								<option key={b} value={b}>
									{BASE_LABELS[b]}
								</option>
							))}
						</select>
					</div>

					<button
						onClick={handleSwapBases}
						className="mt-7 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
						title="Intercambiar bases"
					>
						<ArrowLeftRight size={20} />
					</button>

					<div className="flex-1">
						<label className="block text-sm font-medium text-slate-300 mb-2">
							Base destino
						</label>
						<select
							value={toBase}
							onChange={(e) => {
								setToBase(e.target.value as Base);
								if (isConverted) {
									setIsConverted(false);
									setSteps([]);
								}
							}}
							className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-sky-500 transition-colors"
						>
							{baseOptions.map((b) => (
								<option key={b} value={b}>
									{BASE_LABELS[b]}
								</option>
							))}
						</select>
					</div>
				</div>

				{/* Error */}
				{error && (
					<p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
						{error}
					</p>
				)}

				{/* Botones */}
				<div className="flex gap-3">
					<button
						onClick={handleConvert}
						className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-medium py-3 px-6 rounded-lg transition-colors"
					>
						<Play size={18} />
						Convertir paso a paso
					</button>
					{isConverted && (
						<button
							onClick={handleReset}
							className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 px-4 rounded-lg transition-colors"
						>
							<RotateCcw size={18} />
						</button>
					)}
				</div>
			</div>

			{/* Panel de visualización paso a paso */}
			{isConverted && step && (
				<div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
					{/* Barra de progreso */}
					<div className="h-1 bg-slate-800">
						<div
							className="h-full bg-sky-500 transition-all duration-300"
							style={{
								width: `${((currentStep + 1) / steps.length) * 100}%`,
							}}
						/>
					</div>

					<div className="p-6 space-y-5">
						{/* Header del paso */}
						<div className="space-y-1">
							<div className="flex items-center gap-2">
								<span className="text-xs font-medium text-sky-400 bg-sky-500/10 px-2 py-1 rounded">
									Paso {currentStep + 1} de {steps.length}
								</span>
								<span className="text-xs text-slate-500">
									{BASE_LABELS[fromBase]} → {BASE_LABELS[toBase]}
								</span>
							</div>
							<h2 className="text-xl font-bold">{step.title}</h2>
							<p className="text-slate-400 text-sm leading-relaxed">
								{step.description}
							</p>
						</div>

						{/* Visualización según el tipo de paso */}
						<div className="py-2">
							{step.type === "division" && step.allDivisions && (
								<DivisionTable
									divisions={step.allDivisions}
									currentIndex={step.allDivisions.length - 1}
								/>
							)}

							{step.type === "positional" && step.positionalTerms && (
								<PositionalView
									terms={step.positionalTerms}
									highlightedTerm={step.highlightedTerm}
									partialSum={step.partialSum}
								/>
							)}

							{step.type === "grouping" && step.groups && (
								<GroupingView
									groups={step.groups}
									highlightedGroup={step.highlightedGroup}
								/>
							)}

							{step.type === "result" && (
								<div className="space-y-4">
									{/* Si hay divisiones en el resultado final, mostrarlas */}
									{step.allDivisions && (
										<DivisionTable
											divisions={step.allDivisions}
											currentIndex={-1}
										/>
									)}
									{step.positionalTerms && (
										<PositionalView terms={step.positionalTerms} />
									)}
									{step.groups && <GroupingView groups={step.groups} />}

									{/* Resultado final */}
									{step.result && (
										<div className="mt-4 text-center p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
											<span className="text-sm text-emerald-300">
												Resultado en {step.resultBase}
											</span>
											<div className="font-mono text-3xl font-bold text-emerald-400 mt-1">
												{BASE_PREFIXES[toBase]}
												{step.result}
											</div>
										</div>
									)}
								</div>
							)}
						</div>

						{/* Navegación */}
						<div className="flex items-center justify-between pt-2 border-t border-slate-800">
							<button
								onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
								disabled={isFirstStep}
								className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-slate-800 hover:bg-slate-700 text-slate-300"
							>
								<ArrowLeft size={16} />
								Anterior
							</button>

							{/* Dots de progreso */}
							<div className="flex gap-1.5">
								{steps.map((_, i) => (
									<button
										key={i}
										onClick={() => setCurrentStep(i)}
										className={`w-2 h-2 rounded-full transition-all ${
											i === currentStep
												? "bg-sky-500 w-4"
												: i < currentStep
													? "bg-sky-500/40"
													: "bg-slate-700"
										}`}
									/>
								))}
							</div>

							<button
								onClick={() =>
									setCurrentStep((s) => Math.min(steps.length - 1, s + 1))
								}
								disabled={isLastStep}
								className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-sky-600 hover:bg-sky-500 text-white"
							>
								Siguiente
								<ArrowRight size={16} />
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
