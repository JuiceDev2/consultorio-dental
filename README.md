# Consultorio Dental — App Web

Stack: **Next.js 14 (TypeScript) + Supabase + Tailwind**, pensado para vivir cómodamente en las
capas gratuitas de **Vercel** y **Supabase** el mayor tiempo posible (sin cron jobs, sin
servicios extra, todo el anti-spam y la lógica sensible vive en Postgres mediante una función RPC).

## 1. Crear el proyecto en Supabase

1. Ve a https://supabase.com → *New project* (plan Free).
2. Entra a **SQL Editor** → pega el contenido completo de `supabase/schema.sql` → *Run*.
   Esto crea las tablas, las políticas de seguridad (RLS), la función anti-spam
   `create_public_appointment` y 5 servicios de ejemplo.
3. Ve a **Authentication → Providers** y deja solo **Email** habilitado (desactiva "Confirm email"
   si quieres que los dentistas puedan entrar de inmediato con la contraseña temporal).
4. Crea tu primer usuario **administrador**:
   - Authentication → Users → *Add user* → captura correo y contraseña.
   - Copia el UUID del usuario creado.
   - En SQL Editor ejecuta:
     ```sql
     insert into profiles (id, full_name, email, role)
     values ('PEGA-AQUI-EL-UUID', 'Tu Nombre', 'tu-correo@ejemplo.com', 'admin');
     ```
5. En **Project Settings → API** copia:
   - `Project URL`
   - `anon public key`
   - `service_role key` (¡secreta! nunca la subas al frontend)

## 2. Configurar variables de entorno

Copia `.env.example` a `.env.local` y llena los tres valores del paso anterior.

## 3. Correr en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000

## 4. Desplegar en Vercel (capa gratuita)

1. Sube este proyecto a un repositorio de GitHub.
2. En https://vercel.com → *New Project* → importa el repositorio.
3. En **Environment Variables** agrega las 3 variables de `.env.local`.
4. Deploy. Cada push a `main` vuelve a desplegar automáticamente.

No necesitas cron jobs, colas ni servicios extra: toda la validación anti-spam corre dentro
de Postgres (Supabase), y Vercel solo sirve las páginas y llama a Supabase.

## Roles y flujo

- **Cliente** (sin cuenta): entra a `/agendar`, llena nombre, teléfono, servicio(s), fecha, hora
  y un comentario opcional (máx. 300 caracteres). La cita se confirma al instante.
  - Antispam incorporado en la función `create_public_appointment`:
    - Máx. 5 intentos de reserva por teléfono cada 24h.
    - Máx. 8 intentos por IP cada hora.
    - Máx. 3 citas activas simultáneas por teléfono.
  - Los datos siempre viajan como parámetros (nunca se concatenan a SQL), por lo que no hay
    riesgo de inyección SQL; el límite de caracteres es una capa extra de higiene.

- **Administrador** (`/admin`): métricas de ventas y citas, alta/edición de precios y
  activar/desactivar servicios (nunca se borran), alta de dentistas, activar/desactivar
  dentistas, resetear su contraseña al instante, y ver el desempeño de cada uno.

- **Dentista** (`/dentist`): ve las citas confirmadas, puede cobrar cualquiera sin importar el
  horario en que se agendó, tiene un punto de venta con selección múltiple de servicios y
  calculadora de cambio, y puede generar tickets. Cada ticket tiene una página pública
  (`/ticket/[id]`) que el dentista comparte por el medio que prefiera.

## Notas de diseño

- Desactivar un servicio (o un dentista) nunca borra registros: solo cambia una bandera
  `active`, así nunca se rompen referencias existentes en citas o tickets ya generados.
- Si solo hay un dentista activo, las citas en línea se le asignan automáticamente.
- **Disponibilidad de horario**: `create_public_appointment` calcula una capacidad por
  slot (fecha + hora) igual al número de dentistas activos (mínimo 1) y rechaza la
  reserva si ese horario ya está lleno. Usa un lock (`pg_advisory_xact_lock`) para que
  dos reservas simultáneas del mismo horario no se cuelen ambas. Además, el formulario
  público (`/agendar`) consulta `get_booked_times(fecha)` al elegir la fecha y muestra
  qué horarios ya están llenos ese día *antes* de que el cliente intente agendar (esta
  función solo expone hora + bandera de lleno, nunca nombres ni teléfonos).
- **Tickets**: la tabla `tickets` NO es de lectura pública. El link compartible
  `/ticket/[id]` usa la función `get_ticket_by_id(uuid)` (security definer), que
  devuelve como máximo una fila puntual y nunca permite listar la tabla completa.
  El resto del acceso a `tickets` está limitado por RLS a admin, o al dentista dueño
  del ticket.

## Si ya tienes esto desplegado en producción

Corre `supabase/migrations/0002_security_and_slots.sql` completo en el SQL Editor de
Supabase (es seguro, no borra datos) y despliega el código actualizado. Corrige dos
problemas del schema original:
1. La política de `tickets` permitía leer **toda la tabla** a cualquiera (incluido el
   rol `anon`), no solo el ticket individual que el link pretendía mostrar.
2. La reserva pública no validaba si el horario ya estaba ocupado, permitiendo
   citas duplicadas en el mismo slot.

Después corre también `supabase/migrations/0003_booked_times.sql`, que agrega la
función usada por el formulario público para mostrar horarios llenos antes de agendar.
