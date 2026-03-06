@echo off
setlocal
chcp 65001 >nul
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set "DATA=%%i"

set "BUSCA_COMPLETA=1"
set "FDB="
set "SCRIPT="

for %%P in (
  "%ProgramFiles(x86)%\SmallSoft\Small Commerce\SMALL.FDB"
  "%ProgramFiles%\SmallSoft\Small Commerce\SMALL.FDB"
  "%ProgramData%\SmallSoft\Small Commerce\SMALL.FDB"
) do if not defined FDB if exist "%%~fP" set "FDB=%%~fP"

if not defined FDB for /f "delims=" %%F in ('where /r "%ProgramFiles(x86)%" SMALL.FDB 2^>nul') do if not defined FDB set "FDB=%%F"
if not defined FDB for /f "delims=" %%F in ('where /r "%ProgramFiles%" SMALL.FDB 2^>nul') do if not defined FDB set "FDB=%%F"

if not defined FDB if "%BUSCA_COMPLETA%"=="1" (
  for /f "delims=" %%R in ('powershell -NoProfile -Command "(Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root)"') do (
    if not defined FDB for /f "delims=" %%F in ('where /r "%%R" SMALL.FDB 2^>nul') do if not defined FDB set "FDB=%%F"
  )
)

if not defined FDB (
  echo Nao encontrei o SMALL.FDB automaticamente.
  pause
  exit /b 1
)

for %%P in (
  "%~dp0gerar-relatorio-html.js"
  "%~dp0\gerar-relatorio-html.js"
  "%userprofile%\desktop\gerar-relatorio-html.js"
  "%userprofile%\documents\gerar-relatorio-html.js"
  "%userprofile%\downloads\gerar-relatorio-html.js"
) do if not defined SCRIPT if exist "%%~fP" set "SCRIPT=%%~fP"

if not defined SCRIPT for /f "delims=" %%F in ('where /r "%~dp0" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%\desktop" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%\documents" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%\downloads" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%homedrive%" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"

if not defined SCRIPT (
  for /f "delims=" %%R in ('powershell -NoProfile -Command "(Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root)"') do (
    if not defined SCRIPT for /f "delims=" %%F in ('where /r "%%R" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
  )
)

if not defined SCRIPT (
  echo Nao encontrei o gerar-relatorio-html.js automaticamente.
  echo Procurei na pasta do .bat, Desktop, Documentos, perfil do usuario e em todas as unidades.
  pause
  exit /b 1
)

for /f "tokens=1-3 delims=-" %%a in ("%DATA%") do (set "YYYY=%%a" & set "MM=%%b" & set "DD=%%c")
set "DATA_BR=%DD%/%MM%/%YYYY%"
set "DATA_ARQ=%DD%-%MM%-%YYYY%"
set "OUT=%userprofile%\desktop\(FDB-DIA)_relatorio_%DATA_ARQ%_gerencial_por_vendedor.html"

cd /d "%~dp0"
echo FDB: "%FDB%"
echo Script: "%SCRIPT%"
node "%SCRIPT%" --fdb "%FDB%" --data "%DATA%" --saida "%OUT%" --user SYSDBA --pass masterkey
start "" "%OUT%"
exit /b 0