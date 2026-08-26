import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validarENormalizarItinerario } from './itinerarioUtils';
import {
  extrairItinerarioSmartPaste,
  type ResultadoSmartPasteEstruturado,
} from './smartPasteItinerarioUtils';

function obterItinerario(resultado: ResultadoSmartPasteEstruturado) {
  expect(resultado.ok).toBe(true);
  if (!resultado.ok) throw new Error(resultado.motivo);
  return resultado.itinerario;
}

function evento(
  data: string,
  hora: string,
  aeroporto: string,
  companhia?: string,
  numeroVoo?: string
) {
  return [
    `${data} ${hora} ${aeroporto}`,
    companhia,
    numeroVoo,
  ].filter(Boolean).join(' | ');
}

const idaDireta = [
  'IDA 01/09/2026',
  evento('01/09/2026', '08:00', 'AJU', 'LATAM', 'LA 3701'),
  evento('01/09/2026', '10:20', 'GRU', 'LATAM', 'LA 3701'),
].join('\n');

const voltaDireta = [
  'VOLTA 10/09/2026',
  evento('10/09/2026', '18:00', 'GRU', 'GOL', 'G3 1902'),
  evento('10/09/2026', '20:30', 'AJU', 'GOL', 'G3 1902'),
].join('\n');

const idaUmaConexao = [
  'IDA 03/09/2026',
  '1 conexão',
  evento('03/09/2026', '13:30', 'AJU', 'LATAM', 'LA 3001'),
  evento('03/09/2026', '15:40', 'GRU', 'LATAM', 'LA 3001'),
  evento('03/09/2026', '16:30', 'GRU', 'GOL', 'G3 1200'),
  evento('03/09/2026', '18:10', 'BSB', 'GOL', 'G3 1200'),
].join('\n');

const idaDuasConexoes = [
  'IDA 10/10/2026',
  '2 conexões',
  evento('10/10/2026', '06:00', 'SSA', 'Azul', 'AD 4101'),
  evento('10/10/2026', '08:00', 'GRU', 'Azul', 'AD 4101'),
  evento('10/10/2026', '09:00', 'GRU', 'Azul', 'AD 4202'),
  evento('10/10/2026', '11:00', 'BSB', 'Azul', 'AD 4202'),
  evento('10/10/2026', '12:00', 'BSB', 'GOL', 'G3 1902'),
  evento('10/10/2026', '15:00', 'MAO', 'GOL', 'G3 1902'),
].join('\n');

