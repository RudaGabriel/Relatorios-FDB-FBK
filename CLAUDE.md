# Regras do projeto (para o Claude)

- **Idioma:** sempre pt-BR — respostas, código, comentários, mensagens de commit e PR.
- **Totalmente offline:** o relatório e o estoque leem **só a cópia offline**. O único
  contato com o `SMALL.FDB` principal é o `gbak` (backup em modo leitura, `-g`), na hora
  de copiar. Nada de consultas de verificação no banco principal — não pode atrapalhar
  atualização nem manutenção do PDV.
- **Somente leitura:** o projeto nunca escreve no Firebird. Só SELECT/WITH, transação
  `readOnly`. Nada de UPDATE/INSERT/DELETE, índices ou mudanças de estrutura.
- **Cópia à prova de falhas:** a cópia nova só entra depois de pronta e conferida (troca
  atômica do manifesto); temporários e órfãos são limpos na inicialização; só apagar
  arquivos com o nome que o próprio sistema cria, dentro da pasta de cópias.
- **Código à prova de erros:** antes de entregar, procurar bugs e cenários de erro no
  próprio diff (entradas inválidas, rede caindo, banco em outra máquina, Windows,
  celular, servidor encerrado no meio da cópia) e corrigir.
- **Automação, cliques mínimos:** localizar banco, `gbak` e backups sozinho; o usuário só
  intervém quando não há outra saída.
- **Changelog:** o cabeçalho de cada arquivo traz só a entrada da versão atual (mais a
  linha "Histórico completo das versões: CHANGELOG.md no repositório."). O histórico
  completo fica no `CHANGELOG.md`, com nova entrada no topo. Toda mudança de código sobe
  a versão do arquivo.
- **README sempre atualizado:** toda mudança que o usuário perceba (recurso, tela, opção,
  rota, arquivo, dependência, versão, quantidade de testes) atualiza o `README.md` no
  mesmo PR — badges de versão/testes, "Tecnologias e bibliotecas", "Uso no dia a dia",
  rotas da API e solução de problemas. Tudo claro para quem não é técnico.
- **Nada desatualizado:** a cada mudança, procurar e corrigir no mesmo PR tudo o que ficou
  antigo — README (textos, badges de versão/testes, rotas, chaves, tabelas de arquivos e
  testes, "Tecnologias"), cabeçalhos dos arquivos, textos das telas e da bandeja, comentários
  que citam rótulos/comportamentos antigos e código morto (ex.: dica que não aparece mais).
  Antes de entregar, conferir: versões dos badges = `@version` dos arquivos; contagem de
  testes = `test(` de cada arquivo; textos citados no README = textos reais das telas.
- **Projeto autônomo e neutro:** sem citar outros projetos, programas ou marcas de terceiros
  (o PDV é "PDV"/"banco do PDV"); só ficam os caminhos/arquivos necessários ao funcionamento
  e os avisos de licença em `LICENCAS-TERCEIROS.txt`. Créditos do autor (Ruda Gabriel)
  sempre explícitos no README, nos cabeçalhos e no `package.json`.
- **Ortografia e linguagem formal:** sempre revisar ortografia, acentuação, concordância e
  pontuação de todo texto novo ou alterado — telas, avisos, bandeja, mensagens de log e de
  erro, README, CHANGELOG, comentários, commits e PRs. Tudo em português do Brasil formal
  (sem gírias nem informalidades como "de novo", "no ar", "sozinho", "pra", "dá"); o que
  não estiver formal deve ser reescrito formalmente. Nos arquivos do Windows (100% ASCII),
  os acentos continuam como `\uXXXX`.
- **Exemplos neutros:** placeholders, exemplos, testes e documentação sem nomes de
  pessoas, clientes, lojas ou marcas (ex.: "Celular do Caixa 1", RAÇÃO GATO 1KG, FULANO).
- **Arquivos do Windows:** `iniciar-tray.ps1`, `api.ps1` e os `.vbs` ficam 100% ASCII
  (acentos no tray como `\uXXXX`, convertidos por `L()`); preservar BOM/CRLF onde existir.
- **Antes de entregar:** testes verdes (rodar `test/offline.test.js`, `test/estoque.test.js`
  e `test/relatorio.test.js` separadamente se o `npm test` estourar memória).
- **Pull requests:** depois de abrir o PR e com os testes verdes, **fazer o merge
  automaticamente** (pedido do dono do repositório) — não esperar aprovação manual.
