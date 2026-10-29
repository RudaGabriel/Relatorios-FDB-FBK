# Regras do projeto (para o Claude)

- **Idioma:** sempre pt-BR — respostas, código, comentários, mensagens de commit e PR.
- **Totalmente offline:** o relatório e o estoque leem **só a cópia offline**. O único
  contato com o `SMALL.FDB` principal é o `gbak` (backup em modo leitura, `-g`), na hora
  de copiar. Nada de consultas de verificação no banco principal — não pode atrapalhar
  atualização nem manutenção do Small Commerce.
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
- **Exemplos neutros:** placeholders, exemplos, testes e documentação sem nomes de
  pessoas, clientes, lojas ou marcas (ex.: "Celular do Caixa 1", RAÇÃO GATO 1KG, FULANO).
- **Arquivos do Windows:** `iniciar-tray.ps1`, `api.ps1` e os `.vbs` ficam 100% ASCII
  (acentos no tray como `\uXXXX`, convertidos por `L()`); preservar BOM/CRLF onde existir.
- **Antes de entregar:** testes verdes (rodar `test/offline.test.js`, `test/estoque.test.js`
  e `test/relatorio.test.js` separadamente se o `npm test` estourar memória).
- **Pull requests:** depois de abrir o PR e com os testes verdes, **fazer o merge
  automaticamente** (pedido do dono do repositório) — não esperar aprovação manual.
