# Actualización de módulos y reglas académicas

## Reglas de acceso incorporadas

- **Administrador**: administra carreras, aulas, períodos, secciones y matrículas. Los endpoints de escritura de estos catálogos exigen rol ADMIN.
- **Docente**: el listado de secciones se limita a las secciones asignadas al docente autenticado; el listado de matrículas se limita a los estudiantes matriculados en sus secciones; el listado de aulas solo devuelve aulas usadas por sus secciones.
- **Estudiante**: el listado de matrículas solo devuelve sus propias matrículas. El historial personal existente continúa disponible.
- **Calificaciones**: se conserva el flujo existente de la tabla con primer, segundo y tercer parcial. Las rutas existentes validan sesión y rol.

## Catálogos editables

Carreras, aulas y períodos muestran controles de agregar, editar, eliminar y actualizar para el administrador. La API ya valida duplicados y relaciones de integridad; si un registro tiene dependencias, SQLite/API puede rechazar su eliminación para no dejar información académica inconsistente.

## Flujo lógico recomendado

1. Crear carrera.
2. Crear asignaturas asociadas a esa carrera.
3. Crear períodos académicos.
4. Crear aulas con capacidad suficiente.
5. Crear secciones que relacionen asignatura, docente, período y aula.
6. Matricular al estudiante en una sección disponible.
7. El docente registra/edita las tres notas parciales de las matrículas de sus secciones.
8. El estudiante consulta su historial, estado de cursado y resultado.

## Importante

- La base de datos incluida se conserva para que el proyecto de ejemplo tenga datos con los que probar. Antes de sustituir una carpeta de trabajo, haga una copia de su propia `sistema_academico.db`.
- Los tests antiguos asumían que algunas rutas podían llamarse sin autenticación; deben actualizarse para iniciar sesión y pasar el token, ya que ahora se comprueban permisos.
- El formulario rápido de catálogos usa cuadros de diálogo del navegador. Es funcional como primera versión; se puede reemplazar luego por formularios visuales integrados con el mismo backend.
