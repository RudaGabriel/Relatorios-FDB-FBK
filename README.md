<div align="center">

# 📦 Relatórios Offline

### Vendas do dia e consulta de estoque do PDV, lendo uma **cópia offline** do banco Firebird

<img alt="versão: 1.9.5" src="https://img.shields.io/badge/vers%C3%A3o-1.9.5-2563EB?style=flat">
<img alt="servidor: v3.7.10" src="https://img.shields.io/badge/servidor-v3.7.10-2563EB?style=flat">
<img alt="cópia offline: v1.6.1" src="https://img.shields.io/badge/c%C3%B3pia%20offline-v1.6.1-0D9488?style=flat">
<img alt="estoque: v1.2.2" src="https://img.shields.io/badge/estoque-v1.2.2-0D9488?style=flat">
<img alt="gerador: v3.26.7" src="https://img.shields.io/badge/gerador-v3.26.7-2563EB?style=flat">
<img alt="bandeja: v1.7.8" src="https://img.shields.io/badge/bandeja-v1.7.8-2563EB?style=flat">
<img alt="testes: 49 passando" src="https://img.shields.io/badge/testes-49%20passando-22C55E?style=flat">

<img alt="plataforma: Windows 10 | 11" src="https://img.shields.io/badge/plataforma-Windows%2010%20%7C%2011-0078D4?style=flat&logo=windows&logoColor=white">
<img alt="banco: somente leitura" src="https://img.shields.io/badge/banco-somente%20leitura-DC2626?style=flat">
<img alt="modo: offline" src="https://img.shields.io/badge/modo-offline-0891B2?style=flat">
<img alt="funciona: sem internet" src="https://img.shields.io/badge/funciona-sem%20internet-0891B2?style=flat">
<img alt="idioma: pt-BR" src="https://img.shields.io/badge/idioma-pt--BR-16A34A?style=flat">
<img alt="licença: proprietária" src="https://img.shields.io/badge/licen%C3%A7a-propriet%C3%A1ria-6B7280?style=flat">
<a href="https://github.com/RudaGabriel"><img alt="autor: Ruda Gabriel" src="https://img.shields.io/badge/autor-Ruda%20Gabriel-111827?style=flat&logo=github&logoColor=white"></a>

<img alt="Node.js: 18+" src="https://img.shields.io/badge/Node.js-18%2B-339933?style=flat&logo=nodedotjs&logoColor=white">
<img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=flat&logo=javascript&logoColor=black">
<img alt="HTML5" src="https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white">
<img alt="CSS" src="https://img.shields.io/badge/CSS-1572B6?style=flat&logo=css&logoColor=white">
<img alt="Firebird: banco do PDV" src="https://img.shields.io/badge/Firebird-banco%20do%20PDV-B71C1C?style=flat">
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

O **Relatórios Offline** é um servidor local para Windows que mostra as **vendas do dia** e a **consulta completa de estoque** do PDV no navegador do computador ou do celular, **sem consultar o banco principal**.

Ele mantém automaticamente uma **cópia offline** do `SMALL.FDB`, feita com as ferramentas oficiais do Firebird, e todas as telas leem **só essa cópia**. Com isso, o relatório continua abrindo quando o banco principal está em atualização, em manutenção, travado ou desligado, e o caixa nunca é atrapalhado.

| | |
|---|---|
| 🗄️ **Cópia offline automática** | Atualizada automaticamente a cada poucos minutos, com **barra de progresso** e troca para a cópia nova sem recarregar a tela. |
| 🔒 **Zero risco para os dados** | Leitura pelo próprio Firebird (`gbak` em modo leitura, sem coleta de lixo). A cópia é restaurada como banco **somente leitura**. O banco principal nunca é alterado. |
| 🧾 **Relatório de vendas completo** | Hoje, uma data ou um período: Gerencial, NFC-e e NF-e, vendedores, formas de pagamento, itens, busca avançada, gráficos e temas. |
| 🔎 **Consulta de estoque sem limites** | Todos os itens, busca em todas as colunas (nome, código, código de barras, referência, fornecedor…), leitor de código de barras pela câmera e exportação para Excel. |
| 🌐 **Rede da loja e celular** | Abre em qualquer aparelho da rede; no celular, por QR code. Localiza automaticamente o banco em outra máquina. |
| 🤖 **Mínimo de cliques** | Instala dependências, acha o banco, o `gbak` e os backups `.fbk`, recupera-se de falhas e limpa o que ficou pela metade. |

