import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
	ChevronLeft,
	Play,
	RotateCcw,
	ArrowLeft,
	ArrowRight,
	SkipForward,
	Keyboard,
	Shuffle,
} from "lucide-react";

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

type AlgorithmId =
	| "busqueda-secuencial"
	| "busqueda-binaria"
	| "burbuja"
	| "burbuja-mejorado"
	| "seleccion"
	| "insercion";

type AlgorithmCategory = "busqueda" | "ordenamiento";

const ALGORITHMS: {
	id: AlgorithmId;
	label: string;
	category: AlgorithmCategory;
}[] = [
	{
		id: "busqueda-secuencial",
		label: "Búsqueda Secuencial",
		category: "busqueda",
	},
	{ id: "busqueda-binaria", label: "Búsqueda Binaria", category: "busqueda" },
	{ id: "burbuja", label: "Burbuja", category: "ordenamiento" },
	{
		id: "burbuja-mejorado",
		label: "Burbuja Mejorado",
		category: "ordenamiento",
	},
	{ id: "seleccion", label: "Selección Directa", category: "ordenamiento" },
	{ id: "insercion", label: "Inserción Directa", category: "ordenamiento" },
];

type CellState =
	| "default"
	| "comparing"
	| "candidate"
	| "sorted"
	| "swapped"
	| "pre-swap"
	| "out-of-range"
	| "found"
	| "inserted"
	| "shifting";

interface CodeLine {
	text: string;
	indent: number;
}

interface SimStep {
	explanation: string;
	array: number[];
	cells: CellState[];
	variables: { name: string; value: string | number }[];
	codeLine: number; // -1 = ninguna
	passLabel?: string; // "Pasada 1", etc.
	// Para búsqueda binaria: marcadores de límites
	markers?: { index: number; label: string; color: string }[];
}

interface SimResult {
	steps: SimStep[];
	pseudocode: CodeLine[];
	finalMessage: string;
}

// ─────────────────────────────────────────────
// PSEUDOCÓDIGOS
// ─────────────────────────────────────────────

const PSEUDOCODES: Record<AlgorithmId, CodeLine[]> = {
	"busqueda-secuencial": [
		{ text: "i = 0", indent: 0 },
		{ text: "Mientras (i < N) y (A[i] != elem)", indent: 0 },
		{ text: "i = i + 1", indent: 1 },
		{ text: "FinMientras", indent: 0 },
		{ text: "Si (i < N)", indent: 0 },
		{ text: 'Escribir "Encontrado en posición", i', indent: 1 },
		{ text: "Sino", indent: 0 },
		{ text: 'Escribir "No encontrado"', indent: 1 },
		{ text: "FinSi", indent: 0 },
	],
	"busqueda-binaria": [
		{ text: "li = 0;  ls = N - 1", indent: 0 },
		{ text: "encontrado = falso", indent: 0 },
		{ text: "Mientras (li <= ls) y (encontrado == falso)", indent: 0 },
		{ text: "m = (li + ls) div 2", indent: 1 },
		{ text: "Si (A[m] == elem)", indent: 1 },
		{ text: "encontrado = verdadero", indent: 2 },
		{ text: "Sino Si (elem < A[m])", indent: 1 },
		{ text: "ls = m - 1", indent: 2 },
		{ text: "Sino", indent: 1 },
		{ text: "li = m + 1", indent: 2 },
		{ text: "FinSi", indent: 1 },
		{ text: "FinMientras", indent: 0 },
	],
	burbuja: [
		{ text: "Para i Desde 0 Hasta N-2", indent: 0 },
		{ text: "Para j Desde 0 Hasta N-2-i", indent: 1 },
		{ text: "Si (A[j] > A[j+1])", indent: 2 },
		{ text: "aux = A[j]", indent: 3 },
		{ text: "A[j] = A[j+1]", indent: 3 },
		{ text: "A[j+1] = aux", indent: 3 },
		{ text: "FinSi", indent: 2 },
		{ text: "FinPara", indent: 1 },
		{ text: "FinPara", indent: 0 },
	],
	"burbuja-mejorado": [
		{ text: "cota = N - 1", indent: 0 },
		{ text: "Mientras (cota > 0)", indent: 0 },
		{ text: "k = -1", indent: 1 },
		{ text: "Para j Desde 0 Hasta cota-1", indent: 1 },
		{ text: "Si (A[j] > A[j+1])", indent: 2 },
		{ text: "aux = A[j]", indent: 3 },
		{ text: "A[j] = A[j+1]", indent: 3 },
		{ text: "A[j+1] = aux", indent: 3 },
		{ text: "k = j", indent: 3 },
		{ text: "FinSi", indent: 2 },
		{ text: "FinPara", indent: 1 },
		{ text: "cota = k", indent: 1 },
		{ text: "FinMientras", indent: 0 },
	],
	seleccion: [
		{ text: "Para i Desde 0 Hasta N-2", indent: 0 },
		{ text: "min = i", indent: 1 },
		{ text: "Para j Desde i+1 Hasta N-1", indent: 1 },
		{ text: "Si (A[j] < A[min])", indent: 2 },
		{ text: "min = j", indent: 3 },
		{ text: "FinSi", indent: 2 },
		{ text: "FinPara", indent: 1 },
		{ text: "aux = A[i]", indent: 1 },
		{ text: "A[i] = A[min]", indent: 1 },
		{ text: "A[min] = aux", indent: 1 },
		{ text: "FinPara", indent: 0 },
	],
	insercion: [
		{ text: "Para i Desde 1 Hasta N-1", indent: 0 },
		{ text: "valor = A[i]", indent: 1 },
		{ text: "j = i - 1", indent: 1 },
		{ text: "Mientras (j >= 0) y (valor < A[j])", indent: 1 },
		{ text: "A[j+1] = A[j]", indent: 2 },
		{ text: "j = j - 1", indent: 2 },
		{ text: "FinMientras", indent: 1 },
		{ text: "A[j+1] = valor", indent: 1 },
		{ text: "FinPara", indent: 0 },
	],
};

