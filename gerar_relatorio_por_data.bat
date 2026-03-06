@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"

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
  exit /b 1
)

for %%P in (
  "%~dp0gerencial_por_vendedor_html.js"
  "%~dp0\gerencial_por_vendedor_html.js"
  "%userprofile%\downloads\gerencial_por_vendedor_html.js"
  "%userprofile%\desktop\gerencial_por_vendedor_html.js"
  "%userprofile%\documents\gerencial_por_vendedor_html.js"
) do if not defined SCRIPT if exist "%%~fP" set "SCRIPT=%%~fP"

if not defined SCRIPT for /f "delims=" %%F in ('where /r "%~dp0" gerencial_por_vendedor_html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%\desktop" gerencial_por_vendedor_html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%\documents" gerencial_por_vendedor_html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%\downloads" gerencial_por_vendedor_html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%" gerencial_por_vendedor_html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%homedrive%" gerencial_por_vendedor_html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"

if not defined SCRIPT (
  for /f "delims=" %%R in ('powershell -NoProfile -Command "(Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root)"') do (
    if not defined SCRIPT for /f "delims=" %%F in ('where /r "%%R" gerencial_por_vendedor_html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
  )
)

if not defined SCRIPT (
  echo Nao encontrei o gerencial_por_vendedor_html.js automaticamente.
  echo Procurei na pasta do .bat, Desktop, Documentos, perfil do usuario e em todas as unidades.
  exit /b 1
)

for /f "tokens=2 delims==" %%a in ('wmic os get LocalDateTime /value ^| find "="') do set "LDT=%%a"
set "ANO_PADRAO=!LDT:~0,4!"
if not defined ANO_PADRAO (
  echo Nao consegui obter o ano atual.
  exit /b 1
)

set "DATAIN="
set /p DATAIN=Digite a data (D/M, DD/MM ou DD/MM/AAAA) (ano opcional) [ano padrao=%ANO_PADRAO%]: 
if "%DATAIN%"=="" (
  echo Data vazia.
  exit /b 1
)

set "DATAIN=%DATAIN: =%"
set "DATAIN=%DATAIN:-=/%"

for /f "tokens=1-3 delims=/" %%a in ("%DATAIN%") do (
  set "D=%%a"
  set "M=%%b"
  set "Y=%%c"
)

if not defined D goto invalida
if not defined M goto invalida
if not defined Y set "Y=%ANO_PADRAO%"

echo %D%| findstr /r "^[0-9][0-9]*$" >nul || goto invalida
echo %M%| findstr /r "^[0-9][0-9]*$" >nul || goto invalida
echo %Y%| findstr /r "^[0-9][0-9]*$" >nul || goto invalida

if "%D:~1,1%"=="" set "D=0%D%"
if "%M:~1,1%"=="" set "M=0%M%"

if not "%D:~2,1%"=="" goto invalida
if not "%M:~2,1%"=="" goto invalida
if not "%Y:~4,1%"=="" goto invalida

set "DATA=%Y%-%M%-%D%"
set "DATA_ARQ=%D%-%M%-%Y%"

set "OUT=%userprofile%\desktop\(FDB-DATA)_relatorio_%DATA_ARQ%_gerencial_por_vendedor.html"

echo FDB: "%FDB%"
echo Script: "%SCRIPT%"
node "%SCRIPT%" --fdb "%FDB%" --data "%DATA%" --saida "%OUT%" --user SYSDBA --pass masterkey

if not exist "%OUT%" (
  echo Nao foi gerado: "%OUT%"
  exit /b 1
)

start "" "%OUT%"
exit /b 0

:invalida
echo Data invalida. Use DD/MM ou DD/MM/AAAA.
exit /b 1
