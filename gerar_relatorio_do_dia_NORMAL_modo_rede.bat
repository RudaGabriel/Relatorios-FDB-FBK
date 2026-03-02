@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "PORTA=8000"
set "WEBROOT=%LOCALAPPDATA%\FDB_REL_WEB"
set "HIST=%WEBROOT%\historico"
set "ATUAL=%WEBROOT%\relatorio_atual.html"
set "SERVER=%WEBROOT%\_server_fdb_rel.js"
set "LOG=%WEBROOT%\server.log"
set "BATLOG=%WEBROOT%\bat.log"
set "KEYFILE=%WEBROOT%\_srv.key"
set "AUTO=0"

if /i "%~1"=="--auto" set "AUTO=1"
if /i "%~1"=="--instalar" goto instalar
if /i "%~1"=="--remover" goto remover

if not exist "%WEBROOT%" mkdir "%WEBROOT%" >nul 2>&1
if not exist "%HIST%" mkdir "%HIST%" >nul 2>&1

if exist "%~dp0^%BATLOG^%" del /q "%~dp0^%BATLOG^%" >nul 2>&1
if exist "%userprofile%\desktop\^%BATLOG^%" del /q "%userprofile%\desktop\^%BATLOG^%" >nul 2>&1
attrib +h "%WEBROOT%" >nul 2>&1

for /f "tokens=2 delims=," %%P in ('tasklist /v /fo csv ^| findstr /i /c:"FDB_REL_LOOP"') do taskkill /PID %%~P /F >nul 2>&1
del /q "%WEBROOT%\_gerar_loop.cmd" "%WEBROOT%\_run_gen_hidden.vbs" >nul 2>&1

> "%BATLOG%" echo INICIO %date% %time%
>>"%BATLOG%" echo WEBROOT=%WEBROOT%
>>"%BATLOG%" echo PORTA=%PORTA%

attrib +h +s "%BATLOG%" "%LOG%" >nul 2>&1

set "WEB_IP="
for /f "delims=" %%I in ('powershell -NoProfile -Command "$c=Get-NetIPConfiguration ^| Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq ''Up'' -and $_.IPv4Address -and $_.InterfaceAlias -notmatch ''VMware|WARP|VirtualBox|Hyper-V|vEthernet'' } ^| Select-Object -First 1; if($c){$c.IPv4Address.IPAddress}" 2^>nul') do if not defined WEB_IP set "WEB_IP=%%I"
if not defined WEB_IP for /f "delims=" %%I in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -notlike ''169.254*'' -and $_.IPAddress -ne ''127.0.0.1'' } ^| Select-Object -First 1 -ExpandProperty IPAddress)" 2^>nul') do if not defined WEB_IP set "WEB_IP=%%I"
if not defined WEB_IP set "WEB_IP=127.0.0.1"
>>"%BATLOG%" echo IP=%WEB_IP%

set "NODE_EXE="
for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
if not defined NODE_EXE (
  >>"%BATLOG%" echo ERRO: node nao encontrado no PATH
  if "%AUTO%"=="0" pause
  exit /b 1
)
>>"%BATLOG%" echo NODE=%NODE_EXE%

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
  >>"%BATLOG%" echo ERRO: SMALL.FDB nao encontrado
  if "%AUTO%"=="0" pause
  exit /b 1
)

for %%P in (
  "%~dp0gerencial_por_vendedor_html.js"
  "%~dp0\gerencial_por_vendedor_html.js"
  "%userprofile%\desktop\gerencial_por_vendedor_html.js"
  "%userprofile%\documents\gerencial_por_vendedor_html.js"
  "%userprofile%\downloads\gerencial_por_vendedor_html.js"
) do if not defined SCRIPT if exist "%%~fP" set "SCRIPT=%%~fP"

