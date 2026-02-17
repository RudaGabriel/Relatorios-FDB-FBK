@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d %~dp0

set "FDB=%ProgramFiles(x86)%\SmallSoft\Small Commerce\SMALL.FDB"
if not exist "%FDB%" (
  echo Nao encontrei o FDB: "%FDB%"
  exit /b 1
)

for /f "tokens=2 delims==" %%a in ('wmic os get LocalDateTime /value ^| find "="') do set "LDT=%%a"
set "ANO_PADRAO=!LDT:~0,4!"
if not defined ANO_PADRAO (
  echo Nao consegui obter o ano atual.
  exit /b 1
)

set "DATAIN="
set /p DATAIN=Digite a data (DD/MM ou DD/MM/AAAA) [ano padrao=%ANO_PADRAO%]: 
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

if "!Y:~2!"=="" if not "!Y:~1!"=="" set "Y=20!Y!"
if "!Y:~3,1!"=="" goto invalida

set /a Di=%D%, Mi=%M%, Yi=%Y% 2>nul
if errorlevel 1 goto invalida
if !Mi! lss 1 goto invalida
if !Mi! gtr 12 goto invalida
if !Di! lss 1 goto invalida
if !Di! gtr 31 goto invalida

set "DD=0%D%"
set "DD=!DD:~-2!"
set "MM=0%M%"
set "MM=!MM:~-2!"
set "DATA=!Y!-!MM!-!DD!"
set "DATA_BR=!DD!/!MM!/!Y!"

set "OUT=%userprofile%\desktop\relatorio_!DD!-!MM!-!Y!_gerencial_por_vendedor.html"

set "RG_OUT=!OUT!"
set "RG_ISO=!DATA!"
set "RG_BR=!DATA_BR!"

node gerencial_por_vendedor_html_fix_width.js --fdb "%FDB%" --data !DATA! --saida "!OUT!" --user SYSDBA --pass masterkey >nul 2>nul

if exist "!OUT!" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=$env:RG_OUT;$iso=$env:RG_ISO;$br=$env:RG_BR;$enc=[System.Text.UTF8Encoding]::new($false);$c=[System.IO.File]::ReadAllText($p,$enc);$c=$c.Replace($iso,$br);[System.IO.File]::WriteAllText($p,$c,$enc)" >nul 2>nul
  start "" "!OUT!"
  exit /b 0
)

echo Falha ao gerar o HTML.
exit /b 1

:invalida
echo Data invalida. Use DD/MM ou DD/MM/AAAA. Ex: 06/02 ou 06/02/2026
exit /b 1
