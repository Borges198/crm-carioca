import { mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const IA2E_SNAPSHOT_LABEL = "SNAPSHOT REAL ANONIMIZADO — IA-2E";
export const IA2E_SNAPSHOT_NOTICE = "NÃO É DADO DE PRODUÇÃO";

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
export const IA2E_LAB_ROOT = resolve(MODULE_DIRECTORY, "..");
export const IA2E_REPOSITORY_ROOT = resolve(IA2E_LAB_ROOT, "../..");
export const IA2E_OUTPUT_ROOT = join(IA2E_LAB_ROOT, "dataset", "real-anon");

const ROOT_FIELDS = new Set([
  "identificacao",
  "aviso",
  "dataReferencia",
  "oportunidades",
  "pesquisas",
]);
const OPPORTUNITY_FIELDS = new Set([
  "oportunidadeAnonId",
  "clienteAnonId",
  "status",
  "proximaAcaoEm",
  "acaoAnonId",
]);
const RESEARCH_FIELDS = new Set([
  "pesquisaAnonId",
  "clienteAnonId",
  "destino",
  "dataIda",
  "dataVolta",
  "status",
]);
const PERSONAL_FIELD = /^(nome|name|telefone|phone|celular|email|e-mail|cpf|documento|document|endereco|address|uid|ownerid|agencyid|agentename|supervisornome)$/iu;
const FREE_TEXT_FIELD = /^(observacao|observacoes|obs|nota|notas|mensagem|mensagens|message|messages|comentario|comentarios)$/iu;
const CREDENTIAL_FIELD = /(token|credential|credencial|api.?key|secret|password|senha|authorization)/iu;
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;
const CPF_VALUE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/u;
const PHONE_VALUE = /(?:^|\s)(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}(?:$|\s)/u;
const CREDENTIAL_VALUE = /(AIza[0-9A-Za-z_-]{20,}|Bearer\s+[0-9A-Za-z._-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/u;

function caminhoEstaDentro(caminho, raiz) {
  const trecho = relative(raiz, caminho);
  return trecho === "" || (!trecho.startsWith("..") && !isAbsolute(trecho));
}

function exigirTexto(valor, campo) {
  if ((typeof valor !== "string" && typeof valor !== "number") || String(valor).trim() === "") {
    throw new Error(`Campo obrigatório inválido: ${campo}.`);
  }
  return String(valor);
}

function exigirDataOuNull(valor, campo) {
  if (valor === null || valor === undefined || valor === "") return null;
  const data = exigirTexto(valor, campo);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(data)) throw new Error(`Data inválida em ${campo}.`);
  return data;
}

function criarAnonimizador(prefixo, idsReais) {
  const mapa = new Map();
  return (valor, campo) => {
    const idReal = exigirTexto(valor, campo);
    idsReais.add(idReal);
    if (!mapa.has(idReal)) {
      mapa.set(idReal, `${prefixo}-${String(mapa.size + 1).padStart(3, "0")}`);
    }
    return mapa.get(idReal);
  };
}

function campo(objeto, nomes) {
  for (const nome of nomes) {
    if (Object.hasOwn(objeto, nome)) return objeto[nome];
  }
  return undefined;
}

export function criarSnapshotAnonimizado(exportacao) {
  if (!exportacao || typeof exportacao !== "object" || Array.isArray(exportacao)) {
    throw new Error("Exportação deve ser um objeto JSON.");
  }
  if (!Array.isArray(exportacao.oportunidades) || !Array.isArray(exportacao.pesquisas)) {
    throw new Error("Exportação deve conter oportunidades e pesquisas como listas.");
  }

  const dataReferencia = exigirDataOuNull(exportacao.dataReferencia, "dataReferencia");
  if (!dataReferencia) throw new Error("dataReferencia é obrigatória.");

  const idsReais = new Set();
  const clienteAnonId = criarAnonimizador("cliente", idsReais);
  const oportunidadeAnonId = criarAnonimizador("oportunidade", idsReais);
  const pesquisaAnonId = criarAnonimizador("pesquisa", idsReais);
  const acaoAnonId = criarAnonimizador("acao", idsReais);

  const oportunidades = exportacao.oportunidades.map((item, indice) => {
    const acaoRealId = campo(item, ["acaoId", "proximaAcaoId", "acompanhamentoId"]);
    return {
      oportunidadeAnonId: oportunidadeAnonId(
        campo(item, ["id", "oportunidadeId"]),
        `oportunidades[${indice}].id`,
      ),
      clienteAnonId: clienteAnonId(
        campo(item, ["clienteId"]),
        `oportunidades[${indice}].clienteId`,
      ),
      status: exigirTexto(item.status, `oportunidades[${indice}].status`),
      proximaAcaoEm: exigirDataOuNull(item.proximaAcaoEm, `oportunidades[${indice}].proximaAcaoEm`),
      acaoAnonId: acaoRealId === null || acaoRealId === undefined || acaoRealId === ""
        ? null
        : acaoAnonId(acaoRealId, `oportunidades[${indice}].acaoId`),
    };
  });

  const pesquisas = exportacao.pesquisas.map((item, indice) => ({
    pesquisaAnonId: pesquisaAnonId(
      campo(item, ["id", "pesquisaId", "cotacaoId"]),
      `pesquisas[${indice}].id`,
    ),
    clienteAnonId: clienteAnonId(
      campo(item, ["clienteId"]),
      `pesquisas[${indice}].clienteId`,
    ),
    destino: exigirTexto(item.destino, `pesquisas[${indice}].destino`),
    dataIda: exigirDataOuNull(item.dataIda, `pesquisas[${indice}].dataIda`),
    dataVolta: exigirDataOuNull(item.dataVolta, `pesquisas[${indice}].dataVolta`),
    status: exigirTexto(item.status, `pesquisas[${indice}].status`),
  }));

  return {
    snapshot: {
      identificacao: IA2E_SNAPSHOT_LABEL,
      aviso: IA2E_SNAPSHOT_NOTICE,
      dataReferencia,
      oportunidades,
      pesquisas,
    },
    idsReais,
  };
}

function camposPermitidos(caminho) {
  if (caminho === "$") return ROOT_FIELDS;
  if (/^\$\.oportunidades\[\d+\]$/u.test(caminho)) return OPPORTUNITY_FIELDS;
  if (/^\$\.pesquisas\[\d+\]$/u.test(caminho)) return RESEARCH_FIELDS;
  return null;
}

export function auditarSnapshot(snapshot, idsReaisConhecidos = new Set()) {
  const resultado = {
    dadosPessoaisDetectados: 0,
    credenciaisDetectadas: 0,
    idsReaisDetectados: 0,
    camposForaDaAllowlist: 0,
    observacoesLivres: 0,
  };

  function visitar(valor, caminho) {
    if (Array.isArray(valor)) {
      valor.forEach((item, indice) => visitar(item, `${caminho}[${indice}]`));
      return;
    }
    if (valor && typeof valor === "object") {
      const permitidos = camposPermitidos(caminho);
      for (const [chave, conteudo] of Object.entries(valor)) {
        if (!permitidos?.has(chave)) resultado.camposForaDaAllowlist += 1;
        if (PERSONAL_FIELD.test(chave)) resultado.dadosPessoaisDetectados += 1;
        if (FREE_TEXT_FIELD.test(chave)) resultado.observacoesLivres += 1;
        if (CREDENTIAL_FIELD.test(chave)) resultado.credenciaisDetectadas += 1;
        visitar(conteudo, `${caminho}.${chave}`);
      }
      return;
    }
    if (typeof valor !== "string") return;
    if (EMAIL_VALUE.test(valor) || CPF_VALUE.test(valor) || PHONE_VALUE.test(valor)) {
      resultado.dadosPessoaisDetectados += 1;
    }
    if (CREDENTIAL_VALUE.test(valor)) resultado.credenciaisDetectadas += 1;
    if (idsReaisConhecidos.has(valor)) resultado.idsReaisDetectados += 1;
  }

  visitar(snapshot, "$");
  resultado.aprovada = Object.values(resultado).every((quantidade) => quantidade === 0);
  return resultado;
}

export function criarGoldStandardVazio(dataReferencia) {
  return {
    dataReferencia,
    avaliador: "HUMANO",
    sinaisEsperados: [],
    sinaisNaoPresentesNaAmostra: [],
  };
}

export async function anonimizarArquivo({
  entrada,
  saida,
  repositoryRoot = IA2E_REPOSITORY_ROOT,
  outputRoot = IA2E_OUTPUT_ROOT,
}) {
  const entradaReal = await realpath(resolve(entrada));
  const repositorioReal = await realpath(resolve(repositoryRoot));
  if (caminhoEstaDentro(entradaReal, repositorioReal)) {
    throw new Error("Arquivo bruto deve permanecer fora do repositório.");
  }

  const saidaResolvida = resolve(saida);
  const raizSaida = resolve(outputRoot);
  if (!caminhoEstaDentro(saidaResolvida, raizSaida)) {
    throw new Error("Saída deve ficar no diretório local dataset/real-anon.");
  }

  const exportacao = JSON.parse(await readFile(entradaReal, "utf8"));
  const { snapshot, idsReais } = criarSnapshotAnonimizado(exportacao);
  const auditoria = auditarSnapshot(snapshot, idsReais);
  if (!auditoria.aprovada) {
    throw new Error(`Snapshot bloqueado pela auditoria: ${JSON.stringify(auditoria)}.`);
  }

  const goldStandard = criarGoldStandardVazio(snapshot.dataReferencia);
  const goldPath = join(dirname(saidaResolvida), "gold-standard-ia-2e.json");
  const snapshotTemporario = `${saidaResolvida}.tmp-${process.pid}`;
  const goldTemporario = `${goldPath}.tmp-${process.pid}`;
  await mkdir(dirname(saidaResolvida), { recursive: true });

  try {
    await writeFile(snapshotTemporario, `${JSON.stringify(snapshot, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await writeFile(goldTemporario, `${JSON.stringify(goldStandard, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(snapshotTemporario, saidaResolvida);
    await rename(goldTemporario, goldPath);
  } catch (error) {
    await rm(snapshotTemporario, { force: true });
    await rm(goldTemporario, { force: true });
    throw error;
  }

  return {
    snapshotPath: saidaResolvida,
    goldStandardPath: goldPath,
    oportunidades: snapshot.oportunidades.length,
    pesquisas: snapshot.pesquisas.length,
    auditoria,
  };
}

async function executarCli() {
  const [entrada, saida] = process.argv.slice(2);
  if (!entrada || !saida) {
    throw new Error("Uso: node src/ia2e-anonymizer.js <arquivo-bruto-fora-do-repositorio> <dataset/real-anon/snapshot.json>");
  }
  const resultado = await anonimizarArquivo({ entrada, saida });
  process.stdout.write(`${JSON.stringify(resultado, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  executarCli().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
