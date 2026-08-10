@echo off
REM ATMDH / OAMT - corrida completa en Windows.
REM Doble clic. No requiere saber R.
setlocal
cd /d "%~dp0"

where Rscript >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se encuentra Rscript en el PATH.
  echo Instale R desde https://cran.r-project.org/bin/windows/base/
  echo y vuelva a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

if "%ATMDH_VINTAGE%"=="" set ATMDH_VINTAGE=2026Q3

echo === ATMDH / OAMT === cosecha %ATMDH_VINTAGE%
Rscript run_all.R
if errorlevel 1 (
  echo.
  echo La corrida se detuvo. Revise el mensaje de arriba y el reporte en reports\.
  pause
  exit /b 1
)

echo.
echo Listo. Abriendo el tablero...
start "" "dashboard\index.html"
pause