> Sistema autônomo: tem porta, tarefa agendada, pasta de dados e ícone de bandeja próprios — pode conviver com outros sistemas na mesma máquina.

---

<a id="instalacao"></a>
## 🚀 Instalação em 3 passos

> **Requisitos:** Windows 10 ou 11 · Firebird do PDV instalado **nesta máquina** (é ele que abre a cópia offline). O Node.js 18+ e o módulo `node-firebird` são instalados automaticamente.

1. **Copie a pasta do sistema** para o computador (o do banco ou um terminal da rede).
2. **Execute `instalar-na-inicializacao.bat`.** A janela da instalação mostra cada etapa: ela pede permissão de administrador, instala o que faltar, libera a porta **7735** no firewall, cria a inicialização automática e já inicia o servidor. Daí em diante, ao **ligar o computador ou entrar no Windows**, o sistema inicia **em silêncio** — nenhuma janela nem balão; apenas o ícone na bandeja.
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
| Ler um código de barras | No estoque: botão **Ler código** (leitura em tempo real pela câmera, também no celular) ou leitor USB direto no campo de busca |
| Abrir no celular | Botão **Celular** (QR code) · bandeja → *Abrir no celular (QR code)...* |
| Abrir fora da loja (4G, outro Wi-Fi) | **Celular → Fora da loja**, com o Tailscale nos dois aparelhos. O endereço usa o **nome fixo** da máquina no Tailscale (ex.: `http://pc-loja.tailxxxx.ts.net:7735/`); o IP `100.x` também funciona. Trocar de endereço não perde o apelido nem as preferências do aparelho |
| Recarregar a cada venda | *Configurações → Nesta tela → Atualização*. Ligado: recarrega como um F5 (limpa busca, filtros e janelas). Desligado: as vendas entram sem recarregar |
| Saber de quando são os dados | Selo **Offline** no canto da tela (no celular fica recolhido numa bolinha no canto esquerdo: toque para ver; recolhe automaticamente em 5 s ou ao deslizar para a esquerda/para baixo) · cabeçalho do menu da bandeja |
| Atualizar a cópia agora | Clique no selo → *Atualizar cópia agora* · bandeja → *Cópia offline do banco → Atualizar a cópia agora* |
| Cancelar uma cópia em andamento | Clique no selo → *Cancelar a cópia* (também na tela *Preparando a cópia*) · bandeja → *Cópia offline do banco → Cancelar a cópia em andamento*. Pede confirmação; a cópia em uso continua valendo e a próxima cópia automática fica para depois de 30 min (*Atualizar a cópia agora* faz uma nova quando quiser) |
| Acompanhar uma cópia em andamento | Selo e página de espera mostram **porcentagem, tempo decorrido e quanto falta**; a bandeja mostra *copiando N%* |
| Configurar | Botão **Configurações** · bandeja → *Configurações → Editar configurações...* (funciona com qualquer tela aberta, inclusive o estoque; o botão **Voltar** retorna à tela de onde você veio) |
| Trocar o banco | Bandeja → *Configurações → Selecionar banco (FDB)...* |
| Ver o log | Bandeja → *Ferramentas → Abrir o log* ou *Acompanhar o log em tempo real* |

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
- **Quando atualiza:** a cada **5 min** (`offlineCopiaACadaMin`) e antes disso quando o tamanho ou a data do arquivo mudam (olhados sem abrir o banco). O intervalo mínimo cresce automaticamente para 3× a duração da última cópia: a cópia nunca ocupa o banco mais que 1/3 do tempo.
- **Progresso visível:** barra com porcentagem, tempo decorrido e estimativa do que falta, no selo, na página de espera e na bandeja. A porcentagem é calculada pelo tamanho dos arquivos que o `gbak` está gravando e nunca volta para trás.