if not defined SCRIPT for /f "delims=" %%F in ('where /r "%~dp0" gerencial_por_vendedor_html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%\desktop" gerencial_por_vendedor_html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%\documents" gerencial_por_vendedor_html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%\downloads" gerencial_por_vendedor_html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%userprofile%" gerencial_por_vendedor_html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%homedrive%" gerencial_por_vendedor_html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"

if not defined SCRIPT (
  >>"%BATLOG%" echo ERRO: gerencial_por_vendedor_html.js nao encontrado
  if "%AUTO%"=="0" pause
  exit /b 1
)

if not exist "%KEYFILE%" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "[guid]::NewGuid().ToString('N')" > "%KEYFILE%"
)
for /f "usebackq delims=" %%K in ("%KEYFILE%") do if not defined SRVKEY set "SRVKEY=%%K"
if not defined SRVKEY (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "[guid]::NewGuid().ToString('N')" > "%KEYFILE%"
  for /f "usebackq delims=" %%K in ("%KEYFILE%") do if not defined SRVKEY set "SRVKEY=%%K"
)
attrib +h +s "%KEYFILE%" >nul 2>&1
>>"%BATLOG%" echo SRVKEY=OK

set "FDB_SRV_KEY=%SRVKEY%"
set "FDB_SRV_BASE_LOCAL=http://127.0.0.1:%PORTA%"
set "FDB_SRV_BASE_REDE=http://%WEB_IP%:%PORTA%"

for /f "tokens=1-3 delims=-" %%a in ("%DATA%") do (set "YYYY=%%a" & set "MM=%%b" & set "DD=%%c")
set "DATA_ARQ=%DD%-%MM%-%YYYY%"
set "OUT=%userprofile%\desktop\(FDB-DIA)_relatorio_%DATA_ARQ%_gerencial_por_vendedor.html"

>>"%BATLOG%" echo FDB=%FDB%
>>"%BATLOG%" echo SCRIPT=%SCRIPT%
>>"%BATLOG%" echo OUT=%OUT%

cd /d "%~dp0"
"%NODE_EXE%" "%SCRIPT%" --fdb "%FDB%" --data "%DATA%" --saida "%OUT%" --user SYSDBA --pass masterkey >> "%BATLOG%" 2>&1
if errorlevel 1 (
  >>"%BATLOG%" echo ERRO: falha ao gerar relatorio
  if "%AUTO%"=="0" pause
  exit /b 1
)

copy /y "%OUT%" "%ATUAL%" >nul
for %%F in ("%OUT%") do set "OUT_NAME=%%~nxF"

copy /y "%OUT%" "%HIST%\%OUT_NAME%" >nul

