import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  IA2D_EVIDENCE_LABEL,
  persistirEvidenciaIa2d,
} from "../src/benchmark-evidence.js";

test("persiste somente os campos permitidos da resposta validada", async () => {
  const destino = new URL(`file://${join(tmpdir(), `ia-2d-evidence-${process.pid}.json`)}`);
  const respostaValidada = {
    id: "CASO-TESTE",
    resposta: {
      resumoExecutivo: "Resumo sintético.",
      itens: [{
        sinalId: "sinal-1",
        classificacaoOriginal: "FATO",
        interpretacao: "Interpretação sintética.",
        sugestoes: [{ classificacao: "SUGESTÃO", texto: "Revisar." }],
        evidenceIds: ["evidencia-1"],
        entidades: ["entidade-que-nao-deve-ser-persistida"],
      }],
    },
  };

  try {
    await persistirEvidenciaIa2d([respostaValidada], destino);
    const evidencia = JSON.parse(await readFile(destino, "utf8"));
    assert.equal(evidencia.identificacao, IA2D_EVIDENCE_LABEL);
    assert.deepEqual(evidencia.respostas, [{
      id: "CASO-TESTE",
      resumoExecutivo: "Resumo sintético.",
      itens: [{
        sinalId: "sinal-1",
        classificacaoOriginal: "FATO",
        interpretacao: "Interpretação sintética.",
        sugestoes: [{ classificacao: "SUGESTÃO", texto: "Revisar." }],
        evidenceIds: ["evidencia-1"],
      }],
    }]);
    assert.doesNotMatch(JSON.stringify(evidencia), /entidade-que-nao-deve-ser-persistida/);
  } finally {
    await rm(destino, { force: true });
  }
});
