from datetime import date
from pathlib import Path
import sqlite3

from app import database
import app.routers.estudiantes as modulo_estudiantes
import app.routers.auth as modulo_auth
from app.schemas import EstudianteEntrada, UsuarioLogin

BASE_DIR = Path(__file__).resolve().parent
DB_PRUEBAS = BASE_DIR / "sistema_academico_pruebas.db"

# Dirigir las operaciones a la copia de prueba.
database.DB_PATH = DB_PRUEBAS
modulo_estudiantes.transaccion = database.transaccion
modulo_estudiantes.conexion_lectura = database.conexion_lectura
modulo_estudiantes.hash_clave = database.hash_clave
modulo_auth.conexion_lectura = database.conexion_lectura
modulo_auth.hash_clave = database.hash_clave

cuenta = "20999998"
correo = "estudiante.prueba.20999998@example.com"

# Evitar duplicados si ejecutas la prueba más de una vez.
with sqlite3.connect(DB_PRUEBAS) as conexion:
    conexion.execute(
        "DELETE FROM usuarios WHERE usuario = ?", (cuenta,)
    )
    conexion.execute(
        "DELETE FROM estudiantes WHERE cuenta = ?", (cuenta,)
    )

datos = EstudianteEntrada(
    cuenta=cuenta,
    nombres="Estudiante",
    apellidos="Prueba Login",
    correo=correo,
    fecha_nacimiento=date(2005, 5, 15),
    carrera_id=1,
    estado="ACTIVO",
)

resultado = modulo_estudiantes.crear_estudiante(datos)
clave = resultado["clave_temporal"]

print("Estudiante creado en la copia:", resultado["cuenta"])

sesion = modulo_auth.iniciar_sesion(
    UsuarioLogin(usuario=cuenta, clave=clave)
)

print("Login correcto.")
print("Usuario:", sesion["usuario"])
print("Nombre:", sesion["nombre_completo"])
print("Rol:", sesion["rol"])
print("Base utilizada:", DB_PRUEBAS)
