import { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
	ChevronLeft,
	Plus,
	Trash2,
	Copy,
	MousePointer2,
	ArrowUpRight,
	Diamond,
	Link2,
	GitBranch,
	X,
	Edit3,
	Check,
} from "lucide-react";

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

type Visibility = "+" | "-" | "#";
type RelationType = "herencia" | "asociacion" | "agregacion" | "composicion";
type EditorMode = "select" | "add-relation";

interface ClassAttribute {
	id: string;
	name: string;
	type: string;
	visibility: Visibility;
}

interface ClassMethod {
	id: string;
	name: string;
	params: string;
	returnType: string;
	visibility: Visibility;
}

interface UMLClass {
	id: string;
	name: string;
	x: number;
	y: number;
	attributes: ClassAttribute[];
	methods: ClassMethod[];
}

interface UMLRelation {
	id: string;
	type: RelationType;
	sourceId: string;
	targetId: string;
	sourceLabel: string;
	targetLabel: string;
}

const VIS_LABELS: Record<Visibility, string> = {
	"+": "Público",
	"-": "Privado",
	"#": "Protegido",
};
const VIS_PREFIX: Record<Visibility, string> = { "+": "+", "-": "−", "#": "#" };

const REL_LABELS: Record<RelationType, string> = {
	herencia: "Herencia",
	asociacion: "Asociación",
	agregacion: "Agregación",
	composicion: "Composición",
};

const REL_COLORS: Record<RelationType, string> = {
	herencia: "#38bdf8",
	asociacion: "#94a3b8",
	agregacion: "#a78bfa",
	composicion: "#f472b6",
};

const uid = () => crypto.randomUUID().slice(0, 8);

// ─────────────────────────────────────────────
// GENERACIÓN DE CÓDIGO PYTHON
// ─────────────────────────────────────────────

