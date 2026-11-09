# Actualizaciones del Sistema Académico

## Cambios incluidos
- Rediseño visual con acentos verdes, superficies claras y tablas más legibles.
- Vista de historial académico del estudiante autenticado: asignatura, sección, período, docente, nota final, resultado y estado de cursado.
- El historial solo consulta las matrículas vinculadas al estudiante autenticado.
- Módulos de consulta para Matrículas, Secciones, Períodos, Carreras y Aulas, aprovechando las rutas existentes de la API.
- Calificaciones organizadas en una tabla; los botones de registro/edición existentes se conservan.
- Se habilitó eliminar una calificación para ADMIN y DOCENTE, con validación en el servidor para que el docente solo elimine notas de sus secciones.
- La respuesta de inicio de sesión incluye los identificadores asociados de docente/estudiante cuando corresponden.

## Importante
Los módulos de Matrículas, Secciones, Períodos, Carreras y Aulas que se añadieron a la navegación son por ahora vistas de consulta conectadas a la API; no se añadieron todavía formularios de alta/edición/eliminación para todos ellos. El alta de matrículas sigue disponible en la API existente. Antes de usarlo con datos reales, pruebe el sistema con una copia de su base de datos.

## Verificación realizada
- `python -m compileall -q app`
- `node --check frontend/app.js`