// ─────────────────────────────────────────────
// GENERADORES DE PASOS
// ─────────────────────────────────────────────

function genBusquedaSecuencial(arr: number[], elem: number): SimStep[] {
	const steps: SimStep[] = [];
	const a = [...arr];
	const N = a.length;

	const defaultCells = (): CellState[] => a.map(() => "default");

	// Paso inicial
	steps.push({
		explanation: `Buscamos el elemento ${elem} en el arreglo. Comenzamos desde i = 0.`,
		array: [...a],
		cells: defaultCells(),
		variables: [
			{ name: "i", value: 0 },
			{ name: "elem", value: elem },
			{ name: "N", value: N },
		],
		codeLine: 0,
	});

	let i = 0;
	while (i < N && a[i] !== elem) {
		const cells = defaultCells();
		cells[i] = "comparing";
		steps.push({
			explanation: `Comparamos A[${i}] = ${a[i]} con ${elem}. ${a[i] === elem ? "¡Son iguales!" : "No coinciden."} ${a[i] !== elem ? `Avanzamos i a ${i + 1}.` : ""}`,
			array: [...a],
			cells,
			variables: [
				{ name: "i", value: i },
				{ name: "A[i]", value: a[i] },
				{ name: "elem", value: elem },
			],
			codeLine: a[i] !== elem ? 2 : 1,
		});
		i++;
	}

	if (i < N) {
		const cells = defaultCells();
		cells[i] = "found";
		steps.push({
			explanation: `¡Encontrado! A[${i}] = ${a[i]} coincide con ${elem}. El elemento está en la posición ${i}.`,
			array: [...a],
			cells,
			variables: [
				{ name: "i", value: i },
				{ name: "A[i]", value: a[i] },
			],
			codeLine: 5,
		});
	} else {
		steps.push({
			explanation: `Se recorrió todo el arreglo (i = ${N} = N). El elemento ${elem} no fue encontrado.`,
			array: [...a],
			cells: defaultCells(),
			variables: [{ name: "i", value: N }],
			codeLine: 7,
		});
	}

	return steps;
}

function genBusquedaBinaria(arr: number[], elem: number): SimStep[] {
	const steps: SimStep[] = [];
	const a = [...arr];
	const N = a.length;

	const makeCells = (
		li: number,
		ls: number,
		m: number,
		found: boolean,
	): CellState[] => {
		return a.map((_, idx) => {
			if (found && idx === m) return "found";
			if (idx === m) return "comparing";
			if (idx >= li && idx <= ls) return "default";
			return "out-of-range";
		});
	};

	const makeMarkers = (li: number, ls: number, m: number) => [
		{ index: li, label: "li", color: "text-sky-400" },
		{ index: m, label: "m", color: "text-amber-400" },
		{ index: ls, label: "ls", color: "text-rose-400" },
	];

	let li = 0,
		ls = N - 1,
		encontrado = false,
		m = -1;

	steps.push({
		explanation: `Buscamos ${elem} en el arreglo ordenado. Inicializamos li = 0, ls = ${ls}.`,
		array: [...a],
		cells: a.map(() => "default"),
		variables: [
			{ name: "li", value: 0 },
			{ name: "ls", value: ls },
			{ name: "elem", value: elem },
		],
		codeLine: 0,
		markers: [
			{ index: 0, label: "li", color: "text-sky-400" },
			{ index: ls, label: "ls", color: "text-rose-400" },
		],
	});

	while (li <= ls && !encontrado) {
		m = Math.floor((li + ls) / 2);

		steps.push({
			explanation: `Calculamos m = (${li} + ${ls}) div 2 = ${m}. El elemento central es A[${m}] = ${a[m]}.`,
			array: [...a],
			cells: makeCells(li, ls, m, false),
			variables: [
				{ name: "li", value: li },
				{ name: "ls", value: ls },
				{ name: "m", value: m },
				{ name: "A[m]", value: a[m] },
			],
			codeLine: 3,
			markers: makeMarkers(li, ls, m),
		});

		if (a[m] === elem) {
			encontrado = true;
			steps.push({
				explanation: `¡Encontrado! A[${m}] = ${a[m]} coincide con ${elem}. Posición: ${m}.`,
				array: [...a],
				cells: makeCells(li, ls, m, true),
				variables: [
					{ name: "li", value: li },
					{ name: "ls", value: ls },
					{ name: "m", value: m },
				],
				codeLine: 5,
				markers: makeMarkers(li, ls, m),
			});
		} else if (elem < a[m]) {
			steps.push({
				explanation: `${elem} < A[${m}] = ${a[m]}. Descartamos la mitad derecha. Nuevo ls = ${m} - 1 = ${m - 1}.`,
				array: [...a],
				cells: makeCells(li, m - 1, m, false),
				variables: [
					{ name: "li", value: li },
					{ name: "ls", value: m - 1 },
					{ name: "m", value: m },
				],
				codeLine: 7,
				markers: makeMarkers(li, m - 1, m),
			});
			ls = m - 1;
		} else {
			steps.push({
				explanation: `${elem} > A[${m}] = ${a[m]}. Descartamos la mitad izquierda. Nuevo li = ${m} + 1 = ${m + 1}.`,
				array: [...a],
				cells: makeCells(m + 1, ls, m, false),
				variables: [
					{ name: "li", value: m + 1 },
					{ name: "ls", value: ls },
					{ name: "m", value: m },
				],
				codeLine: 9,
				markers: makeMarkers(m + 1, ls, m),
			});
			li = m + 1;
		}
	}

	if (!encontrado) {
		steps.push({
			explanation: `li (${li}) > ls (${ls}). El intervalo se agotó. El elemento ${elem} no está en el arreglo.`,
			array: [...a],
			cells: a.map(() => "out-of-range"),
			variables: [
				{ name: "li", value: li },
				{ name: "ls", value: ls },
			],
			codeLine: 11,
		});
	}

	return steps;
}