set "B64_SERVER=Y29uc3QgaHR0cD1yZXF1aXJlKCJodHRwIiksZnM9cmVxdWlyZSgiZnMiKSxwYXRoPXJlcXVpcmUoInBhdGgiKSx1cmw9cmVxdWlyZSgidXJsIiksY3A9cmVxdWlyZSgiY2hpbGRfcHJvY2VzcyIpOwpjb25zdCByb290PXBhdGgucmVzb2x2ZShwcm9jZXNzLmFyZ3ZbMl18fHByb2Nlc3MuY3dkKCkpOwpjb25zdCBwb3J0PXBhcnNlSW50KHByb2Nlc3MuYXJndlszXXx8cHJvY2Vzcy5lbnYuUE9SVEF8fCI4MDAwIiwxMCk7CmNvbnN0IHR5cGVzPXsiLmh0bWwiOiJ0ZXh0L2h0bWw7IGNoYXJzZXQ9dXRmLTgiLCIuY3NzIjoidGV4dC9jc3M7IGNoYXJzZXQ9dXRmLTgiLCIuanMiOiJhcHBsaWNhdGlvbi9qYXZhc2NyaXB0OyBjaGFyc2V0PXV0Zi04IiwiLmpzb24iOiJhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PXV0Zi04IiwiLnBuZyI6ImltYWdlL3BuZyIsIi5qcGciOiJpbWFnZS9qcGVnIiwiLmpwZWciOiJpbWFnZS9qcGVnIiwiLnN2ZyI6ImltYWdlL3N2Zyt4bWwiLCIuaWNvIjoiaW1hZ2UveC1pY29uIn07CmNvbnN0IHN0PXtydW5uaW5nOmZhbHNlLGxhc3Rfc3RhcnQ6MCxsYXN0X2VuZDowLGxhc3Rfb2s6MCxsYXN0X2VycjoiIixuZXh0X3J1bjowLHRtOm51bGx9Owpjb25zdCBmZGI9U3RyaW5nKHByb2Nlc3MuZW52LkZEQl9GSUxFfHwiIikudHJpbSgpOwpjb25zdCBzY3JpcHQ9U3RyaW5nKHByb2Nlc3MuZW52LkdFTl9TQ1JJUFR8fCIiKS50cmltKCk7CmNvbnN0IGRidXNlcj1TdHJpbmcocHJvY2Vzcy5lbnYuREJVU0VSfHwiU1lTREJBIikudHJpbSgpOwpjb25zdCBkYnBhc3M9U3RyaW5nKHByb2Nlc3MuZW52LkRCUEFTU3x8Im1hc3RlcmtleSIpLnRyaW0oKTsKY29uc3Qga2V5PVN0cmluZyhwcm9jZXNzLmVudi5TUlZLRVl8fCIiKS50cmltKCk7CmNvbnN0IHdlYmlwPVN0cmluZyhwcm9jZXNzLmVudi5XRUJfSVB8fCIxMjcuMC4wLjEiKS50cmltKCk7CmNvbnN0IGhpc3Q9cGF0aC5qb2luKHJvb3QsImhpc3RvcmljbyIpOwpjb25zdCBhdHVhbD1wYXRoLmpvaW4ocm9vdCwicmVsYXRvcmlvX2F0dWFsLmh0bWwiKTsKY29uc3QgdG1wPXBhdGguam9pbihyb290LCJfdG1wX3JlbGF0b3Jpby5odG1sIik7CmNvbnN0IHVhPSgpPT5TdHJpbmcocHJvY2Vzcy5lbnYuVVNFUlBST0ZJTEV8fCIiKS50cmltKCk7CmNvbnN0IGRlc2tQYXRoPWQ9PnsKY29uc3QgdXA9dWEoKTsKaWYoIXVwKXJldHVybiIiOwpjb25zdCBkZD1TdHJpbmcoZC5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsIjAiKTsKY29uc3QgbW09U3RyaW5nKGQuZ2V0TW9udGgoKSsxKS5wYWRTdGFydCgyLCIwIik7CmNvbnN0IHl5PVN0cmluZyhkLmdldEZ1bGxZZWFyKCkpOwpyZXR1cm4gcGF0aC5qb2luKHVwLCJEZXNrdG9wIixgKEZEQi1ESUEpX3JlbGF0b3Jpb18ke2RkfS0ke21tfS0ke3l5fV9nZXJlbmNpYWxfcG9yX3ZlbmRlZG9yLmh0bWxgKTsKfTsKY29uc3QgaXNvRGF0ZT1kPT5gJHtkLmdldEZ1bGxZZWFyKCl9LSR7U3RyaW5nKGQuZ2V0TW9udGgoKSsxKS5wYWRTdGFydCgyLCIwIil9LSR7U3RyaW5nKGQuZ2V0RGF0ZSgpKS5wYWRTdGFydCgyLCIwIil9YDsKY29uc3Qgb2tKc29uPShyZXMsb2JqLGNvZGU9MjAwLGV4dHJhKT0+e3Jlcy53cml0ZUhlYWQoY29kZSxPYmplY3QuYXNzaWduKHsiQ29udGVudC1UeXBlIjoiYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOCIsIkNhY2hlLUNvbnRyb2wiOiJuby1zdG9yZSJ9LGV4dHJhfHx7fSkpO3Jlcy5lbmQoSlNPTi5zdHJpbmdpZnkob2JqfHx7fSkpO307CmNvbnN0IGJhZD0ocmVzLGNvZGUsbXNnKT0+e3Jlcy53cml0ZUhlYWQoY29kZSx7IkNvbnRlbnQtVHlwZSI6InRleHQvcGxhaW47IGNoYXJzZXQ9dXRmLTgiLCJDYWNoZS1Db250cm9sIjoibm8tc3RvcmUifSk7cmVzLmVuZChTdHJpbmcobXNnfHxjb2RlKSk7fTsKY29uc3QgY29ycz0oKT0+KHsiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luIjoiKiIsIkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMiOiJ4LWtleSxjb250ZW50LXR5cGUiLCJBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzIjoiR0VULFBPU1QsT1BUSU9OUyIsIkFjY2Vzcy1Db250cm9sLU1heC1BZ2UiOiI2MDAifSk7CmNvbnN0IHNlcnZlRmlsZT0ocmVzLGZwKT0+ewpmcy5zdGF0KGZwLChlLHMpPT57CmlmKGV8fCFzLmlzRmlsZSgpKXJldHVybiBiYWQocmVzLDQwNCwiNDA0Iik7CmNvbnN0IGV4dD1wYXRoLmV4dG5hbWUoZnApLnRvTG93ZXJDYXNlKCk7CnJlcy53cml0ZUhlYWQoMjAwLHsiQ29udGVudC1UeXBlIjp0eXBlc1tleHRdfHwiYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtIiwiQ2FjaGUtQ29udHJvbCI6Im5vLXN0b3JlIn0pOwpmcy5jcmVhdGVSZWFkU3RyZWFtKGZwKS5waXBlKHJlcyk7Cn0pOwp9Owpjb25zdCBnZXJhcj0obW90aXZvKT0+ewppZihzdC5ydW5uaW5nKXJldHVybiBQcm9taXNlLnJlc29sdmUoe29rOmZhbHNlLGVzdGFkbzoicnVubmluZyJ9KTsKaWYoIWZkYnx8IXNjcmlwdClyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHtvazpmYWxzZSxlc3RhZG86InNlbV9jZmcifSk7CnN0LnJ1bm5pbmc9dHJ1ZTsKc3QubGFzdF9zdGFydD1EYXRlLm5vdygpOwpzdC5sYXN0X2Vycj0iIjsKY29uc3QgZD1uZXcgRGF0ZSgpOwpjb25zdCBkYXRhSVNPPWlzb0RhdGUoZCk7CmNvbnN0IGVudj1PYmplY3QuYXNzaWduKHt9LHByb2Nlc3MuZW52LHtGREJfU1JWX0tFWTprZXksRkRCX1NSVl9CQVNFX0xPQ0FMOmBodHRwOi8vMTI3LjAuMC4xOiR7cG9ydH1gLEZEQl9TUlZfQkFTRV9SRURFOmBodHRwOi8vJHt3ZWJpcH06JHtwb3J0fWB9KTsKcmV0dXJuIG5ldyBQcm9taXNlKHJlcz0+ewppZighZnMuZXhpc3RzU3luYyhoaXN0KSlmcy5ta2RpclN5bmMoaGlzdCx7cmVjdXJzaXZlOnRydWV9KTsKY29uc3QgYXJncz1bc2NyaXB0LCItLWZkYiIsZmRiLCItLWRhdGEiLGRhdGFJU08sIi0tc2FpZGEiLHRtcCwiLS11c2VyIixkYnVzZXIsIi0tcGFzcyIsZGJwYXNzXTsKY29uc3QgcD1jcC5zcGF3bihwcm9jZXNzLmV4ZWNQYXRoLGFyZ3Mse2Vudix3aW5kb3dzSGlkZTp0cnVlfSk7CmxldCBvdXQ9IiI7CnAuc3Rkb3V0Lm9uKCJkYXRhIixiPT57b3V0Kz1TdHJpbmcoYnx8IiIpO30pOwpwLnN0ZGVyci5vbigiZGF0YSIsYj0+e291dCs9U3RyaW5nKGJ8fCIiKTt9KTsKcC5vbigiY2xvc2UiLGNvZGU9PnsKc3QucnVubmluZz1mYWxzZTsKc3QubGFzdF9lbmQ9RGF0ZS5ub3coKTsKaWYoY29kZT09PTAmJmZzLmV4aXN0c1N5bmModG1wKSl7CmNvbnN0IGRwPWRlc2tQYXRoKGQpOwpjb25zdCBkZD1TdHJpbmcoZC5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsIjAiKTsKY29uc3QgbW09U3RyaW5nKGQuZ2V0TW9udGgoKSsxKS5wYWRTdGFydCgyLCIwIik7CmNvbnN0IHl5PVN0cmluZyhkLmdldEZ1bGxZZWFyKCkpOwpjb25zdCBoaD1TdHJpbmcoZC5nZXRIb3VycygpKS5wYWRTdGFydCgyLCIwIik7CmNvbnN0IG1pPVN0cmluZyhkLmdldE1pbnV0ZXMoKSkucGFkU3RhcnQoMiwiMCIpOwpjb25zdCBoaXN0RmlsZT1wYXRoLmpvaW4oaGlzdCxgKEZEQi1ESUEpX3JlbGF0b3Jpb18ke2RkfS0ke21tfS0ke3l5fV8ke2hofS0ke21pfV9nZXJlbmNpYWxfcG9yX3ZlbmRlZG9yLmh0bWxgKTsKZnMuY29weUZpbGVTeW5jKHRtcCxhdHVhbCk7CmlmKGRwKWZzLmNvcHlGaWxlU3luYyh0bXAsZHApOwpmcy5jb3B5RmlsZVN5bmModG1wLGhpc3RGaWxlKTsKZnMudW5saW5rU3luYyh0bXApOwpzdC5sYXN0X29rPURhdGUubm93KCk7CnJlcyh7b2s6dHJ1ZSxlc3RhZG86Im9rIixtb3Rpdm8sc2FpZGFfYXR1YWw6YXR1YWx9KTsKcmV0dXJuOwp9CnN0Lmxhc3RfZXJyPW91dC5zbGljZSgtMjAwMCl8fCgiZXJybyAiK2NvZGUpOwpyZXMoe29rOmZhbHNlLGVzdGFkbzoiZXJybyIsY29kZSxlcnJvOnN0Lmxhc3RfZXJyfSk7Cn0pOwp9KTsKfTsKY29uc3QgYWdlbmRhcj0oKT0+ewppZihzdC50bSljbGVhclRpbWVvdXQoc3QudG0pOwpjb25zdCBuPW5ldyBEYXRlKCk7CmNvbnN0IG5leHQ9bmV3IERhdGUobik7Cm5leHQuc2V0U2Vjb25kcygwLDApOwppZihuLmdldE1pbnV0ZXMoKTwzMCluZXh0LnNldE1pbnV0ZXMoMzAsMCwwKTsKZWxzZSBuZXh0LnNldEhvdXJzKG4uZ2V0SG91cnMoKSsxLDAsMCwwKTsKbGV0IG1zPW5leHQuZ2V0VGltZSgpLW4uZ2V0VGltZSgpOwppZihtczwxMDAwKW1zPTEwMDA7CnN0Lm5leHRfcnVuPW5leHQuZ2V0VGltZSgpOwpzdC50bT1zZXRUaW1lb3V0KCgpPT57Z2VyYXIoImF1dG8iKS50aGVuKCgpPT5hZ2VuZGFyKCkpO30sbXMpOwp9OwphZ2VuZGFyKCk7CmNvbnN0IHNydj1odHRwLmNyZWF0ZVNlcnZlcigocmVxLHJlcyk9PnsKY29uc3QgdT11cmwucGFyc2UocmVxLnVybHx8IiIsdHJ1ZSk7CmNvbnN0IHA9U3RyaW5nKHUucGF0aG5hbWV8fCIvIik7CmlmKHJlcS5tZXRob2Q9PT0iT1BUSU9OUyIpe3Jlcy53cml0ZUhlYWQoMjA0LGNvcnMoKSk7cmVzLmVuZCgpO3JldHVybjt9CmlmKHA9PT0iL19fc3RhdHVzIiYmcmVxLm1ldGhvZD09PSJHRVQiKXtva0pzb24ocmVzLHtydW5uaW5nOnN0LnJ1bm5pbmcsbGFzdF9zdGFydDpzdC5sYXN0X3N0YXJ0LGxhc3RfZW5kOnN0Lmxhc3RfZW5kLGxhc3Rfb2s6c3QubGFzdF9vayxsYXN0X2VycjpzdC5sYXN0X2VycixuZXh0X3J1bjpzdC5uZXh0X3J1bixwb3J0fSwyMDAsY29ycygpKTtyZXR1cm47fQppZihwPT09Ii9fX2dlcmFyIiYmcmVxLm1ldGhvZD09PSJQT1NUIil7CmNvbnN0IGs9U3RyaW5nKHJlcS5oZWFkZXJzWyJ4LWtleSJdfHwiIikudHJpbSgpOwppZigha2V5fHxrIT09a2V5KXtva0pzb24ocmVzLHtvazpmYWxzZSxlc3RhZG86InVuYXV0aCJ9LDQwMSxjb3JzKCkpO3JldHVybjt9CmlmKHN0LnJ1bm5pbmcpe29rSnNvbihyZXMse29rOmZhbHNlLGVzdGFkbzoicnVubmluZyIscnVubmluZzp0cnVlLGxhc3Rfc3RhcnQ6c3QubGFzdF9zdGFydCxsYXN0X29rOnN0Lmxhc3Rfb2t9LDQwOSxjb3JzKCkpO3JldHVybjt9CmdlcmFyKCJtYW51YWwiKS50aGVuKHI9Pm9rSnNvbihyZXMsciwyMDAsY29ycygpKSk7CnJldHVybjsKfQpsZXQgcmVsPXA7CmlmKHJlbD09PSIvInx8cmVsPT09IiIpcmVsPSIvcmVsYXRvcmlvX2F0dWFsLmh0bWwiOwpyZWw9cmVsLnJlcGxhY2UoL15cLysvLCIiKTsKY29uc3QgZnA9cGF0aC5yZXNvbHZlKHBhdGguam9pbihyb290LHJlbCkpOwppZihmcC5pbmRleE9mKHJvb3QpIT09MClyZXR1cm4gYmFkKHJlcyw0MDMsIjQwMyIpOwpzZXJ2ZUZpbGUocmVzLGZwKTsKfSk7CnNydi5saXN0ZW4ocG9ydCwiMC4wLjAuMCIsKCk9Pntjb25zb2xlLmxvZygiU0VSVklET1JfT0siLHBvcnQscm9vdCk7fSk7"

