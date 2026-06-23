import { describe, expect, it } from 'vitest';
import {
  calcularValorTotal,
  calcularValorTotalTrechos,
  calcularValorTrecho,
} from './viagemUtils';

describe('viagemUtils - caracterizacao do calculo de milhas por trecho', () => {
  it('calcula somente ida com companhia, pontos e taxa da ida', () => {
    const valorIda = calcularValorTrecho(28, 34, 'Latam');
    const valorVolta = 0;

    expect(valorIda).toBe(790);
    expect(valorVolta).toBe(0);
    expect(valorIda + valorVolta).toBe(790);
  });

  it('calcula ida e volta LATAM somando valorIda e valorVolta', () => {
    const valorIda = calcularValorTrecho(28, 34, 'Latam');
    const valorVolta = calcularValorTrecho(39, 53, 'Latam');
    const valorTotal = calcularValorTotalTrechos({
      ida: { companhia: 'Latam', pontos: 28, taxa: 34 },
      volta: { companhia: 'Latam', pontos: 39, taxa: 53 },
    });

    expect(valorIda).toBe(790);
    expect(valorVolta).toBe(1106);
    expect(valorTotal).toBe(valorIda + valorVolta);
  });

  it('calcula ida GOL e volta LATAM usando a companhia de cada trecho', () => {
    const valorIda = calcularValorTrecho(10, 40, 'GOL');
    const valorVolta = calcularValorTrecho(20, 50, 'Latam');
    const valorTotal = calcularValorTotalTrechos({
      ida: { companhia: 'GOL', pontos: 10, taxa: 40 },
      volta: { companhia: 'Latam', pontos: 20, taxa: 50 },
    });

    expect(valorIda).toBe(210);
    expect(valorVolta).toBe(590);
    expect(valorTotal).toBe(800);
  });

  it('calcula ida LATAM e volta Azul sem compartilhar parametros entre trechos', () => {
    const valorTotal = calcularValorTotalTrechos({
      ida: { companhia: 'Latam', pontos: 12, taxa: 120 },
      volta: { companhia: 'Azul', pontos: 34, taxa: 235 },
    });

    expect(valorTotal).toBe(120 + 12 * 27 + 235 + 34 * 16);
  });

  it('preserva taxas diferentes por trecho na soma final', () => {
    const valorIda = calcularValorTrecho(10, 120, 'Azul');
    const valorVolta = calcularValorTrecho(10, 235, 'Azul');

    expect(valorIda).toBe(280);
    expect(valorVolta).toBe(395);
    expect(valorIda + valorVolta).toBe(675);
  });

  it('preserva pontos diferentes por trecho na soma final', () => {
    const valorIda = calcularValorTrecho(11, 100, 'GOL');
    const valorVolta = calcularValorTrecho(23, 100, 'GOL');

    expect(valorIda).toBe(287);
    expect(valorVolta).toBe(491);
    expect(valorIda + valorVolta).toBe(778);
  });

  it('calcula total global com os campos globais atuais', () => {
    expect(calcularValorTotal(35, 124, 'Azul')).toBe(684);
  });

  it('mantem o mesmo calculo para cenarios de aeroportos diferentes por trecho', () => {
    const pontosIda = 28;
    const pontosVolta = 39;
    const taxaIda = 34;
    const taxaVolta = 53;
    const valorIda = calcularValorTrecho(pontosIda, taxaIda, 'Latam');
    const valorVolta = calcularValorTrecho(pontosVolta, taxaVolta, 'Latam');
    const valorTotal = calcularValorTotalTrechos({
      ida: { companhia: 'Latam', pontos: pontosIda, taxa: taxaIda },
      volta: { companhia: 'Latam', pontos: pontosVolta, taxa: taxaVolta },
    });

    expect({
      pontosIda,
      pontosVolta,
      taxaIda,
      taxaVolta,
      valorIda,
      valorVolta,
      valorTotal,
    }).toEqual({
      pontosIda: 28,
      pontosVolta: 39,
      taxaIda: 34,
      taxaVolta: 53,
      valorIda: 790,
      valorVolta: 1106,
      valorTotal: 1896,
    });
  });

  it('trata valores zero como calculo valido quando ha companhia conhecida', () => {
    expect(calcularValorTrecho(0, 0, 'Latam')).toBe(0);
    expect(calcularValorTotalTrechos({
      ida: { companhia: 'Latam', pontos: 0, taxa: 0 },
      volta: { companhia: 'Azul', pontos: 0, taxa: 0 },
    })).toBe(0);
  });

  it('trata campos vazios de trecho como zero quando a companhia existe', () => {
    expect(calcularValorTotalTrechos({
      ida: { companhia: 'Latam', pontos: undefined, taxa: undefined },
      volta: { companhia: 'Azul', pontos: null, taxa: null },
    })).toBe(0);
  });

  it('ignora trecho sem companhia ou com companhia desconhecida no calculo por trechos', () => {
    expect(calcularValorTotalTrechos({
      ida: { companhia: null, pontos: 20, taxa: 100 },
      volta: { companhia: 'TAP', pontos: 30, taxa: 200 },
    })).toBe(0);
  });

  it('mantem resultado NaN quando o calculo direto recebe companhia desconhecida', () => {
    expect(Number.isNaN(calcularValorTrecho(20, 100, 'TAP'))).toBe(true);
    expect(Number.isNaN(calcularValorTotal(20, 100, 'TAP'))).toBe(true);
  });

  it('aceita numeros decimais e negativos sem normalizacao adicional', () => {
    expect(calcularValorTrecho(10.5, 33.5, 'GOL')).toBe(212);
    expect(calcularValorTrecho(-10, 100, 'Azul')).toBe(-60);
  });
});
