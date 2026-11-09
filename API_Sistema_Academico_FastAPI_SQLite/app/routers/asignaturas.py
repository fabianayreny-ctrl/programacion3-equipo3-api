
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import conexion_lectura, transaccion
from app.helpers import filas_a_lista, obtener_o_404
from app.schemas import AsignaturaEntrada, AsignaturaRespuesta, MensajeRespuesta
from app.security import obtener_usuario_actual, exigir_roles


router = APIRouter(prefix="/asignaturas", tags=["Asignaturas"])


CONSULTA_BASE = """
    SELECT a.id, a.codigo, a.nombre, a.unidades_valorativas, a.carrera_id,
           a.requisito_id, a.activo, c.nombre AS carrera_nombre,
           r.codigo AS requisito_codigo
    FROM asignaturas a
    JOIN carreras c ON c.id = a.carrera_id
    LEFT JOIN asignaturas r ON r.id = a.requisito_id
"""


def _filtro_usuario(usuario: dict) -> tuple[str, list]:
    if usuario["rol"] == "ADMIN":
        return "", []

    if usuario["rol"] == "DOCENTE":
        docente_id = usuario.get("docente_id")
        if not docente_id:
            return "AND 1 = 0", []

        return """
            AND EXISTS (
                SELECT 1
                FROM secciones s
                WHERE s.asignatura_id = a.id
                  AND s.docente_id = ?
            )
        """, [docente_id]

    if usuario["rol"] == "ESTUDIANTE":
        estudiante_id = usuario.get("estudiante_id")
        if not estudiante_id:
            return "AND 1 = 0", []

        return """
            AND EXISTS (
                SELECT 1
                FROM secciones s
                JOIN matriculas m ON m.seccion_id = s.id
                WHERE s.asignatura_id = a.id
                  AND m.estudiante_id = ?
                  AND m.estado NOT IN ('CANCELADA')
            )
        """, [estudiante_id]

    raise HTTPException(status_code=403, detail="Rol no autorizado")


def _validar_relaciones(
    conexion,
    carrera_id: int,
    requisito_id: int | None,
    asignatura_id: int | None = None,
) -> None:
    carrera = obtener_o_404(conexion, "carreras", carrera_id, "Carrera")
    if not carrera["activo"]:
        raise HTTPException(409, "La carrera seleccionada está inactiva")

    if requisito_id is None:
        return

    if requisito_id == asignatura_id:
        raise HTTPException(409, "Una asignatura no puede ser requisito de sí misma")

    requisito = obtener_o_404(
        conexion, "asignaturas", requisito_id, "Asignatura requisito"
    )

    if requisito["carrera_id"] != carrera_id:
        raise HTTPException(409, "El requisito debe pertenecer a la misma carrera")

    if asignatura_id is not None:
        ciclo = conexion.execute(
            """
            WITH RECURSIVE cadena(id, requisito_id) AS (
                SELECT id, requisito_id
                FROM asignaturas
                WHERE id = ?

                UNION ALL

                SELECT a.id, a.requisito_id
                FROM asignaturas a
                JOIN cadena c ON a.id = c.requisito_id
                WHERE c.requisito_id IS NOT NULL
            )
            SELECT 1 FROM cadena WHERE id = ? LIMIT 1
            """,
            (requisito_id, asignatura_id),
        ).fetchone()

        if ciclo:
            raise HTTPException(
                409, "El requisito produciría una dependencia circular"
            )


@router.get("", response_model=list[AsignaturaRespuesta])
def listar_asignaturas(
    buscar: str | None = Query(default=None, max_length=100),
    carrera_id: int | None = Query(default=None, gt=0),
    solo_activas: bool = False,
    usuario: dict = Depends(obtener_usuario_actual),
):
    condiciones: list[str] = []
    parametros: list[object] = []

    filtro, parametros_filtro = _filtro_usuario(usuario)
    if filtro:
        condiciones.append(filtro.replace("AND ", "", 1).strip())
        parametros.extend(parametros_filtro)

    if buscar:
        condiciones.append("(a.codigo LIKE ? OR a.nombre LIKE ?)")
        patron = f"%{buscar}%"
        parametros.extend([patron, patron])

    if carrera_id:
        condiciones.append("a.carrera_id = ?")
        parametros.append(carrera_id)

    if solo_activas:
        condiciones.append("a.activo = 1")

    where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""

    with conexion_lectura() as conexion:
        filas = conexion.execute(
            f"{CONSULTA_BASE} {where} ORDER BY a.codigo",
            parametros,
        ).fetchall()

    return filas_a_lista(filas)


