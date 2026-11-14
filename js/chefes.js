// Regras dos chefes, sem Three.js: em que onda cada um vem, quanta vida tem, quanto o chão treme,
// com que velocidade o Colosso arremessa um bloco, e que pedaços da cúpula somem quando ela quebra.
const Chefes = {
  // 'colosso' a cada 10 ondas; 'borracha' como elite nas ondas 5, 8, 13, 15, 18...; null nas outras.
  daOnda(onda) {
    if (!(onda > 0)) return null;
    if (onda % 10 === 0) return 'colosso';
    if (onda >= 5 && (onda % 5 === 0 || onda % 5 === 3)) return 'borracha';
    return null;
  },
  vida(tipo, onda) {
    return tipo === 'colosso' ? 3000 + Math.max(0, onda - 10) * 150 : 700 + Math.max(0, onda - 5) * 60;
  },
  // quantos bonecos comuns vêm junto com o chefe
  capangas(tipo, onda) {
    return tipo === 'colosso' ? 8 : Math.round((4 + onda * 3) * .6);
  },
  // tremor da tela por um impacto a `dist` metros: cheio em cima, zero a partir de `alcance`
  tremor(dist, forca = 1, alcance = 90) {
    return Math.max(0, Math.min(forca, forca * (1 - dist / alcance)));
  },
  // velocidade inicial pra sair de `de` e cair em `para` depois de `t` segundos, com gravidade `g`
  arremesso(de, para, t, g) {
    return { x: (para.x - de.x) / t, y: (para.y - de.y) / t + g * t / 2, z: (para.z - de.z) / t };
  },
  // segmentos (6 números cada: x1,y1,z1,x2,y2,z2) cujo meio fica a mais de `raio` de `p`
  semBuraco(segs, p, raio) {
    const fica = [], r2 = raio * raio;
    for (let i = 0; i + 5 < segs.length; i += 6) {
      const mx = (segs[i] + segs[i + 3]) / 2 - p.x, my = (segs[i + 1] + segs[i + 4]) / 2 - p.y, mz = (segs[i + 2] + segs[i + 5]) / 2 - p.z;
      if (mx * mx + my * my + mz * mz > r2) for (let k = 0; k < 6; k++) fica.push(segs[i + k]);
    }
    return fica;
  },
  // o passo anda em fase (radianos); a cada meia volta um pé bate no chão. Devolve 0 ou 1 (qual pé), ou -1 se nenhum bateu.
  pisou(antes, agora) {
    const a = Math.floor(antes / Math.PI), b = Math.floor(agora / Math.PI);
    return b === a ? -1 : ((b % 2) + 2) % 2;
  },
};
if (typeof module !== 'undefined') module.exports = Chefes;
