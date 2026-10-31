# SInPLe Stock (web)

App web instalable (PWA) para llevar el stock del rodeo lechero por categoría y sexo, por establecimiento.
Usa **las mismas tablas y funciones de Supabase que la app Android de SInPLe Stock** (`simple_stock_*`):
los datos ya cargados se ven igual y las dos apps pueden usarse en paralelo. No requiere cambios en la base.

## Cómo calcula el stock

Igual que la app Android: stock inicial por categoría y sexo a la fecha de inventario, más los movimientos desde esa fecha.
Nacimiento, Compra e Ingreso ajuste suman en la categoría de destino; Venta, Muerte, Descarte y Egreso ajuste restan
en la de origen; Traslado interno pasa de una categoría a otra. Los movimientos borrados se marcan con `deleted_at`.
`tests/stock.test.ts` cubre el cálculo (y se verificó contra el código original de la app Android con movimientos al azar).

## Roles (los mismos de la app Android)

| Rol | Ve |
| --- | --- |
| Propietario / Encargado | Stock, Movimientos (asistente, editar, borrar), Conteo mensual, Indicadores, Animales, Equipo, Configuración, Exportar, Carga masiva. Puede usar el **modo operario**. |
| Operario | Una pantalla simple: botones grandes (Nacimiento, Muerte, Venta, Pasó de categoría, Compra, Descarte), asistente paso a paso, lo anotado hoy con deshacer. |
| Solo lectura | Stock, movimientos e indicadores. |

## Funciones

- **Sin señal**: guarda una copia del stock en el celular y una cola de movimientos que se envían solos al volver la señal.
- **Conteo mensual**: compara lo contado con el sistema y registra Ingreso/Egreso ajuste ("Conteo físico / cierre mensual").
- **Indicadores** con semáforo: refugo (ventas + muertes + descartes) del período y anualizado, refugo y mortalidad anual
  de vacas, VO/VT, vaquillonas cada 100 vacas vs. las necesarias, composición del rodeo, causas y tendencia de 12 meses.
  Referencias: Revista FAVE–UNL, encuesta INTA, "Compará tu tambo", tabla de Cargill.
- **Animales individuales** (fichas y eventos); venta, muerte, descarte o cambio de categoría pueden registrarse también en el stock.
- **Exportar** a Excel (CSV) e informe imprimible / PDF. **Carga masiva** de movimientos pegando desde Excel o con CSV.

## Puesta en marcha

1. GitHub → Settings → Pages → Source: *GitHub Actions*. Cada cambio en `main` se publica solo.
2. Supabase → Authentication → URL Configuration → *Redirect URLs*: agregar
   `https://josebarbero03.github.io/simple-stock-web/**` (confirmación de cuenta y recuperación de contraseña).

## Desarrollo

```sh
npm install
npm run dev     # http://localhost:5173
npm test
npm run build
```

## Estructura

- `src/lib/stock.ts`: cálculo del stock e indicadores. `src/lib/movements.ts`: armar y validar movimientos.
- `src/lib/api.ts`: consultas a Supabase (mismas que la app Android). `src/hooks/useStockData.ts`: datos, copia local y cola sin señal.
- `src/components/`: una pantalla por archivo (`StockPanel`, `MovementsPanel`, `MovementWizard`, `CountPanel`, `IndicatorsPanel`,
  `AnimalsPanel`, `SettingsPanel`, `TeamPanel`, `ExportPanel`, `BulkMovements`, `OperatorHome`, `EstablishmentsPanel`).