function generatePython(classes: UMLClass[], relations: UMLRelation[]): string {
	if (classes.length === 0)
		return "# Agregá clases al diagrama para generar código Python";

	const lines: string[] = [];

	// Ordenar: padres primero
	const parentIds = new Set(
		relations.filter((r) => r.type === "herencia").map((r) => r.targetId),
	);
	const sorted = [
		...classes.filter((c) => parentIds.has(c.id)),
		...classes.filter((c) => !parentIds.has(c.id)),
	];

	for (const cls of sorted) {
		// Herencia
		const parentRels = relations.filter(
			(r) => r.type === "herencia" && r.sourceId === cls.id,
		);
		const parentNames = parentRels
			.map((r) => classes.find((c) => c.id === r.targetId)?.name)
			.filter(Boolean);
		const inheritance =
			parentNames.length > 0 ? `(${parentNames.join(", ")})` : "";

		// Composición / Agregación entrantes (este objeto contiene a otros)
		const compRels = relations.filter(
			(r) =>
				(r.type === "composicion" || r.type === "agregacion") &&
				r.sourceId === cls.id,
		);

		lines.push(`class ${cls.name}${inheritance}:`);

		// Docstring
		lines.push(`    """Clase ${cls.name}"""`);
		lines.push("");

		// Constructor
		const ownAttrs = cls.attributes;
		const parentAttrs = parentRels.flatMap((r) => {
			const parent = classes.find((c) => c.id === r.targetId);
			return parent ? parent.attributes : [];
		});

		const allInitParams: string[] = [];
		for (const a of parentAttrs) {
			const defaultVal = getDefault(a.type);
			allInitParams.push(`${a.name}: ${a.type || "object"} = ${defaultVal}`);
		}
		for (const a of ownAttrs) {
			const defaultVal = getDefault(a.type);
			allInitParams.push(`${a.name}: ${a.type || "object"} = ${defaultVal}`);
		}

		const initLine =
			allInitParams.length > 0
				? `    def __init__(self, ${allInitParams.join(", ")}):`
				: "    def __init__(self):";
		lines.push(initLine);

		// super().__init__
		if (parentAttrs.length > 0) {
			const superArgs = parentAttrs.map((a) => a.name).join(", ");
			lines.push(`        super().__init__(${superArgs})`);
		}

		// Own attributes
		for (const a of ownAttrs) {
			const prefix =
				a.visibility === "-" ? "__" : a.visibility === "#" ? "_" : "";
			lines.push(`        self.${prefix}${a.name} = ${a.name}`);
		}

		// Composición attributes
		for (const rel of compRels) {
			const target = classes.find((c) => c.id === rel.targetId);
			if (target) {
				const varName = target.name.toLowerCase();
				if (rel.type === "composicion") {
					lines.push(
						`        self.__${varName} = ${target.name}()  # Composición`,
					);
				} else {
					lines.push(`        self.__${varName} = None  # Agregación`);
				}
			}
		}

		if (
			ownAttrs.length === 0 &&
			parentAttrs.length === 0 &&
			compRels.length === 0
		) {
			lines.push("        pass");
		}

		lines.push("");

		// Getters y Setters para privados
		for (const a of ownAttrs) {
			if (a.visibility === "-") {
				const retType = a.type ? ` -> ${a.type}` : "";
				lines.push(`    def get_${a.name}(self)${retType}:`);
				lines.push(`        return self.__${a.name}`);
				lines.push("");
				lines.push(
					`    def set_${a.name}(self, ${a.name}: ${a.type || "object"}):`,
				);
				lines.push(`        self.__${a.name} = ${a.name}`);
				lines.push("");
			} else if (a.visibility === "#") {
				const retType = a.type ? ` -> ${a.type}` : "";
				lines.push(`    def get_${a.name}(self)${retType}:`);
				lines.push(`        return self._${a.name}`);
				lines.push("");
				lines.push(
					`    def set_${a.name}(self, ${a.name}: ${a.type || "object"}):`,
				);
				lines.push(`        self._${a.name} = ${a.name}`);
				lines.push("");
			}
		}

		// Métodos custom
		for (const m of cls.methods) {
			if (["__init__", "get_", "set_"].some((s) => m.name.startsWith(s)))
				continue;
			const retAnnotation = m.returnType ? ` -> ${m.returnType}` : "";
			const params = m.params ? `self, ${m.params}` : "self";
			lines.push(`    def ${m.name}(${params})${retAnnotation}:`);
			lines.push(`        pass  # TODO: implementar`);
			lines.push("");
		}

		// __str__
		if (ownAttrs.length > 0) {
			lines.push("    def __str__(self):");
			const parts = ownAttrs.map((a) => {
				const prefix =
					a.visibility === "-" ? "__" : a.visibility === "#" ? "_" : "";
				return `${a.name}={self.${prefix}${a.name}}`;
			});
			lines.push(`        return f"${cls.name}(${parts.join(", ")})"`);
			lines.push("");
		}

		lines.push("");
	}

	// Main de ejemplo
	if (classes.length > 0) {
		lines.push('if __name__ == "__main__":');
		for (const cls of sorted) {
			const varName = cls.name.toLowerCase();
			lines.push(`    ${varName} = ${cls.name}()`);
			lines.push(`    print(${varName})`);
		}
	}

	return lines.join("\n");
}

function getDefault(type: string): string {
	const t = type.toLowerCase().trim();
	if (t === "int" || t === "float") return "0";
	if (t === "str" || t === "string") return '""';
	if (t === "bool") return "False";
	if (t === "list") return "[]";
	if (t === "dict") return "{}";
	return "None";
}

// ─────────────────────────────────────────────
// COMPONENTE: Caja UML de clase
// ─────────────────────────────────────────────

