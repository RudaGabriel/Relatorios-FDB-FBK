' =============================================================================
' bootstrap.vbs                                                        v2.0.0
' Autor: Ruda Gabriel
' -----------------------------------------------------------------------------
' Inicializacao automatica do Relatorios Offline.
'
' A tarefa agendada (criada por instalar-na-inicializacao.bat) roda esta copia
' LOCAL no logon, com o caminho do launcher.vbs do sistema como argumento:
'   wscript.exe bootstrap.vbs "C:\...\launcher.vbs"
' Se o launcher existir, ele e' aberto (com "/inicializacao": partida sem
' nenhuma janela). Se a pasta do sistema estiver na rede e ainda nao estiver
' disponivel, o bootstrap apenas termina: a propria tarefa agendada o executa
' novamente 2, 10 e 30 minutos depois do logon.
'
' Codigos de saida: 0 = launcher aberto, 2 = sem o caminho do launcher,
' 5 = launcher nao encontrado (pasta de rede ainda indisponivel).
'
' (Historico completo das versoes: CHANGELOG.md no repositorio.)
' CHANGELOG 2.0.0 - 2026-11-13 - Codigo minimo, sem espera em laco e sem ler o caminho
'   de um arquivo a parte (o antivirus do Windows acusava esse padrao).
' =============================================================================

Option Explicit

Dim arquivos, shell, caminhoDoLauncher

If WScript.Arguments.Count = 0 Then
    WScript.Quit 2
End If
caminhoDoLauncher = Trim(WScript.Arguments(0))

Set arquivos = CreateObject("Scripting.FileSystemObject")
If Not arquivos.FileExists(caminhoDoLauncher) Then
    WScript.Quit 5
End If

Set shell = CreateObject("WScript.Shell")
shell.Run "wscript.exe """ & caminhoDoLauncher & """ /inicializacao", 1, False
WScript.Quit 0
