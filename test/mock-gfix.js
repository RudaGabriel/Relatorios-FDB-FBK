"use strict";
// gfix simulado para os testes da cópia offline (validação da cópia temporária).
//   MOCK_GFIX_LOG     arquivo onde registra cada chamada
//   MOCK_GFIX_FALHAR  "1" → responde como validação com erros (o gfix real sai com 0 e imprime o resumo)
const fs = require("fs");
const args = process.argv.slice(2);
if (process.env.MOCK_GFIX_LOG) { try { fs.appendFileSync(process.env.MOCK_GFIX_LOG, JSON.stringify({ args }) + "\n"); } catch (_) {} }
if (process.env.MOCK_GFIX_FALHAR === "1") process.stdout.write("Summary of validation errors\n\tNumber of record level errors\t: 3\n");
process.exit(0);
