@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "PORTA=8000"
set "WEBROOT=%LOCALAPPDATA%\FDB_REL_WEB"
set "HIST=%WEBROOT%\historico"
set "ATUAL=%WEBROOT%\relatorio_atual.html"
set "SERVER=%WEBROOT%\_server_fdb_rel.js"
set "GENSCRIPTFILE=%WEBROOT%\_gen_script.txt"
set "LOG=%WEBROOT%\server.log"
set "BATLOG=%WEBROOT%\bat.log"
set "KEYFILE=%WEBROOT%\_srv.key"
set "PROIB=%WEBROOT%\_proibidos.txt"
set "PROIB_BAK=%WEBROOT%\_proibidos.bak"
set "AUTO=0"
if /i "%~1"=="--auto" set "AUTO=1"
if /i "%~1"=="--instalar" goto instalar
if /i "%~1"=="--remover" goto remover
if not exist "%WEBROOT%" mkdir "%WEBROOT%" >nul 2>&1
if not exist "%HIST%" mkdir "%HIST%" >nul 2>&1
if not exist "%PROIB%" type nul > "%PROIB%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$max=1000KB;$min=(Get-Date).AddDays(-7);$f='%BATLOG%';if(Test-Path -LiteralPath $f){$raw=Get-Content -LiteralPath $f -Raw -ErrorAction SilentlyContinue;$parts=[regex]::Split([string]$raw,'(?m)(?=^INICIO )')|Where-Object{$_};$keep=New-Object System.Collections.Generic.List[string];foreach($c in $parts){if($c -match '(?m)^INICIO (\d{2})/(\d{2})/(\d{4})'){try{$dt=Get-Date -Day $matches[1] -Month $matches[2] -Year $matches[3];if($dt -ge $min){$keep.Add($c)}}catch{$keep.Add($c)}}else{$keep.Add($c)}};$txt=($keep -join '');while([Text.Encoding]::UTF8.GetByteCount($txt) -gt $max -and $keep.Count -gt 1){$keep.RemoveAt(0);$txt=($keep -join '')};Set-Content -LiteralPath $f -Value $txt -Encoding UTF8}" >nul 2>&1
attrib +h "%WEBROOT%" >nul 2>&1
set "NODE_EXE="
for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
if not defined NODE_EXE (
  >"%BATLOG%" echo ERRO: node nao encontrado no PATH
  if "%AUTO%"=="0" pause
  exit /b 1
)
set "WEB_IP="
for /f "delims=" %%I in ('powershell -NoProfile -Command "$r=Get-NetRoute -AddressFamily IPv4 ^| Where-Object { $_.DestinationPrefix -eq ''0.0.0.0/0'' -and $_.NextHop -ne ''0.0.0.0'' } ^| Sort-Object RouteMetric,InterfaceMetric ^| Select-Object -First 1; if($r){ Get-NetIPAddress -InterfaceIndex $r.InterfaceIndex -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -notlike ''169.254*'' -and $_.IPAddress -ne ''127.0.0.1'' } ^| Select-Object -First 1 -ExpandProperty IPAddress }" 2^>nul') do if not defined WEB_IP set "WEB_IP=%%I"
if not defined WEB_IP for /f "delims=" %%I in ('powershell -NoProfile -Command "$c=Get-NetIPConfiguration ^| Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq ''Up'' -and $_.IPv4Address -and $_.InterfaceAlias -notmatch ''VMware|WARP|VirtualBox|Hyper-V|vEthernet'' } ^| Select-Object -First 1; if($c){ $c.IPv4Address.IPAddress }" 2^>nul') do if not defined WEB_IP set "WEB_IP=%%I"
if not defined WEB_IP for /f "delims=" %%I in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -notlike ''169.254*'' -and $_.IPAddress -ne ''127.0.0.1'' } ^| Select-Object -First 1 -ExpandProperty IPAddress)" 2^>nul') do if not defined WEB_IP set "WEB_IP=%%I"
if not defined WEB_IP set "WEB_IP=127.0.0.1"
set "REDE_HOST=%WEB_IP%"
if /i "%REDE_HOST%"=="127.0.0.1" set "REDE_HOST=%COMPUTERNAME%"
if not exist "%KEYFILE%" powershell -NoProfile -ExecutionPolicy Bypass -Command "[guid]::NewGuid().ToString('N')" > "%KEYFILE%"
set "SRVKEY="
for /f "usebackq delims=" %%K in ("%KEYFILE%") do if not defined SRVKEY set "SRVKEY=%%K"
if not defined SRVKEY (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "[guid]::NewGuid().ToString('N')" > "%KEYFILE%"
  for /f "usebackq delims=" %%K in ("%KEYFILE%") do if not defined SRVKEY set "SRVKEY=%%K"
)
attrib +h +s "%KEYFILE%" >nul 2>&1
set "FDB="
for %%P in ("%ProgramFiles(x86)%\SmallSoft\Small Commerce\SMALL.FDB" "%ProgramFiles%\SmallSoft\Small Commerce\SMALL.FDB" "%ProgramData%\SmallSoft\Small Commerce\SMALL.FDB") do if not defined FDB if exist "%%~fP" set "FDB=%%~fP"
if not defined FDB for /f "delims=" %%F in ('where /r "%ProgramFiles(x86)%" SMALL.FDB 2^>nul') do if not defined FDB set "FDB=%%F"
if not defined FDB for /f "delims=" %%F in ('where /r "%ProgramFiles%" SMALL.FDB 2^>nul') do if not defined FDB set "FDB=%%F"
if not defined FDB (
  >"%BATLOG%" echo ERRO: SMALL.FDB nao encontrado
  if "%AUTO%"=="0" pause
  exit /b 1
)
set "SCRIPT="
for %%P in ("%~dp0gerar-relatorio-html.js" "%~dp0\gerar-relatorio-html.js" "%userprofile%\desktop\REL\gerar-relatorio-html.js" "%userprofile%\desktop\gerar-relatorio-html.js" "%userprofile%\documents\gerar-relatorio-html.js" "%userprofile%\downloads\gerar-relatorio-html.js") do if not defined SCRIPT if exist "%%~fP" set "SCRIPT=%%~fP"
if not defined SCRIPT for /f "delims=" %%F in ('where /r "%~dp0" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
if not defined SCRIPT for %%D in (C D E F G H I J K L M N O P Q R S T U V W X Y Z) do (
  if not defined SCRIPT if exist "%%D:\\" (
    for /f "delims=" %%F in ('where /r "%%D:\\" gerar-relatorio-html.js 2^>nul') do if not defined SCRIPT set "SCRIPT=%%F"
  )
)
if not defined SCRIPT (
  >>"%BATLOG%" echo AVISO: gerar-relatorio-html.js nao encontrado. O servidor ira buscar automaticamente.
)
set "SRV_SRC="
for %%P in ("%~dp0\_server_fdb_rel.js" "%~dp0_server_fdb_rel.js" "%WEBROOT%\_server_fdb_rel.js" "%userprofile%\desktop\_server_fdb_rel.js" "%userprofile%\documents\_server_fdb_rel.js" "%userprofile%\downloads\_server_fdb_rel.js") do if not defined SRV_SRC if exist "%%~fP" set "SRV_SRC=%%~fP"
if not defined SRV_SRC for /f "delims=" %%F in ('where /r "%~dp0" _server_fdb_rel.js 2^>nul') do if not defined SRV_SRC set "SRV_SRC=%%F"
if not defined SRV_SRC call :criar_server
if not defined SRV_SRC (
  >"%BATLOG%" echo ERRO: _server_fdb_rel.js nao encontrado e nao foi possivel criar no WEBROOT
  if "%AUTO%"=="0" pause
  exit /b 1
)
if /i not "%SRV_SRC%"=="%SERVER%" copy /y "%SRV_SRC%" "%SERVER%" >nul 2>&1
attrib +h +s "%SERVER%" >nul 2>&1
> "%BATLOG%" echo INICIO %date% %time%
>>"%BATLOG%" echo WEBROOT=%WEBROOT%
>>"%BATLOG%" echo PORTA=%PORTA%
>>"%BATLOG%" echo IP=%WEB_IP%
>>"%BATLOG%" echo HOST_REDE=%REDE_HOST%
>>"%BATLOG%" echo NODE=%NODE_EXE%
>>"%BATLOG%" echo FDB=%FDB%
>>"%BATLOG%" echo SCRIPT=%SCRIPT%
>>"%BATLOG%" echo GENSCRIPTFILE=%GENSCRIPTFILE%
>>"%BATLOG%" echo SERVER=%SERVER%
attrib +h +s "%BATLOG%" "%LOG%" >nul 2>&1
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set "DATA=%%i"
for /f "tokens=1-3 delims=-" %%a in ("%DATA%") do (set "YYYY=%%a" & set "MM=%%b" & set "DD=%%c")
set "DATA_ARQ=%DD%-%MM%-%YYYY%"
set "OUT=%ATUAL%"
set "FDB_SRV_KEY=%SRVKEY%"
set "FDB_SRV_BASE_LOCAL=http://127.0.0.1:%PORTA%"
set "FDB_SRV_BASE_REDE=http://%REDE_HOST%:%PORTA%"
copy /y "%PROIB%" "%PROIB_BAK%" >nul 2>&1
cd /d "%~dp0"
"%NODE_EXE%" "%SCRIPT%" --fdb "%FDB%" --data "%DATA%" --saida "%OUT%" --user SYSDBA --pass masterkey >> "%BATLOG%" 2>&1
if errorlevel 1 (
  >>"%BATLOG%" echo ERRO: falha ao gerar relatorio
  if "%AUTO%"=="0" pause
  exit /b 1
)
if exist "%PROIB_BAK%" powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='%PROIB%';$b='%PROIB_BAK%';$a=@();if(Test-Path $b){$a+=Get-Content -LiteralPath $b -Encoding UTF8};$c=@();if(Test-Path $p){$c+=Get-Content -LiteralPath $p -Encoding UTF8};$seen=@{};$out=@();foreach($l in ($a+$c)){$n=([string]$l).Trim().ToUpper();$n=$n -replace '\s+',' ';if($n -and -not $seen.ContainsKey($n)){$seen[$n]=$true;$out+=$n}};Set-Content -LiteralPath $p -Value $out -Encoding UTF8" >nul 2>&1
del /q "%PROIB_BAK%" >nul 2>&1
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format HH-mm"') do set "HHMM=%%t"
copy /y "%OUT%" "%HIST%\(FDB-DIA)_relatorio_%DATA_ARQ%_%HHMM%.html" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -LiteralPath '%HIST%' -File -Filter '*.html' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -Skip 3 | Remove-Item -Force -ErrorAction SilentlyContinue" >nul 2>&1
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%PORTA% .*LISTENING"') do taskkill /PID %%P /F >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and ($_.CommandLine -like '*_srv_loop.cmd*' -or $_.CommandLine -like '*_start_server.cmd*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
> "%LOG%" echo INICIANDO %date% %time%
set "SRVLOOP=%WEBROOT%\_srv_loop.cmd"
> "%SRVLOOP%" echo @echo off
>>"%SRVLOOP%" echo setlocal EnableExtensions
>>"%SRVLOOP%" echo chcp 65001 ^>nul
>>"%SRVLOOP%" echo title FDB_REL_SRV
>>"%SRVLOOP%" echo set "FDB_FILE=%FDB%"
>>"%SRVLOOP%" echo set "GEN_SCRIPT=%SCRIPT%"
>>"%SRVLOOP%" echo set "GEN_SCRIPT_FILE=%GENSCRIPTFILE%"
>>"%SRVLOOP%" echo set "DBUSER=SYSDBA"
>>"%SRVLOOP%" echo set "DBPASS=masterkey"
>>"%SRVLOOP%" echo set "SRVKEY=%SRVKEY%"
>>"%SRVLOOP%" echo set "WEB_IP=%REDE_HOST%"
>>"%SRVLOOP%" echo set "PORTA=%PORTA%"
>>"%SRVLOOP%" echo set "LOG_FILE=%LOG%"
>>"%SRVLOOP%" echo :loop
>>"%SRVLOOP%" echo "%NODE_EXE%" "%SERVER%" "%WEBROOT%" %PORTA%
>>"%SRVLOOP%" echo timeout /t 2 /nobreak ^>nul
>>"%SRVLOOP%" echo goto loop
attrib +h +s "%SRVLOOP%" >nul 2>&1
set "RUNVBS=%WEBROOT%\_run_hidden.vbs"
> "%RUNVBS%" echo Set sh=CreateObject("WScript.Shell")
>>"%RUNVBS%" echo sh.Run "cmd.exe /c ""call """"%SRVLOOP%""""""", 0, False
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
if "%AUTO%"=="0" start "" "http://127.0.0.1:%PORTA%/"
exit /b 0
:criar_server
set "B64=%WEBROOT%\_server_fdb_rel.b64"
> "%B64%" echo Y29uc3QgaHR0cD1yZXF1aXJlKCJodHRwIiksZnM9cmVxdWlyZSgiZnMiKSxwYXRoPXJlcXVp
>>"%B64%" echo cmUoInBhdGgiKSxjcD1yZXF1aXJlKCJjaGlsZF9wcm9jZXNzIik7CmNvbnN0IHJvb3Q9cGF0
>>"%B64%" echo aC5yZXNvbHZlKHByb2Nlc3MuYXJndlsyXXx8cHJvY2Vzcy5jd2QoKSk7CmNvbnN0IHBvcnQ9
>>"%B64%" echo cGFyc2VJbnQocHJvY2Vzcy5hcmd2WzNdfHxwcm9jZXNzLmVudi5QT1JUQXx8IjgwMDAiLDEw
>>"%B64%" echo KTsKY29uc3QgdHlwZXM9eyIuaHRtbCI6InRleHQvaHRtbDsgY2hhcnNldD11dGYtOCIsIi5j
>>"%B64%" echo c3MiOiJ0ZXh0L2NzczsgY2hhcnNldD11dGYtOCIsIi5qcyI6ImFwcGxpY2F0aW9uL2phdmFz
>>"%B64%" echo Y3JpcHQ7IGNoYXJzZXQ9dXRmLTgiLCIuanNvbiI6ImFwcGxpY2F0aW9uL2pzb247IGNoYXJz
>>"%B64%" echo ZXQ9dXRmLTgiLCIucG5nIjoiaW1hZ2UvcG5nIiwiLmpwZyI6ImltYWdlL2pwZWciLCIuanBl
>>"%B64%" echo ZyI6ImltYWdlL2pwZWciLCIuc3ZnIjoiaW1hZ2Uvc3ZnK3htbCIsIi5pY28iOiJpbWFnZS94
>>"%B64%" echo LWljb24iLCIudHh0IjoidGV4dC9wbGFpbjsgY2hhcnNldD11dGYtOCJ9Owpjb25zdCBzdD17
>>"%B64%" echo cnVubmluZzpmYWxzZSxsYXN0X3N0YXJ0OjAsbGFzdF9lbmQ6MCxsYXN0X29rOjAsbGFzdF9l
>>"%B64%" echo cnI6IiIsbmV4dF9ydW46MCx0bTpudWxsfTsKY29uc3QgZmRiPVN0cmluZyhwcm9jZXNzLmVu
>>"%B64%" echo di5GREJfRklMRXx8IiIpLnRyaW0oKTsKY29uc3QgZGJ1c2VyPVN0cmluZyhwcm9jZXNzLmVu
>>"%B64%" echo di5EQlVTRVJ8fCJTWVNEQkEiKS50cmltKCk7CmNvbnN0IGRicGFzcz1TdHJpbmcocHJvY2Vz
>>"%B64%" echo cy5lbnYuREJQQVNTfHwibWFzdGVya2V5IikudHJpbSgpOwpjb25zdCBrZXk9U3RyaW5nKHBy
>>"%B64%" echo b2Nlc3MuZW52LlNSVktFWXx8IiIpLnRyaW0oKTsKY29uc3Qgd2ViaXA9U3RyaW5nKHByb2Nl
>>"%B64%" echo c3MuZW52LldFQl9JUHx8IjEyNy4wLjAuMSIpLnRyaW0oKTsKY29uc3QgaGlzdD1wYXRoLmpv
>>"%B64%" echo aW4ocm9vdCwiaGlzdG9yaWNvIik7CmNvbnN0IGF0dWFsPXBhdGguam9pbihyb290LCJyZWxh
>>"%B64%" echo dG9yaW9fYXR1YWwuaHRtbCIpOwpjb25zdCB0bXA9cGF0aC5qb2luKHJvb3QsIl90bXBfcmVs
>>"%B64%" echo YXRvcmlvLmh0bWwiKTsKY29uc3QgY29uZlNjcmlwdD1wYXRoLmpvaW4ocm9vdCwiX2dlbl9z
>>"%B64%" echo Y3JpcHQudHh0Iik7CmNvbnN0IGxvZ0ZpbGU9U3RyaW5nKHByb2Nlc3MuZW52LkxPR19GSUxF
>>"%B64%" echo fHxwYXRoLmpvaW4ocm9vdCwic2VydmVyLmxvZyIpKS50cmltKCk7CmNvbnN0IE1BWF9MT0df
>>"%B64%" echo QllURVM9MTAwMCoxMDI0Owpjb25zdCBNQVhfTE9HX0FHRT03KjI0KjYwKjYwKjEwMDA7CmNv
>>"%B64%" echo bnN0IE1TMTU9MTUqNjAqMTAwMDsKY29uc3QgdWE9KCk9PlN0cmluZyhwcm9jZXNzLmVudi5V
>>"%B64%" echo U0VSUFJPRklMRXx8IiIpLnRyaW0oKTsKY29uc3QgZW5zdXJlRGlyPXA9PntpZighZnMuZXhp
>>"%B64%" echo c3RzU3luYyhwKSlmcy5ta2RpclN5bmMocCx7cmVjdXJzaXZlOnRydWV9KTt9Owpjb25zdCBw
>>"%B64%" echo cm9pYkZpbGU9cGF0aC5qb2luKHJvb3QsIl9wcm9pYmlkb3MudHh0Iik7CmNvbnN0IG5vcm1Q
>>"%B64%" echo PXM9PlN0cmluZyhzfHwiIikudHJpbSgpLnRvVXBwZXJDYXNlKCkucmVwbGFjZSgvXHMrL2cs
>>"%B64%" echo IiAiKTsKY29uc3QgdW5pcT1hPT5bLi4ubmV3IFNldCgoYXx8W10pLmZpbHRlcihCb29sZWFu
>>"%B64%" echo KSldOwpjb25zdCBwYXJzZUxpc3RhPXM9PnVuaXEoU3RyaW5nKHN8fCIiKS5zcGxpdCgvXG58
>>"%B64%" echo LC9nKS5tYXAobm9ybVApLmZpbHRlcihCb29sZWFuKSk7CmNvbnN0IGxlclByb2liPWNiPT57
>>"%B64%" echo ZnMucmVhZEZpbGUocHJvaWJGaWxlLCJ1dGY4IiwoZSx0eHQpPT57Y2IocGFyc2VMaXN0YShl
>>"%B64%" echo PyIiOnR4dCkpO30pO307CmNvbnN0IHNhbHZhclByb2liPShhcnIsY2IpPT57ZnMud3JpdGVG
>>"%B64%" echo aWxlKHByb2liRmlsZSx1bmlxKGFycikubWFwKG5vcm1QKS5maWx0ZXIoQm9vbGVhbikuam9p
>>"%B64%" echo bigiXG4iKSwidXRmOCIsKCk9PntjYiYmY2IoKTt9KTt9OwpsZXQgcmVxSWQ9MDsKY29uc3Qg
>>"%B64%" echo c3RhbXA9KCk9Pntjb25zdCBkPW5ldyBEYXRlKCk7cmV0dXJuIGAke2QuZ2V0RnVsbFllYXIo
>>"%B64%" echo KX0tJHtTdHJpbmcoZC5nZXRNb250aCgpKzEpLnBhZFN0YXJ0KDIsIjAiKX0tJHtTdHJpbmco
>>"%B64%" echo ZC5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsIjAiKX0gJHtTdHJpbmcoZC5nZXRIb3VycygpKS5w
>>"%B64%" echo YWRTdGFydCgyLCIwIil9OiR7U3RyaW5nKGQuZ2V0TWludXRlcygpKS5wYWRTdGFydCgyLCIw
>>"%B64%" echo Iil9OiR7U3RyaW5nKGQuZ2V0U2Vjb25kcygpKS5wYWRTdGFydCgyLCIwIil9YDt9Owpjb25z
>>"%B64%" echo dCBmbGF0PXM9PlN0cmluZyhzfHwiIikucmVwbGFjZSgvXHMrL2csIiAiKS50cmltKCk7CmNv
>>"%B64%" echo bnN0IHRhaWw9cz0+e3M9ZmxhdChzKTtyZXR1cm4gcy5sZW5ndGg+MTIwMD9zLnNsaWNlKC0x
>>"%B64%" echo MjAwKTpzO307CmNvbnN0IGxpbmVUcz1saW5lPT57Y29uc3QgbT1TdHJpbmcobGluZXx8IiIp
>>"%B64%" echo Lm1hdGNoKC9eXFsoXGR7NH0pLShcZHsyfSktKFxkezJ9KSAoXGR7Mn0pOihcZHsyfSk6KFxk
>>"%B64%" echo ezJ9KVxdLyk7cmV0dXJuIG0/bmV3IERhdGUoTnVtYmVyKG1bMV0pLE51bWJlcihtWzJdKS0x
>>"%B64%" echo LE51bWJlcihtWzNdKSxOdW1iZXIobVs0XSksTnVtYmVyKG1bNV0pLE51bWJlcihtWzZdKSku
>>"%B64%" echo Z2V0VGltZSgpOjA7fTsKY29uc3QgdHJpbUxvZ1RleHQ9dHh0PT57bGV0IGxpbmVzPVN0cmlu
>>"%B64%" echo Zyh0eHR8fCIiKS5yZXBsYWNlKC9cci9nLCIiKS5zcGxpdCgiXG4iKTtpZihsaW5lcy5sZW5n
>>"%B64%" echo dGgmJmxpbmVzW2xpbmVzLmxlbmd0aC0xXT09PSIiKWxpbmVzLnBvcCgpO2NvbnN0IG1pbj1E
>>"%B64%" echo YXRlLm5vdygpLU1BWF9MT0dfQUdFO2xpbmVzPWxpbmVzLmZpbHRlcihsaW5lPT57Y29uc3Qg
>>"%B64%" echo dHM9bGluZVRzKGxpbmUpO3JldHVybiAhdHN8fHRzPj1taW47fSk7aWYoIWxpbmVzLmxlbmd0
>>"%B64%" echo aClyZXR1cm4iIjtsZXQgb3V0PWxpbmVzLmpvaW4oIlxuIikrIlxuIjt3aGlsZShCdWZmZXIu
>>"%B64%" echo Ynl0ZUxlbmd0aChvdXQsInV0ZjgiKT5NQVhfTE9HX0JZVEVTJiZsaW5lcy5sZW5ndGg+MSl7
>>"%B64%" echo bGluZXMuc2hpZnQoKTtvdXQ9bGluZXMuam9pbigiXG4iKSsiXG4iO31pZihCdWZmZXIuYnl0
>>"%B64%" echo ZUxlbmd0aChvdXQsInV0ZjgiKT5NQVhfTE9HX0JZVEVTKW91dD1vdXQuc2xpY2UoLU1BWF9M
>>"%B64%" echo T0dfQllURVMpO3JldHVybiBvdXQ7fTsKY29uc3Qgd3JpdGVMb2dMaW5lPWxpbmU9PntpZigh
>>"%B64%" echo bG9nRmlsZSl7cHJvY2Vzcy5zdGRvdXQud3JpdGUobGluZSsiXG4iKTtyZXR1cm47fWxldCBw
>>"%B64%" echo cmV2PSIiO3RyeXtpZihmcy5leGlzdHNTeW5jKGxvZ0ZpbGUpKXByZXY9ZnMucmVhZEZpbGVT
>>"%B64%" echo eW5jKGxvZ0ZpbGUsInV0ZjgiKTt9Y2F0Y2h7fWNvbnN0IG5leHQ9dHJpbUxvZ1RleHQocHJl
>>"%B64%" echo ditsaW5lKyJcbiIpO3RyeXtmcy53cml0ZUZpbGVTeW5jKGxvZ0ZpbGUsbmV4dCwidXRmOCIp
>>"%B64%" echo O31jYXRjaHtwcm9jZXNzLnN0ZG91dC53cml0ZShsaW5lKyJcbiIpO319Owpjb25zdCBpbml0
>>"%B64%" echo TG9nPSgpPT57aWYoIWxvZ0ZpbGUpcmV0dXJuO2xldCBwcmV2PSIiO3RyeXtpZihmcy5leGlz
>>"%B64%" echo dHNTeW5jKGxvZ0ZpbGUpKXByZXY9ZnMucmVhZEZpbGVTeW5jKGxvZ0ZpbGUsInV0ZjgiKTt9
>>"%B64%" echo Y2F0Y2h7fXRyeXtmcy53cml0ZUZpbGVTeW5jKGxvZ0ZpbGUsdHJpbUxvZ1RleHQocHJldiks
>>"%B64%" echo InV0ZjgiKTt9Y2F0Y2h7fX07CmNvbnN0IGxvZz0odGFnLG1zZyk9PndyaXRlTG9nTGluZShg
>>"%B64%" echo WyR7c3RhbXAoKX1dICR7dGFnfSR7bXNnPyIgIittc2c6IiJ9YCk7CmNvbnN0IHJpcD1yZXE9
>>"%B64%" echo PntsZXQgaXA9U3RyaW5nKHJlcS5oZWFkZXJzWyJ4LWZvcndhcmRlZC1mb3IiXXx8cmVxLnNv
>>"%B64%" echo Y2tldCYmcmVxLnNvY2tldC5yZW1vdGVBZGRyZXNzfHwiIikuc3BsaXQoIiwiKVswXS50cmlt
>>"%B64%" echo KCk7aWYoaXAuc3RhcnRzV2l0aCgiOjpmZmZmOiIpKWlwPWlwLnNsaWNlKDcpO3JldHVybiBp
>>"%B64%" echo cHx8Ii0iO307CmNvbnN0IHJ1YT1yZXE9Pntjb25zdCB2PWZsYXQocmVxLmhlYWRlcnNbInVz
>>"%B64%" echo ZXItYWdlbnQiXXx8IiIpO3JldHVybiB2Lmxlbmd0aD4xODA/di5zbGljZSgwLDE4MCk6djt9
>>"%B64%" echo Owpjb25zdCBleGlzdGU9cD0+e3RyeXtyZXR1cm4gISFwJiZmcy5leGlzdHNTeW5jKHApJiZm
>>"%B64%" echo cy5zdGF0U3luYyhwKS5pc0ZpbGUoKTt9Y2F0Y2h7cmV0dXJuIGZhbHNlO319Owpjb25zdCBs
>>"%B64%" echo ZXJDb25mU2NyaXB0PSgpPT57dHJ5e3JldHVybiBTdHJpbmcoZnMucmVhZEZpbGVTeW5jKGNv
>>"%B64%" echo bmZTY3JpcHQsInV0ZjgiKXx8IiIpLnRyaW0oKTt9Y2F0Y2h7cmV0dXJuICIiO319OwpsZXQg
>>"%B64%" echo c2NyaXB0R2xvYmFsPSIiOwpsZXQgYnVzY2FHbG9iYWxFbUN1cnNvPWZhbHNlOwpjb25zdCBi
>>"%B64%" echo dXNjYXJTY3JpcHRHbG9iYWw9KCk9PnsKaWYoYnVzY2FHbG9iYWxFbUN1cnNvKXJldHVybjsK
>>"%B64%" echo YnVzY2FHbG9iYWxFbUN1cnNvPXRydWU7CmNvbnN0IGRyaXZlcz1bXTsKZm9yKGxldCBjPTY1
>>"%B64%" echo O2M8PTkwO2MrKyl7Y29uc3QgZD1TdHJpbmcuZnJvbUNoYXJDb2RlKGMpKyI6XFwiO3RyeXtp
>>"%B64%" echo Zihmcy5leGlzdHNTeW5jKGQpKWRyaXZlcy5wdXNoKGQpO31jYXRjaHt9fQpjb25zdCBub21l
>>"%B64%" echo PSJnZXJhci1yZWxhdG9yaW8taHRtbC5qcyI7CmxldCBpPTA7CmNvbnN0IHRyeU5leHQ9KCk9
>>"%B64%" echo PnsKaWYoc2NyaXB0R2xvYmFsfHxpPj1kcml2ZXMubGVuZ3RoKXtidXNjYUdsb2JhbEVtQ3Vy
>>"%B64%" echo c289ZmFsc2U7cmV0dXJuO30KY29uc3QgZHJ2PWRyaXZlc1tpKytdOwpjb25zdCBjbWQ9cHJv
>>"%B64%" echo Y2Vzcy5wbGF0Zm9ybT09PSJ3aW4zMiI/YHdoZXJlIC9yICIke2Rydn0iICR7bm9tZX0gMj5u
>>"%B64%" echo dWxgOmBmaW5kICIke2Rydn0iIC1uYW1lICIke25vbWV9IiAyPi9kZXYvbnVsbGA7CmNwLmV4
>>"%B64%" echo ZWMoY21kLHt0aW1lb3V0OjYwMDAwLHdpbmRvd3NIaWRlOnRydWV9LChlcnIsc3Rkb3V0KT0+
>>"%B64%" echo ewppZighc2NyaXB0R2xvYmFsKXsKY29uc3QgZm91bmQ9U3RyaW5nKHN0ZG91dHx8IiIpLnJl
>>"%B64%" echo cGxhY2UoL1xyL2csIiIpLnNwbGl0KCJcbiIpLm1hcChzPT5zLnRyaW0oKSkuZmlsdGVyKHM9
>>"%B64%" echo PnMmJnMudG9Mb3dlckNhc2UoKS5lbmRzV2l0aChub21lKSYmZXhpc3RlKHMpKVswXXx8IiI7
>>"%B64%" echo CmlmKGZvdW5kKXtzY3JpcHRHbG9iYWw9Zm91bmQ7bG9nKCJTQ1JJUFRfR0xPQkFMIixgZHJp
>>"%B64%" echo dmU9JHtkcnZ9IHNjcmlwdD0iJHtmb3VuZH0iYCk7fQp9CnRyeU5leHQoKTsKfSk7Cn07CnRy
>>"%B64%" echo eU5leHQoKTsKfTsKY29uc3QgcmVzb2x2ZXJTY3JpcHQ9KCk9PnsKY29uc3QgdXA9dWEoKTsK
>>"%B64%" echo Y29uc3QgZW52UGF0aD1TdHJpbmcocHJvY2Vzcy5lbnYuR0VOX1NDUklQVHx8IiIpLnRyaW0o
>>"%B64%" echo KTsKY29uc3QgY29uZlBhdGg9bGVyQ29uZlNjcmlwdCgpOwpjb25zdCBjYW5kPVsKZW52UGF0
>>"%B64%" echo aCwKY29uZlBhdGgsCnVwP3BhdGguam9pbih1cCwiRGVza3RvcCIsIlJFTCIsImdlcmFyLXJl
>>"%B64%" echo bGF0b3Jpby1odG1sLmpzIik6IiIsCnVwP3BhdGguam9pbih1cCwiRGVza3RvcCIsImdlcmFy
>>"%B64%" echo LXJlbGF0b3Jpby1odG1sLmpzIik6IiIsCnVwP3BhdGguam9pbih1cCwiRG9jdW1lbnRzIiwi
>>"%B64%" echo Z2VyYXItcmVsYXRvcmlvLWh0bWwuanMiKToiIiwKdXA/cGF0aC5qb2luKHVwLCJEb3dubG9h
>>"%B64%" echo ZHMiLCJnZXJhci1yZWxhdG9yaW8taHRtbC5qcyIpOiIiLApwYXRoLmpvaW4ocHJvY2Vzcy5j
>>"%B64%" echo d2QoKSwiZ2VyYXItcmVsYXRvcmlvLWh0bWwuanMiKSwKcGF0aC5qb2luKHJvb3QsImdlcmFy
>>"%B64%" echo LXJlbGF0b3Jpby1odG1sLmpzIiksCnNjcmlwdEdsb2JhbApdLmZpbHRlcihCb29sZWFuKTsK
>>"%B64%" echo Zm9yKGNvbnN0IHAgb2YgY2FuZCkgaWYoZXhpc3RlKHApKSByZXR1cm4gcDsKcmV0dXJuIGVu
>>"%B64%" echo dlBhdGh8fGNvbmZQYXRofHxzY3JpcHRHbG9iYWx8fCIiOwp9Owpjb25zdCBpc29EYXRlPWQ9
>>"%B64%" echo PmAke2QuZ2V0RnVsbFllYXIoKX0tJHtTdHJpbmcoZC5nZXRNb250aCgpKzEpLnBhZFN0YXJ0
>>"%B64%" echo KDIsIjAiKX0tJHtTdHJpbmcoZC5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsIjAiKX1gOwpjb25z
>>"%B64%" echo dCBva0pzb249KHJlcyxvYmosY29kZT0yMDAsZXh0cmEpPT57cmVzLndyaXRlSGVhZChjb2Rl
>>"%B64%" echo LE9iamVjdC5hc3NpZ24oeyJDb250ZW50LVR5cGUiOiJhcHBsaWNhdGlvbi9qc29uOyBjaGFy
>>"%B64%" echo c2V0PXV0Zi04IiwiQ2FjaGUtQ29udHJvbCI6Im5vLXN0b3JlIn0sZXh0cmF8fHt9KSk7cmVz
>>"%B64%" echo LmVuZChKU09OLnN0cmluZ2lmeShvYmp8fHt9KSk7fTsKY29uc3QgYmFkPShyZXMsY29kZSxt
>>"%B64%" echo c2cpPT57cmVzLndyaXRlSGVhZChjb2RlLHsiQ29udGVudC1UeXBlIjoidGV4dC9wbGFpbjsg
>>"%B64%" echo Y2hhcnNldD11dGYtOCIsIkNhY2hlLUNvbnRyb2wiOiJuby1zdG9yZSJ9KTtyZXMuZW5kKFN0
>>"%B64%" echo cmluZyhtc2d8fGNvZGUpKTt9Owpjb25zdCBjb3JzPSgpPT4oeyJBY2Nlc3MtQ29udHJvbC1B
>>"%B64%" echo bGxvdy1PcmlnaW4iOiIqIiwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyI6Ingta2V5
>>"%B64%" echo LHgtZGF0YS1pbmljaW8seC1kYXRhLWZpbSxjb250ZW50LXR5cGUiLCJBY2Nlc3MtQ29udHJv
>>"%B64%" echo bC1BbGxvdy1NZXRob2RzIjoiR0VULFBPU1QsT1BUSU9OUyIsIkFjY2Vzcy1Db250cm9sLU1h
>>"%B64%" echo eC1BZ2UiOiI2MDAifSk7CmNvbnN0IHNlcnZlRmlsZT0ocmVzLGZwKT0+e2ZzLnN0YXQoZnAs
>>"%B64%" echo KGUscyk9PntpZihlfHwhcy5pc0ZpbGUoKSlyZXR1cm4gYmFkKHJlcyw0MDQsIjQwNCIpO2Nv
>>"%B64%" echo bnN0IGV4dD1wYXRoLmV4dG5hbWUoZnApLnRvTG93ZXJDYXNlKCk7cmVzLndyaXRlSGVhZCgy
>>"%B64%" echo MDAseyJDb250ZW50LVR5cGUiOnR5cGVzW2V4dF18fCJhcHBsaWNhdGlvbi9vY3RldC1zdHJl
>>"%B64%" echo YW0iLCJDYWNoZS1Db250cm9sIjoibm8tc3RvcmUifSk7ZnMuY3JlYXRlUmVhZFN0cmVhbShm
>>"%B64%" echo cCkucGlwZShyZXMpO30pO307CmNvbnN0IGNsZWFuSGlzdCA9IGQgPT4gewogICAgZW5zdXJl
>>"%B64%" echo RGlyKGhpc3QpOwogICAgZnMucmVhZGRpcihoaXN0LCAoZSwgbGlzdCkgPT4gewogICAgICAg
>>"%B64%" echo IGlmIChlIHx8ICFBcnJheS5pc0FycmF5KGxpc3QpKSByZXR1cm47CiAgICAgICAgY29uc3Qg
>>"%B64%" echo ZmlsZXMgPSBsaXN0LmZpbHRlcihuID0+IC9cLmh0bWwkL2kudGVzdChuKSkubWFwKG4gPT4g
>>"%B64%" echo ewogICAgICAgICAgICBjb25zdCBmcCA9IHBhdGguam9pbihoaXN0LCBuKTsKICAgICAgICAg
>>"%B64%" echo ICAgdHJ5IHsgcmV0dXJuIHsgZnAsIG10OiBmcy5zdGF0U3luYyhmcCkubXRpbWVNcyB8fCAw
>>"%B64%" echo IH07IH0gY2F0Y2ggeyByZXR1cm4geyBmcCwgbXQ6IDAgfTsgfQogICAgICAgIH0pLnNvcnQo
>>"%B64%" echo KGEsIGIpID0+IGIubXQgLSBhLm10KTsKICAgICAgICAKICAgICAgICBmb3IgKGxldCBpID0g
>>"%B64%" echo MzsgaSA8IGZpbGVzLmxlbmd0aDsgaSsrKSB7CiAgICAgICAgICAgIHRyeSB7IGZzLnVubGlu
>>"%B64%" echo a1N5bmMoZmlsZXNbaV0uZnApOyB9IGNhdGNoIHt9CiAgICAgICAgfQogICAgfSk7Cn07CmNv
>>"%B64%" echo bnN0IHNjaGVkdWxlSW49bXM9PntpZihzdC50bSljbGVhclRpbWVvdXQoc3QudG0pO2lmKG1z
>>"%B64%" echo PDEwMDApbXM9MTAwMDtzdC5uZXh0X3J1bj1EYXRlLm5vdygpK21zO3N0LnRtPXNldFRpbWVv
>>"%B64%" echo dXQoKCk9PntnZXJhcigiYXV0byIpLnRoZW4oKCk9PnNjaGVkdWxlSW4oTVMxNSkpO30sbXMp
>>"%B64%" echo O307CmNvbnN0IGluaXRTY2hlZHVsZT0oKT0+e2xldCBtcz1NUzE1O3RyeXtpZihmcy5leGlz
>>"%B64%" echo dHNTeW5jKGF0dWFsKSl7Y29uc3QgbT1mcy5zdGF0U3luYyhhdHVhbCkubXRpbWVNcztjb25z
>>"%B64%" echo dCBuZXh0PW0rTVMxNTtjb25zdCBub3c9RGF0ZS5ub3coKTtpZihuZXh0Pm5vdysxMDAwKW1z
>>"%B64%" echo PW5leHQtbm93O319Y2F0Y2h7fXNjaGVkdWxlSW4obXMpO307CmNvbnN0IGdlcmFyPShtb3Rp
>>"%B64%" echo dm8sbWV0YSk9PnsKaWYoc3QucnVubmluZyl7bG9nKCJHRVJBUl9TS0lQIixgbW90aXZvPSR7
>>"%B64%" echo bW90aXZvfSBlc3RhZG89cnVubmluZ2ApO3JldHVybiBQcm9taXNlLnJlc29sdmUoe29rOmZh
>>"%B64%" echo bHNlLGVzdGFkbzoicnVubmluZyJ9KTt9CmNvbnN0IHNjcmlwdD1yZXNvbHZlclNjcmlwdCgp
>>"%B64%" echo OwppZighZmRifHwhc2NyaXB0fHwhZXhpc3RlKHNjcmlwdCkpewppZighc2NyaXB0R2xvYmFs
>>"%B64%" echo KWJ1c2NhclNjcmlwdEdsb2JhbCgpOwpsb2coIkdFUkFSX1NLSVAiLGBtb3Rpdm89JHttb3Rp
>>"%B64%" echo dm99IGVzdGFkbz1zZW1fY2ZnIGZkYj0ke2ZkYj8ib2siOiJ2YXppbyJ9IHNjcmlwdD0ke3Nj
>>"%B64%" echo cmlwdHx8InZhemlvIn0gc2NyaXB0X29rPSR7ZXhpc3RlKHNjcmlwdCk/InNpbSI6Im5hbyJ9
>>"%B64%" echo IGJ1c2NhX2dsb2JhbD0ke2J1c2NhR2xvYmFsRW1DdXJzbz8iZW1fY3Vyc28iOiJuYW9faW5p
>>"%B64%" echo Y2lhZGEifWApOwpyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHtvazpmYWxzZSxlc3RhZG86InNl
>>"%B64%" echo bV9jZmciLGVycm86YHNjcmlwdD0ke3NjcmlwdHx8InZhemlvIn1gfSk7fQpzdC5ydW5uaW5n
>>"%B64%" echo PXRydWU7c3QubGFzdF9zdGFydD1EYXRlLm5vdygpO3N0Lmxhc3RfZXJyPSIiOwpjb25zdCBk
>>"%B64%" echo PW5ldyBEYXRlKCk7CmNvbnN0IGluZm89bWV0YSYmdHlwZW9mIG1ldGE9PT0ib2JqZWN0Ij9t
>>"%B64%" echo ZXRhOnt9Owpjb25zdCBkdEluaWNpbyA9IGluZm8uaW5pY2lvIHx8IGlzb0RhdGUoZCk7CmNv
>>"%B64%" echo bnN0IGR0RmltID0gaW5mby5maW0gfHwgaXNvRGF0ZShkKTsKY29uc3QgZGF0YUlTTyA9IGR0
>>"%B64%" echo SW5pY2lvID09PSBkdEZpbSA/IGR0SW5pY2lvIDogYCR7ZHRJbmljaW99X2F0ZV8ke2R0Rmlt
>>"%B64%" echo fWA7CmNvbnN0IGVudj1PYmplY3QuYXNzaWduKHt9LHByb2Nlc3MuZW52LHtGREJfU1JWX0tF
>>"%B64%" echo WTprZXksRkRCX1NSVl9CQVNFX0xPQ0FMOmBodHRwOi8vMTI3LjAuMC4xOiR7cG9ydH1gLEZE
>>"%B64%" echo Ql9TUlZfQkFTRV9SRURFOmBodHRwOi8vJHt3ZWJpcH06JHtwb3J0fWAsR0VOX1NDUklQVDpz
>>"%B64%" echo Y3JpcHR9KTsKbG9nKCJHRVJBUl9JTklDSU8iLGBtb3Rpdm89JHttb3Rpdm99IGlwPSR7aW5m
>>"%B64%" echo by5pcHx8Ii0ifSBvcmlnZW09JHtpbmZvLm9yaWdlbXx8Ii0ifSB1YT0ke2luZm8udWF8fCIt
>>"%B64%" echo In0gZGF0YT0ke2RhdGFJU099IHNjcmlwdD0iJHtzY3JpcHR9ImApOwpyZXR1cm4gbmV3IFBy
>>"%B64%" echo b21pc2UocmVzPT57ZW5zdXJlRGlyKGhpc3QpOwpsZXQgYXJncz1bc2NyaXB0LCItLWZkYiIs
>>"%B64%" echo ZmRiLCItLXNhaWRhIix0bXAsIi0tdXNlciIsZGJ1c2VyLCItLXBhc3MiLGRicGFzc107Cmlm
>>"%B64%" echo KGluZm8uaW5pY2lvICYmIGluZm8uZmltKSB7IGFyZ3MucHVzaCgiLS1kYXRhLWluaWNpbyIs
>>"%B64%" echo IGluZm8uaW5pY2lvLCAiLS1kYXRhLWZpbSIsIGluZm8uZmltKTsgfQplbHNlIHsgYXJncy5w
>>"%B64%" echo dXNoKCItLWRhdGEiLCBpc29EYXRlKGQpKTsgfQpjb25zdCBwPWNwLnNwYXduKHByb2Nlc3Mu
>>"%B64%" echo ZXhlY1BhdGgsYXJncyx7ZW52LHdpbmRvd3NIaWRlOnRydWV9KTtsZXQgb3V0PSIiO3Auc3Rk
>>"%B64%" echo b3V0Lm9uKCJkYXRhIixiPT57b3V0Kz1TdHJpbmcoYnx8IiIpO30pO3Auc3RkZXJyLm9uKCJk
>>"%B64%" echo YXRhIixiPT57b3V0Kz1TdHJpbmcoYnx8IiIpO30pO3Aub24oImVycm9yIixlPT57c3QucnVu
>>"%B64%" echo bmluZz1mYWxzZTtzdC5sYXN0X2VuZD1EYXRlLm5vdygpO3N0Lmxhc3RfZXJyPWZsYXQoZSYm
>>"%B64%" echo ZS5tZXNzYWdlfHwic3Bhd25fZXJyb3IiKTtzY2hlZHVsZUluKE1TMTUpO2xvZygiR0VSQVJf
>>"%B64%" echo RkFMSEEiLGBtb3Rpdm89JHttb3Rpdm99IGV0YXBhPXNwYXduIGVycm89JHt0YWlsKHN0Lmxh
>>"%B64%" echo c3RfZXJyKX1gKTtyZXMoe29rOmZhbHNlLGVzdGFkbzoic3Bhd25fZXJyb3IiLGVycm86c3Qu
>>"%B64%" echo bGFzdF9lcnIsbmV4dF9ydW46c3QubmV4dF9ydW59KTt9KTtwLm9uKCJjbG9zZSIsY29kZT0+
>>"%B64%" echo e3N0LnJ1bm5pbmc9ZmFsc2U7c3QubGFzdF9lbmQ9RGF0ZS5ub3coKTtpZihjb2RlPT09MCYm
>>"%B64%" echo ZnMuZXhpc3RzU3luYyh0bXApKXtjb25zdCBkZD1TdHJpbmcoZC5nZXREYXRlKCkpLnBhZFN0
>>"%B64%" echo YXJ0KDIsIjAiKTtjb25zdCBtbT1TdHJpbmcoZC5nZXRNb250aCgpKzEpLnBhZFN0YXJ0KDIs
>>"%B64%" echo IjAiKTtjb25zdCB5eT1TdHJpbmcoZC5nZXRGdWxsWWVhcigpKTtjb25zdCBoaD1TdHJpbmco
>>"%B64%" echo ZC5nZXRIb3VycygpKS5wYWRTdGFydCgyLCIwIik7Y29uc3QgbWk9U3RyaW5nKGQuZ2V0TWlu
>>"%B64%" echo dXRlcygpKS5wYWRTdGFydCgyLCIwIik7Y29uc3QgaGlzdEZpbGU9cGF0aC5qb2luKGhpc3Qs
>>"%B64%" echo YChGREItRElBKV9yZWxhdG9yaW9fJHtkZH0tJHttbX0tJHt5eX1fJHtoaH0tJHttaX0uaHRt
>>"%B64%" echo bGApO2xldCBmaWxlRXJyPSIiO3RyeXtmcy5jb3B5RmlsZVN5bmModG1wLGF0dWFsKTtmcy5j
>>"%B64%" echo b3B5RmlsZVN5bmModG1wLGhpc3RGaWxlKTtmcy51bmxpbmtTeW5jKHRtcCk7fWNhdGNoKGUp
>>"%B64%" echo e2ZpbGVFcnI9ZmxhdChlJiZlLm1lc3NhZ2V8fCJjb3B5X2Vycm9yIik7fWlmKCFmaWxlRXJy
>>"%B64%" echo KXtzdC5sYXN0X29rPURhdGUubm93KCk7Y2xlYW5IaXN0KGQpO3NjaGVkdWxlSW4oTVMxNSk7
>>"%B64%" echo bG9nKCJHRVJBUl9PSyIsYG1vdGl2bz0ke21vdGl2b30gYXR1YWw9IiR7YXR1YWx9IiBoaXN0
>>"%B64%" echo PSIke2hpc3RGaWxlfSIgbmV4dF9ydW49JHtzdC5uZXh0X3J1bn1gKTtyZXMoe29rOnRydWUs
>>"%B64%" echo ZXN0YWRvOiJvayIsbW90aXZvLHNhaWRhX2F0dWFsOmF0dWFsLG5leHRfcnVuOnN0Lm5leHRf
>>"%B64%" echo cnVuLGxhc3Rfb2s6c3QubGFzdF9vayxzY3JpcHR9KTtyZXR1cm47fXN0Lmxhc3RfZXJyPWZp
>>"%B64%" echo bGVFcnI7c2NoZWR1bGVJbihNUzE1KTtsb2coIkdFUkFSX0ZBTEhBIixgbW90aXZvPSR7bW90
>>"%B64%" echo aXZvfSBldGFwYT1hcnF1aXZvIGVycm89JHt0YWlsKGZpbGVFcnIpfWApO3Jlcyh7b2s6ZmFs
>>"%B64%" echo c2UsZXN0YWRvOiJlcnJvX2FycXVpdm8iLGVycm86c3QubGFzdF9lcnIsbmV4dF9ydW46c3Qu
>>"%B64%" echo bmV4dF9ydW4sc2NyaXB0fSk7cmV0dXJuO31zdC5sYXN0X2Vycj10YWlsKG91dCl8fCgiZXJy
>>"%B64%" echo byAiK2NvZGUpO3NjaGVkdWxlSW4oTVMxNSk7bG9nKCJHRVJBUl9GQUxIQSIsYG1vdGl2bz0k
>>"%B64%" echo e21vdGl2b30gY29kZT0ke2NvZGV9IGVycm89JHt0YWlsKHN0Lmxhc3RfZXJyKX1gKTtyZXMo
>>"%B64%" echo e29rOmZhbHNlLGVzdGFkbzoiZXJybyIsY29kZSxlcnJvOnN0Lmxhc3RfZXJyLG5leHRfcnVu
>>"%B64%" echo OnN0Lm5leHRfcnVuLHNjcmlwdH0pO30pO30pOwp9OwplbnN1cmVEaXIoaGlzdCk7aW5pdExv
>>"%B64%" echo ZygpO2NsZWFuSGlzdChuZXcgRGF0ZSgpKTsKYnVzY2FyU2NyaXB0R2xvYmFsKCk7CmluaXRT
>>"%B64%" echo Y2hlZHVsZSgpOwpwcm9jZXNzLm9uKCJ1bmNhdWdodEV4Y2VwdGlvbiIsZT0+e2xvZygiVU5D
>>"%B64%" echo QVVHSFQiLGBlcnJvPSR7dGFpbChlJiZlLnN0YWNrfHxlJiZlLm1lc3NhZ2V8fGV8fCJlcnJv
>>"%B64%" echo Iil9YCk7fSk7CnByb2Nlc3Mub24oInVuaGFuZGxlZFJlamVjdGlvbiIsZT0+e2xvZygiVU5I
>>"%B64%" echo QU5ETEVEIixgZXJybz0ke3RhaWwoZSYmZS5zdGFja3x8ZSYmZS5tZXNzYWdlfHxlfHwiZXJy
>>"%B64%" echo byIpfWApO30pOwpjb25zdCBzcnY9aHR0cC5jcmVhdGVTZXJ2ZXIoKHJlcSxyZXMpPT57Y29u
>>"%B64%" echo c3QgdT1uZXcgVVJMKHJlcS51cmx8fCIvIiwiaHR0cDovLzEyNy4wLjAuMSIpO2NvbnN0IHA9
>>"%B64%" echo U3RyaW5nKHUucGF0aG5hbWV8fCIvIik7aWYocmVxLm1ldGhvZD09PSJPUFRJT05TIil7cmVz
>>"%B64%" echo LndyaXRlSGVhZCgyMDQsY29ycygpKTtyZXMuZW5kKCk7cmV0dXJuO31pZihwPT09Ii9fX3N0
>>"%B64%" echo YXR1cyImJnJlcS5tZXRob2Q9PT0iR0VUIil7b2tKc29uKHJlcyx7cnVubmluZzpzdC5ydW5u
>>"%B64%" echo aW5nLGxhc3Rfc3RhcnQ6c3QubGFzdF9zdGFydCxsYXN0X2VuZDpzdC5sYXN0X2VuZCxsYXN0
>>"%B64%" echo X29rOnN0Lmxhc3Rfb2ssbGFzdF9lcnI6c3QubGFzdF9lcnIsbmV4dF9ydW46c3QubmV4dF9y
>>"%B64%" echo dW4scG9ydCx3ZWJpcCxzY3JpcHQ6cmVzb2x2ZXJTY3JpcHQoKSxzY3JpcHRfY2ZnOmxlckNv
>>"%B64%" echo bmZTY3JpcHQoKSxzY3JpcHRfZ2xvYmFsOnNjcmlwdEdsb2JhbCxidXNjYV9nbG9iYWxfZW1f
>>"%B64%" echo Y3Vyc286YnVzY2FHbG9iYWxFbUN1cnNvfSwyMDAsY29ycygpKTtyZXR1cm47fWlmKHA9PT0i
>>"%B64%" echo L19fZ2VyYXIiJiZyZXEubWV0aG9kPT09IlBPU1QiKXtjb25zdCBpZD0rK3JlcUlkO2NvbnN0
>>"%B64%" echo IGs9U3RyaW5nKHJlcS5oZWFkZXJzWyJ4LWtleSJdfHwiIikudHJpbSgpO2NvbnN0IGlwPXJp
>>"%B64%" echo cChyZXEpO2NvbnN0IG9yaWdlbT1mbGF0KHJlcS5oZWFkZXJzLm9yaWdpbnx8cmVxLmhlYWRl
>>"%B64%" echo cnMucmVmZXJlcnx8Ii0iKTtjb25zdCBhPXJ1YShyZXEpO2NvbnN0IGRpbmljaW89U3RyaW5n
>>"%B64%" echo KHJlcS5oZWFkZXJzWyJ4LWRhdGEtaW5pY2lvIl18fCIiKS50cmltKCk7Y29uc3QgZGZpbT1T
>>"%B64%" echo dHJpbmcocmVxLmhlYWRlcnNbIngtZGF0YS1maW0iXXx8IiIpLnRyaW0oKTtsb2coIkdFUkFS
>>"%B64%" echo X1JFUSIsYGlkPSR7aWR9IGlwPSR7aXB9IG9yaWdlbT0ke29yaWdlbXx8Ii0ifSBrZXk9JHtr
>>"%B64%" echo ZXkmJms9PT1rZXk/Im9rIjoiaW52YWxpZGEifSBydW5uaW5nPSR7c3QucnVubmluZ30gdWE9
>>"%B64%" echo JHthfHwiLSJ9YCk7aWYoIWtleXx8ayE9PWtleSl7bG9nKCJHRVJBUl9ERU5ZIixgaWQ9JHtp
>>"%B64%" echo ZH0gaXA9JHtpcH0gbW90aXZvPXVuYXV0aGApO29rSnNvbihyZXMse29rOmZhbHNlLGVzdGFk
>>"%B64%" echo bzoidW5hdXRoIixyZXFfaWQ6aWR9LDQwMSxjb3JzKCkpO3JldHVybjt9aWYoc3QucnVubmlu
>>"%B64%" echo Zyl7bG9nKCJHRVJBUl9CVVNZIixgaWQ9JHtpZH0gaXA9JHtpcH0gbGFzdF9zdGFydD0ke3N0
>>"%B64%" echo Lmxhc3Rfc3RhcnR9YCk7b2tKc29uKHJlcyx7b2s6ZmFsc2UsZXN0YWRvOiJydW5uaW5nIixy
>>"%B64%" echo dW5uaW5nOnRydWUsbGFzdF9zdGFydDpzdC5sYXN0X3N0YXJ0LGxhc3Rfb2s6c3QubGFzdF9v
>>"%B64%" echo ayxuZXh0X3J1bjpzdC5uZXh0X3J1bixyZXFfaWQ6aWR9LDQwOSxjb3JzKCkpO3JldHVybjt9
>>"%B64%" echo Z2VyYXIoIm1hbnVhbCIse2lkLGlwLG9yaWdlbSx1YTphLGluaWNpbzpkaW5pY2lvLGZpbTpk
>>"%B64%" echo ZmltfSkudGhlbihyPT57bG9nKCJHRVJBUl9SRVMiLGBpZD0ke2lkfSBvaz0keyEhKHImJnIu
>>"%B64%" echo b2spfSBlc3RhZG89JHtyJiZyLmVzdGFkb3x8Ii0ifSBsYXN0X29rPSR7c3QubGFzdF9va30g
>>"%B64%" echo c2NyaXB0PSIke3ImJnIuc2NyaXB0fHxyZXNvbHZlclNjcmlwdCgpfHwiIn0iIGVycm89JHt0
>>"%B64%" echo YWlsKHImJnIuZXJyb3x8IiIpfHwiLSJ9YCk7b2tKc29uKHJlcyxPYmplY3QuYXNzaWduKHty
>>"%B64%" echo ZXFfaWQ6aWR9LHJ8fHt9KSwyMDAsY29ycygpKTt9KTtyZXR1cm47fWlmKHA9PT0iL19fcHJv
>>"%B64%" echo aWJpZG9zIiYmcmVxLm1ldGhvZD09PSJHRVQiKXtsZXJQcm9pYihsaXN0YT0+b2tKc29uKHJl
>>"%B64%" echo cyx7b2s6dHJ1ZSxsaXN0YX0sMjAwLGNvcnMoKSkpO3JldHVybjt9aWYocD09PSIvX19wcm9p
>>"%B64%" echo Ymlkb3MiJiZyZXEubWV0aG9kPT09IlBPU1QiKXtjb25zdCBrPVN0cmluZyhyZXEuaGVhZGVy
>>"%B64%" echo c1sieC1rZXkiXXx8IiIpLnRyaW0oKTtpZihrZXkmJmshPT1rZXkpe29rSnNvbihyZXMse29r
>>"%B64%" echo OmZhbHNlLGVzdGFkbzoidW5hdXRoIn0sNDAxLGNvcnMoKSk7cmV0dXJuO31sZXQgYm9keT0i
>>"%B64%" echo IjtyZXEub24oImRhdGEiLGI9Pntib2R5Kz1TdHJpbmcoYnx8IiIpO2lmKGJvZHkubGVuZ3Ro
>>"%B64%" echo PjIwMDAwMClib2R5PWJvZHkuc2xpY2UoMCwyMDAwMDApO30pO3JlcS5vbigiZW5kIiwoKT0+
>>"%B64%" echo e2NvbnN0IGluYz1wYXJzZUxpc3RhKGJvZHkpO2xlclByb2liKGxpc3RhMD0+e2NvbnN0IG1l
>>"%B64%" echo cmdlZD11bmlxKFsuLi5saXN0YTAsLi4uaW5jXS5tYXAobm9ybVApLmZpbHRlcihCb29sZWFu
>>"%B64%" echo KSk7c2FsdmFyUHJvaWIobWVyZ2VkLCgpPT5va0pzb24ocmVzLHtvazp0cnVlLGxpc3RhOm1l
>>"%B64%" echo cmdlZH0sMjAwLGNvcnMoKSkpO30pO30pO3JldHVybjt9bGV0IHJlbD1wO2lmKHJlbD09PSIv
>>"%B64%" echo Inx8cmVsPT09IiIpcmVsPSIvcmVsYXRvcmlvX2F0dWFsLmh0bWwiO3JlbD1yZWwucmVwbGFj
>>"%B64%" echo ZSgvXlwvKy8sIiIpO2NvbnN0IGZwPXBhdGgucmVzb2x2ZShwYXRoLmpvaW4ocm9vdCxyZWwp
>>"%B64%" echo KTtpZihmcC5pbmRleE9mKHJvb3QpIT09MClyZXR1cm4gYmFkKHJlcyw0MDMsIjQwMyIpO3Nl
>>"%B64%" echo cnZlRmlsZShyZXMsZnApO30pOwpzcnYubGlzdGVuKHBvcnQsIjAuMC4wLjAiLCgpPT57bG9n
>>"%B64%" echo KCJTRVJWSURPUl9PSyIsYCR7cG9ydH0gJHtyb290fSB3ZWJpcD0ke3dlYmlwfSBzY3JpcHQ9
>>"%B64%" echo IiR7cmVzb2x2ZXJTY3JpcHQoKX0iIGNmZz0iJHtsZXJDb25mU2NyaXB0KCl9ImApO30pOw==
powershell -NoProfile -ExecutionPolicy Bypass -Command "$b=Get-Content -LiteralPath '%WEBROOT%\_server_fdb_rel.b64' -Raw; [IO.File]::WriteAllBytes('%SERVER%',[Convert]::FromBase64String($b))" >nul 2>&1
del /q "%B64%" >nul 2>&1
if exist "%SERVER%" set "SRV_SRC=%SERVER%"
exit /b 0
:instalar
set "VBS_STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\FDB_Relatorio_Web.vbs"
> "%VBS_STARTUP%" echo Set sh = CreateObject("WScript.Shell")
>>"%VBS_STARTUP%" echo sh.Run "cmd.exe /c """"%~f0"" --auto""", 0, False
exit /b 0
:remover
del /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\FDB_Relatorio_Web.vbs" >nul 2>&1
exit /b 0
