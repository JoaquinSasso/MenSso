import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
    ChevronLeft, Play, SkipForward, Square, Terminal, Database, Code, Keyboard
} from 'lucide-react';

export type TipoDato = 'entero' | 'real' | 'cadena' | 'caracter' | 'logico' | 'arreglo' | 'registro';

export interface VariableMemoria {
    nombre: string;
    tipo: TipoDato;
    valor: any; 
    direccion: string;
    tamano?: number; 
}

export interface EstadoEjecucion {
    lineaActual: number | null;
    memoria: VariableMemoria[];
    consola: string[];
    terminado: boolean;
    error?: string;
}

function* ejecutarPasoAPaso(codigo: string): Generator<EstadoEjecucion> {
    const lineas = codigo.split('\n');
    const memoria: VariableMemoria[] = [];
    const consola: string[] = [];
    
    // 1. Pre-procesamiento de bloques (Mapas de saltos)
    const saltos: Record<number, number> = {};
    const pilaBloques: { tipo: string, linea: number }[] = [];

    for (let i = 0; i < lineas.length; i++) {
        const ln = lineas[i].trim().toLowerCase();
        if (ln.startsWith('si ')) {
            pilaBloques.push({ tipo: 'si', linea: i });
        } else if (ln === 'sino') {
            const block = pilaBloques[pilaBloques.length - 1];
            if (block && block.tipo === 'si') {
                saltos[block.linea] = i; 
                block.tipo = 'sino';
                block.linea = i;
            }
        } else if (ln === 'finsi') {
            const block = pilaBloques.pop();
            if (block) saltos[block.linea] = i; 
        } else if (ln.startsWith('para ')) {
            pilaBloques.push({ tipo: 'para', linea: i });
        } else if (ln === 'finpara') {
            const block = pilaBloques.pop();
            if (block) {
                saltos[block.linea] = i; 
                saltos[i] = block.linea; 
            }
        }
    }

    // Función auxiliar corregida con \b (Word Boundaries)
    const evaluar = (expresion: string, lineaActual: number) => {
        let jsExpr = expresion
            .replace(/\bY\b/ig, '&&')
            .replace(/\bO\b/ig, '||')
            .replace(/\bNO\b/ig, '!')
            .replace(/=/g, '===') 
            .replace(/>===/g, '>=')
            .replace(/<===/g, '<=')
            .replace(/!===/g, '!=');

        const varsLocal: Record<string, any> = {};
        memoria.forEach(v => varsLocal[v.nombre] = v.valor);

        try {
            const nombres = Object.keys(varsLocal);
            const valores = Object.values(varsLocal);
            
            jsExpr = jsExpr.replace(/([a-zA-Z_]\w*)\[(.+?)\]/g, (match, arrName, indexExpr) => {
                return `${arrName}[(${indexExpr}) - 1]`;
            });
            
            const func = new Function(...nombres, `return ${jsExpr};`);
            return func(...valores);
        } catch (e) {
            throw new Error(`Error en línea ${lineaActual + 1}: No se pudo evaluar '${expresion}'. Revise la sintaxis.`);
        }
    };

    // 2. Bucle de Ejecución (Instruction Pointer)
    let ip = 0;
    let enEjecucion = false;

    while (ip < lineas.length) {
        const lineaRaw = lineas[ip].trim();
        const linea = lineaRaw.toLowerCase();

        if (!lineaRaw || lineaRaw.startsWith('/*') || lineaRaw.startsWith('//')) {
            ip++; continue;
        }

        if (linea === 'comienzo') { enEjecucion = true; ip++; continue; }
        if (linea === 'fin') { break; }
        if (!enEjecucion) { ip++; continue; }

        yield { lineaActual: ip, memoria: [...memoria.map(v => ({...v, valor: Array.isArray(v.valor) ? [...v.valor] : v.valor}))], consola: [...consola], terminado: false };

        try {
            const matchArreglo = lineaRaw.match(/^(entero|real|cadena|caracter|booleano|logico)\s+([a-zA-Z_]\w*)\[(\d+)\]/i);
            if (matchArreglo) {
                const nombre = matchArreglo[2];
                const tamano = parseInt(matchArreglo[3]);
                memoria.push({
                    nombre, tipo: 'arreglo', tamano,
                    valor: new Array(tamano).fill(matchArreglo[1].toLowerCase() === 'cadena' ? '""' : 0),
                    direccion: `0x${Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`
                });
                ip++; continue;
            }

            const matchVar = lineaRaw.match(/^(entero|real|cadena|caracter|booleano|logico)\s+([a-zA-Z_]\w*)$/i);
            if (matchVar) {
                const nombre = matchVar[2];
                const tipo = matchVar[1].toLowerCase() as TipoDato;
                memoria.push({
                    nombre, tipo,
                    valor: tipo === 'cadena' ? '""' : 0,
                    direccion: `0x${Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`
                });
                ip++; continue;
            }

            const matchAsignacionArr = lineaRaw.match(/^([a-zA-Z_]\w*)\[(.+?)\]\s*=\s*(.+)$/);
            if (matchAsignacionArr) {
                const nombre = matchAsignacionArr[1];
                const idxExpr = matchAsignacionArr[2];
                const expr = matchAsignacionArr[3];
                const variable = memoria.find(v => v.nombre === nombre);
                if (variable && variable.tipo === 'arreglo') {
                    const idxReal = evaluar(idxExpr, ip) - 1; 
                    variable.valor[idxReal] = evaluar(expr, ip);
                } else { throw new Error(`El arreglo '${nombre}' no existe.`); }
                ip++; continue;
            }

            const matchAsig = lineaRaw.match(/^([a-zA-Z_]\w*(?:\.\w+)?)\s*=\s*(.+)$/);
            if (matchAsig) {
                const destino = matchAsig[1];
                const expr = matchAsig[2];
                
                if (destino.includes('.')) {
                    const [regName, propName] = destino.split('.');
                    let variable = memoria.find(v => v.nombre === regName);
                    if (!variable) {
                        variable = { nombre: regName, tipo: 'registro', valor: {}, direccion: `0x${Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase()}` };
                        memoria.push(variable);
                    }
                    variable.valor[propName] = evaluar(expr, ip);
                } else {
                    const variable = memoria.find(v => v.nombre === destino);
                    if (variable) variable.valor = evaluar(expr, ip);
                    else throw new Error(`Variable no declarada '${destino}'`);
                }
                ip++; continue;
            }

            const matchSi = lineaRaw.match(/^Si\s*\((.+)\)\s*Entonces/i);
            if (matchSi) {
                const condicion = evaluar(matchSi[1], ip);
                if (!condicion) ip = saltos[ip]; 
                else ip++;
                continue;
            }

            const matchPara = lineaRaw.match(/^Para\s+([a-zA-Z_]\w*)\s+desde\s+(.+)\s+hasta\s+(.+)/i);
            if (matchPara) {
                const varControl = matchPara[1];
                let variable = memoria.find(v => v.nombre === varControl);
                if (!variable) throw new Error(`Variable de control '${varControl}' no declarada.`);
                
                const inicio = evaluar(matchPara[2], ip);
                const fin = evaluar(matchPara[3], ip);
                
                // Si es la primera ejecución del bucle
                if (variable.valor === 0 && inicio !== 0) variable.valor = inicio;

                if (variable.valor <= fin) {
                    ip++; 
                } else {
                    ip = saltos[ip] + 1; 
                    variable.valor = 0; 
                }
                continue;
            }

            if (linea === 'finpara') {
                const varControl = lineas[saltos[ip]].match(/^Para\s+([a-zA-Z_]\w*)/i)?.[1];
                if (varControl) {
                    const v = memoria.find(varMem => varMem.nombre === varControl);
                    if (v) v.valor += 1;
                }
                ip = saltos[ip]; 
                continue;
            }

            if (lineaRaw.toLowerCase().startsWith('escribir ')) {
                const argStr = lineaRaw.substring(9).trim();
                let salida = '';
                
                const argumentos = argStr.split(',').map(arg => arg.trim());
                for (const arg of argumentos) {
                    if (arg.startsWith('"') && arg.endsWith('"')) {
                        salida += arg.slice(1, -1) + ' ';
                    } else {
                        salida += evaluar(arg, ip) + ' ';
                    }
                }
                consola.push(salida.trim());
                ip++; continue;
            }

            if (linea === 'sino' || linea === 'finsi') {
                if (linea === 'sino') ip = saltos[ip]; else ip++;
                continue;
            }

            ip++; 

        } catch (err: any) {
            yield { lineaActual: ip, memoria, consola, terminado: true, error: err.message };
            return;
        }
    }

    yield { lineaActual: null, memoria, consola, terminado: true };
}