function genBurbuja(arr: number[]): SimStep[] {
	const steps: SimStep[] = [];
	const a = [...arr];
	const N = a.length;

	const sorted = new Set<number>();

	steps.push({
		explanation: `Ordenamos el arreglo de ${N} elementos con Burbuja. Se necesitan ${N - 1} pasadas.`,
		array: [...a],
		cells: a.map(() => "default"),
		variables: [{ name: "N", value: N }],
		codeLine: 0,
	});

	for (let i = 0; i <= N - 2; i++) {
		for (let j = 0; j <= N - 2 - i; j++) {
			const cells: CellState[] = a.map((_, idx) =>
				sorted.has(idx) ? "sorted" : "default",
			);
			cells[j] = "comparing";
			cells[j + 1] = "comparing";

			const shouldSwap = a[j] > a[j + 1];

			steps.push({
				explanation: `Comparamos A[${j}] = ${a[j]} con A[${j + 1}] = ${a[j + 1]}. ${shouldSwap ? `${a[j]} > ${a[j + 1]}, hay que intercambiar.` : `${a[j]} ≤ ${a[j + 1]}, no se intercambian.`}`,
				array: [...a],
				cells,
				variables: [
					{ name: "i", value: i },
					{ name: "j", value: j },
					{ name: "A[j]", value: a[j] },
					{ name: "A[j+1]", value: a[j + 1] },
				],
				codeLine: 2,
				passLabel: `Pasada ${i + 1}`,
			});

			if (shouldSwap) {
				// Paso pre-swap: resaltar los que van a intercambiarse
				const preSwapCells: CellState[] = a.map((_, idx) =>
					sorted.has(idx) ? "sorted" : "default",
				);
				preSwapCells[j] = "pre-swap";
				preSwapCells[j + 1] = "pre-swap";

				steps.push({
					explanation: `Se prepara el intercambio: aux = A[${j}] = ${a[j]}. Se moverá ${a[j + 1]} a la posición ${j} y ${a[j]} a la posición ${j + 1}.`,
					array: [...a],
					cells: preSwapCells,
					variables: [
						{ name: "i", value: i },
						{ name: "j", value: j },
						{ name: "aux", value: a[j] },
						{ name: "A[j]", value: a[j] },
						{ name: "A[j+1]", value: a[j + 1] },
					],
					codeLine: 3,
					passLabel: `Pasada ${i + 1}`,
				});

				// Realizar el intercambio
				const aux = a[j];
				a[j] = a[j + 1];
				a[j + 1] = aux;

				const swapCells: CellState[] = a.map((_, idx) =>
					sorted.has(idx) ? "sorted" : "default",
				);
				swapCells[j] = "swapped";
				swapCells[j + 1] = "swapped";

				steps.push({
					explanation: `¡Intercambio realizado! A[${j}] = ${a[j]}, A[${j + 1}] = ${a[j + 1]}.`,
					array: [...a],
					cells: swapCells,
					variables: [
						{ name: "i", value: i },
						{ name: "j", value: j },
						{ name: "aux", value: aux },
					],
					codeLine: 5,
					passLabel: `Pasada ${i + 1}`,
				});
			}
		}

		sorted.add(N - 1 - i);

		const endCells: CellState[] = a.map((_, idx) =>
			sorted.has(idx) ? "sorted" : "default",
		);
		steps.push({
			explanation: `Fin de pasada ${i + 1}. El elemento ${a[N - 1 - i]} quedó en su posición final (índice ${N - 1 - i}).`,
			array: [...a],
			cells: endCells,
			variables: [{ name: "i", value: i }],
			codeLine: 7,
			passLabel: `Pasada ${i + 1} completada`,
		});
	}

	return steps;
}