powershell -NoProfile -ExecutionPolicy Bypass -Command "[IO.File]::WriteAllBytes('%SERVER%',[Convert]::FromBase64String('%B64_SERVER%'))" >> "%BATLOG%" 2>&1
if errorlevel 1 (
  >>"%BATLOG%" echo ERRO: falha ao criar server js
  if "%AUTO%"=="0" pause
  exit /b 1
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%PORTA% .*LISTENING"') do taskkill /PID %%P /F >nul 2>&1

> "%LOG%" echo INICIANDO %date% %time%

set "STARTCMD=%WEBROOT%\_start_server.cmd"
> "%STARTCMD%" echo @echo off
>>"%STARTCMD%" echo setlocal EnableExtensions
>>"%STARTCMD%" echo chcp 65001 ^>nul
>>"%STARTCMD%" echo set "FDB_FILE=%FDB%"
>>"%STARTCMD%" echo set "GEN_SCRIPT=%SCRIPT%"
>>"%STARTCMD%" echo set "DBUSER=SYSDBA"
>>"%STARTCMD%" echo set "DBPASS=masterkey"
>>"%STARTCMD%" echo set "SRVKEY=%SRVKEY%"
>>"%STARTCMD%" echo set "WEB_IP=%WEB_IP%"
>>"%STARTCMD%" echo set "PORTA=%PORTA%"
>>"%STARTCMD%" echo "%NODE_EXE%" "%SERVER%" "%WEBROOT%" %PORTA% ^>^> "%LOG%" 2^>^&1
attrib +h +s "%STARTCMD%" >nul 2>&1

set "RUNVBS=%WEBROOT%\_run_hidden.vbs"
> "%RUNVBS%" echo Set sh=CreateObject("WScript.Shell")
>>"%RUNVBS%" echo sh.Run "cmd.exe /c ""call """"%STARTCMD%""""""", 0, False
attrib +h +s "%RUNVBS%" >nul 2>&1
wscript.exe "%RUNVBS%"

set "OK="
for /l %%T in (1,1,8) do (
  netstat -ano | findstr /r /c:":%PORTA% .*LISTENING" >nul && (set "OK=1" & goto ok)
  timeout /t 1 >nul
)

if not defined OK (
  >>"%BATLOG%" echo ERRO: servidor nao subiu na porta %PORTA%
  if "%AUTO%"=="0" (
    type "%LOG%"
    pause
  )
  exit /b 1
)

:ok
>>"%BATLOG%" echo SERVIDOR_OK
if "%AUTO%"=="0" (
  start "" "%OUT%"
)
exit /b 0

:instalar
powershell -NoProfile -ExecutionPolicy Bypass -Command "$lnk=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup\FDB_Relatorio_Web.lnk'; $w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut($lnk); $s.TargetPath='%~f0'; $s.Arguments='--auto'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=7; $s.Save()" >nul
if "%AUTO%"=="0" (
  echo Instalado na inicializacao.
  echo Link rede: http://%WEB_IP%:%PORTA%/
  pause
)
exit /b 0

:remover
del /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\FDB_Relatorio_Web.lnk" >nul 2>&1
if "%AUTO%"=="0" (
  echo Removido da inicializacao.
  pause
)
exit /b 0
