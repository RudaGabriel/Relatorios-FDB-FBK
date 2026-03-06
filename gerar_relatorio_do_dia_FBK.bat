@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set "DATA=%%i"
for /f "tokens=1-3 delims=-" %%a in ("%DATA%") do (set "YYYY=%%a" & set "MM=%%b" & set "DD=%%c")
set "DATA_ARQ=%DD%-%MM%-%YYYY%"

set "BUSCA_COMPLETA=1"
set "FBK="
set "FDB="
set "GBAK="
set "SCRIPT="
set "NODE="
set "NEED_REFRESH=0"
set "OUT=%userprofile%\desktop\(FBK-DIA)_relatorio_%DATA_ARQ%.html"

call :FIND_NODE
if not defined NODE goto NO_NODE

call :FIND_SCRIPT
if not defined SCRIPT goto NO_SCRIPT

call :FIND_GBAK
if not defined GBAK goto NO_GBAK

call :FIND_FBK
if not defined FBK goto ASK_CREATE

call :FIND_FDB_SILENT
if defined FDB call :CHECK_CHANGES
if "%NEED_REFRESH%"=="1" goto AUTO_REFRESH
goto RUN_NODE

:AUTO_REFRESH
echo.
echo Detectei alteracoes no banco (novas vendas/vendas canceladas/vendas convertidas para NFC-e).
echo Atualizando FBK... Aguarde.
call :CAPTURE_SALES_SIG
set "SIG0=%SIG%"
call :CREATE_FBK_SAFE
if errorlevel 1 goto FAIL_FBK
set "META=%FBK%.meta"
> "%META%" (echo %SIG0%)
call :CAPTURE_SALES_SIG
if not "%SIG%"=="%SIG0%" goto MOVING
goto RUN_NODE

:MOVING
echo.
echo Aviso: houve novas vendas/cancelamentos/conversoes durante a atualizacao do FBK.
echo O relatorio pode nao incluir tudo; rode novamente quando a loja parar.
goto RUN_NODE

:ASK_CREATE
choice /c SN /n /m "Nao encontrei SMALL.fbk. Deseja criar um .fbk baseado no .fdb? (S/N) "
if errorlevel 2 goto CANCEL

call :FIND_FDB
if not defined FDB goto NO_FDB

if not exist "%userprofile%\Desktop\VE" md "%userprofile%\Desktop\VE" >nul 2>nul
set "FBK=%userprofile%\Desktop\VE\SMALL.fbk"

echo.
echo Criando FBK... Aguarde.
call :CAPTURE_SALES_SIG
set "SIG0=%SIG%"
call :CREATE_FBK_SAFE
if errorlevel 1 goto FAIL_FBK
set "META=%FBK%.meta"
> "%META%" (echo %SIG0%)
goto RUN_NODE

:RUN_NODE
echo.
echo Script: "%SCRIPT%"
echo FBK: "%FBK%"
echo.
echo Gerando relatório... Essa janela fechará sozinha! Aguarde.
"%NODE%" "%SCRIPT%" --fbk "%FBK%" --data %DATA% --saida "%OUT%" --user SYSDBA --pass masterkey --gbak "%GBAK%" --encoding WIN1252
start "" "%OUT%"
exit /b 0

:NO_NODE
echo Nao encontrei o node.exe automaticamente.
pause
exit /b 1

:NO_SCRIPT
echo Nao encontrei o gerar-relatorio-html.js automaticamente.
pause
exit /b 1

:NO_GBAK
echo Nao encontrei o gbak.exe automaticamente.
pause
exit /b 1

:NO_FDB
echo Nao encontrei o SMALL.FDB automaticamente.
pause
exit /b 1

:FAIL_FBK
echo Falha ao criar o FBK: "%FBK%"
pause
exit /b 1

:CANCEL
echo Operacao cancelada.
pause
exit /b 1

:CHECK_CHANGES
set "NEED_REFRESH=0"
set "META=%FBK%.meta"
call :CAPTURE_SALES_SIG
if not defined SIG exit /b 0
set "SIG_OLD="
if exist "%META%" for /f "usebackq delims=" %%m in ("%META%") do set "SIG_OLD=%%m"
if not defined SIG_OLD (set "NEED_REFRESH=1" & exit /b 0)
if /i not "%SIG%"=="%SIG_OLD%" set "NEED_REFRESH=1"
exit /b 0

:CAPTURE_SALES_SIG
set "SIG="
if not defined FDB exit /b 0
if not defined NODE exit /b 0
if not defined SCRIPT exit /b 0
set "CHK_TMP=%temp%\rg_chk_%random%_%random%.html"
if exist "%CHK_TMP%" del /f /q "%CHK_TMP%" >nul 2>nul
"%NODE%" "%SCRIPT%" --fdb "%FDB%" --data %DATA% --saida "%CHK_TMP%" --user SYSDBA --pass masterkey --gbak "%GBAK%" --encoding WIN1252 >nul 2>nul
if not exist "%CHK_TMP%" exit /b 0
for /f "delims=" %%H in ('powershell -NoProfile -Command "$p='%CHK_TMP%'; $enc=[Text.Encoding]::GetEncoding(1252); $txt=[IO.File]::ReadAllText($p,$enc); $u=$txt.ToUpperInvariant(); $gers=[regex]::Matches($u,'\b0\d{5}\b')|%%{$_.Value}|Sort-Object -Unique; $g=$gers.Count; $c=([regex]::Matches($u,'CANCELAD[OA]')).Count; $n=([regex]::Matches($u,'NFC[\- ]?E|NFCE')).Count; $sig='G='+$g+'|C='+$c+'|N='+$n+'|L='+($gers -join ','); $sha=[Security.Cryptography.SHA256]::Create(); $b=[Text.Encoding]::UTF8.GetBytes($sig); [BitConverter]::ToString($sha.ComputeHash($b)).Replace('-','')" 2^>nul') do set "SIG=%%H"
del /f /q "%CHK_TMP%" >nul 2>nul
exit /b 0