### Segurança dos dados durante a cópia

| Situação | O que acontece |
|---|---|
| Falha no meio da cópia (banco em manutenção, disco cheio, erro do gbak) | Os temporários são apagados e o sistema **continua com a cópia anterior**. O motivo aparece no selo, na bandeja e no log. |
| Cópia cancelada pelo usuário | O `gbak`/`gfix` (ou a cópia do arquivo) é encerrado, os temporários são apagados e o sistema **continua com a cópia anterior**. Uma cópia interrompida nunca é retomada: a próxima começa do zero. |
| Servidor encerrado pela bandeja ou pelo Gerenciador de Tarefas durante a cópia | A cópia em uso não é afetada: a nova só entra **depois de pronta e conferida**. Na próxima inicialização, os temporários são apagados e qualquer `gbak`/`gfix` que tenha ficado rodando na pasta de cópias é encerrado antes de começar de novo. |
| Banco principal fora do ar | O selo fica amarelo (*Banco principal indisponível*) e o relatório segue com a última cópia. Quando ele volta, a cópia é atualizada automaticamente. |
| Sem banco e sem cópia | O sistema procura um backup `SMALL.fbk` nos lugares conhecidos e restaura. Também dá para escolher um `.fbk` em *Selecionar banco*. |

### Banco em outra máquina (terminal)

O sistema localiza o `SMALL.FDB` **sem conectar no banco**: `config.json` → pastas do PDV → arquivos de configuração do PDV → unidades de rede mapeadas → compartilhamentos → máquinas da rede com a porta 3050 aberta (só teste de porta).

Num terminal com o banco numa unidade de rede (ex.: `H:\SMALL.FDB`), ele descobre de qual máquina vem a unidade (`net use`) e o `gbak` tenta o Firebird dela nos caminhos padrão do Small. O endereço que funcionar fica salvo (`fbHost`/`fdbPath`). Se nenhum funcionar, o último recurso é copiar o arquivo pela unidade de rede e converter aqui.

<details>
<summary><b>Opcional: cópia pelo arquivo (pasta temporária)</b></summary>

Com `"offlineMetodo": "auto"`, o sistema copia o `SMALL.FDB` para `copias\temp` sem conectar no banco (espera alguns segundos sem gravação e só aceita a cópia se o arquivo não mudou do começo ao fim), valida com o `gfix` e converte com o `gbak` local; se a cópia do arquivo não sair íntegra, usa o `gbak` direto. Com `"arquivo"`, nunca usa o `gbak` direto.

Atenção: no **Firebird 3 ou mais novo**, se ninguém estiver conectado no instante da leitura do arquivo e o caixa abrir uma conexão nova, essa conexão pode falhar e precisar ser repetida. Por isso o padrão é o `gbak` direto.

</details>

**Onde ficam as cópias:** `C:\ProgramData\RelatoriosOffline\copias` (disco local; o Firebird não abre banco em pasta de rede). Ficam a cópia em uso e o último backup `.fbk`. O sistema só apaga arquivos com o nome que ele mesmo cria, dentro dessa pasta.

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
- **Leitor de código de barras pela câmera**: EAN-13/8, UPC, Code 128/39/93, ITF, Codabar, QR e Data Matrix, com flash, troca de câmera, zoom e *Tirar foto do código*. As bibliotecas ficam na pasta `leitor/`, então **funciona sem internet**. O navegador só libera a câmera ao vivo em página segura (HTTPS). Por isso o sistema também abre na porta **7736** com HTTPS: no celular, ao tocar em **Ler código**, ele leva para esse endereço (mantendo a busca) e abre o leitor ao vivo sozinho.
  - **Primeira vez no celular:** aparece um aviso de certificado. Toque em *Avançado* / *Mostrar detalhes* e depois em *Continuar* / *Visitar site*. É o certificado do próprio sistema, gerado nesta máquina, válido só na sua rede. Depois disso não pergunta mais.
  - **Sem aviso nenhum:** com o Tailscale nesta máquina e *HTTPS Certificates* ligado em <https://login.tailscale.com/admin/dns>, o sistema usa o certificado oficial do Tailscale ao abrir pelo endereço do Tailscale.
  - Se preferir, *Cancelar* no aviso abre a **foto** pela câmera do celular, lida do mesmo jeito.