function genBurbujaMejorado(arr: number[]): SimStep[] {
	const steps: SimStep[] = [];
	const a = [...arr];
	const N = a.length;
	const sorted = new Set<number>();

	let cota = N - 1;
	let pasada = 0;

	steps.push({
		explanation: `Ordenamos con Burbuja Mejorado. cota inicia en ${cota}. Si no hay intercambios (k = -1), el arreglo ya está ordenado.`,
		array: [...a],
		cells: a.map(() => "default"),
		variables: [
			{ name: "cota", value: cota },
			{ name: "N", value: N },
		],
		codeLine: 0,
	});

	while (cota > 0) {
		pasada++;
		let k = -1;

		for (let j = 0; j <= cota - 1; j++) {
			const cells: CellState[] = a.map((_, idx) =>
				sorted.has(idx) ? "sorted" : "default",
			);
			cells[j] = "comparing";
			cells[j + 1] = "comparing";
			const shouldSwap = a[j] > a[j + 1];

			steps.push({
				explanation: `Comparamos A[${j}] = ${a[j]} con A[${j + 1}] = ${a[j + 1]}. ${shouldSwap ? "Se intercambian." : "No se intercambian."}`,
				array: [...a],
				cells,
				variables: [
					{ name: "cota", value: cota },
					{ name: "j", value: j },
					{ name: "k", value: k },
				],
				codeLine: shouldSwap ? 5 : 4,
				passLabel: `Pasada ${pasada}`,
			});

			if (shouldSwap) {
				// Paso pre-swap
				const preSwapCells: CellState[] = a.map((_, idx) =>
					sorted.has(idx) ? "sorted" : "default",
				);
				preSwapCells[j] = "pre-swap";
				preSwapCells[j + 1] = "pre-swap";

				steps.push({
					explanation: `Se prepara el intercambio de A[${j}] = ${a[j]} y A[${j + 1}] = ${a[j + 1]}.`,
					array: [...a],
					cells: preSwapCells,
					variables: [
						{ name: "cota", value: cota },
						{ name: "j", value: j },
						{ name: "k", value: k },
						{ name: "aux", value: a[j] },
					],
					codeLine: 5,
					passLabel: `Pasada ${pasada}`,
				});

				const aux = a[j];
				a[j] = a[j + 1];
				a[j + 1] = aux;
				k = j;

				const swapCells: CellState[] = a.map((_, idx) =>
					sorted.has(idx) ? "sorted" : "default",
				);
				swapCells[j] = "swapped";
				swapCells[j + 1] = "swapped";

				steps.push({
					explanation: `¡Intercambio realizado! A[${j}] = ${a[j]}, A[${j + 1}] = ${a[j + 1]}. k = ${j} (último cambio).`,
					array: [...a],
					cells: swapCells,
					variables: [
						{ name: "cota", value: cota },
						{ name: "j", value: j },
						{ name: "k", value: k },
					],
					codeLine: 8,
					passLabel: `Pasada ${pasada}`,
				});
			}
		}

		// Marcar desde cota hasta el final como sorted
		for (let s = cota; s < N; s++) sorted.add(s);
		cota = k;

		const endCells: CellState[] = a.map((_, idx) =>
			sorted.has(idx) ? "sorted" : "default",
		);
		const msg =
			k === -1
				? `Fin pasada ${pasada}. k = -1, no hubo intercambios. ¡Arreglo ordenado!`
				: `Fin pasada ${pasada}. Último cambio en k = ${k}. Nueva cota = ${k}. Desde posición ${k + 1} en adelante ya está ordenado.`;

		steps.push({
			explanation: msg,
			array: [...a],
			cells: endCells,
			variables: [
				{ name: "cota", value: cota },
				{ name: "k", value: k },
			],
			codeLine: 11,
			passLabel: `Pasada ${pasada} completada`,
		});

		if (cota <= 0) break;
	}

	return steps;
}

function genSeleccion(arr: number[]): SimStep[] {
	const steps: SimStep[] = [];
	const a = [...arr];
	const N = a.length;
	const sorted = new Set<number>();

	steps.push({
		explanation: `Ordenamos con Selección Directa. En cada pasada buscamos el mínimo y lo ubicamos en su posición.`,
		array: [...a],
		cells: a.map(() => "default"),
		variables: [{ name: "N", value: N }],
		codeLine: 0,
	});

	for (let i = 0; i <= N - 2; i++) {
		let min = i;

		const startCells: CellState[] = a.map((_, idx) =>
			sorted.has(idx) ? "sorted" : "default",
		);
		startCells[i] = "candidate";

		steps.push({
			explanation: `Pasada ${i + 1}: buscamos el mínimo desde la posición ${i} hasta ${N - 1}. min = ${i} (A[${i}] = ${a[i]}).`,
			array: [...a],
			cells: startCells,
			variables: [
				{ name: "i", value: i },
				{ name: "min", value: min },
				{ name: "A[min]", value: a[min] },
			],
			codeLine: 1,
			passLabel: `Pasada ${i + 1}`,
		});

		for (let j = i + 1; j <= N - 1; j++) {
			const cells: CellState[] = a.map((_, idx) =>
				sorted.has(idx) ? "sorted" : "default",
			);
			cells[j] = "comparing";
			cells[min] = "candidate";

			const isNewMin = a[j] < a[min];

			steps.push({
				explanation: `Comparamos A[${j}] = ${a[j]} con A[min] = A[${min}] = ${a[min]}. ${isNewMin ? `${a[j]} < ${a[min]}, nuevo min = ${j}.` : `${a[j]} ≥ ${a[min]}, min no cambia.`}`,
				array: [...a],
				cells,
				variables: [
					{ name: "i", value: i },
					{ name: "j", value: j },
					{ name: "min", value: isNewMin ? j : min },
					{ name: "A[min]", value: isNewMin ? a[j] : a[min] },
				],
				codeLine: isNewMin ? 4 : 3,
				passLabel: `Pasada ${i + 1}`,
			});

			if (isNewMin) min = j;
		}

		// Intercambio
		if (min !== i) {
			// Paso pre-swap
			const preSwapCells: CellState[] = a.map((_, idx) =>
				sorted.has(idx) ? "sorted" : "default",
			);
			preSwapCells[i] = "pre-swap";
			preSwapCells[min] = "pre-swap";

			steps.push({
				explanation: `El mínimo encontrado es A[${min}] = ${a[min]}. Se va a intercambiar con A[${i}] = ${a[i]}.`,
				array: [...a],
				cells: preSwapCells,
				variables: [
					{ name: "i", value: i },
					{ name: "min", value: min },
					{ name: "A[i]", value: a[i] },
					{ name: "A[min]", value: a[min] },
				],
				codeLine: 7,
				passLabel: `Pasada ${i + 1}`,
			});

			const aux = a[i];
			a[i] = a[min];
			a[min] = aux;
		}

		sorted.add(i);
		const swapCells: CellState[] = a.map((_, idx) =>
			sorted.has(idx) ? "sorted" : "default",
		);
		if (min !== i) swapCells[min] = "swapped";

		steps.push({
			explanation:
				min !== i
					? `¡Intercambio realizado! A[${i}] = ${a[i]} queda en su posición final.`
					: `A[${i}] = ${a[i]} ya estaba en su posición correcta. No se intercambia.`,
			array: [...a],
			cells: swapCells,
			variables: [
				{ name: "i", value: i },
				{ name: "min", value: min },
			],
			codeLine: 9,
			passLabel: `Pasada ${i + 1} completada`,
		});
	}

	sorted.add(N - 1);
	return steps;
}