function UMLClassBox({
	cls,
	isSelected,
	isRelSource,
	onMouseDown,
	onClick,
	onEdit,
}: {
	cls: UMLClass;
	isSelected: boolean;
	isRelSource: boolean;
	onMouseDown: (e: React.MouseEvent | React.TouchEvent) => void;
	onClick: () => void;
	onEdit: () => void;
}) {
	return (
		<div
			className={`absolute select-none cursor-grab active:cursor-grabbing rounded-lg border-2 shadow-lg min-w-[160px] transition-shadow ${
				isSelected
					? "border-sky-400 shadow-sky-500/20"
					: isRelSource
						? "border-amber-400 shadow-amber-500/20"
						: "border-slate-600 shadow-black/20"
			}`}
			style={{ left: cls.x, top: cls.y, zIndex: isSelected ? 10 : 1 }}
			onMouseDown={onMouseDown}
			onTouchStart={onMouseDown}
			onClick={(e) => {
				e.stopPropagation();
				onClick();
			}}
		>
			{/* Botón editar */}
			<button
				className="absolute -top-2.5 -right-2.5 w-6 h-6 flex items-center justify-center bg-slate-700 hover:bg-sky-600 border border-slate-600 hover:border-sky-500 rounded-full text-slate-400 hover:text-white transition-colors z-20 shadow-md"
				onClick={(e) => {
					e.stopPropagation();
					onEdit();
				}}
				onMouseDown={(e) => e.stopPropagation()}
				onTouchStart={(e) => e.stopPropagation()}
				title={`Editar ${cls.name}`}
			>
				<Edit3 size={11} />
			</button>
			{/* Nombre */}
			<div
				className={`px-3 py-2 text-center font-bold text-sm border-b ${
					isSelected
						? "bg-sky-500/20 border-sky-500/30"
						: "bg-slate-800 border-slate-700"
				}`}
			>
				{cls.name}
			</div>

			{/* Atributos */}
			<div
				className={`px-3 py-1.5 text-xs font-mono border-b min-h-[24px] ${
					isSelected
						? "bg-slate-800/80 border-sky-500/20"
						: "bg-slate-900 border-slate-700"
				}`}
			>
				{cls.attributes.length === 0 ? (
					<span className="text-slate-600 italic">sin atributos</span>
				) : (
					cls.attributes.map((a) => (
						<div key={a.id} className="text-slate-300 truncate">
							<span className="text-slate-500">{VIS_PREFIX[a.visibility]}</span>{" "}
							{a.name}
							{a.type ? `: ${a.type}` : ""}
						</div>
					))
				)}
			</div>

			{/* Métodos */}
			<div
				className={`px-3 py-1.5 text-xs font-mono min-h-[24px] rounded-b-lg ${
					isSelected ? "bg-slate-800/80" : "bg-slate-900"
				}`}
			>
				{cls.methods.length === 0 ? (
					<span className="text-slate-600 italic">sin métodos</span>
				) : (
					cls.methods.map((m) => (
						<div key={m.id} className="text-slate-300 truncate">
							<span className="text-slate-500">{VIS_PREFIX[m.visibility]}</span>{" "}
							{m.name}({m.params}){m.returnType ? `: ${m.returnType}` : ""}
						</div>
					))
				)}
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────
// COMPONENTE: Líneas SVG de relaciones
// ─────────────────────────────────────────────

function RelationLines({
	relations,
	classes,
}: {
	relations: UMLRelation[];
	classes: UMLClass[];
}) {
	// Estimar dimensiones de la caja UML
	function getBox(cls: UMLClass) {
		const w = 160;
		const headerH = 36;
		const attrH = Math.max(28, cls.attributes.length * 20 + 12);
		const methH = Math.max(28, cls.methods.length * 20 + 12);
		const h = headerH + attrH + methH;
		return { x: cls.x, y: cls.y, w, h };
	}

	// Punto donde la línea centro→target intersecta el borde del rectángulo
	function getEdgePoint(
		box: { x: number; y: number; w: number; h: number },
		target: { x: number; y: number },
	): { x: number; y: number } {
		const cx = box.x + box.w / 2;
		const cy = box.y + box.h / 2;
		const dx = target.x - cx;
		const dy = target.y - cy;
		if (dx === 0 && dy === 0) return { x: cx, y: cy };

		const hw = box.w / 2;
		const hh = box.h / 2;
		const sx = hw / (Math.abs(dx) || 0.001);
		const sy = hh / (Math.abs(dy) || 0.001);
		const s = Math.min(sx, sy);
		return { x: cx + dx * s, y: cy + dy * s };
	}

	function markerEnd(type: RelationType): string {
		switch (type) {
			case "herencia":
				return "url(#arrowHerencia)";
			case "asociacion":
				return "url(#arrowAsoc)";
			case "agregacion":
				return "url(#diamondOpen)";
			case "composicion":
				return "url(#diamondFilled)";
		}
	}

	// Calcular dimensiones del SVG para cubrir todas las clases
	const svgW =
		classes.length > 0
			? Math.max(...classes.map((c) => c.x + getBox(c).w + 40), 500)
			: 500;
	const svgH =
		classes.length > 0
			? Math.max(...classes.map((c) => c.y + getBox(c).h + 40), 500)
			: 500;

	return (
		<svg
			className="absolute top-0 left-0 pointer-events-none"
			style={{ zIndex: 0, width: svgW, height: svgH }}
		>
			<defs>
				<marker
					id="arrowHerencia"
					viewBox="0 0 12 12"
					refX="12"
					refY="6"
					markerWidth="14"
					markerHeight="14"
					orient="auto"
				>
					<path
						d="M0,0 L12,6 L0,12 Z"
						fill="#0f172a"
						stroke="#38bdf8"
						strokeWidth="1.5"
					/>
				</marker>
				<marker
					id="arrowAsoc"
					viewBox="0 0 10 10"
					refX="10"
					refY="5"
					markerWidth="10"
					markerHeight="10"
					orient="auto"
				>
					<path
						d="M0,0 L10,5 L0,10"
						fill="none"
						stroke="#94a3b8"
						strokeWidth="1.5"
					/>
				</marker>
				<marker
					id="diamondOpen"
					viewBox="0 0 16 10"
					refX="16"
					refY="5"
					markerWidth="14"
					markerHeight="10"
					orient="auto"
				>
					<path
						d="M0,5 L8,0 L16,5 L8,10 Z"
						fill="#0f172a"
						stroke="#a78bfa"
						strokeWidth="1.5"
					/>
				</marker>
				<marker
					id="diamondFilled"
					viewBox="0 0 16 10"
					refX="16"
					refY="5"
					markerWidth="14"
					markerHeight="10"
					orient="auto"
				>
					<path
						d="M0,5 L8,0 L16,5 L8,10 Z"
						fill="#f472b6"
						stroke="#f472b6"
						strokeWidth="1"
					/>
				</marker>
			</defs>

			{relations.map((rel) => {
				const source = classes.find((c) => c.id === rel.sourceId);
				const target = classes.find((c) => c.id === rel.targetId);
				if (!source || !target) return null;

				const sBox = getBox(source);
				const tBox = getBox(target);
				const sCtr = { x: sBox.x + sBox.w / 2, y: sBox.y + sBox.h / 2 };
				const tCtr = { x: tBox.x + tBox.w / 2, y: tBox.y + tBox.h / 2 };

				const s = getEdgePoint(sBox, tCtr);
				const t = getEdgePoint(tBox, sCtr);

				return (
					<g key={rel.id}>
						<line
							x1={s.x}
							y1={s.y}
							x2={t.x}
							y2={t.y}
							stroke={REL_COLORS[rel.type]}
							strokeWidth="2"
							strokeDasharray={
								rel.type === "asociacion" || rel.type === "herencia"
									? "none"
									: "6,3"
							}
							markerEnd={markerEnd(rel.type)}
						/>
						<text
							x={(s.x + t.x) / 2}
							y={(s.y + t.y) / 2 - 8}
							fill={REL_COLORS[rel.type]}
							fontSize="10"
							textAnchor="middle"
							className="select-none"
						>
							{REL_LABELS[rel.type]}
						</text>
						{rel.sourceLabel && (
							<text
								x={s.x + (t.x - s.x) * 0.15}
								y={s.y + (t.y - s.y) * 0.15 - 8}
								fill="#94a3b8"
								fontSize="10"
								textAnchor="middle"
							>
								{rel.sourceLabel}
							</text>
						)}
						{rel.targetLabel && (
							<text
								x={s.x + (t.x - s.x) * 0.85}
								y={s.y + (t.y - s.y) * 0.85 - 8}
								fill="#94a3b8"
								fontSize="10"
								textAnchor="middle"
							>
								{rel.targetLabel}
							</text>
						)}
					</g>
				);
			})}
		</svg>
	);
}

// ─────────────────────────────────────────────
// COMPONENTE: Panel de edición de clase
// ─────────────────────────────────────────────

function ClassEditor({
	cls,
	onUpdate,
	onDelete,
	onClose,
}: {
	cls: UMLClass;
	onUpdate: (updated: UMLClass) => void;
	onDelete: () => void;
	onClose: () => void;
}) {
	const [draft, setDraft] = useState<UMLClass>({
		...cls,
		attributes: cls.attributes.map((a) => ({ ...a })),
		methods: cls.methods.map((m) => ({ ...m })),
	});

	function save() {
		onUpdate(draft);
		onClose();
	}

	function addAttr() {
		setDraft({
			...draft,
			attributes: [
				...draft.attributes,
				{ id: uid(), name: "nuevo", type: "int", visibility: "-" },
			],
		});
	}
	function removeAttr(id: string) {
		setDraft({
			...draft,
			attributes: draft.attributes.filter((a) => a.id !== id),
		});
	}
	function updateAttr(id: string, field: string, value: string) {
		setDraft({
			...draft,
			attributes: draft.attributes.map((a) =>
				a.id === id ? { ...a, [field]: value } : a,
			),
		});
	}

	function addMethod() {
		setDraft({
			...draft,
			methods: [
				...draft.methods,
				{
					id: uid(),
					name: "nuevo_metodo",
					params: "",
					returnType: "",
					visibility: "+",
				},
			],
		});
	}
	function removeMethod(id: string) {
		setDraft({ ...draft, methods: draft.methods.filter((m) => m.id !== id) });
	}
	function updateMethod(id: string, field: string, value: string) {
		setDraft({
			...draft,
			methods: draft.methods.map((m) =>
				m.id === id ? { ...m, [field]: value } : m,
			),
		});
	}

	const mouseDownTarget = useRef<EventTarget | null>(null);

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4"
			onMouseDown={(e) => {
				mouseDownTarget.current = e.target;
			}}
			onClick={(e) => {
				// Solo cerrar si mousedown Y mouseup fueron en el backdrop (no drag desde input)
				if (
					e.target === e.currentTarget &&
					mouseDownTarget.current === e.currentTarget
				)
					onClose();
				mouseDownTarget.current = null;
			}}
		>
			{/* Backdrop */}
			<div className="absolute inset-0 bg-black/60" />
			{/* Modal */}
			<div className="relative bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-4 max-h-[85vh] overflow-y-auto w-full max-w-md shadow-2xl">
				<div className="flex items-center justify-between">
					<h3 className="font-bold text-sm">Editar Clase</h3>
					<button onClick={onClose} className="text-slate-500 hover:text-white">
						<X size={16} />
					</button>
				</div>

				{/* Nombre */}
				<div>
					<label className="text-xs text-slate-400 block mb-1">
						Nombre de la clase
					</label>
					<input
						value={draft.name}
						onChange={(e) =>
							setDraft({
								...draft,
								name: e.target.value.replace(/[^a-zA-Z0-9_]/g, ""),
							})
						}
						className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 font-mono text-sm focus:outline-none focus:border-sky-500"
					/>
				</div>

				{/* Atributos */}
				<div>
					<div className="flex items-center justify-between mb-1">
						<label className="text-xs text-slate-400">Atributos</label>
						<button
							onClick={addAttr}
							className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
						>
							<Plus size={12} />
							Agregar
						</button>
					</div>
					<div className="space-y-1.5">
						{draft.attributes.map((a) => (
							<div key={a.id} className="flex gap-1 items-center">
								<select
									value={a.visibility}
									onChange={(e) =>
										updateAttr(a.id, "visibility", e.target.value)
									}
									className="bg-slate-950 border border-slate-700 rounded px-1 py-1 text-xs w-12 focus:outline-none"
								>
									<option value="+">+</option>
									<option value="-">−</option>
									<option value="#">#</option>
								</select>
								<input
									value={a.name}
									onChange={(e) => updateAttr(a.id, "name", e.target.value)}
									placeholder="nombre"
									className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-sky-500"
								/>
								<input
									value={a.type}
									onChange={(e) => updateAttr(a.id, "type", e.target.value)}
									placeholder="tipo"
									className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-sky-500"
								/>
								<button
									onClick={() => removeAttr(a.id)}
									className="text-slate-600 hover:text-red-400"
								>
									<Trash2 size={12} />
								</button>
							</div>
						))}
					</div>
				</div>

				{/* Métodos */}
				<div>
					<div className="flex items-center justify-between mb-1">
						<label className="text-xs text-slate-400">Métodos</label>
						<button
							onClick={addMethod}
							className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
						>
							<Plus size={12} />
							Agregar
						</button>
					</div>
					<div className="space-y-1.5">
						{draft.methods.map((m) => (
							<div key={m.id} className="flex gap-1 items-center">
								<select
									value={m.visibility}
									onChange={(e) =>
										updateMethod(m.id, "visibility", e.target.value)
									}
									className="bg-slate-950 border border-slate-700 rounded px-1 py-1 text-xs w-12 focus:outline-none"
								>
									<option value="+">+</option>
									<option value="-">−</option>
									<option value="#">#</option>
								</select>
								<input
									value={m.name}
									onChange={(e) => updateMethod(m.id, "name", e.target.value)}
									placeholder="nombre"
									className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-sky-500"
								/>
								<input
									value={m.params}
									onChange={(e) => updateMethod(m.id, "params", e.target.value)}
									placeholder="params"
									className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-sky-500"
								/>
								<input
									value={m.returnType}
									onChange={(e) =>
										updateMethod(m.id, "returnType", e.target.value)
									}
									placeholder="retorno"
									className="w-14 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-sky-500"
								/>
								<button
									onClick={() => removeMethod(m.id)}
									className="text-slate-600 hover:text-red-400"
								>
									<Trash2 size={12} />
								</button>
							</div>
						))}
					</div>
				</div>

				<div className="flex gap-2 pt-2 border-t border-slate-800">
					<button
						onClick={save}
						className="flex-1 flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white text-sm py-1.5 rounded-lg transition-colors"
					>
						<Check size={14} />
						Guardar
					</button>
					<button
						onClick={onDelete}
						className="flex items-center justify-center gap-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-sm py-1.5 px-3 rounded-lg transition-colors"
					>
						<Trash2 size={14} />
					</button>
				</div>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────

const INITIAL_CLASSES: UMLClass[] = [
	{
		id: "punto",
		name: "Punto",
		x: 80,
		y: 60,
		attributes: [
			{ id: "a1", name: "x", type: "int", visibility: "-" },
			{ id: "a2", name: "y", type: "int", visibility: "-" },
		],
		methods: [
			{
				id: "m1",
				name: "mostrar_datos",
				params: "",
				returnType: "",
				visibility: "+",
			},
		],
	},
	{
		id: "punto3d",
		name: "Punto3D",
		x: 80,
		y: 300,
		attributes: [{ id: "a3", name: "z", type: "int", visibility: "-" }],
		methods: [
			{
				id: "m2",
				name: "mostrar_datos",
				params: "",
				returnType: "",
				visibility: "+",
			},
		],
	},
];

const INITIAL_RELATIONS: UMLRelation[] = [
	{
		id: "r1",
		type: "herencia",
		sourceId: "punto3d",
		targetId: "punto",
		sourceLabel: "",
		targetLabel: "",
	},
];

export default function DiagramaClases() {
	const [classes, setClasses] = useState<UMLClass[]>(INITIAL_CLASSES);
	const [relations, setRelations] = useState<UMLRelation[]>(INITIAL_RELATIONS);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [mode, setMode] = useState<EditorMode>("select");
	const [relType, setRelType] = useState<RelationType>("herencia");
	const [relSource, setRelSource] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const canvasRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<{
		id: string;
		offsetX: number;
		offsetY: number;
	} | null>(null);

	// ── Drag & Drop ──
	const handleDragStart = useCallback(
		(cls: UMLClass, e: React.MouseEvent | React.TouchEvent) => {
			if (mode !== "select") return;
			e.preventDefault();
			const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
			const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;
			dragRef.current = {
				id: cls.id,
				offsetX: clientX - rect.left - cls.x,
				offsetY: clientY - rect.top - cls.y,
			};

			function onMove(ev: MouseEvent | TouchEvent) {
				if (!dragRef.current || !canvasRef.current) return;
				const dragId = dragRef.current.id;
				const cx = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
				const cy = "touches" in ev ? ev.touches[0].clientY : ev.clientY;
				const r = canvasRef.current.getBoundingClientRect();
				const newX = Math.max(0, cx - r.left - dragRef.current.offsetX);
				const newY = Math.max(0, cy - r.top - dragRef.current.offsetY);
				setClasses((prev) =>
					prev.map((c) => (c.id === dragId ? { ...c, x: newX, y: newY } : c)),
				);
			}

			function onUp() {
				dragRef.current = null;
				window.removeEventListener("mousemove", onMove);
				window.removeEventListener("mouseup", onUp);
				window.removeEventListener("touchmove", onMove);
				window.removeEventListener("touchend", onUp);
			}

			window.addEventListener("mousemove", onMove);
			window.addEventListener("mouseup", onUp);
			window.addEventListener("touchmove", onMove, { passive: false });
			window.addEventListener("touchend", onUp);
		},
		[mode],
	);

	// ── Click en clase ──
	function handleClassClick(cls: UMLClass) {
		if (mode === "add-relation") {
			if (!relSource) {
				setRelSource(cls.id);
			} else if (relSource !== cls.id) {
				// Crear relación
				const exists = relations.some(
					(r) =>
						r.sourceId === relSource &&
						r.targetId === cls.id &&
						r.type === relType,
				);
				if (!exists) {
					setRelations([
						...relations,
						{
							id: uid(),
							type: relType,
							sourceId: relSource,
							targetId: cls.id,
							sourceLabel: "",
							targetLabel: "",
						},
					]);
				}
				setRelSource(null);
				setMode("select");
			}
		} else {
			setSelectedId(cls.id);
		}
	}

	// ── Agregar clase ──
	function addClass() {
		const names = classes.map((c) => c.name);
		let newName = "NuevaClase";
		let i = 1;
		while (names.includes(newName)) {
			newName = `NuevaClase${i}`;
			i++;
		}

		setClasses([
			...classes,
			{
				id: uid(),
				name: newName,
				x: 50 + Math.random() * 200,
				y: 50 + Math.random() * 200,
				attributes: [],
				methods: [],
			},
		]);
	}

	// ── Eliminar clase ──
	function deleteClass(id: string) {
		setClasses(classes.filter((c) => c.id !== id));
		setRelations(
			relations.filter((r) => r.sourceId !== id && r.targetId !== id),
		);
		setSelectedId(null);
		setEditingId(null);
	}

	// ── Eliminar relación ──
	function deleteRelation(id: string) {
		setRelations(relations.filter((r) => r.id !== id));
	}

	// ── Copiar código ──
	const pythonCode = generatePython(classes, relations);

	function copyCode() {
		navigator.clipboard.writeText(pythonCode).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	}

	const editingClass = classes.find((c) => c.id === editingId);

	return (
		<div className="space-y-6 max-w-7xl mx-auto">
			{/* Header */}
			<div className="space-y-2">
				<Link
					to="/"
					className="inline-flex items-center gap-1 text-slate-400 hover:text-sky-400 transition-colors text-sm"
				>
					<ChevronLeft size={16} />
					Volver al Hub
				</Link>
				<h1 className="text-3xl font-bold">Diagrama de Clases UML</h1>
				<p className="text-slate-400">
					Diseñá tu diagrama de clases arrastrando las cajas, definí atributos y
					métodos, y obtené el código Python generado automáticamente.
				</p>
			</div>

			{/* Toolbar */}
			<div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex flex-wrap gap-2 items-center">
				{/* Modo selector */}
				<button
					onClick={() => {
						setMode("select");
						setRelSource(null);
					}}
					className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${mode === "select" ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}
				>
					<MousePointer2 size={14} />
					Seleccionar
				</button>

				<div className="w-px h-6 bg-slate-700" />

				{/* Agregar clase */}
				<button
					onClick={addClass}
					className="flex items-center gap-1.5 text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition-colors"
				>
					<Plus size={14} />
					Clase
				</button>

				<div className="w-px h-6 bg-slate-700" />

				{/* Relaciones */}
				{(
					[
						"herencia",
						"asociacion",
						"agregacion",
						"composicion",
					] as RelationType[]
				).map((rt) => (
					<button
						key={rt}
						onClick={() => {
							setMode("add-relation");
							setRelType(rt);
							setRelSource(null);
						}}
						className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors border ${
							mode === "add-relation" && relType === rt
								? "text-white border-current"
								: "bg-slate-800 text-slate-400 hover:text-white border-slate-700"
						}`}
						style={
							mode === "add-relation" && relType === rt
								? {
										backgroundColor: REL_COLORS[rt] + "33",
										borderColor: REL_COLORS[rt],
									}
								: {}
						}
					>
						{rt === "herencia" && <GitBranch size={12} />}
						{rt === "asociacion" && <ArrowUpRight size={12} />}
						{rt === "agregacion" && <Diamond size={12} />}
						{rt === "composicion" && <Link2 size={12} />}
						{REL_LABELS[rt]}
					</button>
				))}

				{/* Instrucción cuando está en modo relación */}
				{mode === "add-relation" && (
					<span className="text-xs text-amber-400 ml-2">
						{relSource
							? "→ Ahora hacé click en la clase destino"
							: `Hacé click en la clase origen de la ${REL_LABELS[relType]}`}
					</span>
				)}
			</div>

			{/* Layout principal: Canvas + Código */}
			<div className="flex flex-col lg:flex-row gap-4">
				{/* Canvas */}
				<div className="flex-1 min-h-[500px] lg:min-h-[600px]">
					<div
						ref={canvasRef}
						className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-auto"
						style={{ minHeight: "500px", height: "100%" }}
						onClick={() => {
							if (mode === "select") {
								setSelectedId(null);
							}
						}}
					>
						{/* Spacer invisible para que el scroll cubra todas las clases */}
						<div
							style={{
								width:
									classes.length > 0
										? Math.max(...classes.map((c) => c.x + 200)) + 40
										: 0,
								height:
									classes.length > 0
										? Math.max(...classes.map((c) => c.y + 150)) + 40
										: 0,
								minWidth: "100%",
								minHeight: "100%",
								pointerEvents: "none",
							}}
						/>

						{/* Grid de fondo */}
						<div
							className="absolute top-0 left-0 opacity-10"
							style={{
								width:
									classes.length > 0
										? Math.max(...classes.map((c) => c.x + 200)) + 40
										: "100%",
								height:
									classes.length > 0
										? Math.max(...classes.map((c) => c.y + 150)) + 40
										: "100%",
								minWidth: "100%",
								minHeight: "100%",
								backgroundImage:
									"radial-gradient(circle, #475569 1px, transparent 1px)",
								backgroundSize: "24px 24px",
							}}
						/>

						{/* Líneas de relación */}
						<RelationLines relations={relations} classes={classes} />

						{/* Clases */}
						{classes.map((cls) => (
							<UMLClassBox
								key={cls.id}
								cls={cls}
								isSelected={selectedId === cls.id}
								isRelSource={relSource === cls.id}
								onMouseDown={(e) => handleDragStart(cls, e)}
								onClick={() => handleClassClick(cls)}
								onEdit={() => setEditingId(cls.id)}
							/>
						))}

						{/* Vacío */}
						{classes.length === 0 && (
							<div className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm">
								Hacé click en "+ Clase" para empezar
							</div>
						)}
					</div>

					{/* Lista de relaciones */}
					{relations.length > 0 && (
						<div className="mt-3">
							<h3 className="text-xs text-slate-500 font-medium mb-1">
								Relaciones
							</h3>
							<div className="flex flex-wrap gap-1.5">
								{relations.map((r) => {
									const src =
										classes.find((c) => c.id === r.sourceId)?.name ?? "?";
									const tgt =
										classes.find((c) => c.id === r.targetId)?.name ?? "?";
									return (
										<div
											key={r.id}
											className="flex items-center gap-1 text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1"
										>
											<span style={{ color: REL_COLORS[r.type] }}>
												{REL_LABELS[r.type]}
											</span>
											<span className="text-slate-400">
												{src} → {tgt}
											</span>
											<button
												onClick={() => deleteRelation(r.id)}
												className="text-slate-600 hover:text-red-400 ml-1"
											>
												<X size={10} />
											</button>
										</div>
									);
								})}
							</div>
						</div>
					)}
				</div>

				{/* Panel de código Python */}
				<div className="lg:w-[420px] lg:shrink-0">
					<div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden sticky top-20">
						<div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900">
							<span className="text-xs font-medium text-slate-400">
								Código Python generado
							</span>
							<button
								onClick={copyCode}
								className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors"
							>
								<Copy size={12} />
								{copied ? "¡Copiado!" : "Copiar"}
							</button>
						</div>
						<pre className="p-4 text-xs font-mono text-slate-300 overflow-auto max-h-[70vh] leading-relaxed whitespace-pre">
							{pythonCode}
						</pre>
					</div>
				</div>
			</div>

			{/* Modal flotante de edición */}
			{editingClass && (
				<ClassEditor
					cls={editingClass}
					onUpdate={(updated) =>
						setClasses(classes.map((c) => (c.id === updated.id ? updated : c)))
					}
					onDelete={() => deleteClass(editingClass.id)}
					onClose={() => setEditingId(null)}
				/>
			)}
		</div>
	);
}