- **Limpar a busca:** botão **X** dentro do campo (computador e celular).
- **Atalhos:** `/`, `F3` ou `Ctrl+F` vão para a busca; `Esc` limpa ou fecha.

### 📴 Estoque sem o servidor

Cada aparelho que abre o estoque **guarda uma cópia dele** (todos os itens, com os campos da lista), atualizada automaticamente quando o estoque muda. Se o servidor de relatórios cair, desligar ou ficar fora de alcance:

- uma faixa avisa: **"Servidor de relatórios indisponível — somente o estoque está disponível"**, com a **data e a hora** dos dados, a **quantidade de itens** e o **tamanho** da cópia (ex.: *estoque atualizado em 29/10/2026 16:26 · 9.102 itens · 3,2 MB*);
- a busca continua funcionando **com as mesmas regras** (nome, código, código de barras, "Contém", filtros, ordem), inclusive pelo leitor de código de barras;
- o detalhe do item mostra os campos principais (todas as colunas voltam com o servidor) e **Exportar** gera o CSV da cópia;
- quando o servidor volta (a página confere a cada 15 s), aparece a faixa verde **"✓ O servidor de relatórios está disponível novamente"** com o botão **Retornar aos dados em tempo real** (dentro do relatório: **Retornar ao relatório em tempo real** ou **Continuar no estoque em tempo real**) — nada é trocado automaticamente no meio de uma consulta. As duas faixas podem ser minimizadas (botão **−** ou automaticamente após 8 s) e restauradas pelo botão ⤢;
- no relatório (computador e celular), a faixa "servidor encerrado / sem conexão" avisa **"Somente o estoque está disponível"**, com a data, os itens e o tamanho, e o botão **Abrir o estoque**: ele abre em tela cheia a cópia da página do estoque guardada no aparelho — funciona em qualquer celular (inclusive iPhone), sem o servidor. Enquanto o servidor está no ar, o próprio relatório mantém essa cópia da página atualizada no aparelho que já usa o estoque; se ainda não houver cópia, a faixa explica como guardá-la.

**Abrir o estoque com o servidor já desligado** (a página não estava aberta, fechou o navegador ou reiniciou o aparelho): basta abrir o endereço do sistema normalmente — se o servidor não responder (desligado ou computador fora da rede), em até ~10 s abre **direto o estoque guardado no aparelho**. Isso funciona onde o navegador aceita guardar o site: no próprio computador (`localhost`) e pelo **endereço seguro do Tailscale** (HTTPS ligado no painel do Tailscale). Com o HTTPS do Tailscale ligado, o celular que abre pelo `http://…:7735` passa sozinho para o endereço seguro (`https://…ts.net:7736`) — guarde esse endereço nos favoritos ou na tela de início. No iPhone, use o **Safari** (ou o atalho na tela de início): o Chrome e outros navegadores do iPhone não guardam sites para abrir sem conexão. Pelo `http` ou com o certificado próprio do sistema (o que mostra aviso), o navegador não guarda o site: use o botão **Abrir o estoque** do relatório enquanto a página estiver aberta.

---

<a id="bandeja"></a>
## 🛠️ Bandeja do Windows

O ícone da bandeja mostra o estado em tempo real (data da cópia em uso e, durante uma cópia, *copiando N%*) e reúne tudo em um menu:

| Grupo | Itens |
|---|---|
| **Abrir** | Abrir relatório · Abrir em nova aba · Abrir no celular (QR code) · Consultar estoque |
| **Relatório** | Atualizar dados de hoje · Gerar por período |
| **Cópia offline do banco** | Atualizar a cópia agora · Cancelar a cópia em andamento · Situação da cópia · Abrir a pasta das cópias |
| **Telas abertas** | Trazer para frente · Recarregar todas · Enviar aviso · Tema das telas |
| **Configurações** | Editar configurações · Selecionar banco (FDB) · Status do banco de dados |
| **Ferramentas** | Informações do sistema · Copiar endereço · Pasta do sistema · Log · Log em tempo real · Cliente da API · Programas |
| **Sistema** | Dispositivos conectados · Reiniciar servidor · Sair (encerra o servidor e avisa por uma notificação do Windows, sem janela para confirmar) |

