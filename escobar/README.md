# Proyecto Escobar 🇭🇳

**Escobar** es una PWA interactiva que funciona como tu compañera de inteligencia artificial hondureña y tutora personal de español. Diseñada con un enfoque de voz primero, Escobar combina conversaciones fluidas de voz, aprendizaje de español a través del caliche (slang) hondureño, boveda de memoria a largo plazo y generación de avatar personalizada.

---

## 🚀 Arquitectura y Tecnologías
* **Frontend**: React (Vite) + Tailwind CSS + Lucide Icons.
* **Backend Proxies**: Vercel Serverless Functions (Node.js).
* **Base de Datos y Auth**: Supabase (PostgreSQL + Auth + Storage).
* **Procesamiento de Voz**: 
  * Picovoice Porcupine (Detección de Wake Word *'Escobar'* local en el navegador).
  * OpenAI Whisper (Speech-To-Text).
  * ElevenLabs Streaming API (Text-To-Speech con caché en Supabase Storage).
* **IA y Memoria**: 
  * Anthropic Claude Sonnet 3.7 (Lógica del personaje, Spanglish adaptivo e identificación de errores).
  * Supabase `pgvector` (Memoria semántica y episódica).
  * Deno Edge Functions (Cálculo asíncrono de embeddings).
* **Generación de Imagen**: Replicate API (Fine-tuning de LoRA mediante Flux).

---

## 🛠️ Configuración e Instalación

### 1. Variables de Entorno
Crea un archivo `.env.local` en la raíz del proyecto basándote en la siguiente plantilla:

```env
# Supabase (Obligatorio)
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Inteligencia Artificial (Obligatorio)
ANTHROPIC_API_KEY=tu-anthropic-api-key
OPENAI_API_KEY=tu-openai-api-key

# Integración de Voz (Opcional - Requerido para Habla Conmigo)
ELEVENLABS_API_KEY=tu-elevenlabs-api-key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM # Voz femenina recomendada
PICOVOICE_ACCESS_KEY=tu-picovoice-access-key

# Generación de Avatar (Opcional)
REPLICATE_API_TOKEN=tu-replicate-token
```

### 2. Base de Datos (Supabase)
Ejecuta las migraciones ubicadas en la carpeta `supabase/migrations/` en el editor SQL de Supabase, en orden:
1. `000_extensions.sql` (Habilita pgvector y UUIDs)
2. `001_profiles.sql` (Estructura de perfiles de usuario)
3. `002_conversations.sql` (Gestión de conversaciones y lógica de borrado suave)
4. `003_messages.sql` (Mensajes e historial)
5. `004_memories.sql` (Configuración de vector DB pgvector para memorias)
6. `005_spanish_errors.sql` (Log de errores y helper RPC de upsert)
7. `006_avatar_assets.sql` (Assets generados para gestos)

### 3. Buckets de Supabase Storage
Crea los siguientes buckets en Supabase Storage y desactiva las restricciones públicas (o define políticas RLS apropiadas):
* `avatar-images` (Privado, para fotos del usuario y avatares finales)
* `audio-cache` (Público/Privado, para caché de audio ElevenLabs)

---

## 🏃 Cómo Ejecutar el Proyecto

### Método Recomendado: Vercel CLI (Servidor Completo)
Dado que las APIs que interactúan de forma segura con ElevenLabs, Claude, Whisper y Replicate están configuradas como **Serverless Functions** bajo la carpeta `/api`, ejecutar la app solo con `npm run dev` no levantará el backend y las llamadas de chat/voz fallarán.

Para correr el frontend y el backend integrados localmente:

1. Instala el CLI de Vercel de manera global si no lo tienes:
   ```bash
   npm install -g vercel
   ```
2. Instala las dependencias del proyecto:
   ```bash
   npm install
   ```
3. Ejecuta el servidor local de desarrollo de Vercel:
   ```bash
   vercel dev
   ```
   *Esto iniciará la aplicación (usualmente en `http://localhost:3000`), proxyando automáticamente las peticiones de `/api/*` a las funciones locales y sirviendo el frontend mediante Vite.*

### Método Alternativo: Solo Frontend
Si solo deseas inspeccionar la interfaz visual y estilos sin interactuar con los servicios de IA:
```bash
npm install
npm run dev
```

---

## 📦 Construcción y Despliegue

Para compilar el bundle de producción optimizado:
```bash
npm run build
```

Para desplegar a producción en Vercel de forma instantánea:
```bash
vercel --prod
```

> [!WARNING]
> **Compatibilidad de Navegadores**: La detección de Wake Word local requiere las cabeceras `SharedArrayBuffer` (`Cross-Origin-Embedder-Policy` y `Cross-Origin-Opener-Policy`). Vercel las inyecta automáticamente usando la configuración de `vercel.json` provista en la raíz. Si despliegas en otro hosting, asegúrate de configurar estas cabeceras CORS en tu servidor de producción.