function genInsercion(arr: number[]): SimStep[] {
	const steps: SimStep[] = [];
	const a = [...arr];
	const N = a.length;

	steps.push({
		explanation: `Ordenamos con Inserción Directa. Tomamos cada elemento desde la posición 1 y lo insertamos en su lugar entre los anteriores.`,
		array: [...a],
		cells: a.map(() => "default"),
		variables: [{ name: "N", value: N }],
		codeLine: 0,
	});

	for (let i = 1; i <= N - 1; i++) {
		const valor = a[i];
		let j = i - 1;

		const takeCells: CellState[] = a.map(() => "default");
		takeCells[i] = "candidate";
		// Marcar la parte ya ordenada
		for (let s = 0; s < i; s++) takeCells[s] = "sorted";

		steps.push({
			explanation: `Tomamos valor = A[${i}] = ${valor}. Buscamos dónde insertarlo entre A[0]..A[${i - 1}].`,
			array: [...a],
			cells: takeCells,
			variables: [
				{ name: "i", value: i },
				{ name: "valor", value: valor },
				{ name: "j", value: j },
			],
			codeLine: 1,
			passLabel: `Inserción ${i}`,
		});

		while (j >= 0 && valor < a[j]) {
			const cells: CellState[] = a.map((_, idx) =>
				idx < i ? "sorted" : "default",
			);
			cells[j] = "comparing";
			if (j + 1 <= i) cells[j + 1] = "shifting";

			steps.push({
				explanation: `valor = ${valor} < A[${j}] = ${a[j]}. Corremos A[${j}] → A[${j + 1}] (se desplaza a la derecha).`,
				array: [...a],
				cells,
				variables: [
					{ name: "i", value: i },
					{ name: "valor", value: valor },
					{ name: "j", value: j },
					{ name: "A[j]", value: a[j] },
				],
				codeLine: 4,
				passLabel: `Inserción ${i}`,
			});

			a[j + 1] = a[j];
			j = j - 1;

			// Mostrar el estado después del desplazamiento
			const afterCells: CellState[] = a.map((_, idx) =>
				idx < i ? "sorted" : "default",
			);
			if (j + 1 >= 0 && j + 1 <= i) afterCells[j + 1] = "candidate"; // hueco donde irá el valor
			if (j + 2 <= i) afterCells[j + 2] = "swapped";

			steps.push({
				explanation: `A[${j + 2}] se movió a la derecha. ${j >= 0 ? `Ahora comparamos valor = ${valor} con A[${j}] = ${a[j]}.` : `No hay más elementos a la izquierda.`}`,
				array: [...a],
				cells: afterCells,
				variables: [
					{ name: "i", value: i },
					{ name: "valor", value: valor },
					{ name: "j", value: j },
				],
				codeLine: 5,
				passLabel: `Inserción ${i}`,
			});
		}

		a[j + 1] = valor;

		const insertCells: CellState[] = a.map(() => "default");
		for (let s = 0; s <= i; s++) insertCells[s] = "sorted";
		insertCells[j + 1] = "inserted";

		steps.push({
			explanation: `Insertamos valor = ${valor} en la posición ${j + 1}. Las posiciones 0 a ${i} quedan ordenadas.`,
			array: [...a],
			cells: insertCells,
			variables: [
				{ name: "i", value: i },
				{ name: "valor", value: valor },
				{ name: "j+1", value: j + 1 },
			],
			codeLine: 7,
			passLabel: `Inserción ${i} completada`,
		});
	}

	return steps;
}

// ─────────────────────────────────────────────
// FUNCIÓN PRINCIPAL DE GENERACIÓN
// ─────────────────────────────────────────────

