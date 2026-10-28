@echo off
setlocal EnableExtensions
chcp 65001 >nul

echo ==========================================
echo    INSTALANDO O LIMPADOR DE ZUMBIS V2
echo ==========================================

set "WEBROOT=%LOCALAPPDATA%\FDB_REL_WEB"
if not exist "%WEBROOT%" mkdir "%WEBROOT%" >nul 2>&1

set "LIMP_CMD=%WEBROOT%\_limpador_zumbis.cmd"
set "LIMP_VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Limpador_Zumbis_FDB.vbs"

> "%LIMP_CMD%" echo @echo off
>>"%LIMP_CMD%" echo title FDB_Limpador_Zumbis
>>"%LIMP_CMD%" echo :loop
>>"%LIMP_CMD%" echo :: 1. Pega todos os processos
>>"%LIMP_CMD%" echo :: 2. Mata conhost.exe orfaos
>>"%LIMP_CMD%" echo :: 3. Mata node.exe (geradores de relatorio) travados a mais de 5 minutos
>>"%LIMP_CMD%" echo powershell -NoProfile -Command "$all=Get-CimInstance Win32_Process; $ids=$all.ProcessId; $all | Where-Object { $_.Name -eq 'conhost.exe' -and $_.ParentProcessId -notin $ids } | Stop-Process -Force -ErrorAction SilentlyContinue; $limite=(Get-Date).AddMinutes(-5); $all | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'gerar-relatorio-html\.js' -and $_.CreationDate -lt $limite } | Stop-Process -Force -ErrorAction SilentlyContinue"
>>"%LIMP_CMD%" echo timeout /t 300 /nobreak ^>nul
>>"%LIMP_CMD%" echo goto loop

attrib +h +s "%LIMP_CMD%" >nul 2>&1

> "%LIMP_VBS%" echo Set sh = CreateObject("WScript.Shell")
>>"%LIMP_VBS%" echo sh.Run "cmd.exe /c """"%LIMP_CMD%""""", 0, False

:: Derruba o limpador antigo se estiver rodando e inicia o novo
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*_limpador_zumbis.cmd*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
wscript.exe "%LIMP_VBS%"

echo.
echo Limpador atualizado e rodando! 
echo Zumbis de "node.exe" e "conhost.exe" serao eliminados com seguranca.
echo.
pause
exit /b 0