Os comandos chegam a **qualquer tela aberta**: relatório, período, página de carregamento e estoque.

---

<a id="configuracao"></a>
## ⚙️ Configuração (`config.json`)

A maior parte é editada pela própria tela (**Configurações**), no computador do servidor. Chaves gerais: `appName`, `fbUser`/`fbPass`, `proibidos`, `teclasPersonalizadas`, `programas`… Chaves da cópia offline e do estoque:

| Chave | Padrão | Para que serve |
|---|---|---|
| `porta` | `7735` | Porta HTTP |
| `fdbArquivo` | automático | Caminho do arquivo do banco (local, `Z:\...` ou `\\servidor\pasta\SMALL.FDB`) |
| `offlineMetodo` | `"gbak"` | `gbak` (padrão, seguro), `auto` (copia o arquivo e converte; `gbak` direto de reserva) ou `arquivo` |
| `offlineCopiaACadaMin` | `5` | Refaz a cópia a cada N min, mesmo sem mudança detectada (1 a 1440) |
| `offlineIntervaloMin` | `5` | Intervalo mínimo entre cópias (1 a 1440 min) |
| `offlineVerificarSeg` | `20` | A cada quantos segundos olha o arquivo do banco, sem conectar (5 a 3600) |
| `offlineQuietoSeg` | `5` | Métodos `auto`/`arquivo`: segundos sem gravação antes de copiar o arquivo (0 a 600) |
| `offlineMaxIdadeMin` | `180` | Refaz a cópia depois desse tempo mesmo sem mudança |
| `offlineTimeoutMin` | `30` | Tempo máximo de uma cópia (banco muito grande: aumente) |
| `offlineAdiarAposCancelarMin` | `30` | Depois de o usuário cancelar uma cópia, quanto tempo a próxima cópia **automática** espera (0 a 1440 min; 0 = só o intervalo mínimo) |
| `offlinePasta` | automático | Pasta das cópias (disco local desta máquina) |
| `gbakPath` | automático | Caminho do `gbak.exe` (padrão: o do Firebird em execução) |
| `offlineManterFbk` | `true` | Guarda o último backup `.fbk` (segurança extra) |
| `fastPollCopiaMs` | `2000` | Intervalo da verificação interna sobre a cópia (0 a 60000 ms) |
| `portaHttps` | porta + 1 (`7736`) | Porta HTTPS da leitura em tempo real pela câmera do celular (`0` desliga). O instalador libera essa porta no firewall |

---

<a id="seguranca"></a>
## 🔒 Somente leitura e segurança

- **Nunca escreve no banco do PDV:** nenhum `INSERT`, `UPDATE`, `DELETE` ou alteração de estrutura. Só passa SQL que começa com `SELECT` ou `WITH`, sempre em transação **somente leitura** do Firebird.
- **Banco principal intocado:** só o `gbak` (em modo leitura) acessa o `SMALL.FDB`; relatório e estoque leem a cópia, restaurada como banco **somente leitura**.
- **Senha do Firebird por variável de ambiente**, nunca pela linha de comando.
- **Gravação atômica** do manifesto da cópia, do `config.json` e dos relatórios.
- **Apagar só o que é seu:** temporários e cópias antigas são removidos apenas pelo nome que o próprio sistema cria, dentro da pasta de cópias.
- Proteção contra **XSS**, validação de todas as entradas da API e rotas sensíveis (reiniciar, log, programas) **só da rede local**. Configurações do sistema e troca de banco **só do computador do servidor**.

---

<a id="api"></a>
## 🔌 API

As rotas gerais estão no `api.ps1` (menu interativo). Rotas da cópia offline e do estoque:

