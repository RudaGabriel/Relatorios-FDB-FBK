<div align="center">

# 📦 Relatórios SmallSoft Offline

### Vendas do dia e consulta de estoque do Small Commerce — lendo uma **cópia offline** do banco

**Abre mesmo com o banco principal em atualização ou manutenção · Nunca escreve no banco · Tudo automático · Funciona sem internet**

[Instalar](#instalacao) · [Cópia offline](#copia) · [Estoque](#estoque) · [Configurar](#configuracao) · [API](#api) · [Problemas](#problemas)

</div>

---

## O que é

Versão **offline** do sistema *Relatórios FDB* (projeto SSH): traz **todos os recursos** dele — vendas do dia, por data e por período (Gerencial, NFC-e e NF-e), vendedores, formas de pagamento, itens, busca avançada, temas, celular por QR code, bandeja do Windows, watchdog, API — e acrescenta:

| | |
|---|---|
| 🗄️ **Cópia offline automática** | O relatório lê uma cópia do `SMALL.FDB` mantida pelo próprio sistema. Banco principal em atualização, manutenção, travado ou desligado? O relatório continua abrindo, com os dados da última cópia. |
| 🔒 **Sem risco para os dados** | A cópia é feita pelo próprio Firebird (`gbak` em modo leitura, sem coleta de lixo) e restaurada como banco **somente leitura**. O banco principal nunca é alterado nem copiado "a quente". |
| 🔎 **Consulta de estoque completa** | Todos os itens da tabela `ESTOQUE`: busca por nome, código, código de barras, referência, fornecedor, grupo, NCM… em **todas** as colunas, sem limite de resultados, com exportação para Excel. |
| 🤖 **Zero cliques** | Detecta mudanças nas vendas e atualiza a cópia sozinho; troca para a cópia nova sem recarregar nada; encontra `gbak`, banco e backups `.fbk` sozinho. |

Pode ser instalado **na mesma máquina** que o *Relatórios FDB*: usa porta, tarefa agendada, pasta de inicialização e ícone de bandeja próprios.

---

<a id="instalacao"></a>
## 🚀 Instalação

> **Requisitos:** Windows 10/11 · Firebird do Small Commerce **nesta máquina** (é ele que abre a cópia offline). O Node.js 18+ e o `node-firebird` são instalados sozinhos.

1. Copie a pasta do sistema para o computador onde está o banco do Small Commerce.
2. Execute **`instalar-na-inicializacao.bat`** (pede administrador, instala o que falta, libera a porta **7735** no firewall e cria a inicialização automática).
3. Abra: duplo clique no ícone da bandeja ou `http://localhost:7735`.

Na primeira vez o sistema lê o banco principal direto (somente leitura) enquanto faz a primeira cópia; quando ela fica pronta, passa para a cópia sozinho. O canto inferior esquerdo da tela mostra o estado (**Offline · dados de 14:32**).

> Só quer testar? Execute `gerar_relatorio_do_dia.bat`. Para remover a inicialização automática: `remover-inicializacao.bat` (só mexe nos processos **desta** pasta — o *Relatórios FDB*, se instalado, não é afetado).

---

<a id="copia"></a>
## 🗄️ Como a cópia offline funciona

```
 Banco principal (SMALL.FDB) ──gbak -b -g (leitura)──▶ ultimo-backup.fbk
                                                          │
                     gbak -c -mode read_only ◀────────────┘
                                │
                                ▼
            SMALL_OFFLINE_AAAAMMDD_HHMMSS.FDB  (somente leitura)
                                │  conferida (conecta e lê NFCE)
                                ▼
                 troca atômica ──▶ relatório e estoque leem daqui
```

- **Quando atualiza:** a cada 20 s uma consulta leve (somente leitura) tira a "assinatura" das vendas de hoje no banco principal. Mudou → nova cópia, respeitando o **intervalo mínimo** (padrão 5 min, que cresce sozinho para 3× a duração da última cópia — a cópia nunca ocupa o banco do caixa mais que 1/3 do tempo). Também atualiza a cada 3 h sem mudança (alterações em outros dias) e quando você pede.
- **Pedir na hora:** clique no selo **Offline** no canto da tela → *Atualizar cópia agora* · bandeja → *Cópia offline do banco → Atualizar a cópia agora* · `POST /api/offline/atualizar`.
- **Se algo falhar** (banco em manutenção, sem espaço em disco, gbak com erro): os temporários são apagados e o relatório **continua com a cópia anterior**. O motivo aparece no selo, na bandeja e no `relatorio.log` (categoria `[OFFLINE]`).
- **Banco principal fora do ar:** o selo fica amarelo — *Banco principal indisponível · dados de 14:32*. Quando ele volta, a cópia é atualizada sozinha.
- **Sem banco e sem cópia:** o sistema procura um `SMALL.fbk` nos lugares conhecidos (pasta do sistema, `Área de Trabalho\VE`, Documentos, pasta do Small Commerce) e restaura. Também dá para escolher um `.fbk` em *Configurações → Selecionar banco*.
- **Onde ficam as cópias:** `C:\ProgramData\RelatoriosSmallSoftOffline\copias` (local — o Firebird não abre banco em pasta de rede). Ficam a cópia em uso e o último backup `.fbk`; as anteriores são apagadas quando o Firebird as solta. O sistema só apaga arquivos com o nome que ele mesmo cria, dentro dessa pasta.

### Modos (`offlineModo`)

| Modo | O relatório lê | Para quem |
|---|---|---|
| `copia` (padrão) | **Sempre** a cópia offline | Foco em offline: zero carga extra de leitura no banco do caixa, imune a manutenção |
| `hibrido` | O banco principal **ao vivo** (venda aparece na hora); cai para a cópia quando ele fica indisponível e volta sozinho | Quem quer tempo real e segurança |
| `desligado` | O banco principal direto | Igual ao *Relatórios FDB* |

O modo e o intervalo mudam no próprio selo (no computador do servidor) ou no `config.json`, sem reiniciar.

---

<a id="estoque"></a>
## 🔎 Consulta de estoque

Botão **Estoque** no canto da tela, bandeja → *Consultar estoque* ou `http://IP:7735/estoque` (computador e celular).

- **Todos os itens**, lidos da cópia offline (não pesa no caixa) e guardados em memória: a busca responde na hora, mesmo com dezenas de milhares de produtos.
- **Busca em todas as colunas de texto** da tabela `ESTOQUE` — nome, código, código de barras, referência, fornecedor, grupo, NCM, localização e qualquer outra coluna que o seu banco tenha. Sem acento e sem maiúsculas: `racao` acha *RAÇÃO*.

| Digite | Encontra |
|---|---|
| `racao gato` | itens com as duas palavras, em qualquer coluna |
| `"cao filhote"` | a frase exata |
| `racao -gato` | ração, menos as de gato |
| `7891000100103` | código de barras (com ou sem pontos/traços no cadastro) — o exato vem primeiro |
| `123` | código 00123 em primeiro (zeros à esquerda) |

- **Leitor de código de barras:** bipe no campo de busca; se der um só item, o detalhe abre sozinho.
- **Filtros:** com estoque, sem estoque, negativo, abaixo do mínimo, só ativos. **Ordem:** relevância, nome, código, estoque, preço.
- **Detalhe do item:** todas as colunas do cadastro, com botão de copiar código e código de barras.
- **Totais** do resultado (estoque somado e valor de venda em estoque) e **Exportar** para CSV/Excel com todas as colunas de todos os resultados.
- Atalhos: `/`, `F3` ou `Ctrl+F` vão para a busca; `Esc` limpa/fecha.

---

<a id="configuracao"></a>
## ⚙️ Configuração (`config.json`)

Todas as chaves do *Relatórios FDB* continuam valendo (`appName`, `fbUser`/`fbPass`, `proibidos`, `teclasPersonalizadas`, `programas`…). Novas:

| Chave | Padrão | Para que serve |
|---|---|---|
| `porta` | `7735` | Porta HTTP (o *Relatórios FDB* usa 7734) |
| `offlineModo` | `"copia"` | `copia`, `hibrido` ou `desligado` |
| `offlineIntervaloMin` | `5` | Intervalo mínimo entre cópias (1 a 1440 min) |
| `offlineVerificarSeg` | `20` | A cada quantos segundos verifica mudanças no banco principal (5 a 3600) |
| `offlineMaxIdadeMin` | `180` | Refaz a cópia depois desse tempo mesmo sem mudança detectada |
| `offlineTimeoutMin` | `30` | Tempo máximo de uma cópia (banco muito grande: aumente) |
| `offlinePasta` | automático | Pasta das cópias (precisa ser um disco local desta máquina) |
| `gbakPath` | automático | Caminho do `gbak.exe` (o padrão é o do Firebird em execução) |
| `offlineManterFbk` | `true` | Guarda o último backup `.fbk` (segurança extra) |

---

<a id="api"></a>
## 🔌 API

Todas as rotas do *Relatórios FDB* (veja o `api.ps1`), mais:

| Rota | Método | Descrição |
|---|---|---|
| `/api/offline` | GET | Estado da cópia: modo, de quando são os dados, banco principal no ar, etapa em andamento, último erro |
| `/api/offline/atualizar` | POST/GET | Faz uma cópia nova já (rede local) |
| `/api/offline/importar` | POST | `{ "caminho": "C:\\...\\SMALL.fbk" }` — restaura um backup como cópia (computador do servidor) |
| `/estoque` | GET | Tela da consulta de estoque |
| `/api/estoque?q=&estoque=&ordem=&ativos=1&pagina=&limite=` | GET | Busca (até 1000 por página; `estoque`: todos/com/sem/negativo/abaixo) |
| `/api/estoque/item?id=N` | GET | Todas as colunas de um item |
| `/api/estoque/csv?q=...` | GET | CSV com todos os resultados |

---

<a id="problemas"></a>
## 🩺 Solução de problemas

| Sintoma | O que fazer |
|---|---|
| Selo vermelho "cópia indisponível" | Clique nele: o motivo aparece. Normalmente: `gbak.exe` não encontrado (informe `gbakPath`) ou Firebird não instalado nesta máquina |
| "O Firebird não está rodando nesta máquina" | Rode o sistema no computador do banco, ou instale/inicie o Firebird (mesma versão do servidor) aqui |
| "não permite criar a cópia nesta pasta" | No `firebird.conf`, `DatabaseAccess` restrito: libere a pasta das cópias ou mude `offlinePasta` para uma pasta permitida |
| Cópia demora muito | Aumente `offlineIntervaloMin` (e `offlineTimeoutMin` se der tempo esgotado) |
| Estoque sem alguma coluna | A busca já procura em todas as colunas de texto; o detalhe do item mostra todas. O log `[ESTOQUE]` diz quais colunas foram reconhecidas como código, barras, estoque e preço |
| Qualquer outro problema | `relatorio.log` (bandeja → *Ferramentas → Abrir o log*) |

---

## 🧪 Testes

```bash
npm test
```

Rodam sem Firebird real (Firebird e `gbak` simulados em `test/`): cópia offline (primeira cópia, falhas, troca, limpeza, modo híbrido, `.fbk`), consulta de estoque e todos os testes herdados do *Relatórios FDB* (somente leitura, XSS, rotas, tempo real…).

## 🗂️ Arquivos

| Arquivo | Função |
|---|---|
| `offline-copia.js` | Cópia offline: gbak, conferência, troca atômica, limpeza, modos |
| `estoque-offline.js` · `estoque.html` | Consulta de estoque (dados e tela) |
| `servidor-relatorio.js` · `gerar-relatorio-html.js` | Servidor e gerador (base do *Relatórios FDB*, lendo a cópia) |
| `iniciar-tray.ps1`, `*.bat`, `*.vbs`, `api.ps1` | Bandeja, instalação, inicialização e cliente da API |
| `legado/` | Scripts da versão anterior (FBK), mantidos só como referência |

---

<div align="center">

**Desenvolvido por Ruda Gabriel** — concepção, regras de negócio e manutenção.

© 2026 Ruda Gabriel. Todos os direitos reservados.

</div>
