
import secrets
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import conexion_lectura, transaccion, hash_clave
from app.security import exigir_roles
from app.helpers import filas_a_lista, obtener_o_404
from app.schemas import (
    DocenteEntrada,
    DocenteRespuesta,
    DocenteCreadoRespuesta,
    MensajeRespuesta,
)


router = APIRouter(prefix="/docentes", tags=["Docentes"])


@router.get("", response_model=list[DocenteRespuesta])
def listar_docentes(
    buscar: str | None = Query(default=None, max_length=100),
    estado: str | None = Query(default=None, pattern="^(ACTIVO|INACTIVO)$"),
):
    condiciones: list[str] = []
    parametros: list[object] = []
    if buscar:
        condiciones.append(
            "(numero_empleado LIKE ? OR nombres LIKE ? OR apellidos LIKE ? "
            "OR especialidad LIKE ?)"
        )
        patron = f"%{buscar}%"
        parametros.extend([patron] * 4)
    if estado:
        condiciones.append("estado = ?")
        parametros.append(estado)

    where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""
    with conexion_lectura() as conexion:
        filas = conexion.execute(
            f"""
            SELECT id, numero_empleado, nombres, apellidos, correo,
                   especialidad, estado
            FROM docentes {where}
            ORDER BY apellidos, nombres
            """,
            parametros,
        ).fetchall()
    return filas_a_lista(filas)


@router.get("/{docente_id}", response_model=DocenteRespuesta)
def obtener_docente(docente_id: int):
    with conexion_lectura() as conexion:
        return dict(obtener_o_404(conexion, "docentes", docente_id, "Docente"))


@router.post(
    "",
    response_model=DocenteCreadoRespuesta,
    status_code=status.HTTP_201_CREATED,
)
def crear_docente(datos: DocenteEntrada, usuario: dict = Depends(exigir_roles("ADMIN"))):
    clave_temporal = secrets.token_urlsafe(9)
    usuario = datos.numero_empleado.upper()

    try:
        with transaccion() as conexion:
            cursor = conexion.execute(
                """
                INSERT INTO docentes
                    (numero_empleado, nombres, apellidos, correo,
                     especialidad, estado)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    usuario,
                    datos.nombres,
                    datos.apellidos,
                    str(datos.correo).lower(),
                    datos.especialidad,
                    datos.estado,
                ),
            )

            docente_id = cursor.lastrowid

            conexion.execute(
                """
                INSERT INTO usuarios
                    (usuario, nombre_completo, clave_hash, rol,
                     activo, docente_id)
                VALUES (?, ?, ?, 'DOCENTE', 1, ?)
                """,
                (
                    usuario,
                    f"{datos.nombres} {datos.apellidos}",
                    hash_clave(clave_temporal),
                    docente_id,
                ),
            )

            fila = conexion.execute(
                "SELECT * FROM docentes WHERE id = ?",
                (docente_id,),
            ).fetchone()

            respuesta = dict(fila)
            respuesta["usuario"] = usuario
            respuesta["clave_temporal"] = clave_temporal

            return respuesta

    except sqlite3.IntegrityError as error:
        raise HTTPException(
            409,
            "El nÃºmero de empleado, el usuario o el correo ya estÃ¡n registrados.",
        ) from error