:CREATE_FBK_SAFE
if not defined FDB exit /b 1
if not defined FBK exit /b 1
set "FBK_TMP=%FBK%.tmp"
if exist "%FBK_TMP%" del /f /q "%FBK_TMP%" >nul 2>nul
echo Iniciando gbak... (pode demorar)
"%GBAK%" -g -b -v -user SYSDBA -password masterkey "%FDB%" "%FBK_TMP%"
if not exist "%FBK_TMP%" exit /b 1
move /y "%FBK_TMP%" "%FBK%" >nul
if not exist "%FBK%" exit /b 1
exit /b 0

:FIND_NODE
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined NODE set "NODE=%%N"
if not defined NODE for %%P in ("%ProgramFiles%\nodejs\node.exe" "%ProgramFiles(x86)%\nodejs\node.exe") do if not defined NODE if exist "%%~fP" set "NODE=%%~fP"
goto :eof

:FIND_SCRIPT
for %%P in (
  "%~dp0gerar-relatorio-html.js"
  "%~dp0\gerar-relatorio-html.js"
  "%userprofile%\Desktop\gerar-relatorio-html.js"
  "%userprofile%\Documents\gerar-relatorio-html.js"
  "%userprofile%\Downloads\gerar-relatorio-html.js"
) do if not defined SCRIPT if exist "%%~fP" set "SCRIPT=%%~fP"

if not defined SCRIPT for /f "delims=" %%F in ('where /r "%~dp0" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%homedrive%" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%\Desktop" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%\Documents" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%\Downloads" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"

if not defined SCRIPT if "%BUSCA_COMPLETA%"=="1" (
  for /f "delims=" %%R in ('powershell -NoProfile -Command "(Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root)"') do (
    if not defined SCRIPT for /f "delims=" %%F in ('where /r "%%R" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
  )
)
goto :eof

:FIND_FBK
for %%P in (
  "%~dp0SMALL.fbk"
  "%~dp0VE\SMALL.fbk"
  "%userprofile%\Desktop\VE\SMALL.fbk"
  "%userprofile%\Desktop\SMALL.fbk"
  "%userprofile%\Documents\SMALL.fbk"
) do if not defined FBK if exist "%%~fP" set "FBK=%%~fP"

if not defined FBK for /f "delims=" %%F in ('where /r "%userprofile%\Desktop" SMALL.fbk 2^>nul') do if not defined FBK set "FBK=%%F"
if not defined FBK for /f "delims=" %%F in ('where /r "%userprofile%\Documents" SMALL.fbk 2^>nul') do if not defined FBK set "FBK=%%F"

if not defined FBK if "%BUSCA_COMPLETA%"=="1" (
  for /f "delims=" %%R in ('powershell -NoProfile -Command "(Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root)"') do (
    if not defined FBK for /f "delims=" %%F in ('where /r "%%R" SMALL.fbk 2^>nul') do if not defined FBK set "FBK=%%F"
  )
)
goto :eof

:FIND_FDB
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
goto :eof

:FIND_FDB_SILENT
set "FDB="
call :FIND_FDB
goto :eof

:FIND_GBAK
for /f "delims=" %%G in ('where gbak.exe 2^>nul') do if not defined GBAK set "GBAK=%%G"

for %%P in (
  "%ProgramFiles(x86)%\Firebird\Firebird_2_5\bin\gbak.exe"
  "%ProgramFiles%\Firebird\Firebird_2_5\bin\gbak.exe"
  "%ProgramFiles(x86)%\Firebird\Firebird_3_0\bin\gbak.exe"
  "%ProgramFiles%\Firebird\Firebird_3_0\bin\gbak.exe"
  "%ProgramFiles(x86)%\Firebird\Firebird_4_0\bin\gbak.exe"
  "%ProgramFiles%\Firebird\Firebird_4_0\bin\gbak.exe"
  "%ProgramFiles(x86)%\Firebird\Firebird_5_0\bin\gbak.exe"
  "%ProgramFiles%\Firebird\Firebird_5_0\bin\gbak.exe"
) do if not defined GBAK if exist "%%~fP" set "GBAK=%%~fP"

for /d %%D in ("%ProgramFiles(x86)%\Firebird\Firebird_*") do if not defined GBAK if exist "%%D\bin\gbak.exe" set "GBAK=%%D\bin\gbak.exe"
for /d %%D in ("%ProgramFiles%\Firebird\Firebird_*") do if not defined GBAK if exist "%%D\bin\gbak.exe" set "GBAK=%%D\bin\gbak.exe"
goto :eof