| Rota | Método | Descrição |
|---|---|---|
| `/api/offline` | GET | Estado da cópia: modo, data dos dados, disponibilidade do banco principal, etapa e **progresso** (`pct`, decorrido, restante), último erro |
| `/api/offline/atualizar` | POST/GET | Faz uma cópia nova já (rede local) |
| `/api/offline/cancelar` | POST | Cancela a cópia em andamento; a cópia em uso continua (rede local) |
| `/api/offline/importar` | POST | `{ "caminho": "C:\\...\\SMALL.fbk" }` restaura um backup como cópia (computador do servidor) |
| `/estoque` | GET | Tela da consulta de estoque |
| `/api/estoque?q=&estoque=&ordem=&ativos=1&contem=1&pagina=&limite=` | GET | Busca (até 1000 por página; `estoque`: todos/com/sem/negativo/abaixo; `contem=0`: só itens que começam com o texto) |
| `/api/estoque/item?id=N` | GET | Todas as colunas de um item |
| `/api/estoque/csv?q=...` | GET | CSV com todos os resultados |
| `/api/estoque/pacote?versao=` | GET | Estoque inteiro (campos da lista + texto de busca) para o aparelho guardar; compactado (gzip); versão igual → `{ igual: true }` |
| `/api/https` | GET | Endereço HTTPS para quem pediu (`url`, `confiavel` = certificado do Tailscale) |
| `/api/navigate/config` · `/hash/periodo` · `/hoje` · `/foco` · `/recarregar` · `/aviso` | GET/POST | Comandam as telas abertas via SSE (inclusive o estoque) |

---

<a id="problemas"></a>
## 🩺 Solução de problemas

| Sintoma | O que fazer |
|---|---|
| Celular: com o servidor desligado aparece "Não é possível acessar esse site" | Abra pelo endereço seguro do Tailscale (`https://…ts.net:7736`) no **Safari** (iPhone) ou no Chrome (Android), com o servidor ligado, uma vez — e abra o estoque nele. Depois, sem o servidor, o mesmo endereço abre o estoque guardado. Pelo `http://…:7735` e no Chrome do iPhone o navegador não guarda o site |
| Remoção mostra `[ADMIN] tarefa agendada ...` | Normal: a tarefa foi criada com permissão de administrador. O removedor pede o UAC logo em seguida e a remove (linha `[OK] [admin] ...`). Só é problema se o resumo final listar pendências |
| Aparece alguma janela ao ligar o computador / entrar no Windows | A partida automática é silenciosa desde a versão 1.8.6. Execute o `instalar-na-inicializacao.bat` uma vez para atualizar a inicialização automática. Avisos dessa partida ficam no `relatorio.log` (linhas "Partida automatica") |
| "Preparando a cópia offline" não sai / selo "cópia indisponível" | Clique no selo para ver o motivo. Normalmente: `gbak.exe` não encontrado (informe `gbakPath`) ou Firebird não instalado nesta máquina |
| Terminal: "Error while trying to open file" | O banco está em outra máquina. Confira no log qual endereço o `gbak` tentou; se preciso, informe `IP:C:\...\SMALL.FDB` em *Selecionar banco* |
| "O Firebird não está rodando nesta máquina" | Instale ou inicie o Firebird (mesma versão do servidor) aqui |
| "não permite criar a cópia nesta pasta" | No `firebird.conf`, `DatabaseAccess` está restrito: libere a pasta das cópias ou mude `offlinePasta` |
| Cópia demora muito | Aumente `offlineIntervaloMin` (e `offlineTimeoutMin` se der tempo esgotado). A barra de progresso mostra quanto falta |
| Estoque: ativos e inativos trocados | O log mostra a linha *Estoque: coluna de situação …* com a coluna e a interpretação usada; envie essa linha ao suporte |
| Instalador: "falha ao criar o bootstrap" / antivírus acusa `bootstrap.vbs` | Falso positivo. Em *Segurança do Windows → Proteção contra vírus e ameaças → Histórico de proteção*, escolha *Permitir no dispositivo* e execute o instalador novamente |
| Celular: "Ler código" só tira foto / não abre a leitura em tempo real | Execute o instalador novamente (ele libera a porta 7736 no firewall) e aceite o aviso de certificado na primeira vez. O log mostra `HTTPS (leitura em tempo real pela câmera do celular): porta 7736` |
| Instalação nova: "Node.js não foi instalado corretamente" na 1ª vez | Corrigido na versão 1.6.0 (o instalador espera o Node terminar e relê o PATH). Se ainda ocorrer, execute o instalador novamente |
| Bandeja avisa "Preparando a cópia offline do banco" | Normal na primeira vez (ou depois de apagar as cópias): o relatório será aberto automaticamente quando a cópia estiver pronta. O banco principal só é lido pelo gbak, em modo leitura |
| Servidor reinicia sozinho a cada minuto | Corrigido na 1.6.5: com o banco numa unidade de rede lenta ou fora do ar, o servidor travava esperando a rede e a bandeja o reiniciava. Se continuar, veja no `relatorio.log` as linhas `[TRAY]` ("sem resposta na checagem", "forçando reinício" ou "processo não está mais ativo") |
| "Falha ao iniciar node: spawn ... node.exe ENOENT" | O Node.js foi atualizado ou reinstalado com o servidor ligado. Desde a 1.6.6 o servidor localiza o Node novamente de forma automática; se a mensagem continuar, use *Reiniciar servidor* na bandeja |
| Fica em "Iniciando servidor de relatórios..." / log diz "Outra instância já está rodando" | Corrigido na 1.8.1: depois de **Sair**, a bandeja ficava presa esperando o OK de uma janela escondida. Agora ela termina de verdade, e uma bandeja presa é encerrada sozinha ao abrir de novo (~20 s). Na primeira vez depois de atualizar, se ainda acontecer, reinicie o computador |
| Qualquer outro problema | `relatorio.log` (bandeja → *Ferramentas → Abrir o log*), categorias `[OFFLINE]` e `[ESTOQUE]` |