function generateSimulation(
	algorithm: AlgorithmId,
	arr: number[],
	searchValue?: number,
): SimResult {
	let steps: SimStep[];
	let finalMessage: string;

	switch (algorithm) {
		case "busqueda-secuencial":
			steps = genBusquedaSecuencial(arr, searchValue ?? 0);
			finalMessage = "Búsqueda secuencial completada.";
			break;
		case "busqueda-binaria":
			steps = genBusquedaBinaria(arr, searchValue ?? 0);
			finalMessage = "Búsqueda binaria completada.";
			break;
		case "burbuja":
			steps = genBurbuja(arr);
			finalMessage = "Ordenamiento por Burbuja completado.";
			break;
		case "burbuja-mejorado":
			steps = genBurbujaMejorado(arr);
			finalMessage = "Ordenamiento por Burbuja Mejorado completado.";
			break;
		case "seleccion":
			steps = genSeleccion(arr);
			finalMessage = "Ordenamiento por Selección completado.";
			break;
		case "insercion":
			steps = genInsercion(arr);
			finalMessage = "Ordenamiento por Inserción completado.";
			break;
	}

	return { steps, pseudocode: PSEUDOCODES[algorithm], finalMessage };
}

// ─────────────────────────────────────────────
// COMPONENTES VISUALES
// ─────────────────────────────────────────────

const CELL_COLORS: Record<CellState, string> = {
	default: "bg-slate-800 border-slate-700 text-slate-200",
	comparing: "bg-sky-500/30 border-sky-400 text-sky-300",
	candidate: "bg-amber-500/30 border-amber-400 text-amber-300",
	sorted: "bg-emerald-500/20 border-emerald-500/50 text-emerald-400",
	swapped: "bg-rose-500/30 border-rose-400 text-rose-300",
	"pre-swap":
		"bg-orange-500/40 border-orange-400 text-orange-200 animate-pulse",
	"out-of-range": "bg-slate-900/50 border-slate-800 text-slate-600",
	found: "bg-emerald-500/40 border-emerald-400 text-emerald-300",
	inserted: "bg-purple-500/30 border-purple-400 text-purple-300",
	shifting: "bg-violet-500/30 border-violet-400 text-violet-300",
};

function ArrayView({
	array,
	cells,
	markers,
}: {
	array: number[];
	cells: CellState[];
	markers?: { index: number; label: string; color: string }[];
}) {
	return (
		<div className="space-y-1">
			<div className="flex flex-wrap gap-0 justify-center items-end">
				{array.map((val, i) => (
					<div key={i} className="flex items-end">
						<div className="flex flex-col items-center mx-0.5">
							<div
								className={`w-12 h-12 flex items-center justify-center font-mono text-lg font-bold rounded-lg border-2 transition-all duration-300 ${CELL_COLORS[cells[i] || "default"]}`}
							>
								{val}
							</div>
							<span className="text-[10px] font-mono text-slate-500 mt-0.5">
								[{i}]
							</span>
							{markers
								?.filter((m) => m.index === i)
								.map((m) => (
									<span
										key={m.label}
										className={`text-[10px] font-mono font-bold ${m.color}`}
									>
										↑{m.label}
									</span>
								))}
						</div>
						{/* Flecha ↔ entre celdas pre-swap adyacentes */}
						{cells[i] === "pre-swap" &&
							i + 1 < array.length &&
							cells[i + 1] === "pre-swap" && (
								<span className="text-orange-400 font-bold text-lg mb-3 mx-0.5 animate-bounce">
									⇄
								</span>
							)}
					</div>
				))}
			</div>

			{/* Leyenda compacta */}
			<div className="flex flex-wrap gap-3 justify-center text-[10px] text-slate-500 pt-2">
				{cells.includes("comparing") && (
					<span className="flex items-center gap-1">
						<span className="w-2.5 h-2.5 rounded bg-sky-500/30 border border-sky-400" />
						Comparando
					</span>
				)}
				{cells.includes("candidate") && (
					<span className="flex items-center gap-1">
						<span className="w-2.5 h-2.5 rounded bg-amber-500/30 border border-amber-400" />
						Candidato
					</span>
				)}
				{cells.includes("pre-swap") && (
					<span className="flex items-center gap-1">
						<span className="w-2.5 h-2.5 rounded bg-orange-500/40 border border-orange-400 animate-pulse" />
						Por intercambiar
					</span>
				)}
				{cells.includes("swapped") && (
					<span className="flex items-center gap-1">
						<span className="w-2.5 h-2.5 rounded bg-rose-500/30 border border-rose-400" />
						Intercambiado
					</span>
				)}
				{cells.includes("shifting") && (
					<span className="flex items-center gap-1">
						<span className="w-2.5 h-2.5 rounded bg-violet-500/30 border border-violet-400" />
						Desplazando →
					</span>
				)}
				{cells.includes("sorted") && (
					<span className="flex items-center gap-1">
						<span className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/50" />
						Ordenado
					</span>
				)}
				{cells.includes("found") && (
					<span className="flex items-center gap-1">
						<span className="w-2.5 h-2.5 rounded bg-emerald-500/40 border border-emerald-400" />
						Encontrado
					</span>
				)}
			</div>
		</div>
	);
}

function PseudocodeView({
	code,
	activeLine,
}: {
	code: CodeLine[];
	activeLine: number;
}) {
	return (
		<div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs overflow-x-auto">
			{code.map((line, i) => (
				<div
					key={i}
					className={`px-2 py-0.5 rounded transition-colors ${
						i === activeLine
							? "bg-sky-500/20 text-sky-300 border-l-2 border-sky-400"
							: "text-slate-500 border-l-2 border-transparent"
					}`}
					style={{ paddingLeft: `${line.indent * 16 + 8}px` }}
				>
					<span className="text-slate-700 mr-2 select-none">{i + 1}</span>
					{line.text}
				</div>
			))}
		</div>
	);
}

