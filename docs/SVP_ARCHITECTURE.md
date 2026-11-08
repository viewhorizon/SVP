# Arquitectura funcional de SVP

## Qué es SVP

SVP significa **Sistema de Votos y Puntos**. La plataforma coordina tres operaciones sobre actividades laborales registradas:

1. **Votar una actividad:** los usuarios registrados votan la actividad que realizan o reconocen.
2. **Recibir puntos:** el sistema acredita puntos ganados según actividad y tiempo validado.
3. **Transferir puntos:** los usuarios registrados pueden enviar puntos a otro usuario mediante el ledger de SVP.

Las aplicaciones conectadas consumen la API de SVP únicamente después de registrar su sistema, sus usuarios y sus referencias de actividad.

## Actividad válida

Una actividad SVP no es una etiqueta genérica ni una categoría de ocio. Debe representar un trabajo que pueda:

- registrarse a nombre de un usuario o local;
- asociarse a un sistema de origen y una referencia externa;
- medirse por tiempo realizado;
- ser validado por el sistema antes de acreditar puntos.

El selector `Dominio` identifica el origen registrado, que puede ser una empresa, un local o un sistema conectado. Sus opciones de demostración (`Inventario`, `E-commerce`, `CRM` o personalizado) representan dominios/sistemas registrados, no regiones. El selector `Seleccionar actividad:` se filtra con la relación registrada entre ese dominio y las actividades que realiza; nunca debe mostrar una actividad sin vínculo con el dominio seleccionado.

## Cálculo de puntos por hora

Para una actividad `x`, el valor por hora de cada local se determina con:

```text
puntos_por_hora(x) =
  (votos_a_x_de_actividad_local + votos_a_x_de_actividad_global)
  / cantidad_total_de_locales_que_realizan_x
```

Los votos expresan reconocimiento colectivo; no sustituyen la evidencia de tiempo. El resultado debe quedar asociado al usuario, al local, a la actividad, al periodo medido y a la fuente de origen.

## Registro y validación temporal

El flujo productivo requiere:

```text
usuario registrado
  -> actividad laboral registrada
  -> inicio/fin o sesiones de actividad
  -> tiempo validado
  -> votos locales + globales
  -> puntos por hora
  -> puntos acreditados
  -> historial y transferencias
```

La simulación actual valida el contrato de evento, el voto y la trazabilidad visual. No debe presentarse como validación de horas hasta que el backend registre sesiones de actividad, reglas de evidencia y su conciliación.

## API y permisos

La API está destinada a usuarios registrados y a aplicaciones registradas que operan en nombre de esos usuarios. Sus funciones principales son:

- actividades y referencias externas;
- votos con límite e idempotencia;
- acreditación y consulta de puntos;
- transferencias entre usuarios;
- historial, auditoría y evidencia operativa.

Cada operación debe conservar usuario, actividad, origen, referencia externa, `requestId`, timestamp y estado. La UI no debe usar datos sintéticos como sustituto silencioso de una respuesta de API.
