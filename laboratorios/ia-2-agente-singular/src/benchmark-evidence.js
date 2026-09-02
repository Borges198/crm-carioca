import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const IA2D_EVIDENCE_LABEL = "EVIDÊNCIA DE BENCHMARK IA-2D";
export const IA2D_EVIDENCE_PATH = new URL("../artifacts/ia-2d-gemini-responses.json", import.meta.url);

function selecionarCamposDaResposta({ id, resposta }) {
  return {
    id,
    resumoExecutivo: resposta.resumoExecutivo,
    itens: resposta.itens.map((item) => ({
      sinalId: item.sinalId,
      classificacaoOriginal: item.classificacaoOriginal,
      interpretacao: item.interpretacao,
      sugestoes: structuredClone(item.sugestoes),
      evidenceIds: [...item.evidenceIds],
    })),
  };
}

export async function persistirEvidenciaIa2d(respostasValidadas, destino = IA2D_EVIDENCE_PATH) {
  const evidencia = {
    identificacao: IA2D_EVIDENCE_LABEL,
    respostas: respostasValidadas.map(selecionarCamposDaResposta),
  };
  await mkdir(dirname(destino.pathname), { recursive: true });
  await writeFile(destino, `${JSON.stringify(evidencia, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return evidencia;
}
