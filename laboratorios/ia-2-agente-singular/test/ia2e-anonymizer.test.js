import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  IA2E_SNAPSHOT_LABEL,
  IA2E_SNAPSHOT_NOTICE,
  anonimizarArquivo,
  auditarSnapshot,
} from "../src/ia2e-anonymizer.js";

function fixtureSintetica() {
  return {
    dataReferencia: "2026-09-02",
    oportunidades: [
      {
        id: "opp-real-sintetica-a",
        clienteId: "cli-real-sintetico-a",
        status: "ABERTA",
        proximaAcaoEm: "2026-09-01",
        acaoId: "acao-real-sintetica-a",
        nome: "Pessoa Sintética",
        email: "fixture@example.invalid",
        observacoes: "Texto que deve ser descartado.",
      },
      {
        id: "opp-real-sintetica-b",
        clienteId: "cli-real-sintetico-a",
        status: "ABERTA",
        proximaAcaoEm: null,
        acaoId: null,
      },
    ],
    pesquisas: [
      {
        id: "pesquisa-real-sintetica-a",
        clienteId: "cli-real-sintetico-a",
        destino: "SSA",
        dataIda: "2026-10-01",
        dataVolta: "2026-10-08",
        status: "ABERTA",
        token: "segredo-sintetico-descartado",
      },
      {
        id: "pesquisa-real-sintetica-b",
        clienteId: "cli-real-sintetico-b",
        destino: "REC",
        dataIda: null,
        dataVolta: null,
        status: "ARQUIVADA",
      },
    ],
  };
}

test("anonimiza fixture sintética, preserva relações e cria gold standard vazio", async () => {
  const base = await mkdtemp(join(tmpdir(), "ia2e-sintetico-"));
  const repositoryRoot = join(base, "repositorio");
  const outputRoot = join(repositoryRoot, "laboratorio", "dataset", "real-anon");
  const entrada = join(base, "exportacao-bruta-fora-do-repositorio.json");
  const saida = join(outputRoot, "snapshot-ia-2e.json");
  await mkdir(repositoryRoot, { recursive: true });
  await writeFile(entrada, JSON.stringify(fixtureSintetica()), "utf8");

  try {
    const resultado = await anonimizarArquivo({ entrada, saida, repositoryRoot, outputRoot });
    const snapshot = JSON.parse(await readFile(saida, "utf8"));
    const gold = JSON.parse(await readFile(resultado.goldStandardPath, "utf8"));

    assert.equal(snapshot.identificacao, IA2E_SNAPSHOT_LABEL);
    assert.equal(snapshot.aviso, IA2E_SNAPSHOT_NOTICE);
    assert.equal(snapshot.oportunidades[0].clienteAnonId, snapshot.oportunidades[1].clienteAnonId);
    assert.equal(snapshot.oportunidades[0].clienteAnonId, snapshot.pesquisas[0].clienteAnonId);
    assert.notEqual(snapshot.pesquisas[0].clienteAnonId, snapshot.pesquisas[1].clienteAnonId);
    assert.equal(snapshot.oportunidades[0].oportunidadeAnonId, "oportunidade-001");
    assert.equal(snapshot.oportunidades[0].acaoAnonId, "acao-001");
    assert.equal(snapshot.pesquisas[0].pesquisaAnonId, "pesquisa-001");
    assert.doesNotMatch(JSON.stringify(snapshot), /Pessoa Sintética|fixture@example|observacoes|segredo-sintetico/u);
    assert.deepEqual(resultado.auditoria, {
      dadosPessoaisDetectados: 0,
      credenciaisDetectadas: 0,
      idsReaisDetectados: 0,
      camposForaDaAllowlist: 0,
      observacoesLivres: 0,
      aprovada: true,
    });
    assert.deepEqual(gold, {
      dataReferencia: "2026-09-02",
      avaliador: "HUMANO",
      sinaisEsperados: [],
      sinaisNaoPresentesNaAmostra: [],
    });
    assert.deepEqual((await readdir(outputRoot)).sort(), ["gold-standard-ia-2e.json", "snapshot-ia-2e.json"]);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("bloqueia entrada bruta dentro do repositório", async () => {
  const base = await mkdtemp(join(tmpdir(), "ia2e-isolamento-"));
  const repositoryRoot = join(base, "repositorio");
  const outputRoot = join(repositoryRoot, "dataset", "real-anon");
  const entrada = join(repositoryRoot, "exportacao-bruta.json");
  await mkdir(repositoryRoot, { recursive: true });
  await writeFile(entrada, JSON.stringify(fixtureSintetica()), "utf8");
  try {
    await assert.rejects(
      anonimizarArquivo({ entrada, saida: join(outputRoot, "snapshot.json"), repositoryRoot, outputRoot }),
      /fora do repositório/u,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("auditoria bloqueia snapshot inseguro sem expor os valores", () => {
  const inseguro = {
    identificacao: IA2E_SNAPSHOT_LABEL,
    aviso: IA2E_SNAPSHOT_NOTICE,
    dataReferencia: "2026-09-02",
    oportunidades: [{
      oportunidadeAnonId: "oportunidade-001",
      clienteAnonId: "cliente-001",
      status: "ABERTA",
      proximaAcaoEm: null,
      acaoAnonId: null,
      nome: "Pessoa Privada",
      observacoes: "Não deve passar.",
      token: "Bearer valor-secreto",
      idOriginal: "id-real-conhecido",
    }],
    pesquisas: [],
  };
  const auditoria = auditarSnapshot(inseguro, new Set(["id-real-conhecido"]));
  assert.equal(auditoria.aprovada, false);
  assert.ok(auditoria.dadosPessoaisDetectados > 0);
  assert.ok(auditoria.credenciaisDetectadas > 0);
  assert.ok(auditoria.idsReaisDetectados > 0);
  assert.ok(auditoria.camposForaDaAllowlist > 0);
  assert.ok(auditoria.observacoesLivres > 0);
  assert.doesNotMatch(JSON.stringify(auditoria), /Pessoa Privada|valor-secreto|id-real-conhecido/u);
});
