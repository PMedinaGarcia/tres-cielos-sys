import {
  copyNombreFecha,
  gapNombreFecha,
  huboProgresoCaptura,
  siguienteNumeroMensajesCaptura,
} from "./captura-progreso";
import {
  COPY_V2_B1,
  COPY_V2_FECHA_ANOTADA,
  COPY_V2_FECHA_CON_NOMBRE,
  COPY_V2_FECHA_SIN_ANIO,
  COPY_V2_NOMBRE_RETRY,
} from "./script-v2.copy";

const FECHA_FEB = {
  tipo: "mes" as const,
  mes: 2,
  anio: 2027,
  flexible: true,
};

describe("captura-progreso", () => {
  it("gapNombreFecha distingue ambos, nombre, fecha y completo", () => {
    expect(gapNombreFecha({})).toBe("ambos");
    expect(gapNombreFecha({ fechaTentativa: FECHA_FEB })).toBe("nombre");
    expect(gapNombreFecha({ nombre: "Ana" })).toBe("fecha");
    expect(
      gapNombreFecha({ nombre: "Ana", fechaTentativa: FECHA_FEB }),
    ).toBe("completo");
  });

  it("copyNombreFecha acusa febrero y no vuelve a pedir la fecha", () => {
    const copy = copyNombreFecha(
      { fechaTentativa: FECHA_FEB },
      {},
    );
    expect(copy).toBe(COPY_V2_FECHA_ANOTADA("febrero de 2027"));
    expect(copy).not.toMatch(/fecha o temporada/);
  });

  it("copyNombreFecha con nombre pide solo la fecha", () => {
    expect(copyNombreFecha({ nombre: "Ana" }, {})).toBe(
      COPY_V2_FECHA_CON_NOMBRE("Ana"),
    );
  });

  it("copyNombreFecha usa B1 al inicio y el retry si faltan ambos", () => {
    expect(copyNombreFecha({}, {})).toBe(COPY_V2_B1);
    expect(copyNombreFecha({ numeroMensajesCaptura: 1 }, {})).toBe(
      COPY_V2_NOMBRE_RETRY,
    );
  });

  it("copyNombreFecha repara fecha sin año sin borrar el nombre", () => {
    expect(
      copyNombreFecha({ nombre: "Ana" }, { fechaMotivo: "sin_anio" }),
    ).toBe(`Gracias, Ana. ${COPY_V2_FECHA_SIN_ANIO}`);
  });

  it("huboProgresoCaptura solo cuenta el primer cierre de nombre o fecha", () => {
    expect(huboProgresoCaptura(["fechaTentativa"], {})).toBe(true);
    expect(
      huboProgresoCaptura(["fechaTentativa"], { fechaTentativa: FECHA_FEB }),
    ).toBe(false);
    expect(huboProgresoCaptura(["nombre"], { nombre: "Ana" })).toBe(false);
    expect(huboProgresoCaptura(["aforo"], {})).toBe(false);
  });

  it("siguienteNumeroMensajesCaptura reinicia al cerrar un slot vacío", () => {
    expect(siguienteNumeroMensajesCaptura(3, ["fechaTentativa"], {})).toBe(0);
    expect(siguienteNumeroMensajesCaptura(2, [], {})).toBe(3);
  });
});