@router.get("/{asignatura_id}", response_model=AsignaturaRespuesta)
def obtener_asignatura(
    asignatura_id: int,
    usuario: dict = Depends(obtener_usuario_actual),
):
    filtro, parametros = _filtro_usuario(usuario)

    with conexion_lectura() as conexion:
        fila = conexion.execute(
            f"{CONSULTA_BASE} WHERE a.id = ? {filtro}",
            [asignatura_id, *parametros],
        ).fetchone()

    if fila is None:
        raise HTTPException(404, "Asignatura no encontrada")

    return dict(fila)


@router.post(
    "",
    response_model=AsignaturaRespuesta,
    status_code=status.HTTP_201_CREATED,
)
def crear_asignatura(
    datos: AsignaturaEntrada,
    usuario: dict = Depends(exigir_roles("ADMIN")),
):
    try:
        with transaccion() as conexion:
            _validar_relaciones(conexion, datos.carrera_id, datos.requisito_id)

            cursor = conexion.execute(
                """
                INSERT INTO asignaturas
                    (codigo, nombre, unidades_valorativas, carrera_id,
                     requisito_id, activo)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    datos.codigo.upper(),
                    datos.nombre,
                    datos.unidades_valorativas,
                    datos.carrera_id,
                    datos.requisito_id,
                    datos.activo,
                ),
            )

            fila = conexion.execute(
                f"{CONSULTA_BASE} WHERE a.id = ?",
                (cursor.lastrowid,),
            ).fetchone()

            return dict(fila)

    except sqlite3.IntegrityError as error:
        raise HTTPException(
            409, "El código de la asignatura ya existe"
        ) from error


@router.put("/{asignatura_id}", response_model=AsignaturaRespuesta)
def actualizar_asignatura(
    asignatura_id: int,
    datos: AsignaturaEntrada,
    usuario: dict = Depends(exigir_roles("ADMIN")),
):
    try:
        with transaccion() as conexion:
            obtener_o_404(conexion, "asignaturas", asignatura_id, "Asignatura")

            _validar_relaciones(
                conexion,
                datos.carrera_id,
                datos.requisito_id,
                asignatura_id,
            )

            conexion.execute(
                """
                UPDATE asignaturas
                SET codigo = ?, nombre = ?, unidades_valorativas = ?,
                    carrera_id = ?, requisito_id = ?, activo = ?
                WHERE id = ?
                """,
                (
                    datos.codigo.upper(),
                    datos.nombre,
                    datos.unidades_valorativas,
                    datos.carrera_id,
                    datos.requisito_id,
                    datos.activo,
                    asignatura_id,
                ),
            )

            fila = conexion.execute(
                f"{CONSULTA_BASE} WHERE a.id = ?",
                (asignatura_id,),
            ).fetchone()

            return dict(fila)

    except sqlite3.IntegrityError as error:
        raise HTTPException(
            409, "El código pertenece a otra asignatura"
        ) from error


@router.delete("/{asignatura_id}", response_model=MensajeRespuesta)
def eliminar_asignatura(
    asignatura_id: int,
    usuario: dict = Depends(exigir_roles("ADMIN")),
):
    try:
        with transaccion() as conexion:
            obtener_o_404(conexion, "asignaturas", asignatura_id, "Asignatura")
            conexion.execute(
                "DELETE FROM asignaturas WHERE id = ?",
                (asignatura_id,),
            )

        return {"mensaje": "Asignatura eliminada correctamente"}

    except sqlite3.IntegrityError as error:
        raise HTTPException(
            409, "No se puede eliminar: la asignatura tiene secciones"
        ) from error