export default function InterpretePseudocodigo() {
    const [codigo, setCodigo] = useState<string>(
`Algoritmo AnalisisEstudiantil
Comienzo
  /* 1. Declaracion de variables y arreglos */
  entero notas[5]
  entero i
  real suma
  real promedio
  entero mejor_nota
  entero mejor_posicion

  /* 2. Inicializacion */
  suma = 0
  mejor_nota = -1
  mejor_posicion = 0

  notas[1] = 7
  notas[2] = 5
  notas[3] = 10
  notas[4] = 8
  notas[5] = 6

  Escribir "Procesando el rendimiento del alumno..."

  /* 3. Bucle Para y Condicional Si */
  Para i desde 1 hasta 5
    suma = suma + notas[i]

    Si (notas[i] > mejor_nota) Entonces
      mejor_nota = notas[i]
      mejor_posicion = i
    FinSi
  FinPara

  promedio = suma / 5

  /* 4. Uso de un Registro estructurado */
  destacado.valor = mejor_nota
  destacado.indice = mejor_posicion
  destacado.supero_promedio = 1

  /* 5. Salida de resultados */
  Escribir "El promedio general es", promedio
  Escribir "La mejor nota fue un", destacado.valor
  Escribir "Se encontro en la celda", destacado.indice
Fin`
    );

    const [estado, setEstado] = useState<EstadoEjecucion>({
        lineaActual: null, memoria: [], consola: [], terminado: false
    });

    const generadorRef = useRef<Generator<EstadoEjecucion> | null>(null);

    const iniciarDepuracion = useCallback(() => {
        generadorRef.current = ejecutarPasoAPaso(codigo);
        avanzarPaso();
    }, [codigo]);

    const avanzarPaso = useCallback(() => {
        if (generadorRef.current) {
            const { value, done } = generadorRef.current.next();
            if (value) setEstado(value);
            if (done || value?.terminado) generadorRef.current = null;
        }
    }, []);

    const detener = useCallback(() => {
        generadorRef.current = null;
        setEstado({ lineaActual: null, memoria: [], consola: [], terminado: false });
    }, []);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (!generadorRef.current) return;
            if (e.key === "F10" || (e.ctrlKey && e.key === "ArrowRight")) {
                e.preventDefault(); avanzarPaso();
            } else if (e.key === "Escape") {
                e.preventDefault(); detener();
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [avanzarPaso, detener]);

    const enEjecucion = generadorRef.current !== null;

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 min-h-[85vh] flex flex-col">
            
            <div className="space-y-2 mb-2">
                <Link to="/" className="inline-flex items-center gap-1 text-slate-400 hover:text-sky-400 transition-colors text-sm">
                    <ChevronLeft size={16} /> Volver al Hub
                </Link>
                <h1 className="text-3xl font-bold">Intérprete de Pseudocódigo</h1>
                <p className="text-slate-400">
                    Soporta estructuras <code>Si</code>, <code>Para</code>, y <code>Arreglos</code>. Observa la memoria cambiar en vivo.
                </p>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                <div className="lg:col-span-6 flex flex-col bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80 gap-3">
                        <div className="flex items-center gap-2 text-slate-300 font-medium">
                            <Code size={18} className="text-sky-400" /> <span>Editor</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {!enEjecucion ? (
                                <button onClick={iniciarDepuracion} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-medium py-1.5 px-4 rounded-lg transition-colors text-sm">
                                    <Play size={16} /> Iniciar
                                </button>
                            ) : (
                                <>
                                    <button onClick={avanzarPaso} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 font-medium py-1.5 px-4 rounded-lg transition-colors text-sm">
                                        <SkipForward size={16} /> Paso a paso
                                    </button>
                                    <button onClick={detener} className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-rose-900/50 hover:text-rose-400 text-slate-300 font-medium py-1.5 px-3 rounded-lg transition-colors text-sm" title="Detener">
                                        <Square size={16} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex-1 relative min-h-[500px]">
                        <div className="absolute inset-0 pointer-events-none p-4 font-mono text-base leading-relaxed" aria-hidden="true">
                             {codigo.split('\n').map((_, index) => (
                                <div key={index} className={`h-[1.5em] w-full rounded-sm transition-colors duration-200 ${estado.lineaActual === index ? 'bg-sky-500/10 border-l-4 border-sky-400' : 'border-l-4 border-transparent'}`} />
                             ))}
                        </div>
                        <textarea
                            value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={enEjecucion} spellCheck="false"
                            className="absolute inset-0 w-full h-full p-4 font-mono text-base leading-relaxed bg-transparent text-slate-300 resize-none focus:outline-none disabled:opacity-80 whitespace-pre"
                            style={{ tabSize: 4 }}
                        />
                    </div>
                </div>

                <div className="lg:col-span-6 flex flex-col gap-6">
                    <div className="flex-1 flex flex-col bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl min-h-[350px]">
                        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex items-center gap-2 text-slate-300 font-medium">
                            <Database size={18} className="text-emerald-400" /> <span>Mapa de Memoria</span>
                        </div>
                        <div className="p-4 flex-1 overflow-auto">
                            {estado.memoria.length === 0 ? (
                                <div className="flex h-full items-center justify-center text-slate-500 text-sm text-center px-8 border-2 border-dashed border-slate-800 rounded-xl">
                                    Inicia la ejecución para ver variables, arreglos y registros en memoria.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {estado.memoria.map((variable, idx) => (
                                        <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-inner">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sky-400">{variable.nombre}</span>
                                                    <span className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">{variable.tipo}</span>
                                                </div>
                                                <span className="text-[10px] font-mono text-slate-600">{variable.direccion}</span>
                                            </div>
                                            
                                            {variable.tipo === 'arreglo' ? (
                                                <div className="flex gap-1 overflow-x-auto pb-1">
                                                    {Array.isArray(variable.valor) && variable.valor.map((val, i) => (
                                                        <div key={i} className="flex flex-col items-center min-w-[3rem]">
                                                            <span className="text-[10px] text-slate-500 mb-1">[{i + 1}]</span>
                                                            <div className="w-full flex items-center justify-center h-10 px-2 bg-slate-900 border border-slate-700 rounded-md text-slate-200 font-mono text-sm shadow-sm transition-all duration-300">
                                                                {val !== undefined && val !== null ? val : '-'}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : variable.tipo === 'registro' ? (
                                                <div className="grid grid-cols-2 gap-2 mt-2 bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
                                                    {Object.entries(variable.valor).map(([key, val]: any, i) => (
                                                        <div key={i} className="flex items-center justify-between text-sm font-mono">
                                                            <span className="text-slate-400">.{key}</span>
                                                            <span className="text-emerald-400 font-bold">{val}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end h-10 px-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-lg shadow-sm">
                                                    {variable.valor}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="h-48 flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                        <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2 text-slate-400 text-xs font-mono uppercase tracking-wider bg-slate-900/50">
                            <Terminal size={14} /> <span>Salida Estándar</span>
                        </div>
                        <div className="p-4 flex-1 overflow-auto font-mono text-sm text-slate-300 space-y-1">
                            {estado.error && (
                                <div className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg"><span className="font-bold">Error:</span> {estado.error}</div>
                            )}
                            {estado.consola.map((msg, idx) => (
                                <div key={idx} className="flex gap-2"><span className="text-slate-600">{'>'}</span> <span className="text-emerald-400">{msg}</span></div>
                            ))}
                        </div>
                    </div>
                    
                </div>
            </div>
        </div>
    );
}