---

## 🧪 Testes

```bash
npm test
```

**49 testes**, sem Firebird real (Firebird, `gbak` e `gfix` simulados em `test/`):

| Arquivo | Cobre |
|---|---|
| `test/offline.test.js` (16) | Primeira cópia, falhas, troca atômica, limpeza, progresso, terminal com banco em rede, rede que não responde (servidor não trava), métodos `auto`/`arquivo`, `.fbk` |
| `test/estoque.test.js` (5) | Busca, "Contém", filtros, ordem, situação ativo/inativo, detalhe, CSV, leitor, comandos da bandeja, cópia no aparelho (mesmas respostas do servidor) |
| `test/relatorio.test.js` (28) | Somente leitura, XSS, rotas, tempo real e geração do relatório |

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
| `https-local.js` | Endereço HTTPS (porta 7736) com certificado gerado aqui, para a leitura em tempo real pela câmera do celular |
| `estoque-offline.js` · `estoque.html` | Consulta de estoque (dados e tela) |
| `estoque-busca.js` | Regras da busca do estoque, as mesmas no servidor e no aparelho (servidor indisponível) |
| `estoque-sw.js` | Guarda a página do estoque e o leitor no aparelho, para abrir sem o servidor |
| `leitor/` | Leitor de código de barras e bibliotecas locais |
| `iniciar-tray.ps1` · `api.ps1` | Bandeja do Windows e cliente da API |
| `*.bat` · `*.vbs` | Instalação, inicialização automática e atalhos |
| `CHANGELOG.md` | Histórico completo das versões |
| `LICENCAS-TERCEIROS.txt` | Avisos de licença exigidos pelos componentes de terceiros incluídos |

---

<div align="center">

## 👤 Autor

**Ruda Gabriel** — criador e único desenvolvedor do **Relatórios Offline**: concepção, arquitetura,
código, regras de negócio, testes e manutenção.

[github.com/RudaGabriel](https://github.com/RudaGabriel)

© 2026 Ruda Gabriel. Todos os direitos reservados. Uso, cópia ou distribuição somente com autorização do autor.

<sub>As bibliotecas de terceiros incluídas na pasta `leitor/vendor/` mantêm as próprias licenças, listadas em
`LICENCAS-TERCEIROS.txt`.</sub>

</div>
