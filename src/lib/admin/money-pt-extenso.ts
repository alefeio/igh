const UNITS = [
  "zero",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
] as const;

const TENS = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
] as const;

const HUNDREDS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
] as const;

function under1000(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  if (n < 20) return UNITS[n];
  if (n < 100) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    return unit === 0 ? TENS[ten] : `${TENS[ten]} e ${UNITS[unit]}`;
  }
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const head = HUNDREDS[hundred];
  if (rest === 0) return head;
  return `${head} e ${under1000(rest)}`;
}

function integerToWords(n: number): string {
  if (n === 0) return "zero";
  const chunks: Array<{ value: number; text: string }> = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  if (millions > 0) {
    chunks.push({
      value: millions * 1_000_000,
      text: millions === 1 ? "um milhão" : `${under1000(millions)} milhões`,
    });
  }
  if (thousands > 0) {
    chunks.push({
      value: thousands * 1000,
      text: thousands === 1 ? "mil" : `${under1000(thousands)} mil`,
    });
  }
  if (rest > 0) {
    chunks.push({ value: rest, text: under1000(rest) });
  }

  if (chunks.length === 1) return chunks[0].text;

  let result = chunks[0].text;
  for (let i = 1; i < chunks.length; i++) {
    const curr = chunks[i];
    result += curr.value < 100 ? ` e ${curr.text}` : ` ${curr.text}`;
  }
  return result;
}

/** Valor monetário por extenso em reais (ex.: 375000 centavos → "três mil setecentos e cinquenta reais"). */
export function formatReaisPorExtenso(cents: number | null | undefined): string {
  if (cents == null || cents < 0) return "—";
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  const reaisText = reais === 1 ? "um real" : `${integerToWords(reais)} reais`;
  if (centavos === 0) return reaisText;
  const centsText = centavos === 1 ? "um centavo" : `${integerToWords(centavos)} centavos`;
  return `${reaisText} e ${centsText}`;
}