function VariablesView({
	variables,
}: {
	variables: { name: string; value: string | number }[];
}) {
	if (variables.length === 0) return null;
	return (
		<div className="flex flex-wrap gap-2">
			{variables.map((v, i) => (
				<span
					key={i}
					className="text-xs font-mono bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300"
				>
					<span className="text-slate-500">{v.name} = </span>
					<span className="text-amber-400 font-bold">{String(v.value)}</span>
				</span>
			))}
		</div>
	);
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────

export default function SimuladorArreglos() {
	const [algorithm, setAlgorithm] = useState<AlgorithmId>("burbuja");
	const [arrayInput, setArrayInput] = useState("40, 21, 4, 9, 10, 35");
	const [searchInput, setSearchInput] = useState("9");
	const [result, setResult] = useState<SimResult | null>(null);
	const [currentStep, setCurrentStep] = useState(0);
	const [error, setError] = useState("");

	const navRef = useRef<HTMLDivElement>(null);
	const isSimulating = result !== null;
	const algoInfo = ALGORITHMS.find((a) => a.id === algorithm)!;
	const isSearch = algoInfo.category === "busqueda";
	const isBinarySearch = algorithm === "busqueda-binaria";

	// Auto-scroll
	useEffect(() => {
		if (isSimulating && navRef.current) {
			navRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
		}
	}, [currentStep, isSimulating]);

	const goNext = useCallback(() => {
		if (!result) return;
		setCurrentStep((s) => Math.min(result.steps.length - 1, s + 1));
	}, [result]);
	const goPrev = useCallback(
		() => setCurrentStep((s) => Math.max(0, s - 1)),
		[],
	);
	const goToEnd = useCallback(() => {
		if (!result) return;
		setCurrentStep(result.steps.length - 1);
	}, [result]);

	// Atajos de teclado
	useEffect(() => {
		if (!isSimulating) return;
		function handleKey(e: KeyboardEvent) {
			if (e.key === "ArrowRight" || e.key === "ArrowDown") {
				e.preventDefault();
				goNext();
			} else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
				e.preventDefault();
				goPrev();
			} else if (e.key === "End") {
				e.preventDefault();
				goToEnd();
			} else if (e.key === "Home") {
				e.preventDefault();
				setCurrentStep(0);
			}
		}
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [isSimulating, goNext, goPrev, goToEnd]);

	function parseArray(): number[] | null {
		const parts = arrayInput
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s !== "");
		const nums = parts.map(Number);
		if (nums.some(isNaN)) return null;
		return nums;
	}

	function handleRandomize() {
		const size = 6 + Math.floor(Math.random() * 5); // 6-10 elementos
		const arr = Array.from({ length: size }, () =>
			Math.floor(Math.random() * 100),
		);
		if (isBinarySearch) arr.sort((a, b) => a - b);
		setArrayInput(arr.join(", "));
		if (isSimulating) {
			setResult(null);
			setCurrentStep(0);
		}
	}

	function handleSimulate() {
		setError("");
		const arr = parseArray();
		if (!arr || arr.length < 2) {
			setError("Ingresá al menos 2 números separados por comas.");
			return;
		}
		if (arr.length > 20) {
			setError("Para fines didácticos, usá un arreglo de hasta 20 elementos.");
			return;
		}

		if (isBinarySearch) {
			const isSorted = arr.every((v, i) => i === 0 || arr[i - 1] <= v);
			if (!isSorted) {
				setError(
					"Para búsqueda binaria, el arreglo debe estar ordenado de menor a mayor.",
				);
				return;
			}
		}

		let searchValue: number | undefined;
		if (isSearch) {
			searchValue = Number(searchInput);
			if (isNaN(searchValue)) {
				setError("Ingresá un número válido para buscar.");
				return;
			}
		}

		const sim = generateSimulation(algorithm, arr, searchValue);
		setResult(sim);
		setCurrentStep(0);
	}

	function handleReset() {
		setResult(null);
		setCurrentStep(0);
		setError("");
	}

	const step = result?.steps[currentStep];
	const isLastStep = result ? currentStep === result.steps.length - 1 : false;
	const isFirstStep = currentStep === 0;

	return (
		<div className="space-y-8 max-w-5xl mx-auto">
			{/* Header */}
			<div className="space-y-2">
				<Link
					to="/"
					className="inline-flex items-center gap-1 text-slate-400 hover:text-sky-400 transition-colors text-sm"
				>
					<ChevronLeft size={16} />
					Volver al Hub
				</Link>
				<h1 className="text-3xl font-bold">Simulador de Arreglos</h1>
				<p className="text-slate-400">
					Visualizá búsquedas y ordenamientos paso a paso sobre un arreglo, con
					el pseudocódigo resaltado y las variables en tiempo real.
				</p>
			</div>

			{/* Panel de configuración */}
			<div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-5">
				{/* Algoritmo */}
				<div>
					<label className="block text-sm font-medium text-slate-300 mb-2">
						Algoritmo
					</label>
					<select
						value={algorithm}
						onChange={(e) => {
							setAlgorithm(e.target.value as AlgorithmId);
							if (isSimulating) handleReset();
						}}
						disabled={isSimulating}
						className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-sky-500 transition-colors text-sm"
					>
						<optgroup label="Búsquedas">
							{ALGORITHMS.filter((a) => a.category === "busqueda").map((a) => (
								<option key={a.id} value={a.id}>
									{a.label}
								</option>
							))}
						</optgroup>
						<optgroup label="Ordenamientos">
							{ALGORITHMS.filter((a) => a.category === "ordenamiento").map(
								(a) => (
									<option key={a.id} value={a.id}>
										{a.label}
									</option>
								),
							)}
						</optgroup>
					</select>
				</div>

				{/* Arreglo */}
				<div>
					<label className="block text-sm font-medium text-slate-300 mb-2">
						Arreglo (valores separados por comas)
					</label>
					<div className="flex gap-2">
						<input
							type="text"
							value={arrayInput}
							onChange={(e) => {
								setArrayInput(e.target.value);
								if (isSimulating) handleReset();
							}}
							disabled={isSimulating}
							placeholder="Ej: 40, 21, 4, 9, 10, 35"
							className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 font-mono text-sm placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
						/>
						<button
							onClick={handleRandomize}
							disabled={isSimulating}
							className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 px-3 rounded-lg transition-colors text-sm"
							title="Generar arreglo aleatorio"
						>
							<Shuffle size={16} />
						</button>
					</div>
				</div>

				{/* Valor de búsqueda */}
				{isSearch && (
					<div>
						<label className="block text-sm font-medium text-slate-300 mb-2">
							Valor a buscar
						</label>
						<input
							type="number"
							value={searchInput}
							onChange={(e) => {
								setSearchInput(e.target.value);
								if (isSimulating) handleReset();
							}}
							disabled={isSimulating}
							className="w-32 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 font-mono focus:outline-none focus:border-sky-500 transition-colors"
						/>
					</div>
				)}

				{/* Error */}
				{error && (
					<p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
						{error}
					</p>
				)}

				{/* Botones */}
				<div className="flex gap-3">
					<button
						onClick={handleSimulate}
						disabled={isSimulating}
						className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-30 text-white font-medium py-3 px-6 rounded-lg transition-colors"
					>
						<Play size={18} />
						Simular paso a paso
					</button>
					{isSimulating && (
						<button
							onClick={handleReset}
							className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 px-4 rounded-lg transition-colors"
							title="Reiniciar"
						>
							<RotateCcw size={18} />
						</button>
					)}
				</div>
			</div>

			{/* Panel de simulación */}
			{isSimulating && step && result && (
				<div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
					{/* Barra de progreso */}
					<div className="h-1 bg-slate-800">
						<div
							className="h-full bg-sky-500 transition-all duration-300"
							style={{
								width: `${((currentStep + 1) / result.steps.length) * 100}%`,
							}}
						/>
					</div>

					<div className="p-6 space-y-5">
						{/* Header */}
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-xs font-medium text-sky-400 bg-sky-500/10 px-2 py-1 rounded">
								Paso {currentStep + 1} de {result.steps.length}
							</span>
							<span className="text-xs text-slate-500">{algoInfo.label}</span>
							{step.passLabel && (
								<span className="text-xs font-medium text-purple-400 bg-purple-500/10 px-2 py-1 rounded">
									{step.passLabel}
								</span>
							)}
						</div>

						{/* Layout dos columnas en desktop */}
						<div className="flex flex-col lg:flex-row gap-5">
							{/* Columna izquierda: Pseudocódigo */}
							<div className="lg:w-[340px] lg:shrink-0">
								<h3 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
									Pseudocódigo
								</h3>
								<PseudocodeView
									code={result.pseudocode}
									activeLine={step.codeLine}
								/>
							</div>

							{/* Columna derecha: Arreglo + Variables + Explicación */}
							<div className="flex-1 space-y-4">
								<div>
									<h3 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
										Arreglo
									</h3>
									<ArrayView
										array={step.array}
										cells={step.cells}
										markers={step.markers}
									/>
								</div>

								{/* Variables */}
								<div>
									<h3 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
										Variables
									</h3>
									<VariablesView variables={step.variables} />
								</div>

								{/* Explicación */}
								<p className="text-sm text-slate-300 bg-slate-800/50 rounded-lg px-4 py-2.5 leading-relaxed">
									{step.explanation}
								</p>
							</div>
						</div>

						{/* Navegación */}
						<div
							ref={navRef}
							className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800"
						>
							<button
								onClick={goNext}
								disabled={isLastStep}
								className="w-full sm:w-auto order-first sm:order-last flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-sky-600 hover:bg-sky-500 text-white"
							>
								Siguiente
								<ArrowRight size={16} />
							</button>

							<div className="hidden sm:flex gap-1.5 flex-wrap justify-center w-auto">
								{result.steps.map((_, i) => (
									<button
										key={i}
										onClick={() => setCurrentStep(i)}
										className={`w-2 h-2 rounded-full transition-all ${i === currentStep ? "bg-sky-500 w-4" : i < currentStep ? "bg-sky-500/40" : "bg-slate-700"}`}
									/>
								))}
							</div>

							<div className="flex w-full sm:w-auto items-center gap-2 sm:order-first">
								<button
									onClick={goPrev}
									disabled={isFirstStep}
									className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-slate-800 hover:bg-slate-700 text-slate-300"
								>
									<ArrowLeft size={16} />
									Anterior
								</button>
								{!isLastStep && (
									<button
										onClick={goToEnd}
										className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 sm:order-last"
										title="Ir al resultado final"
									>
										<SkipForward size={14} />
										Resultado
									</button>
								)}
							</div>
						</div>

						<div className="flex items-center justify-center gap-2 text-xs text-slate-600 pt-1">
							<Keyboard size={12} />
							<span>
								Usá las flechas ← → del teclado para navegar entre pasos
							</span>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
