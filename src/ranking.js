// Ranking local (top 10) guardado en el navegador de la máquina del evento.
const Ranking = {
  KEY: 'cot-ruta-a-la-costa-ranking',
  SIZE: 10,

  load() {
    try {
      const list = JSON.parse(localStorage.getItem(this.KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  },

  save(list) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(list));
    } catch (e) {
      // Sin almacenamiento (modo privado, etc.): el juego sigue funcionando.
    }
  },

  qualifies(score) {
    const list = this.load();
    return score > 0 && (list.length < this.SIZE || score > list[list.length - 1].score);
  },

  // Devuelve la posición (0 = primero) en la que quedó la entrada.
  add(name, score) {
    const entry = { name, score, date: Date.now() };
    const list = this.load();
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    const top = list.slice(0, this.SIZE);
    this.save(top);
    return top.indexOf(entry);
  },

  clear() {
    this.save([]);
  }
};
