<div align="center">

# 📦 Relatórios SmallSoft Offline

### Vendas do dia e consulta de estoque do Small Commerce, lendo uma **cópia offline** do banco Firebird

<img alt="versão: 1.5.1" src="https://img.shields.io/badge/vers%C3%A3o-1.5.1-2563EB?style=flat">
<img alt="servidor: v3.5.1" src="https://img.shields.io/badge/servidor-v3.5.1-2563EB?style=flat">
<img alt="cópia offline: v1.4.0" src="https://img.shields.io/badge/c%C3%B3pia%20offline-v1.4.0-0D9488?style=flat">
<img alt="estoque: v1.1.0" src="https://img.shields.io/badge/estoque-v1.1.0-0D9488?style=flat">
<img alt="gerador: v3.26.1" src="https://img.shields.io/badge/gerador-v3.26.1-2563EB?style=flat">
<img alt="bandeja: v1.6.1" src="https://img.shields.io/badge/bandeja-v1.6.1-2563EB?style=flat">
<img alt="testes: 46 passando" src="https://img.shields.io/badge/testes-46%20passando-22C55E?style=flat">

<img alt="plataforma: Windows 10 | 11" src="https://img.shields.io/badge/plataforma-Windows%2010%20%7C%2011-0078D4?style=flat&logo=windows&logoColor=white">
<img alt="banco: somente leitura" src="https://img.shields.io/badge/banco-somente%20leitura-DC2626?style=flat">
<img alt="modo: offline" src="https://img.shields.io/badge/modo-offline-0891B2?style=flat">
<img alt="funciona: sem internet" src="https://img.shields.io/badge/funciona-sem%20internet-0891B2?style=flat">
<img alt="idioma: pt-BR" src="https://img.shields.io/badge/idioma-pt--BR-16A34A?style=flat">
<img alt="licença: proprietária" src="https://img.shields.io/badge/licen%C3%A7a-propriet%C3%A1ria-6B7280?style=flat">

<img alt="Node.js: 18+" src="https://img.shields.io/badge/Node.js-18%2B-339933?style=flat&logo=nodedotjs&logoColor=white">
<img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=flat&logo=javascript&logoColor=black">
<img alt="HTML5" src="https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white">
<img alt="CSS" src="https://img.shields.io/badge/CSS-1572B6?style=flat&logo=css&logoColor=white">
<img alt="Firebird: Small Commerce" src="https://img.shields.io/badge/Firebird-Small%20Commerce-B71C1C?style=flat">
<img alt="gbak: backup e restore" src="https://img.shields.io/badge/gbak-backup%20e%20restore-B71C1C?style=flat">
<img alt="node-firebird" src="https://img.shields.io/badge/node--firebird-driver-CB3837?style=flat&logo=npm&logoColor=white">
<img alt="PowerShell: 5.1" src="https://img.shields.io/badge/PowerShell-5.1-012456?style=flat">
<img alt="WinForms: bandeja" src="https://img.shields.io/badge/WinForms-bandeja%20do%20Windows-512BD4?style=flat&logo=dotnet&logoColor=white">
<img alt="SSE: tempo real" src="https://img.shields.io/badge/SSE-tempo%20real-7C3AED?style=flat">
<img alt="ZXing: leitor de código de barras" src="https://img.shields.io/badge/ZXing-c%C3%B3digo%20de%20barras-111827?style=flat">
<img alt="WebAssembly" src="https://img.shields.io/badge/WebAssembly-leitor-654FF0?style=flat&logo=webassembly&logoColor=white">
<img alt="node:test" src="https://img.shields.io/badge/node%3Atest-testes%20nativos-5FA04E?style=flat&logo=nodedotjs&logoColor=white">

**Abre mesmo com o banco principal em atualização ou manutenção · Nunca escreve no banco · Tudo automático · Funciona sem internet**