describe('Smart Paste 2.0 - parser estrutural isolado', () => {
  it('1. interpreta voo direto somente ida', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste(idaDireta));

    expect(itinerario.ida.pernas).toHaveLength(1);
    expect(itinerario.volta).toBeUndefined();
  });

  it('2. interpreta voo direto de ida e volta', () => {
    const itinerario = obterItinerario(
      extrairItinerarioSmartPaste(`${idaDireta}\n${voltaDireta}`)
    );

    expect(itinerario.ida.pernas).toHaveLength(1);
    expect(itinerario.volta?.pernas).toHaveLength(1);
  });

  it('3. interpreta uma conexão como duas pernas', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste(idaUmaConexao));

    expect(itinerario.ida.pernas).toHaveLength(2);
  });

  it('4. interpreta duas conexões como três pernas', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste(idaDuasConexoes));

    expect(itinerario.ida.pernas).toHaveLength(3);
  });

  it('5. preserva continuidade nas três pernas', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste(idaDuasConexoes));

    expect(itinerario.ida.pernas.map(({ origem, destino }) => [origem, destino]))
      .toEqual([
        ['SSA', 'GRU'],
        ['GRU', 'BSB'],
        ['BSB', 'MAO'],
      ]);
  });

  it('6. aceita ida e volta com números diferentes de conexões', () => {
    const voltaUmaConexao = [
      'VOLTA 20/10/2026',
      '1 conexão',
      evento('20/10/2026', '08:00', 'MAO', 'Azul'),
      evento('20/10/2026', '11:00', 'BSB', 'Azul'),
      evento('20/10/2026', '12:00', 'BSB', 'Azul'),
      evento('20/10/2026', '14:00', 'SSA', 'Azul'),
    ].join('\n');
    const itinerario = obterItinerario(
      extrairItinerarioSmartPaste(`${idaDuasConexoes}\n${voltaUmaConexao}`)
    );

    expect(itinerario.ida.pernas).toHaveLength(3);
    expect(itinerario.volta?.pernas).toHaveLength(2);
  });

  it('7. preserva saída e chegada no mesmo dia', () => {
    const perna = obterItinerario(extrairItinerarioSmartPaste(idaDireta)).ida.pernas[0];

    expect(perna.dataSaida).toBe('2026-09-01');
    expect(perna.dataChegada).toBe('2026-09-01');
  });

  it('8. preserva chegada explicitamente informada no dia seguinte', () => {
    const texto = [
      'IDA 03/09/2026',
      evento('03/09/2026', '21:10', 'AJU'),
      evento('04/09/2026', '00:20', 'BSB'),
    ].join('\n');
    const perna = obterItinerario(extrairItinerarioSmartPaste(texto)).ida.pernas[0];

    expect(perna.dataChegada).toBe('2026-09-04');
  });

  it('9. converte +1 em data de chegada do dia seguinte', () => {
    const texto = [
      'IDA 03/09/2026',
      '13:30 AJU | LATAM',
      '00:20 BSB +1 | LATAM',
    ].join('\n');
    const perna = obterItinerario(extrairItinerarioSmartPaste(texto)).ida.pernas[0];

    expect(perna).toMatchObject({
      dataSaida: '2026-09-03',
      dataChegada: '2026-09-04',
      horaChegada: '00:20',
    });
  });

  it('10. não confunde chegada da ida com data de volta', () => {
    const texto = [
      'IDA 23/08/2026',
      evento('23/08/2026', '20:40', 'GIG'),
      evento('24/08/2026', '14:15', 'AJU'),
      'VOLTA 29/08/2026',
      evento('29/08/2026', '02:45', 'AJU'),
      evento('29/08/2026', '07:45', 'GIG'),
    ].join('\n');
    const itinerario = obterItinerario(extrairItinerarioSmartPaste(texto));

    expect(itinerario.ida.pernas[0].dataChegada).toBe('2026-08-24');
    expect(itinerario.volta?.pernas[0].dataSaida).toBe('2026-08-29');
  });

  it('11. não confunde partida da volta com chegada da ida', () => {
    const texto = [
      'IDA 03/09/2026',
      evento('03/09/2026', '13:30', 'AJU'),
      evento('04/09/2026', '00:20', 'BSB'),
      'VOLTA 18/09/2026',
      evento('18/09/2026', '21:10', 'BSB'),
      evento('19/09/2026', '09:50', 'AJU'),
    ].join('\n');
    const itinerario = obterItinerario(extrairItinerarioSmartPaste(texto));

    expect(itinerario.ida.pernas[0].horaChegada).toBe('00:20');
    expect(itinerario.volta?.pernas[0].horaSaida).toBe('21:10');
  });

  it('12. preserva aeroportos intermediários', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste(idaDuasConexoes));

    expect(itinerario.ida.pernas[0].destino).toBe('GRU');
    expect(itinerario.ida.pernas[1]).toMatchObject({ origem: 'GRU', destino: 'BSB' });
    expect(itinerario.ida.pernas[2].origem).toBe('BSB');
  });

  it('13. preserva companhia operacional por perna', () => {
    const pernas = obterItinerario(extrairItinerarioSmartPaste(idaDuasConexoes)).ida.pernas;

    expect(pernas.map((perna) => perna.companhia)).toEqual(['Azul', 'Azul', 'GOL']);
  });

  it('14. preserva companhias diferentes na mesma direção', () => {
    const pernas = obterItinerario(extrairItinerarioSmartPaste(idaUmaConexao)).ida.pernas;

    expect(pernas.map((perna) => perna.companhia)).toEqual(['LATAM', 'GOL']);
  });

  it('15. preserva companhias diferentes entre ida e volta', () => {
    const itinerario = obterItinerario(
      extrairItinerarioSmartPaste(`${idaDireta}\n${voltaDireta}`)
    );

    expect(itinerario.ida.pernas[0].companhia).toBe('LATAM');
    expect(itinerario.volta?.pernas[0].companhia).toBe('GOL');
  });

  it('16. falha com segurança em texto sem informação suficiente', () => {
    expect(extrairItinerarioSmartPaste('Pesquisa de voos sem detalhes')).toEqual({
      ok: false,
      codigo: 'texto_nao_reconhecido',
      motivo: 'O trecho de ida não contém saída e chegada completas',
    });
  });

  it('17. não fabrica pernas quando conexões não mostram aeroportos intermediários', () => {
    const texto = [
      'IDA 23/08/2026',
      '2 conexões',
      evento('23/08/2026', '20:40', 'GIG'),
      evento('24/08/2026', '14:15', 'AJU'),
    ].join('\n');
    const resultado = extrairItinerarioSmartPaste(texto);

    expect(resultado).toMatchObject({ ok: false, codigo: 'dados_insuficientes' });
    if (!resultado.ok) expect(resultado.motivo).toContain('aeroportos intermediários');
  });

  it('18. rejeita rota descontínua pela validação existente', () => {
    const texto = [
      'IDA 03/09/2026',
      '1 conexão',
      evento('03/09/2026', '08:00', 'AJU'),
      evento('03/09/2026', '10:00', 'GRU'),
      evento('03/09/2026', '11:00', 'CGH'),
      evento('03/09/2026', '13:00', 'BSB'),
    ].join('\n');
    const resultado = extrairItinerarioSmartPaste(texto);

    expect(resultado).toMatchObject({ ok: false, codigo: 'inconsistencia_estrutural' });
  });

  it('19. rejeita cronologia impossível pela validação existente', () => {
    const texto = [
      'IDA 03/09/2026',
      evento('03/09/2026', '13:30', 'AJU'),
      evento('03/09/2026', '12:20', 'BSB'),
    ].join('\n');
    const resultado = extrairItinerarioSmartPaste(texto);

    expect(resultado).toMatchObject({ ok: false, codigo: 'inconsistencia_estrutural' });
  });

  it('20. não inclui propriedades desconhecidas no itinerário', () => {
    const texto = [
      'IDA 01/09/2026',
      `${evento('01/09/2026', '08:00', 'AJU', 'LATAM', 'LA 3701')} | ignorar`,
      `${evento('01/09/2026', '10:20', 'GRU', 'LATAM', 'LA 3701')} | ignorar`,
    ].join('\n');
    const itinerario = obterItinerario(extrairItinerarioSmartPaste(texto));

    expect(itinerario.ida.pernas[0]).toEqual({
      origem: 'AJU',
      destino: 'GRU',
      companhia: 'LATAM',
      numeroVoo: 'LA 3701',
      dataSaida: '2026-09-01',
      horaSaida: '08:00',
      dataChegada: '2026-09-01',
      horaChegada: '10:20',
    });
  });

  it('21. não muta o input original', () => {
    const original = idaUmaConexao;

    extrairItinerarioSmartPaste(original);

    expect(original).toBe(idaUmaConexao);
  });

  it('22. todo resultado válido passa novamente pela validação existente', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste(idaDuasConexoes));

    expect(validarENormalizarItinerario(itinerario)).toEqual(itinerario);
  });

  it('23. constrói itinerário sem depender de dados financeiros', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste(idaDireta));

    expect(itinerario.ida.pernas).toHaveLength(1);
  });

  it('24. não inventa valores financeiros', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste(
      `${idaDireta}\n99.000 milhas + R$ 999,99`
    )) as unknown as Record<string, unknown>;

    expect(itinerario).not.toHaveProperty('pontos');
    expect(itinerario).not.toHaveProperty('taxa');
    expect(itinerario).not.toHaveProperty('valor');
  });

  it('25. não inventa companhia ou número de voo ausentes', () => {
    const texto = [
      'IDA 01/09/2026',
      evento('01/09/2026', '08:00', 'AJU'),
      evento('01/09/2026', '10:20', 'GRU'),
    ].join('\n');
    const perna = obterItinerario(extrairItinerarioSmartPaste(texto)).ida.pernas[0];

    expect(perna).not.toHaveProperty('companhia');
    expect(perna).not.toHaveProperty('numeroVoo');
  });

  it('26. preserva número do voo quando explicitamente informado', () => {
    const perna = obterItinerario(extrairItinerarioSmartPaste(idaDireta)).ida.pernas[0];

    expect(perna.numeroVoo).toBe('LA 3701');
  });

  it('27. interpreta a fixture real LATAM direta sem alterar o parser legado', () => {
    const texto = readFileSync(
      new URL('../../tests/fixtures/smart-paste/latam/ida-volta.txt', import.meta.url),
      'utf8'
    );
    const itinerario = obterItinerario(extrairItinerarioSmartPaste(texto));

    expect(itinerario.ida.pernas[0]).toMatchObject({
      origem: 'GRU', destino: 'AJU', dataSaida: '2026-07-07',
    });
    expect(itinerario.volta?.pernas[0]).toMatchObject({
      origem: 'AJU', destino: 'GRU', dataSaida: '2026-07-18',
    });
  });

  it.each(['smiles', 'azul'])('28. falha com segurança na fixture real %s sem ano completo', (fonte) => {
    const texto = readFileSync(
      new URL(`../../tests/fixtures/smart-paste/${fonte}/ida-volta.txt`, import.meta.url),
      'utf8'
    );
    const resultado = extrairItinerarioSmartPaste(texto);

    expect(resultado.ok).toBe(false);
  });

  it('29. caracteriza o recorte temporal confirmado do SP-002', () => {
    const texto = [
      'IDA 23/08/2026',
      evento('23/08/2026', '20:40', 'GIG'),
      evento('24/08/2026', '14:15', 'AJU'),
      'VOLTA 29/08/2026',
      evento('29/08/2026', '02:45', 'AJU'),
      evento('29/08/2026', '07:45', 'GIG'),
    ].join('\n');
    const itinerario = obterItinerario(extrairItinerarioSmartPaste(texto));

    expect(itinerario.ida.pernas[0]).toMatchObject({
      dataSaida: '2026-08-23', horaSaida: '20:40',
      dataChegada: '2026-08-24', horaChegada: '14:15',
    });
    expect(itinerario.volta?.pernas[0]).toMatchObject({
      dataSaida: '2026-08-29', horaSaida: '02:45',
      dataChegada: '2026-08-29', horaChegada: '07:45',
    });
  });

  it('30. SP-002 completo falha sem os aeroportos das três pernas de ida', () => {
    const texto = [
      'IDA 23/08/2026',
      '2 conexões',
      evento('23/08/2026', '20:40', 'GIG'),
      evento('24/08/2026', '14:15', 'AJU'),
      'VOLTA 29/08/2026',
      '1 conexão',
      evento('29/08/2026', '02:45', 'AJU'),
      evento('29/08/2026', '07:45', 'GIG'),
    ].join('\n');

    expect(extrairItinerarioSmartPaste(texto))
      .toMatchObject({ ok: false, codigo: 'dados_insuficientes' });
  });

  it('31. caracteriza o recorte temporal confirmado do SP-003 sem misturar horários', () => {
    const texto = [
      'IDA 03/09/2026',
      '13:30 AJU | LATAM',
      '00:20 BSB +1 | LATAM',
      'VOLTA 18/09/2026',
      '21:10 BSB | LATAM',
      '09:50 AJU +1 | LATAM',
    ].join('\n');
    const itinerario = obterItinerario(extrairItinerarioSmartPaste(texto));

    expect(itinerario.ida.pernas[0]).toMatchObject({
      dataSaida: '2026-09-03', horaSaida: '13:30',
      dataChegada: '2026-09-04', horaChegada: '00:20',
    });
    expect(itinerario.volta?.pernas[0]).toMatchObject({
      dataSaida: '2026-09-18', horaSaida: '21:10',
      dataChegada: '2026-09-19', horaChegada: '09:50',
    });
  });

  it('32. SP-003 completo falha sem aeroportos intermediários das conexões', () => {
    const texto = [
      'IDA 03/09/2026',
      '1 conexão',
      '13:30 AJU',
      '00:20 BSB +1',
      'VOLTA 18/09/2026',
      '2 conexões',
      '21:10 BSB',
      '09:50 AJU +1',
    ].join('\n');

    expect(extrairItinerarioSmartPaste(texto))
      .toMatchObject({ ok: false, codigo: 'dados_insuficientes' });
  });

  it('33. diferencia texto vazio de inconsistência estrutural', () => {
    expect(extrairItinerarioSmartPaste('   ')).toMatchObject({
      ok: false,
      codigo: 'texto_nao_reconhecido',
    });
  });

  it('34. não converte ida e volta sem labels em uma única ida', () => {
    const texto = [
      evento('23/08/2026', '20:40', 'GIG'),
      evento('24/08/2026', '14:15', 'AJU'),
      evento('29/08/2026', '02:45', 'AJU'),
      evento('29/08/2026', '07:45', 'GIG'),
    ].join('\n');
    const resultado = extrairItinerarioSmartPaste(texto);

    expect(resultado).toMatchObject({
      ok: false,
      codigo: 'dados_insuficientes',
    });
  });

  it('35. reconhece somente ida real sem labels e sem sinal de retorno', () => {
    const texto = [
      evento('23/08/2026', '20:40', 'GIG'),
      evento('24/08/2026', '14:15', 'AJU'),
    ].join('\n');
    const itinerario = obterItinerario(extrairItinerarioSmartPaste(texto));

    expect(itinerario.ida.pernas).toHaveLength(1);
    expect(itinerario.volta).toBeUndefined();
  });

  it('36. mantém conexões contínuas sem labels como um único sentido', () => {
    const texto = [
      evento('03/09/2026', '08:00', 'AJU'),
      evento('03/09/2026', '10:00', 'GRU'),
      evento('03/09/2026', '11:00', 'GRU'),
      evento('03/09/2026', '13:00', 'BSB'),
    ].join('\n');
    const itinerario = obterItinerario(extrairItinerarioSmartPaste(texto));

    expect(itinerario.ida.pernas.map(({ origem, destino }) => [origem, destino]))
      .toEqual([['AJU', 'GRU'], ['GRU', 'BSB']]);
  });

  it('37. rejeita +1 associado ao evento de saída', () => {
    const resultado = extrairItinerarioSmartPaste([
      'IDA 31/12/2026',
      '08:00 GIG +1',
      '10:00 AJU',
    ].join('\n'));

    expect(resultado).toMatchObject({
      ok: false,
      codigo: 'inconsistencia_estrutural',
    });
  });

  it('38. aplica +1 na chegada atravessando a virada do mês', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste([
      'IDA 28/02/2027',
      '08:00 GIG',
      '10:00 AJU +1',
    ].join('\n')));

    expect(itinerario.ida.pernas[0].dataChegada).toBe('2027-03-01');
  });

  it('39. aplica +1 na chegada atravessando a virada do ano', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste([
      'IDA 31/12/2026',
      '22:00 GIG',
      '01:00 AJU +1',
    ].join('\n')));

    expect(itinerario.ida.pernas[0].dataChegada).toBe('2027-01-01');
  });

  it('40. não incrementa duas vezes uma chegada com data explícita e +1', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste([
      'IDA 31/12/2026',
      evento('31/12/2026', '22:00', 'GIG'),
      '01/01/2027 01:00 AJU +1',
    ].join('\n')));

    expect(itinerario.ida.pernas[0].dataChegada).toBe('2027-01-01');
  });

  it('41. restringe o +1 da ida à chegada da própria ida', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste([
      'IDA 31/12/2026',
      '22:00 GIG',
      '01:00 AJU +1',
      'VOLTA 10/01/2027',
      '08:00 AJU',
      '10:00 GIG',
    ].join('\n')));

    expect(itinerario.ida.pernas[0].dataChegada).toBe('2027-01-01');
    expect(itinerario.volta?.pernas[0].dataSaida).toBe('2027-01-10');
  });

  it('42. não usa data completa posterior para preencher saída anterior', () => {
    const resultado = extrairItinerarioSmartPaste([
      'IDA',
      '08:00 GIG',
      evento('24/08/2026', '10:00', 'AJU'),
    ].join('\n'));

    expect(resultado).toMatchObject({
      ok: false,
      codigo: 'dados_insuficientes',
    });
  });

  it('43. usa data de cabeçalho anterior como contexto dos eventos', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste([
      'IDA 24/08/2026',
      '08:00 GIG',
      '10:00 AJU',
    ].join('\n')));

    expect(itinerario.ida.pernas[0]).toMatchObject({
      dataSaida: '2026-08-24',
      dataChegada: '2026-08-24',
    });
  });

  it('44. aplica mudança explícita de data somente aos eventos seguintes', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste([
      'IDA 23/08/2026',
      '08:00 GIG',
      '10:00 AJU',
      'Data 24/08/2026',
      '12:00 AJU',
      '14:00 REC',
    ].join('\n')));

    expect(itinerario.ida.pernas[0]).toMatchObject({
      dataSaida: '2026-08-23',
      dataChegada: '2026-08-23',
    });
    expect(itinerario.ida.pernas[1]).toMatchObject({
      dataSaida: '2026-08-24',
      dataChegada: '2026-08-24',
    });
  });

  it('45. não promove LATAM Pass a companhia operacional', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste([
      'IDA 01/09/2026',
      evento('01/09/2026', '08:00', 'AJU', 'LATAM Pass'),
      evento('01/09/2026', '10:20', 'GRU', 'LATAM Pass'),
    ].join('\n')));

    expect(itinerario.ida.pernas[0]).not.toHaveProperty('companhia');
  });

  it('46. não promove cabeçalho Smiles a companhia operacional', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste([
      'IDA 01/09/2026',
      'Smiles',
      evento('01/09/2026', '08:00', 'AJU'),
      evento('01/09/2026', '10:20', 'GRU'),
    ].join('\n')));

    expect(itinerario.ida.pernas[0]).not.toHaveProperty('companhia');
  });

  it('47. não promove metadado comercial após pipe a companhia', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste([
      'IDA 01/09/2026',
      evento('01/09/2026', '08:00', 'AJU', 'Tarifa Light'),
      evento('01/09/2026', '10:20', 'GRU', 'Tarifa Light'),
    ].join('\n')));

    expect(itinerario.ida.pernas[0]).not.toHaveProperty('companhia');
  });

  it('48. ignora terceiro campo arbitrário como número de voo', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste([
      'IDA 01/09/2026',
      evento('01/09/2026', '08:00', 'AJU', 'Azul', 'bagagem incluída'),
      evento('01/09/2026', '10:20', 'GRU', 'Azul', 'bagagem incluída'),
    ].join('\n')));

    expect(itinerario.ida.pernas[0]).not.toHaveProperty('numeroVoo');
    expect(itinerario.ida.pernas[0]).not.toHaveProperty('companhia');
  });

  it('49. preserva companhia operacional em layout com voo válido', () => {
    const perna = obterItinerario(extrairItinerarioSmartPaste(idaDireta)).ida.pernas[0];

    expect(perna).toMatchObject({
      companhia: 'LATAM',
      numeroVoo: 'LA 3701',
    });
  });

  it('50. rejeita individualmente chegada seguida de chegada', () => {
    const resultado = extrairItinerarioSmartPaste([
      'IDA 01/09/2026',
      'CHEGADA 08:00 AJU',
      'CHEGADA 10:20 GRU',
    ].join('\n'));

    expect(resultado).toMatchObject({
      ok: false,
      codigo: 'inconsistencia_estrutural',
    });
  });

  it.each([
    ['Bagagem incluída', 'AD 4101'],
    ['Tarifa Light', 'LA 3701'],
    ['23kg', 'G3 1902'],
    ['Promoção especial', 'AD 4101'],
    ['LATAM Pass', 'LA 3701'],
    ['Smiles', 'G3 1902'],
  ])('51. não promove metadado comercial %s mesmo com voo válido', (metadado, voo) => {
    const perna = obterItinerario(extrairItinerarioSmartPaste([
      'IDA 01/09/2026',
      evento('01/09/2026', '08:00', 'GIG', metadado, voo),
      evento('01/09/2026', '10:00', 'AJU', metadado, voo),
    ].join('\n'))).ida.pernas[0];

    expect(perna).not.toHaveProperty('companhia');
    expect(perna.numeroVoo).toBe(voo);
  });

  it.each([
    ['Azul', 'AD 4101'],
    ['LATAM', 'LA 3701'],
    ['GOL', 'G3 1902'],
  ])('52. reconhece %s pela relação comprovada com o voo', (companhia, voo) => {
    const perna = obterItinerario(extrairItinerarioSmartPaste([
      'IDA 01/09/2026',
      evento('01/09/2026', '08:00', 'GIG', companhia, voo),
      evento('01/09/2026', '10:00', 'AJU', companhia, voo),
    ].join('\n'))).ida.pernas[0];

    expect(perna).toMatchObject({
      origem: 'GIG',
      destino: 'AJU',
      companhia,
      numeroVoo: voo,
    });
  });

  it.each([
    'Companhia: Azul',
    'Companhia aérea: Azul',
    'Operado por Azul',
    'Operado pela Azul',
  ])('53. aceita companhia operacional explicitamente rotulada: %s', (rotulo) => {
    const perna = obterItinerario(extrairItinerarioSmartPaste([
      'IDA 01/09/2026',
      rotulo,
      evento('01/09/2026', '08:00', 'GIG'),
      evento('01/09/2026', '10:00', 'AJU'),
    ].join('\n'))).ida.pernas[0];

    expect(perna.companhia).toBe('Azul');
  });

  it('54. rejeita valor comercial mesmo em campo explicitamente rotulado', () => {
    const perna = obterItinerario(extrairItinerarioSmartPaste([
      'IDA 01/09/2026',
      'Companhia: Bagagem incluída',
      evento('01/09/2026', '08:00', 'GIG'),
      evento('01/09/2026', '10:00', 'AJU'),
    ].join('\n'))).ida.pernas[0];

    expect(perna).not.toHaveProperty('companhia');
  });

  it('55. não aceita nome operacional sem correlação com o prefixo do voo', () => {
    const perna = obterItinerario(extrairItinerarioSmartPaste([
      'IDA 01/09/2026',
      evento('01/09/2026', '08:00', 'GIG', 'LATAM', 'AD 4101'),
      evento('01/09/2026', '10:00', 'AJU', 'LATAM', 'AD 4101'),
    ].join('\n'))).ida.pernas[0];

    expect(perna).not.toHaveProperty('companhia');
    expect(perna.numeroVoo).toBe('AD 4101');
  });

  it('56. rejeita individualmente chegada seguida de saída', () => {
    const resultado = extrairItinerarioSmartPaste([
      'IDA 01/09/2026',
      'CHEGADA 08:00 GIG',
      'SAÍDA 10:00 AJU',
    ].join('\n'));

    expect(resultado).toMatchObject({ ok: false, codigo: 'inconsistencia_estrutural' });
  });

  it('57. rejeita individualmente saída seguida de saída', () => {
    const resultado = extrairItinerarioSmartPaste([
      'IDA 01/09/2026',
      'SAÍDA 08:00 GIG',
      'SAÍDA 10:00 AJU',
    ].join('\n'));

    expect(resultado).toMatchObject({ ok: false, codigo: 'inconsistencia_estrutural' });
  });

  it('58. trata Ida e volta como tipo de viagem diante dos marcadores LATAM específicos', () => {
    const texto = readFileSync(
      new URL(
        '../../tests/fixtures/smart-paste/latam/operacional-salvador-ida-volta.txt',
        import.meta.url
      ),
      'utf8'
    );
    const resultado = extrairItinerarioSmartPaste(texto);
    const itinerario = obterItinerario(resultado);

    expect(resultado).toMatchObject({ ok: true });
    expect(itinerario.ida.pernas).toHaveLength(1);
    expect(itinerario.ida.pernas[0]).toMatchObject({
      origem: 'GRU',
      destino: 'SSA',
      companhia: 'LATAM Airlines Brasil',
      dataSaida: '2026-09-11',
      dataChegada: '2026-09-11',
      horaSaida: '09:50',
      horaChegada: '12:10',
    });
    expect(itinerario.volta?.pernas).toHaveLength(1);
    expect(itinerario.volta?.pernas[0]).toMatchObject({
      origem: 'SSA',
      destino: 'GRU',
      companhia: 'LATAM Airlines Brasil',
      dataSaida: '2026-09-14',
      dataChegada: '2026-09-14',
      horaSaida: '18:35',
      horaChegada: '21:05',
    });
  });

  it('59. preserva o marcador genérico quando não há ida e volta específicas posteriores', () => {
    const itinerario = obterItinerario(extrairItinerarioSmartPaste([
      'Ida e volta',
      '01/09/2026 08:00 GIG',
      '01/09/2026 10:00 SSA',
    ].join('\n')));

    expect(itinerario.ida.pernas[0]).toMatchObject({
      origem: 'GIG',
      destino: 'SSA',
    });
    expect(itinerario.volta).toBeUndefined();
  });
});
