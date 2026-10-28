@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"

set "BUSCA_COMPLETA=1"
set "FDB="
set "SCRIPT="

:: Busca o banco FDB
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

:: Busca o script JS
for %%P in (
  "%~dp0gerar-relatorio-html.js"
  "%~dp0\gerar-relatorio-html.js"
  "%userprofile%\downloads\gerar-relatorio-html.js"
  "%userprofile%\desktop\gerar-relatorio-html.js"
  "%userprofile%\documents\gerar-relatorio-html.js"
) do if not defined SCRIPT if exist "%%~fP" set "SCRIPT=%%~fP"

if not defined SCRIPT for /f "delims=" %%F in ('where /r "%~dp0" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%\desktop" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%\documents" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%\downloads" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%homedrive%" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"

if not defined SCRIPT (
  echo Nao encontrei o gerar-relatorio-html.js.
  pause
  exit /b 1
)

:: Pega o ano atual para padrao
for /f "tokens=2 delims==" %%a in ('wmic os get LocalDateTime /value ^| find "="') do set "LDT=%%a"
set "ANO_PADRAO=!LDT:~0,4!"

echo =======================================================
echo     GERAR RELATORIO POR PERIODO (Ex: 01/03 ate 20/03)
echo =======================================================
echo.

:: Pede a data de INICIO
set "DATA_I="
set /p DATA_I=Digite a data INICIAL (D/M ou DD/MM): 
call :ParseDate "!DATA_I!" D_I M_I Y_I
if "!ERRO!"=="1" goto invalida

:: Pede a data FINAL
set "DATA_F="
set /p DATA_F=Digite a data FINAL (D/M ou DD/MM): 
call :ParseDate "!DATA_F!" D_F M_F Y_F
if "!ERRO!"=="1" goto invalida

set "DATA_INICIO_ISO=!Y_I!-!M_I!-!D_I!"
set "DATA_FIM_ISO=!Y_F!-!M_F!-!D_F!"

set "DATA_INICIO_BR=!D_I!/!M_I!/!Y_I!"
set "DATA_FIM_BR=!D_F!/!M_F!/!Y_F!"

set "NOME_ARQ=!D_I!-!M_I!-!Y_I!_A_!D_F!-!M_F!-!Y_F!"
set "OUT=%userprofile%\desktop\(FDB-PERIODO)_relatorio_%NOME_ARQ%.html"

echo.
echo Processando de !DATA_INICIO_BR! ate !DATA_FIM_BR!...
node "%SCRIPT%" --fdb "%FDB%" --data-inicio "%DATA_INICIO_ISO%" --data-fim "%DATA_FIM_ISO%" --saida "%OUT%" --user SYSDBA --pass masterkey

if not exist "%OUT%" (
  echo Erro ao gerar o arquivo HTML.
  pause
  exit /b 1
)

start "" "%OUT%"
exit /b 0

:: Funcao para quebrar a data e colocar zeros a esquerda
:ParseDate
set "INP=%~1"
set "ERRO=0"
if "%INP%"=="" set "ERRO=1" & exit /b
set "INP=!INP: =!"
set "INP=!INP:-=/!"
for /f "tokens=1-3 delims=/" %%a in ("!INP!") do (
  set "d=%%a"
  set "m=%%b"
  set "y=%%c"
)
if not defined d set "ERRO=1" & exit /b
if not defined m set "ERRO=1" & exit /b
if not defined y set "y=%ANO_PADRAO%"

:: Adiciona zero a esquerda se tiver so 1 numero
if "!d:~1,1!"=="" set "d=0!d!"
if "!m:~1,1!"=="" set "m=0!m!"

set "%2=!d!"
set "%3=!m!"
set "%4=!y!"
exit /b

:invalida
echo.
echo Data invalida! Use formatos como 1/3, 01/03, etc.
pause
exit /b 1