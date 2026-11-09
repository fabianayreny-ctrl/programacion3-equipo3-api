
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import conexion_lectura, transaccion
from app.helpers import filas_a_lista, obtener_o_404
from app.schemas import (
    CalificacionEntrada,
    CalificacionRespuesta,
    MensajeRespuesta,
)
from app.security import obtener_usuario_actual, exigir_roles


router = APIRouter(prefix="/calificaciones", tags=["Calificaciones"])


def _respuesta_calificacion(fila) -> dict:
    datos = dict(fila)
    datos["resultado"] = (
        "APROBADA" if datos["nota_final"] >= 65 else "REPROBADA"
    )
    return datos


def _puede_acceder_matricula(conexion, matricula_id: int, usuario: dict) -> bool:
    if usuario["rol"] == "ADMIN":
        return True

    if usuario["rol"] == "DOCENTE":
        docente_id = usuario.get("docente_id")
        if not docente_id:
            return False

        fila = conexion.execute(
            """
            SELECT 1
            FROM matriculas m
            JOIN secciones s ON s.id = m.seccion_id
            WHERE m.id = ? AND s.docente_id = ?
            """,
            (matricula_id, docente_id),
        ).fetchone()

        return fila is not None

    if usuario["rol"] == "ESTUDIANTE":
        estudiante_id = usuario.get("estudiante_id")
        if not estudiante_id:
            return False

        fila = conexion.execute(
            """
            SELECT 1
            FROM matriculas
            WHERE id = ? AND estudiante_id = ?
            """,
            (matricula_id, estudiante_id),
        ).fetchone()

        return fila is not None

    return False


@router.get("", response_model=list[CalificacionRespuesta])
def listar_calificaciones(
    seccion_id: int | None = Query(default=None, gt=0),
    usuario: dict = Depends(obtener_usuario_actual),
):
    condiciones = []
    parametros: list[object] = []

    if usuario["rol"] == "DOCENTE":
        docente_id = usuario.get("docente_id")
        if not docente_id:
            return []

        condiciones.append("s.docente_id = ?")
        parametros.append(docente_id)

    elif usuario["rol"] == "ESTUDIANTE":
        estudiante_id = usuario.get("estudiante_id")
        if not estudiante_id:
            return []

        condiciones.append("m.estudiante_id = ?")
        parametros.append(estudiante_id)

    elif usuario["rol"] != "ADMIN":
        raise HTTPException(403, "Rol no autorizado")

    if seccion_id is not None:
        condiciones.append("m.seccion_id = ?")
        parametros.append(seccion_id)

    where = (
        "WHERE " + " AND ".join(condiciones)
        if condiciones
        else ""
    )

    with conexion_lectura() as conexion:
         filas = conexion.execute(
            f"""
            SELECT
                c.id,
                c.matricula_id,
                c.primer_parcial,
                c.segundo_parcial,
                c.tercer_parcial,
                c.nota_final,
                c.observacion,
                TRIM(e.nombres || ' ' || e.apellidos) AS estudiante,
                a.nombre AS asignatura
            FROM calificaciones c
            JOIN matriculas m ON m.id = c.matricula_id
            JOIN secciones s ON s.id = m.seccion_id
            JOIN estudiantes e ON e.id = m.estudiante_id
            JOIN asignaturas a ON a.id = s.asignatura_id
            {where}
            ORDER BY c.id
            """,
            parametros,
        ).fetchall()

    return [_respuesta_calificacion(fila) for fila in filas]


@router.get(
    "/matricula/{matricula_id}",
    response_model=CalificacionRespuesta,
)
def obtener_calificacion(
    matricula_id: int,
    usuario: dict = Depends(obtener_usuario_actual),
):
    with conexion_lectura() as conexion:
        if not _puede_acceder_matricula(conexion, matricula_id, usuario):
            raise HTTPException(403, "No tiene permiso para consultar esta matrícula")

        fila = conexion.execute(
            "SELECT * FROM calificaciones WHERE matricula_id = ?",
            (matricula_id,),
        ).fetchone()

    if fila is None:
        raise HTTPException(
            404,
            "La matrícula todavía no tiene calificaciones",
        )

    return _respuesta_calificacion(fila)


@router.put(
    "/matricula/{matricula_id}",
    response_model=CalificacionRespuesta,
    status_code=status.HTTP_200_OK,
)
def guardar_calificacion(
    matricula_id: int,
    datos: CalificacionEntrada,
    usuario: dict = Depends(exigir_roles("ADMIN", "DOCENTE")),
):
    nota_final = round(
        (
            datos.primer_parcial
            + datos.segundo_parcial
            + datos.tercer_parcial
        ) / 3,
        2,
    )
    resultado = "APROBADA" if nota_final >= 65 else "REPROBADA"

    with transaccion() as conexion:
        matricula = obtener_o_404(
            conexion,
            "matriculas",
            matricula_id,
            "Matrícula",
        )

        if not _puede_acceder_matricula(conexion, matricula_id, usuario):
            raise HTTPException(
                403,
                "Solo puede calificar estudiantes de sus secciones asignadas",
            )

        if matricula["estado"] == "CANCELADA":
            raise HTTPException(
                409,
                "No se puede calificar una matrícula cancelada",
            )

        existente = conexion.execute(
            "SELECT id FROM calificaciones WHERE matricula_id = ?",
            (matricula_id,),
        ).fetchone()

        if existente:
            conexion.execute(
                """
                UPDATE calificaciones
                SET primer_parcial = ?, segundo_parcial = ?, tercer_parcial = ?,
                    nota_final = ?, observacion = ?,
                    actualizado_en = CURRENT_TIMESTAMP
                WHERE matricula_id = ?
                """,
                (
                    datos.primer_parcial,
                    datos.segundo_parcial,
                    datos.tercer_parcial,
                    nota_final,
                    datos.observacion,
                    matricula_id,
                ),
            )
        else:
            conexion.execute(
                """
                INSERT INTO calificaciones
                    (matricula_id, primer_parcial, segundo_parcial,
                     tercer_parcial, nota_final, observacion)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    matricula_id,
                    datos.primer_parcial,
                    datos.segundo_parcial,
                    datos.tercer_parcial,
                    nota_final,
                    datos.observacion,
                ),
            )

        conexion.execute(
            "UPDATE matriculas SET estado = ? WHERE id = ?",
            (resultado, matricula_id),
        )

        fila = conexion.execute(
            "SELECT * FROM calificaciones WHERE matricula_id = ?",
            (matricula_id,),
        ).fetchone()

        return _respuesta_calificacion(fila)


@router.delete(
    "/matricula/{matricula_id}",
    response_model=MensajeRespuesta,
)
def eliminar_calificacion(
    matricula_id: int,
    usuario: dict = Depends(exigir_roles("ADMIN")),
):
    with transaccion() as conexion:
        obtener_o_404(
            conexion,
            "matriculas",
            matricula_id,
            "Matrícula",
        )

        cursor = conexion.execute(
            "DELETE FROM calificaciones WHERE matricula_id = ?",
            (matricula_id,),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                404,
                "La matrícula no tenía calificaciones",
            )

        conexion.execute(
            "UPDATE matriculas SET estado = 'MATRICULADA' WHERE id = ?",
            (matricula_id,),
        )

    return {
        "mensaje": "Calificación eliminada y matrícula reabierta"
    }
