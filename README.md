# 🎓 MenSso - Suite Educativa Universitaria

[![Deploy on Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel) ](https://mensso.vercel.app/)
[![React](https://img.shields.io/badge/React-18.x-blue?logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-purple?logo=vite)](https://vitejs.dev/)

**MenSso** es una plataforma web interactiva diseñada por y para estudiantes universitarios. Su objetivo es centralizar herramientas de simulación, cálculo y redacción para facilitar el aprendizaje práctico en materias clave de Ciencias de la Computación y la gestión de trámites administrativos.

🌐 **Demo en vivo:** [mensso.vercel.app](https://mensso.vercel.app/)

---

## 🚀 Herramientas Destacadas

### 🤖 DocuGen AI
<img src="Media\DocuGen.gif" alt="Demo de DocuGen AI" />

Un asistente virtual impulsado por Inteligencia Artificial (LLM) que actúa como secretario académico. Guía al estudiante paso a paso para recopilar sus datos y genera automáticamente notas institucionales formales (prórrogas, mesas especiales) listas para imprimir o enviar.

### ⚙️ Planificador de CPU
<img src="Media\PlanificadorCPU.gif" alt="Demo de Planificador de CPU" />
Simulador interactivo de algoritmos de planificación de sistemas operativos (SJF, Round Robin, FIFO, etc.). Permite ingresar ráfagas de procesos en tiempo real y genera dinámicamente el **Diagrama de Gantt** correspondiente, ideal para comprobar ejercicios de la cátedra.

### 📊 Simulador de Arreglos
<img src="Media\SimuladorArreglo.gif" alt="Demo de Simulador de Arreglos" />
Herramienta visual para el aprendizaje de estructuras de datos. Permite ejecutar y visualizar paso a paso cómo funcionan los algoritmos clásicos de búsqueda y ordenamiento sobre un arreglo de memoria, facilitando la comprensión lógica detrás del código.

*(La suite incluye además herramientas de subneteo IPv4, conversor de bases, compilador de pseudocódigo con mapa de memoria y diagramado UML a Python).*

---

## 🛠️ Stack Tecnológico

* **Frontend:** React + TypeScript
* **Build Tool:** Vite
* **Estilos:** Tailwind CSS
* **Inteligencia Artificial:** SDK Oficial de Google AI (Gemini / Gemma)
* **Despliegue:** Vercel

---

## 💻 Instalación Local

Si querés clonar el proyecto y correrlo en tu máquina:

1. Cloná el repositorio:
   ```bash
   git clone [https://github.com/TuUsuario/mensso.git](https://github.com/TuUsuario/mensso.git)
   ```
2. Instalá las dependencias:
   ```bash
   npm install
   ```
3. Configurá las variables de entorno:
Crea un archivo `.env` en la raíz y agregá tu API Key de Google AI Studio:
`VITE_GEMINI_API_KEY=tu_clave_aqui`
4. Iniciá el servidor de desarrollo:
   ```bash
   npm run dev
   ```
---
Desarrollado con ❤️ por Victoria Mengual y Joaquin Sasso.

---