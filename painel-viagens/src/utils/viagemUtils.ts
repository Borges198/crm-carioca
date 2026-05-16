export const VALOR_MILHEIRO: Record<string, number> = {
  Azul: 16.00,
  GOL: 17.00,
  Latam: 27.00
};

export const maskHora = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '$1:$2')
    .slice(0, 5);
};

export const isHoraValida = (horaStr: string) => {
  if (horaStr.length !== 5) return false;
  const [h, m] = horaStr.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
};

export const calcularDuracao = (saida: string, chegada: string) => {
  if (!isHoraValida(saida) || !isHoraValida(chegada)) return '--h --m';
  const [hSaida, mSaida] = saida.split(':').map(Number);
  const [hChegada, mChegada] = chegada.split(':').map(Number);
  
  const minutosSaida = (hSaida * 60) + mSaida;
  let minutosChegada = (hChegada * 60) + mChegada;
  
  if (minutosChegada < minutosSaida) minutosChegada += 24 * 60;
  
  const diff = minutosChegada - minutosSaida;
  const horas = Math.floor(diff / 60);
  const minutosRestantes = diff % 60;
  
  return `${horas}h ${minutosRestantes.toString().padStart(2, '0')}m`;
};