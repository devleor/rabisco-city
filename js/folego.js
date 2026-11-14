// Fôlego do gancho, de 0 a 1: gasta enquanto puxa, volta depois de um tempinho sem usar.
const Folego = {
  MINIMO: .15,      // abaixo disso o gancho não dispara
  GASTO: 1 / 5.5,   // por segundo puxando: uns 5 segundos e meio de gancho
  VOLTA: 1 / 4,     // por segundo descansando: 4 segundos pra encher
  ESPERA: .7,       // segundos sem usar antes de começar a voltar
  pode(f) { return f >= this.MINIMO; },
  passo(f, puxando, dt, semUsar) {
    if (puxando) return Math.max(0, f - this.GASTO * dt);
    return semUsar >= this.ESPERA ? Math.min(1, f + this.VOLTA * dt) : f;
  },
};
if (typeof module !== 'undefined') module.exports = Folego;