[Visão geral](#visao) · [Instalar](#instalacao) · [Usar](#uso) · [Cópia offline](#copia) · [Estoque](#estoque) · [Bandeja](#bandeja) · [Configurar](#configuracao) · [Segurança](#seguranca) · [API](#api) · [Problemas](#problemas) · [Tecnologias](#tecnologias)

</div>

---

<a id="visao"></a>
## 🧭 Visão geral

O **Relatórios SmallSoft Offline** é um servidor local para Windows que mostra as **vendas do dia** e a **consulta completa de estoque** do Small Commerce no navegador do computador ou do celular, **sem consultar o banco principal**.

Ele mantém sozinho uma **cópia offline** do `SMALL.FDB`, feita com as ferramentas oficiais do Firebird, e todas as telas leem **só essa cópia**. Com isso, o relatório continua abrindo quando o banco principal está em atualização, em manutenção, travado ou desligado, e o caixa nunca é atrapalhado.

| | |
|---|---|
| 🗄️ **Cópia offline automática** | Atualizada sozinha a cada poucos minutos, com **barra de progresso** e troca para a cópia nova sem recarregar a tela. |
| 🔒 **Zero risco para os dados** | Leitura pelo próprio Firebird (`gbak` em modo leitura, sem coleta de lixo). A cópia é restaurada como banco **somente leitura**. O banco principal nunca é alterado. |
| 🧾 **Relatório de vendas completo** | Hoje, uma data ou um período: Gerencial, NFC-e e NF-e, vendedores, formas de pagamento, itens, busca avançada, gráficos e temas. |
| 🔎 **Consulta de estoque sem limites** | Todos os itens, busca em todas as colunas (nome, código, código de barras, referência, fornecedor…), leitor de código de barras pela câmera e exportação para Excel. |
| 🌐 **Rede da loja e celular** | Abre em qualquer aparelho da rede; no celular, por QR code. Encontra sozinho o banco em outra máquina. |
| 🤖 **Mínimo de cliques** | Instala dependências, acha o banco, o `gbak` e os backups `.fbk`, recupera-se de falhas e limpa o que ficou pela metade. |

> Versão offline do *Relatórios FDB*: traz todos os recursos dele e pode ser instalada **na mesma máquina**, com porta, tarefa agendada, pasta de dados e ícone de bandeja próprios.

---

<a id="instalacao"></a>
## 🚀 Instalação em 3 passos

> **Requisitos:** Windows 10 ou 11 · Firebird do Small Commerce instalado **nesta máquina** (é ele que abre a cópia offline). O Node.js 18+ e o módulo `node-firebird` são instalados sozinhos.

1. **Copie a pasta do sistema** para o computador (o do banco ou um terminal da rede).
2. **Execute `instalar-na-inicializacao.bat`.** Ele pede permissão de administrador, instala o que faltar, libera a porta **7735** no firewall, cria a inicialização automática e já liga o servidor.
3. **Abra:** duplo clique no ícone da bandeja ou `http://localhost:7735`.

Na primeira vez aparece **Preparando a cópia offline**, com barra de progresso, até a primeira cópia ficar pronta. Depois disso, o canto da tela mostra sempre de quando são os dados (**Offline · dados de 29/10/2026 14:32**).

> 💡 Banco com senha própria? Defina `fbUser` e `fbPass` no `config.json`.
> Só quer testar? Execute `gerar_relatorio_do_dia.bat`. Para remover a inicialização automática: `remover-inicializacao.bat` (mexe só nos processos **desta** pasta).

---

<a id="uso"></a>
## 🖥️ Uso no dia a dia

| Quero… | Como |
|---|---|
| Ver as vendas de hoje | Duplo clique no ícone da bandeja · `http://IP:7735/` |
| Ver uma data ou um período | Botão **Por período** · bandeja → *Gerar por período...* · `gerar_relatorio_por_data.bat` / `gerar_relatorio_intervalo.bat` |
| Consultar o estoque | Botão **Estoque** · bandeja → *Consultar estoque* · `http://IP:7735/estoque` |
| Ler um código de barras | No estoque: botão **Ler código** (câmera) ou leitor USB direto no campo de busca |
| Abrir no celular | Botão **Celular** (QR code) · bandeja → *Abrir no celular (QR code)...* |
| Saber de quando são os dados | Selo **Offline** no canto da tela · cabeçalho do menu da bandeja |
| Atualizar a cópia agora | Clique no selo → *Atualizar cópia agora* · bandeja → *Cópia offline do banco → Atualizar a cópia agora* |
| Acompanhar uma cópia em andamento | Selo e página de espera mostram **porcentagem, tempo decorrido e quanto falta**; a bandeja mostra *copiando N%* |
| Configurar | Botão **Configurações** · bandeja → *Configurações → Editar configurações...* (funciona com qualquer tela aberta, inclusive o estoque) |
| Trocar o banco | Bandeja → *Configurações → Selecionar banco (FDB)...* |
| Ver o log | Bandeja → *Ferramentas → Abrir o log* ou *Acompanhar o log ao vivo* |

---

<a id="copia"></a>
## 🗄️ Cópia offline

### Como funciona

```
 SMALL.FDB ──1. gbak -b -g (leitura pelo Firebird, foto consistente)──▶ backup temporário
                                                                          │
                                2. gbak -c -mode read_only ◀──────────────┘
                                               │
                                               ▼
                    SMALL_OFFLINE_AAAAMMDD_HHMMSS.FDB (somente leitura) ── conferida
                                               │
                                               ▼
                         troca atômica ──▶ relatório e estoque leem daqui
```

- **Nenhuma conexão direta com o banco principal.** O relatório e o estoque leem **só a cópia**. O único contato com o `SMALL.FDB` é o `gbak`, na hora de copiar.
- **O gbak direto é seguro?** Sim. É o método recomendado pelo próprio Firebird: lê por dentro do servidor, numa "foto" consistente do banco, e com `-g` não faz nem a coleta de lixo. O banco do caixa não é alterado. É o método padrão (`"offlineMetodo": "gbak"`).
- **Quando atualiza:** a cada **5 min** (`offlineCopiaACadaMin`) e antes disso quando o tamanho ou a data do arquivo mudam (olhados sem abrir o banco). O intervalo mínimo cresce sozinho para 3× a duração da última cópia: a cópia nunca ocupa o banco mais que 1/3 do tempo.
- **Progresso visível:** barra com porcentagem, tempo decorrido e estimativa do que falta, no selo, na página de espera e na bandeja. A porcentagem é calculada pelo tamanho dos arquivos que o `gbak` está gravando e nunca volta para trás.

### Segurança dos dados durante a cópia

| Situação | O que acontece |
|---|---|
| Falha no meio da cópia (banco em manutenção, disco cheio, erro do gbak) | Os temporários são apagados e o sistema **continua com a cópia anterior**. O motivo aparece no selo, na bandeja e no log. |
| Servidor encerrado pela bandeja ou pelo Gerenciador de Tarefas durante a cópia | A cópia em uso não é afetada: a nova só entra **depois de pronta e conferida**. Na próxima inicialização, os temporários são apagados e qualquer `gbak`/`gfix` que tenha ficado rodando na pasta de cópias é encerrado antes de começar de novo. |
| Banco principal fora do ar | O selo fica amarelo (*Banco principal indisponível*) e o relatório segue com a última cópia. Quando ele volta, a cópia é atualizada sozinha. |
| Sem banco e sem cópia | O sistema procura um backup `SMALL.fbk` nos lugares conhecidos e restaura. Também dá para escolher um `.fbk` em *Selecionar banco*. |

### Banco em outra máquina (terminal)

O sistema localiza o `SMALL.FDB` **sem conectar no banco**: `config.json` → pastas do Small Commerce → arquivos de configuração do Small → unidades de rede mapeadas → compartilhamentos → máquinas da rede com a porta 3050 aberta (só teste de porta).

Num terminal com o banco numa unidade de rede (ex.: `H:\SMALL.FDB`), ele descobre de qual máquina vem a unidade (`net use`) e o `gbak` tenta o Firebird dela nos caminhos padrão do Small. O endereço que funcionar fica salvo (`fbHost`/`fdbPath`). Se nenhum funcionar, o último recurso é copiar o arquivo pela unidade de rede e converter aqui.

<details>
<summary><b>Opcional: cópia pelo arquivo (pasta temporária)</b></summary>

Com `"offlineMetodo": "auto"`, o sistema copia o `SMALL.FDB` para `copias\temp` sem conectar no banco (espera alguns segundos sem gravação e só aceita a cópia se o arquivo não mudou do começo ao fim), valida com o `gfix` e converte com o `gbak` local; se a cópia do arquivo não sair íntegra, usa o `gbak` direto. Com `"arquivo"`, nunca usa o `gbak` direto.

Atenção: no **Firebird 3 ou mais novo**, se ninguém estiver conectado no instante da leitura do arquivo e o caixa abrir uma conexão nova, essa conexão pode falhar e precisar ser repetida. Por isso o padrão é o `gbak` direto.

</details>

**Onde ficam as cópias:** `C:\ProgramData\RelatoriosSmallSoftOffline\copias` (disco local; o Firebird não abre banco em pasta de rede). Ficam a cópia em uso e o último backup `.fbk`. O sistema só apaga arquivos com o nome que ele mesmo cria, dentro dessa pasta.

---

<a id="estoque"></a>
## 🔎 Consulta de estoque

Todos os itens da tabela `ESTOQUE`, lidos da cópia offline (não pesa no caixa) e guardados em memória: a busca responde na hora, mesmo com dezenas de milhares de produtos.

| Digite | Encontra |
|---|---|
| `racao gato` | itens com as duas palavras, em qualquer coluna |
| `"cao filhote"` | a frase exata |
| `racao -gato` | ração, menos as de gato |
| `7891000100103` | código de barras (com ou sem pontos/traços no cadastro), o exato primeiro |
| `123` | o código `00123` em primeiro (zeros à esquerda) |

- **Caixa "Contém"** (marcada por padrão): acha o texto em qualquer parte, ou seja, `ato` acha *GATO*. **Desmarcada:** só itens que **começam** com o texto digitado em algum campo (descrição, código, barras, referência…), ou seja, `racao` acha *RAÇÃO GATO 1KG*, mas `gato` não. A escolha fica salva em cada aparelho.
- **Sem acento e sem maiúsculas:** `racao` acha *RAÇÃO*.
- **Filtros:** com estoque, sem estoque, negativo, abaixo do mínimo, só ativos (o sentido da coluna de situação é reconhecido pelos próprios dados). **Ordem:** relevância, nome, código, estoque, preço.
- **Detalhe do item:** todas as colunas do cadastro, com botão de copiar código e código de barras.
- **Totais** do resultado (estoque somado e valor de venda) e **Exportar** para CSV/Excel com todas as colunas.
- **Contador fixo** que acompanha a rolagem (*mostrando 200 de 1.234 encontrados*) e botão **Topo**.
- **Leitor de código de barras pela câmera** (o mesmo do *Controle de Vencimento*): EAN-13/8, UPC, Code 128/39/93, ITF, Codabar, QR e Data Matrix, com flash, troca de câmera, zoom e *Tirar foto do código*. As bibliotecas ficam na pasta `leitor/`, então **funciona sem internet**. A câmera ao vivo só é liberada pelo navegador em página segura (`http://localhost:7735`); pela rede, o botão abre a **foto** pela câmera do celular, lida do mesmo jeito.
- **Atalhos:** `/`, `F3` ou `Ctrl+F` vão para a busca; `Esc` limpa ou fecha.

---

<a id="bandeja"></a>
## 🛠️ Bandeja do Windows

O ícone da bandeja mostra o estado ao vivo (data da cópia em uso e, durante uma cópia, *copiando N%*) e reúne tudo em um menu:

| Grupo | Itens |
|---|---|
| **Abrir** | Abrir relatório · Abrir em nova aba · Abrir no celular (QR code) · Consultar estoque |
| **Relatório** | Atualizar dados de hoje · Gerar por período |
| **Cópia offline do banco** | Atualizar a cópia agora · Situação da cópia · Abrir a pasta das cópias |
| **Telas abertas** | Trazer para frente · Recarregar todas · Enviar aviso · Tema das telas |
| **Configurações** | Editar configurações · Selecionar banco (FDB) · Status do banco de dados |
| **Ferramentas** | Informações do sistema · Copiar endereço · Pasta do sistema · Log · Log ao vivo · Cliente da API · Programas |
| **Sistema** | Dispositivos conectados · Reiniciar servidor · Sair |

Os comandos chegam a **qualquer tela aberta**: relatório, período, página de carregamento e estoque.

---

<a id="configuracao"></a>
## ⚙️ Configuração (`config.json`)

A maior parte é editada pela própria tela (**Configurações**), no computador do servidor. Todas as chaves do *Relatórios FDB* continuam valendo (`appName`, `fbUser`/`fbPass`, `proibidos`, `teclasPersonalizadas`, `programas`…). Chaves da versão offline:

| Chave | Padrão | Para que serve |
|---|---|---|
| `porta` | `7735` | Porta HTTP (o *Relatórios FDB* usa 7734) |
| `fdbArquivo` | automático | Caminho do arquivo do banco (local, `Z:\...` ou `\\servidor\pasta\SMALL.FDB`) |
| `offlineMetodo` | `"gbak"` | `gbak` (padrão, seguro), `auto` (copia o arquivo e converte; `gbak` direto de reserva) ou `arquivo` |
| `offlineCopiaACadaMin` | `5` | Refaz a cópia a cada N min, mesmo sem mudança detectada (1 a 1440) |
| `offlineIntervaloMin` | `5` | Intervalo mínimo entre cópias (1 a 1440 min) |
| `offlineVerificarSeg` | `20` | A cada quantos segundos olha o arquivo do banco, sem conectar (5 a 3600) |
| `offlineQuietoSeg` | `5` | Métodos `auto`/`arquivo`: segundos sem gravação antes de copiar o arquivo (0 a 600) |
| `offlineMaxIdadeMin` | `180` | Refaz a cópia depois desse tempo mesmo sem mudança |
| `offlineTimeoutMin` | `30` | Tempo máximo de uma cópia (banco muito grande: aumente) |
| `offlinePasta` | automático | Pasta das cópias (disco local desta máquina) |
| `gbakPath` | automático | Caminho do `gbak.exe` (padrão: o do Firebird em execução) |
| `offlineManterFbk` | `true` | Guarda o último backup `.fbk` (segurança extra) |
| `fastPollCopiaMs` | `2000` | Intervalo da verificação interna sobre a cópia (0 a 60000 ms) |

---

<a id="seguranca"></a>
## 🔒 Somente leitura e segurança

- **Nunca escreve no banco do Small Commerce:** nenhum `INSERT`, `UPDATE`, `DELETE` ou alteração de estrutura. Só passa SQL que começa com `SELECT` ou `WITH`, sempre em transação **somente leitura** do Firebird.
- **Banco principal intocado:** só o `gbak` (em modo leitura) acessa o `SMALL.FDB`; relatório e estoque leem a cópia, restaurada como banco **somente leitura**.
- **Senha do Firebird por variável de ambiente**, nunca pela linha de comando.
- **Gravação atômica** do manifesto da cópia, do `config.json` e dos relatórios.
- **Apagar só o que é seu:** temporários e cópias antigas são removidos apenas pelo nome que o próprio sistema cria, dentro da pasta de cópias.
- Proteção contra **XSS**, validação de todas as entradas da API e rotas sensíveis (reiniciar, log, programas) **só da rede local**. Configurações do sistema e troca de banco **só do computador do servidor**.

---

<a id="api"></a>
## 🔌 API

Todas as rotas do *Relatórios FDB* continuam disponíveis (veja o `api.ps1`, com menu interativo). Rotas da versão offline:

| Rota | Método | Descrição |
|---|---|---|
| `/api/offline` | GET | Estado da cópia: modo, data dos dados, banco principal no ar, etapa e **progresso** (`pct`, decorrido, restante), último erro |
| `/api/offline/atualizar` | POST/GET | Faz uma cópia nova já (rede local) |
| `/api/offline/importar` | POST | `{ "caminho": "C:\\...\\SMALL.fbk" }` restaura um backup como cópia (computador do servidor) |
| `/estoque` | GET | Tela da consulta de estoque |
| `/api/estoque?q=&estoque=&ordem=&ativos=1&contem=1&pagina=&limite=` | GET | Busca (até 1000 por página; `estoque`: todos/com/sem/negativo/abaixo; `contem=0`: só itens que começam com o texto) |
| `/api/estoque/item?id=N` | GET | Todas as colunas de um item |
| `/api/estoque/csv?q=...` | GET | CSV com todos os resultados |
| `/api/navigate/config` · `/hash/periodo` · `/hoje` · `/foco` · `/recarregar` · `/aviso` | GET/POST | Comandam as telas abertas via SSE (inclusive o estoque) |

---

<a id="problemas"></a>
## 🩺 Solução de problemas

| Sintoma | O que fazer |
|---|---|
| "Preparando a cópia offline" não sai / selo "cópia indisponível" | Clique no selo para ver o motivo. Normalmente: `gbak.exe` não encontrado (informe `gbakPath`) ou Firebird não instalado nesta máquina |
| Terminal: "Error while trying to open file" | O banco está em outra máquina. Confira no log qual endereço o `gbak` tentou; se preciso, informe `IP:C:\...\SMALL.FDB` em *Selecionar banco* |
| "O Firebird não está rodando nesta máquina" | Instale ou inicie o Firebird (mesma versão do servidor) aqui |
| "não permite criar a cópia nesta pasta" | No `firebird.conf`, `DatabaseAccess` está restrito: libere a pasta das cópias ou mude `offlinePasta` |
| Cópia demora muito | Aumente `offlineIntervaloMin` (e `offlineTimeoutMin` se der tempo esgotado). A barra de progresso mostra quanto falta |
| Estoque: ativos e inativos trocados | O log mostra a linha *Estoque: coluna de situação …* com a coluna e a interpretação usada; envie essa linha ao suporte |
| Qualquer outro problema | `relatorio.log` (bandeja → *Ferramentas → Abrir o log*), categorias `[OFFLINE]` e `[ESTOQUE]` |

---

## 🧪 Testes

```bash
npm test
```

**46 testes**, sem Firebird real (Firebird, `gbak` e `gfix` simulados em `test/`):

| Arquivo | Cobre |
|---|---|
| `test/offline.test.js` (14) | Primeira cópia, falhas, troca atômica, limpeza, progresso, terminal com banco em rede, métodos `auto`/`arquivo`, `.fbk` |
| `test/estoque.test.js` (4) | Busca, "Contém", filtros, ordem, situação ativo/inativo, detalhe, CSV, leitor, comandos da bandeja |
| `test/relatorio.test.js` (28) | Somente leitura, XSS, rotas, tempo real e demais testes herdados do *Relatórios FDB* |

---

<a id="tecnologias"></a>
## 🧰 Tecnologias e bibliotecas

| Tecnologia | Uso |
|---|---|
| **Node.js 18+** | Servidor HTTP, gerador do relatório e cópia offline (sem frameworks) |
| **Firebird** (`gbak`, `gfix`) | Backup em modo leitura e restauração da cópia como banco somente leitura |
| **node-firebird** | Driver de leitura da cópia, envolvido por uma camada que só permite `SELECT`/`WITH` |
| **HTML5, CSS e JavaScript** | Telas do relatório e do estoque, sem dependências externas |
| **SSE (Server-Sent Events)** | Atualização em tempo real e comandos da bandeja para as telas |
| **PowerShell 5.1 + WinForms** | Ícone e menu da bandeja, instalação e cliente da API (`api.ps1`) |
| **ZXing (zxing-wasm 3.1.3, @zxing/library 0.23.0) + barcode-detector 3.2.2** | Leitura de código de barras pela câmera, em WebAssembly, servida localmente |
| **node:test** | Testes nativos, com Firebird e gbak simulados |

---

## 🗂️ Arquivos

| Arquivo | Função |
|---|---|
| `servidor-relatorio.js` | Servidor HTTP, rotas, SSE, selo da cópia offline |
| `gerar-relatorio-html.js` | Gerador do relatório (lê a cópia) |
| `offline-copia.js` | Cópia offline: gbak, progresso, conferência, troca atômica, limpeza |
| `localizar-banco.js` | Localiza o `SMALL.FDB` (local, rede, terminais) sem conectar no banco |
| `estoque-offline.js` · `estoque.html` | Consulta de estoque (dados e tela) |
| `leitor/` | Leitor de código de barras e bibliotecas locais |
| `iniciar-tray.ps1` · `api.ps1` | Bandeja do Windows e cliente da API |
| `*.bat` · `*.vbs` | Instalação, inicialização automática e atalhos |
| `CHANGELOG.md` | Histórico completo das versões |

---

<div align="center">

**Desenvolvido por Ruda Gabriel**: concepção, regras de negócio e manutenção.

© 2026 Ruda Gabriel. Todos os direitos reservados.

</div>
