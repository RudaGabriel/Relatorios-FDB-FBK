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
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=(Get-Date).Date; Get-ChildItem -LiteralPath '%HIST%' -File -Filter '*.html' -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime.Date -ne $d } | Remove-Item -Force -ErrorAction SilentlyContinue" >nul 2>&1
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
>>"%B64%" echo cCkucGlwZShyZXMpO30pO307CmNvbnN0IGNsZWFuSGlzdD1kPT57ZW5zdXJlRGlyKGhpc3Qp
>>"%B64%" echo O2NvbnN0IG1pZD1uZXcgRGF0ZShkLmdldEZ1bGxZZWFyKCksZC5nZXRNb250aCgpLGQuZ2V0
>>"%B64%" echo RGF0ZSgpKS5nZXRUaW1lKCk7ZnMucmVhZGRpcihoaXN0LChlLGxpc3QpPT57aWYoZXx8IUFy
>>"%B64%" echo cmF5LmlzQXJyYXkobGlzdCl8fCFsaXN0Lmxlbmd0aClyZXR1cm47Zm9yKGNvbnN0IG5hbWUg
>>"%B64%" echo b2YgbGlzdCl7aWYoIW5hbWV8fCEvXC5odG1sJC9pLnRlc3QobmFtZSkpY29udGludWU7Y29u
>>"%B64%" echo c3QgZnA9cGF0aC5qb2luKGhpc3QsbmFtZSk7ZnMuc3RhdChmcCwoZTIscyk9PntpZihlMnx8
>>"%B64%" echo IXN8fCFzLmlzRmlsZSgpKXJldHVybjtjb25zdCBtdD1OdW1iZXIocy5tdGltZU1zfHwwKTtp
>>"%B64%" echo ZihtdCYmbXQ8bWlkKWZzLnVubGluayhmcCwoKT0+e30pO30pO319KTt9Owpjb25zdCBzY2hl
>>"%B64%" echo ZHVsZUluPW1zPT57aWYoc3QudG0pY2xlYXJUaW1lb3V0KHN0LnRtKTtpZihtczwxMDAwKW1z
>>"%B64%" echo PTEwMDA7c3QubmV4dF9ydW49RGF0ZS5ub3coKSttcztzdC50bT1zZXRUaW1lb3V0KCgpPT57
>>"%B64%" echo Z2VyYXIoImF1dG8iKS50aGVuKCgpPT5zY2hlZHVsZUluKE1TMTUpKTt9LG1zKTt9Owpjb25z
>>"%B64%" echo dCBpbml0U2NoZWR1bGU9KCk9PntsZXQgbXM9TVMxNTt0cnl7aWYoZnMuZXhpc3RzU3luYyhh
>>"%B64%" echo dHVhbCkpe2NvbnN0IG09ZnMuc3RhdFN5bmMoYXR1YWwpLm10aW1lTXM7Y29uc3QgbmV4dD1t
>>"%B64%" echo K01TMTU7Y29uc3Qgbm93PURhdGUubm93KCk7aWYobmV4dD5ub3crMTAwMCltcz1uZXh0LW5v
>>"%B64%" echo dzt9fWNhdGNoe31zY2hlZHVsZUluKG1zKTt9Owpjb25zdCBnZXJhcj0obW90aXZvLG1ldGEp
>>"%B64%" echo PT57CmlmKHN0LnJ1bm5pbmcpe2xvZygiR0VSQVJfU0tJUCIsYG1vdGl2bz0ke21vdGl2b30g
>>"%B64%" echo ZXN0YWRvPXJ1bm5pbmdgKTtyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHtvazpmYWxzZSxlc3Rh
>>"%B64%" echo ZG86InJ1bm5pbmcifSk7fQpjb25zdCBzY3JpcHQ9cmVzb2x2ZXJTY3JpcHQoKTsKaWYoIWZk
>>"%B64%" echo Ynx8IXNjcmlwdHx8IWV4aXN0ZShzY3JpcHQpKXsKaWYoIXNjcmlwdEdsb2JhbClidXNjYXJT
>>"%B64%" echo Y3JpcHRHbG9iYWwoKTsKbG9nKCJHRVJBUl9TS0lQIixgbW90aXZvPSR7bW90aXZvfSBlc3Rh
>>"%B64%" echo ZG89c2VtX2NmZyBmZGI9JHtmZGI/Im9rIjoidmF6aW8ifSBzY3JpcHQ9JHtzY3JpcHR8fCJ2
>>"%B64%" echo YXppbyJ9IHNjcmlwdF9vaz0ke2V4aXN0ZShzY3JpcHQpPyJzaW0iOiJuYW8ifSBidXNjYV9n
>>"%B64%" echo bG9iYWw9JHtidXNjYUdsb2JhbEVtQ3Vyc28/ImVtX2N1cnNvIjoibmFvX2luaWNpYWRhIn1g
>>"%B64%" echo KTsKcmV0dXJuIFByb21pc2UucmVzb2x2ZSh7b2s6ZmFsc2UsZXN0YWRvOiJzZW1fY2ZnIixl
>>"%B64%" echo cnJvOmBzY3JpcHQ9JHtzY3JpcHR8fCJ2YXppbyJ9YH0pO30Kc3QucnVubmluZz10cnVlO3N0
>>"%B64%" echo Lmxhc3Rfc3RhcnQ9RGF0ZS5ub3coKTtzdC5sYXN0X2Vycj0iIjsKY29uc3QgZD1uZXcgRGF0
>>"%B64%" echo ZSgpOwpjb25zdCBpbmZvPW1ldGEmJnR5cGVvZiBtZXRhPT09Im9iamVjdCI/bWV0YTp7fTsK
>>"%B64%" echo Y29uc3QgZHRJbmljaW8gPSBpbmZvLmluaWNpbyB8fCBpc29EYXRlKGQpOwpjb25zdCBkdEZp
>>"%B64%" echo bSA9IGluZm8uZmltIHx8IGlzb0RhdGUoZCk7CmNvbnN0IGRhdGFJU08gPSBkdEluaWNpbyA9
>>"%B64%" echo PT0gZHRGaW0gPyBkdEluaWNpbyA6IGAke2R0SW5pY2lvfV9hdGVfJHtkdEZpbX1gOwpjb25z
>>"%B64%" echo dCBlbnY9T2JqZWN0LmFzc2lnbih7fSxwcm9jZXNzLmVudix7RkRCX1NSVl9LRVk6a2V5LEZE
>>"%B64%" echo Ql9TUlZfQkFTRV9MT0NBTDpgaHR0cDovLzEyNy4wLjAuMToke3BvcnR9YCxGREJfU1JWX0JB
>>"%B64%" echo U0VfUkVERTpgaHR0cDovLyR7d2ViaXB9OiR7cG9ydH1gLEdFTl9TQ1JJUFQ6c2NyaXB0fSk7
>>"%B64%" echo CmxvZygiR0VSQVJfSU5JQ0lPIixgbW90aXZvPSR7bW90aXZvfSBpcD0ke2luZm8uaXB8fCIt
>>"%B64%" echo In0gb3JpZ2VtPSR7aW5mby5vcmlnZW18fCItIn0gdWE9JHtpbmZvLnVhfHwiLSJ9IGRhdGE9
>>"%B64%" echo JHtkYXRhSVNPfSBzY3JpcHQ9IiR7c2NyaXB0fSJgKTsKcmV0dXJuIG5ldyBQcm9taXNlKHJl
>>"%B64%" echo cz0+e2Vuc3VyZURpcihoaXN0KTsKbGV0IGFyZ3M9W3NjcmlwdCwiLS1mZGIiLGZkYiwiLS1z
>>"%B64%" echo YWlkYSIsdG1wLCItLXVzZXIiLGRidXNlciwiLS1wYXNzIixkYnBhc3NdOwppZihpbmZvLmlu
>>"%B64%" echo aWNpbyAmJiBpbmZvLmZpbSkgeyBhcmdzLnB1c2goIi0tZGF0YS1pbmljaW8iLCBpbmZvLmlu
>>"%B64%" echo aWNpbywgIi0tZGF0YS1maW0iLCBpbmZvLmZpbSk7IH0KZWxzZSB7IGFyZ3MucHVzaCgiLS1k
>>"%B64%" echo YXRhIiwgaXNvRGF0ZShkKSk7IH0KY29uc3QgcD1jcC5zcGF3bihwcm9jZXNzLmV4ZWNQYXRo
>>"%B64%" echo LGFyZ3Mse2Vudix3aW5kb3dzSGlkZTp0cnVlfSk7bGV0IG91dD0iIjtwLnN0ZG91dC5vbigi
>>"%B64%" echo ZGF0YSIsYj0+e291dCs9U3RyaW5nKGJ8fCIiKTt9KTtwLnN0ZGVyci5vbigiZGF0YSIsYj0+
>>"%B64%" echo e291dCs9U3RyaW5nKGJ8fCIiKTt9KTtwLm9uKCJlcnJvciIsZT0+e3N0LnJ1bm5pbmc9ZmFs
>>"%B64%" echo c2U7c3QubGFzdF9lbmQ9RGF0ZS5ub3coKTtzdC5sYXN0X2Vycj1mbGF0KGUmJmUubWVzc2Fn
>>"%B64%" echo ZXx8InNwYXduX2Vycm9yIik7c2NoZWR1bGVJbihNUzE1KTtsb2coIkdFUkFSX0ZBTEhBIixg
>>"%B64%" echo bW90aXZvPSR7bW90aXZvfSBldGFwYT1zcGF3biBlcnJvPSR7dGFpbChzdC5sYXN0X2Vycil9
>>"%B64%" echo YCk7cmVzKHtvazpmYWxzZSxlc3RhZG86InNwYXduX2Vycm9yIixlcnJvOnN0Lmxhc3RfZXJy
>>"%B64%" echo LG5leHRfcnVuOnN0Lm5leHRfcnVufSk7fSk7cC5vbigiY2xvc2UiLGNvZGU9PntzdC5ydW5u
>>"%B64%" echo aW5nPWZhbHNlO3N0Lmxhc3RfZW5kPURhdGUubm93KCk7aWYoY29kZT09PTAmJmZzLmV4aXN0
>>"%B64%" echo c1N5bmModG1wKSl7Y29uc3QgZGQ9U3RyaW5nKGQuZ2V0RGF0ZSgpKS5wYWRTdGFydCgyLCIw
>>"%B64%" echo Iik7Y29uc3QgbW09U3RyaW5nKGQuZ2V0TW9udGgoKSsxKS5wYWRTdGFydCgyLCIwIik7Y29u
>>"%B64%" echo c3QgeXk9U3RyaW5nKGQuZ2V0RnVsbFllYXIoKSk7Y29uc3QgaGg9U3RyaW5nKGQuZ2V0SG91
>>"%B64%" echo cnMoKSkucGFkU3RhcnQoMiwiMCIpO2NvbnN0IG1pPVN0cmluZyhkLmdldE1pbnV0ZXMoKSku
>>"%B64%" echo cGFkU3RhcnQoMiwiMCIpO2NvbnN0IGhpc3RGaWxlPXBhdGguam9pbihoaXN0LGAoRkRCLURJ
>>"%B64%" echo QSlfcmVsYXRvcmlvXyR7ZGR9LSR7bW19LSR7eXl9XyR7aGh9LSR7bWl9Lmh0bWxgKTtsZXQg
>>"%B64%" echo ZmlsZUVycj0iIjt0cnl7ZnMuY29weUZpbGVTeW5jKHRtcCxhdHVhbCk7ZnMuY29weUZpbGVT
>>"%B64%" echo eW5jKHRtcCxoaXN0RmlsZSk7ZnMudW5saW5rU3luYyh0bXApO31jYXRjaChlKXtmaWxlRXJy
>>"%B64%" echo PWZsYXQoZSYmZS5tZXNzYWdlfHwiY29weV9lcnJvciIpO31pZighZmlsZUVycil7c3QubGFz
>>"%B64%" echo dF9vaz1EYXRlLm5vdygpO2NsZWFuSGlzdChkKTtzY2hlZHVsZUluKE1TMTUpO2xvZygiR0VS
>>"%B64%" echo QVJfT0siLGBtb3Rpdm89JHttb3Rpdm99IGF0dWFsPSIke2F0dWFsfSIgaGlzdD0iJHtoaXN0
>>"%B64%" echo RmlsZX0iIG5leHRfcnVuPSR7c3QubmV4dF9ydW59YCk7cmVzKHtvazp0cnVlLGVzdGFkbzoi
>>"%B64%" echo b2siLG1vdGl2byxzYWlkYV9hdHVhbDphdHVhbCxuZXh0X3J1bjpzdC5uZXh0X3J1bixsYXN0
>>"%B64%" echo X29rOnN0Lmxhc3Rfb2ssc2NyaXB0fSk7cmV0dXJuO31zdC5sYXN0X2Vycj1maWxlRXJyO3Nj
>>"%B64%" echo aGVkdWxlSW4oTVMxNSk7bG9nKCJHRVJBUl9GQUxIQSIsYG1vdGl2bz0ke21vdGl2b30gZXRh
>>"%B64%" echo cGE9YXJxdWl2byBlcnJvPSR7dGFpbChmaWxlRXJyKX1gKTtyZXMoe29rOmZhbHNlLGVzdGFk
>>"%B64%" echo bzoiZXJyb19hcnF1aXZvIixlcnJvOnN0Lmxhc3RfZXJyLG5leHRfcnVuOnN0Lm5leHRfcnVu
>>"%B64%" echo LHNjcmlwdH0pO3JldHVybjt9c3QubGFzdF9lcnI9dGFpbChvdXQpfHwoImVycm8gIitjb2Rl
>>"%B64%" echo KTtzY2hlZHVsZUluKE1TMTUpO2xvZygiR0VSQVJfRkFMSEEiLGBtb3Rpdm89JHttb3Rpdm99
>>"%B64%" echo IGNvZGU9JHtjb2RlfSBlcnJvPSR7dGFpbChzdC5sYXN0X2Vycil9YCk7cmVzKHtvazpmYWxz
>>"%B64%" echo ZSxlc3RhZG86ImVycm8iLGNvZGUsZXJybzpzdC5sYXN0X2VycixuZXh0X3J1bjpzdC5uZXh0
>>"%B64%" echo X3J1bixzY3JpcHR9KTt9KTt9KTsKfTsKZW5zdXJlRGlyKGhpc3QpO2luaXRMb2coKTtjbGVh
>>"%B64%" echo bkhpc3QobmV3IERhdGUoKSk7CmJ1c2NhclNjcmlwdEdsb2JhbCgpOwppbml0U2NoZWR1bGUo
>>"%B64%" echo KTsKcHJvY2Vzcy5vbigidW5jYXVnaHRFeGNlcHRpb24iLGU9Pntsb2coIlVOQ0FVR0hUIixg
>>"%B64%" echo ZXJybz0ke3RhaWwoZSYmZS5zdGFja3x8ZSYmZS5tZXNzYWdlfHxlfHwiZXJybyIpfWApO30p
>>"%B64%" echo Owpwcm9jZXNzLm9uKCJ1bmhhbmRsZWRSZWplY3Rpb24iLGU9Pntsb2coIlVOSEFORExFRCIs
>>"%B64%" echo YGVycm89JHt0YWlsKGUmJmUuc3RhY2t8fGUmJmUubWVzc2FnZXx8ZXx8ImVycm8iKX1gKTt9
>>"%B64%" echo KTsKY29uc3Qgc3J2PWh0dHAuY3JlYXRlU2VydmVyKChyZXEscmVzKT0+e2NvbnN0IHU9bmV3
>>"%B64%" echo IFVSTChyZXEudXJsfHwiLyIsImh0dHA6Ly8xMjcuMC4wLjEiKTtjb25zdCBwPVN0cmluZyh1
>>"%B64%" echo LnBhdGhuYW1lfHwiLyIpO2lmKHJlcS5tZXRob2Q9PT0iT1BUSU9OUyIpe3Jlcy53cml0ZUhl
>>"%B64%" echo YWQoMjA0LGNvcnMoKSk7cmVzLmVuZCgpO3JldHVybjt9aWYocD09PSIvX19zdGF0dXMiJiZy
>>"%B64%" echo ZXEubWV0aG9kPT09IkdFVCIpe29rSnNvbihyZXMse3J1bm5pbmc6c3QucnVubmluZyxsYXN0
>>"%B64%" echo X3N0YXJ0OnN0Lmxhc3Rfc3RhcnQsbGFzdF9lbmQ6c3QubGFzdF9lbmQsbGFzdF9vazpzdC5s
>>"%B64%" echo YXN0X29rLGxhc3RfZXJyOnN0Lmxhc3RfZXJyLG5leHRfcnVuOnN0Lm5leHRfcnVuLHBvcnQs
>>"%B64%" echo d2ViaXAsc2NyaXB0OnJlc29sdmVyU2NyaXB0KCksc2NyaXB0X2NmZzpsZXJDb25mU2NyaXB0
>>"%B64%" echo KCksc2NyaXB0X2dsb2JhbDpzY3JpcHRHbG9iYWwsYnVzY2FfZ2xvYmFsX2VtX2N1cnNvOmJ1
>>"%B64%" echo c2NhR2xvYmFsRW1DdXJzb30sMjAwLGNvcnMoKSk7cmV0dXJuO31pZihwPT09Ii9fX2dlcmFy
>>"%B64%" echo IiYmcmVxLm1ldGhvZD09PSJQT1NUIil7Y29uc3QgaWQ9KytyZXFJZDtjb25zdCBrPVN0cmlu
>>"%B64%" echo ZyhyZXEuaGVhZGVyc1sieC1rZXkiXXx8IiIpLnRyaW0oKTtjb25zdCBpcD1yaXAocmVxKTtj
>>"%B64%" echo b25zdCBvcmlnZW09ZmxhdChyZXEuaGVhZGVycy5vcmlnaW58fHJlcS5oZWFkZXJzLnJlZmVy
>>"%B64%" echo ZXJ8fCItIik7Y29uc3QgYT1ydWEocmVxKTtjb25zdCBkaW5pY2lvPVN0cmluZyhyZXEuaGVh
>>"%B64%" echo ZGVyc1sieC1kYXRhLWluaWNpbyJdfHwiIikudHJpbSgpO2NvbnN0IGRmaW09U3RyaW5nKHJl
>>"%B64%" echo cS5oZWFkZXJzWyJ4LWRhdGEtZmltIl18fCIiKS50cmltKCk7bG9nKCJHRVJBUl9SRVEiLGBp
>>"%B64%" echo ZD0ke2lkfSBpcD0ke2lwfSBvcmlnZW09JHtvcmlnZW18fCItIn0ga2V5PSR7a2V5JiZrPT09
>>"%B64%" echo a2V5PyJvayI6ImludmFsaWRhIn0gcnVubmluZz0ke3N0LnJ1bm5pbmd9IHVhPSR7YXx8Ii0i
>>"%B64%" echo fWApO2lmKCFrZXl8fGshPT1rZXkpe2xvZygiR0VSQVJfREVOWSIsYGlkPSR7aWR9IGlwPSR7
>>"%B64%" echo aXB9IG1vdGl2bz11bmF1dGhgKTtva0pzb24ocmVzLHtvazpmYWxzZSxlc3RhZG86InVuYXV0
>>"%B64%" echo aCIscmVxX2lkOmlkfSw0MDEsY29ycygpKTtyZXR1cm47fWlmKHN0LnJ1bm5pbmcpe2xvZygi
>>"%B64%" echo R0VSQVJfQlVTWSIsYGlkPSR7aWR9IGlwPSR7aXB9IGxhc3Rfc3RhcnQ9JHtzdC5sYXN0X3N0
>>"%B64%" echo YXJ0fWApO29rSnNvbihyZXMse29rOmZhbHNlLGVzdGFkbzoicnVubmluZyIscnVubmluZzp0
>>"%B64%" echo cnVlLGxhc3Rfc3RhcnQ6c3QubGFzdF9zdGFydCxsYXN0X29rOnN0Lmxhc3Rfb2ssbmV4dF9y
>>"%B64%" echo dW46c3QubmV4dF9ydW4scmVxX2lkOmlkfSw0MDksY29ycygpKTtyZXR1cm47fWdlcmFyKCJt
>>"%B64%" echo YW51YWwiLHtpZCxpcCxvcmlnZW0sdWE6YSxpbmljaW86ZGluaWNpbyxmaW06ZGZpbX0pLnRo
>>"%B64%" echo ZW4ocj0+e2xvZygiR0VSQVJfUkVTIixgaWQ9JHtpZH0gb2s9JHshIShyJiZyLm9rKX0gZXN0
>>"%B64%" echo YWRvPSR7ciYmci5lc3RhZG98fCItIn0gbGFzdF9vaz0ke3N0Lmxhc3Rfb2t9IHNjcmlwdD0i
>>"%B64%" echo JHtyJiZyLnNjcmlwdHx8cmVzb2x2ZXJTY3JpcHQoKXx8IiJ9IiBlcnJvPSR7dGFpbChyJiZy
>>"%B64%" echo LmVycm98fCIiKXx8Ii0ifWApO29rSnNvbihyZXMsT2JqZWN0LmFzc2lnbih7cmVxX2lkOmlk
>>"%B64%" echo fSxyfHx7fSksMjAwLGNvcnMoKSk7fSk7cmV0dXJuO31pZihwPT09Ii9fX3Byb2liaWRvcyIm
>>"%B64%" echo JnJlcS5tZXRob2Q9PT0iR0VUIil7bGVyUHJvaWIobGlzdGE9Pm9rSnNvbihyZXMse29rOnRy
>>"%B64%" echo dWUsbGlzdGF9LDIwMCxjb3JzKCkpKTtyZXR1cm47fWlmKHA9PT0iL19fcHJvaWJpZG9zIiYm
>>"%B64%" echo cmVxLm1ldGhvZD09PSJQT1NUIil7Y29uc3Qgaz1TdHJpbmcocmVxLmhlYWRlcnNbIngta2V5
>>"%B64%" echo Il18fCIiKS50cmltKCk7aWYoa2V5JiZrIT09a2V5KXtva0pzb24ocmVzLHtvazpmYWxzZSxl
>>"%B64%" echo c3RhZG86InVuYXV0aCJ9LDQwMSxjb3JzKCkpO3JldHVybjt9bGV0IGJvZHk9IiI7cmVxLm9u
>>"%B64%" echo KCJkYXRhIixiPT57Ym9keSs9U3RyaW5nKGJ8fCIiKTtpZihib2R5Lmxlbmd0aD4yMDAwMDAp
>>"%B64%" echo Ym9keT1ib2R5LnNsaWNlKDAsMjAwMDAwKTt9KTtyZXEub24oImVuZCIsKCk9Pntjb25zdCBp
>>"%B64%" echo bmM9cGFyc2VMaXN0YShib2R5KTtsZXJQcm9pYihsaXN0YTA9Pntjb25zdCBtZXJnZWQ9dW5p
>>"%B64%" echo cShbLi4ubGlzdGEwLC4uLmluY10ubWFwKG5vcm1QKS5maWx0ZXIoQm9vbGVhbikpO3NhbHZh
>>"%B64%" echo clByb2liKG1lcmdlZCwoKT0+b2tKc29uKHJlcyx7b2s6dHJ1ZSxsaXN0YTptZXJnZWR9LDIw
>>"%B64%" echo MCxjb3JzKCkpKTt9KTt9KTtyZXR1cm47fWxldCByZWw9cDtpZihyZWw9PT0iLyJ8fHJlbD09
>>"%B64%" echo PSIiKXJlbD0iL3JlbGF0b3Jpb19hdHVhbC5odG1sIjtyZWw9cmVsLnJlcGxhY2UoL15cLysv
>>"%B64%" echo LCIiKTtjb25zdCBmcD1wYXRoLnJlc29sdmUocGF0aC5qb2luKHJvb3QscmVsKSk7aWYoZnAu
>>"%B64%" echo aW5kZXhPZihyb290KSE9PTApcmV0dXJuIGJhZChyZXMsNDAzLCI0MDMiKTtzZXJ2ZUZpbGUo
>>"%B64%" echo cmVzLGZwKTt9KTsKc3J2Lmxpc3Rlbihwb3J0LCIwLjAuMC4wIiwoKT0+e2xvZygiU0VSVklE
>>"%B64%" echo T1JfT0siLGAke3BvcnR9ICR7cm9vdH0gd2ViaXA9JHt3ZWJpcH0gc2NyaXB0PSIke3Jlc29s
>>"%B64%" echo dmVyU2NyaXB0KCl9IiBjZmc9IiR7bGVyQ29uZlNjcmlwdCgpfSJgKTt9KTs=
powershell -NoProfile -ExecutionPolicy Bypass -Command "$b=Get-Content -LiteralPath '%WEBROOT%\_server_fdb_rel.b64' -Raw; [IO.File]::WriteAllBytes('%SERVER%',[Convert]::FromBase64String($b))" >nul 2>&1
del /q "%B64%" >nul 2>&1
if exist "%SERVER%" set "SRV_SRC=%SERVER%"
exit /b 0
:instalar
powershell -NoProfile -ExecutionPolicy Bypass -Command "$lnk=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup\FDB_Relatorio_Web.lnk'; $w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut($lnk); $s.TargetPath='%~f0'; $s.Arguments='--auto'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=7; $s.Save()" >nul
schtasks /Create /F /TN "FDB_Relatorio_Web" /SC ONLOGON /TR "\"%~f0\" --auto" >nul 2>&1
schtasks /Create /F /TN "FDB_Relatorio_Web_BOOT" /SC ONSTART /RU "SYSTEM" /TR "\"%~f0\" --auto" >nul 2>&1
exit /b 0
:remover
del /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\FDB_Relatorio_Web.lnk" >nul 2>&1
schtasks /Delete /F /TN "FDB_Relatorio_Web" >nul 2>&1
schtasks /Delete /F /TN "FDB_Relatorio_Web_BOOT" >nul 2>&1
exit /b 0
